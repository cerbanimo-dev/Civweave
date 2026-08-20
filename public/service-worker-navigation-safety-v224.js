;(() => {
'use strict';

const V224_REVISION = 'navigation-redirect-safety-v224-direct-system-pages-v2';
const V224_NAVIGATION_TIMEOUT_MS = 7000;
const v224OriginalCacheFirst = cacheFirst;
const v224OriginalStableAppEntry = stableAppEntry;

function v224NeedsNormalization(request, response) {
  return request.mode === 'navigate'
    || request.redirect !== 'follow'
    || response.redirected
    || response.headers?.has?.('location');
}

async function v224NormalizeResponse(response, request) {
  if (!response || response.type === 'opaqueredirect' || response.status === 0) return null;
  if (response.status >= 300 && response.status < 400) return null;
  if (!v224NeedsNormalization(request, response)) return response;

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('location');
  headers.set('x-civweave-navigation-normalized', V224_REVISION);
  if (request.mode === 'navigate' && !headers.get('content-type')) {
    headers.set('content-type', 'text/html; charset=utf-8');
  }

  const bodyless = request.method === 'HEAD' || response.status === 204 || response.status === 205;
  const body = bodyless ? null : await response.clone().arrayBuffer();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function v224FollowedRequest(request) {
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'follow'
  });
}

async function v224FreshNavigation(request) {
  const response = await withTimeout(fetch(v224FollowedRequest(request)), V224_NAVIGATION_TIMEOUT_MS);
  return v224NormalizeResponse(response, request);
}

networkFirst = async function navigationSafeNetworkFirst(request, fallbackPath = '/offline.html') {
  const url = new URL(request.url);
  try {
    const response = await v224FreshNavigation(request);
    if (response?.ok) {
      if (request.method === 'GET') {
        await (await caches.open(RUNTIME_CACHE)).put(cacheKey(url.pathname), response.clone());
      }
      return response;
    }
  } catch {}

  for (const pathname of [url.pathname, fallbackPath]) {
    const cached = await findCached(pathname);
    const normalized = await v224NormalizeResponse(cached, request);
    if (normalized) return normalized;
  }

  return new Response('Civweave could not load this room from the network or its offline package.', {
    status: 503,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-civweave-navigation-normalized': V224_REVISION
    }
  });
};

stableAppEntry = async function navigationSafeStableAppEntry(request) {
  const response = await v224OriginalStableAppEntry(request);
  return await v224NormalizeResponse(response, request) || new Response('Civweave launcher is unavailable.', {
    status: 503,
    headers: {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store'}
  });
};

cacheFirst = async function navigationSafeCacheFirst(request) {
  const response = await v224OriginalCacheFirst(request);
  return await v224NormalizeResponse(response, request) || new Response(`Civweave asset unavailable: ${new URL(request.url).pathname}`, {
    status: 503,
    headers: {'content-type': 'text/plain; charset=utf-8'}
  });
};

self.CivweaveNavigationSafetyV224 = Object.freeze({
  revision: V224_REVISION,
  navigationTimeoutMs: V224_NAVIGATION_TIMEOUT_MS,
  iframeShell:false,
  policy: 'follow-internally-normalize-direct-system-pages'
});

})();
