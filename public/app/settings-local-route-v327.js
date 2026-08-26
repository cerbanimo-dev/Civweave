(()=>{
'use strict';

// Source-truth bridge for installed clients that are still controlled by a
// pre-v325 service worker. The Working Campus already loads this pathname, so
// it must be able to recover the Local models view without waiting for a worker
// update, CacheStorage repair, model manager, GPU probe, or inference runtime.
const VERSION='1.1.4-settings-local-route-v327-stale-worker-bridge-v1';
const ROUTE='downloaded-local';
const LAYER_ID='cw-settings-v320';
const DIRECT_SRC='/app/settings-local-models-direct-v325.js?v=settings-v325-source-truth-bridge-v1';
const SELECTION_KEY='civweave.local-ai.selection.v266';
const DOWNLOADS_KEY='civweave.local-ai.downloads.v266';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const ACTION_ROUTE_VERSION='1.1.3-settings-local-route-v326-canonical-inert-hard-local';

if(globalThis.CivweaveSettingsLocalRouteV323?.version===VERSION)return;

let directPromise=null;
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const read=(key,fallback={})=>{try{return parse(localStorage.getItem(key),fallback)}catch{return fallback}};
const selection=()=>read(SELECTION_KEY,{active:false,id:null});

function updateHeader(layer=document.getElementById(LAYER_ID)){
  if(!layer)return false;
  const label=layer.querySelector('header small');
  if(label&&/CIVWEAVE SETTINGS/i.test(label.textContent||''))label.textContent='CIVWEAVE SETTINGS · v325';
  layer.dataset.settingsVisibleVersion='v325';
  layer.dataset.settingsSourceBridge='v327-stale-worker-bridge-v1';
  return true;
}

function patch(form=document.querySelector('[data-cw-settings-form]')){
  if(!form?.isConnected)return false;
  const route=form.elements?.namedItem?.('route');
  if(route&&!route.querySelector(`option[value="${ROUTE}"]`)){
    const option=document.createElement('option');
    option.value=ROUTE;
    option.textContent='Downloaded local AI';
    const deterministic=route.querySelector('option[value="deterministic"]');
    deterministic?.after(option)||route.prepend(option);
  }
  const current=selection();
  if(route&&current.active&&current.id)route.value=ROUTE;
  return true;
}

function fallbackMarkup(layer){
  const form=layer?.querySelector?.('[data-cw-settings-form]');
  const target=form?.querySelector?.('[data-settings-tab-panel="local-models"]');
  if(!target)return false;
  const current=selection();
  const downloads=read(DOWNLOADS_KEY,{});
  const packs=read(PACK_STATE_KEY,{});
  const readyModels=Object.values(downloads).filter(state=>String(state?.status||'')==='ready').length;
  const readyPacks=Object.values(packs).filter(state=>String(state?.status||'')==='ready').length;
  target.innerHTML=`<section class="cw-clean-panel" data-cw-v325-source-bridge><div><h3>AI Downloads</h3><p>Settings v325 is recovering the direct Local models renderer from source. This view is not waiting on model lifecycle, cache, service-worker, GPU, or inference code.</p></div><div class="cw-clean-note"><b>Saved local state loaded.</b><br>${readyPacks} ready pack${readyPacks===1?'':'s'} · ${readyModels} ready model${readyModels===1?'':'s'}${current.active&&current.id?` · active: ${String(current.id)}`:''}</div><p data-cw-v325-source-bridge-status>Loading the cache-distinct v325 controls…</p><button type="button" data-cw-v325-source-bridge-retry>Retry Local models controls</button></section>`;
  target.querySelector('[data-cw-v325-source-bridge-retry]')?.addEventListener('click',()=>{
    directPromise=null;
    void ensureDirect(layer,true);
  });
  return true;
}

function directApi(){return globalThis.CivweaveSettingsLocalDirectV325}
function renderLocalModels(layer=document.getElementById(LAYER_ID)){
  if(!layer?.isConnected||layer.hidden)return false;
  updateHeader(layer);
  patch(layer.querySelector('[data-cw-settings-form]'));
  const direct=directApi();
  if(direct?.render)return Boolean(direct.render(layer));
  fallbackMarkup(layer);
  void ensureDirect(layer,false);
  return true;
}

function ensureDirect(layer=document.getElementById(LAYER_ID),force=false){
  const direct=directApi();
  if(direct?.render){if(layer?.isConnected&&!layer.hidden)direct.render(layer);return Promise.resolve(direct)}
  if(directPromise&&!force)return directPromise;
  directPromise=new Promise((resolve,reject)=>{
    let script=[...document.scripts].find(node=>{try{return new URL(node.src,location.href).pathname==='/app/settings-local-models-direct-v325.js'}catch{return false}});
    const ready=()=>{
      const api=directApi();
      if(!api?.render){reject(new Error('The v325 direct Local models renderer loaded without becoming ready.'));return}
      updateHeader(layer);
      patch(layer?.querySelector?.('[data-cw-settings-form]'));
      if(layer?.isConnected&&!layer.hidden)api.render(layer);
      resolve(api);
    };
    if(script){
      if(directApi()?.render){ready();return}
      script.addEventListener('load',ready,{once:true});
      script.addEventListener('error',()=>reject(new Error('The v325 direct Local models renderer could not load.')),{once:true});
      return;
    }
    script=document.createElement('script');
    script.src=DIRECT_SRC;
    script.async=false;
    script.dataset.civweaveSettingsV325SourceBridge='v1';
    script.onload=ready;
    script.onerror=()=>reject(new Error('The v325 direct Local models renderer could not load.'));
    (document.head||document.documentElement).append(script);
  }).catch(error=>{
    const target=layer?.querySelector?.('[data-settings-tab-panel="local-models"]');
    const status=target?.querySelector?.('[data-cw-v325-source-bridge-status]');
    if(status)status.textContent=`Local models controls did not load: ${String(error?.message||error)}`;
    throw error;
  }).finally(()=>{directPromise=null});
  return directPromise;
}

function onSettingsOpened(){
  const layer=document.getElementById(LAYER_ID);
  if(!layer)return;
  updateHeader(layer);
  patch(layer.querySelector('[data-cw-settings-form]'));
  const selected=layer.querySelector('[data-settings-tab="local-models"]')?.getAttribute('aria-selected')==='true';
  if(selected)renderLocalModels(layer);else void ensureDirect(layer,false).catch(()=>{});
}

addEventListener('civweave:model-settings-opened',onSettingsOpened);
addEventListener('civweave:settings-ready',()=>queueMicrotask(onSettingsOpened));
addEventListener('pageshow',()=>queueMicrotask(()=>{patch();void ensureDirect(document.getElementById(LAYER_ID),false).catch(()=>{})}));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{patch();void ensureDirect(document.getElementById(LAYER_ID),false).catch(()=>{})},{once:true});
else queueMicrotask(()=>{patch();void ensureDirect(document.getElementById(LAYER_ID),false).catch(()=>{})});

globalThis.CivweaveSettingsLocalRouteV323=Object.freeze({
  version:VERSION,
  route:ROUTE,
  patch,
  selection,
  renderLocalModels,
  ensureDirect,
  staleWorkerSourceBridge:true,
  visibleSettingsVersion:'v325',
  savedStateOnlyView:true,
  viewWritesState:false,
  managerDependencyOnView:false,
  cacheReadOnView:false,
  serviceWorkerReadyOnView:false,
  hardwareProbeOnView:false,
  actionModulesOnDemand:true,
  actionRouteVersion:ACTION_ROUTE_VERSION,
  canonicalActionPath:'/app/settings-local-route-v331.js?cwAction=1'
});
})();
