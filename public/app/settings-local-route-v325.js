(()=>{
'use strict';

// Parent-shell recovery boundary for Local models. This route is deliberately
// small and source-driven so an installed client can recover even when an older
// service worker is still controlling the page and serving the v324 Settings
// gateway. Displaying saved state never waits on the model manager, caches,
// service-worker readiness, GPU detection, or inference code.
const VERSION='1.1.5-settings-local-route-v326-local-selection-authority';
const REVISION='settings-v325-parent-source-recovery-v4-local-selection-authority';
const ROUTE='downloaded-local';
const LAYER_ID='cw-settings-v320';
const DIRECT_VERSION='1.1.0-settings-v325-direct-local-models-stable-actions';
const DIRECT_SRC='/app/settings-local-models-direct-v325.js?v=1.1.0-stable-in-place-actions';
const FULL_ROUTE='/app/settings-local-route-v327.js?v=1.1.4-settings-local-route-v325-parent-bridge';
const ACTION_ROUTE='/app/settings-local-route-v331.js?cwAction=1&v=settings-v325-parent-action-v1';
const STATUS_PLACEMENT_VERSION='1.0.1-settings-local-progress-card-owned-direct-aware';
const STATUS_PLACEMENT_SRC='/app/settings-local-progress-placement-v1.js?v=1.0.1-settings-local-progress-card-owned-direct-aware';
const PANEL_ID='cw-local-ai-v325-parent';
const SELECTION_KEY='civweave.local-ai.selection.v266';
const DOWNLOADS_KEY='civweave.local-ai.downloads.v266';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const SETTINGS_KEY='civweave.universal-ai.v127';
const PROFILES_KEY='civweave-model-profiles-v1';
let directPromise=null,fullPromise=null,actionPromise=null,placementPromise=null;
let BRIDGE=null;

const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const read=(key,fallback={})=>{try{return parse(localStorage.getItem(key),fallback)}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function selection(){return read(SELECTION_KEY,{active:false,id:null})}
function selectedLabel(){const current=selection();return current.active&&current.id?String(current.id):'No downloaded model selected'}
function formFrom(layerOrForm){return layerOrForm?.matches?.('[data-cw-settings-form]')?layerOrForm:layerOrForm?.querySelector?.('[data-cw-settings-form]')||document.querySelector('[data-cw-settings-form]')}
function layerFrom(layerOrForm){return layerOrForm?.id===LAYER_ID?layerOrForm:layerOrForm?.closest?.(`#${LAYER_ID}`)||document.getElementById(LAYER_ID)}
function restoreBridge(){try{globalThis.CivweaveSettingsLocalRouteV323=BRIDGE}catch{}}
function updateHeader(layer=document.getElementById(LAYER_ID)){
  if(!layer)return false;
  const label=layer.querySelector('header small');
  if(label&&/CIVWEAVE SETTINGS/i.test(label.textContent||''))label.textContent='CIVWEAVE SETTINGS · v325';
  layer.dataset.settingsVisibleVersion='v325';
  layer.dataset.settingsSourceRecovery=REVISION;
  return true;
}
function ensureRouteOption(form){
  const route=form?.elements?.namedItem?.('route');
  if(!route)return false;
  if(!route.querySelector?.(`option[value="${ROUTE}"]`)){
    const option=document.createElement('option');option.value=ROUTE;option.textContent='Downloaded local AI';
    const deterministic=route.querySelector?.('option[value="deterministic"]');
    deterministic?.after?.(option)||route.prepend?.(option);
  }
  const current=selection();if(current.active&&current.id)route.value=ROUTE;
  return true;
}
function immediateMarkup(target){
  const current=selection(),downloads=read(DOWNLOADS_KEY,{}),packs=read(PACK_STATE_KEY,{});
  const readyModels=Object.values(downloads).filter(state=>String(state?.status||'')==='ready').length;
  const readyPacks=Object.values(packs).filter(state=>String(state?.status||'')==='ready').length;
  target.innerHTML=`<section id="${PANEL_ID}" class="cw-clean-panel" data-cw-v325-parent-recovery><div><h3>AI Downloads</h3><p>Saved local AI state is available immediately. Full controls are attaching from the v325 direct renderer.</p></div><div class="cw-clean-note"><b>Saved local state loaded.</b><br>${readyPacks} ready pack${readyPacks===1?'':'s'} · ${readyModels} ready model${readyModels===1?'':'s'}${current.active&&current.id?` · active: ${esc(current.id)}`:''}</div><p data-cw-v325-parent-status>Loading Local models controls…</p><button type="button" data-cw-v325-parent-retry>Retry Local models controls</button></section>`;
  target.querySelector?.('[data-cw-v325-parent-retry]')?.addEventListener?.('click',()=>{directPromise=null;void ensureDirect(layerFrom(target),true)});
}
function directApi(){const api=globalThis.CivweaveSettingsLocalDirectV325;return api?.version===DIRECT_VERSION?api:null}
function ensureProgressPlacement(){
  const existing=globalThis.CivweaveSettingsLocalProgressPlacementV1;
  if(existing?.version===STATUS_PLACEMENT_VERSION&&existing?.localize){existing.schedule?.([0,80,250]);return Promise.resolve(existing)}
  if(placementPromise)return placementPromise;
  placementPromise=new Promise((resolve,reject)=>{
    const path=new URL(STATUS_PLACEMENT_SRC,location.href).pathname;
    let script=[...document.scripts].find(node=>{try{return new URL(node.src,location.href).pathname===path}catch{return false}});
    const ready=()=>{const api=globalThis.CivweaveSettingsLocalProgressPlacementV1;if(api?.version===STATUS_PLACEMENT_VERSION&&api?.localize){api.schedule?.([0,80,250]);resolve(api);return}reject(new Error('Local AI progress placement loaded without becoming current.'))};
    if(script&&globalThis.CivweaveSettingsLocalProgressPlacementV1?.version!==STATUS_PLACEMENT_VERSION){try{script.remove()}catch{}script=null}
    if(script){
      if(globalThis.CivweaveSettingsLocalProgressPlacementV1?.version===STATUS_PLACEMENT_VERSION&&globalThis.CivweaveSettingsLocalProgressPlacementV1?.localize){ready();return}
      script.addEventListener('load',ready,{once:true});
      script.addEventListener('error',()=>reject(new Error('Local AI progress placement could not load.')),{once:true});
      return;
    }
    script=document.createElement('script');script.src=`${STATUS_PLACEMENT_SRC}&cwFresh=${Date.now()}`;script.async=false;script.dataset.civweaveLocalProgressPlacement='v1';
    script.onload=ready;script.onerror=()=>reject(new Error('Local AI progress placement could not load.'));
    if(!document.head?.isConnected){reject(new Error('Local AI progress placement could not mount because the document is leaving.'));return}
    document.head.append(script);
  }).finally(()=>{placementPromise=null});
  return placementPromise;
}
function ensureFullFallback(layer=document.getElementById(LAYER_ID)){
  const active=globalThis.CivweaveSettingsLocalRouteV323;
  if(active&&active!==BRIDGE&&active?.renderLocalModels&&active?.loaderBridge!==true)return Promise.resolve(active);
  if(fullPromise)return fullPromise;
  fullPromise=new Promise((resolve,reject)=>{
    try{delete globalThis.CivweaveSettingsLocalRouteV323}catch{try{globalThis.CivweaveSettingsLocalRouteV323=undefined}catch{}}
    const script=document.createElement('script');script.src=FULL_ROUTE;script.async=false;script.dataset.civweaveLocalSettingsBridge='v325-to-v327';
    script.onload=()=>{const api=globalThis.CivweaveSettingsLocalRouteV323;if(api&&api!==BRIDGE&&api?.renderLocalModels){if(layer?.isConnected&&!layer.hidden)api.renderLocalModels(layer);void ensureProgressPlacement().catch(()=>{});resolve(api);return}restoreBridge();reject(new Error('Fresh Local models implementation loaded without becoming ready.'))};
    script.onerror=()=>{restoreBridge();reject(new Error('Fresh Local models implementation could not load.'))};
    if(!document.head?.isConnected){restoreBridge();reject(new Error('Fresh Local models implementation could not mount because the document is leaving.'));return}
    document.head.append(script);
  }).finally(()=>{fullPromise=null});
  return fullPromise;
}
function ensureDirect(layer=document.getElementById(LAYER_ID),force=false){
  const existing=directApi();
  if(existing?.render&&!force){if(layer?.isConnected&&!layer.hidden)existing.render(layer);void ensureProgressPlacement().catch(()=>{});return Promise.resolve(existing)}
  if(directPromise&&!force)return directPromise;
  directPromise=new Promise((resolve,reject)=>{
    let script=[...document.scripts].find(node=>{try{return new URL(node.src,location.href).pathname==='/app/settings-local-models-direct-v325.js'}catch{return false}});
    if(script&&globalThis.CivweaveSettingsLocalDirectV325?.version!==DIRECT_VERSION){try{script.remove()}catch{}script=null}
    const ready=()=>{
      const api=directApi();
      if(!api?.render){reject(new Error('The current v325 direct Local models renderer loaded without becoming ready.'));return}
      updateHeader(layer);
      if(layer?.isConnected&&!layer.hidden)api.render(layer);
      void ensureProgressPlacement().catch(()=>{});
      resolve(api);
    };
    if(script){
      if(directApi()?.render){ready();return}
      script.addEventListener('load',ready,{once:true});
      script.addEventListener('error',()=>reject(new Error('The v325 direct Local models renderer could not load.')),{once:true});
      return;
    }
    script=document.createElement('script');script.src=`${DIRECT_SRC}&cwFresh=${Date.now()}`;script.async=false;script.dataset.civweaveSettingsV325ParentRecovery='v1';
    script.onload=ready;script.onerror=()=>reject(new Error('The v325 direct Local models renderer could not load.'));
    if(!document.head?.isConnected){reject(new Error('The v325 direct Local models renderer could not mount because the document is leaving.'));return}
    document.head.append(script);
  }).catch(async error=>{
    const target=layer?.querySelector?.('[data-settings-tab-panel="local-models"]');
    const status=target?.querySelector?.('[data-cw-v325-parent-status]');
    if(status)status.textContent=`Direct controls were unavailable; trying the validated Local models route…`;
    try{return await ensureFullFallback(layer)}catch(fallbackError){if(status)status.textContent=`Local models controls did not load: ${String(fallbackError?.message||error?.message||fallbackError||error)}`;throw fallbackError}
  }).finally(()=>{directPromise=null});
  return directPromise;
}
function renderLocalModels(layerOrForm=document.getElementById(LAYER_ID)){
  const form=formFrom(layerOrForm);if(!form?.isConnected)return null;
  const layer=layerFrom(layerOrForm)||document.getElementById(LAYER_ID);updateHeader(layer);ensureRouteOption(form);void ensureProgressPlacement().catch(()=>{});
  const target=form.querySelector('[data-settings-tab-panel="local-models"]');if(!target?.isConnected)return null;
  const direct=directApi();if(direct?.render){direct.render(layer);globalThis.CivweaveSettingsLocalProgressPlacementV1?.schedule?.([0,80,250]);return target.querySelector?.('[data-cw-direct-local-panel]')||target}
  immediateMarkup(target);
  void ensureDirect(layer,false).catch(()=>{});
  return target.querySelector?.(`#${PANEL_ID}`)||target;
}
function patch(form=document.querySelector('[data-cw-settings-form]')){
  if(!form?.isConnected)return false;ensureRouteOption(form);
  const layer=layerFrom(form);updateHeader(layer);
  if(form.dataset?.activeSettingsTab==='local-models'||form.querySelector?.('[data-settings-tab="local-models"]')?.getAttribute?.('aria-selected')==='true')renderLocalModels(form);
  return true;
}
function persistLocalRoute(current=selection()){
  if(!current?.active||!current.id)return null;
  const at=new Date().toISOString();
  const interactive={route:ROUTE,provider:ROUTE,model:String(current.id),endpoint:'',externalConsent:false};
  const settings=read(SETTINGS_KEY,{}),profiles=read(PROFILES_KEY,{});
  const stored={...settings,...interactive,consent:false,agenticEnabled:false,localOnly:true,settingsOwner:VERSION,updatedAt:at};
  const nextProfiles={...profiles,interactive,agentic:null,agenticEnabled:false,localOnly:true,settingsOwner:VERSION,updatedAt:at};
  try{
    localStorage.setItem(SETTINGS_KEY,JSON.stringify(stored));
    localStorage.setItem(PROFILES_KEY,JSON.stringify(nextProfiles));
  }catch{}
  const detail={version:VERSION,route:ROUTE,primaryRoute:ROUTE,primaryModel:current.id,interactive,agentic:null,agenticEnabled:false,localSelection:current,localOnly:true,savedAt:at};
  try{dispatchEvent(new CustomEvent('civweave:model-settings-saved',{detail}))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:model-config-changed',{detail:{...detail,source:'local-model-selection'}}))}catch{}
  const form=document.querySelector?.('[data-cw-settings-form]');if(form?.isConnected)ensureRouteOption(form);
  return detail;
}
function ensureActionModules(){
  const direct=directApi();if(direct?.ensureActions)return direct.ensureActions();
  const current=globalThis.CivweaveSettingsLocalRouteV323;
  if(current&&current!==BRIDGE&&current?.actionModulesOnDemand===true&&current?.loaderBridge!==true)return current.ensureActionModules?.()??Promise.resolve(true);
  if(actionPromise)return actionPromise;
  actionPromise=new Promise((resolve,reject)=>{
    try{delete globalThis.CivweaveSettingsLocalRouteV323}catch{try{globalThis.CivweaveSettingsLocalRouteV323=undefined}catch{}}
    const script=document.createElement('script');script.src=ACTION_ROUTE;script.async=false;script.dataset.civweaveExplicitLocalModelAction='v325-parent';
    script.onload=()=>{const api=globalThis.CivweaveSettingsLocalRouteV323;if(api&&api!==BRIDGE&&api?.ensureActionModules){void ensureProgressPlacement().catch(()=>{});return Promise.resolve(api.ensureActionModules()).then(resolve,reject)}restoreBridge();reject(new Error('Local model action route loaded without becoming ready.'))};
    script.onerror=()=>{restoreBridge();reject(new Error('Local model action route could not load.'))};
    if(!document.head?.isConnected){restoreBridge();reject(new Error('Local model action route could not mount because the document is leaving.'));return}
    document.head.append(script);
  }).finally(()=>{actionPromise=null});
  return actionPromise;
}
function onSettingsOpened(){const layer=document.getElementById(LAYER_ID);if(!layer)return;updateHeader(layer);void ensureProgressPlacement().catch(()=>{});patch(layer.querySelector('[data-cw-settings-form]'))}

BRIDGE=Object.freeze({
  version:VERSION,revision:REVISION,route:ROUTE,patch,selection,selectedLabel,persistLocalRoute,renderLocalModels,ensureDirect,ensureFullFallback,ensureActionModules,ensureProgressPlacement,
  catalogue:Object.freeze([]),packCatalogue:Object.freeze([]),settingsPresentationOwnership:false,inputOwnership:false,
  managerDependency:false,runtimeDependency:false,cacheDependency:false,localModelsViewDirect:true,lifecycleDependency:false,
  registryDependencyOnView:false,managerDependencyOnView:false,cacheReadOnView:false,serviceWorkerReadyOnView:false,hardwareProbeOnView:false,
  packRuntimeDependencyOnView:false,packCacheReadOnView:false,savedStateOnlyView:true,viewWritesState:false,actionModulesOnDemand:true,
  browserPackHandoff:true,legacyBrowserErrorRecovery:true,hardLocalOnly:true,loaderBridge:true,staleWorkerSourceRecovery:true,
  cardOwnedProgress:true,directCardProgress:true,globalProgressBanner:false,progressPlacementPath:STATUS_PLACEMENT_SRC,
  stableInPlaceActions:true,directVersion:DIRECT_VERSION,canonicalLocalPersistence:true,selectedLocalBecomesProviderAuthority:true,
  visibleSettingsVersion:'v325',canonicalPath:'/app/settings-local-route-v325.js',directRendererPath:DIRECT_SRC,
  freshImplementationPath:'/app/settings-local-route-v327.js',actionPath:ACTION_ROUTE,compatibilityAlias:'/app/settings-local-route-v323.js'
});
globalThis.CivweaveSettingsLocalRouteV323=BRIDGE;
addEventListener('civweave:model-settings-opened',onSettingsOpened);
addEventListener('civweave:settings-ready',()=>queueMicrotask(onSettingsOpened));
queueMicrotask(()=>{const layer=document.getElementById(LAYER_ID);if(layer&&!layer.hidden)onSettingsOpened()});
})();