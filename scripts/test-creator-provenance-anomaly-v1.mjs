import assert from 'node:assert/strict';
import { analyzeCreationPacket } from '../lib/creator-provenance-anomaly-v1.mjs';

const event = (seq, type, actor, payload = {}) => ({
  schema: 'civweave.creation-event.v1', id: `event:${seq}`, seq,
  timestamp: `2026-08-18T12:00:0${seq}.000Z`, type, actor, payload,
  previousHash: seq === 1 ? '' : `hash:${seq - 1}`, hash: `hash:${seq}`,
});

const cleanPacket = {
  schema: 'civweave.creation-packet.v1',
  sessionId: 'creation:clean', eventCount: 2, headHash: 'hash:2', packetHash: 'packet:clean',
  summary: { origin: 'human-authored', aiUsed: false },
  events: [
    event(1, 'text.insert', { kind: 'human', id: 'creator' }, { length: 20 }),
    event(2, 'text.format', { kind: 'human', id: 'creator' }, { mark: 'strong' }),
  ],
};
let result = analyzeCreationPacket(cleanPacket, { verification: { valid: true } });
assert.equal(result.outcome, 'verified');
assert.equal(result.detectorInferenceUsed, false);
assert.equal(result.anomalyCount, 0);

const aiPacket = structuredClone(cleanPacket);
aiPacket.sessionId = 'creation:ai';
aiPacket.summary = { origin: 'ai-generated', aiUsed: true };
aiPacket.events[1] = event(2, 'ai.generate', { kind: 'civweave-ai', id: 'kamiya', provider: 'device-local', model: 'gemma', requestId: 'req:1' }, { outputDigest: 'sha256:x' });
result = analyzeCreationPacket(aiPacket, { verification: { valid: true } });
assert.equal(result.outcome, 'verified-with-ai');
assert.equal(result.anomalyCount, 0);

const external = structuredClone(cleanPacket);
external.sessionId = 'creation:external';
external.summary = { origin: 'unknown', aiUsed: false };
external.events[0] = event(1, 'external.paste', { kind: 'external', id: 'clipboard' }, { length: 6000, contentDigest: 'sha256:x' });
result = analyzeCreationPacket(external, { verification: { valid: true } });
assert.equal(result.outcome, 'anomalous');
assert.ok(result.anomalies.some(row => row.code === 'bulk-external-paste'));
assert.match(result.anomalies.find(row => row.code === 'bulk-external-paste').detail, /does not prove AI use/);

const forged = structuredClone(aiPacket);
forged.events[1].actor = { kind: 'human', id: 'creator' };
forged.summary = { origin: 'human-authored', aiUsed: false };
result = analyzeCreationPacket(forged, { verification: { valid: false, reason: 'event-hash-mismatch' } });
assert.equal(result.outcome, 'broken-chain');
assert.ok(result.anomalies.some(row => row.code === 'cryptographic-verification-failed'));
assert.ok(result.anomalies.some(row => row.code === 'ai-event-actor-mismatch'));

const missingAttribution = structuredClone(aiPacket);
missingAttribution.events[1].actor = { kind: 'civweave-ai', id: 'kamiya', provider: '', model: '', requestId: '' };
result = analyzeCreationPacket(missingAttribution, { verification: { valid: true } });
assert.equal(result.outcome, 'anomalous');
assert.ok(result.anomalies.some(row => row.code === 'ai-attribution-incomplete'));

console.log('Creator provenance anomaly engine contract passed');
