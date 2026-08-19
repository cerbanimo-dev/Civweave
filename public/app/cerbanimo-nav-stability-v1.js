(()=>{
'use strict';
const VERSION='1.0.2-cerbanimo-nav-stability-stage-watchdog';
const NAV_ID='cw-themed-system-nav';
const NAV_SRC='/app/themed-system-nav-v178.js?v=1.0.163-five-guide-rail-stability-r1';
const WATCHDOG_DELAY_MS=4200;
const WATCHDOG_RECOVERY='cerbanimo-stage-watchdog-v1';
const WATCHDOG_KEY='civweave.cerbanimo.stage-watchdog.v1';
const params=new URLSearchParams(location.search);
const standalone=(()=>{try{return navigator.standalone===true||['standalone','fullscreen','minimal-ui'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)||params.get('installed')==='1'}catch{return params.get('installed')==='1'}})();
const embedded=window.self!==window.top;
const canonicalPersistentShell=embedded&&(()=>{
  try{
    const frame=window.frameElement,parent=window.parent,parentPath=parent?.location?.pathname||'';
    const liveFrame=parent?.document?.getElementById?.('cw-family-stage');
    const shellRevision=parent?.CivweavePersistentFamilyShellV1?.revision||'';
    return frame?.id==='cw-family-stage'&&liveFrame===frame&&(shellRevision==='persistent-family-shell-v1'||parentPath==='/app/persistent-family-shell-v1.html'||parentPath==='/app/fullscreen-family-v104.html');
  }catch{return false}
})();

function stageRendered(){return Boolean(document.querySelector('#rc-app .rc-shell'))}
function clearWatchdogAttempt(){try{sessionStorage.removeItem(WATCHDOG_KEY)}catch{}}
function watchdogAttempts(){try{return Math.max(0,Number(sessionStorage.getItem(WATCHDOG_KEY)||0)||0)}catch{return 0}}
function showStageRecovery(){
  const host=document.querySelector('#rc-app');if(!host)return;
  host.innerHTML='<section style="min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#07131e;color:#e9f8ff;font:16px/1.5 system-ui;text-align:center"><div><strong style="display:block;font-size:20px;margin-bottom:8px">Cerbanimo did not finish opening.</strong><p style="max-width:34rem;color:#a8c8d9">The staging shell recovered from the stalled boot instead of leaving a blank screen.</p><button type="button" data-cw-cerbanimo-stage-retry style="font:inherit;font-weight:800;padding:10px 14px;border-radius:10px;border:1px solid #6ce3ff;background:#10263a;color:#e9f8ff">Retry Cerbanimo</button></div></section>';
  host.querySelector('[data-cw-cerbanimo-stage-retry]')?.addEventListener('click',()=>{clearWatchdogAttempt();const next=new URL(location.href);next.searchParams.set('recovery',WATCHDOG_RECOVERY);next.searchParams.set('boot',Date.now().toString(36));location.replace(next.href)},{once:true});
}
function runStageWatchdog(){
  if(!canonicalPersistentShell)return false;
  if(stageRendered()){clearWatchdogAttempt();document.documentElement.dataset.cerbanimoStageReady='true';return true}
  const attempts=watchdogAttempts();
  if(attempts<1){
    try{sessionStorage.setItem(WATCHDOG_KEY,String(attempts+1))}catch{}
    const next=new URL(location.href);next.searchParams.set('recovery',WATCHDOG_RECOVERY);next.searchParams.set('boot',Date.now().toString(36));location.replace(next.href);return false;
  }
  showStageRecovery();return false;
}
function scheduleStageWatchdog(){
  if(!canonicalPersistentShell)return;
  setTimeout(runStageWatchdog,WATCHDOG_DELAY_MS);
}

if(embedded){
  document.documentElement.dataset.cerbanimoEmbed=canonicalPersistentShell?'persistent-family-shell':'foreign-frame';
  if(!canonicalPersistentShell&&standalone){
    try{window.top.location.replace(location.href)}catch{}
  }
  if(canonicalPersistentShell){
    scheduleStageWatchdog();
    addEventListener('cerbanimo:quest-engine-changed',()=>{if(stageRendered())clearWatchdogAttempt()});
  }
  globalThis.CivweaveCerbanimoNavStabilityV1=Object.freeze({version:VERSION,ensure:()=>canonicalPersistentShell,standalone,embedded,canonicalPersistentShell,runStageWatchdog});
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

globalThis.CivweaveCerbanimoNavStabilityV1=Object.freeze({version:VERSION,ensure,standalone,embedded,canonicalPersistentShell,runStageWatchdog});
})();
