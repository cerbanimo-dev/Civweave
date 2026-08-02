import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(root, 'server.mjs');
const runtimePath = path.join(root, '.commonweave-server-v126.runtime.mjs');
const VERSION = '1.0.26';
const BUILD = '1.0.26-loop-diagnostics';

let source = await fsp.readFile(sourcePath, 'utf8');
function replaceRequired(before, after, label) {
  if (!source.includes(before)) throw new Error('Commonweave v1.0.26 patch could not find ' + label);
  source = source.replace(before, after);
}
replaceRequired("const BUILD_VERSION = '1.0.21-ai-uplift';", "const BUILD_VERSION = '" + BUILD + "';", 'the host build marker');
replaceRequired("const APP_VERSION = 'rc22.3.20-ai-checkpoint';", "const APP_VERSION = '" + VERSION + "';", 'the app version marker');
source = source.replace("appUrl: `${root}/app/?setup=1&host=${encodeURIComponent(root)}`", "appUrl: `${root}/campus/?setup=1&host=${encodeURIComponent(root)}`");
source = source.replace("appUrl: `${requestOrigin(req, url)}/app/`", "appUrl: `${requestOrigin(req, url)}/campus/`");

const injected = String.raw`
const CW_DIAGNOSTIC_VERSION = '1.0.26';
const CW_DIAGNOSTIC_BUILD = '1.0.26-loop-diagnostics';
const cwBootLogs = [];
function cwBootSafe(value, depth = 0) {
  if (depth > 4) return '[depth-limit]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 1200);
  if (Array.isArray(value)) return value.slice(0, 30).map(item => cwBootSafe(item, depth + 1));
  if (typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 50)) {
      if (/key|token|secret|prompt|message|content/i.test(key)) continue;
      output[key] = cwBootSafe(item, depth + 1);
    }
    return output;
  }
  return String(value).slice(0, 1200);
}
function cwBootLog(kind, detail = {}, req = null) {
  const entry = {
    schema: 'commonweave.boot-log.v1',
    time: new Date().toISOString(),
    version: CW_DIAGNOSTIC_VERSION,
    build: CW_DIAGNOSTIC_BUILD,
    kind: String(kind || 'unknown').slice(0, 100),
    detail: cwBootSafe(detail),
    request: req ? {
      method: req.method,
      url: String(req.url || '').slice(0, 1000),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
      referer: String(req.headers.referer || '').slice(0, 1000),
      fetchDest: String(req.headers['sec-fetch-dest'] || ''),
      fetchMode: String(req.headers['sec-fetch-mode'] || ''),
      cacheControl: String(req.headers['cache-control'] || ''),
      serviceWorker: String(req.headers['service-worker'] || '')
    } : null
  };
  cwBootLogs.push(entry);
  if (cwBootLogs.length > 1000) cwBootLogs.splice(0, cwBootLogs.length - 1000);
  console.log('[CW-BOOT]', JSON.stringify(entry));
  return entry;
}
function cwSendText(res, status, text, type, requestId) {
  const payload = Buffer.from(text);
  res.writeHead(status, {
    'content-type': type,
    'content-length': payload.length,
    'cache-control': 'no-store, no-cache, must-revalidate',
    'pragma': 'no-cache',
    'expires': '0',
    'x-commonweave-version': CW_DIAGNOSTIC_VERSION,
    'x-commonweave-build': CW_DIAGNOSTIC_BUILD,
    'x-commonweave-request-id': requestId,
    'x-content-type-options': 'nosniff'
  });
  res.end(payload);
}
async function cwServeCampus(req, res, originalPathname, requestId) {
  let mapped = originalPathname.replace(/^\/campus(?=\/|$)/, '/app');
  if (mapped === '/app') mapped = '/app/';
  if (mapped === '/app/' || mapped === '/app/index.html') {
    let text = await fsp.readFile(path.join(PUBLIC_DIR, 'app', 'index.html'), 'utf8');
    text = text.replaceAll('1.0.21-ai-uplift', CW_DIAGNOSTIC_BUILD)
      .replaceAll('1.0.25-freeze-recovery', CW_DIAGNOSTIC_BUILD)
      .replaceAll('rc22.3.20-ai-checkpoint', CW_DIAGNOSTIC_VERSION)
      .replaceAll('HOST v1.0.21', 'HOST v' + CW_DIAGNOSTIC_VERSION)
      .replaceAll('HOST v1.0.25', 'HOST v' + CW_DIAGNOSTIC_VERSION)
      .replaceAll('v1.0.25', 'v' + CW_DIAGNOSTIC_VERSION)
      .replaceAll('host-node-setup.js', 'host-node-setup-v126.js');
    text = text.replace('if(localStorage.getItem(key)!==build)', 'if(false&&localStorage.getItem(key)!==build)');
    text = text.replace('navigator.serviceWorker?.register("service-worker.js",{updateViaCache:"none"}).then(registration=>registration.update()).catch(()=>undefined);', 'window.CommonweaveBootLog?.log("legacy-worker-registration-disabled",{build:"' + CW_DIAGNOSTIC_BUILD + '"});');
    text = text.replace('setTimeout(()=>location.reload(),900)', 'window.CommonweaveBootLog?.log("legacy-reload-suppressed",{reason:"manual-update-candidate"})');
    if (!text.includes('boot-diagnostics-v126.js')) text = text.replace('<head>', '<head>\n  <meta http-equiv="Cache-Control" content="no-store">\n  <script src="boot-diagnostics-v126.js?v=' + CW_DIAGNOSTIC_VERSION + '" defer></script>');
    cwBootLog('campus-index-served', { requestId, sourceBytes: text.length, originalPathname }, req);
    cwSendText(res, 200, text, 'text/html; charset=utf-8', requestId);
    return true;
  }
  if (mapped === '/app/version.json') {
    const text = JSON.stringify({ schema: 'commonweave.version.v1', version: CW_DIAGNOSTIC_VERSION, build: CW_DIAGNOSTIC_BUILD, channel: 'main', updatedAt: new Date().toISOString() }, null, 2);
    cwSendText(res, 200, text, 'application/json; charset=utf-8', requestId);
    return true;
  }
  if (mapped === '/app/host-node-v126.js') {
    let text = await fsp.readFile(path.join(PUBLIC_DIR, 'app', 'host-node-v125.js'), 'utf8');
    text = text.replaceAll('1.0.25-freeze-recovery', CW_DIAGNOSTIC_BUILD).replaceAll('1.0.25', CW_DIAGNOSTIC_VERSION);
    text = text.replace("'use strict';", "'use strict';\nwindow.CommonweaveBootLog?.log('host-runtime-evaluating',{version:'" + CW_DIAGNOSTIC_VERSION + "',build:'" + CW_DIAGNOSTIC_BUILD + "'});");
    cwBootLog('campus-runtime-served', { requestId, bytes: text.length }, req);
    cwSendText(res, 200, text, 'text/javascript; charset=utf-8', requestId);
    return true;
  }
  const served = await serveFile(req, res, mapped);
  if (served && /(?:service-worker-v126|host-node-setup-v126|boot-diagnostics-v126)/.test(mapped)) cwBootLog('campus-critical-asset-served', { requestId, mapped }, req);
  return served;
}
`;
replaceRequired('const server = http.createServer(async (req, res) => {', injected + '\nconst server = http.createServer(async (req, res) => {', 'the HTTP server declaration');
replaceRequired('  const pathname = decodeURIComponent(url.pathname);', "  const originalPathname = decodeURIComponent(url.pathname);\n  const isCampusRequest = originalPathname === '/campus' || originalPathname.startsWith('/campus/');\n  const pathname = isCampusRequest ? (originalPathname.replace(/^\\/campus(?=\\/|$)/, '/app') || '/app/') : originalPathname;\n  const requestId = crypto.randomUUID();\n  if (/^\\/(?:app|campus)(?:\\/|$)/.test(originalPathname) || originalPathname === '/recover.html' || originalPathname.startsWith('/api/boot-log')) {\n    res.setHeader('x-commonweave-version', CW_DIAGNOSTIC_VERSION);\n    res.setHeader('x-commonweave-build', CW_DIAGNOSTIC_BUILD);\n    res.setHeader('x-commonweave-request-id', requestId);\n    cwBootLog('http-request', { requestId, originalPathname, mappedPathname: pathname }, req);\n  }", 'the request pathname declaration');
replaceRequired("    if (pathname.startsWith('/api/')) {", "    if (pathname.startsWith('/api/')) {\n      if (pathname === '/api/boot-log' && req.method === 'POST') {\n        const input = await body(req, 64 * 1024);\n        const entry = cwBootLog('client:' + String(input.kind || 'event'), { ...input, receivedAt: new Date().toISOString(), requestId }, req);\n        return json(res, 202, { ok: true, accepted: entry.time, version: CW_DIAGNOSTIC_VERSION, build: CW_DIAGNOSTIC_BUILD });\n      }\n      if (pathname === '/api/boot-logs' && req.method === 'GET') return json(res, 200, { version: CW_DIAGNOSTIC_VERSION, build: CW_DIAGNOSTIC_BUILD, count: cwBootLogs.length, logs: cwBootLogs.slice(-300) });", 'the API router');
replaceRequired("    if (await serveFile(req, res, pathname)) return;", "    if (req.method === 'GET' && !isCampusRequest && (originalPathname === '/app' || originalPathname === '/app/' || originalPathname === '/app/index.html')) {\n      cwBootLog('legacy-app-migrated', { requestId, originalPathname }, req);\n      res.writeHead(302, { location: '/campus/' + (url.search || ''), 'cache-control': 'no-store', 'x-commonweave-version': CW_DIAGNOSTIC_VERSION, 'x-commonweave-build': CW_DIAGNOSTIC_BUILD });\n      return res.end();\n    }\n    if (isCampusRequest && await cwServeCampus(req, res, originalPathname, requestId)) return;\n    if (await serveFile(req, res, pathname)) return;", 'the static file router');

await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(pathToFileURL(runtimePath).href + '?build=' + VERSION);
} finally {
  setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.();
}
