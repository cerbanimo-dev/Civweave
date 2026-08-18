(()=>{
'use strict';
const VERSION='1.0.0-cerbanimo-nav-stability';
const NAV_ID='cw-themed-system-nav';
const NAV_SRC='/app/themed-system-nav-v178.js?v=1.0.163-five-guide-rail-stability-r1';
const params=new URLSearchParams(location.search);
const standalone=(()=>{try{return navigator.standalone===true||['standalone','fullscreen','minimal-ui'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)||params.get('installed')==='1'}catch{return params.get('installed')==='1'}})();

if(window.self!==window.top){
  if(standalone){
    try{window.top.location.replace(location.href)}catch{}
  }
  return;
}

let fallbackInjected=false;
let retryTimers=[];
function markReady(){
  document.documentElement.dataset.cerbanimoNavReady='true';
  document.documentElement.dataset.cerbanimoNavStability=VERSION;
}
function ensure(){
  const nav=document.getElementById(NAV_ID);
  if(nav?.isConnected){markReady();return true}
  const api=globalThis.CivweaveFamilyNavigationV178;
  try{if(api?.ensureMounted?.()&&document.getElementById(NAV_ID)?.isConnected){markReady();return true}}catch{}
  if(!fallbackInjected&&document.readyState!=='loading'){
    fallbackInjected=true;
    const script=document.createElement('script');
    script.src=NAV_SRC;
    script.async=false;
    script.dataset.cerbanimoNavRecovery=VERSION;
    script.onload=()=>queueMicrotask(ensure);
    document.head.append(script);
  }
  return false;
}
function schedule(){
  retryTimers.forEach(clearTimeout);
  retryTimers=[0,180,700,1800].map(delay=>setTimeout(()=>{if(ensure())retryTimers.forEach(clearTimeout)},delay));
}

addEventListener('pageshow',ensure);
addEventListener('focus',ensure);
addEventListener('civweave:system-route-changed',ensure);
addEventListener('cerbanimo:quest-engine-changed',ensure);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)ensure()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();

globalThis.CivweaveCerbanimoNavStabilityV1=Object.freeze({version:VERSION,ensure,standalone});
})();
