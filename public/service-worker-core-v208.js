'use strict';

const VERSION = '1.0.147';
const BUILD = 'lightweight-shell-v208-installer-brand-v1-working-campus-return-v425';
const SHELL_CACHE = `civweave-shell-${VERSION}-${BUILD}`;
const RUNTIME_CACHE = `civweave-runtime-${VERSION}-${BUILD}`;
const OFFLINE_CACHE = `civweave-offline-${VERSION}-${BUILD}`;
const OFFLINE_MANIFEST_URL = '/app/offline-package-v208.json';
const OFFLINE_META_URL = '/__civweave/offline-package-v208.json';
const FETCH_TIMEOUT_MS = 12000;
const OPEN_MEDIA_ROUTE_PREFIX = '/__civweave_open_media__/';
const OPEN_MEDIA_CACHE = 'cw-open-learning-media-v1';

const REQUIRED_SHELL_ASSETS = [
  '/index.html',
  '/install-v130.css',
  '/install-v130.js',
  '/offline.html',
  '/app/manifest.webmanifest',
  '/app/index.html',
  '/app/installed-entry-v146.html',
  '/app/installed-entry-v146.js',
  '/app/legal-consent-v1.js',
  '/legal/civweave-legal-release-v1.json',
  '/app/document-lifecycle-v221.js',
  '/app/fullscreen-family-v104.html',
  '/app/logos/civweave-icon-192.png',
  '/app/logos/civweave-icon-512.png',
  '/app/logos/civweave-pwa-192-v247.png',
  '/app/logos/civweave-prismatic-wordmark-v1.png',
  '/app/logos/cerbanimo-steward-mark-v1.png'
];

const OPTIONAL_SHELL_ASSETS = [
  '/app/low-end-device-lab-v1.html',
  '/app/low-end-device-lab-v1.js',
  '/app/local-ai/model-registry-v266.js',
  '/app/local-ai/download-manager-v267.js',
  '/app/local-ai/runtime-v266.js',
  '/app/mobile-ai-hardening-v302.js',
  '/app/local-ai/test-pulse-v269.js',
  '/app/minilm-context-router-v344.js',
  '/app/models/all-minilm-l6-v2/adapter.js',
  '/app/working-campus-return-guard-v425.js',
  '/app/open-learning-media-cache-v1.mjs',
  '/app/open-learning-media-installer-v1.mjs',
  '/downloads/knowledge-schools/open-learning-media/lookup.json',
  '/downloads/knowledge-schools/open-learning-media/harvest-policy.json',
  '/downloads/knowledge-schools/open-learning-media/revocations.json',
  '/app/install-boundary-v146.js',
  '/app/offline-package-v208.json',
  '/app/logos/civweave-app-icon.png',
  '/app/logos/civweave-icon-maskable-192.png',
  '/app/logos/civweave-icon-maskable-512.png',
  '/app/knowledge-school-installer-v1.css',
  '/app/knowledge-school-seeds-v1.js',
  '/app/knowledge-school-installer-v1.js'
];

const SHELL_ASSETS = [...REQUIRED_SHELL_ASSETS, ...OPTIONAL_SHELL_ASSETS];

const MODEL_PREFIXES = [
  '/app/models/',
  '/app/vendor/onnxruntime/'
];

const PRESERVED_CACHE_PREFIXES = [
  'cw-open-learning-media-',
  'cwknowledge-',
  'cwupdate-',
  'civweave-model-',
  'civweave-offline-'
];

const APP_CACHE_PREFIXES = [
  'civweave-static-',
  'civweave-runtime-',
  'civweave-shell-',
  'civweave-offline-',
  'cwext-',
  'cwboot-',
  'cwimg-'
];

const TEXT_CONTENT = /(?:text\/(?:html|css|plain)|javascript|ecmascript|application\/(?:json|manifest\+json))/i;
const DISCOVERABLE_EXTENSION = /\.(?:html?|css|m?js|json|webmanifest|md|txt|png|webp|jpe?g|gif|svg|avif|ico|woff2?|ttf|otf)$/i;
const IMAGE_EXTENSION = /\.(?:png|webp|jpe?g|gif|svg|avif|ico)$/i;
const COMPAT_ENTRY_PATHS = new Set([
  '/app/installed-entry-v146.html',
  '/app/installed-entry-v146',
  '/app/fullscreen-family-v104.html',
  '/app/fullscreen-family-v104'
]);

