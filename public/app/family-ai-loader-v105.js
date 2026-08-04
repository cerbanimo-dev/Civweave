(()=>{
'use strict';
const VERSION='1.0.4-lazy-ai-r35';
const CSS=['/app/model-settings-v133.css?v=1.0.4','/app/intention-ui-v138.css?v=1.0.4','/app/assistant-runtime-v141.css?v=1.0.4'];
const SCRIPTS=[
  ['/app/shared/commonweave-parity-runtime.js?v=1.0.4',()=>globalThis.CommonweaveParity],
  ['/app/shared/commonweave-model-runtime.js?v=1.0.4',()=>globalThis.CommonweaveModelRuntime],
  ['/app/minilm-reflex-runtime-v138.js?v=1.0.4',()=>globalThis.CommonweaveReflexRuntime],
  ['/app/minilm-model-settings-v138.js?v=1.0.4',()=>globalThis.CommonweaveModelSettingsV133],
  ['/app/intention-planner-v141.js?v=1.0.4',()=>globalThis.CommonweaveIntentionPlanner],
  ['/app/intention-ui-v138.js?v=1.0.4',()=>globalThis.CommonweaveIntentionUI],
  ['/app/guide-contracts-v141.js?v=1.0.4',()=>globalThis.CommonweaveGuideContractsV141],
  ['/app/assistant-runtime-v141.js?v=1.0.4',()=>globalThis.CommonweaveAssistantV141],
  ['/app/core-loop-v152.js?v=1.0.4',()=>globalThis.CommonweaveCoreLoopV152],
  ['/app/guide-chat-v153.js?v=1.0.4',()=>globalThis.CommonweaveGuideChatV153],
  ['/app/capability-readiness-v154.js?v=1.0.4',()=>globalThis.CommonweaveCapabilityReadinessV154]
];
let promise=null;
function addCss(href){if([...document.styleSheets].some(sheet=>sheet.href&&new URL(sheet.href).pathname===new URL(href,location.href).pathname))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link)}
function loadScript(src,ready){if(ready?.())return Promise.resolve();const path=new URL(src,location.href).pathname,existing=[...document.scripts].find(script=>script.src&&new URL(script.src).pathname===path);if(existing)return new Promise((resolve,reject)=>{if(ready?.())return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error(`Could not load ${path}`)),{once:true});setTimeout(()=>ready?.()?resolve():reject(new Error(`${path} did not become ready`)),15000)});return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=true;script.onload=()=>resolve();script.onerror=()=>reject(new Error(`Could not load ${path}`));document.head.append(script)})}
function busy(label){let node=document.getElementById('cwf105-ai-busy');if(!node){node=document.createElement('div');node.id='cwf105-ai-busy';node.setAttribute('role','status');node.style.cssText='position:fixed;z-index:2147483646;left:50%;top:72px;transform:translateX(-50%);max-width:calc(100vw - 24px);padding:9px 13px;border:1px solid #ffffff38;border-radius:999px;background:#061019;color:#fff;font:700 12px system-ui;box-shadow:0 8px 24px #0008';document.body.append(node)}node.textContent=label;node.hidden=false;return()=>{node.hidden=true}}
async function ensure(){if(promise)return promise;promise=(async()=>{CSS.forEach(addCss);for(const [src,ready] of SCRIPTS){await loadScript(src,ready);await new Promise(requestAnimationFrame)}return true})().catch(error=>{promise=null;throw error});return promise}
async function openChat(system='commonweave',{prefill=''}={}){const done=busy('Loading the working guide…');try{await ensure();const dialog=globalThis.CommonweaveGuideChatV153.open(system);if(prefill){const input=dialog?.querySelector('textarea[name="message"]');if(input){input.value=prefill;input.focus()}}return dialog}finally{done()}}
async function openSettings(){const done=busy('Loading universal AI settings…');try{await ensure();return globalThis.CommonweaveModelSettingsV133.open()}finally{done()}}
function warm(){return ensure()}
globalThis.CommonweaveFamilyAILoaderV105={version:VERSION,ensure,warm,openChat,openSettings};
})();
