(()=>{
'use strict';
const VERSION='staging-pwa-rescue-v431';
const STAGING_ORIGIN='https://civweave-staging.pages.dev';
const WORKER_URL='/service-worker-v203.js?v=1.0.163-lightweight-shell-v208&revision=staging-pwa-rescue-v431';
const STALE_CACHE_PREFIXES=['civweave-static-','civweave-runtime-','civweave-shell-','cwboot-','cwext-','cwimg-','cwrecovery-'];
const PRESERVED_CACHE_PREFIXES=['civweave-offline-','civweave-model-','cwknowledge-','cwupdate-','cw-open-learning-media-'];
const REALM_CACHE=/^(?:living-school|cerbanimo|fellowfare|anarchadia)-/;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function status(message,state='working'){
  try{
    document.documentElement.dataset.civweaveStagingRescue=state;
    const node=document.getElementById('cw-staging-root-rescue');
    if(node){node.hidden=false;node.textContent=message;node.dataset.state=state}
  }catch{}
}
function rootScope(registration){
  try{const scope=new URL(registration.scope);return scope.origin===location.origin&&scope.pathname==='/'}catch{return false}
}
function workerPath(worker){try{return new URL(worker?.scriptURL||'',location.href).pathname}catch{return''}}
function preservedCache(name){return PRESERVED_CACHE_PREFIXES.some(prefix=>name.startsWith(prefix))}
async function clearStaleShellCaches(){
  if(!('caches'in globalThis))return[];
  const names=await caches.keys();
  const stale=names.filter(name=>!preservedCache(name)&&(STALE_CACHE_PREFIXES.some(prefix=>name.startsWith(prefix))||REALM_CACHE.test(name)));
  await Promise.allSettled(stale.map(name=>caches.delete(name)));
  return stale;
}
async function unregisterRootWorkers(){
  const registrations=await navigator.serviceWorker.getRegistrations().catch(()=>[]);
  const root=registrations.filter(rootScope);
  await Promise.allSettled(root.map(registration=>registration.unregister()));
  return root.map(registration=>workerPath(registration.active||registration.waiting||registration.installing)).filter(Boolean);
}
function promote(registration){
  const activate=worker=>{try{worker?.postMessage?.({type:'SKIP_WAITING'})}catch{}};
  if(registration.waiting)activate(registration.waiting);
  const candidate=registration.installing;
  if(candidate){
    if(candidate.state==='installed')activate(candidate);
    else candidate.addEventListener('statechange',()=>{if(candidate.state==='installed')activate(candidate)});
  }
}
async function waitForCurrentWorker(timeoutMs=15000){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    const registration=await navigator.serviceWorker.getRegistration('/').catch(()=>null);
    if(registration){
      promote(registration);
      const active=registration.active;
      if(active?.state==='activated'&&workerPath(active)==='/service-worker-v203.js')return registration;
    }
    await pause(180);
  }
  return navigator.serviceWorker.getRegistration('/').catch(()=>null);
}
async function run(){
  if(location.origin!==STAGING_ORIGIN)return{ok:true,skipped:true,reason:'not-staging'};
  if(!('serviceWorker'in navigator))return{ok:false,skipped:true,reason:'service-workers-unavailable'};
  status('Refreshing the staging launch shell…');
  const deletedCaches=await clearStaleShellCaches().catch(()=>[]);
  status('Replacing the retained staging app worker…');
  const removedWorkers=await unregisterRootWorkers().catch(()=>[]);
  await pause(120);
  const registration=await navigator.serviceWorker.register(WORKER_URL,{scope:'/',updateViaCache:'none'});
  promote(registration);
  const current=await waitForCurrentWorker();
  const active=current?.active||registration.active||null;
  const ok=active?.state==='activated'&&workerPath(active)==='/service-worker-v203.js';
  const result={ok,skipped:false,version:VERSION,worker:workerPath(active),workerUrl:active?.scriptURL||'',deletedCaches,removedWorkers};
  status(ok?'Staging launch shell refreshed.':'The staging launch shell is still activating.',ok?'ready':'pending');
  try{dispatchEvent(new CustomEvent('civweave:staging-pwa-rescue-complete',{detail:result}))}catch{}
  return result;
}
const ready=run().catch(error=>{
  const result={ok:false,skipped:false,version:VERSION,error:error?.message||String(error)};
  status(`Staging launch repair could not finish: ${result.error}`,'failed');
  try{dispatchEvent(new CustomEvent('civweave:staging-pwa-rescue-complete',{detail:result}))}catch{}
  return result;
});
globalThis.CivweaveStagingPwaRescueV431=Object.freeze({version:VERSION,stagingOrigin:STAGING_ORIGIN,workerUrl:WORKER_URL,ready,clearStaleShellCaches,unregisterRootWorkers});
})();
