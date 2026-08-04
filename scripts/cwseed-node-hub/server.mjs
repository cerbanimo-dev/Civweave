import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SEED_ROOT = path.resolve(ROOT, '..');
const MOBILE_DIR = path.join(SEED_ROOT, 'mobile');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const STATE_FILE = path.join(DATA_DIR, 'host-node-state.json');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const HUB_NAME = clean(process.env.HUB_NAME || 'Commonweave Seed Node', 120);
const HUB_TOKEN = String(process.env.HUB_TOKEN || '').trim();
const MAX_ENVELOPES = Math.max(100, Number(process.env.MAX_ENVELOPES || 5000));
const KIT_FILE = path.join(MOBILE_DIR, 'Commonweave-Mobile-Install-Kit.zip');
const KIT_CHECKSUM_FILE = `${KIT_FILE}.sha256`;
const STARTED_AT = new Date().toISOString();
const APP_VERSION = '__COMMONWEAVE_APP_VERSION__';
const VERSION = '__COMMONWEAVE_NODE_VERSION__';
const clients = new Set();

function now() { return new Date().toISOString(); }
function clean(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function html(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function id(prefix) { return `${prefix}:${crypto.randomUUID()}`; }
function bearer(req) {
  const header = String(req.headers.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}
function authorized(req) {
  return !HUB_TOKEN || bearer(req) === HUB_TOKEN || req.headers['x-commonweave-hub-token'] === HUB_TOKEN;
}
function json(res, status, value, headers = {}) {
  const payload = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': payload.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers
  });
  res.end(payload);
}
async function requestBody(req, limit = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Request body too large'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON body'), { status: 400 }); }
}
function origin(req) {
  const proto = clean(req.headers['x-forwarded-proto'] || 'http', 20).split(',')[0];
  const host = clean(req.headers['x-forwarded-host'] || req.headers.host || `127.0.0.1:${PORT}`, 300).split(',')[0];
  return `${proto === 'https' ? 'https' : 'http'}://${host}`;
}
function sendEvent(type, value) {
  const packet = `event: ${type}\ndata: ${JSON.stringify(value)}\n\n`;
  for (const client of clients) client.write(packet);
}
function publicNode(node) {
  return {
    nodeId: node.nodeId,
    label: node.label,
    system: node.system,
    capabilities: node.capabilities,
    firstSeenAt: node.firstSeenAt,
    lastSeenAt: node.lastSeenAt,
    online: Date.now() - Date.parse(node.lastSeenAt || 0) < 120000
  };
}
function prune() {
  if (state.envelopes.length > MAX_ENVELOPES) {
    state.envelopes.splice(0, state.envelopes.length - MAX_ENVELOPES);
  }
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, entry] of Object.entries(state.presence)) {
    if (Date.parse(entry.updatedAt || 0) < cutoff) delete state.presence[key];
  }
}

await fsp.mkdir(DATA_DIR, { recursive: true });
const state = {
  version: 1,
  nodes: {},
  envelopes: [],
  presence: {},
  createdAt: STARTED_AT,
  updatedAt: STARTED_AT
};
try {
  const saved = JSON.parse(await fsp.readFile(STATE_FILE, 'utf8'));
  if (saved && typeof saved === 'object') Object.assign(state, saved);
} catch (error) {
  if (error.code !== 'ENOENT') console.warn('[Commonweave] State restore skipped:', error.message);
}
let persistTimer = null;
function persistSoon() {
  state.updatedAt = now();
  clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    const temporary = `${STATE_FILE}.tmp`;
    try {
      await fsp.writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
      await fsp.rename(temporary, STATE_FILE);
    } catch (error) {
      console.error('[Commonweave] State persistence failed:', error.message);
    }
  }, 100);
}

