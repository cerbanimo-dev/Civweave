import fs from 'node:fs/promises';

const files = {
  installer: 'public/install-v130.js',
  core: 'public/service-worker-core-v208.js',
  generated: 'public/service-worker-v203.js',
  legacy: 'public/service-worker.js'
};

async function read(path) {
  return fs.readFile(path, 'utf8');
}

async function write(path, content) {
  await fs.writeFile(path, content, 'utf8');
}

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label}: ${before}`);
  return source.replace(before, after);
}

function patchLightweightWorker(source, label) {
  source = replaceOnce(
    source,
    "const BUILD = 'lightweight-shell-v208';",
    "const BUILD = 'lightweight-shell-v216-stable-entry-cache-route';",
    `${label} build revision`
  );
  source = replaceOnce(
    source,
    "  '/app/manifest.webmanifest',\n  '/app/installed-entry-v146.html',",
    "  '/app/manifest.webmanifest',\n  '/app/index.html',\n  '/app/installed-entry-v146.html',",
    `${label} stable app shell asset`
  );
  source = replaceOnce(
    source,
    "const WORKER_PATHS = new Set([",
    "const LEGACY_ENTRY_PATHS = new Set([\n  '/app/installed-entry-v146.html',\n  '/app/installed-entry-v146'\n]);\n\nconst WORKER_PATHS = new Set([",
    `${label} legacy entry paths`
  );
  source = replaceOnce(
    source,
    "async function modelOnDemand(request) {",
    `async function stableAppEntry(request) {\n  let response = await findCached('/app/index.html');\n  if (!response) {\n    try {\n      response = await fetchFresh('/app/index.html', 'stable-app-entry');\n      await (await caches.open(SHELL_CACHE)).put(cacheKey('/app/index.html'), response.clone());\n    } catch {}\n  }\n  if (!response) {\n    return new Response('Commonweave launcher is unavailable.', {\n      status: 503,\n      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }\n    });\n  }\n  return request.method === 'HEAD'\n    ? new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers })\n    : response;\n}\n\nasync function modelOnDemand(request) {`,
    `${label} stable entry responder`
  );
  source = replaceOnce(
    source,
    "  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {",
    "  if (request.mode === 'navigate' && LEGACY_ENTRY_PATHS.has(url.pathname)) {\n    event.respondWith(stableAppEntry(request));\n    return;\n  }\n  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {",
    `${label} stable entry fetch route`
  );
  return source;
}

let installer = await read(files.installer);
installer = replaceOnce(
  installer,
  "const WORKER_BUILD = `${VERSION}-lightweight-shell-v208`;",
  "const WORKER_BUILD = `${VERSION}-lightweight-shell-v216-stable-entry-cache-route`;",
  'installer worker revision'
);
installer = replaceOnce(
  installer,
  "const WATCHDOG_RECOVERY_KEY = 'commonweave.shell.registration-watchdog.v208';",
  "const WATCHDOG_RECOVERY_KEY = 'commonweave.shell.registration-watchdog.v216';",
  'installer watchdog revision'
);
await write(files.installer, installer);

await write(files.core, patchLightweightWorker(await read(files.core), 'source worker'));
await write(files.generated, patchLightweightWorker(await read(files.generated), 'generated worker'));

let legacy = await read(files.legacy);
legacy = replaceOnce(
  legacy,
  "const INSTALL_REVISION='direct-entry-r45-memory-credential-v191';",
  "const INSTALL_REVISION='direct-entry-r46-stable-entry-cache-route-v216';",
  'legacy worker install revision'
);
legacy = replaceOnce(
  legacy,
  "  '/app/manifest.webmanifest','/app/installed-entry-v146.html',",
  "  '/app/manifest.webmanifest','/app/index.html','/app/installed-entry-v146.html',",
  'legacy stable app shell asset'
);
legacy = replaceOnce(
  legacy,
  "const ARCHIVED_LOCATION_PREFIXES=",
  "const LEGACY_ENTRY_PATHS=new Set(['/app/installed-entry-v146.html','/app/installed-entry-v146']);\nconst ARCHIVED_LOCATION_PREFIXES=",
  'legacy entry paths'
);
legacy = replaceOnce(
  legacy,
  "async function modelOnDemand(request){",
  `async function stableAppEntry(request){\n  let response=await cachedResponse('/app/index.html');\n  if(!response){\n    const target=new Request(new URL('/app/index.html',self.location.origin),{method:'GET',cache:'no-store',credentials:'same-origin'});\n    response=await networkRepair(target);\n  }\n  if(!response)return missingAssetResponse('/app/index.html');\n  return request.method==='HEAD'?headResponse(response):response\n}\nasync function modelOnDemand(request){`,
  'legacy stable entry responder'
);
legacy = replaceOnce(
  legacy,
  "  if(request.mode==='navigate'){event.respondWith((async()=>injectNavigationPolicy(await deviceOnly(request,navigationFallback(url)),url.pathname))());return}",
  "  if(request.mode==='navigate'&&LEGACY_ENTRY_PATHS.has(url.pathname)){event.respondWith(stableAppEntry(request));return}\n  if(request.mode==='navigate'){event.respondWith((async()=>injectNavigationPolicy(await deviceOnly(request,navigationFallback(url)),url.pathname))());return}",
  'legacy stable entry fetch route'
);
await write(files.legacy, legacy);

console.log('Applied stable installed-entry worker routing v216.');
