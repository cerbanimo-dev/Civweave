(()=>{
'use strict';
const VERSION='1.4.1-cerbanimo-chat-quest-capability-v1-v3-provider-authority-gate';
const V2='/app/cerbanimo-chat-quest-capability-v2.js';
const V2_VERSION='2.2.0-malformed-json-repair-r1-from-2.1.0-transient-provider-failover';
const V3='/app/cerbanimo-chat-quest-capability-v3.js';
const V3_VERSION='3.0.0-gemini-provider-authority-r1';
if(globalThis.CivweaveCerbanimoChatQuestCapabilityV1?.version===VERSION)return;
let promise=null,gateTimer=0;
function find(path){return[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===path}catch{return false}})}
function loadScript(path,version,ready,label){
  if(ready())return Promise.resolve(ready());
  return new Promise((resolve,reject)=>{
    const existing=find(path),finish=()=>{const api=ready();if(!api){reject(new Error(`${label} loaded without its runtime.`));return}resolve(api)};
    if(existing){existing.addEventListener('load',finish,{once:true});setTimeout(()=>ready()?finish():reject(new Error(`${label} did not become ready.`)),1800);return}
    const script=document.createElement('script');script.src=`${path}?v=${version}`;script.async=false;script.onload=finish;script.onerror=()=>reject(new Error(`Could not load ${label}.`));document.head?.append(script);
  });
}
async function authorityGate(request,next){
  try{const authority=await load();return authority?.handler?authority.handler(request,next):next(request)}
  catch{return next(request)}
}
function claimGate(){const chat=globalThis.CivweaveUnifiedChatSystemV1;if(!chat?.registerCapability)return false;chat.registerCapability('cerbanimo',authorityGate);return true}
function holdGate(){
  claimGate();if(gateTimer)return;
  let ticks=0;gateTimer=setInterval(()=>{ticks+=1;const authority=globalThis.CivweaveCerbanimoChatQuestCapabilityV3;if(authority?.handler){clearInterval(gateTimer);gateTimer=0;authority.install?.();return}claimGate();if(ticks>=60){clearInterval(gateTimer);gateTimer=0}},40);
}
async function load(){
  if(promise)return promise;
  promise=(async()=>{
    const legacy=await loadScript(V2,V2_VERSION,()=>globalThis.CivweaveCerbanimoChatQuestCapabilityV2,'Cerbanimo Endeavor authoring v2');
    legacy.install?.();claimGate();
    const authority=await loadScript(V3,V3_VERSION,()=>globalThis.CivweaveCerbanimoChatQuestCapabilityV3,'Cerbanimo Endeavor provider authority v3');
    authority.install?.();
    if(gateTimer){clearInterval(gateTimer);gateTimer=0}
    return authority;
  })().catch(error=>{promise=null;if(gateTimer){clearInterval(gateTimer);gateTimer=0}throw error});
  return promise;
}
function install(){holdGate();void load().catch(error=>{try{console.warn('[Civweave] Cerbanimo Endeavor provider authority did not attach:',error)}catch{}});return true}
for(const name of ['civweave:unified-chat-system-ready','civweave:assistant-runtime-ready','civweave:guide-loader-reset','pageshow'])addEventListener(name,install);
install();
globalThis.CivweaveCerbanimoChatQuestCapabilityV1=Object.freeze({
  version:VERSION,target:V3,targetVersion:V3_VERSION,legacyTarget:V2,legacyVersion:V2_VERSION,compatibilityLoader:true,providerAuthority:'selected-provider',crossProviderFailover:false,install,load,
  questIntent:text=>Boolean(globalThis.CivweaveCerbanimoChatQuestCapabilityV3?.questIntent?.(text)||globalThis.CivweaveCerbanimoChatQuestCapabilityV2?.questIntent?.(text)),
  state:()=>({loaded:Boolean(globalThis.CivweaveCerbanimoChatQuestCapabilityV3),targetVersion:globalThis.CivweaveCerbanimoChatQuestCapabilityV3?.version||'',legacyLoaded:Boolean(globalThis.CivweaveCerbanimoChatQuestCapabilityV2),gateActive:Boolean(gateTimer)})
});
})();