import crypto from 'node:crypto';
import { requireNodeOperatorAuth } from './node-ai-operator-session-v1.mjs';
import { DEFAULT_CIVWEAVE_MONEY_EDGE_URL } from './node-ai-bootstrap-v1.mjs';

export const NODE_TERRITORY_HOST_AUTHORITY_SCHEMA = 'civweave.node-territory-host-authority.v1';
export const TERRITORY_HOST_ADMISSION_REQUEST_DOMAIN = 'civweave.territory-host-admission-request.v1';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
function sendJson(res, status, payload) {
  const bytes = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': bytes.length, 'cache-control': 'no-store' });
  res.end(bytes);
}
async function readJson(req, limit = 128 * 1024) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw Object.assign(new Error('Request body too large.'), { status: 413 }); chunks.push(chunk); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('Invalid JSON body.'), { status: 400 }); }
}
function nodeCallback(manifest) {
  const candidate = clean(manifest?.publicOrigin || manifest?.metadata?.endpoints?.baseUrls?.[0], 4000);
  if (!candidate) return '';
  try { return new URL(candidate).href; } catch { return ''; }
}
function safeStatus(error) {
  if (Number.isSafeInteger(error?.status)) return error.status;
  const message = String(error?.message || '');
  if (/authorization|session|signature|authority|forbidden|revoked/i.test(message)) return 403;
  if (/not found/i.test(message)) return 404;
  if (/invalid|required|expired|already used|outside/i.test(message)) return 400;
  return 500;
}

export function signTerritoryHostAdmissionRequest(rawBody, { privateKey, keyId = 'node-default', timestamp = Math.floor(Date.now() / 1000) } = {}) {
  if (!privateKey) throw new Error('Node receipt signing key is unavailable.');
  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
  const message = Buffer.concat([Buffer.from(`${TERRITORY_HOST_ADMISSION_REQUEST_DOMAIN}\n${timestamp}\n`), raw]);
  const signature = crypto.sign(null, message, privateKey).toString('base64url');
  return `t=${timestamp},kid=${clean(keyId, 160)},sig=${signature}`;
}

export function createNodeTerritoryHostAuthorityHandler({
  manifest,
  internalSecret = '',
  receiptPrivateKey = '',
  receiptKeyId = 'node-default',
  coreUrl = process.env.CIVWEAVE_CORE_URL || process.env.CIVWEAVE_MONEY_EDGE_URL || DEFAULT_CIVWEAVE_MONEY_EDGE_URL,
  fetchImpl = globalThis.fetch,
  now = () => Date.now()
} = {}) {
  const callbackUrl = nodeCallback(manifest);
  const effectiveCoreUrl = clean(coreUrl) || DEFAULT_CIVWEAVE_MONEY_EDGE_URL;
  const coreOrigin = (() => { try { const parsed = new URL(effectiveCoreUrl); return parsed.protocol === 'https:' ? parsed.origin : ''; } catch { return ''; } })();
  const ready = Boolean(manifest?.nodeId && manifest?.operatorId && callbackUrl && internalSecret && receiptPrivateKey && coreOrigin && typeof fetchImpl === 'function');

  function status() {
    return Object.freeze({
      schema: NODE_TERRITORY_HOST_AUTHORITY_SCHEMA,
      ready,
      nodeId: manifest?.nodeId || null,
      operatorId: manifest?.operatorId || null,
      callbackUrl: callbackUrl || null,
      coreOrigin: coreOrigin || null,
      grantMode: 'root-bound-territory-authority',
      rootSecretsPresent: false,
      recursiveAuthorityDelegation: false
    });
  }
  function requireInternal(req) {
    return requireNodeOperatorAuth(req, { nodeId: manifest?.nodeId || '', secret: internalSecret, now });
  }
  async function coreRequest(pathname, { method = 'GET', body = null, headers: extraHeaders = {} } = {}) {
    if (!coreOrigin) throw new Error('Canonical Civweave core is unavailable.');
    const raw = body == null ? null : Buffer.from(JSON.stringify(body));
    const headers = { accept: 'application/json', ...extraHeaders };
    if (raw) headers['content-type'] = 'application/json';
    const response = await fetchImpl(new URL(pathname, coreOrigin), { method, headers, body: raw || undefined, cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(clean(payload?.error || payload?.message, 1200) || `Civweave core returned HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function handle(req, res, url) {
    const pathname = decodeURIComponent(url.pathname);
    if (!pathname.startsWith('/api/ai/node/territory-host-authority')) return false;
    try {
      if (pathname === '/api/ai/node/territory-host-authority/status' && req.method === 'GET') {
        const local = status();
        if (!ready) { sendJson(res, 200, { authority: local, binding: null }); return true; }
        const registry = await coreRequest('/api/federation/territory-host-authorities');
        const binding = (registry?.authorities || []).find(item => item.issuerNodeId === manifest.nodeId && item.status === 'active') || null;
        sendJson(res, 200, { authority: local, binding, policy: registry?.policy || null });
        return true;
      }
      if (!ready) { sendJson(res, 503, { error: 'Territory host authority is unavailable on this node.', authority: status() }); return true; }
      if (pathname === '/api/ai/node/territory-host-authority/grants' && req.method === 'POST') {
        requireInternal(req);
        const input = await readJson(req);
        const body = {
          issuerNodeId: manifest.nodeId,
          territoryId: clean(input.territoryId, 120) || undefined,
          candidateHostId: clean(input.candidateHostId, 120),
          candidateNodeId: clean(input.candidateNodeId, 180),
          candidateOperatorId: clean(input.candidateOperatorId, 180),
          candidateCallbackUrl: clean(input.candidateCallbackUrl, 4000),
          ttlSeconds: Number(input.ttlSeconds) || undefined
        };
        const raw = Buffer.from(JSON.stringify(body));
        const signature = signTerritoryHostAdmissionRequest(raw, { privateKey: receiptPrivateKey, keyId: receiptKeyId, timestamp: Math.floor(now() / 1000) });
        const response = await fetchImpl(new URL('/api/federation/host-admissions/grants', coreOrigin), {
          method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', 'x-civweave-node-signature': signature }, body: raw, cache: 'no-store'
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) { const error = new Error(clean(payload?.error, 1200) || `Civweave core returned HTTP ${response.status}.`); error.status = response.status; throw error; }
        sendJson(res, 201, { schema: NODE_TERRITORY_HOST_AUTHORITY_SCHEMA, admission: payload.admission });
        return true;
      }
      if (pathname === '/api/ai/node/territory-host-authority/claim' && req.method === 'POST') {
        requireInternal(req);
        const input = await readJson(req);
        const payload = await coreRequest('/api/federation/host-admissions/claim', {
          method: 'POST',
          body: {
            admissionGrant: clean(input.admissionGrant, 1000),
            hostId: clean(input.hostId, 120),
            nodeId: manifest.nodeId,
            operatorId: manifest.operatorId,
            callbackUrl
          }
        });
        sendJson(res, 201, { schema: NODE_TERRITORY_HOST_AUTHORITY_SCHEMA, admission: payload.admission });
        return true;
      }
      sendJson(res, 404, { error: 'Territory host authority route not found.' });
      return true;
    } catch (error) {
      const statusCode = safeStatus(error);
      sendJson(res, statusCode, { error: statusCode === 500 ? 'Territory host authority request failed.' : clean(error?.message || error, 1200) });
      return true;
    }
  }

  return Object.freeze({ status, handle });
}