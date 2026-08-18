import assert from 'node:assert/strict';
import { localPacketExpired, normalizeRetentionPolicy, retentionSummary } from '../lib/creator-provenance-retention-v1.mjs';

const policy=normalizeRetentionPolicy({localPacketDays:1,guildRequestDays:1000,receiptDays:1,proofHours:100,maxAppeals:99});
assert.equal(policy.localPacketDays,7,'local private evidence may not expire before a one-week audit window');
assert.equal(policy.guildRequestDays,365);
assert.equal(policy.receiptDays,30);
assert.equal(policy.proofHours,72);
assert.equal(policy.maxAppeals,5);
const now=Date.parse('2026-08-18T12:00:00Z');
assert.equal(localPacketExpired({createdAt:'2026-07-01T00:00:00Z'},now,{localPacketDays:30}),true);
assert.equal(localPacketExpired({createdAt:'2026-08-10T00:00:00Z'},now,{localPacketDays:30}),false);
assert.equal(localPacketExpired({receipt:{finalizedAt:'2026-08-17T00:00:00Z'}},now,{localPacketDays:30}),false);
const summary=retentionSummary();
assert.equal(summary.rawCloudPacketRetention,'none');
assert.equal(summary.creationOriginRetention,'immutable-in-receipt');
assert.match(summary.note,/do not rewrite or downgrade/);
console.log('Creator provenance retention policy contract passed');
