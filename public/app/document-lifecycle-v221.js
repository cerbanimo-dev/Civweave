(()=>{
'use strict';
const VERSION='document-lifecycle-v277-race-safe-phone-1b-tier';
const LEGACY_ENTRY_REVISION='document-lifecycle-v269-ai-settings-entry';
if(globalThis.CivweaveDocumentLifecycleV221?.version===VERSION)return;
let active=true;
const observers=new Set();
const NativeMutationObserver=globalThis.MutationObserver;
const AI_SETTINGS_SELECTOR='[data-open-unified-ai-settings],#aiSettings,#modelSettings,#btnAISettings,[data-ai-settings]';
const AI_SETTINGS_DELEGATION='/app/settings-delegation-v175.js?v=1.0.65-ai-settings-entry-v269';
const LOCAL_AI_BOOTSTRAP='/app/local-ai/bootstrap-v266.js?v=1.0.81-v277';
const LOCAL_AI_BOOTSTRAP_VERSION='1.0.81-local-ai-bootstrap-v277-race-safe-phone-1b-tier';
let settingsDelegationPromise=null;
let localAISettingsPromise=null;
if(typeof NativeMutationObserver==='function'){
  globalThis.MutationObserver=class CivweaveLifecycleMutationObserver extends NativeMutationObserver{
    constructor(callback){
      super((records,observer)=>{
        if(active&&document.documentElement?.isConnected)callback(records,observer);
      });
      observers.add(this);
    }
    disconnect(){
      observers.delete(this);
      return super.disconnect();
    }
  };
}
function localAIManagementReady(){
  return Boolean(
    globalThis.CivweaveLocalAIBootstrapV266?.version===LOCAL_AI_BOOTSTRAP_VERSION&&
    globalThis.CivweaveLocalAISettingsV266?.enhance&&
    globalThis.CivweaveLocalAISettingsV266?.truthfulCompletion===true&&
    globalThis.CivweaveLocalModelDownloadV266?.status&&
    globalThis.CivweaveLocalModelDownloadV266?.selection&&
    globalThis.CivweaveLocalModelDownloadV266?.metadataOnlyRepair===true&&
    globalThis.CivweaveLocalModelDownloadV266?.metadataRepairRaceSafe===true&&
    globalThis.CivweaveLocalModelRegistryV266?.installable&&
    globalThis.CivweaveLocalModelBridgeV266?.patch
  );
}
function enhanceLocalAISettings(){
  const panel=globalThis.CivweaveLocalAISettingsV266?.enhance?.()||null;
  globalThis.CivweaveLocalModelTestPulseV269?.enhance?.(panel||undefined);
  return panel;
}
function ensureAISettingsDelegation(){
  if(!active||typeof document==='undefined')return Promise.resolve(false);
  if(globalThis.CivweaveSettingsDelegationV188)return Promise.resolve(true);
  if(!document.querySelector(AI_SETTINGS_SELECTOR))return Promise.resolve(false);
  if(settingsDelegationPromise)return settingsDelegationPromise;
  settingsDelegationPromise=new Promise((resolve,reject)=>{
    const pathname=new URL(AI_SETTINGS_DELEGATION,location.href).pathname;
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===pathname);
    const finish=()=>resolve(Boolean(globalThis.CivweaveSettingsDelegationV188));
    if(existing){
      if(globalThis.CivweaveSettingsDelegationV188)return finish();
      existing.addEventListener('load',finish,{once:true});
      existing.addEventListener('error',()=>reject(new Error('AI settings delegation could not load.')),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=AI_SETTINGS_DELEGATION;
    script.async=false;
    script.dataset.civweaveAiSettingsEntry='v269';
    script.onload=finish;
    script.onerror=()=>reject(new Error('AI settings delegation could not load.'));
    document.head.append(script);
  }).catch(error=>{
    settingsDelegationPromise=null;
    try{dispatchEvent(new CustomEvent('civweave:ai-settings-entry-failed',{detail:{version:VERSION,message:String(error?.message||error)}}))}catch{}
    return false;
  });
  return settingsDelegationPromise;
}
function ensureLocalAISettingsManagement(){
  if(!active||typeof document==='undefined')return Promise.resolve(false);
  if(localAIManagementReady()){
    queueMicrotask(enhanceLocalAISettings);
    return Promise.resolve(true);
  }
  if(localAISettingsPromise)return localAISettingsPromise;
  localAISettingsPromise=(async()=>{
    let bootstrap=globalThis.CivweaveLocalAIBootstrapV266;
    if(bootstrap?.version!==LOCAL_AI_BOOTSTRAP_VERSION||!bootstrap?.ready){
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src=`${LOCAL_AI_BOOTSTRAP}&settings-mount=v277`;
        script.async=false;
        script.dataset.civweaveLocalAiSettings='v277';
        script.onload=()=>resolve(true);
        script.onerror=()=>reject(new Error('Downloaded local AI management could not load.'));
        document.head.append(script);
      });
      bootstrap=globalThis.CivweaveLocalAIBootstrapV266;
    }
    if(bootstrap?.version!==LOCAL_AI_BOOTSTRAP_VERSION||!bootstrap?.ready)throw new Error('Downloaded local AI bootstrap did not become available.');
    const ready=await bootstrap.ready;
    if(!ready||!localAIManagementReady())throw new Error('Downloaded local AI management did not become ready.');
    queueMicrotask(enhanceLocalAISettings);
    try{dispatchEvent(new CustomEvent('civweave:local-ai-settings-mounted',{detail:{version:VERSION,bootstrapVersion:bootstrap.version||'',managementReady:true,pulseReady:Boolean(globalThis.CivweaveLocalModelTestPulseV269?.enhance),metadataOnlyRepair:true,metadataRepairRaceSafe:true,truthfulCompletion:true,phone1BTier:true}}))}catch{}
    return true;
  })().catch(error=>{
    localAISettingsPromise=null;
    try{dispatchEvent(new CustomEvent('civweave:local-ai-settings-unavailable',{detail:{version:VERSION,message:String(error?.message||error)}}))}catch{}
    return false;
  });
  return localAISettingsPromise;
}
function startEntryRepair(){
  if(typeof document==='undefined')return;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>ensureAISettingsDelegation(),{once:true});
  else queueMicrotask(()=>ensureAISettingsDelegation());
}
function stop(){
  if(!active)return;
  active=false;
  for(const observer of observers){try{observer.disconnect()}catch{}}
  observers.clear();
}
addEventListener('civweave:model-settings-opened',()=>{ensureLocalAISettingsManagement()});
addEventListener('pagehide',stop,{once:true});
addEventListener('beforeunload',stop,{once:true});
startEntryRepair();
globalThis.CivweaveDocumentLifecycleV221=Object.freeze({
  version:VERSION,
  legacyEntryRevision:LEGACY_ENTRY_REVISION,
  active:()=>active,
  head:()=>document.head,
  body:()=>document.body,
  ensureAISettingsDelegation,
  ensureLocalAISettingsManagement,
  localAIManagementReady,
  enhanceLocalAISettings,
  aiSettingsEntryRepair:'v277-race-safe-phone-1b-local-metadata-repair',
  stop
});
})();
