(()=>{
'use strict';
const VERSION='1.3.0-settings-direct-entry-v338';
const LOADER_SRC='/app/settings-local-loader-v337.js?v=1.3.0-settings-direct-entry-v338';
const LAYER_ID='cw-settings-v320';
let loaderPromise=null;

function layer(){return document.getElementById(LAYER_ID)}
function localSelected(root=layer()){
  if(!root)return false;
  const form=root.querySelector('[data-cw-settings-form]');
  if(form?.dataset?.activeSettingsTab==='local-models')return true;
  return root.querySelector('[data-settings-tab="local-models"]')?.getAttribute('aria-selected')==='true';
}
function stamp(root=layer()){
  document.documentElement.dataset.settingsDirectEntry='v338';
  if(!root)return;
  root.dataset.settingsDirectEntry='v338';
  const label=root.querySelector('header small');
  if(label&&/CIVWEAVE SETTINGS/i.test(label.textContent||''))label.textContent='CIVWEAVE SETTINGS · v338';
}
function loadLoader(){
  if(globalThis.CivweaveSettingsLocalLoaderV337?.fullRouteRequired===true)return Promise.resolve(globalThis.CivweaveSettingsLocalLoaderV337);
  if(loaderPromise)return loaderPromise;
  loaderPromise=new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname==='/app/settings-local-loader-v337.js'}catch{return false}});
    if(existing){
      const timer=setInterval(()=>{if(globalThis.CivweaveSettingsLocalLoaderV337?.fullRouteRequired===true){clearInterval(timer);clearTimeout(timeout);resolve(globalThis.CivweaveSettingsLocalLoaderV337)}},40);
      const timeout=setTimeout(()=>{clearInterval(timer);reject(new Error('v337 loader script exists but did not initialize'))},5000);
      return;
    }
    const script=document.createElement('script');
    script.src=LOADER_SRC;
    script.async=false;
    script.dataset.civweaveSettingsDirectEntry='v338';
    script.onload=()=>globalThis.CivweaveSettingsLocalLoaderV337?.fullRouteRequired===true?resolve(globalThis.CivweaveSettingsLocalLoaderV337):reject(new Error('v337 loader initialized without full-route recovery'));
    script.onerror=()=>reject(new Error('v337 loader request failed'));
    document.head.append(script);
  }).finally(()=>{loaderPromise=null});
  return loaderPromise;
}
async function workerDiagnostics(){
  const info={entry:VERSION,pageBuild:document.documentElement.dataset.build||document.documentElement.dataset.civweaveFreshCampus||'',pageUrl:location.href,gatewayVersion:globalThis.CivweaveSettingsV320?.version||'',loaderVersion:globalThis.CivweaveSettingsLocalLoaderV337?.version||'',routeVersion:globalThis.CivweaveSettingsLocalRouteV323?.version||'',routeShim:Boolean(globalThis.CivweaveSettingsLocalRouteV323?.settingsV325DisplayShim),routeBridge:Boolean(globalThis.CivweaveSettingsLocalRouteV323?.loaderBridge),controller:''};
  try{info.controller=navigator.serviceWorker?.controller?.scriptURL||'';const reg=await navigator.serviceWorker?.getRegistration?.('/');info.active=reg?.active?.scriptURL||'';info.waiting=reg?.waiting?.scriptURL||'';info.installing=reg?.installing?.scriptURL||''}catch(error){info.workerError=String(error?.message||error)}
  return info;
}
function showDiagnostic(error){
  const root=layer();if(!root||root.hidden||!localSelected(root))return;
  let host=root.querySelector('[data-local-model-management-status]');
  if(!host)return;
  Promise.resolve(workerDiagnostics()).then(info=>{
    host.textContent=`Local models recovery v338 could not finish: ${String(error?.message||error||'unknown error')}`;
    let pre=root.querySelector('[data-settings-v338-diagnostics]');
    if(!pre){pre=document.createElement('pre');pre.dataset.settingsV338Diagnostics='1';pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;margin:12px 0 0;padding:12px;border:1px solid rgba(144,239,216,.35);border-radius:10px;background:#07111f;color:#d9fff7;font:12px/1.45 ui-monospace,monospace';host.parentElement?.append(pre)}
    pre.textContent=JSON.stringify(info,null,2);
  });
}
async function recover(){
  const root=layer();if(!root||root.hidden||!localSelected(root))return false;
  stamp(root);
  try{const loader=await loadLoader();loader.attachStage?.();const ok=await loader.recover(globalThis);if(!ok)throw new Error('full Local Models renderer did not replace the saved-state placeholder');return true}catch(error){showDiagnostic(error);return false}
}
function schedule(){queueMicrotask(()=>setTimeout(()=>void recover(),0))}

document.documentElement.dataset.settingsDirectEntry='v338';
document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target.closest?.(`#${LAYER_ID} [data-settings-tab="local-models"]`):null;if(target)schedule()},true);
addEventListener('civweave:model-settings-opened',()=>{stamp();if(localSelected())schedule()});
addEventListener('civweave:settings-ready',()=>{stamp();if(localSelected())schedule()});
for(const delay of [0,250,1000,2500])setTimeout(()=>{stamp();if(localSelected())schedule()},delay);

globalThis.CivweaveSettingsDirectEntryV338=Object.freeze({version:VERSION,recover,loadLoader,workerDiagnostics,directPageOwner:true,serviceWorkerIndependent:true});
})();
