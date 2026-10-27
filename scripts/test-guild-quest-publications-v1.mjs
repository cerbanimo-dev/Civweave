import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac, createHash } from 'node:crypto';
import { register } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import worker, { CivweaveCloudNode } from '../cloudflare/node-cloud/src/server-ai-entry-v7.mjs';

class MemoryStorage {
  rows = new Map();
  pending = Promise.resolve();
  async get(key) { return structuredClone(this.rows.get(key)); }
  async put(key, value) { this.rows.set(key, structuredClone(value)); }
  async delete(key) { this.rows.delete(key); }
  async list({ prefix = '', startAfter = '', limit = Infinity } = {}) {
    return new Map([...this.rows].filter(([key]) => key.startsWith(prefix) && key > startAfter).sort(([a], [b]) => a.localeCompare(b)).slice(0, limit).map(([key, value]) => [key, structuredClone(value)]));
  }
  transaction(run) {
    const operation = this.pending.then(async () => { const before = structuredClone(this.rows); try { return await run(this); } catch (error) { this.rows = before; throw error; } });
    this.pending = operation.catch(() => {});
    return operation;
  }
}
const secret = 'fictional-guild-quest-session-secret-for-isolated-tests';
const author = 'fictional-resident-author';
const reader = 'fictional-resident-reader';
function session(userId, nodeId = 'fictional-guild') {
  const encoded = Buffer.from(JSON.stringify({ v: 1, nodeId, userId, exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
  const material = createHash('sha256').update(`civweave.capacity-session.v1\0${secret}`).digest();
  const signature = createHmac('sha256', material).update(`civweave.capacity-session.v1\n${encoded}`).digest('base64url');
  return `${encoded}.${signature}`;
}
function harness() {
  const members = new Set([author, reader]);
  const stores = new Map();
  const env = { NODE_DOMAIN: 'nodes.example.invalid', NODE_FABRIC_SESSION_SECRET: secret };
  env.CAPACITY = { idFromName: name => name, get: () => ({ async fetch(url, init) {
    const input = JSON.parse(init.body);
    if (new URL(url).pathname !== '/members/status') throw new Error('Unexpected capacity action');
    return members.has(input.userId) ? Response.json({ member: { ...input, seatClass: 'community' }, quota: {} }) : Response.json({ error: 'Member is not admitted.' }, { status: 404 });
  } }) };
  env.NODES = { idFromName: name => name, get(nodeId) {
    if (!stores.has(nodeId)) stores.set(nodeId, new MemoryStorage());
    const node = new CivweaveCloudNode({ storage: stores.get(nodeId) }, env);
    return { fetch: (url, init) => node.fetch(new Request(url, init)) };
  } };
  async function call(path = '', { userId = author, nodeId = 'fictional-guild', method = 'GET', body, token = session(userId, nodeId) } = {}) {
    const target = path.startsWith('&') ? `/api/node/quests?nodeId=${nodeId}${path}` : `/api/node/quests${path}?nodeId=${nodeId}`;
    const response = await worker.fetch(new Request(`https://guild-worker.example.test${target}`, {
      method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-civweave-node-id': nodeId }, body: body === undefined ? undefined : JSON.stringify(body),
    }), env, {});
    return { status: response.status, headers: response.headers, data: await response.json() };
  }
  return { call, members, stores, env };
}
const draft = () => ({
  id: 'weave:fictional-repair', kind: 'weave-plan', text: 'Repair the fictional garden gate', state: 'review',
  sourceConversation: ['PRIVATE CHAT'], evidence: ['PRIVATE EVIDENCE'],
  plan: { schema: 'civweave.intention-weave.v1', id: 'weave:fictional-repair', title: 'Repair the fictional garden gate', wish: 'PRIVATE WISH', outcome: 'A gate that closes safely', latestRequest: 'PRIVATE REQUEST', sourceConversation: ['PRIVATE CHAT'],
    paths: [{ id: 'path:build', realm: 'cerbanimo', title: 'Build', purpose: 'Repair the latch', status: 'draft', steps: ['Measure the latch', { id: 'step:2', title: 'Fit the latch', status: 'ready', evidence: ['PRIVATE EVIDENCE'], privateNote: 'PRIVATE NOTE' }], progress: [0] }],
  },
});

test('a current member explicitly publishes a bounded Quest snapshot that another member can list and view', async () => {
  const h = harness();
  assert.deepEqual((await h.call()).data.quests, [], 'private device drafts do not appear on the Guild board');
  const published = await h.call('/publish', { method: 'POST', body: { quest: draft(), expectedRevision: 0, authorUserId: reader, guildId: 'forged-guild' } });
  assert.equal(published.status, 201);
  const row = published.data.publication;
  assert.equal(row.authorUserId, author);
  assert.equal(row.guildId, 'fictional-guild');
  assert.equal(row.revision, 1);
  assert.equal(row.status, 'published');
  assert.equal(row.quest.state, 'review', 'publishing must not activate the original Quest');
  assert.equal(row.quest.plan.paths[0].steps[1].title, 'Fit the latch');
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|sourceConversation|latestRequest|evidence|privateNote|credential|token/);
  const listed = await h.call('', { userId: reader });
  assert.equal(listed.data.quests[0].id, row.id);
  assert.equal(listed.headers.get('cache-control'), 'no-store');
  assert.equal((await h.call(`/${encodeURIComponent(row.id)}`, { userId: reader })).data.publication.id, row.id);
});

test('sessions, membership, Guild scope and internal routes fail closed', async () => {
  const h = harness();
  assert.equal((await h.call('', { token: 'invalid-session' })).status, 401);
  assert.equal((await h.call('', { nodeId: 'other-guild', token: session(author) })).status, 403);
  h.members.delete(author);
  assert.equal((await h.call('/publish', { method: 'POST', body: { quest: draft(), expectedRevision: 0 } })).status, 404);
  const node = new CivweaveCloudNode({ storage: new MemoryStorage() }, h.env);
  const response = await node.fetch(new Request('https://node.internal/internal/guild-quests?nodeId=fictional-guild', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'publish', member: { nodeId: 'fictional-guild', userId: author }, input: { quest: draft(), expectedRevision: 0 } }) }));
  assert.equal(response.status, 403);
});

