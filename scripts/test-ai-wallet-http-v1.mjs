import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import test from 'node:test';
import { AiWalletService } from '../lib/ai-wallet-service-v1.mjs';
import { createAiWalletHttpHandler, signCanonicalPaymentEvent } from '../lib/ai-wallet-http-v1.mjs';
import { issueAiWalletSession, verifyAiWalletSession } from '../lib/ai-wallet-auth-v1.mjs';

const AUTH_SECRET = 'auth-secret-abcdefghijklmnopqrstuvwxyz-123456';
const PAYMENT_SECRET = 'payment-secret-abcdefghijklmnopqrstuvwxyz-123456';
const INTERNAL_SECRET = 'internal-secret-abcdefghijklmnopqrstuvwxyz-123456';
const CAPABILITY_SECRET = 'capability-secret-abcdefghijklmnopqrstuvwxyz-123456';

async function createHarness({ requested = true } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'commonweave-wallet-http-'));
  const filePath = path.join(directory, 'wallet.json');
  const walletService = new AiWalletService({ filePath, capabilitySecret: CAPABILITY_SECRET });
  await walletService.load();
  const handler = createAiWalletHttpHandler({ walletService, requested, authSecret: AUTH_SECRET, paymentSecret: PAYMENT_SECRET, internalSecret: INTERNAL_SECRET, capabilitySecret: CAPABILITY_SECRET });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const handled = await handler.handle(req, res, url);
    if (!handled) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    directory,
    filePath,
    walletService,
    handler,
    baseUrl,
    close: async () => {
      await walletService.flush();
      await new Promise(resolve => server.close(resolve));
      await rm(directory, { recursive: true, force: true });
    }
  };
}

