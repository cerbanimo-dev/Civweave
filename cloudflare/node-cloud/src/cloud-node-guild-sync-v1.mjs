import { CivweaveCloudNode as BaseCloudNode } from './cloud-node-recovery-v2.mjs';

export const GUILD_SYNC_SCHEMA = 'civweave.guild-cloud-sync.v1';
const BOOTSTRAP_KEY = 'guild-cloud-bootstrap';
const ENVELOPE_PREFIX = 'guild-envelope:';
const MAX_ENVELOPE_BYTES = 512 * 1024;
const MAX_ENVELOPES = 500;
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const enc = new TextEncoder();
const headers = Object.freeze({
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, x-civweave-guild-key, x-civweave-node-id, x-civweave-fabric-token',
  'access-control-max-age': '86400',
});
const json = (value, status = 200) => Response.json(value, { status, headers });

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function secretEqual(left, right) {
  if (!left || !right) return false;
  const [a, b] = await Promise.all([sha256Hex(left), sha256Hex(right)]);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function nodeIdFor(request) {
  const url = new URL(request.url);
  return clean(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId'), 180)
    .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function syncKeyFrom(request) {
  const bearer = clean(request.headers.get('authorization'), 600).replace(/^Bearer\s+/i, '');
  return bearer || clean(request.headers.get('x-civweave-guild-key'), 600);
}
function validSyncKey(value) { return /^[A-Za-z0-9_-]{40,200}$/.test(clean(value, 220)); }
function safeEnvelope(input = {}) {
  if (input?.schema !== 'civweave.community-object-envelope.v1') throw Object.assign(new TypeError('Unsupported Guild sync envelope.'), { status: 400 });
  const payload = input.payload;
  if (!payload || payload.schema !== 'civweave.community-object.v1' || !payload.id || !payload.revisionHash || !payload.signature) {
    throw Object.assign(new TypeError('Guild sync requires a signed Civweave community object.'), { status: 400 });
  }
  const text = JSON.stringify(input);
  if (text.length > MAX_ENVELOPE_BYTES) throw Object.assign(new RangeError('Guild sync envelope is too large.'), { status: 413 });
  return JSON.parse(text);
}

export class CivweaveCloudNode extends BaseCloudNode {
  async bootstrapGuild(nodeId, input = {}) {
    const syncKey = clean(input.syncKey, 220);
    if (!validSyncKey(syncKey)) throw Object.assign(new TypeError('A high-entropy Guild sync key is required.'), { status: 400 });
    const syncKeyHash = await sha256Hex(`civweave.guild-cloud-sync-key.v1\n${syncKey}`);
    const prior = await this.state.storage.get(BOOTSTRAP_KEY);
    if (prior?.syncKeyHash && !await secretEqual(prior.syncKeyHash, syncKeyHash)) {
      throw Object.assign(new Error('This Cloudflare Guild primary is already claimed by another founding key.'), { status: 409 });
    }
    const current = await this.manifest(nodeId);
    const displayName = clean(input.displayName || current.displayName || nodeId, 180) || nodeId;
    const capabilities = [...new Set([...(current.capabilities || []), 'pocket-sync', 'mesh-recovery'])];
    const manifest = Object.freeze({ ...current, displayName, capabilities, updatedAt: new Date().toISOString() });
    const bootstrap = Object.freeze({
      schema: GUILD_SYNC_SCHEMA,
      guildId: nodeId,
      displayName,
      foundingDeviceId: clean(input.foundingDeviceId, 500) || prior?.foundingDeviceId || null,
      syncKeyHash,
      createdAt: prior?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await this.state.storage.put({ [BOOTSTRAP_KEY]: bootstrap, manifest });
    return Object.freeze({ schema: GUILD_SYNC_SCHEMA, guildId: nodeId, displayName, foundingDeviceId: bootstrap.foundingDeviceId, createdAt: bootstrap.createdAt, idempotent: Boolean(prior) });
  }
  async requireGuildSyncKey(request) {
    const bootstrap = await this.state.storage.get(BOOTSTRAP_KEY);
    if (!bootstrap?.syncKeyHash) throw Object.assign(new Error('This Guild cloud primary has not been bootstrapped.'), { status: 404 });
    const supplied = syncKeyFrom(request);
    if (!validSyncKey(supplied)) throw Object.assign(new Error('Guild sync key is required.'), { status: 401 });
    const suppliedHash = await sha256Hex(`civweave.guild-cloud-sync-key.v1\n${supplied}`);
    if (!await secretEqual(bootstrap.syncKeyHash, suppliedHash)) throw Object.assign(new Error('Guild sync key is invalid.'), { status: 403 });
    return bootstrap;
  }
  async putGuildEnvelope(request, nodeId) {
    await this.requireGuildSyncKey(request);
    const raw = await request.text();
    if (raw.length > MAX_ENVELOPE_BYTES) throw Object.assign(new RangeError('Guild sync envelope is too large.'), { status: 413 });
    let envelope;
    try { envelope = safeEnvelope(JSON.parse(raw)); }
    catch (error) { if (error?.status) throw error; throw Object.assign(new TypeError('Guild sync envelope is invalid JSON.'), { status: 400 }); }
    const object = envelope.payload;
    const identityHash = await sha256Hex(`${object.id}\n${object.revisionHash}`);
    const storageKey = `${ENVELOPE_PREFIX}${identityHash}`;
    const prior = await this.state.storage.get(storageKey);
    if (!prior) {
      await this.state.storage.put(storageKey, Object.freeze({ ...envelope, guildId: nodeId, receivedAt: new Date().toISOString() }));
      const rows = await this.state.storage.list({ prefix: ENVELOPE_PREFIX });
      if (rows.size > MAX_ENVELOPES) {
        const ordered = [...rows.entries()].sort((a, b) => String(a[1]?.receivedAt || '').localeCompare(String(b[1]?.receivedAt || '')));
        await this.state.storage.delete(ordered.slice(0, rows.size - MAX_ENVELOPES).map(([key]) => key));
      }
    }
    return Object.freeze({ ok: true, schema: GUILD_SYNC_SCHEMA, guildId: nodeId, objectId: object.id, revisionHash: object.revisionHash, idempotent: Boolean(prior) });
  }
  async listGuildEnvelopes(request, nodeId) {
    await this.requireGuildSyncKey(request);
    const url = new URL(request.url), limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit')) || 200));
    const rows = await this.state.storage.list({ prefix: ENVELOPE_PREFIX });
    const envelopes = [...rows.values()].sort((a, b) => String(a.receivedAt || '').localeCompare(String(b.receivedAt || ''))).slice(-limit);
    return Object.freeze({ ok: true, schema: GUILD_SYNC_SCHEMA, guildId: nodeId, envelopes });
  }
  async fetch(request) {
    const url = new URL(request.url), nodeId = nodeIdFor(request);
    if (request.method === 'OPTIONS' && (url.pathname === '/api/envelopes' || url.pathname === '/internal/guild-bootstrap')) return new Response(null, { status: 204, headers });
    if (nodeId && request.method === 'POST' && url.pathname === '/internal/guild-bootstrap') {
      if (!await secretEqual(request.headers.get('x-civweave-fabric-token'), this.env.NODE_FABRIC_BINDING_TOKEN || '')) return json({ ok: false, error: 'forbidden' }, 403);
      try { return json({ ok: true, ...(await this.bootstrapGuild(nodeId, await request.json().catch(() => ({})))) }, 201); }
      catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 500); }
    }
    if (nodeId && url.pathname === '/api/envelopes') {
      try {
        if (request.method === 'POST') return json(await this.putGuildEnvelope(request, nodeId), 201);
        if (request.method === 'GET') return json(await this.listGuildEnvelopes(request, nodeId));
        return json({ ok: false, error: 'Method not allowed.' }, 405);
      } catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 500); }
    }
    return super.fetch(request);
  }
}
