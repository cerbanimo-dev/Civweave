'use strict';

const CW_CODE_COHERENCE_VERSION = '1.0.92-code-coherence-v288-language-v2-local-first';
const CW_CODE_COHERENCE_CACHE = `civweave-code-coherence-${CW_CODE_COHERENCE_VERSION}`;
const CW_CODE_COHERENCE_PREFIX = 'civweave-code-coherence-';
const CW_CODE_EXTENSIONS = /\.(?:m?js|css|txt)$/i;
const CW_CODE_ROOTS = ['/app/', '/extensions/', '/install-'];
const CW_CODE_CRITICAL = [
  '/app/settings-gateway-v317.js',
  '/app/language-settings-v1.js',
  '/app/japanese-mode-v1.js',
  '/app/japanese-shell-copy-v1.js',
  '/app/release-version-v1.js',
  '/app/document-lifecycle-v221.js',
  '/app/model-settings-controller-v173.js',
  '/app/working-campus-v156.js',
  '/app/working-campus-v156.part5.txt',
  '/app/local-ai/bootstrap-v266.js',
  '/app/local-ai/model-registry-v266.js',
  '/app/local-ai/download-manager-v267.js',
  '/app/local-ai/runtime-v266.js',
  '/app/local-ai/runtime-bridge-v266.js',
  '/app/local-ai/settings-panel-v267.js',
  '/app/local-ai/test-pulse-v269.js'
];

function cwCodeKey(pathname) {
  return new Request(new URL(pathname, self.location.origin).href, { method: 'GET' });
}

function cwCodeEligible(request, url) {
  if (!['GET', 'HEAD'].includes(request.method)) return false;
  if (url.origin !== self.location.origin) return false;
  if (!CW_CODE_ROOTS.some(prefix => url.pathname.startsWith(prefix))) return false;
  if (!CW_CODE_EXTENSIONS.test(url.pathname)) return false;
  if (url.pathname.startsWith('/app/models/')) return false;
  return true;
}

function cwCodeValid(response, pathname) {
  if (!response?.ok) return false;
  const type = String(response.headers.get('content-type') || '');
  if (/\.(?:m?js)$/i.test(pathname)) return !/text\/html/i.test(type);
  if (/\.css$/i.test(pathname)) return !/text\/html/i.test(type);
  return true;
}

async function cwCodePackageFetch(pathname) {
  const request = new Request(new URL(pathname, self.location.origin).href, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'x-civweave-package': 'code-coherence-install' }
  });
  const response = await fetch(request);
  if (!cwCodeValid(response, pathname)) throw new Error(`${pathname} returned an invalid code response.`);
  return response;
}

async function cwCodeInstall() {
  const cache = await caches.open(CW_CODE_COHERENCE_CACHE);
  const results = await Promise.allSettled(CW_CODE_CRITICAL.map(async pathname => {
    const key = cwCodeKey(pathname);
    const existing = await caches.match(key, { ignoreSearch: true });
    if (cwCodeValid(existing, pathname)) {
      await cache.put(key, existing.clone());
      return pathname;
    }
    const response = await cwCodePackageFetch(pathname);
    await cache.put(key, response.clone());
    return pathname;
  }));
  const loaded = results.filter(result => result.status === 'fulfilled').length;
  return { loaded, total: CW_CODE_CRITICAL.length };
}

async function cwCodeCleanup() {
  const names = await caches.keys();
  await Promise.all(names.map(name => name.startsWith(CW_CODE_COHERENCE_PREFIX) && name !== CW_CODE_COHERENCE_CACHE ? caches.delete(name) : Promise.resolve(false)));
}

self.addEventListener('install', event => {
  event.waitUntil(cwCodeInstall().catch(() => ({ loaded: 0, total: CW_CODE_CRITICAL.length })));
});

self.addEventListener('activate', event => {
  event.waitUntil(cwCodeCleanup());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (!cwCodeEligible(request, url)) return;
  event.stopImmediatePropagation();
  event.respondWith((async () => {
    const key = cwCodeKey(url.pathname);
    const cache = await caches.open(CW_CODE_COHERENCE_CACHE);
    const current = await cache.match(key, { ignoreSearch: true }) || await caches.match(key, { ignoreSearch: true });
    if (cwCodeValid(current, url.pathname)) {
      return request.method === 'HEAD'
        ? new Response(null, { status: current.status, statusText: current.statusText, headers: current.headers })
        : current;
    }
    return new Response(`Civweave code asset is not installed locally: ${url.pathname}`, {
      status: 503,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-civweave-local-first': 'package-required'
      }
    });
  })());
});

self.CivweaveCodeCoherenceV288 = Object.freeze({
  version: CW_CODE_COHERENCE_VERSION,
  cache: CW_CODE_COHERENCE_CACHE,
  critical: CW_CODE_CRITICAL.slice(),
  policy: 'explicit-package-install-cache-only-runtime',
  runtimeNetworkFallback: false
});
