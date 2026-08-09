(()=>{
'use strict';
const VERSION='1.0.60-local-ai-bootstrap-v267';
if(globalThis.CivweaveLocalAIBootstrapV266?.version===VERSION)return;
const files=[
  ['/app/local-ai/model-registry-v266.js?v=1.0.60-v267',()=>globalThis.CivweaveLocalModelRegistryV266],
  ['/app/local-ai/download-manager-v267.js?v=1.0.60-v267',()=>globalThis.CivweaveLocalModelDownloadV266?.version==='1.0.60-local-ai-download-v267'],
  ['/app/local-ai/runtime-v266.js?v=1.0.60-v267',()=>globalThis.CivweaveLocalModelRuntimeV266],
  ['/app/local-ai/runtime-bridge-v266.js?v=1.0.60-v267',()=>globalThis.CivweaveLocalModelBridgeV266],
  ['/app/local-ai/settings-panel-v267.js?v=1.0.60-v267',()=>globalThis.CivweaveLocalAISettingsV266?.version==='1.0.60-local-ai-settings-v267']
];
function load(src,ready){if(ready?.())return Promise.resolve();return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.dataset.civweaveLocalAi='v267';script.onload=()=>ready?.()?resolve():reject(new Error(`${src} loaded without its expected runtime.`));script.onerror=()=>reject(new Error(`Could not load ${src}.`));document.head.append(script)})}
const ready=(async()=>{for(const [src,test] of files)await load(src,test);dispatchEvent(new CustomEvent('civweave:local-ai-ready',{detail:{version:VERSION,byteProgress:true,backgroundFetch:true}}));return true})().catch(error=>{console.warn('[civweave local ai]',error);dispatchEvent(new CustomEvent('civweave:local-ai-unavailable',{detail:{version:VERSION,message:String(error?.message||error)}}));return false});
globalThis.CivweaveLocalAIBootstrapV266=Object.freeze({version:VERSION,ready});
})();
