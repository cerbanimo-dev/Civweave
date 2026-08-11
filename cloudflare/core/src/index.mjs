import { CloudflareMoneyEdge, derToPem, moneyEdgeError } from './money-edge-with-memberships.mjs';
import { handlePassportRequest } from './passport-edge.mjs';
import { handlePortableCreditRequest, handlePortableCreditStripeEvent } from './portable-credit-edge.mjs';
import { handleFellowFareCommerceRequest, handleFellowFareStripeEvent, handleCredentialVerificationRequest } from './fellowfare-commerce.mjs';
import { handleFederationRequest } from './federation-edge.mjs';

export const CORE_SCHEMA = 'civweave.cloudflare-core.v2';
export const NODE_SCHEMA = 'civweave.node.v1';

const encoder = new TextEncoder();
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const slug = value => clean(value, 120).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const nowIso = () => new Date().toISOString();
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
function b64url(bytes) { const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); let binary = ''; for (const byte of data) binary += String.fromCharCode(byte); return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, ''); }
function fromB64url(value) { const normalized = String(value).replaceAll('-', '+').replaceAll('_', '/'); const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4); const binary = atob(padded); return Uint8Array.from(binary, char => char.charCodeAt(0)); }
function concatBytes(...parts) { const arrays = parts.map(part => part instanceof Uint8Array ? part : new Uint8Array(part)); const size = arrays.reduce((sum, part) => sum + part.byteLength, 0); const out = new Uint8Array(size); let offset = 0; for (const part of arrays) { out.set(part, offset); offset += part.byteLength; } return out; }
async function sha256Hex(value) { const bytes = value instanceof Uint8Array ? value : encoder.encode(String(value)); const digest = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
async function secretEqual(left, right) { if (!left || !right) return false; const [a, b] = await Promise.all([sha256Hex(left), sha256Hex(right)]); let diff = a.length ^ b.length; for (let i = 0; i < Math.min(a.length, b.length); i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }

export const launchTopology = Object.freeze({
  schema: 'civweave.launch-topology.v1', canonicalInstallOrigin: 'https://commonweave.pages.dev', coreApiOrigin: 'https://api.commonweave.earth', cloudNodeDomain: 'nodes.commonweave.earth', nodeProtocol: NODE_SCHEMA, platformFeeBps: 500,
  economy: Object.freeze({
    topup: Object.freeze({ systemBps: 7000, hostBps: 2500, cerbanimoBps: 500, fundsModel: 'platform-reserve-separate-transfer', portableAuthority: 'passport-stripe-customer-billing-credits' }),
    membership: Object.freeze({ systemBps: 5000, hostBps: 2500, cerbanimoBps: 2500, lifetimeCredits: 'monthly-non-expiring-tier-grant' }),
    fellowfare: Object.freeze({ networkFeeBps: 100, hostBps: 50, cerbanimoBps: 50, feePlacement: 'buyer-surcharge', internalButtonAcornFeeBps: 0 })
  }), moneyEdgeAuthority: 'cloudflare-core', renderFallbackDiscoverable: true, renderMoneyEdgeAuthority: false, liveMoneyEnabledByDefault: false
});

export function normalizeNodeRecord(input = {}) {
  const nodeId = slug(input.nodeId); if (!nodeId) throw new TypeError('nodeId is required.');
  const publicOrigin = new URL(clean(input.publicOrigin, 2000)); if (publicOrigin.protocol !== 'https:') throw new RangeError('publicOrigin must use HTTPS.');
  const runtime = clean(input.runtime || 'unknown', 80), operatorId = clean(input.operatorId || `operator-${nodeId}`, 180), displayName = clean(input.displayName || nodeId, 180);
  const capabilities = [...new Set((Array.isArray(input.capabilities) ? input.capabilities : []).map(item => clean(item, 120)).filter(Boolean))];
  return Object.freeze({ schema: NODE_SCHEMA, nodeId, operatorId, displayName, runtime, publicOrigin: publicOrigin.origin, capabilities, status: ['active', 'degraded', 'offline'].includes(input.status) ? input.status : 'active', updatedAt: clean(input.updatedAt, 80) || nowIso() });
}

export class CivweaveCoreIdentity {
  constructor(state, env) { this.state = state; this.env = env; }
  async identity() {
    let stored = await this.state.storage.get('identity'); if (stored?.privateJwk?.d && stored?.publicKeyPem) return stored;
    const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']), privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey), spki = await crypto.subtle.exportKey('spki', pair.publicKey), publicKeyPem = derToPem(spki), fingerprint = await sha256Hex(publicKeyPem);
    stored = { schema: 'civweave.core-signing-identity.v1', keyId: `cerbanimo-cloudflare-${fingerprint.slice(0, 12)}`, algorithm: 'Ed25519', publicKeyPem, privateJwk, fingerprint, createdAt: nowIso() };
    await this.state.storage.put('identity', stored); return stored;
  }
  async fetch(request) {
    const url = new URL(request.url), identity = await this.identity();
    if (request.method === 'GET' && url.pathname === '/trust') return json({ schema: 'civweave.money-edge-trust.v1', keyId: identity.keyId, algorithm: identity.algorithm, publicKey: identity.publicKeyPem, fingerprint: identity.fingerprint, authority: 'cloudflare-core' });
    if (request.method === 'POST' && url.pathname === '/sign') {
      const input = await request.json().catch(() => ({})); if (input.domain !== 'civweave.money-edge-event.v1') return json({ error: 'signing-domain-not-allowed' }, 403);
      const timestamp = Number(input.timestamp); if (!Number.isSafeInteger(timestamp)) return json({ error: 'invalid-signing-timestamp' }, 400);
      const raw = fromB64url(clean(input.payload, 1000000)), message = concatBytes(encoder.encode(`${input.domain}\n${timestamp}\n`), raw), privateKey = await crypto.subtle.importKey('jwk', identity.privateJwk, { name: 'Ed25519' }, false, ['sign']), signature = await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, message);
      return json({ keyId: identity.keyId, signature: b64url(signature) });
    }
    return json({ ok: false, error: 'not-found' }, 404);
  }
}

export async function verifyStripeWebhook({ rawBody, signatureHeader, secret, now = Date.now(), toleranceSeconds = 300 }) {
  if (!secret) return { ok: false, reason: 'webhook-secret-missing' };
  const parts = String(signatureHeader || '').split(',').map(part => part.trim()).filter(Boolean), timestamp = Number(parts.find(part => part.startsWith('t='))?.slice(2)), signatures = parts.filter(part => part.startsWith('v1=')).map(part => part.slice(3));
  if (!Number.isSafeInteger(timestamp) || !signatures.length) return { ok: false, reason: 'signature-header-malformed' };
  if (Math.abs(Math.floor(now / 1000) - timestamp) > toleranceSeconds) return { ok: false, reason: 'signature-timestamp-outside-tolerance' };
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), expectedBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`)), expected = [...new Uint8Array(expectedBytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  for (const signature of signatures) if (await secretEqual(expected, signature)) return { ok: true, timestamp };
  return { ok: false, reason: 'signature-mismatch' };
}

async function listNodes(env, limit = 100) {
  const bounded = Math.max(1, Math.min(250, Number(limit) || 100));
  const result = await env.DB.prepare(`SELECT node_id AS nodeId, operator_id AS operatorId, display_name AS displayName, runtime, public_origin AS publicOrigin, capabilities_json AS capabilitiesJson, status, updated_at AS updatedAt FROM nodes ORDER BY updated_at DESC LIMIT ?1`).bind(bounded).all();
  return (result.results || []).map(row => ({ ...row, capabilities: JSON.parse(row.capabilitiesJson || '[]'), capabilitiesJson: undefined }));
}
async function upsertNode(env, record) {
  const node = normalizeNodeRecord(record);
  await env.DB.prepare(`INSERT INTO nodes(node_id,operator_id,display_name,runtime,public_origin,capabilities_json,status,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(node_id) DO UPDATE SET operator_id=excluded.operator_id,display_name=excluded.display_name,runtime=excluded.runtime,public_origin=excluded.public_origin,capabilities_json=excluded.capabilities_json,status=excluded.status,updated_at=excluded.updated_at`).bind(node.nodeId, node.operatorId, node.displayName, node.runtime, node.publicOrigin, JSON.stringify(node.capabilities), node.status, node.updatedAt).run();
  return node;
}

async function stripeWebhook(request, env, edge) {
  const rawBody = await request.text();
  const verification = await verifyStripeWebhook({ rawBody, signatureHeader: request.headers.get('stripe-signature'), secret: env.STRIPE_CONNECT_WEBHOOK_SECRET });
  if (!verification.ok) return json({ ok: false, error: verification.reason }, 400);
  let event; try { event = JSON.parse(rawBody); } catch { return json({ ok: false, error: 'invalid-json' }, 400); }
  if (!event?.id || !event?.type) return json({ ok: false, error: 'stripe-event-missing-id-or-type' }, 400);
  const mode = edge.provider.mode;
  if ((mode === 'live' && !event.livemode) || (mode === 'sandbox' && event.livemode)) return json({ ok: false, error: 'stripe-event-mode-mismatch' }, 400);
  const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO stripe_events(event_id,event_type,livemode,payload_json,received_at) VALUES(?1,?2,?3,?4,?5)`).bind(clean(event.id, 180), clean(event.type, 180), event.livemode ? 1 : 0, rawBody, nowIso()).run();
  if (Number(inserted?.meta?.changes ?? inserted?.changes ?? 0) === 0) {
    const prior = await env.DB.prepare('SELECT processing_error FROM stripe_events WHERE event_id=?1').bind(event.id).first();
    if (!prior?.processing_error) return json({ ok: true, duplicate: true, received: event.id });
  }
  try {
    const results = {};
    results.moneyEdge = await edge.handleProviderEvent(event);
    results.portableCredits = await handlePortableCreditStripeEvent(event, env, edge);
    results.fellowfare = await handleFellowFareStripeEvent(event, env, edge);
    await env.DB.prepare('UPDATE stripe_events SET processing_error=NULL WHERE event_id=?1').bind(event.id).run();
    return json({ ok: true, received: event.id, results });
  } catch (error) {
    await env.DB.prepare(`UPDATE stripe_events SET processing_error=?1 WHERE event_id=?2`).bind(clean(error?.message || error, 1200), event.id).run().catch(() => {});
    const safe = moneyEdgeError(error); return json(safe.body, safe.status);
  }
}

