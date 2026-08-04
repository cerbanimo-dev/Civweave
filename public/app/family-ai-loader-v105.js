(()=>{
'use strict';
const VERSION='1.0.4-lazy-ai-r37-unified-settings';
if(globalThis.CommonweaveFamilyAILoaderV105?.version===VERSION)return;
const CSS=['/app/model-settings-v133.css?v=1.0.4','/app/intention-ui-v138.css?v=1.0.4','/app/assistant-runtime-v141.css?v=1.0.4'];
const settingsApi=()=>globalThis.CommonweaveModelSettingsV157||globalThis.CommonweaveModelSettingsV133||null;
const SCRIPTS=[
  ['/app/shared/commonweave-parity-runtime.js?v=1.0.4',()=>globalThis.CommonweaveParity],
  ['/app/shared/commonweave-model-runtime.js?v=1.0.4',()=>globalThis.CommonweaveModelRuntime],
  ['/app/minilm-reflex-runtime-v138.js?v=1.0.4',()=>globalThis.CommonweaveReflexRuntime],
  ['/app/minilm-model-settings-v138.js?v=1.0.4',()=>globalThis.CommonweaveModelSettingsV157?.version==='157.1'&&globalThis.CommonweaveModelSettingsV133===globalThis.CommonweaveModelSettingsV157],
  ['/app/intention-planner-v141.js?v=1.0.4',()=>globalThis.CommonweaveIntentionPlanner],
  ['/app/intention-ui-v138.js?v=1.0.4',()=>globalThis.CommonweaveIntentionUI],
  ['/app/guide-contracts-v141.js?v=1.0.4',()=>globalThis.CommonweaveGuideContractsV141],
  ['/app/assistant-runtime-v141.js?v=1.0.4',()=>globalThis.CommonweaveAssistantV141],
  ['/app/core-loop-v152.js?v=1.0.4',()=>globalThis.CommonweaveCoreLoopV152],
  ['/app/guide-chat-v153.js?v=1.0.4',()=>globalThis.CommonweaveGuideChatV153],
  ['/app/capability-readiness-v154.js?v=1.0.4',()=>globalThis.CommonweaveCapabilityReadinessV154]
];
let promise=null,busyCount=0,generation=0;
const pathOf=value=>new URL(value,location.href).pathname;
function addCss(href){if([...document.styleSheets].some(sheet=>{try{return sheet.href&&pathOf(sheet.href)===pathOf(href)}catch{return false}}))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.cwf105='style';document.head.append(link)}
function removeStale(path,ready){for(const script of [...document.scripts]){if(!script.src||pathOf(script.src)!==path)continue;if(ready?.())return false;if(script.dataset.cwf105State!=='loading')script.remove()}return true}
function loadScript(src,ready){if(ready?.())return Promise.resolve();const path=pathOf(src);const existing=[...document.scripts].find(script=>script.src&&pathOf(script.src)===path);
  if(existing&&existing.dataset.cwf105State==='loading')return new Promise((resolve,reject)=>{let settled=false;const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);clearInterval(poll);error?reject(error):resolve()};const poll=setInterval(()=>{if(ready?.())finish()},50);const timer=setTimeout(()=>finish(new Error(`${path} did not become ready`)),12000);existing.addEventListener('load',()=>ready?.()?finish():finish(new Error(`${path} loaded without its runtime`)),{once:true});existing.addEventListener('error',()=>finish(new Error(`Could not load ${path}`)),{once:true})});
  removeStale(path,ready);if(ready?.())return Promise.resolve();return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.dataset.cwf105State='loading';let settled=false;const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);if(error){script.dataset.cwf105State='failed';script.remove();reject(error)}else{script.dataset.cwf105State='ready';resolve()}};const timer=setTimeout(()=>finish(new Error(`${path} timed out while loading`)),12000);script.onload=()=>ready?.()?finish():finish(new Error(`${path} loaded without exposing its runtime`));script.onerror=()=>finish(new Error(`Could not load ${path}`));document.head.append(script)})}
function busy(label){busyCount+=1;let node=document.getElementById('cwf105-ai-busy');if(!node){node=document.createElement('div');node.id='cwf105-ai-busy';node.setAttribute('role','status');node.style.cssText='position:fixed;z-index:2147483646;left:50%;top:72px;transform:translateX(-50%);max-width:calc(100vw - 24px);padding:9px 13px;border:1px solid #ffffff38;border-radius:999px;background:#061019;color:#fff;font:700 12px system-ui;box-shadow:0 8px 24px #0008';document.body.append(node)}node.textContent=label;node.hidden=false;let released=false;return()=>{if(released)return;released=true;busyCount=Math.max(0,busyCount-1);if(!busyCount)node.hidden=true}}
function reset(reason='manual reset'){generation+=1;promise=null;for(const [src,ready] of SCRIPTS){if(ready?.())continue;const path=pathOf(src);for(const script of [...document.scripts])if(script.src&&pathOf(script.src)===path)script.remove()}dispatchEvent(new CustomEvent('commonweave:guide-loader-reset',{detail:{reason,at:new Date().toISOString()}}))}
async function ensure(){if(globalThis.CommonweaveGuideChatV153&&globalThis.CommonweaveModelSettingsV157?.version==='157.1'&&globalThis.CommonweaveModelSettingsV133===globalThis.CommonweaveModelSettingsV157)return true;if(promise)return promise;const ticket=++generation;promise=(async()=>{CSS.forEach(addCss);for(const [src,ready] of SCRIPTS){if(ticket!==generation)throw new Error('Guide loading was reset.');await loadScript(src,ready);await new Promise(resolve=>requestAnimationFrame(resolve))}return true})().catch(error=>{if(ticket===generation)reset(error.message);throw error});return promise}
async function openChat(system='commonweave',{prefill=''}={}){const done=busy('Loading the working guide…');try{await ensure();const dialog=globalThis.CommonweaveGuideChatV153.open(system);if(prefill){const input=dialog?.querySelector('textarea[name="message"]');if(input){input.value=prefill;input.focus()}}return dialog}catch(error){reset(error.message);throw error}finally{done()}}
async function openSettings(){const done=busy('Loading shared AI settings…');try{await ensure();const api=settingsApi();if(!api?.open)throw new Error('The unified settings runtime is unavailable.');return api.open()}catch(error){reset(error.message);throw error}finally{done()}}
function warm(){return ensure()}
addEventListener('pageshow',event=>{if(event.persisted&&promise&&!globalThis.CommonweaveGuideChatV153)reset('restored page contained an incomplete guide load')});
globalThis.CommonweaveFamilyAILoaderV105={version:VERSION,ensure,warm,openChat,openSettings,reset};
})();
