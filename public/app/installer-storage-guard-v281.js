(()=>{
'use strict';

const REVISION='installer-storage-guard-v281';
const MANIFEST_URL='/app/offline-package-v208.json';
const TEST_OVERRIDE_KEY='__CivweaveStorageTestOverrideV281';
let preparing=false;
let bypass=false;
let lastPreflight=null;

const $=selector=>document.querySelector(selector);
const numeric=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:0};

function formatBytes(bytes){
  const value=numeric(bytes);
  if(!value)return'0 MB';
  if(value<1024*1024)return`${Math.max(1,Math.ceil(value/1024))} KB`;
  if(value<1024*1024*1024)return`${(value/(1024*1024)).toFixed(value>=100*1024*1024?0:1)} MB`;
  return`${(value/(1024*1024*1024)).toFixed(value>=10*1024*1024*1024?0:1)} GB`;
}

function localTestOverride(){
  if(!['localhost','127.0.0.1','::1'].includes(location.hostname))return null;
  const value=globalThis[TEST_OVERRIDE_KEY];
  return value&&typeof value==='object'?value:null;
}

async function loadBudget(){
  try{
    const response=await fetch(`${MANIFEST_URL}?storage-preflight=${Date.now()}`,{cache:'no-store'});
    if(!response.ok)return null;
    const manifest=await response.json();
    const preflight=manifest?.preflight;
    if(preflight?.revision!=='campus-storage-budget-v281')return null;
    const requiredFreeBytes=numeric(preflight.requiredFreeBytes);
    return requiredFreeBytes?{...preflight,requiredFreeBytes}:null;
  }catch{return null}
}

async function storageSnapshot(requestPersistence=false){
  const override=localTestOverride();
  if(override){
    const usage=numeric(override.usage),quota=numeric(override.quota);
    return{
      persistent:Boolean(override.persistent),
      usage,
      quota,
      available:quota?Math.max(0,quota-usage):0,
      testOverride:true
    };
  }
  const storage=navigator.storage;
  let persistent=false;
  try{persistent=Boolean(await storage?.persisted?.())}catch{}
  if(requestPersistence&&!persistent){
    try{persistent=Boolean(await storage?.persist?.())}catch{}
  }
  let usage=0,quota=0;
  try{
    const estimate=await storage?.estimate?.();
    usage=numeric(estimate?.usage);
    quota=numeric(estimate?.quota);
  }catch{}
  return{persistent,usage,quota,available:quota?Math.max(0,quota-usage):0};
}

function render(result){
  lastPreflight=result;
  const storageNode=$('#storage-state');
  const help=$('#install-help');
  if(result.blocked){
    const shortfall=Math.max(0,result.requiredFreeBytes-result.available);
    if(storageNode)storageNode.textContent=`need ${formatBytes(shortfall)} more space`;
    if(help)help.textContent=`Offline campus paused before download. Free about ${formatBytes(shortfall)} more browser storage, then retry. Existing shell, model, and school data are untouched.`;
    document.documentElement.dataset.civweaveStorageState='insufficient';
    return;
  }
  if(storageNode){
    const persistence=result.persistent?'persistent':'browser-managed';
    if(result.quota)storageNode.textContent=`${formatBytes(result.usage)} used · ${formatBytes(result.available)} available · ${persistence}`;
    else storageNode.textContent=persistence;
  }
  document.documentElement.dataset.civweaveStorageState=result.persistent?'persistent':'browser-managed';
}

async function preflight(requestPersistence=false){
  const [budget,storage]=await Promise.all([loadBudget(),storageSnapshot(requestPersistence)]);
  const requiredFreeBytes=numeric(budget?.requiredFreeBytes);
  const blocked=Boolean(requiredFreeBytes&&storage.quota&&storage.available<requiredFreeBytes);
  const result={...storage,budget,requiredFreeBytes,blocked,revision:REVISION};
  render(result);
  return result;
}

function currentCampus(){return globalThis.CivweaveOfflineCampusStatusV210?.last||globalThis.CivweaveInstallerStateV280?.campus||null}

async function onClick(event){
  if(bypass)return;
  const campus=currentCampus()||{};
  if(campus.running||campus.paused)return;
  const button=event.currentTarget;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(preparing)return;
  preparing=true;
  if(button)button.disabled=true;
  try{
    const result=await preflight(Boolean(event.isTrusted));
    if(result.blocked)return;
    bypass=true;
    button?.click();
  }finally{
    bypass=false;
    preparing=false;
    if(button)button.disabled=false;
  }
}

function bind(){
  const button=$('#download-offline-package');
  button?.addEventListener('click',onClick,true);
  addEventListener('appinstalled',()=>preflight(true));
  addEventListener('civweave:offline-campus-status',event=>{
    if(event.detail?.running&&!lastPreflight)preflight(false);
  });
  preflight(false);
  document.documentElement.dataset.civweaveStorageGuardRevision=REVISION;
}

globalThis.CivweaveInstallerStorageGuardV281=Object.freeze({
  revision:REVISION,
  preflight,
  get last(){return lastPreflight}
});

if(document.readyState==='loading')addEventListener('DOMContentLoaded',bind,{once:true});
else bind();
})();
