(()=>{
'use strict';
const VERSION='document-lifecycle-v296-management-only-settings';
const LEGACY_ENTRY_REVISION='document-lifecycle-v269-ai-settings-entry';
const BF_CACHE_REVISION='v308-bfcache-visible-local-ai';
if(globalThis.CivweaveDocumentLifecycleV221?.version===VERSION&&globalThis.CivweaveDocumentLifecycleV221?.bfCacheRevision===BF_CACHE_REVISION)return;
let active=true;
const observers=new Set();
const NativeMutationObserver=globalThis.MutationObserver;
const AI_SETTINGS_SELECTOR='[data-action="settings"],[data-settings],#lite-settings,[data-open-unified-ai-settings],#aiSettings,#modelSettings,#btnAISettings,[data-ai-settings],[data-ls-action="open-ai-settings"],#settings-button,#model-chip';
const AI_SETTINGS_DELEGATION='/app/settings-delegation-v175.js?v=1.0.65-ai-settings-entry-v269';
const LOCAL_AI_BOOTSTRAP_VERSION='1.0.83-local-ai-bootstrap-v282-inference-health';
const LOCAL_AI_MANAGEMENT_FILES=[
  ['/app/local-ai/model-registry-v266.js?v=1.0.87-v287-coherence-v288',()=>Boolean(globalThis.CivweaveLocalModelRegistryV266?.installable&&globalThis.CivweaveLocalModelRegistryV266?.byId)],
  ['/app/local-ai/download-manager-v267.js?v=1.0.67-v271',()=>Boolean(globalThis.CivweaveLocalModelDownloadV266?.status&&globalThis.CivweaveLocalModelDownloadV266?.selection&&globalThis.CivweaveLocalModelDownloadV266?.state)],
  ['/app/local-ai/download-policy-v278.js?v=1.0.81-v278',()=>globalThis.CivweaveLocalModelDownloadV266?.largeExternalDataForeground===true],
  ['/app/local-ai/metadata-repair-v276.js?v=1.0.81-v277',()=>globalThis.CivweaveLocalModelDownloadV266?.metadataOnlyRepair===true&&globalThis.CivweaveLocalModelDownloadV266?.metadataRepairRaceSafe===true],
  ['/app/local-ai/settings-panel-v267.js?v=1.0.116-v305-download-dock-layout',()=>Boolean(globalThis.CivweaveLocalAISettingsV266?.enhance&&globalThis.CivweaveLocalAISettingsV266?.cacheIntegrityOnDemand===true&&globalThis.CivweaveLocalAISettingsV266?.openPath==='snapshot-first-v287')],
  ['/app/local-ai/primary-route-v283.js?v=1.0.88-v283',()=>globalThis.CivweaveLocalAIPrimaryRouteV283?.version==='1.0.85-local-ai-primary-route-v283'],
  ['/app/local-ai/hardware-tier-ui-v278.js?v=1.0.81-v278',()=>globalThis.CivweaveLocalModelHardwareTierUIV278?.version==='1.0.81-local-ai-hardware-tier-ui-v278']
];
const LOCAL_AI_VISIBLE_FILES=[LOCAL_AI_MANAGEMENT_FILES[0],LOCAL_AI_MANAGEMENT_FILES[1],LOCAL_AI_MANAGEMENT_FILES[4]];
let settingsDelegationPromise=null,localAISettingsPromise=null,minimalManagementPromise=null,visibleManagementPromise=null;
if(typeof NativeMutationObserver==='function'){
  globalThis.MutationObserver=class CivweaveLifecycleMutationObserver extends NativeMutationObserver{
    constructor(callback){super((records,observer)=>{if(active&&document.documentElement?.isConnected)callback(records,observer)});observers.add(this)}
    disconnect(){observers.delete(this);return super.disconnect()}
  };
}
function settingsController(){return globalThis.CivweaveAISettingsCleanroomV188||globalThis.CivweaveModelSettingsControllerV173||globalThis.CivweaveUnifiedAISettingsV175||null}
function localAIVisibleReady(){return Boolean(globalThis.CivweaveLocalAISettingsV266?.enhance&&globalThis.CivweaveLocalModelDownloadV266?.status&&globalThis.CivweaveLocalModelDownloadV266?.selection&&globalThis.CivweaveLocalModelRegistryV266?.installable)}
function localAIManagementReady(){return Boolean(globalThis.CivweaveLocalAISettingsV266?.enhance&&globalThis.CivweaveLocalAISettingsV266?.truthfulCompletion===true&&globalThis.CivweaveLocalAISettingsV266?.cacheIntegrityOnDemand===true&&globalThis.CivweaveLocalAISettingsV266?.openPath==='snapshot-first-v287'&&globalThis.CivweaveLocalModelDownloadV266?.status&&globalThis.CivweaveLocalModelDownloadV266?.selection&&globalThis.CivweaveLocalModelRegistryV266?.installable)}
function localAIInferenceReady(){return Boolean(localAIManagementReady()&&globalThis.CivweaveLocalAIBootstrapV266?.version===LOCAL_AI_BOOTSTRAP_VERSION&&globalThis.CivweaveLocalModelDownloadV266?.largeExternalDataForeground===true&&globalThis.CivweaveLocalModelDownloadV266?.metadataOnlyRepair===true&&globalThis.CivweaveLocalModelDownloadV266?.metadataRepairRaceSafe===true&&globalThis.CivweaveLocalModelRuntimeV266?.canonicalCausalLM===true&&globalThis.CivweaveLocalModelBridgeV266?.patch)}
function enhanceLocalAISettings(){const panel=globalThis.CivweaveLocalAISettingsV266?.enhance?.()||null;globalThis.CivweaveLocalModelTestPulseV269?.enhance?.(panel||undefined);return panel}
function ensureScript(src,ready,label='Civweave script'){
  if(ready?.())return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=src;script.async=false;script.dataset.civweaveSettingsRecovery='v308';
    const timer=setTimeout(()=>reject(new Error(`${label} did not become ready.`)),8000);
    script.onload=()=>{clearTimeout(timer);ready?.()?resolve(true):reject(new Error(`${label} loaded without becoming ready.`))};
    script.onerror=()=>{clearTimeout(timer);reject(new Error(`${label} could not load.`))};
    document.head.append(script);
  });
}
function ensureVisibleManagement(){
  if(localAIVisibleReady())return Promise.resolve(true);
  if(visibleManagementPromise)return visibleManagementPromise;
  visibleManagementPromise=(async()=>{for(const [src,ready] of LOCAL_AI_VISIBLE_FILES)await ensureScript(src,ready,'Downloaded local AI controls');return localAIVisibleReady()})().catch(error=>{visibleManagementPromise=null;throw error});
  return visibleManagementPromise;
}
function ensureMinimalManagement(){
  if(localAIManagementReady())return Promise.resolve(true);
  if(minimalManagementPromise)return minimalManagementPromise;
  minimalManagementPromise=(async()=>{for(const [src,ready] of LOCAL_AI_MANAGEMENT_FILES)await ensureScript(src,ready,'Downloaded local AI management');return localAIManagementReady()})().catch(error=>{minimalManagementPromise=null;throw error});
  return minimalManagementPromise;
}
function ensureAISettingsDelegation(){
  if(!active||typeof document==='undefined')return Promise.resolve(false);
  if(globalThis.CivweaveSettingsDelegationV188)return Promise.resolve(true);
  if(!document.querySelector(AI_SETTINGS_SELECTOR))return Promise.resolve(false);
  if(settingsDelegationPromise)return settingsDelegationPromise;
  settingsDelegationPromise=ensureScript(AI_SETTINGS_DELEGATION,()=>Boolean(globalThis.CivweaveSettingsDelegationV188),'AI settings delegation').catch(error=>{settingsDelegationPromise=null;try{dispatchEvent(new CustomEvent('civweave:ai-settings-entry-failed',{detail:{version:VERSION,message:String(error?.message||error)}}))}catch{}return false});
  return settingsDelegationPromise;
}
function ensureLocalAISettingsManagement(){
  if(!active||typeof document==='undefined')return Promise.resolve(false);
  if(localAIManagementReady()){queueMicrotask(enhanceLocalAISettings);return Promise.resolve(true)}
  if(localAISettingsPromise)return localAISettingsPromise;
  localAISettingsPromise=(async()=>{
    await ensureVisibleManagement();
    queueMicrotask(enhanceLocalAISettings);
    await ensureMinimalManagement();
    if(!localAIManagementReady())throw new Error('Downloaded local AI management did not become ready.');
    queueMicrotask(enhanceLocalAISettings);
    try{dispatchEvent(new CustomEvent('civweave:local-ai-settings-mounted',{detail:{version:VERSION,bfCacheRevision:BF_CACHE_REVISION,bootstrapVersion:globalThis.CivweaveLocalAIBootstrapV266?.version||'',bootstrapReady:false,managementReady:true,inferenceReady:localAIInferenceReady(),settingsFirst:true,managementOnly:true,inferenceDormantOnOpen:true,cacheIntegrityOnDemand:true,metadataOnlyRepair:Boolean(globalThis.CivweaveLocalModelDownloadV266?.metadataOnlyRepair),metadataRepairRaceSafe:Boolean(globalThis.CivweaveLocalModelDownloadV266?.metadataRepairRaceSafe),truthfulCompletion:true,largeExternalDataForeground:Boolean(globalThis.CivweaveLocalModelDownloadV266?.largeExternalDataForeground)}}))}catch{}
    return true;
  })().catch(error=>{localAISettingsPromise=null;try{dispatchEvent(new CustomEvent('civweave:local-ai-settings-unavailable',{detail:{version:VERSION,bfCacheRevision:BF_CACHE_REVISION,message:String(error?.message||error),settingsStillOpen:Boolean(document.getElementById('cw-ai-settings-cleanroom-v188')&&!document.getElementById('cw-ai-settings-cleanroom-v188').hidden)}}))}catch{}return false});
  return localAISettingsPromise;
}
function captureSettingsOpen(event){
  const launcher=event.target instanceof Element?event.target.closest(AI_SETTINGS_SELECTOR):null;if(!launcher)return;
  const controller=settingsController();if(!controller?.open)return;
  let layer=null;
  try{layer=controller.open(launcher)}catch(error){try{dispatchEvent(new CustomEvent('civweave:ai-settings-entry-failed',{detail:{version:VERSION,message:String(error?.message||error),phase:'capture-open'}}))}catch{}return}
  if(!layer)return;
  event.preventDefault();event.stopImmediatePropagation();
  queueMicrotask(()=>{void ensureAISettingsDelegation();void ensureLocalAISettingsManagement()});
}
function warmVisibleManagement(){
  if(!active||typeof document==='undefined')return;
  void ensureVisibleManagement().then(()=>{
    const layer=document.getElementById('cw-ai-settings-cleanroom-v188');
    if(layer&&!layer.hidden)queueMicrotask(enhanceLocalAISettings);
  }).catch(error=>{try{dispatchEvent(new CustomEvent('civweave:local-ai-settings-preload-failed',{detail:{version:VERSION,bfCacheRevision:BF_CACHE_REVISION,message:String(error?.message||error)}}))}catch{}});
}
function startEntryRepair(){
  if(typeof document==='undefined')return;
  document.removeEventListener('click',captureSettingsOpen,true);
  document.addEventListener('click',captureSettingsOpen,true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{void ensureAISettingsDelegation();warmVisibleManagement()},{once:true});
  else queueMicrotask(()=>{void ensureAISettingsDelegation();warmVisibleManagement()});
}
function stop(){
  if(!active)return;
  active=false;
  document.removeEventListener('click',captureSettingsOpen,true);
  for(const observer of observers){try{observer.disconnect()}catch{}}
  observers.clear();
}
function stopOnPageHide(event){if(event?.persisted)return;stop()}
function reviveFromPageShow(event){
  if(!document.documentElement?.isConnected)return false;
  if(!active){active=true;startEntryRepair()}
  else warmVisibleManagement();
  const layer=document.getElementById('cw-ai-settings-cleanroom-v188');
  if(layer&&!layer.hidden)void ensureLocalAISettingsManagement();
  try{dispatchEvent(new CustomEvent('civweave:document-lifecycle-resumed',{detail:{version:VERSION,bfCacheRevision:BF_CACHE_REVISION,persisted:Boolean(event?.persisted),localAIVisibleReady:localAIVisibleReady()}}))}catch{}
  return true;
}
addEventListener('civweave:model-settings-opened',()=>ensureLocalAISettingsManagement());
addEventListener('pagehide',stopOnPageHide);
addEventListener('beforeunload',stop,{once:true});
addEventListener('pageshow',reviveFromPageShow);
startEntryRepair();
globalThis.CivweaveDocumentLifecycleV221=Object.freeze({version:VERSION,legacyEntryRevision:LEGACY_ENTRY_REVISION,bfCacheRevision:BF_CACHE_REVISION,active:()=>active,head:()=>document.head,body:()=>document.body,ensureAISettingsDelegation,ensureLocalAISettingsManagement,ensureVisibleManagement,ensureMinimalManagement,localAIVisibleReady,localAIManagementReady,localAIInferenceReady,enhanceLocalAISettings,settingsController,reviveFromPageShow,aiSettingsEntryRepair:'v296-management-only-settings',settingsLoadPolicy:'visible-controls-preloaded-management-only-no-inference-v308',listenerPhase:'capture',stop});
})();
