import crypto from 'node:crypto';
import { AI_PLAN_CATALOG, AI_PLAN_CATALOG_VERSION, allocateSubscriptionCharge, availableCents, getAiPlan, quoteTopUp } from './ai-wallet-policy-v1.mjs';
import { verifyAiCapability } from './ai-capability-token-v1.mjs';
import { verifyAiWalletSession } from './ai-wallet-auth-v1.mjs';
import { assertActiveWalletDevice, registerWalletDeviceAndIssueSession, revokeWalletDevice } from './ai-wallet-account-v1.mjs';
import { createAiWalletStagingHandler } from './ai-wallet-staging-v1.mjs';

const API_SCHEMA = 'commonweave.ai-wallet-http.v1';
const PAYMENT_SCHEMA = 'commonweave.payment-event.v1';
function clean(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function secretReady(value) { return Buffer.byteLength(clean(value, 10000)) >= 32; }
function constantTimeEqual(left, right) { const a = Buffer.from(String(left)); const b = Buffer.from(String(right)); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function bearer(req) { const header = String(req.headers.authorization || ''); return header.startsWith('Bearer ') ? header.slice(7).trim() : ''; }
function sendJson(res, status, payload, headers = {}) { const bytes = Buffer.from(JSON.stringify(payload)); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': bytes.length, 'cache-control': 'no-store', ...headers }); res.end(bytes); }
async function readRaw(req, limit = 128 * 1024) { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > limit) throw Object.assign(new Error('Request body too large.'), { status: 413 }); chunks.push(chunk); } return Buffer.concat(chunks); }
async function readJson(req, limit) { const raw = await readRaw(req, limit); if (!raw.length) return {}; try { return JSON.parse(raw.toString('utf8')); } catch { throw Object.assign(new Error('Invalid JSON body.'), { status: 400 }); } }
function publicPlan(plan) { return { id: plan.id, label: plan.label, monthlyPriceCents: plan.monthlyPriceCents, hostedAllowanceCents: plan.hostedAllowanceCents, maxRequestCents: plan.maxRequestCents, dailyHostedLimitCents: plan.dailyHostedLimitCents, allowedHostedModels: [...plan.allowedHostedModels] }; }
function publicWallet(wallet) { if (!wallet) return null; const plan = getAiPlan(wallet.planId); return { schema: wallet.schema, walletId: wallet.walletId, userId: wallet.userId, plan: publicPlan(plan), balanceCents: wallet.balanceCents, reservedCents: wallet.reservedCents, availableCents: availableCents(wallet), debtCents: wallet.debtCents || 0, dailySpentCents: wallet.dailySpentCents, dailyWindow: wallet.dailyWindow, walletVersion: wallet.walletVersion, reservations: Object.values(wallet.reservations || {}).map(item => ({ reservationId: item.reservationId, maxCostCents: item.maxCostCents, model: item.model, createdAt: item.createdAt, expiresAt: item.expiresAt })), updatedAt: wallet.updatedAt }; }
function parsePaymentSignature(header) { const values = Object.fromEntries(String(header || '').split(',').map(part => part.trim().split('=', 2)).filter(parts => parts.length === 2)); const timestamp = Number(values.t); const signature = clean(values.v1, 200).toLowerCase(); if (!Number.isSafeInteger(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) throw new Error('Malformed payment signature.'); return { timestamp, signature }; }
function verifyPaymentSignature(raw, header, secret, nowMs, toleranceSeconds) { const { timestamp, signature } = parsePaymentSignature(header); const nowSeconds = Math.floor(nowMs / 1000); if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) throw new Error('Payment signature timestamp is outside the replay window.'); const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest('hex'); if (!constantTimeEqual(signature, expected)) throw new Error('Invalid payment signature.'); }
function requirePositiveCents(value, label) { if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${label} must be a positive integer.`); return value; }
function requireNonNegativeCents(value, label) { if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative integer.`); return value; }
function errorStatus(error) { if (Number.isSafeInteger(error?.status)) return error.status; const message = String(error?.message || ''); if (/session|signature|capability|credential|authorization|bound to a different|lacks wallet:user|registered|revoked/i.test(message)) return 401; if (/No hosted-AI wallet|Unknown reservation/i.test(message)) return 404; if (error instanceof TypeError || error instanceof RangeError || /invalid|malformed|exceeds|insufficient|unpaid|unsupported|expects|begin at|not active/i.test(message)) return 400; return 500; }
function safeError(error) { const status = errorStatus(error); return { status, body: { error: status === 500 ? 'AI wallet request failed.' : clean(error?.message || 'AI wallet request failed.', 1000) } }; }

