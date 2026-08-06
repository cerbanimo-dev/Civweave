import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(rootDir, 'server.mjs');
const runtimePath = path.join(rootDir, '.civweave-server-v130.runtime.mjs');
const VERSION = '1.0.30';
const BUILD = '1.0.30-offline-mesh-cabinet-runtime';
let source = await fsp.readFile(sourcePath, 'utf8');

function replaceRequired(before, after, label) {
  if (!source.includes(before)) throw new Error(`Civweave v1.0.30 patch could not find ${label}`);
  source = source.replace(before, after);
}
replaceRequired("const BUILD_VERSION = '1.0.21-ai-uplift';", `const BUILD_VERSION = '${BUILD}';`, 'host build marker');
replaceRequired("const APP_VERSION = 'rc22.3.20-ai-checkpoint';", `const APP_VERSION = '${VERSION}';`, 'app version marker');
replaceRequired(
  "  ['.md','text/markdown; charset=utf-8'],['.sh','text/x-shellscript; charset=utf-8']",
  "  ['.md','text/markdown; charset=utf-8'],['.sh','text/x-shellscript; charset=utf-8'],['.wasm','application/wasm'],['.onnx','application/octet-stream'],['.map','application/json; charset=utf-8']",
  'model runtime MIME map'
);
source = source.replace("appUrl: `${root}/app/?setup=1&host=${encodeURIComponent(root)}`", "appUrl: `${root}/loom/?setup=1&host=${encodeURIComponent(root)}`");
source = source.replace("appUrl: `${requestOrigin(req, url)}/app/`", "appUrl: `${requestOrigin(req, url)}/loom/`");
const injected = String.raw`
const CW_VERSION = '1.0.30';
const CW_BUILD = '1.0.30-offline-mesh-cabinet-runtime';
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
    schema: 'civweave.boot-log.v1', time: new Date().toISOString(), version: CW_VERSION, build: CW_BUILD,
    kind: String(kind || 'unknown').slice(0, 100), detail: cwSafe(detail),
    request: req ? { method:req.method, url:String(req.url||'').slice(0,1000), userAgent:String(req.headers['user-agent']||'').slice(0,300), referer:String(req.headers.referer||'').slice(0,1000), fetchDest:String(req.headers['sec-fetch-dest']||''), fetchMode:String(req.headers['sec-fetch-mode']||''), cacheControl:String(req.headers['cache-control']||''), serviceWorker:String(req.headers['service-worker']||'') } : null
  };
  cwBootLogs.push(entry); if (cwBootLogs.length > 600) cwBootLogs.splice(0, cwBootLogs.length - 600);
  console.log('[CW-BOOT]', JSON.stringify(entry)); return entry;
}
function cwSend(res, status, text, type, requestId) {
  const payload = Buffer.from(text);
  res.writeHead(status, {'content-type':type,'content-length':payload.length,'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-civweave-version':CW_VERSION,'x-civweave-build':CW_BUILD,'x-civweave-request-id':requestId,'x-content-type-options':'nosniff'});
  res.end(payload);
}
async function cwServeLoom(req, res, originalPathname, requestId) {
  if (originalPathname === '/service-worker.js') {
    const text = await fsp.readFile(path.join(PUBLIC_DIR, 'service-worker.js'), 'utf8');
    const payload = Buffer.from(text);
    res.writeHead(200, {
      'content-type':'application/javascript; charset=utf-8',
      'content-length':payload.length,
      'cache-control':'no-store, no-cache, must-revalidate',
      'pragma':'no-cache',
      'expires':'0',
      'service-worker-allowed':'/',
      'x-civweave-version':CW_VERSION,
      'x-civweave-build':CW_BUILD,
      'x-civweave-request-id':requestId,
      'x-content-type-options':'nosniff'
    });
    res.end(payload);
    return true;
  }
  if (originalPathname === '/loom' || originalPathname === '/loom/' || originalPathname === '/loom/index.html') {
    const text = await fsp.readFile(path.join(PUBLIC_DIR, 'app', 'loom-v128.html'), 'utf8');
    cwLog('loom-index-served', { requestId, bytes:text.length }, req); cwSend(res, 200, text, 'text/html; charset=utf-8', requestId); return true;
  }
  if (/^\/loom\/realm\/(living-school|cerbanimo|fellowfare|anarchadia)\/?$/.test(originalPathname)) {
    const text = await fsp.readFile(path.join(PUBLIC_DIR, 'app', 'realm-v128.html'), 'utf8');
    cwLog('loom-realm-served', { requestId, realm:originalPathname.split('/')[3], bytes:text.length }, req); cwSend(res, 200, text, 'text/html; charset=utf-8', requestId); return true;
  }
  if (originalPathname === '/lite' || originalPathname === '/lite/' || originalPathname === '/lite/index.html') {
    const text = await fsp.readFile(path.join(PUBLIC_DIR, 'app', 'lite-v129.html'), 'utf8');
    cwLog('lite-index-served', { requestId, bytes:text.length }, req); cwSend(res, 200, text, 'text/html; charset=utf-8', requestId); return true;
  }
  const liteSource = originalPathname.match(/^\/lite\/source\/(living-school|cerbanimo|fellowfare|anarchadia)\/?$/);
  if (liteSource) {
    const service = liteSource[1];
    let text = await fsp.readFile(path.join(PUBLIC_DIR, 'app', 'services', service, 'index.html'), 'utf8');
    const injection = '<base href="/app/services/' + service + '/"><script>window.__CIVWEAVE_LITE_SOURCE__=true;document.documentElement.dataset.civweaveSourceSystem=' + JSON.stringify(service) + ';try{if(navigator.serviceWorker)navigator.serviceWorker.register=async()=>({scope:location.origin+"/lite/source-disabled/"})}catch{}</script><link rel="stylesheet" href="/app/lite-source-v129.css?v=1.0.30">';
    text = /<\/head>/i.test(text) ? text.replace(/<\/head>/i, injection + '</head>') : text.replace(/<head([^>]*)>/i, '<head$1>' + injection);
    cwLog('lite-source-served', { requestId, service, bytes:text.length }, req); cwSend(res, 200, text, 'text/html; charset=utf-8', requestId); return true;
  }
  if (originalPathname === '/app/shared/civweave-parity-ledger.json') {
    const { gunzipSync } = await import('node:zlib');
    const encoded = (await Promise.all([1,2,3,4].map(part => fsp.readFile(path.join(PUBLIC_DIR, 'app', 'shared', 'civweave-parity-ledger.part' + part + '.b64'), 'utf8')))).join('').replace(/\s+/g, '');
    const ledger = JSON.parse(gunzipSync(Buffer.from(encoded.trim(), 'base64')).toString('utf8'));
    const shells = JSON.parse(await fsp.readFile(path.join(PUBLIC_DIR, 'app', 'shared', 'cabinet-shells-v129.json'), 'utf8'));
    ledger.version = CW_VERSION;
    for (const system of ledger.systems || []) if (shells.systems?.[system.id]) system.interfaceShell = shells.systems[system.id];
    const text = JSON.stringify(ledger, null, 2);
    cwLog('parity-ledger-served', { requestId, bytes:text.length, cabinetShells:Object.keys(shells.systems||{}).length }, req); cwSend(res, 200, text, 'application/json; charset=utf-8', requestId); return true;
  }
  if (originalPathname === '/loom/version.json' || originalPathname === '/lite/version.json') {
    cwSend(res, 200, JSON.stringify({schema:'civweave.version.v1',version:CW_VERSION,build:CW_BUILD,channel:'offline-first-main',parityLedger:'/app/shared/civweave-parity-ledger.json',updatedAt:new Date().toISOString()},null,2), 'application/json; charset=utf-8', requestId); return true;
  }
  return false;
}
`;
replaceRequired('const server = http.createServer(async (req, res) => {', injected + '\nconst server = http.createServer(async (req, res) => {', 'HTTP server declaration');
replaceRequired(
  '  const pathname = decodeURIComponent(url.pathname);',
  String.raw`  const originalPathname = decodeURIComponent(url.pathname);
  const pathname = originalPathname;
  const requestId = crypto.randomUUID();
  const isTrackedPath = originalPathname === '/loom'
    || originalPathname.startsWith('/loom/')
    || originalPathname === '/lite'
    || originalPathname.startsWith('/lite/')
    || originalPathname === '/app'
    || originalPathname.startsWith('/app/')
    || originalPathname === '/campus'
    || originalPathname.startsWith('/campus/')
    || originalPathname === '/recover.html'
    || originalPathname === '/diagnostics.html'
    || originalPathname.startsWith('/api/boot-log');
  if (isTrackedPath) {
    res.setHeader('x-civweave-version', CW_VERSION); res.setHeader('x-civweave-build', CW_BUILD); res.setHeader('x-civweave-request-id', requestId);
    cwLog('http-request', { requestId, originalPathname }, req);
  }`,
  'request pathname declaration'
);
replaceRequired("    if (pathname.startsWith('/api/')) {", String.raw`    if (pathname.startsWith('/api/')) {
      if (pathname === '/api/boot-log' && req.method === 'POST') { const input = await body(req, 64 * 1024); const entry = cwLog('client:' + String(input.kind || 'event'), {...input,receivedAt:new Date().toISOString(),requestId}, req); return json(res, 202, {ok:true,accepted:entry.time,version:CW_VERSION,build:CW_BUILD}); }
      if (pathname === '/api/boot-logs' && req.method === 'GET') return json(res, 200, {version:CW_VERSION,build:CW_BUILD,count:cwBootLogs.length,logs:cwBootLogs.slice(-300)});`, 'API router');
