import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { executeGuildStarlingAction } from '../cloudflare/mobile-guild-edge/src/guild-starling-collective-v1.mjs';

const questClientSource = await readFile(new URL('../public/app/guild-quest-client-v1.js', import.meta.url), 'utf8');
const source = await readFile(new URL('../public/app/guild-starling-client-v1.js', import.meta.url), 'utf8');
class Store {
  rows = new Map(); pending = Promise.resolve();
  async get(key) { return structuredClone(this.rows.get(key)); }
  async put(key, value) { this.rows.set(key, structuredClone(value)); }
  async delete(key) { return this.rows.delete(key); }
  async list({ prefix = '' } = {}) { return new Map([...this.rows].filter(([key]) => key.startsWith(prefix))); }
  transaction(run) { const result = this.pending.then(async () => { const before = structuredClone(this.rows); try { return await run(this); } catch (error) { this.rows = before; throw error; } }); this.pending = result.catch(() => {}); return result; }
}
const draft = () => ({ kind: 'weave-plan', id: 'weave:fictional-note', state: 'review', conversation: 'PRIVATE CHAT', plan: { schema: 'civweave.intention-weave.v1', id: 'weave:fictional-note', title: 'Fictional saved note', wish: 'PRIVATE WISH', paths: [{ id: 'path:write', realm: 'cerbanimo', title: 'Write', steps: ['Save the note'], evidence: 'PRIVATE EVIDENCE' }] } });
async function harness() {
  const h = { calls: [], timers: [], store: new Store(), online: true, loggedIn: true, patch: null, timeout: false, httpError: null };
  const session = { nodeId: 'fictional-node', userId: 'fictional-person', origin: 'https://fictional-guild.example.test', token: 'fictional-token', expiresAt: new Date(Date.now() + 60_000).toISOString() };
  const context = vm.createContext({ console, URL, Date, AbortController, TextEncoder, crypto, structuredClone, navigator: { get onLine() { return h.online; } }, location: { origin: 'https://client.example.test' }, CivweaveHostNodeSessionV1: { sessionFor: id => h.loggedIn && id === session.nodeId ? session : null }, setTimeout(fn, delay) { h.timers.push(delay); if (h.timeout) queueMicrotask(fn); return 1; }, clearTimeout() {}, async fetch(url, init) {
    h.calls.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : null });
    if (h.timeout) return new Promise((resolve, reject) => { const abort = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })); if (init.signal.aborted) abort(); else init.signal.addEventListener('abort', abort, { once: true }); });
    if (h.httpError) return Response.json({ ok: false, error: 'Fictional service unavailable' }, { status: h.httpError });
    const path = new URL(url).pathname, action = path === '/api/node/starling' ? 'status' : path.slice('/api/node/starling/'.length);
    try { let packet = await executeGuildStarlingAction(h.store, { nodeId: session.nodeId, userId: session.userId, guildId: 'fictional-guild' }, action, init.body ? JSON.parse(init.body) : {}); if (h.patch) packet = h.patch(packet); return Response.json(packet); }
    catch (error) { return Response.json({ ok: false, error: error.message }, { status: error.status || 500 }); }
  } });
  vm.runInContext(questClientSource, context); vm.runInContext(source, context);
  return Object.assign(h, { context, api: context.CivweaveGuildStarlingV1, session, guild: { id: session.nodeId, guildId: 'fictional-guild' } });
}

test('client loads without requests, delegates canonical session lookup, and pins authenticated Guild context before writes', async () => {
  const h = await harness(); assert.equal(h.calls.length, 0);
  await assert.rejects(h.api.reserve(h.guild, { title: 'Fictional line', idempotencyKey: 'fictional-1' }), /Refresh|load|read/i);
  assert.equal(h.calls.length, 0);
  const packet = await h.api.read(h.guild); assert.equal(packet.context.heroCount, null); assert.equal(packet.policy.maxActiveLines, 3);
  const line = await h.api.reserve(h.guild, { title: 'Fictional line', idempotencyKey: 'fictional-1', guildmaster: true, userId: 'forged', guildId: 'forged', options: { knownMemberCount: 200 } });
  assert.equal(line.line.userId, h.session.userId);
  assert.deepEqual(h.calls.at(-1).body, { title: 'Fictional line', idempotencyKey: 'fictional-1' });
  assert.equal(new URL(h.calls.at(-1).url).pathname, '/api/node/starling/reserve');
  assert.equal(new URL(h.calls.at(-1).url).searchParams.get('nodeId'), h.session.nodeId);
  assert.equal(h.calls.at(-1).init.headers.authorization, `Bearer ${h.session.token}`);
  assert.equal(h.calls.at(-1).init.credentials, 'omit'); assert.equal(h.calls.at(-1).init.cache, 'no-store');
  assert.ok(h.timers.every(delay => delay === 15_000));
});

