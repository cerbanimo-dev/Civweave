(()=>{
'use strict';
const VERSION='1.0.60-local-ai-bootstrap-v266';
if(globalThis.CivweaveLocalAIBootstrapV266?.version===VERSION)return;
const files=[
  ['/app/local-ai/model-registry-v266.js?v=1.0.60-v266',()=>globalThis.CivweaveLocalModelRegistryV266],
  ['/app/local-ai/direct-download-v266.js?v=1.0.60-v266',()=>globalThis.CivweaveLocalModelDownloadV266],
  ['/app/local-ai/runtime-v266.js?v=1.0.60-v266',()=>globalThis.CivweaveLocalModelRuntimeV266],
  ['/app/local-ai/runtime-bridge-v266.js?v=1.0.60-v266',()=>globalThis.CivweaveLocalModelBridgeV266],
  ['/app/local-ai/settings-panel-v266.js?v=1.0.60-v266',()=>globalThis.CivweaveLocalAISettingsV266]
];
function load(src,ready){if(ready?.())return Promise.resolve();return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.dataset.civweaveLocalAi='v266';script.onload=()=>ready?.()?resolve():reject(new Error(`${src} loaded without its expected runtime.`));script.onerror=()=>reject(new Error(`Could not load ${src}.`));document.head.append(script)})}
const ready=(async()=>{for(const [src,test] of files)await load(src,test);dispatchEvent(new CustomEvent('civweave:local-ai-ready',{detail:{version:VERSION}}));return true})().catch(error=>{console.warn('[civweave local ai]',error);dispatchEvent(new CustomEvent('civweave:local-ai-unavailable',{detail:{version:VERSION,message:String(error?.message||error)}}));return false});
globalThis.CivweaveLocalAIBootstrapV266=Object.freeze({version:VERSION,ready});
})();
