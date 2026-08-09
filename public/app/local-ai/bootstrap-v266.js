(()=>{
'use strict';
const VERSION='1.0.66-local-ai-bootstrap-v270-streaming';
if(globalThis.CivweaveLocalAIBootstrapV266?.version===VERSION)return;
const files=[
  ['/app/ai-capability-broker-v268.js?v=1.0.66-v270',()=>globalThis.CivweaveAICapabilityBrokerV268?.version==='1.0.66-ai-capability-broker-v270-semantics'],
  ['/app/fast-interactive-runtime-v192.js?v=1.0.66-v270',()=>globalThis.CivweaveFastInteractiveV192?.version==='1.0.66-runtime-spine-v270'],
  ['/app/local-ai/model-registry-v266.js?v=1.0.61-v268',()=>globalThis.CivweaveLocalModelRegistryV266?.version==='1.0.61-local-ai-registry-v268-capabilities'],
  ['/app/local-ai/download-manager-v267.js?v=1.0.66-v270',()=>globalThis.CivweaveLocalModelDownloadV266?.version==='1.0.66-local-ai-download-v270-integrity'],
  ['/app/local-ai/runtime-v266.js?v=1.0.66-v270',()=>globalThis.CivweaveLocalModelRuntimeV266?.version==='1.0.66-local-ai-runtime-v270-streaming'],
  ['/app/local-ai/runtime-bridge-v266.js?v=1.0.66-v270',()=>globalThis.CivweaveLocalModelBridgeV266?.version==='1.0.66-local-ai-bridge-v270-streaming'],
  ['/app/local-ai/settings-panel-v267.js?v=1.0.60-v267',()=>globalThis.CivweaveLocalAISettingsV266?.version==='1.0.60-local-ai-settings-v267'],
  ['/app/local-ai/test-pulse-v269.js?v=1.0.66-v270',()=>globalThis.CivweaveLocalModelTestPulseV269?.version==='1.0.66-local-model-test-pulse-v270-repair-stream']
];
function load(src,ready){if(ready?.())return Promise.resolve();return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.dataset.civweaveLocalAi='v270';script.onload=()=>ready?.()?resolve():reject(new Error(`${src} loaded without its expected runtime.`));script.onerror=()=>reject(new Error(`Could not load ${src}.`));document.head.append(script)})}
const ready=(async()=>{for(const [src,test] of files)await load(src,test);dispatchEvent(new CustomEvent('civweave:local-ai-ready',{detail:{version:VERSION,byteProgress:true,backgroundFetch:true,capabilityRouting:true,localAgenticReasoning:true,directModelTest:true,runtimeSpine:true,localStreaming:true,integrityRepair:true,agenticToolSemantics:true}}));return true})().catch(error=>{console.warn('[civweave local ai]',error);dispatchEvent(new CustomEvent('civweave:local-ai-unavailable',{detail:{version:VERSION,message:String(error?.message||error)}}));return false});
globalThis.CivweaveLocalAIBootstrapV266=Object.freeze({version:VERSION,ready});
})();
