import assert from 'node:assert/strict';
import { normalizeAuditPolicy, sampleReceipts, samplingScore } from '../lib/creator-provenance-audit-sampler-v1.mjs';

const receipt = index => ({
  schema: 'civweave.creation-receipt-summary.v1',
  sessionId: `creation:${index}`,
  mediaType: index % 3 === 0 ? 'video' : index % 2 === 0 ? 'audio' : 'text',
  artifactType: 'artifact',
  eventCount: index + 1,
  headHash: `${index}`.padStart(64, 'a'),
  origin: index % 5 === 0 ? 'ai-generated' : 'human-authored',
  aiUsed: index % 5 === 0,
  finalizedAt: '2026-08-18T12:00:00.000Z',
  receiptHash: `${index}`.padStart(64, 'b'),
});

const dayKey = '2026-08-18';
const secretSalt = 'guild-secret-sampling-salt-v1';
const rows = Array.from({ length: 20 }, (_, index) => receipt(index));

await assert.rejects(() => samplingScore(receipt(1), { dayKey, secretSalt: 'short' }), /secret sampling salt/);
const score = await samplingScore(receipt(1), { dayKey, secretSalt });
assert.ok(score >= 0 && score < 1);
assert.equal(score, await samplingScore(receipt(1), { dayKey, secretSalt }), 'same committed receipt must sample deterministically for a day');
assert.notEqual(score, await samplingScore(receipt(1), { dayKey: '2026-08-19', secretSalt }), 'daily seed must rotate the sample');

const allPolicy = normalizeAuditPolicy({ baseSampleRate: 1, maxDailySamples: 3, modelReviewShare: 1, humanReviewShare: 0 });
assert.equal(allPolicy.baseSampleRate, 0.25, 'routine sampling is capped to prevent pervasive oversight');
const all = await sampleReceipts(rows, { dayKey, secretSalt, policy: { baseSampleRate: 0.25, maxDailySamples: 3, modelReviewShare: 1, humanReviewShare: 0 } });
assert.ok(all.selectedCount <= 3);
assert.ok(all.samples.every(sample => sample.reviewLane === 'model'));

const priority = await sampleReceipts([...rows, receipt(7)], {
  dayKey,
  secretSalt,
  policy: { baseSampleRate: 0, prioritySampleRate: 1, maxDailySamples: 10 },
  prioritySessionIds: ['creation:2'],
  disputeSessionIds: ['creation:7'],
  anomalySessionIds: ['creation:9'],
});
assert.deepEqual(new Set(priority.samples.map(sample => sample.receipt.sessionId)), new Set(['creation:2', 'creation:7', 'creation:9']));
assert.equal(priority.samples.find(sample => sample.receipt.sessionId === 'creation:7').priorityReason, 'dispute');
assert.equal(priority.samples.find(sample => sample.receipt.sessionId === 'creation:9').priorityReason, 'anomaly');
assert.equal(priority.eligibleCount, 20, 'duplicate receipts must converge before sampling');

const repeat = await sampleReceipts(rows, { dayKey, secretSalt, policy: { baseSampleRate: 0.25, maxDailySamples: 3 } });
const repeat2 = await sampleReceipts(rows, { dayKey, secretSalt, policy: { baseSampleRate: 0.25, maxDailySamples: 3 } });
assert.deepEqual(repeat.samples.map(row => row.sampleId), repeat2.samples.map(row => row.sampleId));

console.log('Creator provenance audit sampler contract passed');
