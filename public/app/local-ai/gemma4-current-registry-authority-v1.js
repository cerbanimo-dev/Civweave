(()=>{
'use strict';
const VERSION='1.0.1-gemma4-current-registry-authority-v1-formatted-output';
const AUTH_KEY='CivweaveGemma4PhonePerformanceCoreV1';
const REGISTRY_KEY='CivweaveLocalModelRegistryV266';
const FAST_E2='gemma4-e2b-it-litert-web',FAST_E4='gemma4-e4b-it-litert-web',LEGACY_E2='gemma4-e2b-it-q4f16',LEGACY_E4='gemma4-e4b-it-q4f16';
const REQUEST_AUTH_SRC='/app/local-ai/gemma4-litert-request-authority-v1.js?v=1.0.0-first-request-formatted-output';
const REQUEST_AUTH_VERSION='1.0.0-gemma4-litert-request-authority-v1';
const COMPACT_QUEST_SRC='/app/local-ai/gemma4-structured-quest-compact-envelope-v1.js?v=1.1.0-formatted-output';
const COMPACT_QUEST_VERSION='1.1.0-gemma4-structured-quest-compact-envelope-v1-formatted-output';
const freeze=value=>Object.freeze(value),same=(left=[],right=[])=>left.length===right.length&&left.every((value,index)=>value===right[index]);
if(globalThis.CivweaveGemma4CurrentRegistryAuthorityV1?.version===VERSION){globalThis.CivweaveGemma4CurrentRegistryAuthorityV1.schedule?.();globalThis.CivweaveGemma4CurrentRegistryAuthorityV1.ensureRequestAuthority?.();globalThis.CivweaveGemma4CurrentRegistryAuthorityV1.ensureCompactQuestEnvelope?.();return}
let queued=false,compactQuestFlight=null,requestAuthorityFlight=null;
function currentMissing(registry){return[FAST_E2,FAST_E4].filter(id=>!registry?.byId?.(id))}
function compatibilityMissing(registry){return[LEGACY_E2,LEGACY_E4].filter(id=>!registry?.byId?.(id))}
function repairRegistryValue(registry){
  if(!registry?.byId||!Array.isArray(registry.models))return registry;
  const missing=currentMissing(registry),compatibility=compatibilityMissing(registry);
  if(registry.gemma4PhoneLegacyRegistrationRequired===false&&same(registry.gemma4PhonePerformanceRegistryMissing||[],missing)&&same(registry.gemma4PhoneCompatibilityRegistryMissing||[],compatibility))return registry;
  return freeze({...registry,__civweaveGemma4PhonePerformanceRegistryV1:true,gemma4PhonePerformanceRegistry:true,gemma4PhonePerformanceRegistryComplete:missing.length===0,gemma4PhonePerformanceRegistryMissing:freeze(missing),gemma4PhoneCompatibilityRegistryMissing:freeze(compatibility),gemma4PhoneLegacyRegistrationRequired:false,gemma4PhonePrimaryModel:FAST_E2,gemma4PhoneDeepModel:FAST_E4});
}
function repairRegistry(){const current=globalThis[REGISTRY_KEY],next=repairRegistryValue(current);if(next&&next!==current){try{globalThis[REGISTRY_KEY]=next}catch{}}return globalThis[REGISTRY_KEY]||next||current||null}
function loadRuntime(src,ready,dataKey){
  if(ready())return Promise.resolve(true);if(!globalThis.document?.createElement||!document.head)return Promise.resolve(false);
  return new Promise(resolve=>{
    let settled=false,timer=0;
    const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);resolve(Boolean(ok&&ready()))};
    const path=new URL(src,location.href).pathname;let existing=null;
    try{existing=[...(document.scripts||[])].find(node=>new URL(node.src,location.href).pathname===path)||null}catch{}
    if(existing&&!ready())try{existing.remove()}catch{}
    if(ready()){finish(true);return}
    const script=document.createElement('script');script.src=src;script.async=false;script.dataset[dataKey]='v1';script.onload=()=>finish(true);script.onerror=()=>finish(false);document.head.append(script);timer=setTimeout(()=>finish(ready()),5000);
  });
}
function requestAuthorityReady(){return globalThis.CivweaveGemma4LiteRTRequestAuthorityV1?.version===REQUEST_AUTH_VERSION}
function ensureRequestAuthority(){
  if(requestAuthorityReady()){globalThis.CivweaveGemma4LiteRTRequestAuthorityV1.schedule?.();return Promise.resolve(true)}
  if(requestAuthorityFlight)return requestAuthorityFlight;
  requestAuthorityFlight=loadRuntime(REQUEST_AUTH_SRC,requestAuthorityReady,'civweaveGemma4RequestAuthority').finally(()=>{requestAuthorityFlight=null});return requestAuthorityFlight;
}
function compactQuestReady(){return globalThis.CivweaveGemma4StructuredQuestCompactEnvelopeV1?.version===COMPACT_QUEST_VERSION}
function ensureCompactQuestEnvelope(){
  if(compactQuestReady()){globalThis.CivweaveGemma4StructuredQuestCompactEnvelopeV1.schedule?.();return Promise.resolve(true)}
  if(compactQuestFlight)return compactQuestFlight;
  compactQuestFlight=loadRuntime(COMPACT_QUEST_SRC,compactQuestReady,'civweaveGemma4CompactQuest').finally(()=>{compactQuestFlight=null});return compactQuestFlight;
}
function installAuthority(){
  const base=globalThis[AUTH_KEY];if(!base?.assertSelectedPerformance)return false;repairRegistry();if(base.currentRegistryOnlyAuthority===VERSION)return true;
  const basePatch=typeof base.patchRegistry==='function'?base.patchRegistry.bind(base):null,baseApply=typeof base.applyAuthority==='function'?base.applyAuthority.bind(base):null,baseActivate=typeof base.activate==='function'?base.activate.bind(base):null,baseAssert=base.assertSelectedPerformance.bind(base);
  const patchRegistry=registry=>repairRegistryValue(basePatch?basePatch(registry):registry);
  const applyAuthority=()=>{let result;try{result=baseApply?.()}finally{repairRegistry()}return result??{registryReady:Boolean(globalThis[REGISTRY_KEY]),packsReady:true,ready:Boolean(globalThis[REGISTRY_KEY])}};
  const activate=()=>{repairRegistry();const result=baseActivate?.();repairRegistry();return result??true};
  const assertSelectedPerformance=()=>{repairRegistry();return baseAssert()};
  const next=freeze({...base,patchRegistry,applyAuthority,activate,assertSelectedPerformance,currentRegistryOnlyAuthority:VERSION,legacyRegistrationRequired:false,currentPhoneModels:freeze([FAST_E2,FAST_E4])});
  try{globalThis[AUTH_KEY]=next}catch{return false}repairRegistry();
  try{dispatchEvent(new CustomEvent('civweave:gemma4-current-registry-authority-ready',{detail:{version:VERSION,currentModels:[FAST_E2,FAST_E4],legacyRegistrationRequired:false,requestAuthorityLoader:true,compactQuestEnvelopeLoader:true,formattedOutput:true}}))}catch{}return true;
}
function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;installAuthority();repairRegistry();void ensureRequestAuthority();void ensureCompactQuestEnvelope()})}
for(const name of ['civweave:gemma4-phone-performance-authority','civweave:gemma4-phone-authority-ready','civweave:local-model-runtime-ready','civweave:local-model-pack-selected','civweave:gemma4-structured-quest-completion-ready','pageshow'])addEventListener(name,schedule);
for(const delay of [0,40,180,650,1600,3200])setTimeout(schedule,delay);
globalThis.CivweaveGemma4CurrentRegistryAuthorityV1=freeze({version:VERSION,installAuthority,repairRegistry,repairRegistryValue,schedule,ensureRequestAuthority,requestAuthorityLoader:true,requestAuthoritySource:REQUEST_AUTH_SRC,ensureCompactQuestEnvelope,compactQuestEnvelopeLoader:true,compactQuestEnvelopeSource:COMPACT_QUEST_SRC,currentModels:freeze([FAST_E2,FAST_E4]),compatibilityModels:freeze([LEGACY_E2,LEGACY_E4]),legacyRegistrationRequired:false,formattedOutput:true,runtimeAuthorityOnly:true,presentationOwnership:false});
schedule();
})();