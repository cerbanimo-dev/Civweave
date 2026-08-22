(()=>{
'use strict';
const VERSION='1.0.5-cerbanimo-universal-navbar-only';
const NAV_ID='cw-themed-system-nav';
const NAV_SRC='/app/themed-system-nav-v178.js?v=1.0.163-five-guide-rail-universal-top-level-r1';
const ACTIONS_SRC='/app/persistent-shell-actions-v1.js?v=1.0.5-direct-routes';
const params=new URLSearchParams(location.search);
const standalone=(()=>{try{return navigator.standalone===true||['standalone','fullscreen','minimal-ui'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)||params.get('installed')==='1'}catch{return params.get('installed')==='1'}})();
const embedded=window.self!==window.top;

function cleanDirectUrl(){
  const next=new URL(location.href);
  next.searchParams.delete('embed');
  if(next.searchParams.get('civweave')==='1')next.searchParams.delete('civweave');
  next.searchParams.set('system','cerbanimo');
  next.searchParams.set('cabinet','1');
  if(standalone)next.searchParams.set('installed','1');
  return next;
}
function normalizeDirectRoute(){
  if(embedded)return false;
  const next=cleanDirectUrl();
  const current=`${location.pathname}${location.search}${location.hash}`;
  const normalized=`${next.pathname}${next.search}${next.hash}`;
  if(current===normalized)return false;
  history.replaceState(history.state,'',normalized);
  return true;
}
normalizeDirectRoute();

if(embedded){
  document.documentElement.dataset.cerbanimoEmbed='foreign-frame';
  if(standalone){try{window.top.location.replace(cleanDirectUrl().href)}catch{}}
  globalThis.CivweaveCerbanimoNavStabilityV1=Object.freeze({version:VERSION,ensure:()=>false,standalone,embedded,directShell:true,normalizeDirectRoute,cleanDirectUrl,navOwner:'universal-five-system-navbar'});
  return;
}

let universalInjected=false;
let actionsInjected=false;
let retryTimers=[];
function markReady(){document.documentElement.dataset.cerbanimoNavReady='true';document.documentElement.dataset.cerbanimoNavStability=VERSION;document.documentElement.dataset.cerbanimoNavOwner='universal-five-system-navbar'}
function ensureActions(){
  if(globalThis.CivweavePersistentShellActionsV1?.ensureMounted){globalThis.CivweavePersistentShellActionsV1.ensureMounted();return true}
  if(actionsInjected||document.readyState==='loading')return false;
  actionsInjected=true;const script=document.createElement('script');script.src=ACTIONS_SRC;script.async=false;script.dataset.cerbanimoPersistentActions=VERSION;script.onload=()=>globalThis.CivweavePersistentShellActionsV1?.ensureMounted?.();document.head.append(script);return false;
}
function ensure(){
  normalizeDirectRoute();
  document.querySelectorAll('.rc-bottom').forEach(node=>node.remove());
  const nav=document.getElementById(NAV_ID);
  if(nav?.isConnected){markReady();ensureActions();return true}
  const api=globalThis.CivweaveFamilyNavigationV178;
  try{if(api?.ensureMounted?.()&&document.getElementById(NAV_ID)?.isConnected){markReady();ensureActions();return true}}catch{}
  if(!universalInjected&&document.readyState!=='loading'){
    universalInjected=true;const script=document.createElement('script');script.src=NAV_SRC;script.async=false;script.dataset.cerbanimoUniversalNavRecovery=VERSION;script.onload=()=>queueMicrotask(ensure);document.head.append(script)
  }
  return false;
}
function schedule(){retryTimers.forEach(clearTimeout);retryTimers=[0,180,700,1800].map(delay=>setTimeout(()=>{if(ensure())retryTimers.forEach(clearTimeout)},delay))}
addEventListener('pageshow',ensure);addEventListener('focus',ensure);addEventListener('civweave:system-route-changed',ensure);addEventListener('cerbanimo:quest-engine-changed',ensure);document.addEventListener('visibilitychange',()=>{if(!document.hidden)ensure()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
globalThis.CivweaveCerbanimoNavStabilityV1=Object.freeze({version:VERSION,ensure,standalone,embedded,directShell:true,normalizeDirectRoute,cleanDirectUrl,navOwner:'universal-five-system-navbar'});
})();
