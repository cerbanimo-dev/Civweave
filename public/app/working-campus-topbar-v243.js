(()=>{
'use strict';
const VERSION='1.0.0-working-campus-topbar-association-map-bridge-v275';
const ASSOCIATION_MAP='/app/federation-association-map.js';
const BASE_TOPBAR='/app/working-campus-topbar-v243-base.js';
const API='CivweaveWorkingCampusTopbarBridgeV275';
if(globalThis[API]?.version===VERSION)return;
function find(src){return [...document.scripts].find(script=>{try{return script.src&&new URL(script.src,location.href).pathname===src}catch{return false}})}
function load(src,marker){
  const existing=find(src);
  if(existing)return Promise.resolve(existing);
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=`${src}?v=${VERSION}`;
    script.async=false;
    script.dataset.civweaveTopbarBridge=marker;
    script.onload=()=>resolve(script);
    script.onerror=()=>reject(new Error(`Could not load ${src}.`));
    document.head.append(script);
  })
}
function retitle(){
  const button=document.getElementById('cw-working-campus-map-v243');
  if(!button)return false;
  button.title='Open Federation Association Map';
  button.setAttribute('aria-label','Open Federation Association Map');
  button.dataset.mapSurface='association-map-v275';
  return true
}
function start(){
  return load(ASSOCIATION_MAP,'association-map')
    .catch(error=>console.warn('[Civweave] Built-in association map could not preload; Federation Finder fallback remains available.',error))
    .then(()=>load(BASE_TOPBAR,'base-topbar'))
    .then(()=>{retitle();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',retitle,{once:true});else queueMicrotask(retitle);return true})
    .catch(error=>{console.error('[Civweave] Working-campus topbar base could not load.',error);return false});
}
globalThis[API]=Object.freeze({version:VERSION,associationMap:ASSOCIATION_MAP,baseTopbar:BASE_TOPBAR,start,retitle});
start();
})();
