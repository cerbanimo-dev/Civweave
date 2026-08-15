;(() => {
'use strict';

const V224_REVISION = 'navigation-redirect-safety-v224-local-first';
const MODEL_CACHE = `civweave-model-${VERSION}-on-demand-v208`;

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
  headers.set('x-civweave-local-first', 'cache-only-runtime');
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

function v224Missing(pathname, request, message = 'This Civweave capability is not installed on this device yet.') {
  const headers = new Headers({
    'content-type': request.mode === 'navigate' ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-civweave-local-first': 'package-required'
  });
  if (request.mode === 'navigate') {
    return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Civweave local package required</title><style>html,body{margin:0;min-height:100%;background:#07131e;color:#f5f7ff;font:16px/1.5 system-ui}main{max-width:42rem;margin:auto;padding:12vh 1.25rem}a{display:inline-block;margin-top:1rem;padding:.8rem 1rem;border-radius:.8rem;background:#1c3559;color:#fff;text-decoration:none}</style></head><body><main><h1>Local package required</h1><p>${message}</p><p>Civweave did not fetch missing runtime code from the network.</p><a href="/app/index.html?install=required&source=runtime-local-package-required">Open local package installer</a></main></body></html>`, { status: 503, headers });
  }
  return new Response(`Civweave local package required: ${pathname}`, { status: 503, headers });
}

networkFirst = async function localOnlyNetworkFirst(request, fallbackPath = '/offline.html') {
  const url = new URL(request.url);
  for (const pathname of [url.pathname, fallbackPath]) {
    const cached = await findCached(pathname);
    const normalized = await v224NormalizeResponse(cached, request);
    if (normalized) return normalized;
  }
  return v224Missing(url.pathname, request, 'The requested room is not present in this device package.');
};

stableAppEntry = async function localOnlyStableAppEntry(request) {
  const response = await findCached('/app/index.html');
  return await v224NormalizeResponse(response, request) || v224Missing('/app/index.html', request, 'The local Civweave launcher package is incomplete.');
};

cacheFirst = async function localOnlyCacheFirst(request) {
  const pathname = new URL(request.url).pathname;
  const cached = await findCached(pathname);
  return await v224NormalizeResponse(cached, request) || v224Missing(pathname, request);
};

modelOnDemand = async function explicitInstallOnlyModel(request) {
  const url = new URL(request.url);
  const cache = await caches.open(MODEL_CACHE);
  const key = cacheKey(url.pathname);
  const cached = await cache.match(key, { ignoreSearch: true }) || await caches.match(key, { ignoreSearch: true });
  if (cached) return cached;

  const packageIntent = String(request.headers.get('x-civweave-package') || '');
  if (!packageIntent) {
    return new Response('Local model package is not installed on this device.', {
      status: 503,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-civweave-model-package': 'not-installed',
        'x-civweave-local-first': 'package-required'
      }
    });
  }

  try {
    const response = await fetch(new Request(request, { cache: 'no-store' }));
    if (!responseLooksValid(response, url.pathname)) throw new Error(`Model asset returned ${response.status}`);
    if (request.method === 'GET') await cache.put(key, response.clone());
    return response;
  } catch (error) {
    return new Response(`Local model package acquisition failed: ${error?.message || error}`, {
      status: 503,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-civweave-model-package': 'not-installed',
        'x-civweave-local-first': 'package-acquisition-failed'
      }
    });
  }
};

self.CivweaveNavigationSafetyV224 = Object.freeze({
  revision: V224_REVISION,
  policy: 'cache-only-runtime-explicit-package-acquisition',
  runtimeNetworkFallback: false,
  modelRuntimeNetworkFallback: false
});

})();
