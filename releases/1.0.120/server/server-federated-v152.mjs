import http from 'node:http';
import net from 'node:net';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createLocalHostCapacityStore } from './lib/local-host-capacity-v1.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || './data');
const FEDERATION_FILE = path.join(DATA_DIR, 'federation-state.json');
const IDENTITY_FILE = path.join(DATA_DIR, 'federation-identity.json');
const PORT = positiveInteger(process.env.PORT, 8787, 1, 65535);
const APP_PORT = positiveInteger(process.env.CIVWEAVE_APP_PORT, 8788, 1, 65535);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_NAME = process.env.CIVWEAVE_NODE_NAME || process.env.HUB_NAME || 'Civweave Node';
const NODE_DESCRIPTION = process.env.CIVWEAVE_NODE_DESCRIPTION || 'A sovereign Civweave community node.';
const PUBLIC_URL = normalizeOrigin(process.env.PUBLIC_HOST_URL || `http://localhost:${PORT}`, 'PUBLIC_HOST_URL');
const AUTO_ACCEPT = /^true$/i.test(process.env.CIVWEAVE_AUTO_ACCEPT_PEERS || 'false');
const ALLOW_UNAUTHENTICATED_ADMIN = /^true$/i.test(process.env.CIVWEAVE_ALLOW_UNAUTHENTICATED_ADMIN || 'false');
const ADMIN_TOKEN = String(process.env.CIVWEAVE_FEDERATION_ADMIN_TOKEN || process.env.HUB_TOKEN || '').trim();
const MAX_EVENTS = positiveInteger(process.env.CIVWEAVE_MAX_FEDERATION_EVENTS, 5000, 100, 100000);
const MAX_PENDING_PEERS = positiveInteger(process.env.CIVWEAVE_MAX_PENDING_PEERS, 256, 1, 10000);
const APP_ENTRY = process.env.CIVWEAVE_APP_ENTRY || 'server-gateway-v131.mjs';
const APP_ENTRY_PATH = path.isAbsolute(APP_ENTRY) ? APP_ENTRY : path.resolve(ROOT, APP_ENTRY);
const CAPABILITIES = String(process.env.CIVWEAVE_NODE_CAPABILITIES || 'release-distribution,node-discovery,federated-events,fellowfare.exchange,living-school.curricula,anarchadia.proposals,portable-proofs')
  .split(',').map(value => clean(value, 120)).filter(Boolean).slice(0, 64);
const BUILD = '1.0.32-federation-v1.1';

await fsp.mkdir(DATA_DIR, { recursive: true });

