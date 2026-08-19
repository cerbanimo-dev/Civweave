(()=>{
'use strict';
const VERSION='175.1-shared-tools-no-ai-vault-surface-resilience';
const SURFACE_MARKER='shared-tools-v175-surface-resilience';
const SURFACE_SELECTOR='main.app>.main,.guide,.work,#workspace';
let surfaceCheckQueued=false;
function additions(){return globalThis.CivweaveAdditionsV156}
function forceMesh(){try{return additions()?.openTools?.('mesh')}catch(error){console.error('[Civweave shared tools cleanup]',error)}}
function isWorkingCampus(){
  const route=String(document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem||'').toLowerCase();
  return route==='civweave'||location.pathname.includes('working-campus-v156')||location.pathname.includes('working-campus-v440');
}
function visible(node,minHeight=40){
  if(!node?.isConnected)return false;
  const style=getComputedStyle(node),rect=node.getBoundingClientRect();
  return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity||1)>.01&&rect.width>=40&&rect.height>=minHeight;
}
function modalSurfaceOpen(){
  return Boolean(document.querySelector('dialog[open],#cw-new-user-onboarding-v1:not([hidden]),#cw-settings-v320:not([hidden]),#cw-persistent-guide-chat-v215:not([hidden])'));
}
function surfaceState(){
  const main=document.querySelector('main.app>.main'),guide=main?.querySelector('.guide'),work=main?.querySelector('.work'),workspace=document.getElementById('workspace');
  return{main,guide,work,workspace,healthy:Boolean(visible(main,80)&&visible(guide,60)&&visible(work,80))};
}
function restoreWorkingSurface(reason='check'){
  if(!isWorkingCampus())return false;
  const state=surfaceState();
  if(state.healthy)return false;
  if(modalSurfaceOpen())return false;
  const nodes=[state.main,state.guide,state.work].filter(Boolean);
  for(const node of nodes){
    node.removeAttribute('hidden');
    node.removeAttribute('inert');
    node.style.setProperty('visibility','visible','important');
    node.style.setProperty('opacity','1','important');
  }
  if(state.main){
    state.main.style.setProperty('display','grid','important');
    state.main.style.setProperty('transform','none','important');
  }
  for(const node of [state.guide,state.work].filter(Boolean))node.style.setProperty('display','block','important');
  const api=globalThis.CivweaveWorkingCampusV156;
  if(state.workspace&&!state.workspace.childElementCount&&api?.openView){
    try{api.openView(api.currentView?.()||'quest')}catch{}
  }
  document.documentElement.dataset.civweaveSurfaceRepair=SURFACE_MARKER;
  try{dispatchEvent(new CustomEvent('civweave:working-campus-surface-repaired',{detail:{source:SURFACE_MARKER,reason,at:new Date().toISOString()}}))}catch{}
  return surfaceState().healthy;
}
function queueSurfaceCheck(reason='mutation'){
  if(surfaceCheckQueued)return;
  surfaceCheckQueued=true;
  requestAnimationFrame(()=>{
    surfaceCheckQueued=false;
    restoreWorkingSurface(reason);
  });
}
function relevantSurfaceMutation(record){
  if(record.type==='attributes')return Boolean(record.target?.matches?.(SURFACE_SELECTOR));
  return [...record.addedNodes,...record.removedNodes].some(node=>node?.nodeType===1&&(node.matches?.(SURFACE_SELECTOR)||node.querySelector?.(SURFACE_SELECTOR)));
}
function monitorWorkingSurface(){
  if(!isWorkingCampus())return false;
  for(const delay of [0,120,420,1200,2800])setTimeout(()=>queueSurfaceCheck(`startup-${delay}`),delay);
  const observer=new MutationObserver(records=>{if(records.some(relevantSurfaceMutation))queueSurfaceCheck('dom-change')});
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','inert']});
  addEventListener('pageshow',()=>queueSurfaceCheck('pageshow'));
  addEventListener('civweave:working-campus-page-resumed',()=>queueSurfaceCheck('page-resumed'));
  addEventListener('civweave:working-campus-plan-built',()=>queueSurfaceCheck('plan-built'));
  document.addEventListener('pointerup',()=>setTimeout(()=>queueSurfaceCheck('post-interaction'),80),true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')queueSurfaceCheck('visibility-return')});
  return true;
}
function patch(){
  const launcher=document.querySelector('#cwv156-tools button');
  if(launcher&&!launcher.dataset.noAiVault){launcher.dataset.noAiVault='true';launcher.innerHTML='<span class="cwv156-dot"></span>Shared tools'}
  const dialog=document.querySelector('#cwv156-dialog');if(!dialog)return;
  dialog.querySelector('[data-cwv-tab="vault"]')?.remove();
  const mesh=dialog.querySelector('[data-cwv-tab="mesh"]');if(mesh&&!dialog.querySelector('[data-cwv-tab][aria-selected="true"]'))mesh.setAttribute('aria-selected','true');
  const body=dialog.querySelector('#cwv156-body');
  if(body?.querySelector('[data-cwv-native-settings],[data-cwv-model-check],#cwv156-remember,#cwv156-unlock'))queueMicrotask(forceMesh);
}
document.addEventListener('click',event=>{
  const launcher=event.target.closest('#cwv156-tools button');if(launcher){event.preventDefault();event.stopImmediatePropagation();forceMesh();return}
  const vault=event.target.closest('[data-cwv-tab="vault"],[data-cwv-native-settings],[data-cwv-model-check]');if(vault){event.preventDefault();event.stopImmediatePropagation();forceMesh()}
},true);
addEventListener('civweave:open-shared-tools',event=>{if(!event.detail?.tab||event.detail.tab==='vault')setTimeout(forceMesh,0)},true);
const observer=new MutationObserver(patch);observer.observe(document.documentElement,{childList:true,subtree:true});
document.readyState==='loading'?addEventListener('DOMContentLoaded',()=>{patch();monitorWorkingSurface()},{once:true}):(patch(),monitorWorkingSurface());
globalThis.CivweaveSharedToolsCleanupV175=Object.freeze({version:VERSION,patch,open:forceMesh,restoreWorkingSurface,surfaceState,surfaceMarker:SURFACE_MARKER});
})();