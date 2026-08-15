'use strict';

const VERSION = '1.0.160';
const BUILD = 'installer-bootstrap-v1-local-first';
const CACHE = `civweave-install-${VERSION}-${BUILD}`;
const SHELL = [
  '/app/index.html',
  '/install-v130.css',
  '/install-v130.js',
  '/app/manifest.webmanifest',
  '/app/installed-entry-v146.html',
  '/app/installed-entry-v146.js',
  '/app/legal-consent-v1.js',
  '/legal/civweave-legal-release-v1.json',
  '/app/japanese-mode-v1.js',
  '/app/japanese-shell-copy-v1.js',
  '/app/logos/civweave-pwa-192-v247.png'
];
const INSTALLER_PATHS = new Set(['/', '/index.html', '/app/index.html']);

const keyFor = pathname => new Request(new URL(pathname, self.location.origin).href, { method: 'GET' });

async function notifyProgress(completed, total, bytes, pathname) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const packet = { type: 'CIVWEAVE_INSTALL_SHELL_PROGRESS', completed, total, bytes, pathname };
  clients.forEach(client => client.postMessage(packet));
}

async function cacheShell() {
  const cache = await caches.open(CACHE);
  let completed = 0;
  let bytes = 0;
  await notifyProgress(0, SHELL.length, 0, '');
  for (const pathname of SHELL) {
    const response = await fetch(new Request(pathname, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'x-civweave-package': 'bootstrap-install' }
    }));
    if (!response.ok) throw new Error(`Installer shell fetch failed: ${pathname} (${response.status})`);
    const length = Number(response.headers.get('content-length') || 0);
    if (Number.isFinite(length) && length > 0) bytes += length;
    await cache.put(keyFor(pathname), response.clone());
    completed += 1;
    await notifyProgress(completed, SHELL.length, bytes, pathname);
  }
}

async function status() {
  const cache = await caches.open(CACHE);
  let present = 0;
  const missing = [];
  for (const pathname of SHELL) {
    if (await cache.match(keyFor(pathname), { ignoreSearch: true })) present += 1;
    else missing.push(pathname);
  }
  return {
    type: 'CIVWEAVE_DEVICE_PACKAGE',
    mode: 'lightweight-shell',
    bootstrap: true,
    localFirst: true,
    runtimeNetworkFallback: false,
    version: VERSION,
    revision: BUILD,
    ready: missing.length === 0,
    assetCount: SHELL.length,
    presentCount: present,
    optionalAssetCount: 0,
    optionalPresentCount: 0,
    missing,
    offlinePackageOptional: false,
    localCampusRequiredForLaunch: true,
    modelOnDemand: true,
    knowledgeLibrarySeparate: true
  };
}

async function requestFromInstaller(clientId) {
  if (!clientId) return false;
  try {
    const client = await self.clients.get(clientId);
    if (!client?.url) return false;
    const url = new URL(client.url);
    return url.origin === self.location.origin && INSTALLER_PATHS.has(url.pathname);
  } catch {
    return false;
  }
}

function explicitPackageRequest(request) {
  return Boolean(request.headers.get('x-civweave-package'));
}

function localPackageMissing(pathname) {
  return new Response(JSON.stringify({
    error: 'LOCAL_PACKAGE_REQUIRED',
    pathname,
    message: 'This Civweave capability is not installed on this device. Open the local package installer to add it.'
  }), {
    status: 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-civweave-local-first': 'package-required'
    }
  });
}

self.addEventListener('install', event => {
  event.waitUntil(cacheShell());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('civweave-install-') && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const type = event.data?.type;
  if (type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (type === 'GET_DEVICE_PACKAGE_STATUS') {
    event.waitUntil(status().then(packet => event.ports?.[0]?.postMessage(packet)));
    return;
  }
  if (type === 'GET_OFFLINE_PACKAGE_STATUS') {
    event.ports?.[0]?.postMessage({
      type: 'CIVWEAVE_OFFLINE_PACKAGE_STATUS',
      ready: false,
      running: false,
      completed: 0,
      total: 0,
      failed: [],
      failedCount: 0,
      bytes: 0,
      bootstrap: true,
      localFirst: true,
      requiredForLaunch: true
    });
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    const installerRequest = await requestFromInstaller(event.clientId);
    const packageRequest = explicitPackageRequest(request);
    if (!installerRequest && !packageRequest) {
      if (request.mode === 'navigate') {
        const entry = await caches.match(keyFor('/app/installed-entry-v146.html'), { ignoreSearch: true });
        if (entry) return entry;
      }
      return localPackageMissing(url.pathname);
    }

    try {
      return await fetch(request);
    } catch (error) {
      if (request.mode === 'navigate') {
        const entry = await caches.match(keyFor('/app/installed-entry-v146.html'), { ignoreSearch: true });
        if (entry) return entry;
      }
      throw error;
    }
  })());
});
