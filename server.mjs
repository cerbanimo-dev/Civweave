import http from 'node:http';
import { createReadStream } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { validatePatch } from './public/core/domain.js';

const exec = promisify(execFile);
const root = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(root, 'public');
const port = Number(process.env.PORT || 4173);
const nodeId = process.env.COMMONWEAVE_NODE_ID || `node-${crypto.randomUUID()}`;
const clients = new Map();
const sockets = new Set();

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.wasm':'application/wasm', '.onnx':'application/octet-stream', '.txt':'text/plain; charset=utf-8', '.md':'text/markdown; charset=utf-8'
};

function json(response, status, payload) {
  response.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
  response.end(JSON.stringify(payload));
}

async function body(request, limit = 2_000_000) {
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function safePublicPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const target = path.resolve(publicRoot, relative);
  return target.startsWith(publicRoot + path.sep) || target === path.join(publicRoot, 'index.html') ? target : null;
}

async function serveStatic(request, response) {
  let target = safePublicPath(request.url);
  if (!target) return json(response, 403, { error:'Forbidden path.' });
  try {
    await access(target);
  } catch {
    if (!path.extname(target)) target = path.join(publicRoot, 'index.html');
    else return json(response, 404, { error:'Not found.' });
  }
  const extension = path.extname(target).toLowerCase();
  response.writeHead(200, {
    'content-type': MIME[extension] || 'application/octet-stream',
    'cache-control': extension === '.html' ? 'no-cache' : 'public, max-age=3600',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(self), microphone=(), geolocation=()'
  });
  createReadStream(target).pipe(response);
}

function send(socket, payload) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function presence() {
  const peers = [...clients.keys()];
  for (const socket of sockets) send(socket, { type:'presence', peers, nodeId });
}

async function applyPacket(payload) {
  if (process.env.COMMONWEAVE_REPO_WRITE !== '1') throw new Error('Local repository writes are disabled. Start with COMMONWEAVE_REPO_WRITE=1.');
  if (payload.approvalPhrase !== 'APPLY ON LOCAL BRANCH') throw new Error('Exact approval phrase required: APPLY ON LOCAL BRANCH');
  const packet = payload.packet;
  const validation = validatePatch(packet);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  const status = await exec('git', ['status','--porcelain'], { cwd:root });
  if (status.stdout.trim()) throw new Error('The repository working tree must be clean before Anarchadia creates a branch.');
  const slug = String(packet.summary || 'change').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,36) || 'change';
  const branch = `anarchadia/${Date.now()}-${slug}`;
  const worktreeRoot = path.join(root, '.commonweave-worktrees');
  const worktree = path.join(worktreeRoot, branch.replace(/\//g,'-'));
  await mkdir(worktreeRoot, { recursive:true });
  await exec('git', ['worktree','add','-b',branch,worktree,'HEAD'], { cwd:root });
  const patchFile = path.join(worktree, '.anarchadia.patch');
  try {
    await writeFile(patchFile, packet.diff, 'utf8');
    await exec('git', ['apply','--check',patchFile], { cwd:worktree });
    await exec('git', ['apply',patchFile], { cwd:worktree });
    const test = await exec('npm', ['test'], { cwd:worktree, env:{ ...process.env, COMMONWEAVE_SKIP_MODEL_PULL:'1' }, maxBuffer:5_000_000 });
    await exec('git', ['add','-A'], { cwd:worktree });
    await exec('git', ['-c','user.name=Anarchadia','-c','user.email=anarchadia@local.invalid','commit','-m',`Anarchadia: ${packet.summary || 'approved change'}`], { cwd:worktree });
    const commit = (await exec('git', ['rev-parse','HEAD'], { cwd:worktree })).stdout.trim();
    return { ok:true, branch, commit, worktree, tests:test.stdout.slice(-8000), pushed:false, merged:false };
  } catch (error) {
    throw new Error(`Implementation branch ${branch} was created, but the patch or tests failed: ${error.stderr || error.message}`);
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { schema:'commonweave.clean-baseline.health.v1', nodeId, version:'0.1.0', peers:clients.size, repoWrite:process.env.COMMONWEAVE_REPO_WRITE === '1' });
    if (request.method === 'GET' && url.pathname === '/api/node') return json(response, 200, { nodeId, peers:[...clients.keys()], websocket:'/mesh' });
    if (request.method === 'POST' && url.pathname === '/api/anarchadia/apply') return json(response, 200, await applyPacket(await body(request)));
    if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error:'Method not allowed.' });
    return serveStatic(request, response);
  } catch (error) {
    return json(response, 400, { error:error.message });
  }
});

const wss = new WebSocketServer({ noServer:true, maxPayload:1_000_000 });
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname !== '/mesh') return socket.destroy();
  wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
});

wss.on('connection', socket => {
  sockets.add(socket);
  socket.on('message', raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    if (message.type === 'register' && message.peerId) {
      socket.peerId = String(message.peerId);
      socket.publicKey = message.publicKey || null;
      clients.set(socket.peerId, socket);
      return presence();
    }
    if (message.type === 'signal' && message.target) return send(clients.get(message.target), { type:'signal', from:socket.peerId, publicKey:socket.publicKey, signal:message.signal });
    if (message.type === 'friend-accept' && message.target) return send(clients.get(message.target), { ...message, from:socket.peerId });
    if (message.type === 'relay' && message.packet) {
      const target = message.packet.envelope?.target;
      if (target) return send(clients.get(target), { type:'relay', packet:message.packet });
      for (const peer of sockets) if (peer !== socket) send(peer, { type:'relay', packet:message.packet });
    }
  });
  socket.on('close', () => {
    sockets.delete(socket);
    if (socket.peerId && clients.get(socket.peerId) === socket) clients.delete(socket.peerId);
    presence();
  });
});

server.listen(port, () => console.log(`[Commonweave] clean baseline node listening on http://localhost:${port}`));
