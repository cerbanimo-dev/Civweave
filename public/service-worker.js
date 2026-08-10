'use strict';

const VERSION = '1.0.74';
const CORE_CACHE = `civweave-core-${VERSION}`;
const RUNTIME_CACHE = `civweave-runtime-${VERSION}`;
const CORE = Object.freeze([
  '/',
  '/index.html',
  '/app/',
  '/app/index.html',
  '/app/core.css',
  '/app/core.js',
  '/app/manifest.webmanifest',
  '/offline.html',
  '/app/logos/civweave-symbol.svg',
  '/app/assets/ai/weaveling.png',
  '/app/assets/ai/moss.png',
  '/app/assets/ai/kamiya.png',
  '/app/assets/ai/rook.png',
  '/app/assets/ai/merlin.png'
]);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('civweave-') && key !== CORE_CACHE && key !== RUNTIME_CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION') event.ports?.[0]?.postMessage({ type: 'CIVWEAVE_VERSION', version: VERSION, runtime: 'core-only' });
  if (event.data?.type === 'GET_DEVICE_PACKAGE_STATUS') event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    const keys = new Set((await cache.keys()).map((request) => new URL(request.url).pathname));
    const missing = CORE.map((url) => new URL(url, self.location.origin).pathname).filter((url) => !keys.has(url));
    event.ports?.[0]?.postMessage({ type: 'CIVWEAVE_DEVICE_PACKAGE', version: VERSION, runtime: 'core-only', ready: missing.length === 0, required: CORE.length, missing });
  })());
});

async function networkFirst(request, fallback = '/app/index.html') {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request, { ignoreSearch: true })) || (await caches.match(fallback, { ignoreSearch: true })) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && request.method === 'GET') {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
