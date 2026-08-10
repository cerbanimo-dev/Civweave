(()=>{
'use strict';
const VERSION='1.0.85-local-ai-bootstrap-v283-small-model-fast-path';
if(globalThis.CivweaveLocalAIBootstrapV266?.version===VERSION)return;
const files=[
  ['/app/ai-capability-broker-v268.js?v=1.0.67-v271',()=>globalThis.CivweaveAICapabilityBrokerV268?.version==='1.0.67-ai-capability-broker-v271-semantics'],
  ['/app/fast-interactive-runtime-v192.js?v=1.0.67-v271',()=>globalThis.CivweaveFastInteractiveV192?.version==='1.0.67-runtime-spine-v271'],
  ['/app/local-ai/model-registry-v266.js?v=1.0.83-v282',()=>globalThis.CivweaveLocalModelRegistryV266?.version==='1.0.83-local-ai-registry-v282-inference-contracts'],
  ['/app/local-ai/download-manager-v267.js?v=1.0.67-v271',()=>globalThis.CivweaveLocalModelDownloadV266?.version==='1.0.67-local-ai-download-v271-integrity'],
  ['/app/local-ai/download-policy-v278.js?v=1.0.81-v278',()=>globalThis.CivweaveLocalModelDownloadPolicyV278?.version==='1.0.81-local-ai-download-policy-v278-foreground-large-files'&&globalThis.CivweaveLocalModelDownloadV266?.largeExternalDataForeground===true],
  ['/app/local-ai/metadata-repair-v276.js?v=1.0.81-v277',()=>globalThis.CivweaveLocalModelMetadataRepairV276?.version==='1.0.81-local-ai-metadata-repair-v277-race-safe'&&globalThis.CivweaveLocalModelDownloadV266?.metadataOnlyRepair===true&&globalThis.CivweaveLocalModelDownloadV266?.metadataRepairRaceSafe===true],
  ['/app/local-ai/small-model-policy-v283.js?v=1.0.85-v283',()=>globalThis.CivweaveLocalSmallModelPolicyV283?.version==='1.0.85-local-ai-small-model-policy-v283'],
  ['/app/local-ai/runtime-v266.js?v=1.0.85-v283',()=>globalThis.CivweaveLocalModelRuntimeV266?.version==='1.0.85-local-ai-runtime-v283-small-model-fast-path'],
  ['/app/local-ai/runtime-bridge-v266.js?v=1.0.85-v283',()=>globalThis.CivweaveLocalModelBridgeV266?.version==='1.0.85-local-ai-bridge-v283-small-model-fast-path'],
  ['/app/local-ai/settings-panel-v267.js?v=1.0.83-v282',()=>globalThis.CivweaveLocalAISettingsV266?.version==='1.0.83-local-ai-settings-v282-health'],
  ['/app/local-ai/primary-route-v283.js?v=1.0.85-v283',()=>globalThis.CivweaveLocalAIPrimaryRouteV283?.version==='1.0.85-local-ai-primary-route-v283'],
  ['/app/local-ai/hardware-tier-ui-v278.js?v=1.0.81-v278',()=>globalThis.CivweaveLocalModelHardwareTierUIV278?.version==='1.0.81-local-ai-hardware-tier-ui-v278'],
  ['/app/local-ai/test-pulse-v269.js?v=1.0.83-v282',()=>globalThis.CivweaveLocalModelTestPulseV269?.version==='1.0.83-local-model-test-pulse-v282-health']
];
function load(src,ready){if(ready?.())return Promise.resolve();return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.dataset.civweaveLocalAi='v283';script.onload=()=>ready?.()?resolve():reject(new Error(`${src} loaded without its expected runtime.`));script.onerror=()=>reject(new Error(`Could not load ${src}.`));document.head.append(script)})}
const ready=(async()=>{for(const [src,test] of files)await load(src,test);dispatchEvent(new CustomEvent('civweave:local-ai-ready',{detail:{version:VERSION,byteProgress:true,backgroundFetch:true,capabilityRouting:true,localAgenticReasoning:true,directModelTest:true,runtimeSpine:true,cacheResolvedInference:true,localStreaming:true,integrityRepair:true,runtimeMetadataRequired:true,metadataOnlyRepair:true,metadataRepairRaceSafe:true,truthfulCompletion:true,backendFallback:true,agenticToolSemantics:true,phone1BTier:true,hardwareLadder:true,directDownloads:true,largeExternalDataForeground:true,hardwareTierUI:true,canonicalCausalLM:true,contextAware:true,timingDiagnostics:true,thinkingProfiles:true,artifactRevisionRepair:true,embeddedLocalPrimary:true,smallModelFastPath:true,tokenizerAwareContext:true,adaptiveOutput:true,continuationValidation:true,completionMetadata:true}}));return true})().catch(error=>{console.warn('[civweave local ai]',error);dispatchEvent(new CustomEvent('civweave:local-ai-unavailable',{detail:{version:VERSION,message:String(error?.message||error)}}));return false});
globalThis.CivweaveLocalAIBootstrapV266=Object.freeze({version:VERSION,ready});
})();
