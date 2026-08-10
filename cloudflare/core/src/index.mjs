export const CORE_SCHEMA = 'civweave.cloudflare-core.v1';
export const NODE_SCHEMA = 'civweave.node.v1';

const encoder = new TextEncoder();
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value, null, 2), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
});
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const slug = value => clean(value, 120).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const nowIso = () => new Date().toISOString();

export const launchTopology = Object.freeze({
  schema: 'civweave.launch-topology.v1',
  canonicalInstallOrigin: 'https://commonweave.pages.dev',
  coreApiOrigin: 'https://api.commonweave.earth',
  cloudNodeDomain: 'nodes.commonweave.earth',
  nodeProtocol: NODE_SCHEMA,
  platformFeeBps: 1500,
  renderFallbackDiscoverable: true,
  liveMoneyEnabled: false
});

export function normalizeNodeRecord(input = {}) {
  const nodeId = slug(input.nodeId);
  if (!nodeId) throw new TypeError('nodeId is required.');
  const publicOrigin = new URL(clean(input.publicOrigin, 2000));
  if (publicOrigin.protocol !== 'https:') throw new RangeError('publicOrigin must use HTTPS.');
  const runtime = clean(input.runtime || 'unknown', 80);
  const operatorId = clean(input.operatorId || `operator-${nodeId}`, 180);
  const displayName = clean(input.displayName || nodeId, 180);
  const capabilities = [...new Set((Array.isArray(input.capabilities) ? input.capabilities : []).map(item => clean(item, 120)).filter(Boolean))];
  return Object.freeze({
    schema: NODE_SCHEMA,
    nodeId,
    operatorId,
    displayName,
    runtime,
    publicOrigin: publicOrigin.origin,
    capabilities,
    status: ['active', 'degraded', 'offline'].includes(input.status) ? input.status : 'active',
    updatedAt: clean(input.updatedAt, 80) || nowIso()
  });
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function sha256(value) {
  return crypto.subtle.digest('SHA-256', encoder.encode(String(value)));
}
async function constantSecretEqual(left, right) {
  if (!left || !right) return false;
  const [a, b] = await Promise.all([sha256(left), sha256(right)]);
  if (typeof crypto.subtle.timingSafeEqual === 'function') return crypto.subtle.timingSafeEqual(a, b);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function verifyStripeWebhook({ rawBody, signatureHeader, secret, now = Date.now(), toleranceSeconds = 300 }) {
  if (!secret) return { ok: false, reason: 'webhook-secret-missing' };
  const parts = String(signatureHeader || '').split(',').map(part => part.trim());
  const timestamp = Number(parts.find(part => part.startsWith('t='))?.slice(2));
  const signatures = parts.filter(part => part.startsWith('v1=')).map(part => part.slice(3));
  if (!Number.isSafeInteger(timestamp) || !signatures.length) return { ok: false, reason: 'signature-header-malformed' };
  if (Math.abs(Math.floor(now / 1000) - timestamp) > toleranceSeconds) return { ok: false, reason: 'signature-timestamp-outside-tolerance' };
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`)));
  for (const signature of signatures) if (await constantSecretEqual(expected, signature)) return { ok: true, timestamp };
  return { ok: false, reason: 'signature-mismatch' };
}

async function listNodes(env, limit = 100) {
  const bounded = Math.max(1, Math.min(250, Number(limit) || 100));
  const result = await env.DB.prepare(`SELECT node_id AS nodeId, operator_id AS operatorId, display_name AS displayName, runtime, public_origin AS publicOrigin, capabilities_json AS capabilitiesJson, status, updated_at AS updatedAt FROM nodes ORDER BY updated_at DESC LIMIT ?1`).bind(bounded).all();
  return (result.results || []).map(row => ({ ...row, capabilities: JSON.parse(row.capabilitiesJson || '[]'), capabilitiesJson: undefined }));
}

async function upsertNode(env, record) {
  const node = normalizeNodeRecord(record);
  await env.DB.prepare(`INSERT INTO nodes(node_id,operator_id,display_name,runtime,public_origin,capabilities_json,status,updated_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8)
    ON CONFLICT(node_id) DO UPDATE SET operator_id=excluded.operator_id,display_name=excluded.display_name,runtime=excluded.runtime,public_origin=excluded.public_origin,capabilities_json=excluded.capabilities_json,status=excluded.status,updated_at=excluded.updated_at`)
    .bind(node.nodeId, node.operatorId, node.displayName, node.runtime, node.publicOrigin, JSON.stringify(node.capabilities), node.status, node.updatedAt).run();
  return node;
}

async function handleStripeWebhook(request, env) {
  if (!env.STRIPE_CONNECT_WEBHOOK_SECRET) return json({ ok: false, error: 'stripe-webhook-secret-not-configured' }, 503);
  const rawBody = await request.text();
  const verification = await verifyStripeWebhook({ rawBody, signatureHeader: request.headers.get('stripe-signature'), secret: env.STRIPE_CONNECT_WEBHOOK_SECRET });
  if (!verification.ok) return json({ ok: false, error: verification.reason }, 400);
  let event;
  try { event = JSON.parse(rawBody); } catch { return json({ ok: false, error: 'invalid-json' }, 400); }
  const eventId = clean(event.id, 180);
  const eventType = clean(event.type, 180);
  if (!eventId || !eventType) return json({ ok: false, error: 'stripe-event-missing-id-or-type' }, 400);
  await env.DB.prepare(`INSERT OR IGNORE INTO stripe_events(event_id,event_type,livemode,payload_json,received_at) VALUES(?1,?2,?3,?4,?5)`)
    .bind(eventId, eventType, event.livemode ? 1 : 0, rawBody, nowIso()).run();
  return json({ ok: true, received: eventId });
}

async function routeApi(request, env) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json({ schema: CORE_SCHEMA, ok: true, bindings: { d1: Boolean(env.DB), r2: Boolean(env.PACKAGES), assets: Boolean(env.ASSETS) }, liveMoneyEnabled: false, platformFeeBps: Number(env.CIVWEAVE_PLATFORM_FEE_BPS || 1500) });
  }
  if (request.method === 'GET' && url.pathname === '/api/launch-topology') return json({ ...launchTopology, platformFeeBps: Number(env.CIVWEAVE_PLATFORM_FEE_BPS || 1500) });
  if (request.method === 'GET' && url.pathname === '/api/nodes') return json({ schema: 'civweave.node-directory.v1', nodes: await listNodes(env, url.searchParams.get('limit')) });
  if (request.method === 'GET' && url.pathname.startsWith('/api/nodes/')) {
    const nodeId = slug(url.pathname.slice('/api/nodes/'.length));
    const row = await env.DB.prepare(`SELECT node_id AS nodeId, operator_id AS operatorId, display_name AS displayName, runtime, public_origin AS publicOrigin, capabilities_json AS capabilitiesJson, status, updated_at AS updatedAt FROM nodes WHERE node_id=?1`).bind(nodeId).first();
    if (!row) return json({ ok: false, error: 'node-not-found' }, 404);
    return json({ ...row, capabilities: JSON.parse(row.capabilitiesJson || '[]'), capabilitiesJson: undefined });
  }
  if (request.method === 'POST' && url.pathname === '/internal/nodes/upsert') {
    if (!await constantSecretEqual(request.headers.get('x-civweave-fabric-token'), env.NODE_FABRIC_BINDING_TOKEN)) return json({ ok: false, error: 'forbidden' }, 403);
    try { return json({ ok: true, node: await upsertNode(env, await request.json()) }); }
    catch (error) { return json({ ok: false, error: String(error?.message || error) }, 400); }
  }
  if (request.method === 'POST' && url.pathname === '/api/stripe/webhook') return handleStripeWebhook(request, env);
  if (request.method === 'GET' && url.pathname.startsWith('/packages/')) {
    const key = decodeURIComponent(url.pathname.slice('/packages/'.length));
    if (!key || key.includes('..')) return json({ ok: false, error: 'invalid-package-key' }, 400);
    const object = await env.PACKAGES.get(key);
    if (!object) return json({ ok: false, error: 'package-not-found' }, 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    return new Response(object.body, { headers });
  }
  return null;
}

export default {
  async fetch(request, env) {
    const api = await routeApi(request, env);
    if (api) return api;
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ ok: false, error: 'not-found' }, 404);
  }
};