function now() { return new Date().toISOString(); }
function positiveInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) return fallback;
  return parsed;
}
function clean(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function httpError(message, status = 400) { return Object.assign(new Error(message), { status }); }
function json(res, status, value, headers = {}) {
  const body = Buffer.from(JSON.stringify(value, null, 2));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers
  });
  res.end(body);
}
async function readBody(req, limit = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw httpError('Request body too large', 413);
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw httpError('Invalid JSON', 400); }
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function normalizeOrigin(value, label = 'URL') {
  let parsed;
  try { parsed = new URL(clean(value, 1000)); }
  catch { throw httpError(`${label} must be a valid absolute URL.`); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw httpError(`${label} must use HTTP or HTTPS.`);
  if (parsed.username || parsed.password) throw httpError(`${label} must not include credentials.`);
  if (parsed.search || parsed.hash) throw httpError(`${label} must not include a query or fragment.`);
  if (parsed.pathname !== '/' && parsed.pathname !== '') throw httpError(`${label} must be an origin URL without a path.`);
  return parsed.origin;
}
function parseInbox(value, expectedOrigin) {
  let parsed;
  try { parsed = new URL(clean(value, 1000)); }
  catch { throw httpError('Peer inbox must be a valid absolute URL.'); }
  if (parsed.origin !== expectedOrigin || parsed.pathname !== '/federation/inbox' || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw httpError('Peer inbox must use the peer origin and /federation/inbox path.');
  }
  return parsed.toString();
}
function normalizeNodeId(value) {
  const nodeId = clean(value, 160);
  if (!/^cw:[A-Za-z0-9][A-Za-z0-9._:-]{7,156}$/.test(nodeId)) throw httpError('Invalid Civweave node ID.');
  return nodeId;
}
function normalizePublicKey(value) {
  try {
    const key = crypto.createPublicKey(value);
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('not Ed25519');
    return key.export({ type: 'spki', format: 'pem' });
  } catch {
    throw httpError('Peer public key must be a valid Ed25519 public key.');
  }
}
function publicKeyFingerprint(publicKey) {
  const key = crypto.createPublicKey(publicKey);
  const der = key.export({ type: 'spki', format: 'der' });
  return `sha256:${crypto.createHash('sha256').update(der).digest('base64url')}`;
}
function signObject(value) {
  return crypto.sign(null, Buffer.from(canonical(value)), identity.privateKey).toString('base64');
}
function verifyObject(value, signature, publicKey) {
  try {
    if (typeof signature !== 'string' || signature.length < 40 || signature.length > 512) return false;
    return crypto.verify(null, Buffer.from(canonical(value)), publicKey, Buffer.from(signature, 'base64'));
  } catch { return false; }
}
function bearer(req) {
  const header = String(req.headers.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}
function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}
function adminAuthorized(req) {
  if (!ADMIN_TOKEN) return ALLOW_UNAUTHENTICATED_ADMIN;
  const candidate = bearer(req)
    || clean(req.headers['x-civweave-admin-token'], 1000)
    || clean(req.headers['x-civweave-hub-token'], 1000);
  return constantTimeEqual(candidate, ADMIN_TOKEN);
}
function localNetworkAddress(value) {
  let address = clean(value, 120).toLowerCase();
  if (address.startsWith('::ffff:')) address = address.slice(7);
  if (address === '::1' || address === '0:0:0:0:0:0:0:1') return true;
  if (address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe8') || address.startsWith('fe9') || address.startsWith('fea') || address.startsWith('feb')) return true;
  if (/^127(?:\.\d{1,3}){3}$/.test(address) || /^10(?:\.\d{1,3}){3}$/.test(address) || /^192\.168(?:\.\d{1,3}){2}$/.test(address)) return true;
  const match = address.match(/^172\.(\d{1,3})\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}
function localNetworkClient(req) { return localNetworkAddress(req.socket?.remoteAddress || ''); }
function requireAdmin(req, res) {
  if (adminAuthorized(req)) return true;
  if (!ADMIN_TOKEN && !ALLOW_UNAUTHENTICATED_ADMIN) {
    json(res, 503, { error: 'Federation administration is disabled until CIVWEAVE_FEDERATION_ADMIN_TOKEN is configured.' });
  } else {
    json(res, 401, { error: 'Federation administrator authorization required.' }, { 'www-authenticate': 'Bearer realm="Civweave Federation"' });
  }
  return false;
}
async function writeJsonAtomic(file, value, mode = 0o600) {
  const temporary = `${file}.${process.pid}.tmp`;
  await fsp.writeFile(temporary, JSON.stringify(value, null, 2), { mode });
  await fsp.rename(temporary, file);
  await fsp.chmod(file, mode).catch(() => {});
}

async function loadIdentity() {
  try {
    const saved = JSON.parse(await fsp.readFile(IDENTITY_FILE, 'utf8'));
    const nodeId = normalizeNodeId(saved.nodeId);
    const publicKey = normalizePublicKey(saved.publicKey);
    const privateKey = crypto.createPrivateKey(saved.privateKey);
    if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('Private key is not Ed25519.');
    const probe = Buffer.from('civweave-identity-check');
    const signature = crypto.sign(null, probe, privateKey);
    if (!crypto.verify(null, probe, publicKey, signature)) throw new Error('Identity key pair does not match.');
    return { ...saved, nodeId, publicKey, privateKey: saved.privateKey };
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw new Error(`Federation identity is invalid; refusing to replace it automatically: ${error.message}`);
    }
  }
  const pair = crypto.generateKeyPairSync('ed25519');
  const created = {
    nodeId: `cw:${crypto.randomUUID()}`,
    publicKey: pair.publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    createdAt: now()
  };
  await writeJsonAtomic(IDENTITY_FILE, created, 0o600);
  return created;
}
const identity = await loadIdentity();
const localCapacity = createLocalHostCapacityStore({ dataDir: DATA_DIR, nodeId: identity.nodeId });

const state = {
  schema: 'civweave.federation-state.v1',
  peers: {},
  events: [],
  blocked: [],
  updatedAt: now()
};
try {
  const saved = JSON.parse(await fsp.readFile(FEDERATION_FILE, 'utf8'));
  if (saved && typeof saved === 'object') {
    state.peers = saved.peers && typeof saved.peers === 'object' && !Array.isArray(saved.peers) ? saved.peers : {};
    state.events = Array.isArray(saved.events) ? saved.events.slice(-MAX_EVENTS) : [];
    state.blocked = Array.isArray(saved.blocked) ? [...new Set(saved.blocked.map(value => clean(value, 160)).filter(Boolean))] : [];
    state.updatedAt = saved.updatedAt || state.updatedAt;
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw new Error(`Federation state is invalid: ${error.message}`);
}
let persistTimer;
let persistChain = Promise.resolve();
function snapshotState() {
  return {
    schema: state.schema,
    peers: state.peers,
    events: state.events,
    blocked: state.blocked,
    updatedAt: state.updatedAt
  };
}
function flushPersistence() {
  clearTimeout(persistTimer);
  persistTimer = undefined;
  const snapshot = snapshotState();
  persistChain = persistChain.then(() => writeJsonAtomic(FEDERATION_FILE, snapshot, 0o600));
  return persistChain;
}
function persist() {
  state.updatedAt = now();
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    flushPersistence().catch(error => console.error('Federation persistence failed:', error.message));
  }, 100);
  persistTimer.unref?.();
}
function profile() {
  return {
    schema: 'civweave.node-profile.v1',
    protocolVersion: '1.0',
    nodeId: identity.nodeId,
    name: NODE_NAME,
    description: NODE_DESCRIPTION,
    baseUrl: PUBLIC_URL,
    inbox: `${PUBLIC_URL}/federation/inbox`,
    publicKey: identity.publicKey,
    keyFingerprint: publicKeyFingerprint(identity.publicKey),
    capabilities: CAPABILITIES,
    peerPolicy: AUTO_ACCEPT ? 'automatic' : 'approval-required',
    software: { name: 'Civweave', build: BUILD }
  };
}
function publicPeer(peer) {
  return {
    nodeId: peer.nodeId,
    name: peer.name,
    description: peer.description || '',
    baseUrl: peer.baseUrl,
    capabilities: peer.capabilities || [],
    keyFingerprint: peer.keyFingerprint || publicKeyFingerprint(peer.publicKey),
    status: peer.status,
    discoveredAt: peer.discoveredAt || null,
    trustedAt: peer.trustedAt || null,
    lastSeenAt: peer.lastSeenAt || null,
    lastError: peer.lastError || null
  };
}
function validateProfile(input, expectedOrigin) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw httpError('Peer returned an invalid Civweave profile.');
  if (input.schema !== 'civweave.node-profile.v1') throw httpError('Peer profile schema is not supported.');
  const nodeId = normalizeNodeId(input.nodeId);
  const baseUrl = normalizeOrigin(input.baseUrl, 'Peer baseUrl');
  if (expectedOrigin && baseUrl !== expectedOrigin) throw httpError('Peer profile baseUrl does not match the discovered origin.');
  const publicKey = normalizePublicKey(input.publicKey);
  return {
    schema: input.schema,
    protocolVersion: clean(input.protocolVersion || '1.0', 20),
    nodeId,
    name: clean(input.name || 'Unnamed Civweave Node', 160),
    description: clean(input.description || '', 500),
    baseUrl,
    inbox: parseInbox(input.inbox, baseUrl),
    publicKey,
    keyFingerprint: publicKeyFingerprint(publicKey),
    capabilities: Array.isArray(input.capabilities) ? input.capabilities.map(value => clean(value, 120)).filter(Boolean).slice(0, 64) : []
  };
}
async function fetchProfile(baseUrl) {
  const normalized = normalizeOrigin(baseUrl, 'Peer URL');
  let response;
  try {
    response = await fetch(`${normalized}/.well-known/civweave`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
      redirect: 'error'
    });
  } catch (error) {
    throw httpError(`Peer discovery failed: ${error.message}`, 502);
  }
  if (!response.ok) throw httpError(`Peer discovery failed with HTTP ${response.status}`, 502);
  let remote;
  try { remote = await response.json(); }
  catch { throw httpError('Peer discovery returned invalid JSON.', 502); }
  return validateProfile(remote, normalized);
}
function assertPinnedKey(existing, remote) {
  if (!existing?.publicKey) return;
  const pinned = normalizePublicKey(existing.publicKey);
  if (pinned !== remote.publicKey) {
    throw httpError(`Peer signing key changed. Expected ${publicKeyFingerprint(pinned)} but discovered ${remote.keyFingerprint}. Remove and verify the peer before adding it again.`, 409);
  }
}
async function connectPeer(baseUrl) {
  const remote = await fetchProfile(baseUrl);
  if (remote.nodeId === identity.nodeId) throw httpError('A node cannot peer with itself.', 409);
  if (state.blocked.includes(remote.nodeId)) throw httpError('Peer is blocked.', 403);
  const existing = state.peers[remote.nodeId] || null;
  assertPinnedKey(existing, remote);
  if (existing?.status === 'blocked') throw httpError('Peer is blocked.', 403);
  const shouldTrust = existing?.status === 'trusted' || AUTO_ACCEPT;
  const peer = state.peers[remote.nodeId] = {
    ...existing,
    ...remote,
    status: shouldTrust ? 'trusted' : 'pending',
    discoveredAt: existing?.discoveredAt || now(),
    trustedAt: existing?.trustedAt || (shouldTrust ? now() : null),
    lastSeenAt: now(),
    lastError: null
  };
  persist();
  return peer;
}
function eventKey(event) { return `${event.origin}\u0000${event.id}`; }
function hasEvent(event) {
  const key = eventKey(event);
  return state.events.some(item => eventKey(item) === key);
}
function appendEvent(event) {
  if (hasEvent(event)) return false;
  state.events.push(event);
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
  persist();
  return true;
}
function normalizeVisibility(value) {
  const visibility = clean(value || 'federated', 40);
  if (!['federated', 'public'].includes(visibility)) throw httpError('Federated event visibility must be "federated" or "public".');
  return visibility;
}
function createEvent(input) {
  const kind = clean(input.kind, 120);
  if (!kind) throw httpError('Federated event kind is required.');
  const unsigned = {
    schema: 'civweave.federated-event.v1',
    id: `event:${crypto.randomUUID()}`,
    origin: identity.nodeId,
    kind,
    visibility: normalizeVisibility(input.visibility),
    subject: clean(input.subject || '', 240),
    payload: input.payload ?? null,
    createdAt: now()
  };
  return { ...unsigned, signature: signObject(unsigned) };
}
function validateIncomingEvent(input, senderNodeId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw httpError('Federated event is required.');
  const allowed = new Set(['schema', 'id', 'origin', 'kind', 'visibility', 'subject', 'payload', 'createdAt', 'signature']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw httpError(`Unsupported federated event field: ${key}`);
  if (input.schema !== 'civweave.federated-event.v1') throw httpError('Federated event schema is not supported.');
  const id = clean(input.id, 180);
  if (!/^event:[A-Za-z0-9][A-Za-z0-9._:-]{7,176}$/.test(id)) throw httpError('Federated event ID is invalid.');
  const origin = normalizeNodeId(input.origin);
  if (origin !== senderNodeId) throw httpError('Federated event origin does not match its sender.');
  const kind = clean(input.kind, 120);
  if (!kind || kind !== input.kind) throw httpError('Federated event kind is invalid.');
  const visibility = normalizeVisibility(input.visibility);
  if (visibility !== input.visibility) throw httpError('Federated event visibility is invalid.');
  if (typeof input.subject !== 'string' || input.subject.length > 240) throw httpError('Federated event subject is invalid.');
  const timestamp = Date.parse(input.createdAt);
  if (!Number.isFinite(timestamp)) throw httpError('Federated event createdAt is invalid.');
  if (timestamp > Date.now() + 5 * 60 * 1000) throw httpError('Federated event timestamp is too far in the future.');
  if (typeof input.signature !== 'string') throw httpError('Federated event signature is required.');
  return { ...input, id, origin, kind, visibility };
}
async function deliver(peer, event) {
  if (peer.status !== 'trusted') throw httpError('Peer is not trusted.', 409);
  let response;
  try {
    response = await fetch(peer.inbox, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-civweave-sender': identity.nodeId },
      body: JSON.stringify({ sender: profile(), event }),
      signal: AbortSignal.timeout(15000),
      redirect: 'error'
    });
  } catch (error) {
    throw new Error(`Delivery request failed: ${error.message}`);
  }
  let acknowledgement = null;
  try { acknowledgement = await response.json(); } catch {}
  if (!response.ok) throw new Error(acknowledgement?.error || `Delivery failed with HTTP ${response.status}`);
  if (acknowledgement?.accepted !== true) {
    if (acknowledgement?.pendingApproval) throw new Error('Remote peer has not approved this node yet.');
    throw new Error('Remote peer did not acknowledge the event.');
  }
  peer.lastSeenAt = now();
  peer.lastError = null;
  persist();
  return { accepted: true, duplicate: Boolean(acknowledgement.duplicate) };
}
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

