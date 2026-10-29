import assert from 'node:assert/strict';
import test from 'node:test';
import { STARLING_POLICY, executeGuildStarlingAction } from '../cloudflare/mobile-guild-edge/src/guild-starling-collective-v1.mjs';

// Synthetic domain tests; no real Guild, Passport, model generation or publication.
class MemoryStorage {
  rows = new Map(); pending = Promise.resolve();
  async get(key) { return structuredClone(this.rows.get(key)); }
  async put(key, value) { this.rows.set(key, structuredClone(value)); }
  async delete(key) { return this.rows.delete(key); }
  async list({ prefix = '', limit = Infinity } = {}) { return new Map([...this.rows].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b)).slice(0, limit).map(([key, value]) => [key, structuredClone(value)])); }
  transaction(run) {
    const result = this.pending.then(async () => { const before = structuredClone(this.rows); try { return await run(this); } catch (error) { this.rows = before; throw error; } });
    this.pending = result.catch(() => {}); return result;
  }
}
const alice = { nodeId: 'fictional-node-a', guildId: 'fictional-guild', userId: 'fictional-alice' };
const bob = { nodeId: 'fictional-node-b', guildId: 'fictional-guild', userId: 'fictional-bob' };
const start = Date.parse('2026-10-28T12:00:00Z');
const quest = (id = 'weave:fictional-checklist') => ({ kind: 'weave-plan', id, state: 'review', conversation: 'PRIVATE CHAT', plan: { schema: 'civweave.intention-weave.v1', id, title: 'Fictional checklist', outcome: 'Three saved checks', wish: 'PRIVATE WISH', paths: [{ id: 'path:make', realm: 'cerbanimo', title: 'Create', steps: ['Write three checks'], evidence: 'PRIVATE EVIDENCE' }] } });
const call = (storage, actor, action, input = {}, options = {}) => executeGuildStarlingAction(storage, actor, action, input, { now: start, ...options });
const reserve = (storage, id, actor = alice, options = {}) => call(storage, actor, 'reserve', { idempotencyKey: `fictional-${id}`, title: `Fictional line ${id}`,mode:'autonomous' }, options);

test('three concurrent active lines are a Guild-wide limit, not a per-user or starter-node limit', async () => {
  const store = new MemoryStorage();
  const results = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => reserve(store, i, i % 2 ? bob : alice)));
  assert.equal(STARLING_POLICY.maxActiveLines, 3);
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 3);
  for (const row of results.filter(row => row.status === 'rejected')) assert.equal(row.reason.code, 'STARLING_ACTIVE_LIMIT');
  const status = await call(store, alice, 'status');
  assert.equal(status.activeCount, 3); assert.equal(status.createdInWindow, 3);
});

test('idempotent reservation does not consume a second slot and conflicting reuse fails', async () => {
  const store = new MemoryStorage(), first = await reserve(store, 1), replay = await reserve(store, 1);
  assert.equal(first.line.id, replay.line.id); assert.equal(replay.idempotent, true);
  assert.equal((await call(store, alice, 'status')).createdInWindow, 1);
  await assert.rejects(call(store, alice, 'reserve', { idempotencyKey: 'fictional-1', title: 'Changed title' }), { status: 409 });
});

test('abandonment releases a slot but preserves the creation quota and tombstone', async () => {
  const store = new MemoryStorage(); let first;
  for (let i = 0; i < 6; i++) {
    const result = await reserve(store, i); first ||= result.line;
    await call(store, alice, 'abandon', { id: result.line.id, expectedRevision: result.line.revision, reason: 'Synthetic test abandoned' });
  }
  const status = await call(store, alice, 'status');
  assert.equal(status.activeCount, 0); assert.equal(status.createdInWindow, 6);
  await assert.rejects(reserve(store, 7), { code: 'STARLING_CREATION_LIMIT', status: 429 });
  const replay = await reserve(store, 0); assert.equal(replay.line.state, 'abandoned');
  assert.equal((await reserve(store, 7, alice, { now: start + 24 * 60 * 60 * 1000 + 1 })).line.state, 'reserved');
});

