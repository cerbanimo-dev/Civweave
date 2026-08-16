'use strict';

const REVISION = 'desktop-installability-v1';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(request));
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'GET_CIVWEAVE_INSTALLABILITY_WORKER') return;
  const packet = { type: 'CIVWEAVE_INSTALLABILITY_WORKER', revision: REVISION };
  try { event.ports?.[0]?.postMessage(packet); } catch {}
  try { event.source?.postMessage?.(packet); } catch {}
});
