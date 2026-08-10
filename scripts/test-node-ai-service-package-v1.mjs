import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AiWalletService } from '../lib/ai-wallet-service-v1.mjs';
import { issueAiCapability } from '../lib/ai-capability-token-v1.mjs';
import { createNodeAiInferenceHttpHandler } from '../lib/node-ai-inference-http-v1.mjs';
import { loadNodeAiServicePackage } from '../lib/node-ai-service-package-v1.mjs';
import { verifyNodeReceipt } from '../lib/node-ai-marketplace-v1.mjs';

const CAPABILITY_SECRET = 'node-capability-secret-abcdefghijklmnopqrstuvwxyz-123456';
const services = [{ id: 'general', label: 'General', capabilities: ['chat', 'planning'], billing: { maxRequestCents: 25 }, backend: { ownership: 'node-operator' } }];

function request(body, capability) {
  const bytes = Buffer.from(JSON.stringify(body));
  return {
    method: 'POST',
    headers: { 'x-civweave-ai-capability': capability },
    async *[Symbol.asyncIterator]() { yield bytes; }
  };
}
function response() {
  return {
    statusCode: 0,
    headers: {},
    payload: null,
    writeHead(statusCode, headers) { this.statusCode = statusCode; this.headers = headers; },
    end(bytes) { this.payload = bytes?.length ? JSON.parse(Buffer.from(bytes).toString('utf8')) : null; }
  };
}

test('node loads a local operator service package and executes it through a capability-bound HTTP endpoint', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'civweave-node-package-'));
  const packagePath = path.join(directory, 'operator-package.mjs');
  await writeFile(packagePath, `
    export default async function createPackage() {
      return {
        id: 'operator-custom',
        version: '1.0.0',
        services: {
          general: {
            async quote() { return { maxRetailCostCents: 10 }; },
            async execute({ request }) { return { output: { echo: request.prompt }, retailCostCents: 4, usage: { units: 1 }, backend: { package: 'operator-custom' } }; }
          }
        }
      };
    }
  `, 'utf8');

  const node = await new AiWalletService({
    databasePath: path.join(directory, 'node.sqlite'),
    nodeId: 'node:custom',
    operatorId: 'operator:custom',
    platformFeeBps: 2000,
    displayName: 'Custom Node',
    services,
    servicePackageModule: packagePath
  }).load();
  assert.equal(node.servicePackage.id, 'operator-custom');
  assert.ok(node.inferenceGate);

  node.creditTopUp({ userId: 'user:1', sourceId: 'topup:1', grossCents: 2000 });
  const wallet = node.getWallet('user:1');
  const capability = issueAiCapability({
    userId: 'user:1',
    deviceId: 'device:1',
    nodeId: node.manifest.nodeId,
    serviceIds: ['general'],
    maxRetailCostCents: 12,
    walletVersion: wallet.walletVersion
  }, { secret: CAPABILITY_SECRET });

  const http = createNodeAiInferenceHttpHandler({ ledger: node, manifest: node.manifest, inferenceGate: node.inferenceGate, capabilitySecret: CAPABILITY_SECRET });
  const res = response();
  assert.equal(await http.handle(request({ serviceId: 'general', deviceId: 'device:1', requestId: 'request:1', request: { prompt: 'hello mesh' } }, capability), res, new URL('https://node.example/api/ai/node/inference')), true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.output, { echo: 'hello mesh' });
  assert.equal(res.payload.retailCostCents, 4);
  assert.equal(res.payload.wallet.balanceCents, 1996);
  const verifiedReceipt = verifyNodeReceipt(res.payload.receipt, { publicKey: node.manifest.publicKey });
  assert.equal(verifiedReceipt.backend.package, 'operator-custom');

  const lowCapability = issueAiCapability({
    userId: 'user:1',
    deviceId: 'device:1',
    nodeId: node.manifest.nodeId,
    serviceIds: ['general'],
    maxRetailCostCents: 2,
    walletVersion: node.getWallet('user:1').walletVersion
  }, { secret: CAPABILITY_SECRET });
  const denied = response();
  await http.handle(request({ serviceId: 'general', deviceId: 'device:1', requestId: 'request:2', request: { prompt: 'too expensive' } }, lowCapability), denied, new URL('https://node.example/api/ai/node/inference'));
  assert.equal(denied.statusCode, 400);
  assert.match(denied.payload.error, /capability ceiling/i);
  assert.equal(node.getWallet('user:1').balanceCents, 1996);
  node.close();
});

test('service package loader refuses remote executable module URLs', async () => {
  await assert.rejects(
    loadNodeAiServicePackage({ modulePath: 'https://example.com/operator.mjs', manifest: { nodeId: 'node:x', services }, ledger: {} }),
    /local module, not a remote URL/
  );
});