test('Guild namespace isolation and server-resolved identity reject actor spoofing', async () => {
  const store = new MemoryStorage(), first = await reserve(store, 1);
  await assert.rejects(call(store, bob, 'abandon', { id: first.line.id, expectedRevision: 1, userId: alice.userId }), { status: 403 });
  const other = { ...alice, guildId: 'fictional-other-guild' };
  assert.equal((await call(store, other, 'status')).activeCount, 0);
  await assert.rejects(call(store, other, 'abandon', { id: first.line.id, expectedRevision: 1 }), { status: 404 });
  await assert.rejects(call(store, { nodeId: alice.nodeId }, 'reserve', { idempotencyKey: 'bad' }), { status: 401 });
});

test('draft proposals remain private until explicit exact-revision confirmation publishes through the Quest owner', async () => {
  const store = new MemoryStorage(), reserved = await reserve(store, 1);
  const proposed = await call(store, alice, 'propose', { id: reserved.line.id, expectedRevision: 1, quest: quest(), provider: 'ollama', model: 'qwen3.5:4b' });
  assert.equal(proposed.line.state, 'proposed');
  assert.equal((await call(store, bob, 'status')).lines[0].proposal, undefined);
  assert.equal((await store.list({ prefix: 'guild-quest:active:' })).size, 0);
  await assert.rejects(call(store, alice, 'confirm', { id: reserved.line.id, expectedRevision: 2, proposalHash: proposed.line.proposalHash }), { status: 403 });
  await assert.rejects(call(store, alice, 'confirm', { id: reserved.line.id, expectedRevision: 2, proposalHash: 'forged', confirmed: true }), { status: 409 });
  const posted = await call(store, alice, 'confirm', { id: reserved.line.id, expectedRevision: 2, proposalHash: proposed.line.proposalHash, confirmed: true });
  assert.equal(posted.line.state, 'published'); assert.equal(posted.publication.authorUserId, alice.userId);
  assert.equal(posted.publication.guildId, alice.guildId); assert.equal(posted.publication.quest.state, 'review');
  assert.doesNotMatch(JSON.stringify(posted.publication), /PRIVATE|conversation|wish|evidence/);
  assert.equal((await call(store, bob, 'status')).lines[0].publicationId, posted.publication.id);
  const replay = await call(store, alice, 'confirm', { id: reserved.line.id, expectedRevision: 2, proposalHash: proposed.line.proposalHash, confirmed: true });
  assert.equal(replay.idempotent, true); assert.equal((await store.list({ prefix: 'guild-quest:active:' })).size, 1);
});

test('failed publication atomically retains proposal and the occupied slot', async () => {
  const store = new MemoryStorage(), reserved = await reserve(store, 1);
  const proposed = await call(store, alice, 'propose', { id: reserved.line.id, expectedRevision: 1, quest: quest() });
  await store.put(`guild-quest:count:${alice.guildId}`, 500);
  await assert.rejects(call(store, alice, 'confirm', { id: reserved.line.id, expectedRevision: 2, proposalHash: proposed.line.proposalHash, confirmed: true }), { status: 409 });
  const status = await call(store, alice, 'status'); assert.equal(status.lines[0].state, 'proposed'); assert.equal(status.activeCount, 1);
});

test('completion releases only with matching server-supplied canonical proof; client claims cannot release slots', async () => {
  const store = new MemoryStorage(), reserved = await reserve(store, 1);
  const proposed = await call(store, alice, 'propose', { id: reserved.line.id, expectedRevision: 1, quest: quest() });
  await assert.rejects(call(store, alice, 'complete', { id: reserved.line.id, expectedRevision: 2, verifiedCompletion: { questId: quest().id, state: 'completed' } }), { status: 403 });
  await assert.rejects(call(store, alice, 'complete', { id: reserved.line.id, expectedRevision: 2 }, { verifiedCompletion: { questId: 'weave:other', state: 'completed', authority: 'canonical-quest-proof' } }), { status: 403 });
  const result = await call(store, alice, 'complete', { id: reserved.line.id, expectedRevision: 2 }, { verifiedCompletion: { questId: proposed.line.proposal.id, state: 'completed', authority: 'canonical-quest-proof', receiptId: 'proof:fictional' } });
  assert.equal(result.line.state, 'completed'); assert.equal((await call(store, alice, 'status')).activeCount, 0);
  assert.equal((await call(store, alice, 'status')).createdInWindow, 1);
});

