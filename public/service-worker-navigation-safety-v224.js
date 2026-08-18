;(() => {
'use strict';

const V224_REVISION = 'navigation-redirect-safety-v224-persistent-shell-integrity-v1';
const V224_NAVIGATION_TIMEOUT_MS = 7000;
const V224_PERSISTENT_SHELL_PATH = '/app/persistent-family-shell-v1.html';
const V224_PERSISTENT_SHELL_MARKERS = [
  'CivweavePersistentFamilyShellV1',
  '<iframe id="cw-family-stage"'
];
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

async function v224PersistentShellValid(response, request) {
  if (!response?.ok) return false;
  const type = String(response.headers?.get?.('content-type') || '');
  if (type && !/text\/html/i.test(type)) return false;
  if (request.method === 'HEAD') return true;
  try {
    const text = await response.clone().text();
    return V224_PERSISTENT_SHELL_MARKERS.every(marker => text.includes(marker));
  } catch {
    return false;
  }
}

function v224PersistentShellRecovery(request) {
  const target = new URL('/app/working-campus-v156.html', self.location.origin);
  target.searchParams.set('installed', '1');
  target.searchParams.set('version', String(typeof VERSION === 'string' ? VERSION : '1.0.163'));
  target.searchParams.set('recovery', 'persistent-shell-integrity-v1');
  const href = `${target.pathname}${target.search}`;
  const body = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#061019"><title>Opening Civweave</title><style>html,body{margin:0;min-height:100%;background:#061019;color:#f5fbff;font:16px/1.5 system-ui}main{min-height:100vh;display:grid;place-items:center;text-align:center;padding:24px;box-sizing:border-box}p{color:#b8cad5}</style></head><body><main><div><strong>Opening Civweave…</strong><p>The navigation shell did not pass its integrity check, so Civweave is opening the Working Campus directly.</p></div></main><script>location.replace(${JSON.stringify(href)})<\/script><noscript><a href="${href}">Open Civweave</a></noscript></body></html>`;
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-civweave-navigation-normalized': V224_REVISION,
    'x-civweave-persistent-shell-recovery': 'working-campus-direct'
  };
  return request.method === 'HEAD'
    ? new Response(null, { status: 200, headers })
    : new Response(body, { status: 200, headers });
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
  const persistentShell = url.pathname === V224_PERSISTENT_SHELL_PATH;
  try {
    const response = await v224FreshNavigation(request);
    const valid = response?.ok && (!persistentShell || await v224PersistentShellValid(response, request));
    if (valid) {
      if (request.method === 'GET') {
        await (await caches.open(RUNTIME_CACHE)).put(cacheKey(url.pathname), response.clone());
      }
      return response;
    }
  } catch {}

  if (persistentShell) {
    const cached = await findCached(url.pathname);
    const normalized = await v224NormalizeResponse(cached, request);
    if (await v224PersistentShellValid(normalized, request)) return normalized;
    return v224PersistentShellRecovery(request);
  }

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
  persistentShellPath: V224_PERSISTENT_SHELL_PATH,
  persistentShellMarkers: [...V224_PERSISTENT_SHELL_MARKERS],
  policy: 'follow-internally-normalize-and-validate-persistent-shell-before-respond-with'
});

})();
