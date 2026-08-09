(()=>{
'use strict';
const VERSION='1.0.69-local-ai-bootstrap-v274-health';
if(globalThis.CivweaveLocalAIBootstrapV266?.version===VERSION)return;
const files=[
  ['/app/ai-capability-broker-v268.js?v=1.0.67-v271',()=>globalThis.CivweaveAICapabilityBrokerV268?.version==='1.0.67-ai-capability-broker-v271-semantics'],
  ['/app/fast-interactive-runtime-v192.js?v=1.0.67-v271',()=>globalThis.CivweaveFastInteractiveV192?.version==='1.0.67-runtime-spine-v271'],
  ['/app/local-ai/model-registry-v266.js?v=1.0.69-v274',()=>globalThis.CivweaveLocalModelRegistryV266?.version==='1.0.69-local-ai-registry-v274-inference-contracts'],
  ['/app/local-ai/download-manager-v267.js?v=1.0.67-v271',()=>globalThis.CivweaveLocalModelDownloadV266?.version==='1.0.67-local-ai-download-v271-integrity'],
  ['/app/local-ai/runtime-v266.js?v=1.0.69-v274',()=>globalThis.CivweaveLocalModelRuntimeV266?.version==='1.0.69-local-ai-runtime-v274-health'],
  ['/app/local-ai/runtime-bridge-v266.js?v=1.0.69-v274',()=>globalThis.CivweaveLocalModelBridgeV266?.version==='1.0.69-local-ai-bridge-v274-health'],
  ['/app/local-ai/settings-panel-v267.js?v=1.0.69-v274',()=>globalThis.CivweaveLocalAISettingsV266?.version==='1.0.69-local-ai-settings-v274-health'],
  ['/app/local-ai/test-pulse-v269.js?v=1.0.69-v274',()=>globalThis.CivweaveLocalModelTestPulseV269?.version==='1.0.69-local-model-test-pulse-v274-health']
];
function load(src,ready){if(ready?.())return Promise.resolve();return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.dataset.civweaveLocalAi='v274';script.onload=()=>ready?.()?resolve():reject(new Error(`${src} loaded without its expected runtime.`));script.onerror=()=>reject(new Error(`Could not load ${src}.`));document.head.append(script)})}
const ready=(async()=>{for(const [src,test] of files)await load(src,test);dispatchEvent(new CustomEvent('civweave:local-ai-ready',{detail:{version:VERSION,byteProgress:true,backgroundFetch:true,capabilityRouting:true,localAgenticReasoning:true,directModelTest:true,runtimeSpine:true,cacheResolvedInference:true,localStreaming:true,integrityRepair:true,agenticToolSemantics:true,canonicalCausalLM:true,contextAware:true,timingDiagnostics:true,thinkingProfiles:true,artifactRevisionRepair:true}}));return true})().catch(error=>{console.warn('[civweave local ai]',error);dispatchEvent(new CustomEvent('civweave:local-ai-unavailable',{detail:{version:VERSION,message:String(error?.message||error)}}));return false});
globalThis.CivweaveLocalAIBootstrapV266=Object.freeze({version:VERSION,ready});
})();