async function fileInfo(file) {
  const bytes = await fsp.readFile(file);
  return { bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}
const kitInfo = await fileInfo(KIT_FILE);
const releasePacket = base => ({
  schema: 'commonweave.release.v1',
  channel: 'stable',
  hostBuild: VERSION,
  appVersion: APP_VERSION,
  releasedAt: STARTED_AT,
  installUrl: `${base}/downloads/Commonweave-Mobile-Install-Kit.zip`,
  downloadUrl: `${base}/downloads/Commonweave-Mobile-Install-Kit.zip`,
  sha256: kitInfo.sha256,
  bytes: kitInfo.bytes,
  mandatory: false,
  localInstallRequired: true,
  notes: 'Portable Commonweave mobile bootstrap and local-first node hub.'
});

function landingPage(base) {
  const release = releasePacket(base);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#07141f"><title>${html(HUB_NAME)}</title>
<style>html,body{margin:0;min-height:100%;background:#07141f;color:#f4fffb;font-family:system-ui,sans-serif}body{display:grid;place-items:center;padding:24px}.card{width:min(720px,100%);box-sizing:border-box;border:1px solid #7ee5ff55;border-radius:24px;padding:28px;background:#0a1d29;box-shadow:0 24px 80px #0008}.eyebrow{letter-spacing:.12em;color:#93e8ff;font-size:.75rem}.actions{display:flex;flex-wrap:wrap;gap:12px;margin:22px 0}.actions a{padding:13px 18px;border-radius:12px;text-decoration:none;font-weight:800}.primary{background:#9af1dc;color:#06211b}.secondary{border:1px solid #9af1dc66;color:#eafff9}code{overflow-wrap:anywhere;color:#ffd978}small{color:#bcd4d7}</style>
</head><body><main class="card"><div class="eyebrow">COMMONWEAVE PORTABLE NODE</div><h1>${html(HUB_NAME)}</h1>
<p>This seed carries the compact mobile installer and a dependency-free node hub. The hub provides release metadata, live events, node registration, presence, and bounded relay envelopes. Commonweave data remains local-first.</p>
<div class="actions"><a class="primary" href="/downloads/Commonweave-Mobile-Install-Kit.zip">Download mobile install kit</a><a class="secondary" href="/api/health">Node health</a></div>
<p><small>Kit SHA-256</small><br><code>${release.sha256}</code></p>
<p><small>Start command</small><br><code>npm start</code></p></main></body></html>`;
}
async function sendFile(req, res, file, downloadName) {
  const stat = await fsp.stat(file);
  const headers = {
    'content-type': file.endsWith('.zip') ? 'application/zip' : 'text/plain; charset=utf-8',
    'content-length': stat.size,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  };
  if (downloadName) headers['content-disposition'] = `attachment; filename="${downloadName}"`;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

async function proxyGemini(req, res, pathname) {
  const key = clean(req.headers['x-goog-api-key'], 500);
  if (!key) return json(res, 400, { error: 'A session-only Gemini API key is required.' });
  const suffix = pathname.slice('/api/ai/gemini/interactions'.length);
  if (suffix && !/^\/[A-Za-z0-9_:.~-]+$/.test(suffix)) return json(res, 400, { error: 'Invalid interaction ID.' });
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) return json(res, 405, { error: 'Method not allowed.' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);
  try {
    const init = { method: req.method, headers: { 'x-goog-api-key': key, accept: 'application/json' }, signal: controller.signal };
    if (req.method === 'POST') {
      const payload = await requestBody(req, 4 * 1024 * 1024);
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(payload);
    }
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions${suffix}`, init);
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'content-length': bytes.length,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    });
    res.end(bytes);
  } catch (error) {
    json(res, error?.name === 'AbortError' ? 504 : 502, { error: error?.name === 'AbortError' ? 'Gemini request timed out.' : `Gemini proxy failed: ${error.message}` });
  } finally {
    clearTimeout(timeout);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', origin(req));
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (pathname.startsWith('/api/')) {
      res.setHeader('access-control-allow-origin', '*');
      res.setHeader('access-control-allow-headers', 'content-type, authorization, x-commonweave-hub-token, x-goog-api-key');
      res.setHeader('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS');
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && (pathname === '/' || pathname === '/index.html')) {
      const page = Buffer.from(landingPage(origin(req)));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': page.length, 'cache-control': 'no-store' });
      return req.method === 'HEAD' ? res.end() : res.end(page);
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/downloads/Commonweave-Mobile-Install-Kit.zip') {
      return sendFile(req, res, KIT_FILE, 'Commonweave-Mobile-Install-Kit.zip');
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/downloads/Commonweave-Mobile-Install-Kit.zip.sha256') {
      return sendFile(req, res, KIT_CHECKSUM_FILE, 'Commonweave-Mobile-Install-Kit.zip.sha256');
    }

    const publicApi = ['/api/health', '/api/config', '/api/releases/current', '/api/events'];
    if (pathname.startsWith('/api/') && !publicApi.includes(pathname) && !authorized(req)) {
      return json(res, 401, { error: 'Host node token required.' });
    }
    if (pathname === '/api/ai/gemini/interactions' || pathname.startsWith('/api/ai/gemini/interactions/')) {
      return proxyGemini(req, res, pathname);
    }
    if (pathname === '/api/health' && req.method === 'GET') {
      return json(res, 200, {
        ok: true,
        name: HUB_NAME,
        build: VERSION,
        startedAt: STARTED_AT,
        now: now(),
        nodes: Object.keys(state.nodes).length,
        envelopes: state.envelopes.length,
        persistence: STATE_FILE,
        release: releasePacket(origin(req))
      });
    }
    if (pathname === '/api/config' && req.method === 'GET') {
      return json(res, 200, {
        schema: 'commonweave.host-node-config.v1',
        name: HUB_NAME,
        build: VERSION,
        baseUrl: origin(req),
        apiBase: `${origin(req)}/api`,
        installUrl: `${origin(req)}/downloads/Commonweave-Mobile-Install-Kit.zip`,
        downloadUrl: `${origin(req)}/downloads/Commonweave-Mobile-Install-Kit.zip`,
        release: releasePacket(origin(req)),
        tokenRequired: Boolean(HUB_TOKEN),
        features: ['mobile-kit-distribution', 'node-registration', 'heartbeat', 'relay-envelopes', 'presence', 'sse-events', 'release-broadcasts', 'gemini-agent-proxy']
      });
    }
    if (pathname === '/api/releases/current' && req.method === 'GET') {
      return json(res, 200, releasePacket(origin(req)));
    }
    if (pathname === '/api/releases/broadcast' && req.method === 'POST') {
      const release = releasePacket(origin(req));
      sendEvent('release', release);
      return json(res, 200, { ok: true, listeners: clients.size, release });
    }
    if (pathname === '/api/events' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' });
      const release = releasePacket(origin(req));
      res.write(`event: ready\ndata: ${JSON.stringify({ now: now(), name: HUB_NAME, release })}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (pathname === '/api/nodes/register' && req.method === 'POST') {
      const input = await requestBody(req);
      const nodeId = clean(input.nodeId || id('node'), 180);
      const timestamp = now();
      const prior = state.nodes[nodeId] || {};
      const node = {
        nodeId,
        label: clean(input.label || prior.label || 'Commonweave node', 120),
        system: clean(input.system || prior.system || 'commonweave', 60),
        capabilities: Array.isArray(input.capabilities) ? input.capabilities.map(value => clean(value, 80)).filter(Boolean).slice(0, 40) : (prior.capabilities || []),
        firstSeenAt: prior.firstSeenAt || timestamp,
        lastSeenAt: timestamp
      };
      state.nodes[nodeId] = node;
      persistSoon();
      sendEvent('node', publicNode(node));
      return json(res, 200, { ok: true, node: publicNode(node) });
    }
    if (pathname === '/api/nodes/heartbeat' && req.method === 'POST') {
      const input = await requestBody(req);
      const nodeId = clean(input.nodeId, 180);
      if (!nodeId || !state.nodes[nodeId]) return json(res, 404, { error: 'Node is not registered.' });
      state.nodes[nodeId].lastSeenAt = now();
      if (input.system) state.nodes[nodeId].system = clean(input.system, 60);
      persistSoon();
      return json(res, 200, { ok: true, node: publicNode(state.nodes[nodeId]) });
    }
    if (pathname === '/api/nodes' && req.method === 'GET') {
      return json(res, 200, { nodes: Object.values(state.nodes).map(publicNode) });
    }
    if (pathname === '/api/envelopes' && req.method === 'POST') {
      const input = await requestBody(req, 2 * 1024 * 1024);
      const envelope = {
        id: id('env'),
        from: clean(input.from, 180),
        to: clean(input.to || '*', 180),
        kind: clean(input.kind || 'commonweave.object', 120),
        payload: input.payload ?? null,
        createdAt: now(),
        acknowledgedBy: []
      };
      if (!envelope.from) return json(res, 400, { error: 'Envelope from is required.' });
      state.envelopes.push(envelope);
      prune();
      persistSoon();
      sendEvent('envelope', { id: envelope.id, from: envelope.from, to: envelope.to, kind: envelope.kind, createdAt: envelope.createdAt });
      return json(res, 201, { ok: true, envelope });
    }
    if (pathname === '/api/envelopes' && req.method === 'GET') {
      const nodeId = clean(url.searchParams.get('nodeId'), 180);
      const cursor = clean(url.searchParams.get('cursor'), 220);
      let rows = state.envelopes;
      if (cursor) {
        const index = rows.findIndex(item => item.id === cursor);
        if (index >= 0) rows = rows.slice(index + 1);
      }
      if (nodeId) rows = rows.filter(item => item.to === '*' || item.to === nodeId || item.from === nodeId);
      return json(res, 200, { envelopes: rows.slice(-500), cursor: rows.at(-1)?.id || cursor || null });
    }
    const ack = /^\/api\/envelopes\/([^/]+)\/ack$/.exec(pathname);
    if (ack && req.method === 'POST') {
      const input = await requestBody(req);
      const nodeId = clean(input.nodeId, 180);
      const envelope = state.envelopes.find(item => item.id === ack[1]);
      if (!envelope) return json(res, 404, { error: 'Envelope not found.' });
      if (nodeId && !envelope.acknowledgedBy.includes(nodeId)) envelope.acknowledgedBy.push(nodeId);
      persistSoon();
      return json(res, 200, { ok: true, envelope });
    }
    if (pathname === '/api/presence' && req.method === 'POST') {
      const input = await requestBody(req);
      const nodeId = clean(input.nodeId, 180);
      if (!nodeId) return json(res, 400, { error: 'Presence nodeId is required.' });
      state.presence[nodeId] = {
        nodeId,
        system: clean(input.system || 'commonweave', 60),
        scene: clean(input.scene, 160),
        activity: clean(input.activity, 300),
        updatedAt: now()
      };
      prune();
      persistSoon();
      sendEvent('presence', state.presence[nodeId]);
      return json(res, 200, { ok: true, presence: state.presence[nodeId] });
    }
    if (pathname === '/api/presence' && req.method === 'GET') {
      prune();
      return json(res, 200, { presence: Object.values(state.presence) });
    }

    return json(res, 404, { error: 'Not found.' });
  } catch (error) {
    console.error('[Commonweave] Request failed:', error);
    return json(res, error.status || 500, { error: error.message || 'Request failed.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[Commonweave] ${HUB_NAME} listening on http://${HOST}:${PORT}`);
  console.log(`[Commonweave] Mobile kit ${kitInfo.bytes} bytes ${kitInfo.sha256}`);
});
