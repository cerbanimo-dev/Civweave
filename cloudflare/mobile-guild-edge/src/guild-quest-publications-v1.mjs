// One portable publication contract, used by the standalone Guild edge and node fabric.
export const GUILD_QUEST_ROUTE = '/api/node/quests';
export const GUILD_QUEST_SCHEMA = 'civweave.guild-quest-publication.v1';
export const MAX_GUILD_QUEST_BYTES = 96 * 1024;
const enc = new TextEncoder();
const clean = (value, max = 180) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = value => Array.isArray(value) ? value : [];
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const identifier = value => { const id = clean(value); if (!id || !/^[A-Za-z0-9:_-]+$/.test(id)) fail('A valid Quest identifier is required.'); return id; };
function nodeIdentifier(value) { if (value == null || value === '') return ''; if (typeof value !== 'string' || !/^[A-Za-z0-9:_-]{1,180}$/.test(value.trim())) fail('Shared Quest node identifiers must be valid and bounded.'); return value.trim(); }
function dependencyFields(node) {
  const key = node && typeof node === 'object' && ['dependsOn', 'dependencies', 'dependencyIds'].find(key => Object.hasOwn(node, key)); if (!key) return {};
  const raw = node[key], refs = typeof raw === 'string' ? [raw] : raw; if (!Array.isArray(refs) || refs.length > 16) fail('Shared Quest dependencies must contain at most 16 identifiers.');
  const ids = refs.map(ref => { const id = nodeIdentifier(typeof ref === 'string' ? ref : ref?.id || ref?.taskId); if (!id) fail('A valid dependency identifier is required.'); return id; });
  if (new Set(ids).size !== ids.length) fail('Shared Quest dependency identifiers must be unique.'); return { dependsOn: ids };
}
function uniqueNodes(paths) { const ids = new Set(); for (const path of paths) for (const node of [path, ...path.steps.filter(step => typeof step === 'object')]) if (node.id) { if (ids.has(node.id)) fail('Shared Quest node identifiers must be unique.'); ids.add(node.id); } }
export const GUILD_QUEST_CORS = Object.freeze({ 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'authorization, content-type, x-civweave-node-id', 'access-control-max-age': '86400' });
export const guildQuestJson = (value, status = 200) => Response.json(value, { status, headers: GUILD_QUEST_CORS });
export const guildQuestError = error => guildQuestJson({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 500);

export function projectGuildQuest(raw) {
  if (raw?.kind !== 'weave-plan' || raw?.plan?.schema !== 'civweave.intention-weave.v1') fail('Only a saved Weaveling Quest can be submitted to a Guild.');
  const source = raw.plan, id = identifier(raw.id || source.id), title = clean(source.title || raw.text, 240);
  if (source.id && source.id !== id) fail('Quest and plan identifiers must match.');
  if (!title) fail('A Quest title is required.');
  const state = clean(raw.state || source.state, 40) || 'review';
  const paths = list(source.paths || source.tracks);
  if (paths.length > 12) fail('A shared Quest may contain at most 12 paths.');
  const projectedPaths = paths.map(path => {
    const sourceSteps = list(path?.steps || path?.tasks);
    if (sourceSteps.length > 64) fail('A shared Quest path may contain at most 64 steps.');
    const indexedSteps = sourceSteps.map((step, index) => ({ index, step: typeof step === 'string' ? clean(step, 2000) : {
      id: nodeIdentifier(step?.id || step?.taskId), title: clean(step?.title || step?.name || step?.label || step?.description, 2000), description: clean(step?.description, 2000), status: clean(step?.status, 40), ...dependencyFields(step),
    } })).filter(({ step }) => typeof step === 'string' ? Boolean(step) : Boolean(step.title));
    const steps = indexedSteps.map(({ step }) => step), progressIndices = new Map(indexedSteps.map(({ index }, projectedIndex) => [index, projectedIndex]));
    return { id: nodeIdentifier(path?.id), type: clean(path?.type, 80), realm: clean(path?.realm || path?.system, 80), title: clean(path?.title, 240), purpose: clean(path?.purpose, 2000), status: clean(path?.status, 40), completionCriteria: clean(path?.completionCriteria, 2000), steps, progress: [...new Set(list(path?.progress).filter(index => Number.isSafeInteger(index) && progressIndices.has(index)).map(index => progressIndices.get(index)))], ...dependencyFields(path) };
  });
  uniqueNodes(projectedPaths);
  const needs = list(raw.needs || source.needs);
  if (needs.length > 32) fail('A shared Quest may contain at most 32 open needs.');
  return {
    id, kind: 'weave-plan', text: title, state,
    plan: { schema: 'civweave.intention-weave.v1', id, title, outcome: clean(source.outcome, 4000), state, paths: projectedPaths },
    needs: needs.map(need => typeof need === 'string' ? clean(need, 2000) : { title: clean(need?.title || need?.name || need?.description, 2000), realm: clean(need?.realm || need?.system, 80), status: clean(need?.status, 40) }).filter(need => typeof need === 'string' ? Boolean(need) : Boolean(need.title)),
  };
}
export async function readGuildQuestInput(request) {
  if (Number(request.headers.get('content-length')) > MAX_GUILD_QUEST_BYTES) fail('Quest submission is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) fail('A JSON request body is required.');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_GUILD_QUEST_BYTES) { await reader.cancel(); fail('Quest submission is too large.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try { const value = JSON.parse(new TextDecoder().decode(body)); if (!value || typeof value !== 'object' || Array.isArray(value)) fail('A JSON object is required.'); return value; }
  catch (error) { if (error.status) throw error; fail('Valid JSON is required.'); }
}
async function digest(value) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
export async function guildQuestInternalToken(env) {
  const secret = clean(env.NODE_FABRIC_SESSION_SECRET || env.NODE_FABRIC_OPERATOR_TOKEN, 10000);
  if (secret.length < 24) fail('Guild publication authority is unavailable.', 503);
  return digest(`civweave.guild-quest-internal.v1\0${secret}`);
}
async function authorizedInternal(request, env) {
  const actual = clean(request.headers.get('x-civweave-internal-guild-quests'), 256), expected = await guildQuestInternalToken(env);
  if (!actual || actual.length !== expected.length) return false;
  const [left, right] = await Promise.all([digest(actual), digest(expected)]); let mismatch = 0;
  for (let index = 0; index < left.length; index++) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}
export function guildQuestAction(request) {
  const url = new URL(request.url), tail = url.pathname.slice(GUILD_QUEST_ROUTE.length);
  if (!tail && request.method === 'GET') return { action: 'list', input: { cursor: url.searchParams.get('cursor') || '', limit: url.searchParams.get('limit') || 40 } };
  if (tail === '/publish' && request.method === 'POST') return { action: 'publish' };
  const match = tail.match(/^\/([^/]+)(\/withdraw)?$/);
  if (match && ((!match[2] && request.method === 'GET') || (match[2] && request.method === 'POST'))) {
    let id; try { id = decodeURIComponent(match[1]); } catch { fail('Invalid publication identifier.'); }
    return { action: match[2] ? 'withdraw' : 'read', input: { id: identifier(id) } };
  }
  fail('Quest route or method is not supported.', 405);
}

export async function executeGuildQuestAction(storage, member, action, input = {}) {
  const nodeId = identifier(member?.nodeId), guildId = identifier(member?.guildId || nodeId), userId = identifier(member?.userId);
  const prefix = `guild-quest:record:${guildId}:`, activePrefix = `guild-quest:active:${guildId}:`;
  if (action === 'list') {
    const limit = Math.max(1, Math.min(100, Math.floor(Number(input.limit) || 40))), cursor = clean(input.cursor, 260);
    if (cursor && !/^guild-quest:[a-f0-9]{64}$/.test(cursor)) fail('Invalid Quest page cursor.');
    const rows = [...await storage.list({ prefix: activePrefix, ...(cursor ? { startAfter: `${activePrefix}${cursor}` } : {}), limit: limit + 1 })].map(([, row]) => row);
    const quests = rows.slice(0, limit);
    return { ok: true, schema: 'civweave.guild-quest-list.v1', nodeId, guildId, quests, nextCursor: rows.length > limit ? quests.at(-1).id : null };
  }
  if (action === 'read') {
    const row = await storage.get(`${prefix}${identifier(input.id)}`);
    if (!row || (row.status !== 'published' && row.authorUserId !== userId)) fail('Shared Quest was not found.', 404);
    return { ok: true, publication: row };
  }
  if (!['publish', 'withdraw'].includes(action)) fail('Unknown Quest action.');
  const expected = input.expectedRevision;
  if (!Number.isSafeInteger(expected) || expected < 0) fail('expectedRevision must be a nonnegative integer.');
  const quest = action === 'publish' ? projectGuildQuest(input.quest) : null;
  if (quest && enc.encode(JSON.stringify(quest)).byteLength > MAX_GUILD_QUEST_BYTES) fail('Quest submission is too large.', 413);
  const id = quest ? `guild-quest:${await digest(`${guildId}\n${userId}\n${quest.id}`)}` : identifier(input.id), key = `${prefix}${id}`, activeKey = `${activePrefix}${id}`;
  return storage.transaction(async tx => {
    const prior = await tx.get(key);
    if (prior && prior.authorUserId !== userId) fail('Only the publishing member may change this shared Quest.', 403);
    if (!prior && action === 'withdraw') fail('Shared Quest was not found.', 404);
    const desiredStatus = quest ? 'published' : 'withdrawn';
    if (prior && prior.status === desiredStatus && (!quest || JSON.stringify(prior.quest) === JSON.stringify(quest)) && (expected === prior.revision || expected === prior.revision - 1)) return { ok: true, publication: prior, idempotent: true, created: false };
    if (expected !== (prior?.revision || 0)) fail('The shared Quest changed. Refresh before submitting again.', 409);
    if (!prior) {
      const totalKey = `guild-quest:count:${guildId}`, authorKey = `guild-quest:author-count:${guildId}:${userId}`;
      const total = Number(await tx.get(totalKey) || 0), authorTotal = Number(await tx.get(authorKey) || 0);
      if (total >= 500 || authorTotal >= 50) fail('This Guild Quest publication allowance is full.', 409);
      await tx.put(totalKey, total + 1); await tx.put(authorKey, authorTotal + 1);
    }
    const at = new Date().toISOString(), publication = { schema: GUILD_QUEST_SCHEMA, id, guildId, nodeId, authorUserId: userId, revision: (prior?.revision || 0) + 1, status: desiredStatus, publishedAt: prior?.publishedAt || at, updatedAt: at, quest: quest || prior.quest };
    await tx.put(key, publication);
    if (desiredStatus === 'published') await tx.put(activeKey, publication); else await tx.delete(activeKey);
    return { ok: true, publication, idempotent: false, created: !prior };
  });
}

export async function handleGuildQuestInternal(request, node) {
  try {
    if (!await authorizedInternal(request, node.env)) fail('Guild publication authorization is required.', 403);
    if (request.method !== 'POST') fail('Method not allowed.', 405);
    const body = await readGuildQuestInput(request), nodeId = clean(request.headers.get('x-civweave-node-id'));
    if (!nodeId || body.member?.nodeId !== nodeId) fail('Guild publication scope does not match.', 403);
    const result = await executeGuildQuestAction(node.state.storage, body.member, body.action, body.input);
    return guildQuestJson(result, result.created ? 201 : 200);
  } catch (error) { return guildQuestError(error); }
}

export async function handleGuildQuestRequest(request, env, authenticate, nodeStub) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: GUILD_QUEST_CORS });
  try {
    const member = await authenticate(), route = guildQuestAction(request), body = request.method === 'POST' ? await readGuildQuestInput(request) : {};
    const input = { ...body, ...route.input };
    const { stub } = nodeStub(env, member.nodeId), token = await guildQuestInternalToken(env);
    return stub.fetch(`https://node.internal/internal/guild-quests?nodeId=${encodeURIComponent(member.nodeId)}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-civweave-node-id': member.nodeId, 'x-civweave-internal-guild-quests': token }, body: JSON.stringify({ member: { nodeId: member.nodeId, userId: member.userId }, action: route.action, input }) });
  } catch (error) { return guildQuestError(error); }
}
