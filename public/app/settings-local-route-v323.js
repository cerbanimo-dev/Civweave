(()=>{
'use strict';
const VERSION='1.0.1-settings-local-route-v323';
const ROUTE='downloaded-local';
const SELECTION_KEY='civweave.local-ai.selection.v266';
const SETTINGS_KEY='civweave.universal-ai.v127';
const PROFILES_KEY='civweave-model-profiles-v1';
if(globalThis.CivweaveSettingsLocalRouteV323?.version===VERSION)return;
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
function selection(){try{return parse(localStorage.getItem(SELECTION_KEY),{active:false,id:null})}catch{return{active:false,id:null}}}
function fallbackConfig(){
  try{
    const profiles=parse(localStorage.getItem(PROFILES_KEY),{}),saved=parse(localStorage.getItem(SETTINGS_KEY),{}),interactive=profiles.interactive&&typeof profiles.interactive==='object'?profiles.interactive:saved;
    return interactive&&typeof interactive==='object'?interactive:{};
  }catch{return{}}
}
function selectedLabel(){const current=selection();return current.active&&current.id?String(current.id):'No downloaded model selected'}
function panelFor(form){
  let panel=form.querySelector('[data-panel="downloaded-local"]');
  if(panel)return panel;
  panel=document.createElement('section');
  panel.className='cw-clean-panel';
  panel.dataset.panel='downloaded-local';
  panel.hidden=true;
  panel.innerHTML='<div><h3>Downloaded local AI</h3><p data-downloaded-local-summary></p></div><div class="cw-clean-note">Use the Local models tab to choose or download a model. Selecting a downloaded model keeps your configured remote provider as fallback; opening Settings does not load the model runtime.</div>';
  const anchor=form.querySelector('[data-panel="deterministic"]');
  if(anchor)anchor.after(panel);else form.prepend(panel);
  return panel;
}
function sync(form){
  if(!form?.isConnected)return false;
  const route=form.elements?.namedItem?.('route');if(!route)return false;
  if(!route.querySelector(`option[value="${ROUTE}"]`)){
    const option=document.createElement('option');option.value=ROUTE;option.textContent='Downloaded local AI';
    const deterministic=route.querySelector('option[value="deterministic"]');
    deterministic?.after(option)||route.prepend(option);
  }
  const panel=panelFor(form),current=selection(),summary=panel.querySelector('[data-downloaded-local-summary]');
  if(summary)summary.textContent=current.active&&current.id?`${current.id} is selected for on-device interactive chat.`:'No downloaded model is selected yet.';
  const useLocal=route.value===ROUTE;
  panel.hidden=!useLocal;
  if(useLocal){form.querySelector('[data-panel="deterministic"]')?.setAttribute('hidden','');form.querySelector('[data-panel="remote"]')?.setAttribute('hidden','')}
  return true;
}
function patch(form=document.querySelector('[data-cw-settings-form]')){
  if(!form?.isConnected)return false;
  const route=form.elements?.namedItem?.('route');if(!route)return false;
  sync(form);
  const current=selection();if(current.active&&current.id)route.value=ROUTE;
  sync(form);
  if(form.dataset.cwLocalRouteV323==='1')return true;
  form.dataset.cwLocalRouteV323='1';
  route.addEventListener('change',()=>queueMicrotask(()=>sync(form)));
  form.addEventListener('submit',event=>{
    const chosen=String(route.value||'');
    const currentSelection=selection();
    if(chosen===ROUTE){
      event.preventDefault();event.stopImmediatePropagation();
      const status=form.querySelector('[data-status]');
      if(!currentSelection.active||!currentSelection.id){
        if(status)status.textContent='Choose a downloaded model in Local models before using Downloaded local AI.';
        const localTab=form.querySelector('[data-settings-tab="local-models"]');localTab?.click?.();
        return;
      }
      const fallback=fallbackConfig();
      if(status)status.textContent=`Downloaded local AI is active · ${currentSelection.id}. Your configured provider remains the fallback.`;
      try{dispatchEvent(new CustomEvent('civweave:model-settings-saved',{detail:{version:VERSION,route:ROUTE,primaryRoute:ROUTE,primaryModel:currentSelection.id,interactive:fallback,agentic:null,agenticEnabled:false,localSelection:currentSelection,savedAt:new Date().toISOString()}}))}catch{}
      return;
    }
    if(currentSelection.active&&currentSelection.id){
      try{localStorage.setItem(SELECTION_KEY,JSON.stringify({active:false,id:null,updatedAt:new Date().toISOString()}));dispatchEvent(new CustomEvent('civweave:local-model-selection',{detail:{active:false,id:null,updatedAt:new Date().toISOString()}}))}catch{}
    }
  },true);
  return true;
}
function patchVisible(){const form=document.querySelector('[data-cw-settings-form]');if(form)patch(form)}
addEventListener('civweave:model-settings-opened',()=>queueMicrotask(patchVisible));
addEventListener('civweave:local-model-selection',()=>queueMicrotask(patchVisible));
addEventListener('pageshow',()=>queueMicrotask(patchVisible));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patchVisible,{once:true});else queueMicrotask(patchVisible);
globalThis.CivweaveSettingsLocalRouteV323=Object.freeze({version:VERSION,route:ROUTE,patch,selection,selectedLabel,settingsPresentationOwnership:false,inputOwnership:false,managerDependency:false,runtimeDependency:false,cacheDependency:false});
})();