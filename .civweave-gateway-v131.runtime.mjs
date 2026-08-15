import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { AiWalletService } from './lib/ai-wallet-service-v1.mjs';
import { createAiWalletHttpHandler } from './lib/ai-wallet-http-v1.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.resolve(__dirname, process.env.DATA_DIR || './data');
const STATE_FILE = path.join(DATA_DIR, 'host-node-state.json');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const HUB_NAME = process.env.HUB_NAME || 'Civweave Host Node';
const HUB_TOKEN = String(process.env.HUB_TOKEN || '').trim();
const MAX_ENVELOPES = Math.max(100, Number(process.env.MAX_ENVELOPES || 5000));
const STARTED_AT = new Date().toISOString();
const BUILD_VERSION = '1.0.132-install-only-fullscreen-family-gateway';
const APP_VERSION = '1.0.132';
const DEFAULT_PUBLIC_HOST = process.env.PUBLIC_HOST_URL || 'https://civweave-host-node.onrender.com';
const CIVWEAVE_SOURCE_URL = process.env.CIVWEAVE_SOURCE_URL || 'https://github.com/cerbanimo-dev/Civweave';
const CIVWEAVE_RELEASE_URL = process.env.CIVWEAVE_RELEASE_URL || 'https://github.com/cerbanimo-dev/Civweave/archive/refs/heads/main.zip';
const CIVWEAVE_INSTALL_ORIGIN = process.env.CIVWEAVE_INSTALL_ORIGIN || 'https://civweave.pages.dev';
const INSTALL_KIT_PATH = path.join(PUBLIC_DIR, 'downloads', 'Civweave-Mobile-Install-Kit.zip');
const CAMPUS_SEED_PATH = path.join(PUBLIC_DIR, 'downloads', 'civweave-pocket-campus.cwseed');
const sseClients = new Set();
const installKitSha256 = '';
const installKitSize = 0;
function releasePacket(baseUrl = DEFAULT_PUBLIC_HOST) {
  const root = String(baseUrl || DEFAULT_PUBLIC_HOST).replace(/\/$/, '');
  return {
    schema: 'civweave.release.v1', channel: 'stable', hostBuild: BUILD_VERSION, appVersion: APP_VERSION,
    releasedAt: STARTED_AT, appUrl: CIVWEAVE_INSTALL_ORIGIN, installUrl: CIVWEAVE_INSTALL_ORIGIN, sourceUrl: CIVWEAVE_SOURCE_URL,
    downloadUrl: CIVWEAVE_RELEASE_URL, sha256: '', bytes: 0, mandatory: false, localInstallRequired: true,
    notes: 'The public origin distributes the Civweave v1.0.132 fixed-settings-layer device package.'
  };
}

const state = {
  version: 1,
  nodes: {},
  envelopes: [],
  presence: {},
  createdAt: STARTED_AT,
  updatedAt: STARTED_AT
};
let persistTimer = null;

await fsp.mkdir(DATA_DIR, { recursive: true });
try {
  const saved = JSON.parse(await fsp.readFile(STATE_FILE, 'utf8'));
  if (saved && typeof saved === 'object') Object.assign(state, saved);
} catch (error) {
  if (error.code !== 'ENOENT') console.warn('State restore skipped:', error.message);
}

const AI_WALLET_REQUESTED = process.env.NODE_AI_MARKETPLACE_ENABLED === '1' || process.env.AI_WALLET_ENABLED === '1';
const AI_WALLET_CAPABILITY_SECRET = String(process.env.NODE_AI_CAPABILITY_SECRET || process.env.AI_WALLET_CAPABILITY_SECRET || '').trim();
const AI_WALLET_AUTH_SECRET = String(process.env.NODE_AI_AUTH_SECRET || process.env.AI_WALLET_AUTH_SECRET || '').trim();
const AI_WALLET_PAYMENT_SECRET = String(process.env.NODE_AI_PAYMENT_WEBHOOK_SECRET || process.env.AI_WALLET_PAYMENT_SECRET || '').trim();
const AI_WALLET_INTERNAL_SECRET = String(process.env.NODE_AI_INTERNAL_SECRET || process.env.AI_WALLET_INTERNAL_SECRET || '').trim();
let aiWalletService = null;
if (AI_WALLET_REQUESTED) {
  try {
    aiWalletService = await new AiWalletService({
      databasePath: process.env.NODE_AI_LEDGER_PATH || path.join(DATA_DIR, 'node-ai-ledger-v1.sqlite'),
      nodeId: process.env.NODE_AI_NODE_ID,
      operatorId: process.env.NODE_AI_OPERATOR_ID,
      platformFeeBps: process.env.NODE_AI_PLATFORM_FEE_BPS
    }).load();
  } catch (error) {
    console.error('[Civweave] Node AI marketplace stayed disabled:', error.message);
  }
}
const aiWalletHttp = createAiWalletHttpHandler({
  walletService: aiWalletService,
  requested: AI_WALLET_REQUESTED,
  authSecret: AI_WALLET_AUTH_SECRET,
  paymentSecret: AI_WALLET_PAYMENT_SECRET,
  internalSecret: AI_WALLET_INTERNAL_SECRET,
  capabilitySecret: AI_WALLET_CAPABILITY_SECRET
});