test('Passport claims are authenticated self claims, bounded and never grant trusted roster skills or privileges', async () => {
  const store = new MemoryStorage();
  await assert.rejects(call(store, alice, 'passport', { passportId: 'AC-FICTIONAL', skills: [] }), { code: 'STARLING_PASSPORT_CONSENT_REQUIRED' });
  const packet = await call(store, alice, 'passport', { passportId: 'AC-FICTIONAL', consent: 'guild-planning', skills: [{ skillId: 'technical-documentation', name: 'Documentation', xp: 40, level: 99 }], userId: bob.userId, guildmaster: true, members: ['fake'] });
  assert.equal(packet.passport.userId, alice.userId); assert.equal(packet.passport.verified, false);
  assert.equal(packet.passport.skills[0].xp, 40); assert.equal(packet.passport.skills[0].level, undefined);
  const status = await call(store, bob, 'status');
  assert.equal(status.context.heroCount, null); assert.equal(status.context.claimedPassportCount, 1);
  assert.equal(status.context.knownMemberCount, null); assert.equal(status.context.guildmasterVerified, false);
  assert.equal(status.context.passports[0].authority, 'authenticated-member-device-claim');
  await assert.rejects(call(store, alice, 'passport', { passportId: 'AC-FICTIONAL', consent: 'guild-planning', skills: [{ skillId: 'test', xp: -5 }] }), { status: 400 });
});

test('server-supplied member counts stay distinct from Passport-backed Heroes and missing skills stay unknown', async () => {
  const store = new MemoryStorage();
  await call(store, alice, 'passport', { passportId: 'AC-FICTIONAL', consent: 'guild-planning', skills: [] });
  const status = await call(store, alice, 'status', {}, { knownMemberCount: 7 });
  assert.equal(status.context.knownMemberCount, 7); assert.equal(status.context.heroCount, null);
  assert.equal(status.context.passports[0].skills.length, 0); assert.equal(status.context.passports[0].skillsKnown, false);
});

test('Passport aliases deduplicate only server-resolved accounts and AI actors cannot count as human Heroes', async () => {
  const store = new MemoryStorage();
  await call(store, alice, 'passport', { passportId: 'AC-FICTIONAL-A', consent: 'guild-planning', skills: [], accountId: 'forged' }, { accountId: 'hubacct:fictional-person' });
  await call(store, bob, 'passport', { passportId: 'AC-FICTIONAL-B', consent: 'guild-planning', skills: [] }, { accountId: 'hubacct:fictional-person' });
  const status = await call(store, alice, 'status'); assert.equal(status.context.reportedPassportHeroes, 1);
  assert.equal(status.context.passports[0].accountId, undefined, 'stable server account linkage is internal only');
  assert.equal((await store.get(`guild-starling:${alice.guildId}:passport:${alice.userId}`)).accountId, 'hubacct:fictional-person');
  await assert.rejects(call(store, { ...alice, isAI: true }, 'passport', { passportId: 'AC-FAKE-AI', consent: 'guild-planning', skills: [] }), { status: 403 });
});

test('a member can revoke their own planning consent without changing another member Passport', async () => {
  const store = new MemoryStorage();
  for (const user of [alice, bob]) await call(store, user, 'passport', { passportId: `AC-${user.userId}`, consent: 'guild-planning', skills: [] });
  await assert.rejects(call(store, alice, 'passport-revoke', { userId: bob.userId }), { status: 403 });
  await call(store, alice, 'passport-revoke', { confirmed: true, userId: bob.userId });
  const status = await call(store, alice, 'status');
  assert.equal(status.context.claimedPassportCount, 1); assert.equal(status.context.passports[0].userId, bob.userId);
});