export function signCanonicalPaymentEvent(rawBody, { secret, timestamp = Math.floor(Date.now() / 1000) }) { if (!secretReady(secret)) throw new RangeError('Payment webhook secret must contain at least 32 bytes.'); const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody)); const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest('hex'); return `t=${timestamp},v1=${signature}`; }

export function createAiWalletHttpHandler({ walletService, requested = false, authSecret = '', paymentSecret = '', internalSecret = '', capabilitySecret = '', paymentToleranceSeconds = 300, now = () => Date.now(), stagingRequested = process.env.AI_WALLET_STAGING_ENABLED === '1', stagingSecret = process.env.AI_WALLET_STAGING_SECRET || '', stagingAllowFile = process.env.AI_WALLET_STAGING_ALLOW_FILE === '1' } = {}) {
  const missing = [];
  if (!walletService) missing.push('wallet service');
  if (!secretReady(authSecret)) missing.push('AI_WALLET_AUTH_SECRET');
  if (!secretReady(paymentSecret)) missing.push('AI_WALLET_PAYMENT_SECRET');
  if (!secretReady(internalSecret)) missing.push('AI_WALLET_INTERNAL_SECRET');
  if (!secretReady(capabilitySecret)) missing.push('AI_WALLET_CAPABILITY_SECRET');
  const enabled = Boolean(requested && missing.length === 0);
  const staging = createAiWalletStagingHandler({ walletService, requested: Boolean(requested && stagingRequested), authSecret, capabilitySecret, stagingSecret, allowFile: stagingAllowFile, now });
  function status() { return Object.freeze({ schema: API_SCHEMA, requested: Boolean(requested), enabled, storage: walletService?.storage || 'unavailable', registeredDevicesRequired: Boolean(walletService?.requireRegisteredDevices), missing: [...missing], staging: staging.status() }); }
  async function requireSession(req) { const session = verifyAiWalletSession(bearer(req), { secret: authSecret, nowMs: now(), requiredRole: 'wallet:user' }); await assertActiveWalletDevice(walletService, { userId: session.sub, deviceId: session.device }); return session; }
  function requireInternal(req) { const supplied = clean(req.headers['x-commonweave-internal-secret'], 10000); if (!constantTimeEqual(supplied, internalSecret)) throw new Error('Invalid Commonweave internal wallet credential.'); }
  async function applyPaymentEvent(event) {
    if (event?.schema !== PAYMENT_SCHEMA) throw new TypeError(`Payment event schema must be ${PAYMENT_SCHEMA}.`);
    const eventId = clean(event.id, 180), provider = clean(event.provider, 80), userId = clean(event.userId, 180), type = clean(event.type, 80);
    if (!eventId || !provider || !userId || !type) throw new TypeError('Payment event id, provider, userId, and type are required.');
    const sourceId = `payment:${provider}:${eventId}`;
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex');
    const metadata = { provider, eventId, grossCents: Number.isSafeInteger(event.grossCents) ? event.grossCents : undefined, netDistributableCents: Number.isSafeInteger(event.netDistributableCents) ? event.netDistributableCents : undefined };
    let wallet, allocation;
    if (type === 'subscription.paid') {
      allocation = allocateSubscriptionCharge({ planId: event.planId, grossCents: requirePositiveCents(event.grossCents, 'grossCents'), netDistributableCents: requireNonNegativeCents(event.netDistributableCents, 'netDistributableCents') });
      wallet = await walletService.credit({ userId, amountCents: allocation.hostedAllowanceCents, sourceId, planId: allocation.planId, eventType: type, payloadHash, metadata });
    } else if (type === 'topup.paid') {
      const existing = await walletService.getWallet(userId); if (!existing || existing.planId === 'local') throw new RangeError('Hosted-AI top-ups require an active paid plan.');
      allocation = quoteTopUp({ grossCents: requirePositiveCents(event.grossCents, 'grossCents'), netDistributableCents: requireNonNegativeCents(event.netDistributableCents, 'netDistributableCents') });
      wallet = await walletService.credit({ userId, amountCents: allocation.hostedAllowanceCents, sourceId, eventType: type, payloadHash, metadata });
    } else if (type === 'subscription.refunded' || type === 'topup.refunded' || type === 'payment.chargeback') {
      const amountCents = requirePositiveCents(event.hostedAllowanceCents, 'hostedAllowanceCents');
      wallet = await walletService.debit({ userId, amountCents, sourceId, planId: type === 'subscription.refunded' ? 'local' : undefined, eventType: type, payloadHash, metadata }); allocation = { hostedAllowanceCents: amountCents };
    } else throw new RangeError(`Unsupported payment event type: ${type}`);
    return { sourceId, eventId, provider, type, allocation, wallet: publicWallet(wallet) };
  }
  async function handle(req, res, url) {
    const pathname = decodeURIComponent(url.pathname);
    if (await staging.handle(req, res, url)) return true;
    if (pathname === '/api/ai/plans') { if (req.method !== 'GET') sendJson(res, 405, { error: 'Method not allowed.' }); else sendJson(res, 200, { schema: AI_PLAN_CATALOG_VERSION, hostedWalletEnabled: enabled, stagingPreview: staging.status(), plans: Object.values(AI_PLAN_CATALOG).map(publicPlan) }); return true; }
    if (!pathname.startsWith('/api/ai/wallet')) return false;
    if (!enabled) { sendJson(res, 503, { error: 'Hosted AI wallet is disabled or incomplete.', wallet: status() }); return true; }
    try {
      if (pathname === '/api/ai/wallet/payments/webhook') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        const raw = await readRaw(req, 256 * 1024); verifyPaymentSignature(raw, req.headers['x-commonweave-payment-signature'], paymentSecret, now(), paymentToleranceSeconds);
        let event; try { event = JSON.parse(raw.toString('utf8')); } catch { throw Object.assign(new Error('Invalid payment event JSON.'), { status: 400 }); }
        sendJson(res, 200, { ok: true, schema: API_SCHEMA, applied: await applyPaymentEvent(event) }); return true;
      }
      if (pathname === '/api/ai/wallet/internal/sessions') {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
        requireInternal(req); const input = await readJson(req, 64 * 1024); const ttlSeconds = input.ttlSeconds || 900;
        const token = await registerWalletDeviceAndIssueSession({ walletService, userId: input.userId, deviceId: input.deviceId, publicKey: input.publicKey || null, label: input.label || null, metadata: input.metadata || {}, roles: input.roles || ['wallet:user'], ttlSeconds }, { authSecret });
        sendJson(res, 201, { schema: 'commonweave.ai-wallet-session-envelope.v1', session: token, expiresInSeconds: ttlSeconds }); return true;
      }
      const revokeMatch = /^\/api\/ai\/wallet\/internal\/devices\/([^/]+)\/revoke$/.exec(pathname);
      if (revokeMatch) { if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; } requireInternal(req); const input = await readJson(req, 64 * 1024); sendJson(res, 200, { revoked: await revokeWalletDevice(walletService, { userId: input.userId, deviceId: decodeURIComponent(revokeMatch[1]) }) }); return true; }
      if (pathname === '/api/ai/wallet/internal/ledger') { if (req.method !== 'GET') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; } requireInternal(req); const userId = clean(url.searchParams.get('userId'), 180); if (!userId) throw new TypeError('userId is required.'); const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 100))); sendJson(res, 200, { schema: 'commonweave.ai-wallet-ledger-page.v1', entries: await walletService.listLedgerEntries({ userId, limit, before: url.searchParams.get('before') || null }) }); return true; }
      if (pathname === '/api/ai/wallet/internal/reconcile') { if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; } requireInternal(req); const input = await readJson(req, 64 * 1024); sendJson(res, 200, { schema: 'commonweave.ai-wallet-reconciliation.v1', reconciled: await walletService.reconcileExpiredReservations({ at: input.at || new Date(now()).toISOString(), limit: input.limit || 100 }) }); return true; }
      if (pathname === '/api/ai/wallet' && req.method === 'GET') { const session = await requireSession(req); await walletService.expireReservations({ userId: session.sub }); const wallet = await walletService.getWallet(session.sub); if (!wallet) throw new RangeError(`No hosted-AI wallet exists for ${session.sub}.`); sendJson(res, 200, { wallet: publicWallet(wallet) }); return true; }
      if (pathname === '/api/ai/wallet/capability' && req.method === 'POST') { const session = await requireSession(req); const input = await readJson(req, 64 * 1024); await walletService.expireReservations({ userId: session.sub }); const deviceId = clean(input.deviceId || session.device, 180); if (deviceId !== session.device) throw new Error('Wallet session cannot issue a capability for a different device.'); const token = await walletService.issueCapability({ userId: session.sub, deviceId, models: input.models, maxRequestCents: input.maxRequestCents, ttlSeconds: input.ttlSeconds || 900 }); sendJson(res, 201, { schema: 'commonweave.ai-capability-envelope.v1', capability: token, expiresInSeconds: input.ttlSeconds || 900 }); return true; }
      if (pathname === '/api/ai/wallet/reservations' && req.method === 'POST') { const session = await requireSession(req); const input = await readJson(req, 64 * 1024); await walletService.expireReservations({ userId: session.sub }); const wallet = await walletService.getWallet(session.sub); if (!wallet) throw new RangeError(`No hosted-AI wallet exists for ${session.sub}.`); const reservationId = clean(input.reservationId, 180), model = clean(input.model, 120); if (!reservationId || !model) throw new TypeError('reservationId and model are required.'); const capability = verifyAiCapability(req.headers['x-commonweave-ai-capability'], { secret: capabilitySecret, nowMs: now(), deviceId: session.device, model, estimatedCostCents: input.maxCostCents, expectedWalletVersion: wallet.walletVersion }); if (capability.sub !== session.sub) throw new Error('AI capability belongs to a different user.'); const next = await walletService.reserve({ userId: session.sub, reservationId, maxCostCents: input.maxCostCents, model, metadata: { purpose: clean(input.purpose, 120), capabilityId: capability.jti }, ttlSeconds: 900 }); sendJson(res, 201, { wallet: publicWallet(next), reservation: next.reservations[reservationId] }); return true; }
      const cancelMatch = /^\/api\/ai\/wallet\/reservations\/([^/]+)\/cancel$/.exec(pathname);
      if (cancelMatch && req.method === 'POST') { requireInternal(req); const input = await readJson(req, 64 * 1024); const wallet = await walletService.cancel({ userId: input.userId, reservationId: decodeURIComponent(cancelMatch[1]), metadata: { reason: clean(input.reason, 200) } }); sendJson(res, 200, { wallet: publicWallet(wallet) }); return true; }
      const settleMatch = /^\/api\/ai\/wallet\/reservations\/([^/]+)\/settle$/.exec(pathname);
      if (settleMatch && req.method === 'POST') { requireInternal(req); const input = await readJson(req, 64 * 1024); const wallet = await walletService.settle({ userId: input.userId, reservationId: decodeURIComponent(settleMatch[1]), actualCostCents: input.actualCostCents, requestId: input.requestId || null, metadata: { providerRequestId: clean(input.providerRequestId, 240), model: clean(input.model, 120) } }); sendJson(res, 200, { wallet: publicWallet(wallet) }); return true; }
      sendJson(res, 404, { error: 'AI wallet API route not found.' }); return true;
    } catch (error) { const safe = safeError(error); sendJson(res, safe.status, safe.body); return true; }
  }
  return Object.freeze({ handle, status, enabled, applyPaymentEvent, staging });
}
