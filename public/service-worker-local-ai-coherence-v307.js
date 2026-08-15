'use strict';

const CW_LOCAL_AI_COHERENCE_VERSION = 'local-ai-code-v307-local-first';
const CW_LOCAL_AI_COHERENCE_CACHE = `civweave-local-ai-code-${CW_LOCAL_AI_COHERENCE_VERSION}`;
const CW_LOCAL_AI_COHERENCE_PREFIX = 'civweave-local-ai-code-';
const CW_LOCAL_AI_EXTRA_PATHS = new Set([
  '/app/settings-gateway-v317.js',
  '/app/family-ai-loader-v105.js',
  '/app/local-chat-runtime-v295.js',
  '/app/local-chat-owner-v295.js',
  '/app/experience-orchestrator-v232.js',
  '/app/ai-capability-broker-v268.js',
  '/app/fast-interactive-runtime-v192.js',
  '/app/mobile-ai-hardening-v302.js',
  '/app/document-lifecycle-v221.js'
]);
const CW_LOCAL_AI_CRITICAL = [
  '/app/settings-gateway-v317.js',
  '/app/family-ai-loader-v105.js',
  '/app/local-chat-runtime-v295.js',
  '/app/local-chat-owner-v295.js',
  '/app/experience-orchestrator-v232.js',
  '/app/ai-capability-broker-v268.js',
  '/app/fast-interactive-runtime-v192.js',
  '/app/mobile-ai-hardening-v302.js',
  '/app/document-lifecycle-v221.js',
  '/app/local-ai/bootstrap-v266.js',
  '/app/local-ai/model-registry-v266.js',
  '/app/local-ai/download-manager-v267.js',
  '/app/local-ai/package-revision-guard-v307.js',
  '/app/local-ai/download-policy-v278.js',
  '/app/local-ai/metadata-repair-v276.js',
  '/app/local-ai/small-model-policy-v283.js',
  '/app/local-ai/runtime-v266.js',
  '/app/local-ai/runtime-bridge-v266.js',
  '/app/local-ai/settings-panel-v267.js',
  '/app/local-ai/primary-route-v283.js',
  '/app/local-ai/hardware-tier-ui-v278.js',
  '/app/local-ai/test-pulse-v269.js'
];

function cwLocalAIKey(pathname) {
  return new Request(new URL(pathname, self.location.origin).href, { method: 'GET' });
}

function cwLocalAIEligible(request, url) {
  if (!['GET', 'HEAD'].includes(request.method)) return false;
  if (url.origin !== self.location.origin) return false;
  if (!/\.js$/i.test(url.pathname)) return false;
  return url.pathname.startsWith('/app/local-ai/') || CW_LOCAL_AI_EXTRA_PATHS.has(url.pathname);
}

function cwLocalAIValid(response) {
  if (!response?.ok) return false;
  return !/text\/html/i.test(String(response.headers.get('content-type') || ''));
}

async function cwLocalAIPackageFetch(pathname) {
  const request = new Request(new URL(pathname, self.location.origin).href, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'x-civweave-package': 'local-ai-code-install' }
  });
  const response = await fetch(request);
  if (!cwLocalAIValid(response)) throw new Error(`${pathname} returned an invalid local-AI code response.`);
  return response;
}

async function cwLocalAIInstall() {
  const cache = await caches.open(CW_LOCAL_AI_COHERENCE_CACHE);
  const results = await Promise.allSettled(CW_LOCAL_AI_CRITICAL.map(async pathname => {
    const existing = await caches.match(cwLocalAIKey(pathname), { ignoreSearch: true });
    if (cwLocalAIValid(existing)) {
      await cache.put(cwLocalAIKey(pathname), existing.clone());
      return pathname;
    }
    const response = await cwLocalAIPackageFetch(pathname);
    await cache.put(cwLocalAIKey(pathname), response.clone());
    return pathname;
  }));
  return {
    loaded: results.filter(result => result.status === 'fulfilled').length,
    total: CW_LOCAL_AI_CRITICAL.length
  };
}

async function cwLocalAICleanup() {
  const names = await caches.keys();
  await Promise.all(names.map(name => (
    name.startsWith(CW_LOCAL_AI_COHERENCE_PREFIX) && name !== CW_LOCAL_AI_COHERENCE_CACHE
      ? caches.delete(name)
      : Promise.resolve(false)
  )));
}

self.addEventListener('install', event => {
  event.waitUntil(cwLocalAIInstall().catch(() => ({ loaded: 0, total: CW_LOCAL_AI_CRITICAL.length })));
});

self.addEventListener('activate', event => {
  event.waitUntil(cwLocalAICleanup());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (!cwLocalAIEligible(request, url)) return;

  event.stopImmediatePropagation();
  event.respondWith((async () => {
    const cache = await caches.open(CW_LOCAL_AI_COHERENCE_CACHE);
    const key = cwLocalAIKey(url.pathname);
    const cached = await cache.match(key, { ignoreSearch: true }) || await caches.match(key, { ignoreSearch: true });
    if (cwLocalAIValid(cached)) {
      return request.method === 'HEAD'
        ? new Response(null, { status: cached.status, statusText: cached.statusText, headers: cached.headers })
        : cached;
    }
    return new Response(`Civweave local-AI code is not installed locally: ${url.pathname}`, {
      status: 503,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-civweave-local-first': 'package-required'
      }
    });
  })());
});

self.CivweaveLocalAICodeCoherenceV307 = Object.freeze({
  version: CW_LOCAL_AI_COHERENCE_VERSION,
  cache: CW_LOCAL_AI_COHERENCE_CACHE,
  critical: CW_LOCAL_AI_CRITICAL.slice(),
  policy: 'explicit-package-install-cache-only-runtime',
  runtimeNetworkFallback: false,
  smoothFitOrchestrator: true,
  ownsBeforeGenericCodeCoherence: true
});