test('clock rollback cannot refund recent creation allowance', async () => {
  const store = new MemoryStorage();
  for (let i = 0; i < 6; i++) {
    const row = (await reserve(store, i)).line;
    await call(store, alice, 'abandon', { id: row.id, expectedRevision: 1 });
  }
  await assert.rejects(reserve(store, 7, alice, { now: start - 60_000 }), { code: 'STARLING_CREATION_LIMIT' });
});

test('terminal retry stays idempotent and does not resurrect or refund a line', async () => {
  const store = new MemoryStorage(), reserved = await reserve(store, 1);
  const first = await call(store, alice, 'abandon', { id: reserved.line.id, expectedRevision: 1 });
  const retry = await call(store, alice, 'abandon', { id: reserved.line.id, expectedRevision: 1 });
  assert.equal(retry.idempotent, true); assert.equal(retry.line.revision, first.line.revision);
  assert.equal((await call(store, alice, 'status')).createdInWindow, 1);
});

test('abandoning a published line withdraws through the Quest owner and retains its source allowance', async () => {
  const store = new MemoryStorage(), reserved = await reserve(store, 1);
  const proposed = await call(store, alice, 'propose', { id: reserved.line.id, expectedRevision: 1, quest: quest() });
  const posted = await call(store, alice, 'confirm', { id: reserved.line.id, expectedRevision: 2, proposalHash: proposed.line.proposalHash, confirmed: true });
  const abandoned = await call(store, alice, 'abandon', { id: reserved.line.id, expectedRevision: posted.line.revision });
  assert.equal(abandoned.line.state, 'abandoned'); assert.equal((await store.list({ prefix: 'guild-quest:active:' })).size, 0);
  assert.equal((await call(store, alice, 'status')).createdInWindow, 1);
});

test('Intention revisions are rate bounded across Guild members and idempotent replay is free', async () => {
  const store = new MemoryStorage();
  for (let i = 0; i < 6; i++) await call(store, alice, 'intention-propose', { text: `Fictional Intention ${i}`, confirmed: true, expectedRevision: i });
  assert.equal((await call(store, alice, 'intention-propose', { text: 'Fictional Intention 5', confirmed: true, expectedRevision: 5 })).idempotent, true);
  await assert.rejects(call(store, bob, 'intention-propose', { text: 'Fictional seventh', confirmed: true, expectedRevision: 0 }), { status: 429, code: 'STARLING_INTENTION_LIMIT' });
});

test('Guild Intention proposals require explicit posting and never become founder or adopted human-vote authority', async () => {
  const store = new MemoryStorage();
  await assert.rejects(call(store, alice, 'intention-propose', { text: 'Make a repair guide' }), { status: 403 });
  const result = await call(store, alice, 'intention-propose', { text: 'Make a repair guide', confirmed: true, expectedRevision: 0, adopted: true, guildmaster: true });
  assert.equal(result.intention.state, 'proposed'); assert.equal(result.intention.adopted, false);
  assert.equal(result.intention.userId, alice.userId); assert.equal(result.intention.authority, 'human-proposal');
  const status = await call(store, bob, 'status'); assert.equal(status.context.drivingIntention, null);
  await assert.rejects(call(store, alice, 'intention-found', { text: 'Force founder intention', guildmaster: true }), { status: 403 });
  await assert.rejects(call(store, alice, 'intention-vote', { text: 'AI consensus', votes: 10 }), { status: 403 });
});

test('unknown states, stale revisions, terminal resurrection and malformed identifiers fail closed', async () => {
  const store = new MemoryStorage(), row = (await reserve(store, 1)).line;
  await assert.rejects(call(store, alice, 'abandon', { id: row.id, expectedRevision: 0 }), { status: 409 });
  const abandoned = await call(store, alice, 'abandon', { id: row.id, expectedRevision: 1 });
  await assert.rejects(call(store, alice, 'propose', { id: row.id, expectedRevision: abandoned.line.revision, quest: quest() }), { status: 409 });
  await assert.rejects(call(store, alice, 'reserve', { idempotencyKey: '../escape', title: 'Bad' }), { status: 400 });
  await assert.rejects(call(store, alice, 'delete', { id: row.id }), { status: 405 });
});
