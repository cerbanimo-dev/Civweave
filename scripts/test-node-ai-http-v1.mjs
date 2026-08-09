import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createNodeServiceManifest } from '../lib/node-ai-marketplace-v1.mjs';
import { NodeAiLedger } from '../lib/node-ai-ledger-sqlite-v1.mjs';
import { createNodeAiHttpHandler, signCanonicalNodePaymentEvent } from '../lib/node-ai-http-v1.mjs';

const AUTH = 'auth-secret-abcdefghijklmnopqrstuvwxyz-123456';
const PAYMENT = 'payment-secret-abcdefghijklmnopqrstuvwxyz-123456';
const INTERNAL = 'internal-secret-abcdefghijklmnopqrstuvwxyz-123456';
const CAPABILITY = 'capability-secret-abcdefghijklmnopqrstuvwxyz-123456';

async function start() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'civweave-node-http-'));
  const manifest = createNodeServiceManifest({
    nodeId: 'node:test', operatorId: 'operator:test', displayName: 'Test Node', platformFeeBps: 2000,
    services: [{ id: 'general', label: 'General', capabilities: ['chat', 'planning'], billing: { maxRequestCents: 100 }, backend: { provider: 'operator-choice' } }]
  });
  const ledger = new NodeAiLedger({ databasePath: path.join(directory, 'node.sqlite'), nodeId: manifest.nodeId, operatorId: manifest.operatorId, platformFeeBps: manifest.platformFee.basisPoints });
  const handler = createNodeAiHttpHandler({ ledger, manifest, requested: true, authSecret: AUTH, paymentSecret: PAYMENT, internalSecret: INTERNAL, capabilitySecret: CAPABILITY });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    if (!await handler.handle(req, res, url)) { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { ledger, server, base: `http://127.0.0.1:${address.port}` };
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options); const body = await response.json(); return { response, body };
}

test('node HTTP flow is top-up -> node retail reservation -> settlement with no central plan/provider allocation', async t => {
  const { ledger, server, base } = await start();
  t.after(() => { server.close(); ledger.close(); });

  const manifest = await jsonFetch(`${base}/api/ai/node/manifest`);
  assert.equal(manifest.response.status, 200);
  assert.equal(manifest.body.manifest.nodeId, 'node:test');
  assert.equal(manifest.body.manifest.services[0].backend.provider, 'operator-choice');

  const sessionResponse = await jsonFetch(`${base}/api/ai/node/wallet/internal/sessions`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-civweave-internal-secret': INTERNAL }, body: JSON.stringify({ userId: 'user:1', deviceId: 'device:1' })
  });
  assert.equal(sessionResponse.response.status, 201);
  const session = sessionResponse.body.session;

  const event = { schema: 'civweave.node-payment-event.v1', id: 'evt:1', provider: 'test-payments', userId: 'user:1', type: 'topup.paid', grossCents: 2000, processorFeeCents: 89 };
  const raw = JSON.stringify(event);
  const webhook = await jsonFetch(`${base}/api/ai/node/wallet/payments/webhook`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-civweave-payment-signature': signCanonicalNodePaymentEvent(raw, { secret: PAYMENT }) }, body: raw
  });
  assert.equal(webhook.response.status, 200);
  assert.equal(webhook.body.applied.quote.platformFeeCents, 400);
  assert.equal('providerReserveCents' in webhook.body.applied.quote, false);

  const capabilityResponse = await jsonFetch(`${base}/api/ai/node/wallet/capability`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` }, body: JSON.stringify({ serviceIds: ['general'], maxRetailCostCents: 50 })
  });
  assert.equal(capabilityResponse.response.status, 201);
  const capability = capabilityResponse.body.capability;

  const reservation = await jsonFetch(`${base}/api/ai/node/wallet/reservations`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}`, 'x-civweave-ai-capability': capability }, body: JSON.stringify({ reservationId: 'r:1', serviceId: 'general', maxRetailCostCents: 25, purpose: 'planning' })
  });
  assert.equal(reservation.response.status, 201);
  assert.equal(reservation.body.reservation.serviceId, 'general');

  const settled = await jsonFetch(`${base}/api/ai/node/wallet/reservations/r%3A1/settle`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-civweave-internal-secret': INTERNAL }, body: JSON.stringify({ userId: 'user:1', actualRetailCostCents: 7, requestId: 'req:1' })
  });
  assert.equal(settled.response.status, 200);
  assert.equal(settled.body.wallet.balanceCents, 1993);

  const legacy = await jsonFetch(`${base}/api/ai/plans`);
  assert.equal(legacy.body.deprecated, true);
  assert.deepEqual(legacy.body.plans, []);
  assert.equal(legacy.body.services[0].id, 'general');
});