function requestOrigin(req, url) {
  const forwarded = cleanText(req.headers['x-forwarded-proto'], 20).split(',')[0].trim();
  const protocol = forwarded === 'https' ? 'https:' : forwarded === 'http' ? 'http:' : url.protocol;
  const host = cleanText(req.headers['x-forwarded-host'] || req.headers.host || url.host, 300).split(',')[0].trim();
  if (host === 'civweave-host-node.onrender.com') return 'https://civweave-host-node.onrender.com';
  return `${protocol}//${host}`;
}

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}:${crypto.randomUUID()}`; }
function cleanText(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function json(res, status, body, headers = {}) {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': payload.length,
    'cache-control': 'no-store',
    ...headers
  });
  res.end(payload);
}
function schedulePersist() {
  state.updatedAt = now();
  clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    const tmp = `${STATE_FILE}.tmp`;
    try {
      await fsp.writeFile(tmp, JSON.stringify(state, null, 2));
      await fsp.rename(tmp, STATE_FILE);
    } catch (error) {
      console.error('State persistence failed:', error.message);
    }
  }, 150);
}
function emit(type, data) {
  const packet = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) client.write(packet);
}
function bearer(req) {
  const header = String(req.headers.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}
function authorized(req) {
  return !HUB_TOKEN || bearer(req) === HUB_TOKEN || req.headers['x-civweave-hub-token'] === HUB_TOKEN;
}
async function body(req, limit = 512 * 1024) {
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
  if (state.envelopes.length > MAX_ENVELOPES) state.envelopes.splice(0, state.envelopes.length - MAX_ENVELOPES);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, entry] of Object.entries(state.presence)) {
    if (Date.parse(entry.updatedAt || 0) < cutoff) delete state.presence[key];
  }
}


const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_PROXY_TIMEOUT_MS = Math.max(30000, Number(process.env.GEMINI_PROXY_TIMEOUT_MS || 300000));

function forwardHeaders(source) {
  const headers = {
    'content-type': source.headers.get('content-type') || 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  };
  const requestId = source.headers.get('x-request-id') || source.headers.get('x-goog-request-id');
  if (requestId) headers['x-upstream-request-id'] = requestId;
  return headers;
}

async function proxyGeminiInteraction(req, res, pathname) {
  const key = cleanText(req.headers['x-goog-api-key'], 500);
  if (!key) return json(res, 400, { error: 'A session-only Gemini API key is required.' });
  const suffix = pathname.slice('/api/ai/gemini/interactions'.length);
  if (suffix && !/^\/[A-Za-z0-9_:.~-]+$/.test(suffix)) return json(res, 400, { error: 'Invalid interaction ID.' });
  if (!['GET','POST','DELETE'].includes(req.method || '')) return json(res, 405, { error: 'Method not allowed.' });
  const upstream = `${GEMINI_API_BASE}/interactions${suffix}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_PROXY_TIMEOUT_MS);
  try {
    const init = {
      method: req.method,
      headers: { 'x-goog-api-key': key, 'accept': 'application/json' },
      signal: controller.signal
    };
    if (req.method === 'POST') {
      const payload = await body(req, 4 * 1024 * 1024);
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(payload);
    }
    const upstreamResponse = await fetch(upstream, init);
    const bytes = Buffer.from(await upstreamResponse.arrayBuffer());
    res.writeHead(upstreamResponse.status, { ...forwardHeaders(upstreamResponse), 'content-length': bytes.length });
    res.end(bytes);
  } catch (error) {
    if (error?.name === 'AbortError') return json(res, 504, { error: 'Gemini agent request timed out at the host node.' });
    return json(res, 502, { error: `Gemini agent proxy failed: ${error.message || 'upstream unavailable'}` });
  } finally {
    clearTimeout(timer);
  }
}

