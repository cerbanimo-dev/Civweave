(()=>{
'use strict';
const VERSION='1.1.0-cerbanimo-chat-quest-capability-v1-v2-loader';
const TARGET='/app/cerbanimo-chat-quest-capability-v2.js';
const TARGET_VERSION='2.0.0-recoverable-json';
if(globalThis.CivweaveCerbanimoChatQuestCapabilityV1?.version===VERSION)return;
let promise=null;
function existing(){return globalThis.CivweaveCerbanimoChatQuestCapabilityV2||null}
function load(){
  const ready=existing();if(ready){ready.install?.();return Promise.resolve(ready)}
  if(promise)return promise;
  promise=new Promise((resolve,reject)=>{
    const found=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===TARGET}catch{return false}});
    const finish=()=>{const api=existing();if(!api){promise=null;reject(new Error('Cerbanimo Endeavor authoring v2 loaded without its runtime.'));return}api.install?.();resolve(api)};
    if(found){found.addEventListener('load',finish,{once:true});setTimeout(()=>existing()?finish():(promise=null),1800);return}
    const script=document.createElement('script');script.src=`${TARGET}?v=${TARGET_VERSION}`;script.async=false;script.onload=finish;script.onerror=()=>{promise=null;reject(new Error('Could not load Cerbanimo Endeavor authoring v2.'))};document.head?.append(script);
  });
  return promise;
}
function install(){void load().catch(error=>{try{console.warn('[Civweave] Cerbanimo Endeavor v2 did not attach:',error)}catch{}});return true}
for(const name of ['civweave:unified-chat-system-ready','civweave:assistant-runtime-ready','civweave:guide-loader-reset','pageshow'])addEventListener(name,install);
install();
globalThis.CivweaveCerbanimoChatQuestCapabilityV1=Object.freeze({
  version:VERSION,target:TARGET,targetVersion:TARGET_VERSION,compatibilityLoader:true,install,load,
  questIntent:text=>Boolean(existing()?.questIntent?.(text)),
  state:()=>({loaded:Boolean(existing()),targetVersion:existing()?.version||''})
});
})();