const WORKER_PATHS = new Set([
  '/service-worker.js',
  '/service-worker-v156.js',
  '/service-worker-v203.js',
  '/service-worker-critical-v199.js',
  '/service-worker-shared-images-v203.js',
  '/service-worker-update-v204.js'
]);

function post(event, packet) {
  try { event.ports?.[0]?.postMessage(packet); } catch {}
  try { event.source?.postMessage?.(packet); } catch {}
}

function withTimeout(promise, timeoutMs = FETCH_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs} ms`)), timeoutMs);
    Promise.resolve(promise).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

function cacheKey(pathname) {
  return new Request(new URL(pathname, self.location.origin).href, { method: 'GET' });
}

function responseLooksValid(response, pathname) {
  if (!response?.ok) return false;
  const type = String(response.headers.get('content-type') || '');
  if (pathname.endsWith('.html')) return /text\/html/i.test(type) || !type;
  if (/\.(?:m?js)$/i.test(pathname)) return !/text\/html/i.test(type);
  if (pathname.endsWith('.css')) return !/text\/html/i.test(type);
  if (IMAGE_EXTENSION.test(pathname)) return /^image\//i.test(type) || /svg\+xml/i.test(type) || !type;
  return true;
}

async function fetchFresh(pathname, purpose = 'runtime', timeoutMs = FETCH_TIMEOUT_MS) {
  const headers = new Headers({ 'x-civweave-package': purpose });
  const request = new Request(new URL(pathname, self.location.origin).href, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    headers
  });
  const response = await withTimeout(fetch(request), timeoutMs);
  if (!responseLooksValid(response, new URL(request.url).pathname)) {
    throw new Error(`${pathname} returned ${response.status} ${response.headers.get('content-type') || ''}`.trim());
  }
  return response;
}

async function cacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  const failures = [];
  for (let index = 0; index < SHELL_ASSETS.length; index += 4) {
    const batch = SHELL_ASSETS.slice(index, index + 4);
    const results = await Promise.allSettled(batch.map(async pathname => {
      const response = await fetchFresh(pathname, 'shell-install');
      await cache.put(cacheKey(pathname), response.clone());
    }));
    results.forEach((result, offset) => {
      if (result.status === 'rejected') failures.push({ pathname: batch[offset], message: result.reason?.message || String(result.reason) });
    });
  }
  const requiredFailures = failures.filter(entry => REQUIRED_SHELL_ASSETS.includes(entry.pathname));
  if (requiredFailures.length) {
    const error = new Error(`App shell incomplete: ${requiredFailures.length}/${REQUIRED_SHELL_ASSETS.length} required files failed.`);
    error.failures = requiredFailures;
    throw error;
  }
  return { optionalFailures: failures.filter(entry => OPTIONAL_SHELL_ASSETS.includes(entry.pathname)) };
}

async function shellStatus() {
  const cache = await caches.open(SHELL_CACHE);
  const missing = [];
  const optionalMissing = [];
  for (const pathname of REQUIRED_SHELL_ASSETS) {
    const response = await cache.match(cacheKey(pathname), { ignoreSearch: true });
    if (!responseLooksValid(response, pathname)) missing.push(pathname);
  }
  for (const pathname of OPTIONAL_SHELL_ASSETS) {
    const response = await cache.match(cacheKey(pathname), { ignoreSearch: true });
    if (!responseLooksValid(response, pathname)) optionalMissing.push(pathname);
  }
  return {
    type: 'CIVWEAVE_DEVICE_PACKAGE',
    mode: 'lightweight-shell',
    version: VERSION,
    revision: BUILD,
    cache: SHELL_CACHE,
    ready: missing.length === 0,
    assetCount: REQUIRED_SHELL_ASSETS.length,
    presentCount: REQUIRED_SHELL_ASSETS.length - missing.length,
    optionalAssetCount: OPTIONAL_SHELL_ASSETS.length,
    optionalPresentCount: OPTIONAL_SHELL_ASSETS.length - optionalMissing.length,
    missing,
    optionalMissing,
    offlinePackageOptional: true,
    modelOnDemand: true,
    knowledgeLibrarySeparate: true
  };
}

async function readOfflineMeta() {
  const cache = await caches.open(OFFLINE_CACHE);
  const response = await cache.match(cacheKey(OFFLINE_META_URL), { ignoreSearch: true });
  if (!response) return null;
  try { return await response.json(); } catch { return null; }
}

async function writeOfflineMeta(meta) {
  const cache = await caches.open(OFFLINE_CACHE);
  const body = JSON.stringify(meta);
  await cache.put(cacheKey(OFFLINE_META_URL), new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  }));
  return meta;
}

async function loadOfflineManifest() {
  const cached = await caches.match(cacheKey(OFFLINE_MANIFEST_URL), { ignoreSearch: true });
  let response = null;
  try { response = await fetchFresh(OFFLINE_MANIFEST_URL, 'offline-manifest'); } catch {}
  const source = response || cached;
  if (!source) throw new Error('Offline campus manifest is unavailable.');
  const manifest = await source.clone().json();
  if (!Array.isArray(manifest.seeds) || !manifest.seeds.length) throw new Error('Offline campus manifest has no seed pages.');
  return manifest;
}

function normalizeCandidate(reference, baseUrl, manifest) {
  if (!reference || /^(?:data:|blob:|mailto:|tel:|javascript:|#)/i.test(reference)) return null;
  let url;
  try { url = new URL(reference.replace(/&amp;/g, '&'), baseUrl); } catch { return null; }
  if (url.origin !== self.location.origin) return null;
  url.hash = '';
  url.search = '';
  let pathname;
  try { pathname = decodeURI(url.pathname); } catch { pathname = url.pathname; }
  const includePrefixes = Array.isArray(manifest.includePrefixes) ? manifest.includePrefixes : ['/app/', '/extensions/'];
  const excludePrefixes = Array.isArray(manifest.excludePrefixes) ? manifest.excludePrefixes : [];
  const excludeExtensions = Array.isArray(manifest.excludeExtensions) ? manifest.excludeExtensions : [];
  if (!includePrefixes.some(prefix => pathname.startsWith(prefix))) return null;
  if (excludePrefixes.some(prefix => pathname.startsWith(prefix))) return null;
  if (excludeExtensions.some(extension => pathname.toLowerCase().endsWith(String(extension).toLowerCase()))) return null;
  if (!DISCOVERABLE_EXTENSION.test(pathname)) return null;
  return pathname;
}

function discoverReferences(text, baseUrl, manifest) {
  const found = new Set();
  const patterns = [
    /(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi,
    /url\(\s*["']?([^"')]+)["']?\s*\)/gi,
    /["'`]((?:\/|\.\.?\/)(?:app|extensions)[^"'`\s<>?#)]*)/gi,
    /["'`](\/(?:app|extensions)\/[^"'`\s<>?#)]*)/gi,
    /["'`]((?:\.\.?\/)[^"'`\s<>?#)]+\.(?:html?|css|m?js|json|webmanifest|md|txt|png|webp|jpe?g|gif|svg|avif|ico|woff2?|ttf|otf))/gi
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) {
      const candidate = normalizeCandidate(match[1], baseUrl, manifest);
      if (candidate) found.add(candidate);
    }
  }
  return [...found];
}

async function findCached(pathname) {
  const key = cacheKey(pathname);
  const preferred = [SHELL_CACHE, RUNTIME_CACHE, OFFLINE_CACHE];
  for (const name of preferred) {
    const response = await (await caches.open(name)).match(key, { ignoreSearch: true });
    if (responseLooksValid(response, pathname)) return response;
  }
  const response = await caches.match(key, { ignoreSearch: true });
  return responseLooksValid(response, pathname) ? response : null;
}

async function cacheOfflineAsset(pathname, options = {}) {
  const cache = await caches.open(OFFLINE_CACHE);
  const key = cacheKey(pathname);
  let response = await cache.match(key, { ignoreSearch: true });
  let fromNetwork = false;
  if (options.preferNetwork) {
    try {
      response = await fetchFresh(pathname, 'offline-campus-refresh', FETCH_TIMEOUT_MS);
      fromNetwork = true;
      await cache.put(key, response.clone());
    } catch {
      if (!responseLooksValid(response, pathname)) response = await findCached(pathname);
    }
  } else if (!responseLooksValid(response, pathname)) {
    response = await findCached(pathname);
    if (!responseLooksValid(response, pathname)) {
      response = await fetchFresh(pathname, 'offline-campus', FETCH_TIMEOUT_MS);
      fromNetwork = true;
    }
    await cache.put(key, response.clone());
  }
  if (!responseLooksValid(response, pathname)) throw new Error(`${pathname} is unavailable.`);
  const contentLength = Number(response.headers.get('content-length') || 0);
  return { response, contentLength: Number.isFinite(contentLength) ? contentLength : 0, fromNetwork };
}

function offlinePacket(meta = {}) {
  const assets = Array.isArray(meta.assets) ? meta.assets : [];
  const failed = Array.isArray(meta.failed) ? meta.failed : [];
  const completed = Number(meta.completed || Math.max(0, assets.length - failed.length));
  return {
    type: 'CIVWEAVE_OFFLINE_PACKAGE_STATUS',
    mode: 'resumable-discovered-campus',
    version: VERSION,
    revision: BUILD,
    cache: OFFLINE_CACHE,
    ready: Boolean(meta.ready),
    running: Boolean(meta.running),
    completed,
    total: Number(meta.total || assets.length),
    discovered: assets.length,
    failed,
    failedCount: failed.length,
    bytes: Number(meta.bytes || 0),
    updatedAt: meta.updatedAt || null,
    assets
  };
}

async function offlineStatus() {
  const meta = await readOfflineMeta();
  if (meta) return offlinePacket(meta);
  const manifest = await loadOfflineManifest().catch(() => ({ seeds: [] }));
  return offlinePacket({
    ready: false,
    running: false,
    completed: 0,
    total: manifest.seeds?.length || 0,
    assets: manifest.seeds || [],
    failed: [],
    bytes: 0,
    updatedAt: null
  });
}

async function downloadOfflinePackage(event) {
  const manifest = await loadOfflineManifest();
  const previous = await readOfflineMeta();
  const maxAssets = Math.max(50, Math.min(1500, Number(manifest.maxAssets || 700)));
  const maxDepth = Math.max(1, Math.min(12, Number(manifest.maxDepth || 8)));
  const seedAssets = [...new Set([...(manifest.seeds || []), ...((previous?.assets || []).filter(Boolean))])];
  const queue = seedAssets.map(pathname => ({ pathname, depth: 0 }));
  const queued = new Set(seedAssets);
  const processed = new Set();
  const failed = new Map();
  const refreshExisting = previous?.ready === true;
  let bytes = 0;
  let completed = 0;

  const progress = async (running = true, ready = false) => {
    const assets = [...queued];
    const packet = offlinePacket({
      ready,
      running,
      completed,
      total: assets.length,
      assets,
      failed: [...failed.entries()].map(([pathname, message]) => ({ pathname, message })),
      bytes,
      updatedAt: new Date().toISOString()
    });
    await writeOfflineMeta(packet);
    post(event, { ...packet, type: running ? 'CIVWEAVE_OFFLINE_PACKAGE_PROGRESS' : packet.type });
    return packet;
  };

  await progress(true, false);

  while (queue.length && processed.size < maxAssets) {
    const batch = queue.splice(0, 4).filter(item => !processed.has(item.pathname));
    if (!batch.length) continue;
    const results = await Promise.all(batch.map(async item => {
      processed.add(item.pathname);
      try {
        const { response, contentLength } = await cacheOfflineAsset(item.pathname, { preferNetwork: refreshExisting });
        bytes += contentLength;
        failed.delete(item.pathname);
        const type = String(response.headers.get('content-type') || '');
        let references = [];
        if (item.depth < maxDepth && TEXT_CONTENT.test(type)) {
          const text = await response.clone().text();
          if (text.length <= 4_000_000) references = discoverReferences(text, new URL(item.pathname, self.location.origin), manifest);
        }
        return { item, references };
      } catch (error) {
        failed.set(item.pathname, error?.message || String(error));
        return { item, references: [] };
      } finally {
        completed += 1;
      }
    }));

    for (const result of results) {
      for (const pathname of result.references) {
        if (queued.size >= maxAssets || queued.has(pathname)) continue;
        queued.add(pathname);
        queue.push({ pathname, depth: result.item.depth + 1 });
      }
    }
    await progress(true, false);
  }

  const ready = queue.length === 0 && failed.size === 0;
  return progress(false, ready);
}

async function migrateOfflineCaches() {
  const names = await caches.keys();
  const legacy = names.filter(name => name.startsWith('civweave-offline-') && name !== OFFLINE_CACHE);
  if (!legacy.length) return;
  const target = await caches.open(OFFLINE_CACHE);
  for (const name of legacy) {
    const source = await caches.open(name);
    for (const request of await source.keys()) {
      if (await target.match(request, { ignoreSearch: true })) continue;
      const response = await source.match(request, { ignoreSearch: true });
      if (response) await target.put(request, response.clone());
    }
    await caches.delete(name);
  }
}

function preserveCache(name) {
  return PRESERVED_CACHE_PREFIXES.some(prefix => name.startsWith(prefix));
}

async function cleanLegacyCaches() {
  await migrateOfflineCaches();
  const keep = new Set([SHELL_CACHE, RUNTIME_CACHE, OFFLINE_CACHE]);
  const names = await caches.keys();
  await Promise.all(names.map(name => {
    if (keep.has(name) || preserveCache(name)) return Promise.resolve(false);
    if (APP_CACHE_PREFIXES.some(prefix => name.startsWith(prefix))) return caches.delete(name);
    if (/^(living-school|cerbanimo|fellowfare|anarchadia)-/.test(name)) return caches.delete(name);
    return Promise.resolve(false);
  }));
}

async function networkFirst(request, fallbackPath = '/offline.html') {
  const url = new URL(request.url);
  try {
    const response = await withTimeout(fetch(new Request(request, { cache: 'no-store' })), 7000);
    if (response?.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(cacheKey(url.pathname), response.clone());
      return request.method === 'HEAD' ? new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers }) : response;
    }
  } catch {}
  const cached = await findCached(url.pathname);
  if (cached) return request.method === 'HEAD' ? new Response(null, { status: cached.status, statusText: cached.statusText, headers: cached.headers }) : cached;
  const fallback = await findCached(fallbackPath);
  if (fallback) return request.method === 'HEAD' ? new Response(null, { status: fallback.status, statusText: fallback.statusText, headers: fallback.headers }) : fallback;
  return new Response('Civweave is offline and this room has not been downloaded yet.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

async function cacheFirst(request) {
  const url = new URL(request.url);
  const cached = await findCached(url.pathname);
  if (cached) {
    if (request.method === 'GET') {
      fetch(new Request(request, { cache: 'no-store' })).then(async response => {
        if (responseLooksValid(response, url.pathname)) await (await caches.open(RUNTIME_CACHE)).put(cacheKey(url.pathname), response.clone());
      }).catch(() => {});
    }
    return request.method === 'HEAD' ? new Response(null, { status: cached.status, statusText: cached.statusText, headers: cached.headers }) : cached;
  }
  try {
    const response = await fetch(new Request(request, { cache: 'no-store' }));
    if (responseLooksValid(response, url.pathname) && request.method === 'GET') await (await caches.open(RUNTIME_CACHE)).put(cacheKey(url.pathname), response.clone());
    return request.method === 'HEAD' ? new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers }) : response;
  } catch {
    return new Response(`Civweave asset unavailable: ${url.pathname}`, { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}

async function normalizeStableAppEntryResponse(response) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('location');
  if (!headers.get('content-type')) headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-civweave-stable-entry', 'v219');
  const body = await response.clone().arrayBuffer();
  return new Response(body, { status: 200, statusText: 'OK', headers });
}

async function stableAppEntry(request) {
  let response = await findCached('/app/index.html');
  if (!response) {
    try {
      const fetched = await fetchFresh('/app/', 'stable-app-entry');
      response = await normalizeStableAppEntryResponse(fetched);
      await (await caches.open(SHELL_CACHE)).put(cacheKey('/app/index.html'), response.clone());
    } catch {}
  }
  if (!response) {
    return new Response('Civweave launcher is unavailable.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
  const normalized = await normalizeStableAppEntryResponse(response);
  return request.method === 'HEAD'
    ? new Response(null, { status: normalized.status, statusText: normalized.statusText, headers: normalized.headers })
    : normalized;
}

async function modelOnDemand(request) {
  const cacheName = `civweave-model-${VERSION}-on-demand-v208`;
  const cache = await caches.open(cacheName);
  const url = new URL(request.url);
  const cached = await cache.match(cacheKey(url.pathname), { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(new Request(request, { cache: 'no-store' }));
    if (!responseLooksValid(response, url.pathname)) throw new Error(`Model asset returned ${response.status}`);
    if (request.method === 'GET') await cache.put(cacheKey(url.pathname), response.clone());
    return response;
  } catch (error) {
    return new Response(`Local model asset unavailable: ${error?.message || error}`, {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-civweave-model-package': 'not-installed' }
    });
  }
}

self.addEventListener('install', event => {
  event.waitUntil(cacheShell());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await cleanLegacyCaches();
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const type = event.data?.type;
  if (type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (type === 'GET_VERSION') {
    post(event, { type: 'CIVWEAVE_VERSION', version: VERSION, revision: BUILD, installMode: 'lightweight-shell', offlinePackageOptional: true });
    return;
  }
  if (type === 'GET_DEVICE_PACKAGE_STATUS') {
    event.waitUntil(shellStatus().then(packet => post(event, packet)));
    return;
  }
  if (type === 'GET_OFFLINE_PACKAGE_STATUS') {
    event.waitUntil(offlineStatus().then(packet => post(event, packet)));
    return;
  }
  if (type === 'DOWNLOAD_OFFLINE_PACKAGE') {
    event.waitUntil(downloadOfflinePackage(event).catch(async error => {
      const current = await readOfflineMeta() || {};
      const packet = offlinePacket({ ...current, running: false, ready: false, failed: [...(current.failed || []), { pathname: 'package', message: error?.message || String(error) }], updatedAt: new Date().toISOString() });
      await writeOfflineMeta(packet);
      post(event, packet);
    }));
    return;
  }
  if (type === 'CLEAR_OFFLINE_PACKAGE') {
    event.waitUntil(caches.delete(OFFLINE_CACHE).then(() => offlineStatus()).then(packet => post(event, packet)));
    return;
  }
  // Compatibility replies for older installer/status panels. These layers are now on-demand.
  if (type === 'GET_SHARED_IMAGE_STATUS') {
    post(event, { type: 'CIVWEAVE_SHARED_IMAGE_STATUS', version: BUILD, mode: 'on-demand', ready: true, present: 0, total: 0, missing: [] });
    return;
  }
  if (type === 'GET_CRITICAL_BOOT_STATUS') {
    post(event, { type: 'CIVWEAVE_CRITICAL_BOOT_STATUS', version: BUILD, mode: 'on-demand', ready: true, present: 0, total: 0, missing: [], fullPackage: { ready: true, deferred: true } });
    return;
  }
  if (type === 'GET_ADDITIONS_STATUS') {
    post(event, { type: 'CIVWEAVE_ADDITIONS_STATUS', version: BUILD, mode: 'on-demand', ready: true, assetCount: 0, presentCount: 0, missing: [] });
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (!['GET', 'HEAD'].includes(request.method)) return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith(OPEN_MEDIA_ROUTE_PREFIX)) {
    event.respondWith((async () => {
      const cache = await caches.open(OPEN_MEDIA_CACHE);
      const cached = await cache.match(new Request(url.href, { method: 'GET' }));
      if (!cached) return new Response('Open learning media is not cached on this device.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      const baseHeaders = new Headers(cached.headers);
      baseHeaders.set('accept-ranges', 'bytes');
      const range = request.headers.get('range');
      if (request.method === 'HEAD') return new Response(null, { status: cached.status, statusText: cached.statusText, headers: baseHeaders });
      if (!range) return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers: baseHeaders });
      const blob = await cached.blob();
      const total = blob.size;
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      const invalid = () => {
        const headers = new Headers(baseHeaders);
        headers.set('content-range', `bytes */${total}`);
        headers.set('content-length', '0');
        return new Response(null, { status: 416, headers });
      };
      if (!match || !total || (!match[1] && !match[2])) return invalid();
      let start;
      let end;
      if (!match[1]) {
        const suffix = Number(match[2]);
        if (!Number.isSafeInteger(suffix) || suffix <= 0) return invalid();
        start = Math.max(0, total - suffix);
        end = total - 1;
      } else {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : total - 1;
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= total) return invalid();
      end = Math.min(end, total - 1);
      const partial = blob.slice(start, end + 1, cached.headers.get('content-type') || 'application/octet-stream');
      const headers = new Headers(baseHeaders);
      headers.set('content-range', `bytes ${start}-${end}/${total}`);
      headers.set('content-length', String(partial.size));
      return new Response(partial, { status: 206, headers });
    })());
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (WORKER_PATHS.has(url.pathname)) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }
  if (MODEL_PREFIXES.some(prefix => url.pathname.startsWith(prefix))) {
    event.respondWith(modelOnDemand(request));
    return;
  }
  if (request.mode === 'navigate' && COMPAT_ENTRY_PATHS.has(url.pathname)) {
    event.respondWith(stableAppEntry(request));
    return;
  }
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(networkFirst(request, url.pathname === '/' ? '/index.html' : '/offline.html'));
    return;
  }
  if (url.pathname.startsWith('/app/') || url.pathname.startsWith('/extensions/') || url.pathname === '/offline.html' || url.pathname.startsWith('/install-')) {
    event.respondWith(cacheFirst(request));
  }
});