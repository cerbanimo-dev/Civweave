import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const releaseVersion=(await readFile('VERSION','utf8')).trim();
const localAIGate=await readFile('public/service-worker-local-ai-coherence-v307.js','utf8');
const generated=await readFile('public/service-worker-v203.js','utf8');
const builder=await readFile('scripts/build-service-worker-v211.mjs','utf8');
const family=await readFile('public/app/family-ai-loader-v105.js','utf8');
const bootstrap=await readFile('public/app/local-ai/bootstrap-v266.js','utf8');
const registry=await readFile('public/app/local-ai/model-registry-v266.js','utf8');
const packageGuard=await readFile('public/app/local-ai/package-revision-guard-v307.js','utf8');

assert.match(localAIGate,/CW_LOCAL_AI_COHERENCE_VERSION = 'local-ai-code-v\d+-[^']+'/,'dedicated local AI code gate must advertise a versioned coherence epoch');
assert.match(localAIGate,/url\.pathname\.startsWith\('\/app\/local-ai\/'\)/,'all local AI modules must be owned by the dedicated gate');
assert.match(localAIGate,/event\.stopImmediatePropagation\(\)/,'local AI gate must stop later generic cache handlers from owning the request');
assert.match(localAIGate,/new Request\(pathnameOrRequest, \{ cache: 'no-store' \}\)/,'local AI gate must request current network bytes');
assert.match(localAIGate,/cache\.match\(key, \{ ignoreSearch: true \}\).*caches\.match\(key, \{ ignoreSearch: true \}\)/s,'local AI gate must retain cached offline fallback');
assert.match(localAIGate,/package-revision-guard-v307\.js/,'package revision guard must be prefetched for offline recovery');
assert.match(localAIGate,/bootstrapCapabilityReadiness: true/,'coherence gate must expose the bootstrap capability repair marker');

const localGateImport="importScripts('/service-worker-local-ai-coherence-v307.js";
const genericCodeImport="importScripts('/service-worker-code-coherence-v288.js";
const coreImport="importScripts('/service-worker-core-v208.js";
assert.ok(generated.includes(localGateImport),'generated service worker must import the dedicated local AI coherence gate');
assert.ok(generated.indexOf(localGateImport)>=0&&generated.indexOf(localGateImport)<generated.indexOf(genericCodeImport)&&generated.indexOf(genericCodeImport)<generated.indexOf(coreImport),'local AI code gate must register before generic code coherence and the shell core');
assert.match(builder,/service-worker-local-ai-coherence-v307\.js\?v=/,'service worker generator must preserve the dedicated local AI coherence import');
assert.match(builder,/localAICodeCoherence:/,'service worker diagnostics must expose the dedicated local AI code policy');
assert.match(builder,/selectedLocalMiniLM:'v357'/,'service worker generator must preserve selected-local/MiniLM cache repair');
assert.match(builder,/serverAutoFailover:'v358'/,'service worker generator must preserve server-auto fallback cache repair');
assert.match(builder,/localAIBootstrapCapability:'v359'/,'service worker diagnostics must expose the bootstrap capability epoch');
assert.match(generated,/working-campus-return-v425/,'local AI worker changes must preserve the current Working Campus return epoch');
assert.match(generated,/chat-convergence-v250/,'local AI worker changes must preserve the current chat convergence epoch');
assert.match(generated,/selected-local-minilm-v357/,'generated worker must preserve selected-local/MiniLM delivery');
assert.match(generated,/server-auto-local-failover-v358/,'generated worker must preserve server-auto local failover delivery');
assert.match(generated,/local-ai-bootstrap-capability-v359/,'generated worker must activate the bootstrap capability repair');

// The family loader may bootstrap local AI only after a selected/configured local
// route is actually requested. Ordinary family loading and optional modules must
// remain free of generative local-AI startup side effects.
assert.match(family,/const LOCAL_BOOTSTRAP=\['\/app\/local-ai\/bootstrap-v266\.js/,'family loader must retain the on-demand local bootstrap path');
assert.match(family,/async function ensureLocalAI\(\)\{\s*if\(!localRequested\(\)\)return false;/s,'family loader must gate local bootstrap behind an actual local-model request');
assert.match(family,/await loadScript\(\.\.\.LOCAL_BOOTSTRAP\)/,'selected local generation must be able to initialize its bootstrap');
assert.match(family,/localModelPathway:'selected-model-on-demand-v316'/,'family loader must advertise selected-model on-demand local AI ownership');
assert.match(family,/localAIOptionalSideEffects:false/,'generic assistant optional loading must stay free of local-AI side effects');

assert.match(bootstrap,/componentCompatibility:'capability-contract-v324'/,'bootstrap must advertise the mutable-component capability contract');
assert.match(bootstrap,/mutableComponentCapabilityReadiness:true/,'bootstrap must expose capability-based mutable support module readiness');
assert.match(bootstrap,/coherenceReload:true/,'bootstrap must expose stale-global coherence reload support');
assert.match(bootstrap,/function evict\(name,ready\)/,'bootstrap must be able to evict an incompatible resident component');
assert.match(bootstrap,/shutdown\?\.\(\{reason:'bootstrap-coherence-reload'\}\)/,'runtime eviction must shut down the old inference worker first');
assert.match(bootstrap,/delete globalThis\[name\]/,'bootstrap must delete incompatible globals so same-version module guards cannot deadlock reload');
assert.match(bootstrap,/metadataReady=.*?metadataRepairRaceSafe===true/s,'metadata repair readiness must include its wrapped-manager capability marker');
assert.match(bootstrap,/downloadManagerReady=.*?explicitSyncOnly===true.*?autoSyncOnLoad===false/s,'download manager readiness must be capability based instead of pinned to a retired version');
assert.match(bootstrap,/downloadPolicyReady=.*?largeExternalDataForeground===true.*?explicitSyncOnly===true/s,'download policy readiness must include its wrapped-manager capability marker');
assert.match(bootstrap,/settingsReady=.*?snapshotOnlyView===true.*?settingsPresentationOwnership===false/s,'settings readiness must follow its current view-only capability contract');
assert.match(bootstrap,/hardwareTierReady=.*?deviceFitRecommendations===true.*?settingsOpenGpuProbe===false/s,'hardware tier readiness must follow current device-fit capabilities');
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
  revision:'local-ai-bootstrap-coherence-v324-capability-readiness',
  releaseVersion,
  localAICodeDelivery:'dedicated-network-first-pre-core-offline-cache-fallback-current-epoch',
  bootstrapRevision:'1.0.115-local-ai-bootstrap-v302-session-handoff',
  bootstrapCompatibility:'capability-contract-v324',
  familyLoaderPolicy:'selected-model-on-demand-only',
  incompatibleGlobals:'evicted-before-reload',
  mutableSupportModules:'capability-gated-not-exact-version-pinned',
  gemma3Profile:'transformers-js-v4-q4-optimized',
  packageMigration:'stale-selection-suppressed-until-replacement-ready',
  selectedLocalMiniLMPreserved:true,
  serverAutoFailoverPreserved:true,
  workingCampusReturnPreserved:true,
  chatConvergencePreserved:true,
  staleQueryRetryPrevented:true,
  sameVersionDeadlockPrevented:true
},null,2));