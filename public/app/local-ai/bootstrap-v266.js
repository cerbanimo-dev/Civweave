(()=>{
'use strict';
const VERSION='1.0.84-local-ai-bootstrap-v324-capability-readiness';
const REVISION='1.0.115-local-ai-bootstrap-v302-session-handoff';
const RUNTIME_REVISION='1.0.88-local-ai-runtime-v283-small-model-fast-path';
const LEGACY_RUNTIME_ASSET='/app/local-ai/runtime-v266.js?v=1.0.87-v287-v283-coherence-v288';
const existing=globalThis.CivweaveLocalAIBootstrapV266;
if(existing?.version===VERSION&&existing?.revision===REVISION&&existing?.freshWorkerFallback===true&&existing?.settingsTeardown===true&&existing?.boundedStartup===true&&existing?.coherenceReload===true&&existing?.packageRevisionGuard===true&&existing?.selfHealingBootstrap===true&&existing?.smoothFitRuntime===true&&existing?.delegatedBrowserTools===true&&existing?.mutableComponentCapabilityReadiness===true&&existing?.readyState!=='failed')return;
const registryReady=()=>{const value=globalThis.CivweaveLocalModelRegistryV266;return Boolean(value?.version==='1.0.115-local-ai-registry-v302-gemma3-v4'&&value?.installable&&value?.byId&&value?.directUrl&&value?.artifactRevision&&value?.sourceUrl&&value?.gemma3OptimizedQ4===true)};
const downloadManagerReady=()=>{const value=globalThis.CivweaveLocalModelDownloadV266;return Boolean(value?.start&&value?.status&&value?.selection&&value?.state&&value?.syncBackgroundJobs&&value?.explicitSyncOnly===true&&value?.autoSyncOnLoad===false)};
const downloadPolicyReady=()=>{const policy=globalThis.CivweaveLocalModelDownloadPolicyV278,manager=globalThis.CivweaveLocalModelDownloadV266;return Boolean(policy?.start&&policy?.sync&&policy?.forceForeground&&policy?.explicitSyncOnly===true&&policy?.autoSyncOnLoad===false&&manager?.largeExternalDataForeground===true&&manager?.explicitSyncOnly===true&&manager?.autoSyncOnLoad===false)};
const runtimeReady=()=>{const value=globalThis.CivweaveLocalModelRuntimeV266;return Boolean(value?.version==='1.0.115-local-ai-runtime-v302-session-handoff'&&value?.revision===RUNTIME_REVISION&&value?.smallModelFastPath===true&&value?.canonicalCausalLM===true&&value?.stalledWebGPUFallback===true&&value?.freshWorkerFallback===true&&value?.phaseAwareErrors===true&&value?.promptBudgetEnforced===true&&value?.terminalCancellation===true&&value?.settingsTeardown===true&&value?.adaptiveResidency===true&&value?.adaptiveWasmThreads===true&&value?.intentPrewarm===true&&value?.compatibilityPromptCap===true)};
const settingsReady=()=>{const value=globalThis.CivweaveLocalAISettingsV266;return Boolean(value?.truthfulCompletion===true&&value?.cacheIntegrityOnDemand===true&&value?.snapshotOnlyView===true&&value?.settingsClickOwnership===false&&value?.settingsPresentationOwnership===false&&value?.canonicalSlotOnly===true)};
const bridgeReady=()=>{const value=globalThis.CivweaveLocalModelBridgeV266;return Boolean(value?.version==='1.0.83-local-ai-bridge-v282-health-fallback'&&value?.revision===RUNTIME_REVISION.replace('runtime','bridge')&&value?.continuationValidation===true)};
const metadataReady=()=>globalThis.CivweaveLocalModelMetadataRepairV276?.version==='1.0.81-local-ai-metadata-repair-v277-race-safe'&&globalThis.CivweaveLocalModelDownloadV266?.metadataOnlyRepair===true&&globalThis.CivweaveLocalModelDownloadV266?.metadataRepairRaceSafe===true;
const packageRevisionReady=()=>globalThis.CivweaveLocalModelPackageRevisionGuardV307?.version==='1.0.121-local-model-package-revision-guard-v307'&&globalThis.CivweaveLocalModelDownloadV266?.packageRevisionGuard===true;
const hardwareTierReady=()=>{const value=globalThis.CivweaveLocalModelHardwareTierUIV278;return Boolean(value?.deviceFitRecommendations===true&&value?.lowEndGeneratorAware===true&&value?.observerFeedbackBounded===true&&value?.settingsOpenGpuProbe===false&&value?.explicitHardwareProbe===true)};
const fastInteractiveReady=()=>{const value=globalThis.CivweaveFastInteractiveV192,version=String(value?.version||'');return Boolean(/^1\.0\.\d+-runtime-spine-v271(?:-|$)/.test(version)&&typeof value?.register==='function'&&typeof value?.diagnostics==='function'&&typeof value?.serverAuto==='function'&&typeof value?.localResultNeedsFailover==='function')};
const files=[
  ['/app/ai-capability-broker-v268.js?v=1.0.67-v271',()=>globalThis.CivweaveAICapabilityBrokerV268?.version==='1.0.67-ai-capability-broker-v271-semantics','CivweaveAICapabilityBrokerV268'],
  ['/app/fast-interactive-runtime-v192.js?v=1.0.124-v313-runtime-spine-contract',fastInteractiveReady,'CivweaveFastInteractiveV192'],
  ['/app/local-ai/model-registry-v266.js?v=1.0.121-v307-gemma3-q4',registryReady,'CivweaveLocalModelRegistryV266'],
  ['/app/local-ai/download-manager-v267.js?v=1.0.68-v322-explicit-sync',downloadManagerReady,'CivweaveLocalModelDownloadV266'],
  ['/app/local-ai/package-revision-guard-v307.js?v=1.0.121-v307',packageRevisionReady,'CivweaveLocalModelPackageRevisionGuardV307'],
  ['/app/local-ai/download-policy-v278.js?v=1.0.82-v322-explicit-sync',downloadPolicyReady,'CivweaveLocalModelDownloadPolicyV278'],
  ['/app/local-ai/metadata-repair-v276.js?v=1.0.121-v307',metadataReady,'CivweaveLocalModelMetadataRepairV276'],
  ['/app/local-ai/small-model-policy-v283.js?v=1.0.88-v283',()=>globalThis.CivweaveLocalSmallModelPolicyV283?.version==='1.0.85-local-ai-small-model-policy-v283','CivweaveLocalSmallModelPolicyV283'],
  ['/app/local-ai/runtime-v266.js?v=1.0.121-v307-coherence-reload',runtimeReady,'CivweaveLocalModelRuntimeV266'],
  ['/app/local-ai/runtime-bridge-v266.js?v=1.0.121-v307',bridgeReady,'CivweaveLocalModelBridgeV266'],
  ['/app/browser-tool-v1.js?v=1.0.0',()=>globalThis.CivweaveBrowserToolV1?.version==='1.0.0-browser-tool-v1','CivweaveBrowserToolV1'],
  ['/app/local-ai/browser-agent-v1.js?v=1.0.1',()=>globalThis.CivweaveLocalBrowserAgentV1?.version==='1.0.1-local-browser-agent-v1','CivweaveLocalBrowserAgentV1'],
  ['/app/local-ai/settings-panel-v267.js?v=1.0.118-v323-view-only',settingsReady,'CivweaveLocalAISettingsV266'],
  ['/app/local-ai/primary-route-v283.js?v=1.0.88-v283',()=>globalThis.CivweaveLocalAIPrimaryRouteV283?.version==='1.0.85-local-ai-primary-route-v283','CivweaveLocalAIPrimaryRouteV283'],
  ['/app/local-ai/hardware-tier-ui-v278.js?v=1.0.82-v321-settings-open-idle',hardwareTierReady,'CivweaveLocalModelHardwareTierUIV278'],
  ['/app/local-ai/test-pulse-v269.js?v=1.0.116-v303-mobile-safe',()=>globalThis.CivweaveLocalModelTestPulseV269?.version==='1.0.116-local-model-test-pulse-v303-mobile-safe','CivweaveLocalModelTestPulseV269']
];
let readyState='loading',lastError='',lastComponent='',currentReady=null,flight=null,passNumber=0;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function evict(name,ready){if(!name||ready?.()||!globalThis[name])return false;if(name==='CivweaveLocalModelRuntimeV266')try{globalThis[name]?.shutdown?.({reason:'bootstrap-coherence-reload'})}catch{}try{delete globalThis[name]}catch{globalThis[name]=undefined}return true}
function load(src,ready,name){if(ready?.())return Promise.resolve();const evicted=evict(name,ready);return new Promise((resolve,reject)=>{let settled=false;const finish=(ok,error)=>{if(settled)return;settled=true;clearTimeout(timer);ok?resolve():reject(error)},script=document.createElement('script'),timer=setTimeout(()=>finish(false,Object.assign(new Error(`${src} did not load within 12 seconds.`),{component:name,src})),12000);script.src=src;script.async=false;script.dataset.civweaveLocalAi='v324';script.dataset.civweaveCoherenceReload=evicted?'1':'0';script.onload=()=>ready?.()?finish(true):finish(false,Object.assign(new Error(`${src} loaded without satisfying its local-AI capability contract.`),{component:name,src}));script.onerror=()=>finish(false,Object.assign(new Error(`Could not load ${src}.`),{component:name,src}));document.head.append(script)})}
function componentStatus(){return Object.freeze(Object.fromEntries(files.map(([src,test,name])=>[name,{ready:Boolean(test?.()),src}])))}
function dispatchReady(recovered){dispatchEvent(new CustomEvent('civweave:local-ai-ready',{detail:{version:VERSION,revision:REVISION,componentCompatibility:'capability-contract-v324',mutableComponentCapabilityReadiness:true,fastInteractiveSpineContract:'capability-v313',byteProgress:true,backgroundFetch:true,capabilityRouting:true,localAgenticReasoning:true,directModelTest:true,runtimeSpine:true,cacheResolvedInference:true,localStreaming:true,integrityRepair:true,runtimeMetadataRequired:true,metadataOnlyRepair:true,metadataRepairRaceSafe:true,truthfulCompletion:true,backendFallback:true,stalledWebGPUFallback:true,webgpuSessionQuarantine:true,agenticToolSemantics:true,delegatedBrowserTools:true,offlineArchiveSearch:true,phone1BTier:true,hardwareLadder:true,directDownloads:true,largeExternalDataForeground:true,hardwareTierUI:true,canonicalCausalLM:true,contextAware:true,timingDiagnostics:true,thinkingProfiles:true,artifactRevisionRepair:true,wasmPerformanceDiagnostics:true,embeddedLocalPrimary:true,smallModelFastPath:true,adaptiveOutput:true,continuationValidation:true,completionMetadata:true,windowsMemoryHardening:true,serializedInference:true,coldStartBenchmarkOptIn:true,knownArtifactLengths:true,freshWorkerFallback:true,phaseAwareErrors:true,promptBudgetEnforced:true,singleThreadCompatibility:true,terminalCancellation:true,settingsTeardown:true,boundedStartup:true,mobileSafeHealth:true,interruptedTestRecovery:true,coherenceReload:true,gemma3OptimizedQ4:true,packageRevisionGuard:true,selfHealingBootstrap:true,adaptiveResidency:true,adaptiveWasmThreads:true,intentPrewarm:true,compatibilityPromptCap:true,deviceFitRecommendations:true,smoothFitRuntime:true,recoveredBootstrap:Boolean(recovered),pass:passNumber}}))}
async function runPass(){for(const [src,test,name] of files){lastComponent=name;await load(src,test,name)}return true}
function begin({manual=false}={}){
  if(readyState==='ready')return Promise.resolve(true);
  if(flight)return flight;
  readyState=manual?'retrying':'loading';lastError='';lastComponent='';
  flight=(async()=>{
    for(let pass=0;pass<2;pass++){
      passNumber=pass+1;
      readyState=pass?'retrying':'loading';
      try{
        await runPass();
        readyState='ready';lastError='';lastComponent='';
        dispatchReady(pass>0||manual);
        return true;
      }catch(error){
        lastError=String(error?.message||error);lastComponent=String(error?.component||lastComponent||'unknown');
        if(pass===0){
          try{dispatchEvent(new CustomEvent('civweave:local-ai-recovering',{detail:{version:VERSION,revision:REVISION,componentCompatibility:'capability-contract-v324',mutableComponentCapabilityReadiness:true,fastInteractiveSpineContract:'capability-v313',component:lastComponent,message:lastError,pass:passNumber}}))}catch{}
          await delay(60);
          continue;
        }
        readyState='failed';
        console.warn('[civweave local ai]',error);
        try{dispatchEvent(new CustomEvent('civweave:local-ai-unavailable',{detail:{version:VERSION,revision:REVISION,componentCompatibility:'capability-contract-v324',mutableComponentCapabilityReadiness:true,fastInteractiveSpineContract:'capability-v313',message:lastError,component:lastComponent,coherenceReload:true,packageRevisionGuard:true,selfHealingBootstrap:true,smoothFitRuntime:true,delegatedBrowserTools:true,offlineArchiveSearch:true,pass:passNumber,components:componentStatus()}}))}catch{}
        return false;
      }
    }
    readyState='failed';
    return false;
  })().finally(()=>{flight=null});
  currentReady=flight;
  return flight;
}
function retry(){return begin({manual:true})}
currentReady=begin();
globalThis.CivweaveLocalAIBootstrapV266=Object.freeze({version:VERSION,revision:REVISION,get ready(){return currentReady},get readyState(){return readyState},get lastError(){return lastError},get lastComponent(){return lastComponent},retry,componentStatus,componentCompatibility:'capability-contract-v324',mutableComponentCapabilityReadiness:true,fastInteractiveSpineContract:'capability-v313',legacyRuntimeAsset:LEGACY_RUNTIME_ASSET,delegatedBrowserTools:true,offlineArchiveSearch:true,smallModelFastPath:true,adaptiveOutput:true,continuationValidation:true,embeddedLocalPrimary:true,wasmPerformanceDiagnostics:true,stalledWebGPUFallback:true,webgpuSessionQuarantine:true,windowsMemoryHardening:true,serializedInference:true,coldStartBenchmarkOptIn:true,knownArtifactLengths:true,freshWorkerFallback:true,phaseAwareErrors:true,promptBudgetEnforced:true,singleThreadCompatibility:true,terminalCancellation:true,settingsTeardown:true,boundedStartup:true,mobileSafeHealth:true,interruptedTestRecovery:true,coherenceReload:true,gemma3OptimizedQ4:true,packageRevisionGuard:true,selfHealingBootstrap:true,adaptiveResidency:true,adaptiveWasmThreads:true,intentPrewarm:true,compatibilityPromptCap:true,deviceFitRecommendations:true,smoothFitRuntime:true});
})();
