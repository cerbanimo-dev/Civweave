;(() => {
'use strict';

const V305_REVISION = 'radio-core-shell-v305';
const V305_REQUIRED_ASSETS = Object.freeze([
  '/app/install-boundary-v146.js',
  '/app/experience-orchestrator-v232.js',
  '/app/system-radio-agent-v233.js',
  '/app/radio-track-suggestions-v240.js',
  '/app/radio-track-map-v241.json',
  '/app/radio-directory-v240/civweave.txt',
  '/app/radio-directory-v240/living-school.txt',
  '/app/radio-directory-v240/cerbanimo.txt',
  '/app/radio-directory-v240/fellowfare.txt',
  '/app/radio-directory-v240/anarchadia.txt'
]);
const V305_STAGING_CACHE = `${SHELL_CACHE}-radio-v305-staging`;

async function v305CacheRadioCore() {
  await caches.delete(V305_STAGING_CACHE);
  const stage = await caches.open(V305_STAGING_CACHE);
  const failures = [];

  for (let index = 0; index < V305_REQUIRED_ASSETS.length; index += 4) {
    const batch = V305_REQUIRED_ASSETS.slice(index, index + 4);
    const results = await Promise.allSettled(batch.map(async pathname => {
      const response = await fetchFresh(pathname, 'radio-core-shell', FETCH_TIMEOUT_MS);
      await stage.put(cacheKey(pathname), response.clone());
    }));
    results.forEach((result, offset) => {
      if (result.status === 'rejected') {
        failures.push({ pathname: batch[offset], message: result.reason?.message || String(result.reason) });
      }
    });
  }

  if (failures.length) {
    await caches.delete(V305_STAGING_CACHE);
    const error = new Error(`Radio core incomplete: ${failures.length}/${V305_REQUIRED_ASSETS.length} required files failed.`);
    error.failures = failures;
    error.radioRevision = V305_REVISION;
    throw error;
  }

  const target = await caches.open(SHELL_CACHE);
  for (const request of await stage.keys()) {
    const response = await stage.match(request);
    if (response) await target.put(request, response.clone());
  }
  await caches.delete(V305_STAGING_CACHE);

  return {
    revision: V305_REVISION,
    ready: true,
    assetCount: V305_REQUIRED_ASSETS.length,
    assets: [...V305_REQUIRED_ASSETS]
  };
}

async function v305RadioCoreStatus() {
  const cache = await caches.open(SHELL_CACHE);
  const missing = [];
  for (const pathname of V305_REQUIRED_ASSETS) {
    const response = await cache.match(cacheKey(pathname), { ignoreSearch: true });
    if (!responseLooksValid(response, pathname)) missing.push(pathname);
  }
  return {
    revision: V305_REVISION,
    ready: missing.length === 0,
    assetCount: V305_REQUIRED_ASSETS.length,
    presentCount: V305_REQUIRED_ASSETS.length - missing.length,
    missing
  };
}

const V305_BASE_CACHE_SHELL = cacheShell;
cacheShell = async function cacheShellWithRadioCoreV305() {
  const base = await V305_BASE_CACHE_SHELL();
  const radio = await v305CacheRadioCore();
  return {
    ...base,
    radioCore: 'required-cached',
    radioRevision: V305_REVISION,
    radioRequiredAssetCount: radio.assetCount
  };
};

const V305_BASE_SHELL_STATUS = shellStatus;
shellStatus = async function shellStatusWithRadioCoreV305() {
  const [packet, radio] = await Promise.all([
    V305_BASE_SHELL_STATUS(),
    v305RadioCoreStatus()
  ]);
  return {
    ...packet,
    ready: Boolean(packet.ready) && radio.ready,
    radioCoreReady: radio.ready,
    radioRevision: V305_REVISION,
    radioRequiredAssetCount: radio.assetCount,
    radioPresentCount: radio.presentCount,
    radioMissing: radio.missing
  };
};

self.CivweaveRadioCoreV305 = Object.freeze({
  revision: V305_REVISION,
  requiredAssets: V305_REQUIRED_ASSETS,
  status: v305RadioCoreStatus,
  repair: v305CacheRadioCore
});
})();
