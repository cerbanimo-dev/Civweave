'use strict';

const CW_LOCAL_AI_COHERENCE_VERSION = 'local-ai-code-v322-ai-quest-source-authority';
const CW_LOCAL_AI_COHERENCE_CACHE = `civweave-local-ai-code-${CW_LOCAL_AI_COHERENCE_VERSION}`;
const CW_LOCAL_AI_COHERENCE_PREFIX = 'civweave-local-ai-code-';
const CW_LITERT_VENDOR_PREFIX = '/app/vendor/litert-lm/';
const CW_LOCAL_AI_HTML_PATHS = new Set(['/app/working-campus-v156.html']);
const CW_LOCAL_AI_EXTRA_PATHS = new Set([
  '/app/working-campus-v156.html',
  '/app/system-routes-v227.js',
  '/app/settings-gateway-v317.js',
  '/app/settings-local-route-v325.js',
  '/app/model-settings-controller-v173.js',
  '/app/family-ai-loader-v105.js',
  '/app/server-ai-router-v301.js',
  '/app/server-ai-output-normalizer-v1.js',
  '/app/shared-guide-surface-v236.js',
  '/app/guide-stream-thinking-v249.js',
  '/app/guide-forward-failure-policy-v1.js',
  '/app/guide-forward-failure-hardening-v1.js',
  '/app/local-provider-authority-v1.js',
  '/app/local-guide-control-bypass-v1.js',
  '/app/intention-planner-v141.js',
  '/app/weaveling-plan-materialization-v265.js',
  '/extensions/civweave-weaveling-plan-json-v190.js',
  '/app/working-campus-v156.part5.txt',
  '/app/local-chat-runtime-v295.js',
  '/app/local-chat-bounded-recovery-v1.js',
  '/app/local-chat-owner-v295.js',
  '/app/experience-orchestrator-v232.js',
  '/app/ai-capability-broker-v268.js',
  '/app/fast-interactive-runtime-v192.js',
  '/app/mobile-ai-hardening-v302.js',
  '/app/document-lifecycle-v221.js',
  '/app/guild-symbol-v1.js',
  '/app/working-campus-home-relocation-v441.js',
  '/app/mobile-guild-create-v1.mjs',
  '/app/host-node-local-capacity-v1.js',
  '/app/host-node-session-v1.js'
]);
const CW_LOCAL_AI_CRITICAL = [
  '/app/working-campus-v156.html',
  '/app/system-routes-v227.js',
  '/app/settings-gateway-v317.js',
  '/app/settings-local-route-v325.js',
  '/app/model-settings-controller-v173.js',
  '/app/family-ai-loader-v105.js',
  '/app/server-ai-router-v301.js',
  '/app/server-ai-output-normalizer-v1.js',
  '/app/shared-guide-surface-v236.js',
  '/app/guide-stream-thinking-v249.js',
  '/app/guide-forward-failure-policy-v1.js',
  '/app/guide-forward-failure-hardening-v1.js',
  '/app/local-provider-authority-v1.js',
  '/app/local-guide-control-bypass-v1.js',
  '/app/intention-planner-v141.js',
  '/app/weaveling-plan-materialization-v265.js',
  '/extensions/civweave-weaveling-plan-json-v190.js',
  '/app/working-campus-v156.part5.txt',
  '/app/local-chat-runtime-v295.js',
  '/app/local-chat-bounded-recovery-v1.js',
  '/app/local-chat-owner-v295.js',
  '/app/experience-orchestrator-v232.js',
  '/app/ai-capability-broker-v268.js',
  '/app/fast-interactive-runtime-v192.js',
  '/app/mobile-ai-hardening-v302.js',
  '/app/document-lifecycle-v221.js',
  '/app/guild-symbol-v1.js',
  '/app/working-campus-home-relocation-v441.js',
  '/app/mobile-guild-create-v1.mjs',
  '/app/host-node-local-capacity-v1.js',
  '/app/host-node-session-v1.js',
  '/app/local-ai/bootstrap-v266.js',
  '/app/local-ai/model-registry-v266.js',
  '/app/local-ai/gemma4-pack-extension-v1.js',
  '/app/local-ai/gemma4-litert-fast-extension-v1.js',
  '/app/local-ai/gemma4-inference-repair-v1.js',
  '/app/local-ai/litert-gemma4-fast-runtime-v1.js',
  '/app/local-ai/gemma4-e4b-q4-extension-v1.js',
  '/app/local-ai/gemma4-dual-q4-actions-v1.js',
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
  if (url.pathname.startsWith(CW_LITERT_VENDOR_PREFIX)) return /\.(?:m?js|wasm|json)$/i.test(url.pathname);
  if (CW_LOCAL_AI_EXTRA_PATHS.has(url.pathname)) return true;
  if (!/\.m?js$/i.test(url.pathname)) return false;
  return url.pathname.startsWith('/app/local-ai/');
}

function cwLocalAIValid(response, pathname = '') {
  if (!response?.ok) return false;
  const type = String(response.headers.get('content-type') || '');
  if (CW_LOCAL_AI_HTML_PATHS.has(pathname)) return /text\/html/i.test(type);
  return !/text\/html/i.test(type);
}