async function jsonRequest(baseUrl, pathname, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function session(userId = 'user:alpha', deviceId = 'device:phone') {
  return issueAiWalletSession({ userId, deviceId, ttlSeconds: 900 }, { secret: AUTH_SECRET });
}

function paymentHeaders(raw, timestamp = Math.floor(Date.now() / 1000)) {
  return { 'x-commonweave-payment-signature': signCanonicalPaymentEvent(raw, { secret: PAYMENT_SECRET, timestamp }) };
}

test('wallet sessions expire and stay bound to one device', () => {
  const nowMs = Date.UTC(2026, 7, 5, 2, 0, 0);
  const token = issueAiWalletSession({ userId: 'user:alpha', deviceId: 'device:phone', ttlSeconds: 60, nowMs }, { secret: AUTH_SECRET });
  assert.equal(verifyAiWalletSession(token, { secret: AUTH_SECRET, nowMs: nowMs + 30_000, deviceId: 'device:phone' }).sub, 'user:alpha');
  assert.throws(() => verifyAiWalletSession(token, { secret: AUTH_SECRET, nowMs, deviceId: 'device:other' }), /different device/);
  assert.throws(() => verifyAiWalletSession(token, { secret: AUTH_SECRET, nowMs: nowMs + 61_000 }), /expired/);
});

test('wallet API fails closed when not enabled', async () => {
  const harness = await createHarness({ requested: false });
  try {
    const result = await jsonRequest(harness.baseUrl, '/api/ai/wallet', { headers: { authorization: `Bearer ${session()}` } });
    assert.equal(result.status, 503);
    assert.equal(result.body.wallet.enabled, false);
  } finally { await harness.close(); }
});

test('signed payment, authenticated wallet, capability, reservation, and internal settlement flow', async () => {
  const harness = await createHarness();
  try {
    const event = {
      schema: 'commonweave.payment-event.v1',
      id: 'evt-subscription-1',
      provider: 'test-payments',
      type: 'subscription.paid',
      userId: 'user:alpha',
      planId: 'thread',
      grossCents: 500,
      netDistributableCents: 470
    };
    const raw = JSON.stringify(event);
    const paid = await jsonRequest(harness.baseUrl, '/api/ai/wallet/payments/webhook', { method: 'POST', headers: paymentHeaders(raw), body: raw });
    assert.equal(paid.status, 200);
    assert.equal(paid.body.applied.wallet.balanceCents, 200);
    assert.equal(paid.body.applied.wallet.plan.id, 'thread');

    const replay = await jsonRequest(harness.baseUrl, '/api/ai/wallet/payments/webhook', { method: 'POST', headers: paymentHeaders(raw), body: raw });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.applied.wallet.balanceCents, 200);

    const unauthorized = await jsonRequest(harness.baseUrl, '/api/ai/wallet');
    assert.equal(unauthorized.status, 401);

    const auth = { authorization: `Bearer ${session()}` };
    const wallet = await jsonRequest(harness.baseUrl, '/api/ai/wallet', { headers: auth });
    assert.equal(wallet.status, 200);
    assert.equal(wallet.body.wallet.availableCents, 200);

    const capability = await jsonRequest(harness.baseUrl, '/api/ai/wallet/capability', {
      method: 'POST',
      headers: auth,
      body: { maxRequestCents: 10, models: ['gemini-flash-lite'], ttlSeconds: 300 }
    });
    assert.equal(capability.status, 201);
    assert.match(capability.body.capability, /^[^.]+\.[^.]+\.[^.]+$/);

    const reservation = await jsonRequest(harness.baseUrl, '/api/ai/wallet/reservations', {
      method: 'POST',
      headers: { ...auth, 'x-commonweave-ai-capability': capability.body.capability },
      body: { reservationId: 'reservation:1', model: 'gemini-flash-lite', maxCostCents: 10, purpose: 'test generation' }
    });
    assert.equal(reservation.status, 201);
    assert.equal(reservation.body.wallet.reservedCents, 10);
    assert.equal(reservation.body.wallet.availableCents, 190);

    const userSettlement = await jsonRequest(harness.baseUrl, '/api/ai/wallet/reservations/reservation%3A1/settle', {
      method: 'POST',
      headers: auth,
      body: { userId: 'user:alpha', actualCostCents: 4 }
    });
    assert.equal(userSettlement.status, 401);

    const settled = await jsonRequest(harness.baseUrl, '/api/ai/wallet/reservations/reservation%3A1/settle', {
      method: 'POST',
      headers: { 'x-commonweave-internal-secret': INTERNAL_SECRET },
      body: { userId: 'user:alpha', actualCostCents: 4 }
    });
    assert.equal(settled.status, 200);
    assert.equal(settled.body.wallet.balanceCents, 196);
    assert.equal(settled.body.wallet.reservedCents, 0);
    assert.equal(settled.body.wallet.dailySpentCents, 4);

    const onDisk = JSON.parse(await readFile(harness.filePath, 'utf8'));
    assert.equal(onDisk.wallets['user:alpha'].balanceCents, 196);
  } finally { await harness.close(); }
});

test('webhook rejects tampering and stale signatures', async () => {
  const harness = await createHarness();
  try {
    const event = { schema: 'commonweave.payment-event.v1', id: 'evt-2', provider: 'test-payments', type: 'subscription.paid', userId: 'user:alpha', planId: 'thread', grossCents: 500, netDistributableCents: 470 };
    const raw = JSON.stringify(event);
    const tampered = `${raw} `;
    const bad = await jsonRequest(harness.baseUrl, '/api/ai/wallet/payments/webhook', { method: 'POST', headers: paymentHeaders(raw), body: tampered });
    assert.equal(bad.status, 401);
    const staleTimestamp = Math.floor(Date.now() / 1000) - 1000;
    const stale = await jsonRequest(harness.baseUrl, '/api/ai/wallet/payments/webhook', { method: 'POST', headers: paymentHeaders(raw, staleTimestamp), body: raw });
    assert.equal(stale.status, 401);
  } finally { await harness.close(); }
});

