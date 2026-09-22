(()=>{
'use strict';
const VERSION='1.2.0-settings-local-loader-v337-stage-full-route';
const LAYER_ID='cw-settings-v320';
const STAGE_ID='cw-persistent-system-stage';
const ROUTE_VERSION='1.1.3-settings-local-route-v326-canonical-inert-hard-local';
const ROUTE_SRC='/app/settings-local-route-v331.js?cwAction=1&v=1.2.0-stage-full-route-v337';
const realmPromises=new WeakMap();
const attachedDocuments=new WeakSet();
const attachedFrames=new WeakSet();

function safeDocument(realm){try{return realm?.document||null}catch{return null}}
function layer(realm){return safeDocument(realm)?.getElementById?.(LAYER_ID)||null}
function route(realm){try{return realm?.CivweaveSettingsLocalRouteV323||null}catch{return null}}
function routeReady(realm){
  const api=route(realm);
  return Boolean(
    api?.version===ROUTE_VERSION&&
    typeof api?.renderLocalModels==='function'&&
    api?.settingsV325DisplayShim!==true&&
    api?.loaderBridge!==true&&
    Array.isArray(api?.catalogue)&&api.catalogue.length>0&&
    api?.savedStateOnlyView===true&&api?.viewWritesState===false
  );
}
function selected(realm,root=layer(realm)){
  if(!root)return false;
  const form=root.querySelector?.('[data-cw-settings-form]');
  if(form?.dataset?.activeSettingsTab==='local-models')return true;
  return root.querySelector?.('[data-settings-tab="local-models"]')?.getAttribute?.('aria-selected')==='true';
}
function status(realm,message=''){
  const node=layer(realm)?.querySelector?.('[data-local-model-management-status]');
  if(node)node.textContent=message;
}
function markVisibleVersion(realm){
  const root=layer(realm);
  const label=root?.querySelector?.('header small');
  if(label&&/CIVWEAVE SETTINGS/i.test(label.textContent||''))label.textContent='CIVWEAVE SETTINGS · v325';
  if(root)root.dataset.settingsVisibleVersion='v325';
}
function render(realm,root=layer(realm)){
  if(!root?.isConnected||root.hidden||!selected(realm,root)||!routeReady(realm))return false;
  const rendered=route(realm).renderLocalModels(root);
  if(rendered){
    root.dataset.localModelsRecovery='v337-stage-full-route';
    markVisibleVersion(realm);
    return true;
  }
  return false;
}
function ensureRoute(realm){
  if(routeReady(realm))return Promise.resolve(route(realm));
  const existing=realmPromises.get(realm);
  if(existing)return existing;
  const doc=safeDocument(realm);
  const promise=new Promise((resolve,reject)=>{
    if(!doc?.head?.isConnected){reject(new Error('Local Models route could not mount in this document.'));return}
    try{delete realm.CivweaveSettingsLocalRouteV323}catch{try{realm.CivweaveSettingsLocalRouteV323=undefined}catch{}}
    const script=doc.createElement('script');
    script.src=ROUTE_SRC;
    script.async=false;
    script.dataset.civweaveSettingsLocalRecovery='v337-stage-full-route';
    const timer=realm.setTimeout(()=>reject(new Error('Local Models route did not become ready within 8 seconds.')),8000);
    script.onload=()=>{
      realm.clearTimeout(timer);
      routeReady(realm)?resolve(route(realm)):reject(new Error('Local Models route loaded, but only a compatibility shim/bridge was available.'));
    };
    script.onerror=()=>{realm.clearTimeout(timer);reject(new Error('Local Models route could not load in this document.'))};
    doc.head.append(script);
  }).finally(()=>realmPromises.delete(realm));
  realmPromises.set(realm,promise);
  return promise;
}
async function recover(realm){
  const root=layer(realm);
  if(!root?.isConnected||root.hidden||!selected(realm,root))return false;
  markVisibleVersion(realm);
  if(render(realm,root))return true;
  status(realm,'Loading saved local model controls…');
  try{
    await ensureRoute(realm);
    if(!render(realm,root))throw new Error('Local Models route became ready but did not render the selected tab.');
    return true;
  }catch(error){
    const message=String(error?.message||error);
    status(realm,`Local models could not load: ${message}`);
    try{realm.dispatchEvent(new realm.CustomEvent('civweave:local-ai-settings-unavailable',{detail:{version:VERSION,message,settingsStillOpen:Boolean(root&&!root.hidden),stageIframeBridge:true,fullRouteRequired:true}}))}catch{}
    return false;
  }
}
function schedule(realm){try{realm.queueMicrotask(()=>realm.setTimeout(()=>void recover(realm),0))}catch{}}
function attachRealm(realm){
  const doc=safeDocument(realm);
  if(!doc||attachedDocuments.has(doc))return false;
  attachedDocuments.add(doc);
  const onClick=event=>{
    const ElementCtor=realm?.Element;
    const target=ElementCtor&&event.target instanceof ElementCtor?event.target.closest?.(`#${LAYER_ID} [data-settings-tab="local-models"]`):null;
    if(target)schedule(realm);
  };
  const onOpened=()=>{if(selected(realm))schedule(realm)};
  doc.addEventListener('click',onClick,true);
  realm.addEventListener('civweave:model-settings-opened',onOpened);
  realm.addEventListener('civweave:settings-ready',onOpened);
  if(selected(realm))schedule(realm);
  try{doc.documentElement.dataset.localModelsBridge='v337-stage-full-route'}catch{}
  return true;
}
function attachStage(){
  attachRealm(globalThis);
  const frame=document.getElementById(STAGE_ID);
  if(!frame)return false;
  const attachChild=()=>{try{if(frame.contentWindow)attachRealm(frame.contentWindow)}catch{}};
  if(!attachedFrames.has(frame)){
    attachedFrames.add(frame);
    frame.addEventListener('load',attachChild);
  }
  attachChild();
  return true;
}
function sweep(){attachStage()}
attachStage();
let sweeps=0;
const timer=setInterval(()=>{sweep();if(++sweeps>=30)clearInterval(timer)},500);

globalThis.CivweaveSettingsLocalLoaderV337=Object.freeze({
  version:VERSION,routeVersion:ROUTE_VERSION,recover,render,ensureRoute,attachStage,
  stageIframeBridge:true,childRealmRenderer:true,fullRouteRequired:true,displayShimRejected:true,
  loaderBridgeRejected:true,actionRouteBypass:true,newPathCacheGeneration:true
});
})();