test('proposal preview strips private fields and exact explicit confirmation is the only publication path', async () => {
  const h = await harness(); await h.api.read(h.guild);
  const reserved = await h.api.reserve(h.guild, { title: 'Fictional line', idempotencyKey: 'fictional-1' });
  const proposed = await h.api.propose(h.guild, { id: reserved.line.id, expectedRevision: 1, quest: draft(), provider: 'ollama', model: 'qwen3.5:4b', guildmaster: true });
  assert.doesNotMatch(JSON.stringify(h.calls.at(-1).body), /PRIVATE|wish|conversation|evidence|guildmaster/);
  const before = h.calls.length;
  await assert.rejects(h.api.confirm(h.guild, { id: reserved.line.id, expectedRevision: 2, proposalHash: proposed.line.proposalHash }), /confirm/i);
  assert.equal(h.calls.length, before);
  const posted = await h.api.confirm(h.guild, { id: reserved.line.id, expectedRevision: 2, proposalHash: proposed.line.proposalHash, confirmed: true, verifiedCompletion: { state: 'completed' } });
  assert.equal(posted.publication.guildId, 'fictional-guild'); assert.equal(posted.line.state, 'published');
  assert.equal(h.calls.at(-1).body.verifiedCompletion, undefined);
  const abandoned = await h.api.abandon(h.guild, { id: reserved.line.id, expectedRevision: posted.line.revision, reason: 'Synthetic test' });
  assert.equal(abandoned.line.state, 'abandoned');
});

test('Passport and Intention fields are allowlisted and permission stays with authenticated self', async () => {
  const h = await harness(); await h.api.read(h.guild);
  const packet = await h.api.passport(h.guild, { passportId: 'AC-FICTIONAL', consent: 'guild-planning', skills: [{ skillId: 'writing', name: 'Writing', xp: 40, level: 99, credential: 'PRIVATE KEY' }], userId: 'forged', members: 500, role: 'guildmaster', accountId: 'forged' });
  assert.equal(packet.passport.verified, false); assert.equal(packet.passport.userId, h.session.userId);
  assert.deepEqual(h.calls.at(-1).body, { passportId: 'AC-FICTIONAL', consent: 'guild-planning', skills: [{ skillId: 'writing', name: 'Writing', xp: 40 }] });
  const intention = await h.api.intentionpropose(h.guild, { text: 'Fictional Guild repair guide', expectedRevision: 0, confirmed: true, adopted: true, votes: 900 });
  assert.equal(intention.intention.adopted, false); assert.equal(h.calls.at(-1).body.adopted, undefined);
  assert.equal((await h.api.passportRevoke(h.guild, { confirmed: true, userId: 'someone-else' })).revoked, true);
});

test('missing sessions, offline state and failed reads never create a fallback Guild or unbound posting lane', async () => {
  const h = await harness(); h.loggedIn = false;
  await assert.rejects(h.api.read(h.guild), /Log in/i); assert.equal(h.calls.length, 0);
  h.loggedIn = true; h.online = false;
  await assert.rejects(h.api.read(h.guild), /Reconnect/i); assert.equal(h.calls.length, 0);
  h.online = true; h.httpError = 503;
  await assert.rejects(h.api.read(h.guild), /unavailable/i);
  h.httpError = null; const before = h.calls.length;
  await assert.rejects(h.api.reserve(h.guild, { title: 'Test', idempotencyKey: 'test' }), /Refresh|load|read/i); assert.equal(h.calls.length, before);
});

test('response Guild/session mismatch, forged authority and invalid policy counts fail closed', async () => {
  for (const patch of [packet => ({ ...packet, guildId: 'other-guild' }), packet => ({ ...packet, nodeId: 'other-node' }), packet => ({ ...packet, activeCount: 4 }), packet => ({ ...packet, policy: { ...packet.policy, maxActiveLines: 99 } }), packet => ({ ...packet, context: { ...packet.context, guildmasterVerified: true } }), packet => ({ ...packet, requiresPostingConfirmation: false })]) {
    const h = await harness(); h.patch = patch; await assert.rejects(h.api.read(h.guild), /invalid|different|unexpected/i);
  }
});

test('mutation responses must match exact line, owner and expected outcome', async () => {
  const h = await harness(); await h.api.read(h.guild);
  const reserved = await h.api.reserve(h.guild, { title: 'Fictional line', idempotencyKey: 'fictional-1' });
  h.patch = packet => ({ ...packet, line: { ...packet.line, userId: 'forged-owner' } });
  await assert.rejects(h.api.propose(h.guild, { id: reserved.line.id, expectedRevision: 1, quest: draft() }), /invalid|different/i);
});

test('malformed inputs and missing explicit consent do not reach the network', async () => {
  const h = await harness(); await h.api.read(h.guild); const before = h.calls.length;
  await assert.rejects(h.api.reserve(h.guild, { title: 'Bad', idempotencyKey: '../escape' }), /identifier|key/i);
  await assert.rejects(h.api.passport(h.guild, { passportId: 'AC-FICTIONAL', skills: [] }), /consent/i);
  await assert.rejects(h.api.intentionpropose(h.guild, { text: 'Test', expectedRevision: 0 }), /confirm/i);
  await assert.rejects(h.api.confirm(h.guild, { id: 'starling-line:bad', confirmed: true, expectedRevision: -1, proposalHash: 'forged' }), /identifier|revision|hash/i);
  assert.equal(h.calls.length, before);
});

test('bounded timeout aborts and surfaces a useful error without retrying', async () => {
  const h = await harness(); h.timeout = true;
  await assert.rejects(h.api.read(h.guild), /respond|timed out/i); assert.equal(h.calls.length, 1);
});
