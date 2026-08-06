;(() => {
'use strict';

const V220_REVISION = 'release-coherence-v220';
const V220_NETWORK_TIMEOUT_MS = 4500;
const V220_VERSION_KEYS = ['v', 'version', 'revision', 'build'];
const V220_TEXT_ASSET = /\.(?:html?|css|m?js|json|webmanifest)$/i;
const V220_BOOT_PATHS = new Set([
  '/install-v130.js',
  '/app/index.html',
  '/app/installed-entry-v146.html',
  '/app/installed-entry-v146.js',
  '/app/install-boundary-v146.js',
  '/app/release-version-v1.js',
  '/app/manifest.webmanifest'
]);

const v220CachedFirst = cacheFirst;

function v220ReleasePinned(url) {
  return V220_BOOT_PATHS.has(url.pathname) || V220_VERSION_KEYS.some(key => url.searchParams.has(key));
}

async function v220FreshAsset(request, url) {
  const response = await withTimeout(
    fetch(new Request(request, { cache: 'no-store' })),
    V220_NETWORK_TIMEOUT_MS
  );
  if (!responseLooksValid(response, url.pathname)) {
    throw new Error(`${url.pathname} returned ${response?.status || 'an invalid response'}`);
  }
  if (request.method === 'GET') {
    await (await caches.open(RUNTIME_CACHE)).put(cacheKey(url.pathname), response.clone());
  }
  return request.method === 'HEAD'
    ? new Response(null, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })
    : response;
}

cacheFirst = async function releaseCoherentCacheFirst(request) {
  const url = new URL(request.url);
  const versionedText = (V220_TEXT_ASSET.test(url.pathname) || V220_BOOT_PATHS.has(url.pathname)) && v220ReleasePinned(url);
  if (versionedText) {
    try {
      return await v220FreshAsset(request, url);
    } catch {}
  }
  return v220CachedFirst(request);
};

self.CommonweaveReleaseCoherenceV220 = Object.freeze({
  revision: V220_REVISION,
  networkTimeoutMs: V220_NETWORK_TIMEOUT_MS,
  versionKeys: [...V220_VERSION_KEYS],
  bootPaths: [...V220_BOOT_PATHS],
  policy: 'version-pinned-text-network-first-cached-fallback'
});

})();
