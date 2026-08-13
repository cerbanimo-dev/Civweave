'use strict';

const CW_LOCAL_AI_COHERENCE_VERSION = 'local-ai-code-v307';
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

async function cwLocalAIFetch(pathnameOrRequest) {
  const request = typeof pathnameOrRequest === 'string'
    ? new Request(new URL(pathnameOrRequest, self.location.origin).href, { method: 'GET', cache: 'no-store', credentials: 'same-origin' })
    : new Request(pathnameOrRequest, { cache: 'no-store' });
  const response = await fetch(request);
  if (!cwLocalAIValid(response)) throw new Error(`${new URL(request.url).pathname} returned an invalid local-AI code response.`);
  return response;
}

async function cwLocalAIInstall() {
  const cache = await caches.open(CW_LOCAL_AI_COHERENCE_CACHE);
  const results = await Promise.allSettled(CW_LOCAL_AI_CRITICAL.map(async pathname => {
    const response = await cwLocalAIFetch(pathname);
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

  // This gate is imported before the generic code and shell handlers. Owning the
  // request here prevents query-string cache busters from being shadowed later
  // by pathname-keyed cache-first fallbacks while preserving offline startup.
  event.stopImmediatePropagation();
  event.respondWith((async () => {
    const cache = await caches.open(CW_LOCAL_AI_COHERENCE_CACHE);
    const key = cwLocalAIKey(url.pathname);
    try {
      const response = await cwLocalAIFetch(request);
      if (request.method === 'GET') await cache.put(key, response.clone());
      return request.method === 'HEAD'
        ? new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers })
        : response;
    } catch {
      const cached = await cache.match(key, { ignoreSearch: true }) || await caches.match(key, { ignoreSearch: true });
      if (cwLocalAIValid(cached)) {
        return request.method === 'HEAD'
          ? new Response(null, { status: cached.status, statusText: cached.statusText, headers: cached.headers })
          : cached;
      }
      return new Response(`Civweave local-AI code unavailable: ${url.pathname}`, {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});

self.CivweaveLocalAICodeCoherenceV307 = Object.freeze({
  version: CW_LOCAL_AI_COHERENCE_VERSION,
  cache: CW_LOCAL_AI_COHERENCE_CACHE,
  critical: CW_LOCAL_AI_CRITICAL.slice(),
  policy: 'network-first-current-bytes-offline-cache-fallback',
  smoothFitOrchestrator: true,
  ownsBeforeGenericCodeCoherence: true
});