import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import test from 'node:test';
import { AiWalletService } from '../lib/ai-wallet-service-v1.mjs';
import { createAiWalletStagingHandler, estimateStagingRequest } from '../lib/ai-wallet-staging-v1.mjs';

const AUTH_SECRET = 'auth-secret-abcdefghijklmnopqrstuvwxyz-123456';
const CAPABILITY_SECRET = 'capability-secret-abcdefghijklmnopqrstuvwxyz-123456';
const STAGING_SECRET = 'staging-secret-abcdefghijklmnopqrstuvwxyz-123456';

async function createHarness({ requested = true, allowFile = true } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'commonweave-wallet-staging-'));
  const walletService = new AiWalletService({ filePath: path.join(directory, 'wallet.json'), capabilitySecret: CAPABILITY_SECRET });
  await walletService.load();
  const handler = createAiWalletStagingHandler({ walletService, requested, allowFile, authSecret: AUTH_SECRET, capabilitySecret: CAPABILITY_SECRET, stagingSecret: STAGING_SECRET });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (!await handler.handle(req, res, url)) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    handler,
    walletService,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await walletService.flush();
      await new Promise(resolve => server.close(resolve));
      await rm(directory, { recursive: true, force: true });
    }
  };
}

async function request(baseUrl, pathname, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { status: response.status, text, body: /^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '') && text ? JSON.parse(text) : null };
}
const admin = { 'x-commonweave-staging-key': STAGING_SECRET };

async function connect(harness, userId = 'staging:passport-ac-local', deviceId = 'preview-device:phone') {
  const response = await request(harness.baseUrl, '/api/ai/staging/session', {
    method: 'POST', headers: admin, body: { userId, deviceId, passportId: 'AC-LOCAL' }
  });
  assert.equal(response.status, 201);
  return response.body.session;
}

test('staging preview remains disabled unless explicitly requested and configured', async () => {
  const disabled = await createHarness({ requested: false });
  try {
    const status = await request(disabled.baseUrl, '/api/ai/staging/status');
    assert.equal(status.status, 200);
    assert.equal(status.body.enabled, false);
    const session = await request(disabled.baseUrl, '/api/ai/staging/session', { method: 'POST', headers: admin, body: { userId: 'staging:test', deviceId: 'device:test' } });
    assert.equal(session.status, 503);
  } finally { await disabled.close(); }

  const strict = await createHarness({ requested: true, allowFile: false });
  try {
    const status = await request(strict.baseUrl, '/api/ai/staging/status');
    assert.equal(status.body.enabled, false);
    assert.ok(status.body.missing.includes('Postgres staging storage'));
  } finally { await strict.close(); }
});

test('staging estimates enforce plan model and request ceilings', () => {
  const estimate = estimateStagingRequest({ prompt: 'hello world', model: 'gemini-flash-lite', maxOutputCharacters: 1200, planId: 'thread' });
  assert.equal(estimate.maximumCostCents, 3);
  assert.equal(estimate.simulatedActualCostCents, 2);
  assert.throws(() => estimateStagingRequest({ prompt: 'hello', model: 'gemini-pro', maxOutputCharacters: 1200, planId: 'thread' }), /not enabled/);
  assert.throws(() => estimateStagingRequest({ prompt: 'x'.repeat(20001), model: 'gemini-flash-lite', maxOutputCharacters: 1200, planId: 'thread' }), /limited/);
});

test('passport-bound device session, test credit, simulated inference, receipt, and revocation flow', async () => {
  const harness = await createHarness();
  try {
    const userId = 'staging:passport-ac-local';
    const deviceId = 'preview-device:phone';
    const rejected = await request(harness.baseUrl, '/api/ai/staging/session', { method: 'POST', headers: admin, body: { userId: 'user:production', deviceId } });
    assert.equal(rejected.status, 400);

    const session = await connect(harness, userId, deviceId);
    const credit = await request(harness.baseUrl, '/api/ai/staging/credits', {
      method: 'POST', headers: admin, body: { userId, amountCents: 200, planId: 'thread', sourceId: 'staging:test-credit:one' }
    });
    assert.equal(credit.status, 201);
    assert.equal(credit.body.wallet.availableCents, 200);

    const auth = { authorization: `Bearer ${session}` };
    const wallet = await request(harness.baseUrl, '/api/ai/staging/wallet', { headers: auth });
    assert.equal(wallet.status, 200);
    assert.equal(wallet.body.deviceId, deviceId);

    const simulation = await request(harness.baseUrl, '/api/ai/staging/simulate', {
      method: 'POST', headers: auth, body: { prompt: 'Do not store this prompt body.', model: 'gemini-flash-lite', maxOutputCharacters: 1200 }
    });
    assert.equal(simulation.status, 200);
    const events = simulation.text.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(events[0].type, 'reservation');
    const receipt = events.find(event => event.type === 'receipt');
    assert.ok(receipt);
    assert.equal(receipt.receipt.providerCredentialUsed, false);
    assert.equal(receipt.receipt.reservedCents, 3);
    assert.equal(receipt.receipt.actualCostCents, 2);
    assert.equal(receipt.wallet.balanceCents, 198);
    assert.doesNotMatch(simulation.text, /Do not store this prompt body/);

    const revoked = await request(harness.baseUrl, '/api/ai/staging/revoke', { method: 'POST', headers: admin, body: { userId, deviceId } });
    assert.equal(revoked.status, 200);
    assert.equal(revoked.body.revoked, true);
    const blocked = await request(harness.baseUrl, '/api/ai/staging/wallet', { headers: auth });
    assert.equal(blocked.status, 401);
  } finally { await harness.close(); }
});

test('staging administrator routes reject missing or incorrect keys', async () => {
  const harness = await createHarness();
  try {
    const missing = await request(harness.baseUrl, '/api/ai/staging/credits', { method: 'POST', body: { userId: 'staging:test-user', amountCents: 200, planId: 'thread' } });
    assert.equal(missing.status, 401);
    const wrong = await request(harness.baseUrl, '/api/ai/staging/session', { method: 'POST', headers: { 'x-commonweave-staging-key': 'wrong' }, body: { userId: 'staging:test-user', deviceId: 'device:test' } });
    assert.equal(wrong.status, 401);
  } finally { await harness.close(); }
});