export async function handleMoneyEdgeRequest(request, env, options = {}) {
  const url = new URL(request.url), pathname = decodeURIComponent(url.pathname);
  if (!pathname.startsWith('/api/money-edge') && pathname !== '/api/stripe/webhook') return null;
  const edge = new CloudflareMoneyEdge(env, options);
  if (pathname === '/api/money-edge/status' && request.method === 'GET') return json({ moneyEdge: edge.readiness(), authority: 'cloudflare-core', canonical: true });
  if (pathname === '/api/money-edge/trust' && request.method === 'GET') { try { return json({ trust: await edge.trustDocument(url.origin) }); } catch (error) { const safe = moneyEdgeError(error); return json(safe.body, safe.status); } }
  try {
    if (pathname === '/api/money-edge/enrollment/start' && request.method === 'POST') return json({ enrollment: await edge.createEnrollmentGrant(await request.json()) }, 201);
    if (pathname === '/api/money-edge/nodes/register' && request.method === 'POST') return json({ registration: await edge.registerNode(await request.json()) }, 201);
    const statusMatch = pathname.match(/^\/api\/money-edge\/nodes\/([^/]+)\/status$/);
    if (statusMatch && request.method === 'GET') { const raw = new Uint8Array(); return json({ operator: await edge.operatorStatus(decodeURIComponent(statusMatch[1]), raw, request.headers.get('x-civweave-node-signature')) }); }
    if (pathname === '/api/money-edge/topups' && request.method === 'POST') { const rawText = await request.text(), input = JSON.parse(rawText || '{}'); return json({ topup: await edge.createTopUp(input, encoder.encode(rawText), request.headers.get('x-civweave-node-signature')) }, 201); }
    if (pathname === '/api/money-edge/memberships' && request.method === 'POST') { const rawText = await request.text(), input = JSON.parse(rawText || '{}'); return json({ membership: await edge.createMembership(input, encoder.encode(rawText), request.headers.get('x-civweave-node-signature')) }, 201); }
    const refundMatch = pathname.match(/^\/api\/money-edge\/topups\/([^/]+)\/refund$/);
    if (refundMatch && request.method === 'POST') { const rawText = await request.text(), input = JSON.parse(rawText || '{}'); return json({ refund: await edge.refundTopUp({ nodeId: input.nodeId, topupId: decodeURIComponent(refundMatch[1]), amountCents: input.amountCents }, encoder.encode(rawText), request.headers.get('x-civweave-node-signature')) }, 202); }
    if ((pathname === '/api/money-edge/webhooks/stripe' || pathname === '/api/stripe/webhook') && request.method === 'POST') return stripeWebhook(request, env, edge);
    return json({ error: 'Money-edge route not found.' }, 404);
  } catch (error) { const safe = moneyEdgeError(error); return json(safe.body, safe.status); }
}

