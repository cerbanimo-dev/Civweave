(()=>{
'use strict';
const VERSION='1.4.0-settings-direct-entry-v339';
const LAYER_ID='cw-settings-v320';
const DIRECT_RENDERER_SRC='/app/settings-local-models-direct-v325.js?v=1.0.2-settings-v339-direct-display';
const FULL_LOADER_SRC='/app/settings-local-loader-v337.js?v=1.4.0-settings-direct-entry-v339';
let directPromise=null,loaderPromise=null,recovering=false,lastDiagnosticAt=0;

function layer(){return document.getElementById(LAYER_ID)}
function selected(root=layer()){
  if(!root||root.hidden)return false;
  const form=root.querySelector('[data-cw-settings-form]');
  return form?.dataset?.activeSettingsTab==='local-models'||root.querySelector('[data-settings-tab="local-models"]')?.getAttribute('aria-selected')==='true';
}
function target(root=layer()){return root?.querySelector('[data-settings-tab-panel="local-models"]')||null}
function placeholderPresent(root=layer()){
  const panel=target(root);if(!panel)return true;
  return Boolean(panel.querySelector('[data-local-model-slot-placeholder]')||/Reading saved local model choices|Loading saved local model controls/i.test(panel.textContent||''));
}
function stamp(root=layer()){
  document.documentElement.dataset.settingsDirectEntry='v339';
  if(!root)return;
  root.dataset.settingsDirectEntry='v339';
  const label=root.querySelector('header small');
  if(label&&/CIVWEAVE SETTINGS/i.test(label.textContent||''))label.textContent='CIVWEAVE SETTINGS · v339';
}
function setStatus(message){const node=layer()?.querySelector('[data-local-model-management-status]');if(node)node.textContent=message}
function directRenderer(){return globalThis.CivweaveSettingsLocalDirectV325}
function renderSavedState(){
  const root=layer();if(!root?.isConnected||!selected(root))return false;
  const renderer=directRenderer();
  if(typeof renderer?.render!=='function')return false;
  let ok=false;try{ok=Boolean(renderer.render(root))}catch{}
  stamp(root);
  if(ok&&!placeholderPresent(root)){
    root.dataset.localModelsRecovery='v339-direct-saved-state';
    return true;
  }
  return false;
}
function appendOnce(src,datasetKey,ready){
  if(ready())return Promise.resolve(ready());
  return new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===new URL(src,location.href).pathname}catch{return false}});
    if(existing){
      const timer=setInterval(()=>{const value=ready();if(value){clearInterval(timer);clearTimeout(timeout);resolve(value)}},40);
      const timeout=setTimeout(()=>{clearInterval(timer);reject(new Error(`${datasetKey} exists but did not initialize`))},5000);
      return;
    }
    const script=document.createElement('script');script.src=src;script.async=false;script.dataset[datasetKey]='v339';
    const timeout=setTimeout(()=>reject(new Error(`${datasetKey} request timed out`)),7000);
    script.onload=()=>{clearTimeout(timeout);const value=ready();value?resolve(value):reject(new Error(`${datasetKey} loaded without its API`))};
    script.onerror=()=>{clearTimeout(timeout);reject(new Error(`${datasetKey} request failed`))};
    document.head?.append(script);
  });
}
function loadDirectRenderer(){
  if(typeof directRenderer()?.render==='function')return Promise.resolve(directRenderer());
  if(directPromise)return directPromise;
  directPromise=appendOnce(DIRECT_RENDERER_SRC,'civweaveSettingsV339DirectRenderer',()=>typeof directRenderer()?.render==='function'?directRenderer():null).finally(()=>{directPromise=null});
  return directPromise;
}
function fullLoader(){return globalThis.CivweaveSettingsLocalLoaderV337?.fullRouteRequired===true?globalThis.CivweaveSettingsLocalLoaderV337:null}
function loadFullLoader(){
  if(fullLoader())return Promise.resolve(fullLoader());
  if(loaderPromise)return loaderPromise;
  loaderPromise=appendOnce(FULL_LOADER_SRC,'civweaveSettingsV339FullLoader',()=>fullLoader()).finally(()=>{loaderPromise=null});
  return loaderPromise;
}
async function diagnostics(error){
  const root=layer();if(!root||!selected(root))return;
  const host=root.querySelector('[data-local-model-management-status]')||target(root);if(!host)return;
  const now=Date.now();if(now-lastDiagnosticAt<1200)return;lastDiagnosticAt=now;
  const info={entry:VERSION,pageBuild:document.documentElement.dataset.build||'',gatewayVersion:globalThis.CivweaveSettingsV320?.version||'',directRendererVersion:directRenderer()?.version||'',loaderVersion:globalThis.CivweaveSettingsLocalLoaderV337?.version||'',routeVersion:globalThis.CivweaveSettingsLocalRouteV323?.version||'',routeShim:Boolean(globalThis.CivweaveSettingsLocalRouteV323?.settingsV325DisplayShim),controller:''};
  try{info.controller=navigator.serviceWorker?.controller?.scriptURL||''}catch{}
  if(host.matches?.('[data-local-model-management-status]'))host.textContent=`Local models recovery v339 could not finish: ${String(error?.message||error||'unknown error')}`;
  let pre=root.querySelector('[data-settings-v339-diagnostics]');
  if(!pre){pre=document.createElement('pre');pre.dataset.settingsV339Diagnostics='1';pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;margin:12px 0 0;padding:12px;border:1px solid rgba(144,239,216,.35);border-radius:10px;background:#07111f;color:#d9fff7;font:12px/1.45 ui-monospace,monospace';(host.parentElement||target(root))?.append(pre)}
  pre.textContent=JSON.stringify(info,null,2);
}
async function recover(){
  const root=layer();if(!root?.isConnected||!selected(root))return false;
  stamp(root);
  if(recovering)return !placeholderPresent(root);
  recovering=true;
  setStatus('Opening saved local model controls…');
  try{
    if(renderSavedState())return true;
    try{await loadDirectRenderer();if(renderSavedState())return true}catch{}
    const loader=await loadFullLoader();loader.attachStage?.();
    const ok=await loader.recover(globalThis);
    stamp(root);
    if(ok&&!placeholderPresent(root)){root.dataset.localModelsRecovery='v339-full-route';return true}
    throw new Error('saved-state renderer and full Local Models route both failed to replace the placeholder');
  }catch(error){await diagnostics(error);return false}
  finally{recovering=false}
}
function schedule(){queueMicrotask(()=>setTimeout(()=>void recover(),0))}
function inspect(){const root=layer();if(!root)return;if(!root.hidden)stamp(root);if(selected(root)&&placeholderPresent(root))schedule()}

document.documentElement.dataset.settingsDirectEntry='v339';
document.addEventListener('click',event=>{const node=event.target instanceof Element?event.target.closest?.(`#${LAYER_ID} [data-settings-tab="local-models"]`):null;if(node){setStatus('Opening saved local model controls…');schedule()}},true);
addEventListener('civweave:model-settings-opened',inspect);
addEventListener('civweave:settings-ready',inspect);
const observer=new MutationObserver(()=>inspect());
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','aria-selected','data-active-settings-tab']});
for(const delay of [0,100,300,800,1600,3200])setTimeout(inspect,delay);
const watchdog=setInterval(()=>{inspect();const root=layer();if(root&&selected(root)&&placeholderPresent(root))void recover()},750);
addEventListener('pagehide',()=>{clearInterval(watchdog);observer.disconnect()},{once:true});

globalThis.CivweaveSettingsDirectEntryV339=Object.freeze({version:VERSION,recover,renderSavedState,loadDirectRenderer,loadFullLoader,mutationWatch:true,savedStateFirst:true,serviceWorkerIndependentDisplay:true});
})();
