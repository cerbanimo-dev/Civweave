import crypto from 'node:crypto';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';
import { NodeMoneyEdgeService, NODE_MONEY_EDGE_SCHEMA } from './node-money-edge-v1.mjs';
import { StripeConnectDirectProvider } from './node-money-edge-stripe-v1.mjs';
import { loadOrCreateMoneyEdgeIdentity } from './node-money-edge-bootstrap-v1.mjs';

function clean(value, max = 4000) { return String(value ?? '').trim().slice(0, max); }
function secretReady(value) { return Buffer.byteLength(clean(value, 10000)) >= 32; }
function constantTime(left, right) { const a = Buffer.from(String(left)), b = Buffer.from(String(right)); return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b); }
function sendJson(res, status, payload, headers = {}) { const bytes = Buffer.from(JSON.stringify(payload)); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': bytes.length, 'cache-control': 'no-store', ...headers }); res.end(bytes); }
async function readRaw(req, limit = 512 * 1024) { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > limit) throw Object.assign(new Error('Request body too large.'), { status: 413 }); chunks.push(chunk); } return Buffer.concat(chunks); }
function parseJson(raw) { if (!raw.length) return {}; try { return JSON.parse(raw.toString('utf8')); } catch { throw Object.assign(new Error('Invalid JSON body.'), { status: 400 }); } }
function errorStatus(error) { if (Number.isSafeInteger(error?.status)) return error.status; const message = String(error?.message || ''); if (/signature|credential|authorization|enrollment grant/i.test(message)) return 401; if (/not registered|not owned|not found|unknown/i.test(message)) return 404; if (error instanceof TypeError || error instanceof RangeError || /invalid|blocked|must|cannot|exceed|incomplete|disabled|mismatch|public internet/i.test(message)) return 400; return 500; }
function safeError(error) { const status = errorStatus(error); return { status, body: { error: status === 500 ? 'Civweave money edge request failed.' : clean(error?.message || error, 1200) } }; }

function privateIpv4(address) {
  const octets = String(address).split('.').map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  const [a,b,c] = octets;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224;
}
function privateIpv6(address) {
  const normalized = String(address).toLowerCase().split('%')[0];
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('ff')) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  return mapped ? privateIpv4(mapped[1]) : false;
}
function assertPublicAddress(address) {
  const family = net.isIP(String(address));
  if (family === 4 && privateIpv4(address)) throw new RangeError('Money-edge registration callback must resolve to the public internet.');
  if (family === 6 && privateIpv6(address)) throw new RangeError('Money-edge registration callback must resolve to the public internet.');
  if (!family) throw new RangeError('Money-edge registration callback resolved to an invalid IP address.');
  return true;
}
export async function assertPublicRegistrationCallback(value, { lookup = dns.lookup } = {}) {
  const url = new URL(clean(value, 4000));
  if (url.protocol !== 'https:') throw new RangeError('Live money node callback URLs must use HTTPS.');
  if (url.username || url.password) throw new RangeError('Money-edge registration callback cannot contain URL credentials.');
  let hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (hostname.startsWith('[') && hostname.endsWith(']')) hostname = hostname.slice(1, -1);
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan')) throw new RangeError('Money-edge registration callback must use a public hostname.');
  if (net.isIP(hostname)) assertPublicAddress(hostname);
  else {
    const resolved = await lookup(hostname, { all: true, verbatim: true });
    const records = Array.isArray(resolved) ? resolved : [resolved];
    if (!records.length) throw new RangeError('Money-edge registration callback hostname did not resolve.');
    for (const record of records) assertPublicAddress(record?.address || record);
  }
  return url.origin;
}