test('top-ups require a paid plan and refunds become debt without consuming reservations', async () => {
  const harness = await createHarness();
  try {
    const topupOnly = { schema: 'commonweave.payment-event.v1', id: 'evt-topup-local', provider: 'test-payments', type: 'topup.paid', userId: 'user:local', grossCents: 500, netDistributableCents: 470 };
    const rawTopupOnly = JSON.stringify(topupOnly);
    const rejected = await jsonRequest(harness.baseUrl, '/api/ai/wallet/payments/webhook', { method: 'POST', headers: paymentHeaders(rawTopupOnly), body: rawTopupOnly });
    assert.equal(rejected.status, 400);

    const subscription = { schema: 'commonweave.payment-event.v1', id: 'evt-sub-3', provider: 'test-payments', type: 'subscription.paid', userId: 'user:alpha', planId: 'thread', grossCents: 500, netDistributableCents: 470 };
    const rawSubscription = JSON.stringify(subscription);
    await jsonRequest(harness.baseUrl, '/api/ai/wallet/payments/webhook', { method: 'POST', headers: paymentHeaders(rawSubscription), body: rawSubscription });

    const topup = { schema: 'commonweave.payment-event.v1', id: 'evt-topup-3', provider: 'test-payments', type: 'topup.paid', userId: 'user:alpha', grossCents: 500, netDistributableCents: 470 };
    const rawTopup = JSON.stringify(topup);
    const topped = await jsonRequest(harness.baseUrl, '/api/ai/wallet/payments/webhook', { method: 'POST', headers: paymentHeaders(rawTopup), body: rawTopup });
    assert.equal(topped.body.applied.wallet.balanceCents, 450);

    const auth = { authorization: `Bearer ${session()}` };
    const capability = await jsonRequest(harness.baseUrl, '/api/ai/wallet/capability', { method: 'POST', headers: auth, body: { maxRequestCents: 10, models: ['gemini-flash-lite'] } });
    await jsonRequest(harness.baseUrl, '/api/ai/wallet/reservations', { method: 'POST', headers: { ...auth, 'x-commonweave-ai-capability': capability.body.capability }, body: { reservationId: 'reservation:refund', model: 'gemini-flash-lite', maxCostCents: 10 } });

    const refund = { schema: 'commonweave.payment-event.v1', id: 'evt-refund-3', provider: 'test-payments', type: 'payment.chargeback', userId: 'user:alpha', hostedAllowanceCents: 500 };
    const rawRefund = JSON.stringify(refund);
    const refunded = await jsonRequest(harness.baseUrl, '/api/ai/wallet/payments/webhook', { method: 'POST', headers: paymentHeaders(rawRefund), body: rawRefund });
    assert.equal(refunded.status, 200);
    assert.equal(refunded.body.applied.wallet.balanceCents, 10);
    assert.equal(refunded.body.applied.wallet.reservedCents, 10);
    assert.equal(refunded.body.applied.wallet.debtCents, 60);

    const blocked = await jsonRequest(harness.baseUrl, '/api/ai/wallet/capability', { method: 'POST', headers: auth, body: { maxRequestCents: 10, models: ['gemini-flash-lite'] } });
    assert.equal(blocked.status, 400);
  } finally { await harness.close(); }
});

test('expired reservations release their hold and revoke the prior wallet version', async () => {
  const harness = await createHarness();
  try {
    await harness.walletService.credit({ userId: 'user:alpha', amountCents: 200, sourceId: 'expiry:credit', planId: 'thread' });
    const reserved = await harness.walletService.reserve({ userId: 'user:alpha', reservationId: 'expiry:reservation', maxCostCents: 10, model: 'gemini-flash-lite', ttlSeconds: 30 });
    const priorVersion = reserved.walletVersion;
    const expiresAt = reserved.reservations['expiry:reservation'].expiresAt;
    const swept = await harness.walletService.expireReservations({ userId: 'user:alpha', at: new Date(Date.parse(expiresAt) + 1).toISOString() });
    assert.equal(swept.reservedCents, 0);
    assert.equal(swept.balanceCents, 200);
    assert.notEqual(swept.walletVersion, priorVersion);
  } finally { await harness.close(); }
});

test('concurrent credits are serialized and source IDs cannot cross users', async () => {
  const harness = await createHarness();
  try {
    await Promise.all(Array.from({ length: 20 }, (_, index) => harness.walletService.credit({ userId: 'user:alpha', amountCents: 1, sourceId: `concurrent:${index}`, planId: 'thread' })));
    assert.equal(harness.walletService.getWallet('user:alpha').balanceCents, 20);
    await assert.rejects(() => harness.walletService.credit({ userId: 'user:beta', amountCents: 1, sourceId: 'concurrent:0', planId: 'thread' }), /different user/);
  } finally { await harness.close(); }
});
