import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile('public/app/local-ai/bootstrap-v266.js','utf8');
new Function(source);

assert.match(source,/selfHealingBootstrap===true&&existing\?\.smoothFitRuntime===true&&existing\?\.readyState!=='failed'/,'a previously failed or pre-smooth-fit bootstrap must never short-circuit a fresh script execution');
assert.match(source,/for\(let pass=0;pass<2;pass\+\+\)/,'bootstrap must retry the component graph once before declaring local AI unavailable');
assert.match(source,/civweave:local-ai-recovering/,'bootstrap must expose the recovery pass');
assert.match(source,/function retry\(\)/,'bootstrap must expose a manual retry entry point');
assert.match(source,/componentStatus/,'bootstrap must preserve per-component compatibility diagnostics');
assert.match(source,/get readyState\(\)/,'bootstrap must expose resolved startup state instead of only a promise');
assert.match(source,/get lastError\(\)/,'bootstrap must retain the actual component failure');
assert.match(source,/componentCompatibility:'capability-contract-v307'/,'self-healing must preserve the v307 component contract');
assert.match(source,/fastInteractiveSpineContract:'capability-v313'/,'bootstrap must expose the current fast interactive spine contract');
assert.match(source,/const fastInteractiveReady=.*?runtime-spine-v271.*?register.*?diagnostics.*?serverAuto.*?localResultNeedsFailover/s,'fast interactive readiness must follow capabilities rather than an obsolete exact release string');
assert.match(source,/fast-interactive-runtime-v192\.js\?v=1\.0\.124-v313-runtime-spine-contract/,'bootstrap must rotate the fast runtime asset epoch');
assert.doesNotMatch(source,/CivweaveFastInteractiveV192\?\.version==='1\.0\.67-runtime-spine-v271'/,'bootstrap must not reject the shipping server-auto runtime using the retired exact version');
assert.match(source,/adaptiveResidency===true.*?adaptiveWasmThreads===true.*?intentPrewarm===true.*?compatibilityPromptCap===true/s,'bootstrap must require the smooth-fit runtime contract');
assert.match(source,/deviceFitRecommendations===true.*?observerFeedbackBounded===true/,'bootstrap must require bounded device-fit Settings decoration');

const events=[];
let runtimeLoads=0;
const runtime=()=>({
  version:'1.0.115-local-ai-runtime-v302-session-handoff',
  revision:'1.0.88-local-ai-runtime-v283-small-model-fast-path',
  smallModelFastPath:true,
  canonicalCausalLM:true,
  stalledWebGPUFallback:true,
  freshWorkerFallback:true,
  phaseAwareErrors:true,
  promptBudgetEnforced:true,
  terminalCancellation:true,
  settingsTeardown:true,
  adaptiveResidency:true,
  adaptiveWasmThreads:true,
  intentPrewarm:true,
  compatibilityPromptCap:true,
  shutdown(){}
});
const context={
  console,
  setTimeout,
  clearTimeout,
  Promise,
  Object,
  Error,
  String,
  Boolean,
  CustomEvent:class CustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  dispatchEvent(event){events.push(event)},
  CivweaveAICapabilityBrokerV268:{version:'1.0.67-ai-capability-broker-v271-semantics'},
  CivweaveFastInteractiveV192:{version:'1.0.116-runtime-spine-v271-server-auto-v301',register(){},diagnostics(){},serverAuto(){return false},localResultNeedsFailover(){return false}},
  CivweaveLocalModelRegistryV266:{version:'1.0.115-local-ai-registry-v302-gemma3-v4',installable(){},byId(){},directUrl(){},artifactRevision(){},sourceUrl(){},gemma3OptimizedQ4:true},
  CivweaveLocalModelDownloadV266:{version:'1.0.67-local-ai-download-v271-integrity',packageRevisionGuard:true,largeExternalDataForeground:true,metadataOnlyRepair:true,metadataRepairRaceSafe:true},
  CivweaveLocalModelPackageRevisionGuardV307:{version:'1.0.121-local-model-package-revision-guard-v307'},
  CivweaveLocalModelDownloadPolicyV278:{version:'1.0.81-local-ai-download-policy-v278-foreground-large-files'},
  CivweaveLocalModelMetadataRepairV276:{version:'1.0.81-local-ai-metadata-repair-v277-race-safe'},
  CivweaveLocalSmallModelPolicyV283:{version:'1.0.85-local-ai-small-model-policy-v283'},
  CivweaveLocalModelBridgeV266:{version:'1.0.83-local-ai-bridge-v282-health-fallback',revision:'1.0.88-local-ai-bridge-v283-small-model-fast-path',continuationValidation:true},
  CivweaveLocalAISettingsV266:{version:'1.0.116-local-ai-settings-v305-download-dock-layout',truthfulCompletion:true,cacheIntegrityOnDemand:true,openPath:'snapshot-first-v287'},
  CivweaveLocalAIPrimaryRouteV283:{version:'1.0.85-local-ai-primary-route-v283'},
  CivweaveLocalModelHardwareTierUIV278:{version:'1.0.81-local-ai-hardware-tier-ui-v278',deviceFitRecommendations:true,observerFeedbackBounded:true},
  CivweaveLocalModelTestPulseV269:{version:'1.0.116-local-model-test-pulse-v303-mobile-safe'},
};
context.globalThis=context;
context.document={
  createElement(){return{dataset:{},async:false,src:'',onload:null,onerror:null}},
  head:{append(script){
    if(String(script.src).includes('/app/local-ai/runtime-v266.js')){
      runtimeLoads++;
      if(runtimeLoads===2)context.CivweaveLocalModelRuntimeV266=runtime();
    }
    queueMicrotask(()=>script.onload?.());
  }}
};

vm.createContext(context);
vm.runInContext(source,context,{filename:'bootstrap-v266.js'});
const ok=await context.CivweaveLocalAIBootstrapV266.ready;
assert.equal(ok,true,'second component pass should recover a transient runtime compatibility failure');
assert.equal(context.CivweaveLocalAIBootstrapV266.readyState,'ready');
assert.equal(runtimeLoads,2,'runtime should be loaded again after its first compatibility failure');
assert.equal(context.CivweaveLocalAIBootstrapV266.lastError,'');
assert.ok(events.some(event=>event.type==='civweave:local-ai-recovering'),'first failed pass should publish recovery state');
const readyEvent=events.findLast(event=>event.type==='civweave:local-ai-ready');
assert.equal(readyEvent?.detail?.recoveredBootstrap,true,'successful retry should be observable');
assert.equal(readyEvent?.detail?.fastInteractiveSpineContract,'capability-v313','ready event must report the repaired fast runtime contract');
assert.equal(readyEvent?.detail?.smoothFitRuntime,true,'ready event must advertise the tuned runtime contract');

console.log(JSON.stringify({
  ok:true,
  revision:'local-ai-bootstrap-retry-v312-smooth-fit-v314',
  contract:'capability-contract-v307',
  fastInteractiveSpineContract:'capability-v313',
  transientCompatibilityFailure:'recovered-on-second-pass',
  failedBootstrapShortCircuit:'blocked',
  shippingFastRuntimeAccepted:true,
  smoothFitRuntime:true,
  componentDiagnostics:true
},null,2));
