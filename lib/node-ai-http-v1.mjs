import crypto from 'node:crypto';
import { issueAiCapability, verifyAiCapability } from './ai-capability-token-v1.mjs';
import { verifyAiWalletSession } from './ai-wallet-auth-v1.mjs';
import { assertActiveWalletDevice, registerWalletDeviceAndIssueSession, revokeWalletDevice } from './ai-wallet-account-v1.mjs';
import { isLoopbackOperatorRequest, issueNodeOperatorSession, requireNodeOperatorAuth } from './node-ai-operator-session-v1.mjs';
import { createSettlementReceipt, quoteNodeTopUp, signNodeReceipt } from './node-ai-marketplace-v1.mjs';

const API_SCHEMA = 'civweave.node-ai-http.v1';
const PAYMENT_SCHEMA = 'civweave.node-payment-event.v1';

function clean(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function secretReady(value) { return Buffer.byteLength(clean(value, 10000)) >= 32; }
function constantTimeEqual(left, right) { const a = Buffer.from(String(left)); const b = Buffer.from(String(right)); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function bearer(req) { const header = String(req.headers.authorization || ''); return header.startsWith('Bearer ') ? header.slice(7).trim() : ''; }
function sendJson(res, status, payload, headers = {}) { const bytes = Buffer.from(JSON.stringify(payload)); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': bytes.length, 'cache-control': 'no-store', ...headers }); res.end(bytes); }
async function readRaw(req, limit = 128 * 1024) { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > limit) throw Object.assign(new Error('Request body too large.'), { status: 413 }); chunks.push(chunk); } return Buffer.concat(chunks); }
async function readJson(req, limit) { const raw = await readRaw(req, limit); if (!raw.length) return {}; try { return JSON.parse(raw.toString('utf8')); } catch { throw Object.assign(new Error('Invalid JSON body.'), { status: 400 }); } }
function positiveCents(value, label) { if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${label} must be a positive integer.`); return value; }
function nonNegativeCents(value, label) { if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative integer.`); return value; }
function serviceById(manifest, serviceId) { return manifest.services.find(service => service.id === serviceId) || null; }
function errorStatus(error) {
  if (Number.isSafeInteger(error?.status)) return error.status;
  const message = String(error?.message || '');
  if (/session|signature|capability|credential|authorization|bound to a different|registered|revoked/i.test(message)) return 401;
  if (/No node AI wallet|Unknown node AI reservation/i.test(message)) return 404;
  if (error instanceof TypeError || error instanceof RangeError || /invalid|malformed|exceeds|insufficient|unpaid|unsupported|not allowed|not active/i.test(message)) return 400;
  return 500;
}
function safeError(error) { const status = errorStatus(error); return { status, body: { error: status === 500 ? 'Node AI request failed.' : clean(error?.message || 'Node AI request failed.', 1000) } }; }
function parsePaymentSignature(header) { const values = Object.fromEntries(String(header || '').split(',').map(part => part.trim().split('=', 2)).filter(parts => parts.length === 2)); const timestamp = Number(values.t); const signature = clean(values.v1, 200).toLowerCase(); if (!Number.isSafeInteger(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) throw new Error('Malformed payment signature.'); return { timestamp, signature }; }
function verifyPaymentSignature(raw, header, secret, nowMs, toleranceSeconds) { const { timestamp, signature } = parsePaymentSignature(header); const nowSeconds = Math.floor(nowMs / 1000); if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) throw new Error('Payment signature timestamp is outside the replay window.'); const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest('hex'); if (!constantTimeEqual(signature, expected)) throw new Error('Invalid payment signature.'); }