test('publication revisions reject stale edits and preserve author authority through withdrawal and republishing', async () => {
  const h = harness();
  const first = await h.call('/publish', { method: 'POST', body: { quest: draft(), expectedRevision: 0 } });
  const id = first.data.publication.id;
  const replay = await h.call('/publish', { method: 'POST', body: { quest: draft(), expectedRevision: 0 } });
  assert.equal(replay.status, 200);
  assert.equal(replay.data.idempotent, true);
  assert.equal(replay.data.publication.revision, 1);
  const changed = draft(); changed.plan.outcome = 'A revised observable result';
  assert.equal((await h.call('/publish', { method: 'POST', body: { quest: changed, expectedRevision: 0 } })).status, 409);
  const updated = await h.call('/publish', { method: 'POST', body: { quest: changed, expectedRevision: 1 } });
  assert.equal(updated.data.publication.revision, 2);
  assert.equal((await h.call(`/${encodeURIComponent(id)}/withdraw`, { userId: reader, method: 'POST', body: { expectedRevision: 2 } })).status, 403);
  assert.equal((await h.call(`/${encodeURIComponent(id)}/withdraw`, { method: 'POST', body: { expectedRevision: 1 } })).status, 409);
  const withdrawn = await h.call(`/${encodeURIComponent(id)}/withdraw`, { method: 'POST', body: { expectedRevision: 2 } });
  assert.equal(withdrawn.data.publication.revision, 3);
  assert.equal(withdrawn.data.publication.status, 'withdrawn');
  assert.deepEqual((await h.call('', { userId: reader })).data.quests, []);
  assert.equal((await h.call(`/${encodeURIComponent(id)}`, { userId: reader })).status, 404);
  const restored = await h.call('/publish', { method: 'POST', body: { quest: changed, expectedRevision: 3 } });
  assert.equal(restored.data.publication.id, id);
  assert.equal(restored.data.publication.revision, 4);
  assert.equal((await h.call('', { nodeId: 'other-guild' })).data.quests.length, 0);
});

test('only Weaveling Quest records are accepted and payloads and pages stay bounded', async () => {
  const h = harness();
  const invalid = { id: 'quest:endeavor', kind: 'quest', title: 'A Cerbanimo Endeavor', tasks: [] };
  assert.equal((await h.call('/publish', { method: 'POST', body: { quest: invalid, expectedRevision: 0 } })).status, 400);
  assert.equal((await h.call('/publish', { method: 'POST', body: { quest: draft() } })).status, 400);
  const huge = draft(); huge.plan.outcome = 'x'.repeat(100000);
  assert.equal((await h.call('/publish', { method: 'POST', body: { quest: huge, expectedRevision: 0 } })).status, 413);
  for (let i = 0; i < 3; i++) { const quest = draft(); quest.id = quest.plan.id = `weave:fictional-${i}`; assert.equal((await h.call('/publish', { method: 'POST', body: { quest, expectedRevision: 0 } })).status, 201); }
  const first = await h.call('&limit=2');
  assert.equal(first.data.quests.length, 2);
  assert.ok(first.data.nextCursor);
  const next = await h.call(`&limit=2&cursor=${encodeURIComponent(first.data.nextCursor)}`);
  assert.equal(next.data.quests.length, 1);
  assert.notEqual(first.data.quests[0].id, next.data.quests[0].id);
});

