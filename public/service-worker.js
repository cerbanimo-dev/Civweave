'use strict';

// Root-scope compatibility entry for devices that installed Civweave before
// the lightweight v203 worker became canonical. Android can retain a site's
// service-worker registration and CacheStorage after the PWA icon is removed,
// so this path must never contain a frozen historical app shell.
const CIVWEAVE_ROOT_WORKER_BRIDGE='root-worker-bridge-v1';

self.addEventListener('install',event=>{
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate',event=>{
  event.waitUntil(self.clients.claim());
});

importScripts('/service-worker-v203.js?v=root-worker-bridge-v1-current');
