(()=>{
'use strict';
const VERSION='staging-pwa-rescue-v431.2';
const RELEASE_VERSION='1.0.163';
const WORKER_BUILD=`${RELEASE_VERSION}-lightweight-shell-v208`;
const STAGING_ORIGIN='https://civweave-staging.pages.dev';
const WORKER_URL=`/service-worker-v203.js?v=${WORKER_BUILD}&revision=staging-pwa-rescue-v431.2`;
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
function workerUrl(worker){try{return new URL(worker?.scriptURL||'',location.href)}catch{return null}}
function workerPath(worker){return workerUrl(worker)?.pathname||''}
function workerLooksCurrent(worker){
  const url=workerUrl(worker);
  return Boolean(worker?.state==='activated'&&url?.pathname==='/service-worker-v203.js'&&url.searchParams.get('v')===WORKER_BUILD);
}
function preservedCache(name){return PRESERVED_CACHE_PREFIXES.some(prefix=>name.startsWith(prefix))}
function askWorker(worker,type,timeoutMs=2500){
  return new Promise(resolve=>{
    if(!worker)return resolve(null);
    const channel=new MessageChannel();
    const timer=setTimeout(()=>resolve(null),timeoutMs);
    channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data||null)};
    try{worker.postMessage({type},[channel.port2])}catch{clearTimeout(timer);resolve(null)}
  });
}
async function inspectCurrentShell(){
  const registration=await navigator.serviceWorker.getRegistration('/').catch(()=>null);
  const active=registration?.active||null;
  if(!registration||!rootScope(registration))return{ok:false,reason:'no-root-registration',registration,active};
  if(!workerLooksCurrent(active))return{ok:false,reason:'worker-url-or-state-mismatch',registration,active};
  const [versionPacket,shellPacket]=await Promise.all([
    askWorker(active,'GET_VERSION',2200),
    askWorker(active,'GET_DEVICE_PACKAGE_STATUS',3500)
  ]);
  const versionOk=versionPacket?.type==='CIVWEAVE_VERSION'&&versionPacket.version===RELEASE_VERSION&&versionPacket.installMode==='lightweight-shell';
  const shellOk=shellPacket?.type==='CIVWEAVE_DEVICE_PACKAGE'&&shellPacket.version===RELEASE_VERSION&&shellPacket.mode==='lightweight-shell'&&shellPacket.ready===true;
  return{ok:Boolean(versionOk&&shellOk),reason:versionOk?shellOk?'current':'shell-incomplete':'version-contract-mismatch',registration,active,versionPacket,shellPacket};
}
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
      if(workerLooksCurrent(registration.active))return registration;
    }
    await pause(180);
  }
  return navigator.serviceWorker.getRegistration('/').catch(()=>null);
}
async function run(){
  if(location.origin!==STAGING_ORIGIN)return{ok:true,skipped:true,reason:'not-staging'};
  if(!('serviceWorker'in navigator))return{ok:false,skipped:true,reason:'service-workers-unavailable'};

  status('Checking the staging launch shell…');
  const initial=await inspectCurrentShell().catch(error=>({ok:false,reason:error?.message||String(error)}));
  if(initial.ok){
    const result={ok:true,skipped:true,repaired:false,version:VERSION,reason:'current-shell',worker:workerPath(initial.active),workerUrl:initial.active?.scriptURL||''};
    status('Staging launch shell is current.','ready');
    try{dispatchEvent(new CustomEvent('civweave:staging-pwa-rescue-complete',{detail:result}))}catch{}
    return result;
  }

  status('Refreshing stale staging shell data…');
  const deletedCaches=await clearStaleShellCaches().catch(()=>[]);
  status('Replacing the retained staging app worker…');
  const removedWorkers=await unregisterRootWorkers().catch(()=>[]);
  await pause(120);
  const registration=await navigator.serviceWorker.register(WORKER_URL,{scope:'/',updateViaCache:'none'});
  promote(registration);
  await waitForCurrentWorker();
  const final=await inspectCurrentShell().catch(error=>({ok:false,reason:error?.message||String(error)}));
  const active=final.active||registration.active||null;
  const result={ok:Boolean(final.ok),skipped:false,repaired:true,version:VERSION,reason:final.reason||initial.reason,worker:workerPath(active),workerUrl:active?.scriptURL||'',deletedCaches,removedWorkers};
  status(result.ok?'Staging launch shell refreshed.':'The staging launch shell is still activating.',result.ok?'ready':'pending');
  try{dispatchEvent(new CustomEvent('civweave:staging-pwa-rescue-complete',{detail:result}))}catch{}
  return result;
}
const ready=run().catch(error=>{
  const result={ok:false,skipped:false,repaired:false,version:VERSION,error:error?.message||String(error)};
  status(`Staging launch repair could not finish: ${result.error}`,'failed');
  try{dispatchEvent(new CustomEvent('civweave:staging-pwa-rescue-complete',{detail:result}))}catch{}
  return result;
});
globalThis.CivweaveStagingPwaRescueV431=Object.freeze({version:VERSION,releaseVersion:RELEASE_VERSION,stagingOrigin:STAGING_ORIGIN,workerUrl:WORKER_URL,ready,inspectCurrentShell,clearStaleShellCaches,unregisterRootWorkers});
})();
