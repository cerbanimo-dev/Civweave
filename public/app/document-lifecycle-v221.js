(()=>{
'use strict';
const VERSION='document-lifecycle-v269-ai-settings-entry';
if(globalThis.CivweaveDocumentLifecycleV221?.version===VERSION)return;
let active=true;
const observers=new Set();
const NativeMutationObserver=globalThis.MutationObserver;
const AI_SETTINGS_SELECTOR='[data-open-unified-ai-settings],#aiSettings,#modelSettings,#btnAISettings,[data-ai-settings]';
const AI_SETTINGS_DELEGATION='/app/settings-delegation-v175.js?v=1.0.65-ai-settings-entry-v269';
let settingsDelegationPromise=null;
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
addEventListener('pagehide',stop,{once:true});
addEventListener('beforeunload',stop,{once:true});
startEntryRepair();
globalThis.CivweaveDocumentLifecycleV221=Object.freeze({
  version:VERSION,
  active:()=>active,
  head:()=>document.head,
  body:()=>document.body,
  ensureAISettingsDelegation,
  aiSettingsEntryRepair:'v269-canonical-delegation',
  stop
});
})();