replaceRequired(
  "    if (await serveFile(req, res, pathname)) return;",
  String.raw`    if (req.method === 'GET' && (originalPathname.startsWith('/app/vendor/transformers/wasm/') || originalPathname.endsWith('.onnx') || originalPathname.includes('.onnx?'))) {
      if (await serveFile(req, res, pathname)) return;
    }
    if (req.method === 'GET' && originalPathname.startsWith('/app/models/')) {
      if (await serveFile(req, res, pathname)) return;
    }
    const citizenConsoleAssets = new Set([
      '/app/anarchadia-console-v139.html',
      '/app/anarchadia-console-v139.css',
      '/app/anarchadia-console-v139.js'
    ]);
    if (req.method === 'GET' && citizenConsoleAssets.has(originalPathname)) {
      if (await serveFile(req, res, pathname)) return;
    }
    if (req.method === 'GET' && (originalPathname === '/app' || originalPathname.startsWith('/app/') || originalPathname === '/campus' || originalPathname.startsWith('/campus/'))) {
      const isAsset = /\.(?:png|jpe?g|webp|svg|gif|avif|css|js|json|webmanifest|woff2?)$/i.test(originalPathname);
      if (!isAsset) { cwLog('legacy-route-redirected', {requestId,from:originalPathname,to:'/loom/'}, req); res.writeHead(302,{location:'/loom/','cache-control':'no-store','x-civweave-version':CW_VERSION,'x-civweave-build':CW_BUILD}); return res.end(); }
    }
    if (req.method === 'GET' && await cwServeLoom(req, res, originalPathname, requestId)) return;
    if (await serveFile(req, res, pathname)) return;`,
  'static file router'
);

// String.raw preserves backslashes exactly. Normalize regular expressions emitted
// into the generated runtime so they contain one escape, not two.
source = source.replace("/^\\\\/loom\\\\/realm\\\\/(living-school|cerbanimo|fellowfare|anarchadia)\\\\/?$/", "/^\\/loom\\/realm\\/(living-school|cerbanimo|fellowfare|anarchadia)\\/?$/");
source = source.replace("/\\\\.(?:png|jpe?g|webp|svg|gif|avif|css|js|json|webmanifest|woff2?)$/i", "/\\.(?:png|jpe?g|webp|svg|gif|avif|css|js|json|webmanifest|woff2?)$/i");

await fsp.writeFile(runtimePath, source, 'utf8');
try { await import(pathToFileURL(runtimePath).href + '?build=' + VERSION); }
finally { setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.(); }