const MIME = new Map([
  ['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.mjs','text/javascript; charset=utf-8'],
  ['.css','text/css; charset=utf-8'],['.json','application/json; charset=utf-8'],['.webmanifest','application/manifest+json'],
  ['.png','image/png'],['.jpg','image/jpeg'],['.jpeg','image/jpeg'],['.webp','image/webp'],['.svg','image/svg+xml'],
  ['.zip','application/zip'],['.cwseed','application/zip'],['.woff2','font/woff2'],['.txt','text/plain; charset=utf-8'],
  ['.md','text/markdown; charset=utf-8'],['.sh','text/x-shellscript; charset=utf-8']
]);
async function serveFile(req, res, pathname) {
  let relative = pathname === '/' ? '/index.html' : pathname;
  const safe = path.normalize(relative).replace(/^(\.\.[/\\])+/, '');
  let target = path.join(PUBLIC_DIR, safe);
  if (!target.startsWith(PUBLIC_DIR)) return false;
  try {
    const stat = await fsp.stat(target);
    if (stat.isDirectory()) target = path.join(target, 'index.html');
    const finalStat = await fsp.stat(target);
    const ext = path.extname(target).toLowerCase();
    const range = req.headers.range;
    const headers = {
      'content-type': MIME.get(ext) || 'application/octet-stream',
      'accept-ranges': 'bytes',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'same-origin',
      'cross-origin-resource-policy': 'same-origin'
    };
    if (target.includes(`${path.sep}downloads${path.sep}`)) headers['content-disposition'] = `attachment; filename="${path.basename(target)}"`;
    // Stable asset URLs must revalidate after deploys. Only content-hashed
    // filenames are safe to keep immutable across visual releases.
    const fingerprinted = /[.-][a-f0-9]{8,}[.-]/i.test(path.basename(target));
    if (fingerprinted) headers['cache-control'] = 'public, max-age=31536000, immutable';
    else if (target.includes(`${path.sep}downloads${path.sep}`)) headers['cache-control'] = 'no-store';
    else headers['cache-control'] = 'no-cache, must-revalidate';
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) return json(res, 416, { error: 'Invalid range' });
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : finalStat.size - 1;
      if (start > end || end >= finalStat.size) return json(res, 416, { error: 'Range not satisfiable' });
      res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${finalStat.size}`, 'content-length': end - start + 1 });
      fs.createReadStream(target, { start, end }).pipe(res);
      return true;
    }
    res.writeHead(200, { ...headers, 'content-length': finalStat.size });
    fs.createReadStream(target).pipe(res);
    return true;
  } catch { return false; }
}

const server = http.createServer(async (req, res) => {
  const base = `http://${req.headers.host || 'localhost'}`;
  const url = new URL(req.url || '/', base);
  const pathname = decodeURIComponent(url.pathname);
  const gatewayRequest = req.method === 'GET' || req.method === 'HEAD';
  const packageInstall = Boolean(String(req.headers['x-civweave-package'] || '').trim());
  const installerSurface = pathname === '/'
    || pathname === '/index.html'
    || pathname === '/install-v130.js'
    || pathname === '/install-v130.css'
    || pathname === '/service-worker.js'
    || pathname === '/service-worker-v156.js'
    || pathname === '/service-worker-v203.js'
    || pathname === '/app/manifest.webmanifest'
    || pathname === '/app/logos/civweave.webp'
    || pathname === '/app/logos/civweave-app-icon.png'
    || pathname === '/app/logos/civweave-icon-192.png'
    || pathname === '/app/logos/civweave-icon-512.png'
    || pathname === '/app/logos/civweave-icon-maskable-192.png'
    || pathname === '/app/logos/civweave-icon-maskable-512.png'
    || pathname === '/app/knowledge-school-seeds-v1.js'
    || pathname === '/app/knowledge-school-installer-v1.js'
    || pathname === '/app/knowledge-school-installer-v1.css'
    || pathname === '/app/offline-package-v208.json'
    || pathname === '/app/offline-campus-status-v210.js'
    || pathname === '/app/pwa-update-controller-v204.js';
  const applicationSurface = pathname === '/offline.html'
    || pathname === '/app'
    || pathname.startsWith('/app/')
    || pathname === '/loom'
    || pathname.startsWith('/loom/')
    || pathname === '/lite'
    || pathname.startsWith('/lite/')
    || pathname === '/cabinetonly'
    || pathname.startsWith('/cabinetonly/')
    || pathname === '/campus'
    || pathname.startsWith('/campus/');
  if (gatewayRequest && packageInstall && pathname === '/app/shared/civweave-parity-ledger.json') {
    try {
      const { gunzipSync } = await import('node:zlib');
      const sharedDir = path.join(PUBLIC_DIR, 'app', 'shared');
      const encoded = (await Promise.all([1,2,3,4].map(part => fsp.readFile(path.join(sharedDir,'civweave-parity-ledger.part'+part+'.b64'),'utf8')))).join('').replace(/\s+/g,'');
      const ledger = JSON.parse(gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'));
      const payload = Buffer.from(JSON.stringify(ledger));
      res.writeHead(200,{'content-type':'application/json; charset=utf-8','content-length':payload.length,'cache-control':'public, max-age=31536000, immutable','x-civweave-device-package':'parity-ledger','x-civweave-software-family':'1.0.7'});
      return res.end(req.method === 'HEAD' ? undefined : payload);
    } catch (error) { console.error('[Civweave] Unable to reconstruct parity ledger:',error); return json(res,500,{error:'The Civweave capability ledger could not be reconstructed for this device package.'}); }
  }
  if (gatewayRequest && packageInstall && (pathname === '/loom' || pathname === '/loom/' || pathname === '/loom/index.html' || pathname === '/lite' || pathname === '/lite/' || pathname === '/lite/index.html' || pathname === '/cabinetonly' || pathname === '/cabinetonly/' || pathname === '/cabinetonly/index.html')) {
    if (await serveFile(req,res,'/app/fullscreen-family-v104.html')) return;
    return json(res,404,{error:'The full-screen Civweave family entry is missing from this device package.'});
  }
  const knowledgeSchoolDownload = pathname === '/downloads/knowledge-schools' || pathname.startsWith('/downloads/knowledge-schools/');
  if (gatewayRequest && !knowledgeSchoolDownload && (pathname === '/field/civweave/seed' || pathname === '/downloads' || pathname.startsWith('/downloads/'))) { res.writeHead(302,{location:CIVWEAVE_RELEASE_URL,'cache-control':'no-store'}); return res.end(); }
  if (gatewayRequest && applicationSurface && !installerSurface && !packageInstall && pathname !== '/app' && !pathname.startsWith('/app/')) { return json(res,410,{error:'Installed runtime required',localInstallRequired:true,installUrl:CIVWEAVE_INSTALL_ORIGIN,sourceUrl:CIVWEAVE_SOURCE_URL,releaseUrl:CIVWEAVE_RELEASE_URL,message:'This public origin distributes the complete device package but does not run the Civweave software family in browser mode.'}); }
  if (pathname === '/api/boot-log' || pathname === '/api/boot-logs') { res.writeHead(204,{'cache-control':'no-store'}); return res.end(); }
  try {
    if ((pathname === '/field/civweave/seed' || pathname === '/downloads/civweave-pocket-campus.cwseed') && req.method === 'GET') {
      const served = await serveFile(req, res, '/downloads/civweave-pocket-campus.cwseed');
      if (served) return;
      return json(res, 404, { error: 'Civweave campus seed is not available on this host node.' });
    }
    if (pathname.startsWith('/api/')) {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization, x-civweave-hub-token, x-civweave-ai-capability, x-civweave-internal-secret, x-civweave-payment-signature', 'access-control-allow-methods': 'GET,POST,OPTIONS' });
        return res.end();
      }
      res.setHeader('access-control-allow-origin', '*');
      if (pathname === '/api/finder-status' && req.method === 'GET') {
        const manifest = aiWalletService?.manifest || null;
        const sanitizeLocation = value => { const lat = Number(value?.lat ?? value?.latitude), lon = Number(value?.lon ?? value?.longitude); return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 ? { lat, lon } : null; };
        const ownLocation = sanitizeLocation(manifest?.metadata?.publicLocation);
        const peers = Object.values(state.nodes).map(node => { const publicRecord = publicNode(node); const publicLocation = sanitizeLocation(node?.metadata?.publicLocation); return publicLocation ? { ...publicRecord, publicLocation } : publicRecord; });
        const capabilities = [...new Set(['node-ai-marketplace', ...(manifest?.services || []).flatMap(service => Array.isArray(service.capabilities) ? service.capabilities : [])])];
        return json(res, 200, { schema:'civweave.finder-status.v1', observedAt:now(), node:{ nodeId:manifest?.nodeId || 'host-node', label:manifest?.displayName || HUB_NAME, system:'civweave', capabilities, endpoint:requestOrigin(req,url), ...(ownLocation ? { publicLocation:ownLocation } : {}), online:true, firstSeenAt:STARTED_AT, lastSeenAt:now() }, peers });
      }
      if (await aiWalletHttp.handle(req, res, url)) return;
      if (!authorized(req) && !['/api/health','/api/config','/api/releases/current','/api/events'].includes(pathname)) return json(res, 401, { error: 'Host node token required' });
      if (pathname === '/api/ai/gemini/interactions' || pathname.startsWith('/api/ai/gemini/interactions/')) return proxyGeminiInteraction(req, res, pathname);
      if (pathname === '/api/health' && req.method === 'GET') {
        return json(res, 200, { ok: true, name: HUB_NAME, build: BUILD_VERSION, appVersion: APP_VERSION, defaultHost: DEFAULT_PUBLIC_HOST, release: releasePacket(requestOrigin(req, url)), startedAt: STARTED_AT, now: now(), nodes: Object.keys(state.nodes).length, envelopes: state.envelopes.length, persistence: STATE_FILE, aiWallet: aiWalletHttp.status() });
      }
      if (pathname === '/api/config' && req.method === 'GET') {
        return json(res, 200, { schema: 'civweave.host-node-config.v1', name: HUB_NAME, build: BUILD_VERSION, appVersion: APP_VERSION, defaultHost: DEFAULT_PUBLIC_HOST, baseUrl: requestOrigin(req, url), apiBase: `${requestOrigin(req, url)}/api`, appUrl: CIVWEAVE_INSTALL_ORIGIN, installUrl: CIVWEAVE_INSTALL_ORIGIN, sourceUrl: CIVWEAVE_SOURCE_URL, downloadUrl: CIVWEAVE_RELEASE_URL, seedUrl: null, release: releasePacket(requestOrigin(req, url)), tokenRequired: Boolean(HUB_TOKEN), features: ['install-only-pwa','device-package-distribution','fullscreen-software-family','node-registration','heartbeat','relay-envelopes','presence','sse-events','release-broadcasts','release-advertising','node-ai-marketplace-v1','federation-finder','node-ai-operator-status'], aiWallet: aiWalletHttp.status() });
      }
      if (pathname === '/api/releases/current' && req.method === 'GET') {
        return json(res, 200, releasePacket(requestOrigin(req, url)));
      }
      if (pathname === '/api/releases/broadcast' && req.method === 'POST') {
        const packet = releasePacket(requestOrigin(req, url));
        emit('release', packet);
        return json(res, 200, { ok: true, release: packet, listeners: sseClients.size });
      }
      if (pathname === '/api/events' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        const release = releasePacket(requestOrigin(req, url));
        res.write(`event: ready
data: ${JSON.stringify({ now: now(), name: HUB_NAME, release })}

`);
        res.write(`event: release
data: ${JSON.stringify(release)}

`);
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
        return;
      }
      if (pathname === '/api/nodes/register' && req.method === 'POST') {
        const input = await body(req);
        const nodeId = cleanText(input.nodeId, 160) || id('node');
        const existing = state.nodes[nodeId];
        const node = state.nodes[nodeId] = {
          nodeId,
          label: cleanText(input.label || input.displayName || 'Civweave node', 120),
          system: cleanText(input.system || 'civweave', 80),
          capabilities: Array.isArray(input.capabilities) ? input.capabilities.map(x => cleanText(x, 80)).filter(Boolean).slice(0, 32) : [],
          metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
          firstSeenAt: existing?.firstSeenAt || now(),
          lastSeenAt: now()
        };
        schedulePersist(); emit('node', publicNode(node));
        return json(res, 200, { ok: true, node: publicNode(node), hub: HUB_NAME, release: releasePacket(requestOrigin(req, url)) });
      }
      if (pathname === '/api/nodes/heartbeat' && req.method === 'POST') {
        const input = await body(req);
        const nodeId = cleanText(input.nodeId, 160);
        if (!nodeId || !state.nodes[nodeId]) return json(res, 404, { error: 'Node is not registered' });
        state.nodes[nodeId].lastSeenAt = now(); schedulePersist();
        return json(res, 200, { ok: true, now: now() });
      }
      if (pathname === '/api/nodes' && req.method === 'GET') return json(res, 200, { nodes: Object.values(state.nodes).map(publicNode) });
      if (pathname === '/api/envelopes' && req.method === 'POST') {
        const input = await body(req);
        const envelope = {
          id: id('env'),
          schema: cleanText(input.schema || 'civweave.relay-envelope.v1', 100),
          from: cleanText(input.from, 160),
          to: cleanText(input.to || '*', 160),
          kind: cleanText(input.kind || 'message', 100),
          subject: cleanText(input.subject || '', 240),
          payload: input.payload ?? null,
          correlationId: cleanText(input.correlationId || '', 160),
          createdAt: now(),
          acknowledgements: []
        };
        if (!envelope.from) return json(res, 400, { error: 'Envelope requires from node ID' });
        state.envelopes.push(envelope); prune(); schedulePersist(); emit('envelope', { ...envelope, payload: undefined });
        return json(res, 201, { ok: true, envelope });
      }
      if (pathname === '/api/envelopes' && req.method === 'GET') {
        const nodeId = cleanText(url.searchParams.get('nodeId'), 160);
        const cursor = cleanText(url.searchParams.get('cursor'), 160);
        const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 50)));
        let rows = state.envelopes.filter(item => !nodeId || item.to === '*' || item.to === nodeId || item.from === nodeId);
        if (cursor) { const index = rows.findIndex(item => item.id === cursor); if (index >= 0) rows = rows.slice(index + 1); }
        rows = rows.slice(-limit);
        return json(res, 200, { envelopes: rows, cursor: rows.at(-1)?.id || cursor || null });
      }
      const ackMatch = /^\/api\/envelopes\/([^/]+)\/ack$/.exec(pathname);
      if (ackMatch && req.method === 'POST') {
        const input = await body(req);
        const envelope = state.envelopes.find(item => item.id === ackMatch[1]);
        if (!envelope) return json(res, 404, { error: 'Envelope not found' });
        const nodeId = cleanText(input.nodeId, 160);
        if (!nodeId) return json(res, 400, { error: 'nodeId required' });
        if (!envelope.acknowledgements.includes(nodeId)) envelope.acknowledgements.push(nodeId);
        schedulePersist(); return json(res, 200, { ok: true, envelopeId: envelope.id });
      }
      if (pathname === '/api/presence' && req.method === 'POST') {
        const input = await body(req);
        const nodeId = cleanText(input.nodeId, 160);
        if (!nodeId) return json(res, 400, { error: 'nodeId required' });
        state.presence[nodeId] = { nodeId, scene: cleanText(input.scene, 120), system: cleanText(input.system || 'civweave', 80), activity: cleanText(input.activity, 240), visibility: cleanText(input.visibility || 'node', 40), updatedAt: now() };
        prune(); schedulePersist(); emit('presence', state.presence[nodeId]);
        return json(res, 200, { ok: true, presence: state.presence[nodeId] });
      }
      if (pathname === '/api/presence' && req.method === 'GET') return json(res, 200, { presence: Object.values(state.presence) });
      return json(res, 404, { error: 'API route not found' });
    }
    if (pathname === '/favicon.ico') { res.writeHead(302, { location: '/app/logos/civweave-icon-192.png', 'cache-control': 'public, max-age=86400' }); return res.end(); }
    if (await serveFile(req, res, pathname)) return;
    json(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    json(res, error.status || 500, { error: error.message || 'Server error' });
  }
});

server.listen(PORT, HOST, () => console.log(`${HUB_NAME} listening on http://${HOST}:${PORT}`));

async function shutdown(signal) {
  console.log(`${signal}: closing host node`);
  server.close();
  clearTimeout(persistTimer);
  try { await fsp.writeFile(STATE_FILE, JSON.stringify(state, null, 2)); } catch {}
  try { await aiWalletService?.flush?.(); } catch {}
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