export function signCanonicalNodePaymentEvent(rawBody, { secret, timestamp = Math.floor(Date.now() / 1000) }) {
  if (!secretReady(secret)) throw new RangeError('Payment webhook secret must contain at least 32 bytes.');
  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

export function createNodeAiHttpHandler({
  ledger,
  manifest,
  requested = false,
  authSecret = '',
  paymentSecret = '',
  internalSecret = '',
  capabilitySecret = '',
  receiptPrivateKey = '',
  receiptKeyId = 'node-default',
  paymentToleranceSeconds = 300,
  now = () => Date.now()
} = {}) {
  const missing = [];
  if (!ledger) missing.push('node AI ledger');
  if (!manifest) missing.push('node AI service manifest');
  if (!secretReady(authSecret)) missing.push('NODE_AI_AUTH_SECRET');
  if (!secretReady(paymentSecret)) missing.push('NODE_AI_PAYMENT_SECRET');
  if (!secretReady(internalSecret)) missing.push('NODE_AI_INTERNAL_SECRET');
  if (!secretReady(capabilitySecret)) missing.push('NODE_AI_CAPABILITY_SECRET');
  const enabled = Boolean(requested && missing.length === 0);
  const signingReady = Boolean(receiptPrivateKey);

  function status() {
    return Object.freeze({ schema: API_SCHEMA, requested: Boolean(requested), enabled, storage: ledger?.storage || 'unavailable', nodeId: manifest?.nodeId || null, protocol: manifest?.protocol || null, signedSettlementReceipts: signingReady, missing: [...missing] });
  }
  async function requireSession(req) {
    const session = verifyAiWalletSession(bearer(req), { secret: authSecret, nowMs: now(), requiredRole: 'wallet:user' });
    await assertActiveWalletDevice(ledger, { userId: session.sub, deviceId: session.device });
    return session;
  }
  function requireInternal(req) {
    return requireNodeOperatorAuth(req, { nodeId: manifest?.nodeId || '', secret: internalSecret, now });
  }
  async function applyPaymentEvent(event) {
    if (event?.schema !== PAYMENT_SCHEMA) throw new TypeError(`Payment event schema must be ${PAYMENT_SCHEMA}.`);
    const eventId = clean(event.id, 180), provider = clean(event.provider, 80), userId = clean(event.userId, 180), type = clean(event.type, 80);
    if (!eventId || !provider || !userId || !type) throw new TypeError('Payment event id, provider, userId, and type are required.');
    const sourceId = `payment:${provider}:${eventId}`;
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex');
    const metadata = { paymentProvider: provider, eventId, externalAccountId: clean(event.externalAccountId, 180) || undefined };
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
    throw new RangeError(`Unsupported node payment event type: ${type}`);
  }

  async function handle(req, res, url) {
    const pathname = decodeURIComponent(url.pathname);
    const legacy = pathname.startsWith('/api/ai/wallet') || pathname === '/api/ai/plans';
    const nodePath = legacy ? pathname.replace('/api/ai/wallet', '/api/ai/node/wallet') : pathname;

    if (nodePath === '/api/ai/node/manifest' && req.method === 'GET') {
      sendJson(res, 200, { manifest, marketplace: status() }); return true;
    }
    if (nodePath === '/api/ai/plans' && req.method === 'GET') {
      sendJson(res, 200, { schema: API_SCHEMA, deprecated: true, replacement: '/api/ai/node/manifest', plans: [], services: manifest?.services || [], marketplace: status() }); return true;
    }
    if (nodePath === '/api/ai/node/operator/local-session') {
      if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
      if (!enabled) { sendJson(res, 503, { error: 'Node operator session bootstrap is unavailable.', marketplace: status() }); return true; }
      if (!isLoopbackOperatorRequest(req)) { sendJson(res, 403, { error: 'Automatic operator unlock is available only from this node itself.' }); return true; }
      const input = await readJson(req, 16 * 1024);
      const ttlSeconds = Math.max(300, Math.min(24 * 60 * 60, Number(input.ttlSeconds) || 8 * 60 * 60));
      const session = issueNodeOperatorSession({ nodeId: manifest.nodeId, secret: internalSecret, ttlSeconds, now });
      sendJson(res, 201, { schema: 'civweave.node-ai-operator-session-envelope.v1', session, expiresInSeconds: ttlSeconds, localOnly: true }); return true;
    }
    if (nodePath === '/api/ai/node/topups/quote' && req.method === 'POST') {
      if (!manifest) { sendJson(res, 503, { error: 'Node AI manifest is unavailable.' }); return true; }
      try {
        const input = await readJson(req, 64 * 1024);
        sendJson(res, 200, { quote: quoteNodeTopUp({ nodeId: manifest.nodeId, grossCents: positiveCents(input.grossCents, 'grossCents'), processorFeeCents: nonNegativeCents(input.processorFeeCents || 0, 'processorFeeCents'), userCreditCents: positiveCents(input.userCreditCents ?? input.grossCents, 'userCreditCents'), platformFeeBps: manifest.platformFee.basisPoints }) });
      } catch (error) { const safe = safeError(error); sendJson(res, safe.status, safe.body); }
      return true;
    }
    if (!nodePath.startsWith('/api/ai/node/wallet')) return false;
    if (!enabled) { sendJson(res, 503, { error: 'Node AI marketplace is disabled or incomplete.', marketplace: status() }); return true; }

    try {
      if (nodePath === '/api/ai/node/wallet/payments/webhook') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        const raw = await readRaw(req, 256 * 1024);
        verifyPaymentSignature(raw, req.headers['x-civweave-payment-signature'], paymentSecret, now(), paymentToleranceSeconds);
        let event; try { event = JSON.parse(raw.toString('utf8')); } catch { throw Object.assign(new Error('Invalid payment event JSON.'), { status: 400 }); }
        sendJson(res, 200, { ok: true, schema: API_SCHEMA, applied: await applyPaymentEvent(event) }); return true;
      }
      if (nodePath === '/api/ai/node/wallet/internal/sessions') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        requireInternal(req); const input = await readJson(req, 64 * 1024); const ttlSeconds = input.ttlSeconds || 900;
        const token = await registerWalletDeviceAndIssueSession({ walletService: ledger, userId: input.userId, deviceId: input.deviceId, publicKey: input.publicKey || null, label: input.label || null, metadata: input.metadata || {}, roles: input.roles || ['wallet:user'], ttlSeconds }, { authSecret });
        sendJson(res, 201, { schema: 'civweave.node-ai-session-envelope.v1', session: token, expiresInSeconds: ttlSeconds }); return true;
      }
      const revokeMatch = /^\/api\/ai\/node\/wallet\/internal\/devices\/([^/]+)\/revoke$/.exec(nodePath);
      if (revokeMatch) {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        requireInternal(req); const input = await readJson(req, 64 * 1024);
        sendJson(res, 200, { revoked: await revokeWalletDevice(ledger, { userId: input.userId, deviceId: decodeURIComponent(revokeMatch[1]) }) }); return true;
      }
      if (nodePath === '/api/ai/node/wallet/internal/ledger') {
        if (req.method !== 'GET') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        requireInternal(req); const userId = clean(url.searchParams.get('userId'), 180) || null; const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 100)));
        sendJson(res, 200, { schema: 'civweave.node-ai-ledger-page.v1', entries: ledger.listLedgerEntries({ userId, limit, beforeSequence: url.searchParams.get('before') || null }) }); return true;
      }
      if (nodePath === '/api/ai/node/wallet/internal/reconcile') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        requireInternal(req); const input = await readJson(req, 64 * 1024);
        sendJson(res, 200, { schema: 'civweave.node-ai-reconciliation.v1', expiredReservations: ledger.expireReservations({ at: input.at || new Date(now()).toISOString(), limit: input.limit || 500 }) }); return true;
      }
      if (nodePath === '/api/ai/node/wallet/internal/settlement') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        requireInternal(req); const input = await readJson(req, 64 * 1024);
        const summary = ledger.settlementSummary({ periodStart: input.periodStart, periodEnd: input.periodEnd });
        const receipt = createSettlementReceipt({ ...summary, nodeId: manifest.nodeId, operatorId: manifest.operatorId, previousReceiptHash: input.previousReceiptHash || null, metadata: input.metadata || {} });
        sendJson(res, 200, { schema: 'civweave.node-ai-settlement-envelope.v1', summary, receipt: signingReady ? signNodeReceipt(receipt, { privateKey: receiptPrivateKey, keyId: receiptKeyId }) : receipt, signed: signingReady }); return true;
      }
      if (nodePath === '/api/ai/node/wallet' && req.method === 'GET') {
        const session = await requireSession(req); ledger.expireReservations(); const wallet = ledger.getWallet(session.sub); if (!wallet) throw new RangeError(`No node AI wallet exists for ${session.sub}.`);
        sendJson(res, 200, { wallet }); return true;
      }
      if (nodePath === '/api/ai/node/wallet/capability' && req.method === 'POST') {
        const session = await requireSession(req); const input = await readJson(req, 64 * 1024); ledger.expireReservations(); const wallet = ledger.getWallet(session.sub); if (!wallet) throw new RangeError(`No node AI wallet exists for ${session.sub}.`);
        const deviceId = clean(input.deviceId || session.device, 180); if (deviceId !== session.device) throw new Error('Wallet session cannot issue a capability for a different device.');
        const serviceIds = Array.isArray(input.serviceIds) && input.serviceIds.length ? [...new Set(input.serviceIds.map(value => clean(value, 120)).filter(Boolean))] : manifest.services.map(service => service.id);
        if (!serviceIds.length || serviceIds.some(id => !serviceById(manifest, id))) throw new RangeError('Requested service set exceeds this node manifest.');
        const requestedMax = positiveCents(input.maxRetailCostCents, 'maxRetailCostCents');
        const manifestCeilings = serviceIds.map(id => serviceById(manifest, id)?.billing?.maxRequestCents).filter(Number.isSafeInteger);
        if (manifestCeilings.length && requestedMax > Math.max(...manifestCeilings)) throw new RangeError('Capability exceeds this node service retail ceiling.');
        if (wallet.availableCents < requestedMax) throw new RangeError('Insufficient node AI balance for this capability ceiling.');
        const ttlSeconds = input.ttlSeconds || 900;
        const token = issueAiCapability({ userId: session.sub, deviceId, nodeId: manifest.nodeId, serviceIds, maxRetailCostCents: requestedMax, walletVersion: wallet.walletVersion, ttlSeconds }, { secret: capabilitySecret });
        sendJson(res, 201, { schema: 'civweave.node-ai-capability-envelope.v1', capability: token, expiresInSeconds: ttlSeconds }); return true;
      }
      if (nodePath === '/api/ai/node/wallet/reservations' && req.method === 'POST') {
        const session = await requireSession(req); const input = await readJson(req, 64 * 1024); ledger.expireReservations(); const wallet = ledger.getWallet(session.sub); if (!wallet) throw new RangeError(`No node AI wallet exists for ${session.sub}.`);
        const reservationId = clean(input.reservationId, 180), serviceId = clean(input.serviceId, 120); if (!reservationId || !serviceId) throw new TypeError('reservationId and serviceId are required.');
        const service = serviceById(manifest, serviceId); if (!service) throw new RangeError(`Unknown node AI service: ${serviceId}`);
        if (Number.isSafeInteger(service.billing?.maxRequestCents) && input.maxRetailCostCents > service.billing.maxRequestCents) throw new RangeError('Request reservation exceeds this node service retail ceiling.');
        const capability = verifyAiCapability(req.headers['x-civweave-ai-capability'], { secret: capabilitySecret, nowMs: now(), deviceId: session.device, nodeId: manifest.nodeId, serviceId, estimatedRetailCostCents: input.maxRetailCostCents, expectedWalletVersion: wallet.walletVersion });
        if (capability.sub !== session.sub) throw new Error('Node AI capability belongs to a different user.');
        const result = ledger.reserve({ userId: session.sub, reservationId, serviceId, maxRetailCostCents: positiveCents(input.maxRetailCostCents, 'maxRetailCostCents'), metadata: { purpose: clean(input.purpose, 120), capabilityId: capability.jti }, ttlSeconds: input.ttlSeconds || 900 });
        sendJson(res, 201, result); return true;
      }
      const cancelMatch = /^\/api\/ai\/node\/wallet\/reservations\/([^/]+)\/cancel$/.exec(nodePath);
      if (cancelMatch && req.method === 'POST') {
        requireInternal(req); const input = await readJson(req, 64 * 1024); sendJson(res, 200, ledger.cancel({ userId: input.userId, reservationId: decodeURIComponent(cancelMatch[1]) })); return true;
      }
      const settleMatch = /^\/api\/ai\/node\/wallet\/reservations\/([^/]+)\/settle$/.exec(nodePath);
      if (settleMatch && req.method === 'POST') {
        requireInternal(req); const input = await readJson(req, 64 * 1024); sendJson(res, 200, ledger.settle({ userId: input.userId, reservationId: decodeURIComponent(settleMatch[1]), actualRetailCostCents: nonNegativeCents(input.actualRetailCostCents, 'actualRetailCostCents'), requestId: input.requestId || null, metadata: input.metadata || {} })); return true;
      }
      sendJson(res, 404, { error: 'Node AI endpoint not found.' }); return true;
    } catch (error) {
      const safe = safeError(error); sendJson(res, safe.status, safe.body); return true;
    }
  }

  return Object.freeze({ schema: API_SCHEMA, status, handle, applyPaymentEvent });
}
