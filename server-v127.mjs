import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(rootDir, 'server.mjs');
const runtimePath = path.join(rootDir, '.commonweave-server-v127.runtime.mjs');
const VERSION = '1.0.27';
const BUILD = '1.0.27-clean-slate-shell';
let source = await fsp.readFile(sourcePath, 'utf8');

function replaceRequired(before, after, label) {
  if (!source.includes(before)) throw new Error(`Commonweave v1.0.27 patch could not find ${label}`);
  source = source.replace(before, after);
}
replaceRequired("const BUILD_VERSION = '1.0.21-ai-uplift';", `const BUILD_VERSION = '${BUILD}';`, 'host build marker');
replaceRequired("const APP_VERSION = 'rc22.3.20-ai-checkpoint';", `const APP_VERSION = '${VERSION}';`, 'app version marker');
source = source.replace("appUrl: `${root}/app/?setup=1&host=${encodeURIComponent(root)}`", "appUrl: `${root}/loom/?setup=1&host=${encodeURIComponent(root)}`");
source = source.replace("appUrl: `${requestOrigin(req, url)}/app/`", "appUrl: `${requestOrigin(req, url)}/loom/`");

const injected = String.raw`
const CW_VERSION = '1.0.27';
const CW_BUILD = '1.0.27-clean-slate-shell';
const cwBootLogs = [];
function cwSafe(value, depth = 0) {
  if (depth > 4) return '[depth-limit]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 1200);
  if (Array.isArray(value)) return value.slice(0, 40).map(item => cwSafe(item, depth + 1));
  if (typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 60)) {
      if (/key|token|secret|prompt|message|content/i.test(key)) continue;
      output[key] = cwSafe(item, depth + 1);
    }
    return output;
  }
  return String(value).slice(0, 1200);
}
function cwLog(kind, detail = {}, req = null) {
  const entry = {
    schema: 'commonweave.boot-log.v1', time: new Date().toISOString(), version: CW_VERSION, build: CW_BUILD,
    kind: String(kind || 'unknown').slice(0, 100), detail: cwSafe(detail),
    request: req ? { method:req.method, url:String(req.url||'').slice(0,1000), userAgent:String(req.headers['user-agent']||'').slice(0,300), referer:String(req.headers.referer||'').slice(0,1000), fetchDest:String(req.headers['sec-fetch-dest']||''), fetchMode:String(req.headers['sec-fetch-mode']||''), cacheControl:String(req.headers['cache-control']||''), serviceWorker:String(req.headers['service-worker']||'') } : null
  };
  cwBootLogs.push(entry); if (cwBootLogs.length > 600) cwBootLogs.splice(0, cwBootLogs.length - 600);
  console.log('[CW-BOOT]', JSON.stringify(entry)); return entry;
}
function cwSend(res, status, text, type, requestId) {
  const payload = Buffer.from(text);
  res.writeHead(status, {'content-type':type,'content-length':payload.length,'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-commonweave-version':CW_VERSION,'x-commonweave-build':CW_BUILD,'x-commonweave-request-id':requestId,'x-content-type-options':'nosniff'});
  res.end(payload);
}
async function cwServeLoom(req, res, originalPathname, requestId) {
  if (originalPathname === '/loom' || originalPathname === '/loom/' || originalPathname === '/loom/index.html') {
    const text = await fsp.readFile(path.join(PUBLIC_DIR, 'app', 'loom-v127.html'), 'utf8');
    cwLog('loom-index-served', { requestId, bytes:text.length }, req); cwSend(res, 200, text, 'text/html; charset=utf-8', requestId); return true;
  }
  if (/^\/loom\/realm\/(living-school|cerbanimo|fellowfare|anarchadia)\/?$/.test(originalPathname)) {
    const text = await fsp.readFile(path.join(PUBLIC_DIR, 'app', 'realm-v127.html'), 'utf8');
    cwLog('loom-realm-served', { requestId, realm:originalPathname.split('/')[3], bytes:text.length }, req); cwSend(res, 200, text, 'text/html; charset=utf-8', requestId); return true;
  }
  if (originalPathname === '/loom/version.json') {
    cwSend(res, 200, JSON.stringify({schema:'commonweave.version.v1',version:CW_VERSION,build:CW_BUILD,channel:'main',updatedAt:new Date().toISOString()},null,2), 'application/json; charset=utf-8', requestId); return true;
  }
  return false;
}
`;
replaceRequired('const server = http.createServer(async (req, res) => {', injected + '\nconst server = http.createServer(async (req, res) => {', 'HTTP server declaration');
replaceRequired('  const pathname = decodeURIComponent(url.pathname);', `  const originalPathname = decodeURIComponent(url.pathname);
  const pathname = originalPathname;
  const requestId = crypto.randomUUID();
  if (/^\/(?:loom|app|campus)(?:\/|$)/.test(originalPathname) || originalPathname === '/recover.html' || originalPathname === '/diagnostics.html' || originalPathname.startsWith('/api/boot-log')) {
    res.setHeader('x-commonweave-version', CW_VERSION); res.setHeader('x-commonweave-build', CW_BUILD); res.setHeader('x-commonweave-request-id', requestId);
    cwLog('http-request', { requestId, originalPathname }, req);
  }`, 'request pathname declaration');
replaceRequired("    if (pathname.startsWith('/api/')) {", `    if (pathname.startsWith('/api/')) {
      if (pathname === '/api/boot-log' && req.method === 'POST') { const input = await body(req, 64 * 1024); const entry = cwLog('client:' + String(input.kind || 'event'), {...input,receivedAt:new Date().toISOString(),requestId}, req); return json(res, 202, {ok:true,accepted:entry.time,version:CW_VERSION,build:CW_BUILD}); }
      if (pathname === '/api/boot-logs' && req.method === 'GET') return json(res, 200, {version:CW_VERSION,build:CW_BUILD,count:cwBootLogs.length,logs:cwBootLogs.slice(-300)});`, 'API router');
replaceRequired("    if (await serveFile(req, res, pathname)) return;", `    if (req.method === 'GET' && (originalPathname === '/app' || originalPathname.startsWith('/app/') || originalPathname === '/campus' || originalPathname.startsWith('/campus/'))) {
      const isAsset = /\.(?:png|jpe?g|webp|svg|gif|avif|css|js|json|webmanifest|woff2?)$/i.test(originalPathname);
      if (!isAsset) { cwLog('legacy-route-redirected', {requestId,from:originalPathname,to:'/loom/'}, req); res.writeHead(302,{location:'/loom/','cache-control':'no-store','x-commonweave-version':CW_VERSION,'x-commonweave-build':CW_BUILD}); return res.end(); }
    }
    if (req.method === 'GET' && await cwServeLoom(req, res, originalPathname, requestId)) return;
    if (await serveFile(req, res, pathname)) return;`, 'static file router');

await fsp.writeFile(runtimePath, source, 'utf8');
try { await import(pathToFileURL(runtimePath).href + '?build=' + VERSION); }
finally { setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.(); }