async function routeApi(request, env) {
  const url = new URL(request.url), money = await handleMoneyEdgeRequest(request, env); if (money) return money;
  const edge = new CloudflareMoneyEdge(env);
  const credential = await handleCredentialVerificationRequest(request, env); if (credential) return credential;
  const federation = await handleFederationRequest(request, env); if (federation) return federation;
  const passport = await handlePassportRequest(request, env, edge); if (passport) return passport;
  const portable = await handlePortableCreditRequest(request, env, edge); if (portable) return portable;
  const fellowfare = await handleFellowFareCommerceRequest(request, env, edge); if (fellowfare) return fellowfare;
  if (request.method === 'GET' && url.pathname === '/api/health') return json({ schema: CORE_SCHEMA, ok: true, authority: 'cloudflare-core', bindings: { d1: Boolean(env.DB), r2: Boolean(env.PACKAGES), identity: Boolean(env.IDENTITY) }, moneyEdge: edge.readiness(), platformFeeBps: Number(env.CIVWEAVE_PLATFORM_FEE_BPS || 500), passportRoaming: true, portableCredits: Boolean(env.CIVWEAVE_STRIPE_BILLING_CREDITS_ENABLED), fellowfareCommerce: true, federationDirectory: true });
  if (request.method === 'GET' && url.pathname === '/api/trust') return json({ trust: await edge.trustDocument(url.origin) });
  if (request.method === 'GET' && url.pathname === '/api/launch-topology') return json({ ...launchTopology, platformFeeBps: Number(env.CIVWEAVE_PLATFORM_FEE_BPS || 500) });
  if (request.method === 'GET' && url.pathname === '/api/nodes') return json({ schema: 'civweave.node-directory.v1', nodes: await listNodes(env, url.searchParams.get('limit')) });
  if (request.method === 'GET' && url.pathname.startsWith('/api/nodes/')) {
    const nodeId = slug(url.pathname.slice('/api/nodes/'.length));
    const row = await env.DB.prepare(`SELECT node_id AS nodeId,operator_id AS operatorId,display_name AS displayName,runtime,public_origin AS publicOrigin,capabilities_json AS capabilitiesJson,status,updated_at AS updatedAt FROM nodes WHERE node_id=?1`).bind(nodeId).first();
    if (!row) return json({ ok: false, error: 'node-not-found' }, 404);
    return json({ ...row, capabilities: JSON.parse(row.capabilitiesJson || '[]'), capabilitiesJson: undefined });
  }
  if (request.method === 'POST' && url.pathname === '/internal/nodes/upsert') {
    if (!await secretEqual(request.headers.get('x-civweave-fabric-token'), env.NODE_FABRIC_BINDING_TOKEN)) return json({ ok: false, error: 'forbidden' }, 403);
    try { return json({ ok: true, node: await upsertNode(env, await request.json()) }); } catch (error) { return json({ ok: false, error: String(error?.message || error) }, 400); }
  }
  if (request.method === 'GET' && url.pathname.startsWith('/packages/')) {
    const key = decodeURIComponent(url.pathname.slice('/packages/'.length)); if (!key || key.includes('..')) return json({ ok: false, error: 'invalid-package-key' }, 400);
    const object = await env.PACKAGES.get(key); if (!object) return json({ ok: false, error: 'package-not-found' }, 404);
    const headers = new Headers(); object.writeHttpMetadata(headers); headers.set('etag', object.httpEtag); return new Response(object.body, { headers });
  }
  return null;
}

export default {
  async fetch(request, env) { const api = await routeApi(request, env); if (api) return api; return json({ ok: false, error: 'not-found' }, 404); },
  async scheduled(_controller, env) { const edge = new CloudflareMoneyEdge(env); if (!edge.readiness().integrationDoorReady) return; await edge.deliverPending({ limit: 100 }); }
};
