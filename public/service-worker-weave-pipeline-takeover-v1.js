;(()=>{
'use strict';
const REVISION='weave-pipeline-takeover-v1-r46';
const STAGING_HOST='civweave-staging.pages.dev';
const CACHE='cwrecovery-v485-responsive-chat';
const MARKER='/__civweave/weave-pipeline-takeover-v1-r46';
const PURGE_PATHS=new Set([
  '/app/persistent-system-shell-v1.html',
  '/app/persistent-system-shell-v1.js',
  '/app/working-campus-v440.html',
  '/app/shared-guide-surface-v236.js',
  '/app/human-message-bubble-v1.js',
  '/app/shared-chat-face-icons-v255.js',
  '/app/themed-system-nav-v178.js',
  '/app/persistent-shell-actions-v1.js',
  '/app/platform-experience-v160.css',
  '/app/host-node-session-v1.js',
  '/app/guild-chat-usage-v1.js',
  '/app/human-chat-ble-controls-v1.js',
  '/app/minilm-response-router-v347.js',
  '/app/minilm-decision-strip-v1.js',
  '/app/experience-orchestrator-v232.js',
  '/app/emergency-ai-host-control-v1.mjs',
  '/app/cabinets/living-school/index.html',
  '/app/cabinets/living-school/',
  '/app/local-provider-authority-v1.js',
  '/app/guide-chat-surface-v350.js',
  '/app/guide-generation-tracker-v1.js',
  '/app/generation-lifecycle-v1.js',
  '/app/generation-lifecycle-v2.js',
  '/app/local-guide-control-bypass-v1.js',
  '/app/unified-chat-system-v1.js',
  '/app/generation-failure-inspector-v1.js',
  '/app/family-ai-loader-v105.js',
  '/app/local-ai/litert-gemma4-fast-runtime-v1.js',
  '/app/local-ai/litert-gpu-worker-smoke-v1.js',
  '/app/local-ai/litert-gpu-worker-test-v1.html',
  '/app/local-ai/llama32-two-pass-test-v4.html',
  '/app/local-ai/llama32-diagnostic-worker-v4.js',
  '/app/local-ai/llama32-diagnostic-worker-v3.js',
  '/app/local-ai/worker-v266.js',
  '/app/local-ai/llama32-chunked-model-storage-v1.js',
  '/app/local-ai/download-manager-v267.js',
  '/app/local-chat-runtime-v295.js',
  '/app/local-ai/model-registry-v266.js',
  '/app/local-ai/model-performance-observer-v1.js',
  '/app/local-ai/settings-panel-v267.js',
  '/app/settings-direct-entry-v339.js',
  '/app/settings-local-loader-v337.js',
  '/app/settings-local-route-v325.js',
  '/app/settings-local-models-direct-v325.js',
  '/app/settings-local-route-v327.js',
  '/app/document-lifecycle-v221.js',
  '/app/settings-local-route-v331.js',
  '/app/local-ai/runtime-v266.js',
  '/app/local-ai/litertlm_wasm_internal.wasm',
  '/app/local-ai/litertlm_wasm_compat_internal.wasm',
  '/app/local-ai/litertlm_wasm_asyncify_internal.wasm',
  '/app/local-ai/litertlm_wasm_compat_asyncify_internal.wasm',
  '/app/litertlm_wasm_internal.wasm',
  '/app/litertlm_wasm_compat_internal.wasm',
  '/app/litertlm_wasm_asyncify_internal.wasm',
  '/app/litertlm_wasm_compat_asyncify_internal.wasm',
  '/litertlm_wasm_internal.wasm',
  '/litertlm_wasm_compat_internal.wasm',
  '/litertlm_wasm_asyncify_internal.wasm',
  '/litertlm_wasm_compat_asyncify_internal.wasm',
  '/app/local-ai/gemma4-current-registry-authority-v1.js',
  '/app/local-ai/local-generation-model-policy-v1.js',
  '/app/local-ai/gemma4-litert-request-authority-v1.js',
  '/app/local-ai/gemma4-structured-task-authority-v1.js',
  '/app/local-ai/gemma4-first-request-intake-bridge-v1.js',
  '/app/local-ai/gemma4-route-integrity-v1.js',
  '/app/local-ai/gemma4-learning-plan-entry-authority-v1.js',
  '/app/local-ai/gemma4-weave-draft-pipeline-v1.js'
]);
const RELOAD_PATHS=new Set([
  '/app/',
  '/app/index.html',
  '/app/pwa-start-v436.html',
  '/app/installed-entry-v146.html',
  '/app/persistent-system-shell-v1.html',
  '/app/working-campus-v440.html'
]);
function markerRequest(){return new Request(new URL(MARKER,self.location.origin).href)}
async function pending(){if(self.location.hostname!==STAGING_HOST)return false;try{return !(await (await caches.open(CACHE)).match(markerRequest()))}catch{return true}}
async function purge(){for(const name of await caches.keys()){if(name.startsWith('cw-guild-release-v1-')||name===self.CivweaveFiveSystemPagesV1?.cache)continue;const cache=await caches.open(name);for(const request of await cache.keys()){let pathname='';try{pathname=new URL(request.url).pathname}catch{}if(PURGE_PATHS.has(pathname))await cache.delete(request,{ignoreSearch:true})}}}
async function reloadControlledClients(){const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of clients){try{const url=new URL(client.url);if(url.origin!==self.location.origin||!RELOAD_PATHS.has(url.pathname))continue;await client.navigate(client.url)}catch{}}}
if(self.location.hostname===STAGING_HOST){
  self.addEventListener('install',event=>{event.waitUntil((async()=>{if(await pending())await self.skipWaiting()})())});
  self.addEventListener('activate',event=>{event.waitUntil((async()=>{if(!(await pending()))return;await purge();await self.clients.claim();const cache=await caches.open(CACHE);await cache.put(markerRequest(),new Response(REVISION,{headers:{'content-type':'text/plain','cache-control':'no-store'}}));/* Do not navigate active tabs during r42: Qwen3 4B may be mid-download. A user restart loads the purged Settings scripts. */})())});
}
self.CivweaveWeavePipelineTakeoverV1=Object.freeze({revision:REVISION,purgePaths:[...PURGE_PATHS],reloadPaths:[...RELOAD_PATHS]});
})();
