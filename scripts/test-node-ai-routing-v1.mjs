import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  extractNodeAiCandidates,
  routeNodeAiService,
  verifyNodeAiReceiptEnvelope,
  NODE_AI_SERVICE_ADVERT_KIND
} from '../public/app/shared/civweave-node-ai-routing-v1.mjs';
import { createUsageReceipt, signNodeReceipt } from '../lib/node-ai-marketplace-v1.mjs';

if (!globalThis.crypto?.subtle) globalThis.crypto = crypto.webcrypto;
const now = Date.parse('2026-08-09T20:00:00.000Z');
const advert = ({ nodeId, serviceId, capabilities, minimumChargeCents = 1, maxRequestCents = 100, thirdPartyInference = false, baseUrls = [], updatedAt = '2026-08-09T19:59:00.000Z', revision = 1 }) => ({
  schema: 'civweave.community-object.v1',
  id: `advert:${nodeId}`,
  revision,
  kind: NODE_AI_SERVICE_ADVERT_KIND,
  updatedAt,
  createdAt: updatedAt,
  payload: {
    manifest: {
      schema: 'civweave.node-ai-service-manifest.v1',
      protocol: 'civweave.node-ai.v1',
      nodeId,
      operatorId: `operator:${nodeId}`,
      displayName: nodeId,
      generatedAt: updatedAt,
      privacy: { thirdPartyInference },
      metadata: {
        endpoints: {
          transports: baseUrls.length ? ['mesh', 'https'] : ['mesh'],
          baseUrls,
          capabilityPath: '/api/ai/node/wallet/capability',
          inferencePath: '/api/ai/node/inference'
        }
      },
      services: [{
        id: serviceId,
        label: serviceId,
        capabilities,
        billing: { currency: 'USD', minimumChargeCents, maxRequestCents }
      }]
    }
  }
});

test('extracts fresh service candidates, preserves reachability, and ignores stale adverts', () => {
  const candidates = extractNodeAiCandidates([
    advert({ nodeId: 'node:a', serviceId: 'general', capabilities: ['chat'], baseUrls: ['https://node-a.example'] }),
    advert({ nodeId: 'node:stale', serviceId: 'old', capabilities: ['chat'], updatedAt: '2026-08-08T00:00:00.000Z' })
  ], { nowMs: now, maxAgeMs: 60 * 60 * 1000 });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].nodeId, 'node:a');
  assert.equal(candidates[0].serviceId, 'general');
  assert.deepEqual(candidates[0].endpoints.baseUrls, ['https://node-a.example']);
});

test('newest advert wins for the same node and service', () => {
  const candidates = extractNodeAiCandidates([
    advert({ nodeId: 'node:a', serviceId: 'general', capabilities: ['chat'], minimumChargeCents: 9, updatedAt: '2026-08-09T19:40:00.000Z', revision: 1 }),
    advert({ nodeId: 'node:a', serviceId: 'general', capabilities: ['chat', 'planning'], minimumChargeCents: 3, updatedAt: '2026-08-09T19:59:00.000Z', revision: 2 })
  ], { nowMs: now });
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].capabilities, ['chat', 'planning']);
  assert.equal(candidates[0].billing.minimumChargeCents, 3);
});

test('routing rejects services that cannot satisfy capability, privacy, or retail constraints', () => {
  const candidates = extractNodeAiCandidates([
    advert({ nodeId: 'node:cloud', serviceId: 'chat', capabilities: ['chat'], thirdPartyInference: true, maxRequestCents: 50 }),
    advert({ nodeId: 'node:local', serviceId: 'code', capabilities: ['chat', 'code'], thirdPartyInference: false, maxRequestCents: 200 })
  ], { nowMs: now });
  const result = routeNodeAiService({ candidates, requiredCapabilities: ['code'], maxRetailCostCents: 100, allowThirdPartyInference: false, nowMs: now });
  assert.equal(result.selected.nodeId, 'node:local');
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].nodeId, 'node:cloud');
});

test('HTTP-required routing excludes mesh-only services', () => {
  const candidates = extractNodeAiCandidates([
    advert({ nodeId: 'node:mesh', serviceId: 'general', capabilities: ['chat'] }),
    advert({ nodeId: 'node:https', serviceId: 'general', capabilities: ['chat'], baseUrls: ['https://node.example'] })
  ], { nowMs: now });
  const result = routeNodeAiService({ candidates, requiredCapabilities: ['chat'], requireHttpReachability: true, nowMs: now });
  assert.equal(result.selected.nodeId, 'node:https');
  assert.match(result.rejected[0].reasons.join(' '), /HTTP endpoint/);
});

test('explicit preference outranks latency while local execution wins absent a preference', () => {
  const candidates = extractNodeAiCandidates([
    advert({ nodeId: 'node:home', serviceId: 'general', capabilities: ['chat'] }),
    advert({ nodeId: 'node:remote', serviceId: 'general', capabilities: ['chat'] })
  ], { nowMs: now });
  const local = routeNodeAiService({ candidates, requiredCapabilities: ['chat'], localNodeId: 'node:home', latencyByNode: { 'node:home': 900, 'node:remote': 20 }, nowMs: now });
  assert.equal(local.selected.nodeId, 'node:home');
  const preferred = routeNodeAiService({ candidates, requiredCapabilities: ['chat'], localNodeId: 'node:home', preferredNodeIds: ['node:remote'], latencyByNode: { 'node:home': 20, 'node:remote': 900 }, nowMs: now });
  assert.equal(preferred.selected.nodeId, 'node:remote');
});

test('ties are deterministic by price floor then node and service id', () => {
  const candidates = extractNodeAiCandidates([
    advert({ nodeId: 'node:b', serviceId: 'general', capabilities: ['chat'], minimumChargeCents: 2 }),
    advert({ nodeId: 'node:a', serviceId: 'general', capabilities: ['chat'], minimumChargeCents: 2 })
  ], { nowMs: now });
  const first = routeNodeAiService({ candidates, requiredCapabilities: ['chat'], nowMs: now });
  const second = routeNodeAiService({ candidates: [...candidates].reverse(), requiredCapabilities: ['chat'], nowMs: now });
  assert.equal(first.selected.nodeId, 'node:a');
  assert.equal(second.selected.nodeId, 'node:a');
});

test('device runtime verifies server Ed25519 receipts and rejects tampering', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
  const receipt = createUsageReceipt({
    nodeId: 'node:a', walletId: 'wallet:1', serviceId: 'general', requestId: 'request:1', retailCostCents: 3,
    startedAt: '2026-08-09T19:59:00.000Z', completedAt: '2026-08-09T19:59:01.000Z', usage: { tokens: 42 }
  });
  const envelope = signNodeReceipt(receipt, { privateKey, keyId: 'node-a-1' });
  assert.equal((await verifyNodeAiReceiptEnvelope(envelope, publicPem)).requestId, 'request:1');
  const tampered = structuredClone(envelope);
  tampered.payload.retailCostCents = 99;
  await assert.rejects(() => verifyNodeAiReceiptEnvelope(tampered, publicPem), /payload hash does not match/);
});
