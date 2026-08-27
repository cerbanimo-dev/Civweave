(()=>{
'use strict';

const VERSION='1.0.0-settings-local-tab-recovery-v334';
const LAYER_ID='cw-settings-v320';
const ROUTE_SRC='/app/settings-local-route-v325.js?v=1.1.3-settings-v325-parent-recovery';
const ROUTE_PATH='/app/settings-local-route-v325.js';
const RETRY_MS=5000;
let routePromise=null;
let observer=null;
let navigating=false;

function layer(){return document.getElementById(LAYER_ID)}
function active(target=layer()){
  if(!target?.isConnected||target.hidden)return false;
  const tab=target.querySelector('[data-settings-tab="local-models"]');
  const panel=target.querySelector('[data-settings-tab-panel="local-models"]');
  return Boolean(tab?.getAttribute('aria-selected')==='true'&&panel&&!panel.hidden);
}
function setStatus(target,text){
  const status=target?.querySelector('[data-local-model-management-status]');
  if(status)status.textContent=text;
}
function route(){return globalThis.CivweaveSettingsLocalRouteV323}
function render(target){
  if(!active(target)||navigating)return false;
  const api=route();
  if(typeof api?.renderLocalModels!=='function')return false;
  try{return Boolean(api.renderLocalModels(target))}catch(error){
    try{dispatchEvent(new CustomEvent('civweave:local-ai-settings-recovery-error',{detail:{version:VERSION,stage:'render',message:String(error?.message||error)}}))}catch{}
    return false;
  }
}
function existingRouteScript(){
  return [...document.scripts].find(script=>{
    try{return script.src&&new URL(script.src,location.href).pathname===ROUTE_PATH}catch{return false}
  })||null;
}
function loadRoute(){
  if(typeof route()?.renderLocalModels==='function')return Promise.resolve(true);
  if(routePromise)return routePromise;
  routePromise=new Promise((resolve,reject)=>{
    let script=existingRouteScript();
    const finish=()=>typeof route()?.renderLocalModels==='function'?resolve(true):reject(new Error('Local models saved-state view loaded without becoming ready.'));
    const fail=()=>reject(new Error('Local models saved-state view could not load.'));
    const timer=setTimeout(()=>reject(new Error('Local models saved-state view timed out.')),RETRY_MS);
    const settle=(callback)=>()=>{clearTimeout(timer);callback()};
    if(script){
      script.addEventListener('load',settle(finish),{once:true});
      script.addEventListener('error',settle(fail),{once:true});
      queueMicrotask(()=>{if(typeof route()?.renderLocalModels==='function'){clearTimeout(timer);resolve(true)}});
      return;
    }
    if(!document.head?.isConnected){clearTimeout(timer);reject(new Error('Local models saved-state view could not mount.'));return}
    script=document.createElement('script');
    script.src=ROUTE_SRC;
    script.async=false;
    script.dataset.civweaveSettingsLocalRecovery='v334';
    script.addEventListener('load',settle(finish),{once:true});
    script.addEventListener('error',settle(fail),{once:true});
    document.head.append(script);
  }).finally(()=>{routePromise=null});
  return routePromise;
}
async function recover(target=layer()){
  if(!active(target)||navigating)return false;
  if(render(target))return true;
  setStatus(target,'Loading saved local model choices…');
  try{
    await loadRoute();
    if(!active(target)||navigating)return false;
    if(render(target))return true;
    throw new Error('Local models saved-state view did not render.');
  }catch(error){
    if(active(target))setStatus(target,'Local model choices could not load. Select Local models to retry.');
    try{dispatchEvent(new CustomEvent('civweave:local-ai-settings-recovery-error',{detail:{version:VERSION,stage:'load',message:String(error?.message||error)}}))}catch{}
    return false;
  }
}
function scan(){
  const target=layer();
  if(active(target))queueMicrotask(()=>void recover(target));
}
function installObserver(){
  if(observer||typeof MutationObserver!=='function')return false;
  observer=new MutationObserver(records=>{
    if(records.some(record=>record.type==='childList'||record.attributeName==='aria-selected'||record.attributeName==='hidden'))scan();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-selected','hidden']});
  return true;
}

addEventListener('civweave:model-settings-opened',scan);
addEventListener('pageshow',()=>{navigating=false;scan()});
addEventListener('pagehide',()=>{navigating=true});
addEventListener('beforeunload',()=>{navigating=true},{once:true});
installObserver();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});else queueMicrotask(scan);

globalThis.CivweaveSettingsLocalTabRecoveryV334=Object.freeze({
  version:VERSION,recover,scan,active,loadRoute,canonicalRoute:ROUTE_PATH,
  savedStateOnly:true,modelRuntimeDependency:false,cacheDependency:false,serviceWorkerDependency:false,
  inputOwnership:false,presentationOwnership:false,mutationObserverRecovery:true,animationFrameDependency:false,
  clearsSavedState:false,clearsModelFiles:false
});
})();