let app = null;
let appExited = false;
if (!/^true$/i.test(process.env.CIVWEAVE_SKIP_APP || 'false')) {
  await fsp.access(APP_ENTRY_PATH).catch(() => { throw new Error(`Civweave application entry was not found: ${APP_ENTRY_PATH}`); });
  app = spawn(process.execPath, [APP_ENTRY_PATH], {
    env: { ...process.env, PORT: String(APP_PORT), HOST: '127.0.0.1', PUBLIC_HOST_URL: PUBLIC_URL, CIVWEAVE_FEDERATED_HOST: '1', CIVWEAVE_FEDERATION_NODE_ID: identity.nodeId },
    stdio: ['ignore', 'inherit', 'inherit']
  });
  app.on('error', error => {
    appExited = true;
    console.error('Civweave application process failed:', error.message);
  });
  app.on('exit', code => {
    appExited = true;
    if (code && code !== 0) console.error(`Civweave application process exited with code ${code}`);
  });
}
function forwardedHeaders(req) {
  const headers = { ...req.headers };
  headers.host = req.headers.host || new URL(PUBLIC_URL).host;
  headers['x-forwarded-host'] = req.headers['x-forwarded-host'] || headers.host;
  headers['x-forwarded-proto'] = req.headers['x-forwarded-proto'] || new URL(PUBLIC_URL).protocol.slice(0, -1);
  const remote = clean(req.socket.remoteAddress, 100);
  if (remote) headers['x-forwarded-for'] = headers['x-forwarded-for'] ? `${headers['x-forwarded-for']}, ${remote}` : remote;
  delete headers['proxy-connection'];
  return headers;
}
function proxy(req, res) {
  if (!app || appExited) return json(res, 502, { error: 'Civweave application is unavailable.' });
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: APP_PORT,
    path: req.url,
    method: req.method,
    headers: forwardedHeaders(req)
  }, upstreamRes => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', error => json(res, 502, { error: 'Civweave application is starting or unavailable.', detail: error.message }));
  req.pipe(upstream);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (pathname === '/.well-known/civweave' && req.method === 'GET') {
      return json(res, 200, profile(), { 'access-control-allow-origin': '*' });
    }
    if (pathname === '/api/federation/health' && req.method === 'GET') {
      return json(res, 200, { ok: true, nodeId: identity.nodeId, build: BUILD, appAvailable: Boolean(app && !appExited) });
    }
    if (pathname === '/api/federation/capacity' && req.method === 'GET') {
      return json(res, 200, { ok: true, capacity: await localCapacity.snapshot() });
    }
    if (pathname === '/api/federation/residents/admit' && req.method === 'POST') {
      if (!localNetworkClient(req)) return json(res, 403, { error: 'Local Host Node community admission is limited to localhost and private-LAN clients until authenticated public admission is available.' });
      const input = await readBody(req, 64 * 1024);
      if (input.seatClass && clean(input.seatClass, 40).toLowerCase() !== 'community') return json(res, 400, { error: 'Public local admission may only claim a community seat.' });
      const result = await localCapacity.admit({ residentId: input.residentId, userId: input.userId, seatClass: 'community', billingStatus: 'free' });
      return json(res, result.idempotent ? 200 : 201, { ok: true, ...result });
    }
    if (pathname.startsWith('/api/federation/')) {
      if (req.method === 'OPTIONS') return json(res, 405, { error: 'Cross-origin federation administration is not enabled.' });
      if (!requireAdmin(req, res)) return;
    }
    if (pathname === '/api/federation/residents/billing' && req.method === 'POST') {
      const input = await readBody(req, 64 * 1024);
      const result = await localCapacity.setBilling(input);
      return json(res, 200, { ok: true, ...result });
    }
    if (pathname === '/api/federation/status' && req.method === 'GET') {
      return json(res, 200, {
        profile: profile(),
        peers: Object.values(state.peers).map(publicPeer),
        events: state.events.length,
        adminProtected: Boolean(ADMIN_TOKEN),
        updatedAt: state.updatedAt
      });
    }
    if (pathname === '/api/federation/peers' && req.method === 'GET') {
      return json(res, 200, { peers: Object.values(state.peers).map(publicPeer) });
    }
    if (pathname === '/api/federation/peers/connect' && req.method === 'POST') {
      const input = await readBody(req);
      const peer = await connectPeer(input.baseUrl);
      return json(res, 201, { ok: true, peer: publicPeer(peer), approvalRequired: peer.status !== 'trusted' });
    }
    const trustMatch = /^\/api\/federation\/peers\/([^/]+)\/(trust|block|remove)$/.exec(pathname);
    if (trustMatch && req.method === 'POST') {
      const nodeId = normalizeNodeId(trustMatch[1]);
      const action = trustMatch[2];
      const peer = state.peers[nodeId];
      if (!peer && action !== 'remove') return json(res, 404, { error: 'Peer not found' });
      if (action === 'trust') {
        peer.status = 'trusted';
        peer.trustedAt = now();
        peer.lastError = null;
        state.blocked = state.blocked.filter(id => id !== nodeId);
      }
      if (action === 'block') {
        peer.status = 'blocked';
        peer.lastError = null;
        if (!state.blocked.includes(nodeId)) state.blocked.push(nodeId);
      }
      if (action === 'remove') {
        delete state.peers[nodeId];
        state.blocked = state.blocked.filter(id => id !== nodeId);
      }
      persist();
      return json(res, 200, { ok: true, peer: state.peers[nodeId] ? publicPeer(state.peers[nodeId]) : null });
    }
    if (pathname === '/api/federation/events' && req.method === 'GET') {
      const since = clean(url.searchParams.get('since'), 80);
      const sinceTime = since ? Date.parse(since) : NaN;
      if (since && !Number.isFinite(sinceTime)) return json(res, 400, { error: 'since must be an ISO timestamp.' });
      const rows = since ? state.events.filter(event => Date.parse(event.createdAt) > sinceTime) : state.events.slice(-100);
      return json(res, 200, { events: rows });
    }
    if (pathname === '/api/federation/events' && req.method === 'POST') {
      const input = await readBody(req);
      const event = createEvent(input);
      appendEvent(event);
      let targets;
      if (Object.prototype.hasOwnProperty.call(input, 'targets')) {
        if (!Array.isArray(input.targets)) return json(res, 400, { error: 'targets must be an array of node IDs.' });
        targets = [...new Set(input.targets.map(normalizeNodeId))];
      } else {
        targets = Object.keys(state.peers).filter(id => state.peers[id].status === 'trusted');
      }
      if (targets.length > 256) return json(res, 400, { error: 'A single publication may target at most 256 peers.' });
      const deliveries = await mapLimit(targets, 8, async nodeId => {
        const peer = state.peers[nodeId];
        if (!peer) return { nodeId, ok: false, error: 'Unknown peer' };
        try {
          const acknowledgement = await deliver(peer, event);
          return { nodeId, ok: true, ...acknowledgement };
        } catch (error) {
          peer.lastError = error.message;
          persist();
          return { nodeId, ok: false, error: error.message };
        }
      });
      return json(res, 201, { ok: deliveries.every(result => result.ok), event, deliveries });
    }
    if (pathname === '/federation/inbox' && req.method === 'POST') {
      const input = await readBody(req);
      const sender = validateProfile(input.sender, normalizeOrigin(input.sender?.baseUrl, 'Sender baseUrl'));
      const senderHeader = clean(req.headers['x-civweave-sender'], 160);
      if (senderHeader && senderHeader !== sender.nodeId) return json(res, 400, { error: 'Sender header does not match sender profile.' });
      if (sender.nodeId === identity.nodeId) return json(res, 409, { error: 'A node cannot deliver a federated event to itself.' });
      if (state.blocked.includes(sender.nodeId)) return json(res, 403, { error: 'Sender is blocked.' });
      const event = validateIncomingEvent(input.event, sender.nodeId);
      const { signature, ...unsigned } = event;
      if (!verifyObject(unsigned, signature, sender.publicKey)) return json(res, 400, { error: 'Event signature is invalid.' });
      let peer = state.peers[sender.nodeId];
      if (peer) {
        try { assertPinnedKey(peer, sender); }
        catch (error) { return json(res, error.status || 409, { error: error.message }); }
      } else {
        const pendingCount = Object.values(state.peers).filter(candidate => candidate.status === 'pending').length;
        if (!AUTO_ACCEPT && pendingCount >= MAX_PENDING_PEERS) {
          return json(res, 429, { error: 'Pending peer limit reached. An administrator must review or remove pending peers before new requests can be recorded.' });
        }
        peer = state.peers[sender.nodeId] = {
          ...sender,
          status: AUTO_ACCEPT ? 'trusted' : 'pending',
          discoveredAt: now(),
          trustedAt: AUTO_ACCEPT ? now() : null,
          lastSeenAt: now(),
          lastError: null
        };
        persist();
      }
      if (peer.status === 'blocked') return json(res, 403, { error: 'Sender is blocked.' });
      if (peer.status !== 'trusted') {
        peer.lastSeenAt = now();
        persist();
        return json(res, 202, { accepted: false, pendingApproval: true, nodeId: sender.nodeId, keyFingerprint: sender.keyFingerprint });
      }
      const duplicate = hasEvent(event);
      if (!duplicate) appendEvent(event);
      peer.lastSeenAt = now();
      peer.lastError = null;
      persist();
      return json(res, 202, { accepted: true, duplicate, eventId: event.id });
    }
    if (pathname === '/federation/outbox') {
      return json(res, 410, { error: 'Federation v1 uses signed push delivery. Public outbox reads are intentionally disabled.' });
    }
    return proxy(req, res);
  } catch (error) {
    console.error(error);
    return json(res, error.status || 500, { error: error.message || 'Federation server error' });
  }
});

