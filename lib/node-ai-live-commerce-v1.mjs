import crypto from 'node:crypto';
import { verifyAiWalletSession } from './ai-wallet-auth-v1.mjs';
import { assertActiveWalletDevice } from './ai-wallet-account-v1.mjs';
import { NODE_MONEY_CHALLENGE_DOMAIN, NODE_MONEY_EVENT_SCHEMA, signNodeMoneyEdgeRequest, verifyMoneyEdgeEvent } from './node-money-edge-v1.mjs';

export const NODE_AI_LIVE_COMMERCE_SCHEMA = 'civweave.node-ai-live-commerce.v1';

function clean(value, max = 4000) { return String(value ?? '').trim().slice(0, max); }
function secretReady(value) { return Buffer.byteLength(clean(value, 10000)) >= 32; }
function constantTime(left, right) { const a = Buffer.from(String(left)), b = Buffer.from(String(right)); return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b); }
function bearer(req) { const header = String(req.headers.authorization || ''); return header.startsWith('Bearer ') ? header.slice(7).trim() : ''; }
function sendJson(res, status, payload, headers = {}) { const bytes = Buffer.from(JSON.stringify(payload)); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': bytes.length, 'cache-control': 'no-store', ...headers }); res.end(bytes); }
async function readRaw(req, limit = 256 * 1024) { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > limit) throw Object.assign(new Error('Request body too large.'), { status: 413 }); chunks.push(chunk); } return Buffer.concat(chunks); }
function parseJson(raw) { if (!raw.length) return {}; try { return JSON.parse(raw.toString('utf8')); } catch { throw Object.assign(new Error('Invalid JSON body.'), { status: 400 }); } }
function positiveCents(value, label, max = 1_000_000) { if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new RangeError(`${label} must be a positive integer no greater than ${max} cents.`); return value; }
function nonNegativeCents(value, label) { if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative integer.`); return value; }
function nodeOrigin(manifest) { const candidate = clean(manifest?.metadata?.endpoints?.baseUrls?.[0], 4000); if (!candidate) return null; try { return new URL(candidate).origin; } catch { return null; } }
function safeStatus(error) { if (Number.isSafeInteger(error?.status)) return error.status; const message = String(error?.message || ''); if (/session|signature|credential|authorization|registered|revoked/i.test(message)) return 401; if (/not found|not registered/i.test(message)) return 404; if (error instanceof TypeError || error instanceof RangeError || /invalid|blocked|must|cannot|disabled|unavailable|insufficient/i.test(message)) return 400; return 500; }

export function signLiveChallenge({ nodeId, challenge, privateKey }) {
  const raw = Buffer.from(`${clean(nodeId, 180)}\n${clean(challenge, 300)}`);
  const message = Buffer.concat([Buffer.from(`${NODE_MONEY_CHALLENGE_DOMAIN}\n0\n`), raw]);
  return crypto.sign(null, message, privateKey).toString('base64url');
}

export function applyLivePaymentEvent(ledger, event) {
  if (event?.schema !== NODE_MONEY_EVENT_SCHEMA) throw new TypeError(`Live payment event schema must be ${NODE_MONEY_EVENT_SCHEMA}.`);
  if (Number(event?.mintEffect || 0) !== 0 || Number(event?.supplyEffect || 0) !== 0) throw new Error('Live money edge cannot carry mint or supply authority.');
  const eventId = clean(event.id, 180), provider = clean(event.provider, 120), userId = clean(event.userId, 180), type = clean(event.type, 80);
  if (!eventId || !provider || !userId || !type) throw new TypeError('Live payment event id, provider, userId, and type are required.');
  const sourceId = `payment:${provider}:${eventId}`;
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex');
  const metadata = { ...(event.metadata || {}), liveMoney: true, moneyEdgeVerified: true, paymentProvider: provider, eventId, externalAccountId: clean(event.externalAccountId, 180) || undefined };
  if (type === 'topup.paid') {
    return ledger.creditTopUp({
      userId,
      sourceId,
      grossCents: positiveCents(event.grossCents, 'grossCents'),
      processorFeeCents: nonNegativeCents(event.processorFeeCents || 0, 'processorFeeCents'),
      userCreditCents: positiveCents(event.userCreditCents ?? event.grossCents, 'userCreditCents'),
      payloadHash,
      metadata
    });
  }
  if (type === 'topup.refunded' || type === 'payment.chargeback') {
    return ledger.debitAdjustment({
      userId,
      sourceId,
      amountCents: positiveCents(event.userCreditCents ?? event.amountCents, 'userCreditCents'),
      eventType: type,
      payloadHash,
      metadata
    });
  }
  throw new RangeError(`Unsupported live payment event type: ${type}`);
}

export function createNodeAiLiveCommerceHandler({
  ledger,
  manifest,
  requested = process.env.NODE_AI_LIVE_COMMERCE_ENABLED === '1',
  authSecret = '',
  internalSecret = '',
  receiptPrivateKey = process.env.NODE_AI_RECEIPT_PRIVATE_KEY || '',
  receiptKeyId = process.env.NODE_AI_RECEIPT_KEY_ID || 'node-default',
  moneyEdgeUrl = process.env.CIVWEAVE_MONEY_EDGE_URL || '',
  moneyEdgePublicKey = process.env.CIVWEAVE_MONEY_EDGE_PUBLIC_KEY || '',
  maxTopUpCents = Number(process.env.NODE_AI_LIVE_MAX_TOPUP_CENTS || 100_000),
  fetchImpl = globalThis.fetch,
  now = () => Date.now()
} = {}) {
  const origin = nodeOrigin(manifest);
  const edgeOrigin = (() => { try { return new URL(moneyEdgeUrl).origin; } catch { return null; } })();
  const missing = [];
  if (!ledger) missing.push('node AI ledger');
  if (!manifest?.nodeId) missing.push('node AI manifest');
  if (!origin) missing.push('public node HTTPS base URL');
  if (!secretReady(authSecret)) missing.push('NODE_AI_AUTH_SECRET');
  if (!secretReady(internalSecret)) missing.push('NODE_AI_INTERNAL_SECRET');
  if (!receiptPrivateKey || !manifest?.publicKey) missing.push('node receipt signing keypair');
  if (!edgeOrigin) missing.push('CIVWEAVE_MONEY_EDGE_URL');
  if (!moneyEdgePublicKey) missing.push('CIVWEAVE_MONEY_EDGE_PUBLIC_KEY');
  if (typeof fetchImpl !== 'function') missing.push('fetch');
  const enabled = Boolean(requested && missing.length === 0);

  function status() {
    return Object.freeze({ schema: NODE_AI_LIVE_COMMERCE_SCHEMA, requested: Boolean(requested), enabled, nodeId: manifest?.nodeId || null, edgeOrigin, callbackOrigin: origin, operatorPayouts: 'stripe-connected-account-native', livePayments: enabled, missing: [...missing] });
  }
  async function requireSession(req) {
    const session = verifyAiWalletSession(bearer(req), { secret: authSecret, nowMs: now(), requiredRole: 'wallet:user' });
    await assertActiveWalletDevice(ledger, { userId: session.sub, deviceId: session.device });
    return session;
  }
  function requireInternal(req) {
    const supplied = clean(req.headers['x-civweave-internal-secret'], 10000);
    if (!constantTime(supplied, internalSecret)) throw new Error('Invalid Civweave node internal credential.');
  }
  function signRequest(raw) { return signNodeMoneyEdgeRequest(raw, { privateKey: receiptPrivateKey, keyId: receiptKeyId, timestamp: Math.floor(now() / 1000) }); }
  async function edgeRequest(pathname, { method = 'POST', body = null, signed = true } = {}) {
    if (!edgeOrigin) throw new Error('Civweave money edge URL is unavailable.');
    const raw = body == null ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
    const headers = { accept: 'application/json' };
    if (body != null) headers['content-type'] = 'application/json';
    if (signed) headers['x-civweave-node-signature'] = signRequest(raw);
    const response = await fetchImpl(new URL(pathname, edgeOrigin), { method, headers, body: body == null ? undefined : raw, cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(clean(payload?.error, 1200) || `Money edge returned HTTP ${response.status}.`); error.status = response.status; throw error; }
    return payload;
  }

  async function handle(req, res, url) {
    const pathname = decodeURIComponent(url.pathname);
    if (!pathname.startsWith('/api/ai/node/live')) return false;
    try {
      if (pathname === '/api/ai/node/live/status' && req.method === 'GET') { sendJson(res, 200, { live: status() }); return true; }
      if (pathname === '/api/ai/node/live/challenge') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        if (!receiptPrivateKey || !manifest?.nodeId) throw new Error('Node receipt signing key is unavailable.');
        const input = parseJson(await readRaw(req, 64 * 1024));
        if (clean(input.nodeId, 180) !== manifest.nodeId) throw new Error('Live-money proof challenge targeted a different node.');
        const challenge = clean(input.challenge, 300); if (!/^[A-Za-z0-9_-]{32,200}$/.test(challenge)) throw new TypeError('Live-money challenge format is invalid.');
        sendJson(res, 200, { schema: NODE_AI_LIVE_COMMERCE_SCHEMA, nodeId: manifest.nodeId, keyId: receiptKeyId, signature: signLiveChallenge({ nodeId: manifest.nodeId, challenge, privateKey: receiptPrivateKey }) }); return true;
      }
      if (!enabled) { sendJson(res, 503, { error: 'Live node commerce is disabled or incomplete.', live: status() }); return true; }
      if (pathname === '/api/ai/node/live/payments/webhook') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        const raw = await readRaw(req, 512 * 1024);
        verifyMoneyEdgeEvent(raw, req.headers['x-civweave-money-edge-signature'], { publicKey: moneyEdgePublicKey, now });
        const applied = applyLivePaymentEvent(ledger, parseJson(raw));
        sendJson(res, 200, { ok: true, schema: NODE_AI_LIVE_COMMERCE_SCHEMA, applied }); return true;
      }
      if (pathname === '/api/ai/node/live/topups') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        const session = await requireSession(req), input = parseJson(await readRaw(req, 128 * 1024));
        const grossCents = positiveCents(Number(input.grossCents), 'grossCents', maxTopUpCents);
        const idempotencyKey = clean(input.idempotencyKey, 180) || `node:${manifest.nodeId}:${session.sub}:${crypto.randomUUID()}`;
        const successUrl = clean(input.successUrl, 4000) || `${origin}/app/federation-finder-local-v269.html?nodeTopup=success`;
        const cancelUrl = clean(input.cancelUrl, 4000) || `${origin}/app/federation-finder-local-v269.html?nodeTopup=cancelled`;
        const payload = { nodeId: manifest.nodeId, userId: session.sub, grossCents, currency: 'USD', idempotencyKey, successUrl, cancelUrl };
        const result = await edgeRequest('/api/money-edge/topups', { body: payload });
        sendJson(res, 201, { schema: NODE_AI_LIVE_COMMERCE_SCHEMA, checkout: result.topup }); return true;
      }
      if (pathname === '/api/ai/node/live/operator/connect') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        requireInternal(req); const input = parseJson(await readRaw(req, 128 * 1024));
        const result = await edgeRequest('/api/money-edge/nodes/register', { signed: false, body: { nodeId: manifest.nodeId, operatorId: manifest.operatorId, callbackUrl: origin, email: clean(input.email, 320) || undefined, country: clean(input.country, 4) || undefined } });
        sendJson(res, 201, { schema: NODE_AI_LIVE_COMMERCE_SCHEMA, registration: result.registration }); return true;
      }
      if (pathname === '/api/ai/node/live/operator/status') {
        if (req.method !== 'GET') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        requireInternal(req); const result = await edgeRequest(`/api/money-edge/nodes/${encodeURIComponent(manifest.nodeId)}/status`, { method: 'GET', body: null });
        sendJson(res, 200, { schema: NODE_AI_LIVE_COMMERCE_SCHEMA, operator: result.operator }); return true;
      }
      if (pathname === '/api/ai/node/live/operator/refunds') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        requireInternal(req); const input = parseJson(await readRaw(req, 128 * 1024));
        const topupId = clean(input.topupId, 180); const amountCents = positiveCents(Number(input.amountCents), 'amountCents', maxTopUpCents);
        const body = { nodeId: manifest.nodeId, amountCents };
        const result = await edgeRequest(`/api/money-edge/topups/${encodeURIComponent(topupId)}/refund`, { body });
        sendJson(res, 202, { schema: NODE_AI_LIVE_COMMERCE_SCHEMA, refund: result.refund }); return true;
      }
      sendJson(res, 404, { error: 'Live node commerce route not found.' }); return true;
    } catch (error) {
      const statusCode = safeStatus(error); sendJson(res, statusCode, { error: statusCode === 500 ? 'Live node commerce failed.' : clean(error?.message || error, 1200), live: true }); return true;
    }
  }
  return Object.freeze({ status, handle });
}
