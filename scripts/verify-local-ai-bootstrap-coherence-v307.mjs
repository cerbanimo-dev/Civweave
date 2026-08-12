import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const core=await readFile('public/service-worker-core-v208.js','utf8');
const generated=await readFile('public/service-worker-v203.js','utf8');
const builder=await readFile('scripts/build-service-worker-v211.mjs','utf8');
const family=await readFile('public/app/family-ai-loader-v105.js','utf8');
const bootstrap=await readFile('public/app/local-ai/bootstrap-v266.js','utf8');
const registry=await readFile('public/app/local-ai/model-registry-v266.js','utf8');
const packageGuard=await readFile('public/app/local-ai/package-revision-guard-v307.js','utf8');

assert.match(core,/const COHERENCE_CRITICAL_APP_PATHS = new Set\(/,'service worker must declare coherence-critical app code');
assert.match(core,/pathname\.startsWith\('\/app\/local-ai\/'\)/,'all local AI modules must use the coherence-critical route');
assert.match(core,/if \(coherenceCriticalAppPath\(url\.pathname\)\) \{\s*event\.respondWith\(networkFirst\(request, url\.pathname\)\);/s,'coherence-critical local AI code must be network-first with same-path cached fallback');
const criticalIndex=core.indexOf('if (coherenceCriticalAppPath(url.pathname))');
const genericIndex=core.indexOf("if (url.pathname.startsWith('/app/') || url.pathname.startsWith('/extensions/')");
assert.ok(criticalIndex>=0&&genericIndex>=0&&criticalIndex<genericIndex,'local AI network-first routing must precede generic /app cache-first routing');

assert.match(generated,/service-worker-core-v208\.js\?v=1\.0\.121-local-ai-network-first-v307/,'generated service worker must rotate the core worker import identity');
assert.match(builder,/service-worker-core-v208\.js\?v=\$\{version\}-local-ai-network-first-v307/,'service worker generator must preserve the local AI network-first epoch');

assert.match(family,/LOCAL_AI_BOOTSTRAP_REVISION='1\.0\.115-local-ai-bootstrap-v302-session-handoff'/,'family loader must pin the compatible bootstrap revision');
assert.match(family,/bootstrap-v266\.js\?v=1\.0\.121-local-ai-coherence-v307/,'family loader must request the current bootstrap epoch');
assert.match(family,/CivweaveLocalAIBootstrapV266\?\.revision===LOCAL_AI_BOOTSTRAP_REVISION/,'family loader must reject a wrong bootstrap revision');

assert.match(bootstrap,/componentCompatibility:'capability-contract-v307'/,'bootstrap must advertise the v307 compatibility contract');
assert.match(bootstrap,/coherenceReload:true/,'bootstrap must expose stale-global coherence reload support');
assert.match(bootstrap,/function evict\(name,ready\)/,'bootstrap must be able to evict an incompatible resident component');
assert.match(bootstrap,/shutdown\?\.\(\{reason:'bootstrap-coherence-reload'\}\)/,'runtime eviction must shut down the old inference worker first');
assert.match(bootstrap,/delete globalThis\[name\]/,'bootstrap must delete incompatible globals so same-version module guards cannot deadlock reload');
assert.match(bootstrap,/metadataReady=.*?metadataRepairRaceSafe===true/s,'metadata repair readiness must include its wrapped-manager capability marker');
assert.match(bootstrap,/downloadPolicyReady=.*?largeExternalDataForeground===true/s,'download policy readiness must include its wrapped-manager capability marker');
assert.match(bootstrap,/bridgeReady=.*?continuationValidation===true/s,'runtime bridge readiness must include the capability required by bootstrap');
assert.match(bootstrap,/packageRevisionReady=.*?packageRevisionGuard===true/s,'bootstrap must require the local package revision migration guard');
assert.match(bootstrap,/download-manager-v267[^\n]*[\s\S]*package-revision-guard-v307[^\n]*[\s\S]*download-policy-v278/,'package revision guard must install immediately after the download manager and before wrappers that preserve it');
assert.match(bootstrap,/model-registry-v266\.js\?v=1\.0\.121-v307-gemma3-q4/,'bootstrap must request the updated Gemma registry epoch');
assert.match(bootstrap,/runtime-v266\.js\?v=1\.0\.121-v307-coherence-reload/,'bootstrap must request a fresh runtime when the resident runtime fails its capability contract');

assert.match(registry,/gemma3OptimizedQ4:true/,'registry must expose the optimized Gemma 3 marker');
assert.match(registry,/revision:'a58439f40017d3b99c7d378ff525e54e0ba08ebf'.*?dtype:'q4'.*?runtime:'transformers-js-v4'/s,'Gemma 3 must use the current optimized q4 WebGPU profile');
assert.match(registry,/artifact\('onnx\/model_q4\.onnx',300_000,true,'',347_363\)/,'Gemma 3 q4 graph artifact must be pinned');
assert.match(registry,/artifact\('onnx\/model_q4\.onnx_data',800_000_000,true,'',859_106_816\)/,'Gemma 3 q4 external data artifact must be pinned');
assert.doesNotMatch(registry,/repo:'onnx-community\/gemma-3-1b-it-ONNX'.*?revision:'a7fa005d133fd9fc99e78b812f450742ad37426d'/s,'Gemma 3 must not remain on the pre-optimization export');

assert.match(packageGuard,/selectedRevision=.*?stateRevision=.*?currentRevision=/s,'package guard must inspect saved selection, package state, and current registry revisions separately');
assert.match(packageGuard,/replacementReady=stateRevision===currentRevision&&String\(state\?\.status\|\|''\)==='ready'/,'replacement package must reach ready before a stale saved selection may reactivate');
assert.match(packageGuard,/selectedStale=.*?!replacementReady/,'stale selection must remain suppressed throughout replacement download');
assert.match(packageGuard,/active:false,packageRevisionChanged:true/,'stale selected packages must be suppressed before inference');
assert.match(packageGuard,/status:'paused'/,'stale ready state must become resumable instead of falsely ready');
assert.match(packageGuard,/preservesCachedWeights:true/,'migration must preserve the previously downloaded cache instead of deleting it');

console.log(JSON.stringify({
  ok:true,
  revision:'local-ai-bootstrap-coherence-v307',
  localAICodeDelivery:'network-first-online-cache-fallback-offline',
  bootstrapRevision:'1.0.115-local-ai-bootstrap-v302-session-handoff',
  incompatibleGlobals:'evicted-before-reload',
  gemma3Profile:'transformers-js-v4-q4-optimized',
  packageMigration:'stale-selection-suppressed-until-replacement-ready',
  staleQueryRetryPrevented:true,
  sameVersionDeadlockPrevented:true
},null,2));