export function createNodeMoneyEdgeHttpHandler({
  requested = process.env.CIVWEAVE_MONEY_EDGE_ENABLED === '1',
  databasePath = process.env.CIVWEAVE_MONEY_EDGE_DB_PATH || path.join(process.env.DATA_DIR || './data', 'node-money-edge-v1.sqlite'),
  provider = null,
  adminSecret = process.env.CIVWEAVE_MONEY_EDGE_ADMIN_SECRET || '',
  privateKey = process.env.CIVWEAVE_MONEY_EDGE_PRIVATE_KEY || '',
  keyId = process.env.CIVWEAVE_MONEY_EDGE_KEY_ID || '',
  platformFeeBps = process.env.CIVWEAVE_MONEY_PLATFORM_FEE_BPS,
  now = () => Date.now(),
  fetchImpl = globalThis.fetch,
  dnsLookup = dns.lookup
} = {}) {
  const stripe = provider || new StripeConnectDirectProvider({ now, fetchImpl });
  let service = null, startupError = null, identity = null;
  if (requested) {
    try {
      identity = loadOrCreateMoneyEdgeIdentity({
        dataDir: process.env.DATA_DIR || path.dirname(databasePath),
        env: {
          ...process.env,
          ...(privateKey ? { CIVWEAVE_MONEY_EDGE_PRIVATE_KEY: privateKey } : {}),
          ...(keyId ? { CIVWEAVE_MONEY_EDGE_KEY_ID: keyId } : {}),
          ...(adminSecret ? { CIVWEAVE_MONEY_EDGE_ADMIN_SECRET: adminSecret } : {})
        },
        now
      });
      service = new NodeMoneyEdgeService({ databasePath, provider: stripe, privateKey: identity.privateKey, keyId: identity.keyId, platformFeeBps, now, fetchImpl });
    } catch (error) { startupError = error; }
  }
  const effectiveAdminSecret = clean(adminSecret, 10000) || clean(identity?.adminSecret, 10000);
  function status() {
    const readiness = service?.readiness?.() || null;
    return Object.freeze({
      schema: NODE_MONEY_EDGE_SCHEMA,
      requested: Boolean(requested),
      enabled: Boolean(service),
      startupError: startupError ? clean(startupError.message, 500) : null,
      provider: stripe?.id || null,
      providerMode: stripe?.mode || null,
      operatorPayouts: stripe?.operatorPayouts || null,
      enrollmentMode: 'proof-of-key-short-lived-grant',
      sharedRegistrationSecretRequired: false,
      signingIdentityGeneratedLocally: Boolean(identity?.signingIdentityGeneratedLocally),
      adminCredentialGeneratedLocally: Boolean(identity?.adminCredentialGeneratedLocally),
      persistentIdentityPath: identity?.filePath || null,
      readiness
    });
  }
  function requireAdmin(req) {
    if (!secretReady(effectiveAdminSecret)) throw new Error('Money-edge administrative credential is not configured.');
    const supplied = clean(req.headers['x-civweave-money-edge-admin'], 10000);
    if (!constantTime(supplied, effectiveAdminSecret)) throw new Error('Invalid money-edge administrative credential.');
  }
  async function handle(req, res, url) {
    const pathname = decodeURIComponent(url.pathname);
    if (!pathname.startsWith('/api/money-edge')) return false;
    if (pathname === '/api/money-edge/status' && req.method === 'GET') { sendJson(res, 200, { moneyEdge: status() }); return true; }
    if (!service) { sendJson(res, 503, { error: 'Civweave money edge is disabled or unavailable.', moneyEdge: status() }); return true; }
    try {
      if (pathname === '/api/money-edge/trust' && req.method === 'GET') {
        sendJson(res, 200, { trust: { ...service.trustDocument(), origin: url.origin } }); return true;
      }
      if (pathname === '/api/money-edge/enrollment/start') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        const input = parseJson(await readRaw(req, 128 * 1024));
        input.callbackUrl = await assertPublicRegistrationCallback(input.callbackUrl, { lookup: dnsLookup });
        sendJson(res, 201, { enrollment: await service.createEnrollmentGrant(input) }); return true;
      }
      if (pathname === '/api/money-edge/nodes/register') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        const input = parseJson(await readRaw(req, 128 * 1024));
        input.callbackUrl = await assertPublicRegistrationCallback(input.callbackUrl, { lookup: dnsLookup });
        sendJson(res, 201, { registration: await service.registerNode(input) }); return true;
      }
      const statusMatch = /^\/api\/money-edge\/nodes\/([^/]+)\/status$/.exec(pathname);
      if (statusMatch) {
        if (req.method !== 'GET') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        const raw = Buffer.alloc(0), nodeId = decodeURIComponent(statusMatch[1]);
        sendJson(res, 200, { operator: await service.operatorStatus(nodeId, raw, req.headers['x-civweave-node-signature']) }); return true;
      }
      if (pathname === '/api/money-edge/topups') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        const raw = await readRaw(req, 128 * 1024), input = parseJson(raw);
        sendJson(res, 201, { topup: await service.createTopUp(input, raw, req.headers['x-civweave-node-signature']) }); return true;
      }
      const refundMatch = /^\/api\/money-edge\/topups\/([^/]+)\/refund$/.exec(pathname);
      if (refundMatch) {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        const raw = await readRaw(req, 128 * 1024), input = parseJson(raw);
        sendJson(res, 202, { refund: await service.refundTopUp({ nodeId: input.nodeId, topupId: decodeURIComponent(refundMatch[1]), amountCents: input.amountCents }, raw, req.headers['x-civweave-node-signature']) }); return true;
      }
      if (pathname === '/api/money-edge/webhooks/stripe') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        const raw = await readRaw(req, 1024 * 1024), event = stripe.verifyWebhook(raw, req.headers['stripe-signature']);
        sendJson(res, 200, { ok: true, result: await service.handleProviderEvent(event) }); return true;
      }
      if (pathname === '/api/money-edge/reconcile/deliveries') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        requireAdmin(req); const input = parseJson(await readRaw(req, 64 * 1024));
        sendJson(res, 200, { schema: NODE_MONEY_EDGE_SCHEMA, deliveries: await service.deliverPending({ limit: input.limit || 100 }) }); return true;
      }
      sendJson(res, 404, { error: 'Money-edge route not found.' }); return true;
    } catch (error) {
      const safe = safeError(error); sendJson(res, safe.status, safe.body); return true;
    }
  }
  return Object.freeze({ status, handle, service, provider: stripe });
}
