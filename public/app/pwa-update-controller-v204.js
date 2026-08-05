(()=>{
'use strict';
const VERSION='v204-visible-update-library-preservation';
const WORKER_URL='/service-worker-v203.js';
const LEGACY_LIBRARY_CACHE='commonweave-knowledge-schools-v1';
const LIBRARY_CACHE='cwknowledge-school-seeds-v2';
const RELOAD_KEY='commonweave.pwa-update.reload.v204';
const LAST_CHECK_KEY='commonweave.pwa-update.last-check.v204';
const AUTO_CHECK_MS=6*60*60*1000;
let registration=null;
let button=null;
let checking=false;
let restartReady=false;
let repairMode=false;
let observer=null;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function installed(){return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)}
function setState(label,state='idle',title=''){
  if(!button)return;
  button.textContent=label;
  button.dataset.state=state;
  button.disabled=state==='checking';
  button.title=title||label;
  button.setAttribute('aria-label',title||label);
}
function installStyles(){
  if(document.getElementById('commonweave-update-style-v204'))return;
  const style=document.createElement('style');
  style.id='commonweave-update-style-v204';
  style.textContent=`[data-commonweave-update-control]{min-height:38px;padding:8px 12px;border:1px solid #88e9ff66;border-radius:999px;background:#082431e8;color:#efffff;font:800 .76rem/1.1 system-ui,sans-serif;letter-spacing:.02em;cursor:pointer;box-shadow:0 8px 24px #0005;white-space:nowrap}[data-commonweave-update-control][data-state="ready"]{border-color:#8ff0b5;background:#123b2d;color:#cffff0;animation:cw-update-pulse 1.8s ease-in-out infinite}[data-commonweave-update-control][data-state="error"]{border-color:#ff9a8f;background:#431c22;color:#ffe8e5}[data-commonweave-update-control][data-state="checking"]{opacity:.7;cursor:progress}@keyframes cw-update-pulse{50%{box-shadow:0 0 0 5px #8ff0b522,0 8px 24px #0005}}.commonweave-update-floating{position:fixed;z-index:2147482000;right:max(12px,env(safe-area-inset-right));bottom:max(82px,calc(env(safe-area-inset-bottom) + 72px))}`;
  document.head.append(style);
}
function findHost(){return document.getElementById('cwf104-head')||document.querySelector('.top,.gateway-header,[data-commonweave-header]')}
function mount(){
  installStyles();
  if(button?.isConnected)return button;
  button=document.querySelector('[data-commonweave-update-control]')||document.createElement('button');
  button.type='button';
  button.dataset.commonweaveUpdateControl='';
  button.addEventListener('click',()=>{if(repairMode){location.assign('/');return}if(restartReady){location.reload();return}checkForUpdates(true)});
  const host=findHost();
  if(host){button.classList.remove('commonweave-update-floating');host.append(button)}
  else{button.classList.add('commonweave-update-floating');document.body?.append(button)}
  setState('Check updates','idle','Check for a new Commonweave package');
  return button;
}
async function migrateKnowledgeCache(){
  if(!('caches'in globalThis))return 0;
  const names=await caches.keys();
  if(!names.includes(LEGACY_LIBRARY_CACHE))return 0;
  const legacy=await caches.open(LEGACY_LIBRARY_CACHE);
  const target=await caches.open(LIBRARY_CACHE);
  const requests=await legacy.keys();
  let copied=0;
  for(const request of requests){
    if(await target.match(request))continue;
    const response=await legacy.match(request);
    if(response){await target.put(request,response.clone());copied+=1}
  }
  if(requests.length)await caches.delete(LEGACY_LIBRARY_CACHE);
  return copied;
}
function currentWorker(reg){
  const worker=reg?.active||navigator.serviceWorker.controller;
  if(!worker)return null;
  try{return new URL(worker.scriptURL).pathname===WORKER_URL?worker:null}catch{return null}
}
function bindInstalling(reg){
  const worker=reg?.installing||reg?.waiting;
  if(!worker)return false;
  setState('Installing update…','checking','A new Commonweave package is being installed');
  const changed=()=>{
    if(worker.state==='installed'&&reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
    if(worker.state==='activated'){restartReady=true;setState('Restart to update','ready','Restart Commonweave to finish the update')}
    if(worker.state==='redundant')setState('Update failed','error','The update worker was rejected. Open the installer to repair the package.')
  };
  worker.addEventListener('statechange',changed);
  changed();
  return true;
}
async function askVersion(worker){
  if(!worker)return null;
  return new Promise(resolve=>{
    const channel=new MessageChannel();
    const timer=setTimeout(()=>resolve(null),5000);
    channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data||null)};
    worker.postMessage({type:'GET_VERSION'},[channel.port2]);
  });
}
async function checkForUpdates(userInitiated=false){
  if(checking)return;
  checking=true;
  restartReady=false;
  mount();
  setState('Checking updates…','checking','Checking the Commonweave release package');
  try{
    await migrateKnowledgeCache();
    if(!('serviceWorker'in navigator))throw new Error('Service workers are unavailable in this browser.');
    registration=registration||await navigator.serviceWorker.getRegistration('/');
    if(!registration){
      repairMode=true;
      setState('Open updater','error','The Commonweave package worker is missing. Open the installer to restore it.');
      return;
    }
    if(userInitiated)sessionStorage.setItem(RELOAD_KEY,'1');
    repairMode=false;
    const before=currentWorker(registration)?.scriptURL||'';
    await registration.update();
    localStorage.setItem(LAST_CHECK_KEY,String(Date.now()));
    if(bindInstalling(registration))return;
    await pause(350);
    registration=await navigator.serviceWorker.getRegistration('/');
    const after=currentWorker(registration)?.scriptURL||'';
    const version=await askVersion(currentWorker(registration));
    if(before&&after&&before!==after){
      restartReady=true;
      setState('Restart to update','ready','A new Commonweave package is active. Restart to load it.');
    }else{
      sessionStorage.removeItem(RELOAD_KEY);
      setState('Commonweave current','idle',version?.version?`Commonweave ${version.version} is current`:'Commonweave is current');
      setTimeout(()=>setState('Check updates','idle','Check for a new Commonweave package'),3500);
    }
  }catch(error){
    sessionStorage.removeItem(RELOAD_KEY);
    setState('Update check failed','error',error?.message||String(error));
  }finally{
    checking=false;
    if(button?.dataset.state==='checking'&&!registration?.installing&&!registration?.waiting)setState('Check updates','idle');
  }
}
function init(){
  mount();
  observer=new MutationObserver(()=>mount());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if('serviceWorker'in navigator){
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(sessionStorage.getItem(RELOAD_KEY)==='1'){
        sessionStorage.removeItem(RELOAD_KEY);
        location.reload();
      }else{
        restartReady=true;
        setState('Restart to update','ready','A new Commonweave package is active. Restart to load it.');
      }
    });
    navigator.serviceWorker.getRegistration('/').then(reg=>{registration=reg;if(reg?.waiting)bindInstalling(reg)}).catch(()=>{});
  }
  const last=Number(localStorage.getItem(LAST_CHECK_KEY)||0);
  if(installed()&&navigator.onLine&&Date.now()-last>AUTO_CHECK_MS)setTimeout(()=>checkForUpdates(false),1800);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
globalThis.CommonweavePwaUpdateV204=Object.freeze({version:VERSION,checkForUpdates,migrateKnowledgeCache,libraryCache:LIBRARY_CACHE});
})();