test('standalone mobile Guild residents on different starter nodes share one Guild board', async () => {
  register(`data:text/javascript,${encodeURIComponent("export async function resolve(specifier,context,next){if(specifier==='cloudflare:workers')return{url:'data:text/javascript,export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }',shortCircuit:true};return next(specifier,context)}")}`, import.meta.url);
  const mobile = await import('../cloudflare/mobile-guild-edge/src/creator-provenance-entry.mjs');
  const database = new DatabaseSync(':memory:'), storage = new MemoryStorage();
  storage.sql = { exec(query, ...args) { return database.prepare(query).all(...args); } };
  const env = {}, capacity = new mobile.CivweaveGuildCapacityState({ storage }, env);
  env.CAPACITY = { idFromName: value => value, get: () => capacity };
  capacity.bootstrap({ guildId: 'fictional-mobile-guild', displayName: 'Fictional test Guild', origin: 'https://mobile.example.test' });
  const alice = await capacity.joinResident({ requestedNodeId: 'fictional-mobile-guild-a', userId: author, credentialHash: 'fictional-author-hash', origin: 'https://mobile.example.test' });
  const bob = await capacity.joinResident({ requestedNodeId: 'fictional-mobile-guild-b', userId: reader, credentialHash: 'fictional-reader-hash', origin: 'https://mobile.example.test' });
  async function call(path, member, body) {
    const response = await mobile.default.fetch(new Request(`https://mobile.example.test/api/node/quests${path}?nodeId=${member.nodeId}`, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${member.token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), env, {});
    return { status: response.status, data: await response.json() };
  }
  const published = await call('/publish', alice, { quest: draft(), expectedRevision: 0 });
  assert.equal(published.status, 201);
  assert.equal(published.data.publication.guildId, 'fictional-mobile-guild');
  assert.equal((await call('', bob)).data.quests[0].id, published.data.publication.id);
  const unauthorized = await call('', { ...bob, token: 'x'.repeat(48) });
  assert.equal(unauthorized.status, 401);
  assert.equal((await call('', { ...bob, nodeId: 'another-guild' })).status, 403, 'an unknown requested node cannot bypass mobile Guild scope checks');
  database.close();
});

test('simultaneous edits cannot both consume the same publication revision', async () => {
  const h = harness();
  await h.call('/publish', { method: 'POST', body: { quest: draft(), expectedRevision: 0 } });
  const left = draft(), right = draft(); left.plan.outcome = 'Left revision'; right.plan.outcome = 'Right revision';
  const results = await Promise.all([left, right].map(quest => h.call('/publish', { method: 'POST', body: { quest, expectedRevision: 1 } })));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal((await h.call()).data.quests[0].revision, 2);
});

test('retention bounds reject new source publications without losing existing records', async () => {
  const h = harness();
  await h.call('/publish', { method: 'POST', body: { quest: draft(), expectedRevision: 0 } });
  const storage = h.stores.get('fictional-guild');
  await storage.put(`guild-quest:author-count:fictional-guild:${author}`, 50);
  const another = draft(); another.id = another.plan.id = 'weave:additional-source';
  assert.equal((await h.call('/publish', { method: 'POST', body: { quest: another, expectedRevision: 0 } })).status, 409);
  assert.equal((await h.call()).data.quests.length, 1);
});

test('ownership registry and both deployment adapters point to the single portable publication contract', async () => {
  const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const registry = JSON.parse(await read('config/system-ownership.json')).systems['guild-quest-publication'];
  assert.equal(registry.owner, 'cloudflare/mobile-guild-edge/src/guild-quest-publications-v1.mjs');
  assert.equal(registry.browserOwner, 'public/app/guild-quest-client-v1.js');
  assert.equal(registry.canonicalRoute, '/api/node/quests');
  assert.match(await read('cloudflare/node-cloud/src/server-ai-entry-v6.mjs'), /handleGuildQuestRequest\(request,env,\(\)=>authenticatedMember\(request,env,ctx\),nodeStub\)/);
  assert.match(await read('cloudflare/mobile-guild-edge/src/creator-provenance-entry.mjs'), /from ['"]\.\/guild-quest-publications-v1\.mjs['"]/);
  assert.match(await read('cloudflare/node-cloud/src/index.mjs'), /handleGuildQuestInternal\(request, this\)/);
  assert.match(await read('.github/workflows/deploy-staging-guild-server.yml'), /cloudflare\/mobile-guild-edge\/src\/guild-quest-publications-v1\.mjs/);
});
