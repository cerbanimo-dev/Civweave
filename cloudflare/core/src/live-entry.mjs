import core, { CORE_SCHEMA, launchTopology } from './index.mjs';
import {
  CloudflareMoneyEdge,
  NODE_MONEY_CHALLENGE_DOMAIN,
  moneyEdgeError
} from './money-edge.mjs';

export * from './index.mjs';

export const LIVE_CIVWEAVE_MONEY_EDGE_ORIGIN = 'https://civweave-core.cerbanimo.workers.dev';
export const LIVE_CIVWEAVE_NODE_FABRIC_ORIGIN = 'https://civweave-node-cloud.cerbanimo.workers.dev';
export const LIVE_CIVWEAVE_INSTALL_ORIGIN = 'https://civweave.cc';

const encoder = new TextEncoder();
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value, null, 2), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
});

function fromB64url(value) {
  const normalized = String(value).replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function b64url(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
function concatBytes(...parts) {
  const arrays = parts.map(part => part instanceof Uint8Array ? part : new Uint8Array(part));
  const out = new Uint8Array(arrays.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of arrays) { out.set(part, offset); offset += part.byteLength; }
  return out;
}
function pemToDer(pem) {
  const base64 = clean(pem, 20000)
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');
  if (!base64) throw Object.assign(new TypeError('Node public key PEM is invalid.'), { status: 400 });
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function randomChallenge() {
  const value = new Uint8Array(32);
  crypto.getRandomValues(value);
  return b64url(value);
}

export function normalizePublicNodeCallback(value) {
  const url = new URL(clean(value, 4000));
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw Object.assign(new RangeError('Money-edge callback must be a credential-free HTTPS origin.'), { status: 400 });
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host || !host.includes('.')) {
    throw Object.assign(new RangeError('Money-edge callback must use a public DNS hostname.'), { status: 400 });
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
    throw Object.assign(new RangeError('Money-edge callback cannot use an IP literal.'), { status: 400 });
  }
  const blocked = [
    'localhost', '.localhost', '.local', '.internal', '.home.arpa',
    '.example', '.invalid', '.test', '.onion'
  ];
  if (blocked.some(suffix => host === suffix.replace(/^\./, '') || host.endsWith(suffix))) {
    throw Object.assign(new RangeError('Money-edge callback must use a publicly routable hostname.'), { status: 400 });
  }
  return url.origin;
}

async function verifyNodeChallenge({ nodeId, challenge, publicKeyPem, signature }) {
  const key = await crypto.subtle.importKey('spki', pemToDer(publicKeyPem), { name: 'Ed25519' }, false, ['verify']);
  const raw = encoder.encode(`${nodeId}\n${challenge}`);
  const message = concatBytes(encoder.encode(`${NODE_MONEY_CHALLENGE_DOMAIN}\n0\n`), raw);
  return crypto.subtle.verify({ name: 'Ed25519' }, key, fromB64url(signature), message);
}

export class PublicHostCloudflareMoneyEdge extends CloudflareMoneyEdge {
  readiness() {
    return Object.freeze({
      ...super.readiness(),
      callbackPolicy: 'verified-public-https-origin-with-proof-of-key'
    });
  }

  async probeNode({ nodeId, operatorId, callbackUrl }) {
    const origin = normalizePublicNodeCallback(callbackUrl);
    const manifestResponse = await this.fetch(new URL('/api/ai/node/manifest', origin), {
      headers: { accept: 'application/json' },
      cache: 'no-store'
    });
    const envelope = await manifestResponse.json().catch(() => ({}));
    if (!manifestResponse.ok) throw Object.assign(new Error('Money edge could not fetch the node manifest.'), { status: 400 });
    const manifest = envelope?.manifest || envelope;
    if (manifest.nodeId !== nodeId || manifest.operatorId !== operatorId) {
      throw Object.assign(new Error('Node manifest identity does not match money-edge enrollment.'), { status: 400 });
    }
    const publicKey = clean(manifest.publicKey, 20000);
    if (!publicKey) throw Object.assign(new TypeError('Node receipt public key is required.'), { status: 400 });
    const challenge = randomChallenge();
    const proofResponse = await this.fetch(new URL('/api/ai/node/live/challenge', origin), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ nodeId, challenge })
    });
    const proof = await proofResponse.json().catch(() => ({}));
    if (!proofResponse.ok || !proof.signature) {
      throw Object.assign(new Error('Node did not answer the live-money proof challenge.'), { status: 400 });
    }
    if (!await verifyNodeChallenge({ nodeId, challenge, publicKeyPem: publicKey, signature: proof.signature })) {
      throw Object.assign(new Error('Node live-money proof challenge signature is invalid.'), { status: 401 });
    }
    return { origin, manifest, publicKey };
  }
}

async function liveMoneyRoute(request, env) {
  const url = new URL(request.url);
  const edge = new PublicHostCloudflareMoneyEdge(env);
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json({
      schema: CORE_SCHEMA,
      ok: true,
      authority: 'cloudflare-core',
      bindings: { d1: Boolean(env.DB), r2: Boolean(env.PACKAGES), identity: Boolean(env.IDENTITY) },
      moneyEdge: edge.readiness(),
      platformFeeBps: Number(env.CIVWEAVE_PLATFORM_FEE_BPS || 1500)
    });
  }
  if (request.method === 'GET' && url.pathname === '/api/money-edge/status') {
    return json({ moneyEdge: edge.readiness(), authority: 'cloudflare-core', canonical: true });
  }
  if (request.method === 'GET' && url.pathname === '/api/launch-topology') {
    return json({
      ...launchTopology,
      canonicalInstallOrigin: env.CIVWEAVE_CANONICAL_INSTALL_ORIGIN || LIVE_CIVWEAVE_INSTALL_ORIGIN,
      coreApiOrigin: LIVE_CIVWEAVE_MONEY_EDGE_ORIGIN,
      cloudNodeFabricOrigin: LIVE_CIVWEAVE_NODE_FABRIC_ORIGIN,
      platformFeeBps: Number(env.CIVWEAVE_PLATFORM_FEE_BPS || 1500)
    });
  }
  try {
    if (request.method === 'POST' && url.pathname === '/api/money-edge/enrollment/start') {
      return json({ enrollment: await edge.createEnrollmentGrant(await request.json()) }, 201);
    }
    if (request.method === 'POST' && url.pathname === '/api/money-edge/nodes/register') {
      return json({ registration: await edge.registerNode(await request.json()) }, 201);
    }
  } catch (error) {
    const safe = moneyEdgeError(error);
    return json(safe.body, safe.status);
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const live = await liveMoneyRoute(request, env);
    if (live) return live;
    return core.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    return core.scheduled(controller, env, ctx);
  }
};