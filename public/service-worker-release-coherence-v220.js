;(() => {
'use strict';

const V220_REVISION = 'release-coherence-v226-local-first';
const V220_VERSION_KEYS = ['v', 'version', 'revision', 'build'];
const V220_TEXT_ASSET = /\.(?:html?|css|m?js|json|webmanifest|txt)$/i;
const V220_BOOT_PATHS = new Set([
  '/install-v130.js',
  '/app/index.html',
  '/app/installed-entry-v146.html',
  '/app/installed-entry-v146.js',
  '/app/install-boundary-v146.js',
  '/app/document-lifecycle-v221.js',
  '/app/working-campus-v156.html',
  '/app/working-campus-v156.js',
  '/app/working-campus-v156.part1.txt',
  '/app/working-campus-v156.part2.txt',
  '/app/working-campus-v156.part3.txt',
  '/app/working-campus-v156.part4.txt',
  '/app/working-campus-v156.part5.txt',
  '/app/release-version-v1.js',
  '/app/manifest.webmanifest'
]);

const v220CachedFirst = cacheFirst;

function v220ReleasePinned(url) {
  return V220_BOOT_PATHS.has(url.pathname) || V220_VERSION_KEYS.some(key => url.searchParams.has(key));
}

cacheFirst = async function releaseCoherentCacheOnly(request) {
  const url = new URL(request.url);
  const versionedText = (V220_TEXT_ASSET.test(url.pathname) || V220_BOOT_PATHS.has(url.pathname)) && v220ReleasePinned(url);
  const response = await v220CachedFirst(request);
  if (!versionedText || response?.ok) return response;
  return new Response(`Civweave release asset is not installed locally: ${url.pathname}`, {
    status: 503,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-civweave-local-first': 'package-required'
    }
  });
};

self.CivweaveReleaseCoherenceV220 = Object.freeze({
  revision: V220_REVISION,
  versionKeys: [...V220_VERSION_KEYS],
  bootPaths: [...V220_BOOT_PATHS],
  policy: 'version-pinned-cache-only-runtime-explicit-update-only',
  runtimeNetworkFallback: false
});

})();
