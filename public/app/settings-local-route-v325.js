(()=>{
'use strict';
const VERSION='1.1.3-settings-local-route-v326-canonical-inert-hard-local';
const ROUTE='downloaded-local';
const FULL_ROUTE='/app/settings-local-route-v327.js?v=1.1.4-settings-local-route-v325-parent-bridge';
const PANEL_ID='cw-local-ai-v324';
const SELECTION_KEY='civweave.local-ai.selection.v266';
let fullPromise=null;
let BRIDGE=null;

const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function selection(){try{return parse(localStorage.getItem(SELECTION_KEY),{active:false,id:null})}catch{return{active:false,id:null}}}
function selectedLabel(){const current=selection();return current.active&&current.id?String(current.id):'No downloaded model selected'}
function formFrom(layerOrForm){return layerOrForm?.matches?.('[data-cw-settings-form]')?layerOrForm:layerOrForm?.querySelector?.('[data-cw-settings-form]')||document.querySelector('[data-cw-settings-form]')}
function restoreBridge(){try{globalThis.CivweaveSettingsLocalRouteV323=BRIDGE}catch{}}

function ensureFull(){
  const active=globalThis.CivweaveSettingsLocalRouteV323;
  if(active&&active!==BRIDGE&&active?.renderLocalModels&&active?.loaderBridge!==true)return Promise.resolve(active);
  if(fullPromise)return fullPromise;
  fullPromise=new Promise((resolve,reject)=>{
    try{delete globalThis.CivweaveSettingsLocalRouteV323}catch{try{globalThis.CivweaveSettingsLocalRouteV323=undefined}catch{}}
    const script=document.createElement('script');
    script.src=FULL_ROUTE;
    script.async=false;
    script.dataset.civweaveLocalSettingsBridge='v325-to-v327';
    script.onload=()=>{
      const api=globalThis.CivweaveSettingsLocalRouteV323;
      if(api&&api!==BRIDGE&&api?.renderLocalModels)return resolve(api);
      restoreBridge();
      reject(new Error('Fresh Local models implementation loaded without becoming ready.'));
    };
    script.onerror=()=>{
      restoreBridge();
      reject(new Error('Fresh Local models implementation could not load.'));
    };
    if(!document.head?.isConnected){
      restoreBridge();
      reject(new Error('Fresh Local models implementation could not mount because the document is leaving.'));
      return;
    }
    document.head.append(script);
  }).finally(()=>{fullPromise=null});
  return fullPromise;
}

function renderLocalModels(layerOrForm=document.getElementById('cw-settings-v320')){
  const form=formFrom(layerOrForm);
  if(!form?.isConnected)return null;
  const target=form.querySelector('[data-settings-tab-panel="local-models"]');
  if(!target?.isConnected)return null;
  target.querySelector('[data-local-model-slot-placeholder]')?.remove();
  let panel=form.querySelector(`#${PANEL_ID}`);
  if(!panel){
    panel=document.createElement('section');
    panel.id=PANEL_ID;
    panel.className='cw-clean-panel';
    target.append(panel);
  }
  panel.innerHTML='<div><h3>AI Downloads</h3><p>Reading this device’s saved local model choices…</p></div><div class="cw-clean-note">The full Local models view is being attached from a cache-distinct route. No model runtime, GPU work, or inference starts while this view loads.</div>';
  void ensureFull().then(api=>{
    if(form?.isConnected)api.renderLocalModels(form);
  }).catch(error=>{
    if(!panel?.isConnected)return;
    panel.innerHTML=`<div><h3>Local models could not open</h3><p class="cw-local-error">${esc(error?.message||error)}</p></div><div class="cw-clean-note">Settings remains usable. Close and reopen the app once after an update, then retry Local models.</div>`;
  });
  return panel;
}

function patch(form=document.querySelector('[data-cw-settings-form]')){
  if(!form?.isConnected)return false;
  if(form.dataset?.activeSettingsTab==='local-models')renderLocalModels(form);
  return true;
}
function persistLocalRoute(){return null}
function ensureActionModules(){return ensureFull().then(api=>api.ensureActionModules?.()??true)}

BRIDGE=Object.freeze({
  version:VERSION,
  route:ROUTE,
  patch,
  selection,
  selectedLabel,
  persistLocalRoute,
  renderLocalModels,
  ensureActionModules,
  catalogue:Object.freeze([]),
  packCatalogue:Object.freeze([]),
  settingsPresentationOwnership:false,
  inputOwnership:false,
  managerDependency:false,
  runtimeDependency:false,
  cacheDependency:false,
  localModelsViewDirect:true,
  lifecycleDependency:false,
  registryDependencyOnView:false,
  managerDependencyOnView:false,
  cacheReadOnView:false,
  serviceWorkerReadyOnView:false,
  hardwareProbeOnView:false,
  packRuntimeDependencyOnView:false,
  packCacheReadOnView:false,
  savedStateOnlyView:true,
  viewWritesState:false,
  actionModulesOnDemand:true,
  browserPackHandoff:true,
  legacyBrowserErrorRecovery:true,
  hardLocalOnly:true,
  loaderBridge:true,
  canonicalPath:'/app/settings-local-route-v325.js',
  freshImplementationPath:'/app/settings-local-route-v327.js',
  compatibilityAlias:'/app/settings-local-route-v323.js'
});
globalThis.CivweaveSettingsLocalRouteV323=BRIDGE;
})();
