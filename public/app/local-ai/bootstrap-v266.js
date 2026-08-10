(()=>{
'use strict';
const VERSION='1.0.80-local-ai-bootstrap-v277-phone-1b-tier';
if(globalThis.CivweaveLocalAIBootstrapV266?.version===VERSION)return;
const files=[
  ['/app/ai-capability-broker-v268.js?v=1.0.67-v271',()=>globalThis.CivweaveAICapabilityBrokerV268?.version==='1.0.67-ai-capability-broker-v271-semantics'],
  ['/app/fast-interactive-runtime-v192.js?v=1.0.67-v271',()=>globalThis.CivweaveFastInteractiveV192?.version==='1.0.67-runtime-spine-v271'],
  ['/app/local-ai/model-registry-v266.js?v=1.0.80-v277',()=>globalThis.CivweaveLocalModelRegistryV266?.version==='1.0.80-local-ai-registry-v277-phone-1b-tier'],
  ['/app/local-ai/download-manager-v267.js?v=1.0.67-v271',()=>globalThis.CivweaveLocalModelDownloadV266?.version==='1.0.67-local-ai-download-v271-integrity'],
  ['/app/local-ai/metadata-repair-v276.js?v=1.0.80-v276',()=>globalThis.CivweaveLocalModelMetadataRepairV276?.version==='1.0.80-local-ai-metadata-repair-v276'&&globalThis.CivweaveLocalModelDownloadV266?.metadataOnlyRepair===true],
  ['/app/local-ai/runtime-v266.js?v=1.0.73-v275',()=>globalThis.CivweaveLocalModelRuntimeV266?.version==='1.0.73-local-ai-runtime-v275-backend-fallback'],
  ['/app/local-ai/runtime-bridge-v266.js?v=1.0.73-v275',()=>globalThis.CivweaveLocalModelBridgeV266?.version==='1.0.73-local-ai-bridge-v275-backend-fallback'],
  ['/app/local-ai/settings-panel-v267.js?v=1.0.60-v267',()=>globalThis.CivweaveLocalAISettingsV266?.version==='1.0.60-local-ai-settings-v267'],
  ['/app/local-ai/test-pulse-v269.js?v=1.0.73-v275',()=>globalThis.CivweaveLocalModelTestPulseV269?.version==='1.0.73-local-model-test-pulse-v275-backend-fallback']
];
function load(src,ready){if(ready?.())return Promise.resolve();return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.dataset.civweaveLocalAi='v277';script.onload=()=>ready?.()?resolve():reject(new Error(`${src} loaded without its expected runtime.`));script.onerror=()=>reject(new Error(`Could not load ${src}.`));document.head.append(script)})}
const ready=(async()=>{for(const [src,test] of files)await load(src,test);dispatchEvent(new CustomEvent('civweave:local-ai-ready',{detail:{version:VERSION,byteProgress:true,backgroundFetch:true,capabilityRouting:true,localAgenticReasoning:true,directModelTest:true,runtimeSpine:true,cacheResolvedInference:true,localStreaming:true,integrityRepair:true,runtimeMetadataRequired:true,metadataOnlyRepair:true,backendFallback:true,agenticToolSemantics:true,phone1BTier:true}}));return true})().catch(error=>{console.warn('[civweave local ai]',error);dispatchEvent(new CustomEvent('civweave:local-ai-unavailable',{detail:{version:VERSION,message:String(error?.message||error)}}));return false});
globalThis.CivweaveLocalAIBootstrapV266=Object.freeze({version:VERSION,ready});
})();
