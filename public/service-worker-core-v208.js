'use strict';

const VERSION = '1.0.160';
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
  '/app/installer-repair-only-v1.js',
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
      const pathname = normalizeCandidate(match[1], baseUrl, manifest);
      if (pathname) found.add(pathname);
    }
  }
  return [...found];
}

async function discoverOfflineAssets(manifest) {
  const queue = [...new Set(manifest.seeds)];
  const seen = new Set();
  const assets = new Set(queue);
  const maxAssets = Math.max(32, Math.min(1500, Number(manifest.maxAssets || 900)));
  const maxDepth = Math.max(1, Math.min(12, Number(manifest.maxDepth || 8)));
  const depth = new Map(queue.map(item => [item, 0]));

  while (queue.length && assets.size < maxAssets) {
    const pathname = queue.shift();
    if (seen.has(pathname)) continue;
    seen.add(pathname);
    const currentDepth = depth.get(pathname) || 0;
    if (currentDepth >= maxDepth) continue;
    if (!TEXT_CONTENT.test(pathname) && !/\.(?:html?|css|m?js|json|webmanifest|md|txt)$/i.test(pathname)) continue;

    let response = null;
    try { response = await fetchFresh(pathname, 'offline-discovery', 8000); } catch {
      try { response = await caches.match(cacheKey(pathname), { ignoreSearch: true }); } catch {}
    }
    if (!responseLooksValid(response, pathname)) continue;
    const type = String(response.headers.get('content-type') || '');
    if (!TEXT_CONTENT.test(type) && !/\.(?:html?|css|m?js|json|webmanifest|md|txt)$/i.test(pathname)) continue;
    let text = '';
    try { text = await response.clone().text(); } catch { continue; }
    const baseUrl = new URL(pathname, self.location.origin).href;
    for (const child of discoverReferences(text, baseUrl, manifest)) {
      if (assets.size >= maxAssets) break;
      if (!assets.has(child)) {
        assets.add(child);
        queue.push(child);
        depth.set(child, currentDepth + 1);
      }
    }
  }
  return [...assets];
}

async function offlineStatus() {
  const meta = await readOfflineMeta();
  return meta || {
    type: 'CIVWEAVE_OFFLINE_PACKAGE',
    version: VERSION,
    revision: BUILD,
    ready: false,
    running: false,
    total: 0,
    completed: 0,
    failed: []
  };
}

async function downloadOfflinePackage(event) {
  const manifest = await loadOfflineManifest();
  const assets = await discoverOfflineAssets(manifest);
  const cache = await caches.open(OFFLINE_CACHE);
  const initial = {
    type: 'CIVWEAVE_OFFLINE_PACKAGE',
    version: VERSION,
    revision: BUILD,
    ready: false,
    running: true,
    total: assets.length,
    completed: 0,
    failed: [],
    startedAt: new Date().toISOString()
  };
  await writeOfflineMeta(initial);
  post(event, initial);

  const failed = [];
  let completed = 0;
  for (let index = 0; index < assets.length; index += 4) {
    const batch = assets.slice(index, index + 4);
    const results = await Promise.allSettled(batch.map(async pathname => {
      const response = await fetchFresh(pathname, 'offline-package', 10000);
      await cache.put(cacheKey(pathname), response.clone());
      return pathname;
    }));
    results.forEach((result, offset) => {
      completed += 1;
      if (result.status === 'rejected') failed.push({ pathname: batch[offset], message: result.reason?.message || String(result.reason) });
    });
    const progress = {
      type: 'CIVWEAVE_OFFLINE_PACKAGE',
      version: VERSION,
      revision: BUILD,
      ready: false,
      running: true,
      total: assets.length,
      completed,
      failed,
      updatedAt: new Date().toISOString()
    };
    await writeOfflineMeta(progress);
    post(event, progress);
  }

  const final = {
    type: 'CIVWEAVE_OFFLINE_PACKAGE',
    version: VERSION,
    revision: BUILD,
    ready: failed.length === 0,
    running: false,
    total: assets.length,
    completed,
    failed,
    finishedAt: new Date().toISOString()
  };
  await writeOfflineMeta(final);
  post(event, final);
  return final;
}

self.addEventListener('install', event => {
  event.waitUntil(cacheShell());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => {
      if (PRESERVED_CACHE_PREFIXES.some(prefix => key.startsWith(prefix))) return null;
      if (!APP_CACHE_PREFIXES.some(prefix => key.startsWith(prefix))) return null;
      if (key === SHELL_CACHE || key === RUNTIME_CACHE || key === OFFLINE_CACHE) return null;
      return caches.delete(key);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'GET_DEVICE_PACKAGE_STATUS') {
    event.waitUntil(shellStatus().then(status => post(event, status)));
    return;
  }
  if (event.data?.type === 'GET_OFFLINE_PACKAGE_STATUS') {
    event.waitUntil(offlineStatus().then(status => post(event, status)));
    return;
  }
  if (event.data?.type === 'DOWNLOAD_OFFLINE_PACKAGE') {
    event.waitUntil(downloadOfflinePackage(event));
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (WORKER_PATHS.has(url.pathname)) {
    event.respondWith((async () => {
      try { return await fetchFresh(url.pathname, 'worker-refresh'); }
      catch {
        const cached = await caches.match(request, { ignoreSearch: true });
        return cached || new Response('Civweave worker unavailable.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }
  if (COMPAT_ENTRY_PATHS.has(url.pathname)) {
    event.respondWith((async () => {
      const exactPath = url.pathname === '/app/fullscreen-family-v104' ? '/app/fullscreen-family-v104.html' : url.pathname === '/app/installed-entry-v146' ? '/app/installed-entry-v146.html' : url.pathname;
      try { return await fetchFresh(exactPath, 'entry-refresh'); }
      catch {
        const cached = await caches.match(cacheKey(exactPath), { ignoreSearch: true });
        return cached || new Response('<!doctype html><meta charset="utf-8"><title>Civweave unavailable</title><main><h1>Civweave is unavailable.</h1><p>Reconnect and reload to repair the app shell.</p></main>', { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }
  if (url.pathname.startsWith(OPEN_MEDIA_ROUTE_PREFIX)) {
    event.respondWith((async () => {
      const cache = await caches.open(OPEN_MEDIA_CACHE);
      const cached = await cache.match(request, { ignoreSearch: false });
      if (cached) return cached;
      return new Response('Open learning media is not cached on this device.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    })());
  }
});
