import assert from 'node:assert/strict';
import { runDailyProvenanceAudit } from '../lib/creator-provenance-audit-runner-v1.mjs';

const receipts = Array.from({ length: 6 }, (_, index) => ({
  schema: 'civweave.creation-receipt-summary.v1', sessionId: `creation:${index}`, mediaType: 'text', artifactType: 'document',
  eventCount: 1, headHash: `head:${index}`, receiptHash: `receipt:${index}`, origin: 'human-authored', aiUsed: false,
}));
const loaded = [];
const packets = Object.fromEntries(receipts.map((receipt, index) => [receipt.sessionId, {
  schema: 'civweave.creation-packet.v1', sessionId: receipt.sessionId, mediaType: 'text', artifactType: 'document',
  eventCount: 1, headHash: receipt.headHash, packetHash: `packet:${index}`, summary: { origin: 'human-authored', aiUsed: false },
  events: [{ schema: 'civweave.creation-event.v1', id: `event:${index}`, seq: 1, timestamp: '2026-08-18T12:00:00.000Z', type: 'text.insert', actor: { kind: 'human', id: 'creator' }, payload: { length: 2 }, previousHash: '', hash: receipt.headHash }],
}]));

const result = await runDailyProvenanceAudit({
  guildId: 'guild:test', dayKey: '2026-08-18', secretSalt: 'guild-secret-sampling-salt-v1',
  receipts,
  policy: { baseSampleRate: 0, prioritySampleRate: 1, maxDailySamples: 10 },
  prioritySessionIds: ['creation:1', 'creation:4'],
  loadPacket: async sample => { loaded.push(sample.receipt.sessionId); return packets[sample.receipt.sessionId]; },
  verifyPacket: async () => ({ valid: true }),
});

assert.deepEqual(new Set(loaded), new Set(['creation:1', 'creation:4']), 'only selected packet histories may be opened');
assert.equal(result.selectedCount, 2);
assert.equal(result.packetAccessCount, 2);
assert.equal(result.detailedPacketCount, 2);
assert.equal(result.privacy.samplingUsesReceiptsOnly, true);
assert.equal(result.privacy.unselectedPacketsAccessed, false);
assert.equal(result.privacy.styleDetectionUsed, false);
assert.ok(result.work.every(row => row.reviewRequest.privacy.styleDetectionForbidden));

const receiptOnly = await runDailyProvenanceAudit({
  guildId: 'guild:test', dayKey: '2026-08-18', secretSalt: 'guild-secret-sampling-salt-v1', receipts,
  policy: { baseSampleRate: 0, prioritySampleRate: 1, maxDailySamples: 10 }, prioritySessionIds: ['creation:2'],
});
assert.equal(receiptOnly.packetAccessCount, 0);
assert.equal(receiptOnly.work[0].analysis.evidenceScope, 'receipt-only');

console.log('Creator daily provenance audit runner contract passed');
