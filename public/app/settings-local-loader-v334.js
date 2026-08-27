(()=>{
'use strict';
const VERSION='1.0.0-settings-local-loader-v334-stale-gateway-recovery';
const LAYER_ID='cw-settings-v320';
const ROUTE_VERSION='1.1.3-settings-local-route-v326-canonical-inert-hard-local';
const ROUTE_SRC='/app/settings-local-route-v331.js?v=1.1.7-persistent-shell-cache-generation-v333';
let routePromise=null;

function layer(){return document.getElementById(LAYER_ID)}
function route(){return globalThis.CivweaveSettingsLocalRouteV323}
function routeReady(){const api=route();return Boolean(api?.version===ROUTE_VERSION&&api?.renderLocalModels)}
function selected(root=layer()){
  return root?.querySelector?.('[data-settings-tab="local-models"]')?.getAttribute?.('aria-selected')==='true';
}
function status(root=layer(),message=''){
  const node=root?.querySelector?.('[data-local-model-management-status]');
  if(node)node.textContent=message;
}
function render(root=layer()){
  if(!root?.isConnected||root.hidden||!selected(root)||!routeReady())return false;
  const rendered=route().renderLocalModels(root);
  if(rendered){root.dataset.localModelsRecovery='v334';return true}
  return false;
}
function ensureRoute(){
  if(routeReady())return Promise.resolve(route());
  if(routePromise)return routePromise;
  routePromise=new Promise((resolve,reject)=>{
    try{delete globalThis.CivweaveSettingsLocalRouteV323}catch{try{globalThis.CivweaveSettingsLocalRouteV323=undefined}catch{}}
    const script=document.createElement('script');
    script.src=ROUTE_SRC;
    script.async=false;
    script.dataset.civweaveSettingsLocalRecovery='v334';
    const timer=setTimeout(()=>reject(new Error('Local Models route did not become ready within 8 seconds.')),8000);
    script.onload=()=>{clearTimeout(timer);routeReady()?resolve(route()):reject(new Error('Local Models route loaded without the canonical renderer.'))};
    script.onerror=()=>{clearTimeout(timer);reject(new Error('Local Models route could not load.'))};
    if(!document.head?.isConnected){clearTimeout(timer);reject(new Error('Local Models route could not mount.'));return}
    document.head.append(script);
  }).finally(()=>{routePromise=null});
  return routePromise;
}
async function recover(root=layer()){
  if(!root?.isConnected||root.hidden||!selected(root))return false;
  if(render(root))return true;
  status(root,'Loading saved local model controls…');
  try{
    await ensureRoute();
    if(!render(root))throw new Error('Local Models route became ready but did not render the selected tab.');
    return true;
  }catch(error){
    status(root,`Local models could not load: ${String(error?.message||error)}`);
    try{dispatchEvent(new CustomEvent('civweave:local-ai-settings-unavailable',{detail:{version:VERSION,message:String(error?.message||error),settingsStillOpen:Boolean(root&&!root.hidden)}}))}catch{}
    return false;
  }
}
function schedule(){queueMicrotask(()=>setTimeout(()=>void recover(),0))}
function onClick(event){
  const tab=event.target?.closest?.(`#${LAYER_ID} [data-settings-tab="local-models"]`);
  if(tab)schedule();
}
function onOpened(){if(selected())schedule()}
document.addEventListener('click',onClick,true);
addEventListener('civweave:model-settings-opened',onOpened);
addEventListener('civweave:settings-ready',onOpened);
globalThis.CivweaveSettingsLocalLoaderV334=Object.freeze({version:VERSION,routeVersion:ROUTE_VERSION,recover,render,ensureRoute,staleGatewayRecovery:true,newPathCacheGeneration:true});
})();