async function cwLocalAIFetch(pathnameOrRequest) {
  const request = typeof pathnameOrRequest === 'string'
    ? new Request(new URL(pathnameOrRequest, self.location.origin).href, { method: 'GET', cache: 'no-store', credentials: 'same-origin' })
    : new Request(pathnameOrRequest, { cache: 'no-store' });
  const pathname = new URL(request.url).pathname;
  const response = await fetch(request);
  if (!cwLocalAIValid(response, pathname)) throw new Error(`${pathname} returned an invalid current-code response.`);
  return response;
}

async function cwLocalAIInstall() {
  const cache = await caches.open(CW_LOCAL_AI_COHERENCE_CACHE);
  const results = await Promise.allSettled(CW_LOCAL_AI_CRITICAL.map(async pathname => {
    const response = await cwLocalAIFetch(pathname);
    await cache.put(cwLocalAIKey(pathname), response.clone());
    return pathname;
  }));
  return { loaded: results.filter(result => result.status === 'fulfilled').length, total: CW_LOCAL_AI_CRITICAL.length };
}

async function cwLocalAICleanup() {
  const names = await caches.keys();
  await Promise.all(names.map(name => name.startsWith(CW_LOCAL_AI_COHERENCE_PREFIX) && name !== CW_LOCAL_AI_COHERENCE_CACHE ? caches.delete(name) : Promise.resolve(false)));
}

self.addEventListener('install', event => { event.waitUntil(Promise.resolve()); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); void cwLocalAICleanup().catch(() => null); });
self.addEventListener('message', event => {
  if (event.data?.type !== 'CIVWEAVE_WARM_LOCAL_AI_CODE') return;
  event.waitUntil(cwLocalAIInstall().then(packet => {
    const reply = { type: 'CIVWEAVE_LOCAL_AI_CODE_WARMED', version: CW_LOCAL_AI_COHERENCE_VERSION, ...packet };
    try { event.ports?.[0]?.postMessage(reply); } catch {}
    try { event.source?.postMessage?.(reply); } catch {}
  }));
});

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (!cwLocalAIEligible(request, url)) return;
  event.stopImmediatePropagation();
  event.respondWith((async () => {
    const cache = await caches.open(CW_LOCAL_AI_COHERENCE_CACHE), key = cwLocalAIKey(url.pathname);
    try {
      const response = await cwLocalAIFetch(request);
      if (request.method === 'GET') await cache.put(key, response.clone());
      return request.method === 'HEAD' ? new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers }) : response;
    } catch {
      const cached = await cache.match(key, { ignoreSearch: true }) || await caches.match(key, { ignoreSearch: true });
      if (cwLocalAIValid(cached, url.pathname)) return request.method === 'HEAD' ? new Response(null, { status: cached.status, statusText: cached.statusText, headers: cached.headers }) : cached;
      return new Response(`Civweave current code unavailable: ${url.pathname}`, { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  })());
});

self.CivweaveLocalAICodeCoherenceV307 = Object.freeze({
  version: CW_LOCAL_AI_COHERENCE_VERSION,
  cache: CW_LOCAL_AI_COHERENCE_CACHE,
  critical: CW_LOCAL_AI_CRITICAL.slice(),
  extraPaths: Object.freeze([...CW_LOCAL_AI_EXTRA_PATHS]),
  htmlPaths: Object.freeze([...CW_LOCAL_AI_HTML_PATHS]),
  liteRtVendorPrefix: CW_LITERT_VENDOR_PREFIX,
  policy: 'network-first-current-bytes-offline-cache-fallback',
  installPolicy: 'lifecycle-deferred-capability-on-demand',
  warmMessage: 'CIVWEAVE_WARM_LOCAL_AI_CODE',
  smoothFitOrchestrator: true,
  ownsBeforeGenericCodeCoherence: true,
  bootstrapCapabilityReadiness: true,
  guildDiscoveryCoherent: true,
  legacyMobileGuildLocationCoherent: true,
  guildChatUsageCoherent: true,
  guildLoginRuntimeCoherent: true,
  boundedLocalRecoveryCoherent: true,
  sharedGuideCurrentBytes: true,
  guideStreamCurrentBytes: true,
  localProviderAuthorityCurrentBytes: true,
  localGuideControlCurrentBytes: true,
  intentionPlannerCurrentBytes: true,
  questAIOrchestratorCurrentBytes: true,
  questAIMaterializerCurrentBytes: true,
  workingCampusQuestPageCurrentBytes: true,
  workingCampusQuestSyncCurrentBytes: true,
  forwardFailureQuestBoundaryCurrentBytes: true,
  serverAIOutputNormalizerCurrentBytes: true,
  gemma4CompatibleQ4Coherent: true,
  gemma4PackCoreCoherent: true,
  gemma4LiteRTFastCodeCoherent: true,
  gemma4InferenceRepairCoherent: true,
  liteRtVendorRuntimeNetworkFirst: true,
  liteRtVendorRuntimeEagerInstall: false,
  gemma4E4BQ4Coherent: true,
  gemma4IndependentQ4UseCoherent: true,
  gemma4Q2OptionalExtensionCoherent: true
});