import crypto from 'node:crypto';
import path from 'node:path';
import { NodeMoneyEdgeService, NODE_MONEY_EDGE_SCHEMA } from './node-money-edge-v1.mjs';
import { StripeConnectDirectProvider } from './node-money-edge-stripe-v1.mjs';

function clean(value, max = 4000) { return String(value ?? '').trim().slice(0, max); }
function secretReady(value) { return Buffer.byteLength(clean(value, 10000)) >= 32; }
function constantTime(left, right) { const a = Buffer.from(String(left)), b = Buffer.from(String(right)); return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b); }
function sendJson(res, status, payload, headers = {}) { const bytes = Buffer.from(JSON.stringify(payload)); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': bytes.length, 'cache-control': 'no-store', ...headers }); res.end(bytes); }
async function readRaw(req, limit = 512 * 1024) { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > limit) throw Object.assign(new Error('Request body too large.'), { status: 413 }); chunks.push(chunk); } return Buffer.concat(chunks); }
function parseJson(raw) { if (!raw.length) return {}; try { return JSON.parse(raw.toString('utf8')); } catch { throw Object.assign(new Error('Invalid JSON body.'), { status: 400 }); } }
function errorStatus(error) { if (Number.isSafeInteger(error?.status)) return error.status; const message = String(error?.message || ''); if (/signature|credential|authorization/i.test(message)) return 401; if (/not registered|not owned|not found|unknown/i.test(message)) return 404; if (error instanceof TypeError || error instanceof RangeError || /invalid|blocked|must|cannot|exceed|incomplete|disabled|mismatch/i.test(message)) return 400; return 500; }
function safeError(error) { const status = errorStatus(error); return { status, body: { error: status === 500 ? 'Civweave money edge request failed.' : clean(error?.message || error, 1200) } }; }

export function createNodeMoneyEdgeHttpHandler({
  requested = process.env.CIVWEAVE_MONEY_EDGE_ENABLED === '1',
  databasePath = process.env.CIVWEAVE_MONEY_EDGE_DB_PATH || path.join(process.env.DATA_DIR || './data', 'node-money-edge-v1.sqlite'),
  provider = null,
  adminSecret = process.env.CIVWEAVE_MONEY_EDGE_ADMIN_SECRET || '',
  privateKey = process.env.CIVWEAVE_MONEY_EDGE_PRIVATE_KEY || '',
  keyId = process.env.CIVWEAVE_MONEY_EDGE_KEY_ID || 'cerbanimo-money-edge-v1',
  now = () => Date.now(),
  fetchImpl = globalThis.fetch
} = {}) {
  const stripe = provider || new StripeConnectDirectProvider({ now, fetchImpl });
  let service = null, startupError = null;
  if (requested) {
    try { service = new NodeMoneyEdgeService({ databasePath, provider: stripe, privateKey, keyId, now, fetchImpl }); }
    catch (error) { startupError = error; }
  }
  function status() {
    const readiness = service?.readiness?.() || null;
    return Object.freeze({ schema: NODE_MONEY_EDGE_SCHEMA, requested: Boolean(requested), enabled: Boolean(service), startupError: startupError ? clean(startupError.message, 500) : null, provider: stripe?.id || null, providerMode: stripe?.mode || null, operatorPayouts: stripe?.operatorPayouts || null, readiness });
  }
  function requireAdmin(req) {
    if (!secretReady(adminSecret)) throw new Error('Money-edge administrative credential is not configured.');
    const supplied = clean(req.headers['x-civweave-money-edge-admin'], 10000);
    if (!constantTime(supplied, adminSecret)) throw new Error('Invalid money-edge administrative credential.');
  }
  async function handle(req, res, url) {
    const pathname = decodeURIComponent(url.pathname);
    if (!pathname.startsWith('/api/money-edge')) return false;
    if (pathname === '/api/money-edge/status' && req.method === 'GET') { sendJson(res, 200, { moneyEdge: status() }); return true; }
    if (!service) { sendJson(res, 503, { error: 'Civweave money edge is disabled or unavailable.', moneyEdge: status() }); return true; }
    try {
      if (pathname === '/api/money-edge/nodes/register') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        const raw = await readRaw(req, 128 * 1024), input = parseJson(raw);
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
        requireAdmin(req); const raw = await readRaw(req, 64 * 1024), input = parseJson(raw);
        sendJson(res, 200, { schema: NODE_MONEY_EDGE_SCHEMA, deliveries: await service.deliverPending({ limit: input.limit || 100 }) }); return true;
      }
      sendJson(res, 404, { error: 'Money-edge route not found.' }); return true;
    } catch (error) {
      const safe = safeError(error); sendJson(res, safe.status, safe.body); return true;
    }
  }
  return Object.freeze({ status, handle, service, provider: stripe });
}
