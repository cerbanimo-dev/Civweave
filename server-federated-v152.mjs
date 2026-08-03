import http from 'node:http';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || './data');
const FEDERATION_FILE = path.join(DATA_DIR, 'federation-state.json');
const IDENTITY_FILE = path.join(DATA_DIR, 'federation-identity.json');
const PORT = Number(process.env.PORT || 8787);
const APP_PORT = Number(process.env.COMMONWEAVE_APP_PORT || 8788);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_NAME = process.env.COMMONWEAVE_NODE_NAME || process.env.HUB_NAME || 'Commonweave Node';
const NODE_DESCRIPTION = process.env.COMMONWEAVE_NODE_DESCRIPTION || 'A sovereign Commonweave community node.';
const PUBLIC_URL = String(process.env.PUBLIC_HOST_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const AUTO_ACCEPT = /^true$/i.test(process.env.COMMONWEAVE_AUTO_ACCEPT_PEERS || 'false');
const MAX_EVENTS = Math.max(100, Number(process.env.COMMONWEAVE_MAX_FEDERATION_EVENTS || 5000));
const APP_ENTRY = process.env.COMMONWEAVE_APP_ENTRY || 'server-gateway-v131.mjs';
const CAPABILITIES = String(process.env.COMMONWEAVE_NODE_CAPABILITIES || 'release-distribution,node-discovery,federated-events,fellowfare.exchange,living-school.curricula,anarchadia.proposals,portable-proofs')
  .split(',').map(value => value.trim()).filter(Boolean);

await fsp.mkdir(DATA_DIR, { recursive: true });

function now() { return new Date().toISOString(); }
function clean(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function json(res, status, value, headers = {}) {
  const body = Buffer.from(JSON.stringify(value, null, 2));
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': body.length, 'cache-control': 'no-store', ...headers });
  res.end(body);
}
async function readBody(req, limit = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Request body too large'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function exportPublicKey(pem) {
  return crypto.createPublicKey(pem).export({ type: 'spki', format: 'pem' });
}
function signObject(value) {
  return crypto.sign(null, Buffer.from(canonical(value)), identity.privateKey).toString('base64');
}
function verifyObject(value, signature, publicKey) {
  try { return crypto.verify(null, Buffer.from(canonical(value)), publicKey, Buffer.from(signature, 'base64')); }
  catch { return false; }
}

async function loadIdentity() {
  try {
    const saved = JSON.parse(await fsp.readFile(IDENTITY_FILE, 'utf8'));
    if (saved.nodeId && saved.publicKey && saved.privateKey) return saved;
  } catch {}
  const pair = crypto.generateKeyPairSync('ed25519');
  const created = {
    nodeId: `cw:${crypto.randomUUID()}`,
    publicKey: pair.publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    createdAt: now()
  };
  await fsp.writeFile(IDENTITY_FILE, JSON.stringify(created, null, 2), { mode: 0o600 });
  return created;
}
const identity = await loadIdentity();

const state = {
  schema: 'commonweave.federation-state.v1',
  peers: {},
  events: [],
  blocked: [],
  updatedAt: now()
};
try {
  const saved = JSON.parse(await fsp.readFile(FEDERATION_FILE, 'utf8'));
  if (saved && typeof saved === 'object') Object.assign(state, saved);
} catch {}
let persistTimer;
function persist() {
  state.updatedAt = now();
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    fsp.writeFile(FEDERATION_FILE, JSON.stringify(state, null, 2)).catch(error => console.error('Federation persistence failed:', error.message));
  }, 100);
}
function profile() {
  return {
    schema: 'commonweave.node-profile.v1',
    protocolVersion: '1.0',
    nodeId: identity.nodeId,
    name: NODE_NAME,
    description: NODE_DESCRIPTION,
    baseUrl: PUBLIC_URL,
    inbox: `${PUBLIC_URL}/federation/inbox`,
    outbox: `${PUBLIC_URL}/federation/outbox`,
    publicKey: exportPublicKey(identity.publicKey),
    capabilities: CAPABILITIES,
    peerPolicy: AUTO_ACCEPT ? 'automatic' : 'approval-required',
    software: { name: 'Commonweave', build: '1.0.32-federation-v1' }
  };
}
function publicPeer(peer) {
  return {
    nodeId: peer.nodeId,
    name: peer.name,
    baseUrl: peer.baseUrl,
    capabilities: peer.capabilities || [],
    status: peer.status,
    trustedAt: peer.trustedAt || null,
    lastSeenAt: peer.lastSeenAt || null,
    lastError: peer.lastError || null
  };
}
async function fetchProfile(baseUrl) {
  const normalized = clean(baseUrl, 500).replace(/\/$/, '');
  if (!/^https?:\/\//i.test(normalized)) throw new Error('Peer URL must use HTTP or HTTPS.');
  const response = await fetch(`${normalized}/.well-known/commonweave`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Peer discovery failed with HTTP ${response.status}`);
  const remote = await response.json();
  if (remote.schema !== 'commonweave.node-profile.v1' || !remote.nodeId || !remote.publicKey || !remote.inbox) throw new Error('Peer returned an invalid Commonweave profile.');
  return remote;
}
async function connectPeer(baseUrl) {
  const remote = await fetchProfile(baseUrl);
  if (state.blocked.includes(remote.nodeId)) throw new Error('Peer is blocked.');
  const existing = state.peers[remote.nodeId] || {};
  const peer = state.peers[remote.nodeId] = {
    ...existing,
    nodeId: remote.nodeId,
    name: clean(remote.name, 160),
    baseUrl: clean(remote.baseUrl || baseUrl, 500).replace(/\/$/, ''),
    inbox: clean(remote.inbox, 600),
    publicKey: remote.publicKey,
    capabilities: Array.isArray(remote.capabilities) ? remote.capabilities.slice(0, 64) : [],
    status: existing.status === 'trusted' || AUTO_ACCEPT ? 'trusted' : 'pending',
    discoveredAt: existing.discoveredAt || now(),
    trustedAt: existing.trustedAt || (AUTO_ACCEPT ? now() : null),
    lastSeenAt: now(),
    lastError: null
  };
  persist();
  return peer;
}
function appendEvent(event) {
  state.events.push(event);
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
  persist();
}
function createEvent(input) {
  const unsigned = {
    schema: 'commonweave.federated-event.v1',
    id: `event:${crypto.randomUUID()}`,
    origin: identity.nodeId,
    kind: clean(input.kind || 'message', 120),
    visibility: clean(input.visibility || 'federated', 40),
    subject: clean(input.subject || '', 240),
    payload: input.payload ?? null,
    createdAt: now()
  };
  return { ...unsigned, signature: signObject(unsigned) };
}
async function deliver(peer, event) {
  if (peer.status !== 'trusted') throw new Error('Peer is not trusted.');
  const response = await fetch(peer.inbox, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-commonweave-sender': identity.nodeId },
    body: JSON.stringify({ sender: profile(), event }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Delivery failed with HTTP ${response.status}`);
  peer.lastSeenAt = now();
  peer.lastError = null;
  persist();
}

const app = spawn(process.execPath, [path.join(ROOT, APP_ENTRY)], {
  env: { ...process.env, PORT: String(APP_PORT), HOST: '127.0.0.1', PUBLIC_HOST_URL: PUBLIC_URL },
  stdio: ['ignore', 'inherit', 'inherit']
});
app.on('exit', code => {
  if (code && code !== 0) console.error(`Commonweave application process exited with code ${code}`);
});

function proxy(req, res) {
  const upstream = http.request({ hostname: '127.0.0.1', port: APP_PORT, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${APP_PORT}` } }, upstreamRes => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', error => json(res, 502, { error: 'Commonweave application is starting or unavailable.', detail: error.message }));
  req.pipe(upstream);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (req.method === 'OPTIONS' && (pathname.startsWith('/api/federation') || pathname.startsWith('/federation/'))) {
      res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type, authorization' });
      return res.end();
    }
    if (pathname === '/.well-known/commonweave' && req.method === 'GET') return json(res, 200, profile(), { 'access-control-allow-origin': '*' });
    if (pathname === '/api/federation/status' && req.method === 'GET') return json(res, 200, { profile: profile(), peers: Object.values(state.peers).map(publicPeer), events: state.events.length, updatedAt: state.updatedAt });
    if (pathname === '/api/federation/peers' && req.method === 'GET') return json(res, 200, { peers: Object.values(state.peers).map(publicPeer) });
    if (pathname === '/api/federation/peers/connect' && req.method === 'POST') {
      const input = await readBody(req);
      const peer = await connectPeer(input.baseUrl);
      return json(res, 201, { ok: true, peer: publicPeer(peer), approvalRequired: peer.status !== 'trusted' });
    }
    const trustMatch = /^\/api\/federation\/peers\/([^/]+)\/(trust|block|remove)$/.exec(pathname);
    if (trustMatch && req.method === 'POST') {
      const nodeId = decodeURIComponent(trustMatch[1]);
      const action = trustMatch[2];
      const peer = state.peers[nodeId];
      if (!peer && action !== 'remove') return json(res, 404, { error: 'Peer not found' });
      if (action === 'trust') { peer.status = 'trusted'; peer.trustedAt = now(); state.blocked = state.blocked.filter(id => id !== nodeId); }
      if (action === 'block') { peer.status = 'blocked'; if (!state.blocked.includes(nodeId)) state.blocked.push(nodeId); }
      if (action === 'remove') delete state.peers[nodeId];
      persist();
      return json(res, 200, { ok: true, peer: state.peers[nodeId] ? publicPeer(state.peers[nodeId]) : null });
    }
    if (pathname === '/api/federation/events' && req.method === 'GET') {
      const since = clean(url.searchParams.get('since'), 80);
      const rows = since ? state.events.filter(event => event.createdAt > since) : state.events.slice(-100);
      return json(res, 200, { events: rows });
    }
    if (pathname === '/api/federation/events' && req.method === 'POST') {
      const input = await readBody(req);
      const event = createEvent(input);
      appendEvent(event);
      const targets = Array.isArray(input.targets) && input.targets.length ? input.targets : Object.keys(state.peers).filter(id => state.peers[id].status === 'trusted');
      const results = [];
      for (const nodeId of targets) {
        const peer = state.peers[nodeId];
        if (!peer) { results.push({ nodeId, ok: false, error: 'Unknown peer' }); continue; }
        try { await deliver(peer, event); results.push({ nodeId, ok: true }); }
        catch (error) { peer.lastError = error.message; persist(); results.push({ nodeId, ok: false, error: error.message }); }
      }
      return json(res, 201, { ok: true, event, deliveries: results });
    }
    if (pathname === '/federation/inbox' && req.method === 'POST') {
      const input = await readBody(req);
      const sender = input.sender;
      const event = input.event;
      if (!sender?.nodeId || !event?.signature) return json(res, 400, { error: 'Signed sender and event are required.' });
      if (state.blocked.includes(sender.nodeId)) return json(res, 403, { error: 'Sender is blocked.' });
      let peer = state.peers[sender.nodeId];
      if (!peer) {
        peer = state.peers[sender.nodeId] = {
          nodeId: sender.nodeId, name: clean(sender.name, 160), baseUrl: clean(sender.baseUrl, 500), inbox: clean(sender.inbox, 600), publicKey: sender.publicKey,
          capabilities: Array.isArray(sender.capabilities) ? sender.capabilities.slice(0, 64) : [], status: AUTO_ACCEPT ? 'trusted' : 'pending', discoveredAt: now(), trustedAt: AUTO_ACCEPT ? now() : null, lastSeenAt: now()
        };
        persist();
      }
      if (peer.status !== 'trusted') return json(res, 202, { accepted: false, pendingApproval: true, nodeId: sender.nodeId });
      const { signature, ...unsigned } = event;
      if (unsigned.origin !== sender.nodeId || !verifyObject(unsigned, signature, peer.publicKey || sender.publicKey)) return json(res, 400, { error: 'Event signature is invalid.' });
      if (!state.events.some(item => item.id === event.id)) appendEvent(event);
      peer.lastSeenAt = now(); persist();
      return json(res, 202, { accepted: true, eventId: event.id });
    }
    if (pathname === '/federation/outbox' && req.method === 'GET') return json(res, 200, { nodeId: identity.nodeId, events: state.events.slice(-100) });
    return proxy(req, res);
  } catch (error) {
    console.error(error);
    return json(res, error.status || 500, { error: error.message || 'Federation server error' });
  }
});

server.listen(PORT, HOST, () => console.log(`${NODE_NAME} federated gateway listening on http://${HOST}:${PORT}`));
async function shutdown(signal) {
  console.log(`${signal}: closing federated node`);
  app.kill('SIGTERM');
  server.close();
  clearTimeout(persistTimer);
  await fsp.writeFile(FEDERATION_FILE, JSON.stringify(state, null, 2)).catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