server.on('upgrade', (req, socket, head) => {
  if (!app || appExited || String(req.url || '').startsWith('/api/federation') || String(req.url || '').startsWith('/federation/')) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  const upstream = net.connect(APP_PORT, '127.0.0.1', () => {
    const headers = forwardedHeaders(req);
    const headerLines = Object.entries(headers).flatMap(([name, value]) => {
      if (Array.isArray(value)) return value.map(item => `${name}: ${item}`);
      return value == null ? [] : [`${name}: ${value}`];
    });
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headerLines.join('\r\n')}\r\n\r\n`);
    if (head?.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.listen(PORT, HOST, () => {
  if (!ADMIN_TOKEN && !ALLOW_UNAUTHENTICATED_ADMIN) {
    console.warn('Federation admin API is locked. Set CIVWEAVE_FEDERATION_ADMIN_TOKEN to manage peers and publish events.');
  }
  console.log(`${NODE_NAME} federated gateway listening on http://${HOST}:${PORT}`);
});
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal}: closing federated node`);
  if (app && !appExited) app.kill('SIGTERM');
  await new Promise(resolve => server.close(resolve));
  await flushPersistence().catch(error => console.error('Final federation persistence failed:', error.message));
}
process.on('SIGTERM', () => shutdown('SIGTERM').finally(() => process.exit(0)));
process.on('SIGINT', () => shutdown('SIGINT').finally(() => process.exit(0)));
