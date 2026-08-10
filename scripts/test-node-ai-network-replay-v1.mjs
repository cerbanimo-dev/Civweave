import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { NodeAiLedger } from '../lib/node-ai-ledger-sqlite-v1.mjs';
import { NodeAiInferenceGate } from '../lib/node-ai-inference-gate-v1.mjs';
import { createNodeAiInferenceHttpHandler } from '../lib/node-ai-inference-http-v1.mjs';
import { createNodeServiceManifest } from '../lib/node-ai-marketplace-v1.mjs';
import { issueAiCapability } from '../lib/ai-capability-token-v1.mjs';

const CAPABILITY_SECRET = 'process-chaos-capability-secret-abcdefghijklmnopqrstuvwxyz';
const NODE_ID = 'node:network-replay';
const USER_ID = 'user:network-replay';
const DEVICE_ID = 'device:network-replay';

function fakeRequest(body, capability) {
  const bytes = Buffer.from(JSON.stringify(body));
  return {
    method: 'POST',
    headers: { 'x-civweave-ai-capability': capability },
    async *[Symbol.asyncIterator]() { yield bytes; }
  };
}
function fakeResponse() {
  return {
    statusCode: null,
    headers: null,
    bytes: Buffer.alloc(0),
    writeHead(statusCode, headers) { this.statusCode = statusCode; this.headers = headers; },
    end(bytes = Buffer.alloc(0)) { this.bytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes); },
    json() { return JSON.parse(this.bytes.toString('utf8') || '{}'); }
  };
}
async function invoke(handler, body, capability) {
  const req = fakeRequest(body, capability);
  const res = fakeResponse();
  const handled = await handler.handle(req, res, new URL('http://node.invalid/api/ai/node/inference'));
  assert.equal(handled, true);
  return { status: res.statusCode, body: res.json() };
}

test('lost HTTP response can replay a settled request with the original capability but cannot authorize a new request', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cw-node-ai-network-replay-'));
  const databasePath = path.join(directory, 'node.sqlite');
  const manifest = createNodeServiceManifest({
    nodeId: NODE_ID,
    operatorId: 'operator:network-replay',
    displayName: 'Network Replay Node',
    platformFeeBps: 2000,
    services: [{ id: 'general', label: 'General', capabilities: ['chat'], billing: { maxRequestCents: 500 }, backend: { provider: 'test' } }]
  });
  const ledger = new NodeAiLedger({ databasePath, nodeId: NODE_ID, operatorId: manifest.operatorId, platformFeeBps: 2000 });
  try {
    ledger.creditTopUp({ userId: USER_ID, sourceId: 'seed:network-replay', grossCents: 1000 });
    const initialWallet = ledger.getWallet(USER_ID);
    let quoteCalls = 0;
    let executeCalls = 0;
    const gate = new NodeAiInferenceGate({
      ledger,
      manifest,
      serviceHandlers: {
        general: {
          quote: async () => { quoteCalls += 1; return { maxRetailCostCents: 300 }; },
          execute: async () => { executeCalls += 1; return { retailCostCents: 200, output: { answer: 'delivered-once' }, usage: { calls: 1 } }; }
        }
      }
    });
    const http = createNodeAiInferenceHttpHandler({ ledger, manifest, inferenceGate: gate, capabilitySecret: CAPABILITY_SECRET });
    const capability = issueAiCapability({
      userId: USER_ID,
      deviceId: DEVICE_ID,
      nodeId: NODE_ID,
      serviceIds: ['general'],
      maxRetailCostCents: 300,
      walletVersion: initialWallet.walletVersion,
      ttlSeconds: 900
    }, { secret: CAPABILITY_SECRET });

    const requestBody = { serviceId: 'general', deviceId: DEVICE_ID, requestId: 'request:lost-response', request: { prompt: 'hello' } };
    const first = await invoke(http, requestBody, capability);
    assert.equal(first.status, 200);
    assert.deepEqual(first.body.output, { answer: 'delivered-once' });
    assert.equal(first.body.replayed, false);
    assert.equal(first.body.wallet.balanceCents, 800);
    assert.equal(quoteCalls, 1);
    assert.equal(executeCalls, 1);

    const retry = await invoke(http, requestBody, capability);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.replayed, true);
    assert.equal(retry.body.replayOutputAvailable, false);
    assert.equal(retry.body.output, null);
    assert.equal(retry.body.retailCostCents, 200);
    assert.equal(retry.body.wallet.balanceCents, 800);
    assert.equal(quoteCalls, 1, 'settled replay must not requote');
    assert.equal(executeCalls, 1, 'settled replay must not execute the provider again');
    assert.equal(Number(ledger.db.prepare("SELECT COUNT(*) count FROM node_ai_ledger WHERE node_id=? AND kind='inference-retail-charge' AND related_id=?").get(NODE_ID, 'request:lost-response')?.count || 0), 1);

    const staleNewRequest = await invoke(http, { ...requestBody, requestId: 'request:new-after-wallet-change' }, capability);
    assert.equal(staleNewRequest.status, 401);
    assert.match(staleNewRequest.body.error, /revoked by a wallet update/i);
    assert.equal(quoteCalls, 1);
    assert.equal(executeCalls, 1);
    assert.equal(ledger.getWallet(USER_ID).balanceCents, 800);
  } finally {
    ledger.close();
    await rm(directory, { recursive: true, force: true });
  }
});

console.log(JSON.stringify({
  ok: true,
  revision: 'node-ai-network-replay-v1',
  settledReplayAcceptsOriginalCapability: true,
  staleCapabilityCannotAuthorizeNewRequest: true,
  duplicateProviderExecutionPrevented: true,
  duplicateEconomicChargePrevented: true
}, null, 2));
