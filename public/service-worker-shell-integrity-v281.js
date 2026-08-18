;(() => {
'use strict';

const REVISION = 'shell-integrity-v281-required-only-install-v2';
const INTEGRITY_URL = '/app/shell-integrity-v281.json';
const STAGING_CACHE = `${SHELL_CACHE}-staging-v281`;
let lastKnownGoodCache = null;

function localDevelopmentHost() {
  return ['localhost', '127.0.0.1', '::1'].includes(self.location.hostname);
}

async function sha256(response) {
  const bytes = await response.clone().arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function loadIntegrityManifest() {
  try {
    const response = await fetchFresh(INTEGRITY_URL, 'shell-integrity', FETCH_TIMEOUT_MS);
    const manifest = await response.clone().json();
    if (manifest?.version !== VERSION) {
      throw new Error(`Shell integrity metadata is for ${manifest?.version || 'an unknown release'}, not ${VERSION}.`);
    }
    if (manifest?.algorithm !== 'sha256' || !manifest.assets || typeof manifest.assets !== 'object') {
      throw new Error('Shell integrity metadata is malformed.');
    }
    for (const pathname of REQUIRED_SHELL_ASSETS) {
      if (!/^[a-f0-9]{64}$/i.test(String(manifest.assets[pathname] || ''))) {
        throw new Error(`Shell integrity metadata is missing ${pathname}.`);
      }
    }
    return { manifest, response };
  } catch (error) {
    if (localDevelopmentHost()) return { manifest: null, response: null, developmentBypass: true };
    throw error;
  }
}

function versionFromShellCache(name) {
  const match = /^civweave-shell-(\d+)\.(\d+)\.(\d+)-/.exec(name);
  return match ? match.slice(1, 4).map(Number) : null;
}

function compareVersionsDesc(left, right) {
  const a = versionFromShellCache(left) || [-1, -1, -1];
  const b = versionFromShellCache(right) || [-1, -1, -1];
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return b[index] - a[index];
  }
  return String(right).localeCompare(String(left));
}

async function previousShellCache() {
  const names = await caches.keys();
  return names
    .filter(name => name.startsWith('civweave-shell-') && name !== SHELL_CACHE && name !== STAGING_CACHE)
    .sort(compareVersionsDesc)[0] || null;
}

findCached = async function findCachedV281(pathname) {
  const key = cacheKey(pathname);
  for (const name of [SHELL_CACHE, RUNTIME_CACHE, OFFLINE_CACHE]) {
    const response = await (await caches.open(name)).match(key, { ignoreSearch: true });
    if (responseLooksValid(response, pathname)) return response;
  }
  if (!lastKnownGoodCache) lastKnownGoodCache = await previousShellCache();
  if (lastKnownGoodCache) {
    const fallback = await (await caches.open(lastKnownGoodCache)).match(key, { ignoreSearch: true });
    if (responseLooksValid(fallback, pathname)) return fallback;
  }
  const response = await caches.match(key, { ignoreSearch: true });
  return responseLooksValid(response, pathname) ? response : null;
};

cacheShell = async function cacheShellV281() {
  const integrity = await loadIntegrityManifest();
  await caches.delete(STAGING_CACHE);
  const stage = await caches.open(STAGING_CACHE);
  const failures = [];

  // Activation is gated only by the declared required shell. Optional AI,
  // knowledge, media, diagnostics, Guild Quest, and human-chat assets are
  // intentionally fetched on demand after activation. Waiting on those files
  // here made a "lightweight" install capable of spending multiple 12-second
  // timeout windows in the installing state on mobile devices.
  for (let index = 0; index < REQUIRED_SHELL_ASSETS.length; index += 4) {
    const batch = REQUIRED_SHELL_ASSETS.slice(index, index + 4);
    const results = await Promise.allSettled(batch.map(async pathname => {
      const response = await fetchFresh(pathname, 'shell-install-required');
      if (integrity.manifest) {
        const expected = String(integrity.manifest.assets[pathname] || '').toLowerCase();
        const actual = await sha256(response);
        if (actual !== expected) throw new Error(`Integrity mismatch for ${pathname}.`);
      }
      await stage.put(cacheKey(pathname), response.clone());
    }));
    results.forEach((result, offset) => {
      if (result.status === 'rejected') failures.push({ pathname: batch[offset], message: result.reason?.message || String(result.reason) });
    });
  }

  if (failures.length) {
    await caches.delete(STAGING_CACHE);
    const error = new Error(`Verified app shell incomplete: ${failures.length}/${REQUIRED_SHELL_ASSETS.length} required files failed.`);
    error.failures = failures;
    error.integrityRevision = REVISION;
    throw error;
  }

  const target = await caches.open(SHELL_CACHE);
  for (const request of await stage.keys()) {
    const response = await stage.match(request);
    if (response) await target.put(request, response.clone());
  }
  if (integrity.response) await target.put(cacheKey(INTEGRITY_URL), integrity.response.clone());
  await caches.delete(STAGING_CACHE);

  return {
    optionalFailures: [],
    optionalDeferred: OPTIONAL_SHELL_ASSETS.length,
    integrity: integrity.developmentBypass ? 'development-bypass' : 'verified',
    integrityRevision: REVISION
  };
};

const baseShellStatusV281 = shellStatus;
shellStatus = async function shellStatusV281() {
  const packet = await baseShellStatusV281();
  lastKnownGoodCache = await previousShellCache();
  return {
    ...packet,
    integrityRevision: REVISION,
    integrityRequired: !localDevelopmentHost(),
    lastKnownGoodCache,
    optionalInstallPolicy: 'deferred-on-demand',
    fallbackPolicy: 'current-caches-then-last-known-good-shell'
  };
};

cleanLegacyCaches = async function cleanLegacyCachesV281() {
  await migrateOfflineCaches();
  lastKnownGoodCache = await previousShellCache();
  const keep = new Set([SHELL_CACHE, RUNTIME_CACHE, OFFLINE_CACHE]);
  if (lastKnownGoodCache) keep.add(lastKnownGoodCache);
  const names = await caches.keys();
  await Promise.all(names.map(name => {
    if (keep.has(name) || name === STAGING_CACHE || preserveCache(name)) return Promise.resolve(false);
    if (APP_CACHE_PREFIXES.some(prefix => name.startsWith(prefix))) return caches.delete(name);
    if (/^(living-school|cerbanimo|fellowfare|anarchadia)-/.test(name)) return caches.delete(name);
    return Promise.resolve(false);
  }));
  await caches.delete(STAGING_CACHE);
};

self.CivweaveShellIntegrityV281 = Object.freeze({
  revision: REVISION,
  integrityUrl: INTEGRITY_URL,
  stagingCache: STAGING_CACHE,
  optionalInstallPolicy: 'deferred-on-demand',
  fallbackPolicy: 'current-caches-then-last-known-good-shell',
  get lastKnownGoodCache() { return lastKnownGoodCache; }
});
})();
