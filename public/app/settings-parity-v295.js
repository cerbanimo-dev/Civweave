(()=>{
'use strict';
const VERSION='1.0.97-settings-parity-v295',SELECTOR='[data-action="settings"],[data-settings],#lite-settings,[data-open-unified-ai-settings],#aiSettings,#modelSettings,#btnAISettings,[data-ai-settings],[data-ls-action="open-ai-settings"],#settings-button,#model-chip',CONTROLLER='/app/model-settings-controller-v173.js',GUARD='/app/ai-settings-bind-guard-v230.js',LIFECYCLE='/app/document-lifecycle-v221.js';
if(globalThis.CivweaveSettingsParityV295?.version===VERSION)return;
let opening=false;
function load(src,ready){if(ready?.())return Promise.resolve(true);const path=new URL(src,location.href).pathname,old=[...document.scripts].find(x=>x.src&&new URL(x.src,location.href).pathname===path);if(old)return new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error(`${path} did not become ready.`)),12000),done=()=>{clearTimeout(t);ready?.()?resolve(true):reject(new Error(`${path} loaded without becoming ready.`))};old.addEventListener('load',done,{once:true});old.addEventListener('error',()=>{clearTimeout(t);reject(new Error(`Could not load ${path}.`))},{once:true});queueMicrotask(()=>{if(ready?.()){clearTimeout(t);resolve(true)}})});return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.dataset.civweaveSettingsParity='v295';s.onload=()=>ready?.()?resolve(true):reject(new Error(`${path} loaded without becoming ready.`));s.onerror=()=>reject(new Error(`Could not load ${path}.`));document.head.append(s)})}
async function stack(){
 await load(CONTROLLER,()=>Boolean(globalThis.CivweaveAISettingsCleanroomV188?.open||globalThis.CivweaveModelSettingsControllerV173?.open));
 await load(GUARD,()=>Boolean(globalThis.CivweaveAISettingsBindGuardV230?.install));globalThis.CivweaveAISettingsBindGuardV230?.install?.();
 await load(LIFECYCLE,()=>Boolean(globalThis.CivweaveDocumentLifecycleV221?.ensureLocalAISettingsManagement));
 return globalThis.CivweaveAISettingsCleanroomV188||globalThis.CivweaveModelSettingsControllerV173||globalThis.CivweaveUnifiedAISettingsV175;
}
async function open(launcher){
 if(opening)return null;opening=true;
 try{const controller=await stack(),layer=controller?.open?.(launcher);if(!layer)throw new Error('The canonical AI settings surface did not open.');queueMicrotask(()=>globalThis.CivweaveDocumentLifecycleV221?.ensureLocalAISettingsManagement?.());return layer}
 catch(error){try{dispatchEvent(new CustomEvent('civweave:ai-settings-entry-failed',{detail:{version:VERSION,message:String(error?.message||error),phase:'settings-parity-v295'}}))}catch{}return null}
 finally{opening=false}
}
function capture(e){const target=e.target instanceof Element?e.target.closest(SELECTOR):null;if(!target||target.closest('#cw-ai-settings-cleanroom-v188'))return;e.preventDefault();e.stopImmediatePropagation();void open(target)}
document.addEventListener('click',capture,true);
globalThis.CivweaveSettingsParityV295=Object.freeze({version:VERSION,selector:SELECTOR,capturePhase:true,canonicalCleanroom:true,downloadedLocalManagement:true,stack,open});
})();