(()=>{
'use strict';

const VERSION='1.0.0-gemma4-current-registry-authority-v1';
const AUTH_KEY='CivweaveGemma4PhonePerformanceCoreV1';
const REGISTRY_KEY='CivweaveLocalModelRegistryV266';
const FAST_E2='gemma4-e2b-it-litert-web';
const FAST_E4='gemma4-e4b-it-litert-web';
const LEGACY_E2='gemma4-e2b-it-q4f16';
const LEGACY_E4='gemma4-e4b-it-q4f16';
const freeze=value=>Object.freeze(value);
const same=(left=[],right=[])=>left.length===right.length&&left.every((value,index)=>value===right[index]);

if(globalThis.CivweaveGemma4CurrentRegistryAuthorityV1?.version===VERSION){
  globalThis.CivweaveGemma4CurrentRegistryAuthorityV1.schedule?.();
  return;
}

let queued=false;
function currentMissing(registry){return [FAST_E2,FAST_E4].filter(id=>!registry?.byId?.(id))}
function compatibilityMissing(registry){return [LEGACY_E2,LEGACY_E4].filter(id=>!registry?.byId?.(id))}
function repairRegistryValue(registry){
  if(!registry?.byId||!Array.isArray(registry.models))return registry;
  const missing=currentMissing(registry),compatibility=compatibilityMissing(registry);
  if(registry.gemma4PhoneLegacyRegistrationRequired===false&&same(registry.gemma4PhonePerformanceRegistryMissing||[],missing)&&same(registry.gemma4PhoneCompatibilityRegistryMissing||[],compatibility))return registry;
  return freeze({
    ...registry,
    __civweaveGemma4PhonePerformanceRegistryV1:true,
    gemma4PhonePerformanceRegistry:true,
    gemma4PhonePerformanceRegistryComplete:missing.length===0,
    gemma4PhonePerformanceRegistryMissing:freeze(missing),
    gemma4PhoneCompatibilityRegistryMissing:freeze(compatibility),
    gemma4PhoneLegacyRegistrationRequired:false,
    gemma4PhonePrimaryModel:FAST_E2,
    gemma4PhoneDeepModel:FAST_E4
  });
}
function repairRegistry(){
  const current=globalThis[REGISTRY_KEY],next=repairRegistryValue(current);
  if(next&&next!==current){
    try{globalThis[REGISTRY_KEY]=next}catch{}
  }
  return globalThis[REGISTRY_KEY]||next||current||null;
}
function installAuthority(){
  const base=globalThis[AUTH_KEY];
  if(!base?.assertSelectedPerformance)return false;
  repairRegistry();
  if(base.currentRegistryOnlyAuthority===VERSION)return true;
  const basePatch=typeof base.patchRegistry==='function'?base.patchRegistry.bind(base):null;
  const baseApply=typeof base.applyAuthority==='function'?base.applyAuthority.bind(base):null;
  const baseActivate=typeof base.activate==='function'?base.activate.bind(base):null;
  const baseAssert=base.assertSelectedPerformance.bind(base);
  const patchRegistry=registry=>repairRegistryValue(basePatch?basePatch(registry):registry);
  const applyAuthority=()=>{
    let result;
    try{result=baseApply?.()}finally{repairRegistry()}
    return result??{registryReady:Boolean(globalThis[REGISTRY_KEY]),packsReady:true,ready:Boolean(globalThis[REGISTRY_KEY])};
  };
  const activate=()=>{
    repairRegistry();
    const result=baseActivate?.();
    repairRegistry();
    return result??true;
  };
  const assertSelectedPerformance=()=>{
    repairRegistry();
    return baseAssert();
  };
  const next=freeze({
    ...base,
    patchRegistry,
    applyAuthority,
    activate,
    assertSelectedPerformance,
    currentRegistryOnlyAuthority:VERSION,
    legacyRegistrationRequired:false,
    currentPhoneModels:freeze([FAST_E2,FAST_E4])
  });
  try{globalThis[AUTH_KEY]=next}catch{return false}
  repairRegistry();
  try{dispatchEvent(new CustomEvent('civweave:gemma4-current-registry-authority-ready',{detail:{version:VERSION,currentModels:[FAST_E2,FAST_E4],legacyRegistrationRequired:false}}))}catch{}
  return true;
}
function schedule(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{
    queued=false;
    installAuthority();
    repairRegistry();
  });
}
for(const name of ['civweave:gemma4-phone-performance-authority','civweave:gemma4-phone-authority-ready','civweave:local-model-runtime-ready','civweave:local-model-pack-selected','pageshow'])addEventListener(name,schedule);
for(const delay of [0,40,180,650,1600,3200])setTimeout(schedule,delay);

globalThis.CivweaveGemma4CurrentRegistryAuthorityV1=freeze({
  version:VERSION,
  installAuthority,
  repairRegistry,
  repairRegistryValue,
  schedule,
  currentModels:freeze([FAST_E2,FAST_E4]),
  compatibilityModels:freeze([LEGACY_E2,LEGACY_E4]),
  legacyRegistrationRequired:false,
  runtimeAuthorityOnly:true,
  presentationOwnership:false
});
schedule();
})();
