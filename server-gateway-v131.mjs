import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(rootDir, 'server.mjs');
const runtimePath = path.join(rootDir, '.commonweave-gateway-v131.runtime.mjs');
const VERSION = '1.0.31';
const BUILD = '1.0.31-local-first-gateway';
let source = await fsp.readFile(sourcePath, 'utf8');

function replaceRequired(before, after, label) {
  if (!source.includes(before)) throw new Error(`Commonweave gateway patch could not find ${label}`);
  source = source.replace(before, after);
}

replaceRequired("const BUILD_VERSION = '1.0.21-ai-uplift';", `const BUILD_VERSION = '${BUILD}';`, 'host build marker');
replaceRequired("const APP_VERSION = 'rc22.3.20-ai-checkpoint';", `const APP_VERSION = '${VERSION}';`, 'app version marker');
replaceRequired(
  "const DEFAULT_PUBLIC_HOST = process.env.PUBLIC_HOST_URL || 'https://commonweave-host-node.onrender.com';",
  "const DEFAULT_PUBLIC_HOST = process.env.PUBLIC_HOST_URL || 'https://commonweave-host-node.onrender.com';\nconst COMMONWEAVE_SOURCE_URL = process.env.COMMONWEAVE_SOURCE_URL || 'https://github.com/cerbanimo-dev/Commonweave';\nconst COMMONWEAVE_RELEASE_URL = process.env.COMMONWEAVE_RELEASE_URL || 'https://github.com/cerbanimo-dev/Commonweave/archive/refs/heads/main.zip';",
  'gateway release URLs'
);
replaceRequired(
  "let installKitSha256 = '';\nlet installKitSize = 0;\ntry {\n  const kit = await fsp.readFile(INSTALL_KIT_PATH);\n  installKitSha256 = crypto.createHash('sha256').update(kit).digest('hex');\n  installKitSize = kit.length;\n} catch (error) {\n  console.warn('Install kit metadata unavailable:', error.message);\n}",
  "const installKitSha256 = '';\nconst installKitSize = 0;",
  'install kit startup hashing'
);
replaceRequired(
  "    releasedAt: STARTED_AT, appUrl: `${root}/app/?setup=1&host=${encodeURIComponent(root)}`,\n    downloadUrl: `${root}/downloads/Commonweave-Mobile-Install-Kit.zip`, sha256: installKitSha256,\n    bytes: installKitSize, mandatory: false, notes: 'Current stable Commonweave host-node and offline PWA release.'",
  "    releasedAt: STARTED_AT, appUrl: null, sourceUrl: COMMONWEAVE_SOURCE_URL,\n    downloadUrl: COMMONWEAVE_RELEASE_URL, sha256: '', bytes: 0, mandatory: false, localInstallRequired: true,\n    notes: 'Commonweave runs from a local installation. This public node only advertises releases and optional federation APIs.'",
  'release packet hosting fields'
);
replaceRequired(
  "  const pathname = decodeURIComponent(url.pathname);",
  String.raw`  const pathname = decodeURIComponent(url.pathname);
  const gatewayRequest = req.method === 'GET' || req.method === 'HEAD';
  const localSurface = pathname === '/'
    || pathname === '/index.html'
    || pathname === '/service-worker.js'
    || pathname === '/diagnostics.html'
    || pathname === '/recover.html'
    || pathname === '/field/commonweave/seed'
    || pathname === '/downloads'
    || pathname.startsWith('/downloads/')
    || pathname === '/app'
    || pathname.startsWith('/app/')
    || pathname === '/loom'
    || pathname.startsWith('/loom/')
    || pathname === '/lite'
    || pathname.startsWith('/lite/')
    || pathname === '/campus'
    || pathname.startsWith('/campus/');
  if (gatewayRequest && (pathname === '/' || pathname === '/index.html')) {
    const release = releasePacket(requestOrigin(req, url));
    const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#07141f"><title>Commonweave Local-First Gateway</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07141f;color:#f7efd2;font:16px/1.55 system-ui,sans-serif}main{max-width:720px;padding:32px}h1{font:700 clamp(32px,7vw,64px)/1 Georgia,serif;margin:0 0 18px}p{color:#bdd0d7}a{color:#7ee5ff}code{background:#ffffff12;padding:.15rem .35rem;border-radius:.35rem}.card{border:1px solid #7ee5ff55;border-radius:18px;padding:24px;background:#0b2230}.status{color:#70e5ae;font-weight:800}</style></head><body><main><div class="card"><div class="status">Gateway online</div><h1>Commonweave runs locally.</h1><p>This Render service does not serve the campus, rooms, models, cabinet art, or service worker. It only exposes lightweight health, release, and optional federation APIs.</p><p>Use the offline setup from the source repository, then run <code>npm run start:local</code> on your own device or local host.</p><p><a href="' + release.sourceUrl + '">Open source repository</a> · <a href="/api/health">Health record</a> · <a href="/api/releases/current">Release record</a></p></div></main></body></html>';
    const payload = Buffer.from(html);
    res.writeHead(200, {'content-type':'text/html; charset=utf-8','content-length':payload.length,'cache-control':'public, max-age=300','x-content-type-options':'nosniff'});
    if (req.method === 'HEAD') return res.end();
    return res.end(payload);
  }
  if (gatewayRequest && (pathname === '/field/commonweave/seed' || pathname === '/downloads' || pathname.startsWith('/downloads/'))) {
    res.writeHead(302, {location: COMMONWEAVE_RELEASE_URL, 'cache-control':'no-store'});
    return res.end();
  }
  if (localSurface) {
    return json(res, 410, {
      error: 'Local surface not hosted here',
      localInstallRequired: true,
      sourceUrl: COMMONWEAVE_SOURCE_URL,
      releaseUrl: COMMONWEAVE_RELEASE_URL,
      message: 'Install and run Commonweave locally. The public gateway intentionally does not serve the application.'
    });
  }
  if (pathname === '/api/boot-log' || pathname === '/api/boot-logs') {
    res.writeHead(204, {'cache-control':'no-store'});
    return res.end();
  }`,
  'request pathname declaration'
);
replaceRequired(
  "appUrl: `${requestOrigin(req, url)}/app/`, downloadUrl: `${requestOrigin(req, url)}/downloads/Commonweave-Mobile-Install-Kit.zip`, seedUrl: `${requestOrigin(req, url)}/downloads/commonweave-pocket-campus.cwseed`, release: releasePacket(requestOrigin(req, url)), tokenRequired: Boolean(HUB_TOKEN), features: ['node-registration','heartbeat','relay-envelopes','presence','sse-events','release-broadcasts','pwa-hosting','offline-installer','gemini-agent-proxy','campus-seed-download']",
  "appUrl: null, sourceUrl: COMMONWEAVE_SOURCE_URL, downloadUrl: COMMONWEAVE_RELEASE_URL, seedUrl: null, release: releasePacket(requestOrigin(req, url)), tokenRequired: Boolean(HUB_TOKEN), features: ['node-registration','heartbeat','relay-envelopes','presence','sse-events','release-broadcasts','gemini-agent-proxy','release-advertising']",
  'public config hosting fields'
);
replaceRequired(
  "    if (pathname === '/favicon.ico') { res.writeHead(302, { location: '/app/logos/commonweave-icon-32.png', 'cache-control': 'public, max-age=86400' }); return res.end(); }",
  "    if (pathname === '/favicon.ico') { res.writeHead(204, { 'cache-control': 'public, max-age=86400' }); return res.end(); }",
  'favicon route'
);

await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(pathToFileURL(runtimePath).href + `?build=${VERSION}`);
} finally {
  setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.();
}
