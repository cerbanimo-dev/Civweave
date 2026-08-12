(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const BOOT_KEY='civweave.install-boundary.boot.v227';
const LEGACY_BOOT_KEY='civweave.install-boundary.boot.v226';
const FALLBACK_VERSION='1.0.118';
const installedDisplay=()=>navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);
const legacyEntry=/^\/app\/installed-entry-v146(?:\.html)?$/.test(location.pathname);
const explicitInstalled=params.get('installed')==='1'||legacyEntry;
const localDeveloper=()=>['localhost','127.0.0.1','::1'].includes(location.hostname)&&params.get('developer')==='1';
const semver=value=>/^\d+\.\d+\.\d+$/.test(String(value||''))?String(value):'';
function authorize(){try{sessionStorage.setItem(BOOT_KEY,'1');sessionStorage.setItem(LEGACY_BOOT_KEY,'1')}catch{}}
function versionFromManifest(manifest){
  const named=String(manifest?.name||'').match(/\bv(\d+\.\d+\.\d+)\b/i)?.[1];
  if(named)return named;
  try{return semver(new URL(manifest?.start_url||'',location.origin).searchParams.get('version'))}catch{return''}
}
async function resolveReleaseVersion(){
  const scriptUrl=(()=>{try{return new URL(document.currentScript?.src||'',location.href)}catch{return null}})();
  const explicit=semver(scriptUrl?.searchParams.get('v'))||semver(params.get('version'));
  if(explicit)return explicit;
  try{
    const response=await fetch(`/app/manifest.webmanifest?boot=${Date.now()}`,{cache:'no-store'});
    if(response.ok){const resolved=versionFromManifest(await response.json());if(resolved)return resolved}
  }catch{}
  return FALLBACK_VERSION;
}
function waitForControllerChange(timeout=4500){
  return new Promise(resolve=>{
    let settled=false;
    const finish=()=>{if(settled)return;settled=true;clearTimeout(timer);navigator.serviceWorker?.removeEventListener?.('controllerchange',finish);resolve(true)};
    const timer=setTimeout(finish,timeout);
    navigator.serviceWorker?.addEventListener?.('controllerchange',finish,{once:true});
  });
}
async function refreshWorker(releaseVersion){
  if(!('serviceWorker'in navigator))return null;
  try{
    const workerUrl=`/service-worker-v203.js?v=${encodeURIComponent(releaseVersion)}-lightweight-shell-v208&revision=chat-convergence-v251-legacy-purge`;
    let registration=await navigator.serviceWorker.register(workerUrl,{scope:'/',updateViaCache:'none'});
    await registration.update();
    registration=await navigator.serviceWorker.getRegistration('/')||registration;
    const candidate=registration.waiting||registration.installing;
    if(candidate){
      const activate=()=>{try{candidate.postMessage({type:'SKIP_WAITING'})}catch{}};
      if(candidate.state==='installed')activate();
      else candidate.addEventListener('statechange',()=>{if(candidate.state==='installed')activate()});
      await waitForControllerChange();
    }
    return registration;
  }catch{return null}
}
function ensureRoutes(releaseVersion){
  if(globalThis.CivweaveSystemRoutesV227)return Promise.resolve(globalThis.CivweaveSystemRoutesV227);
  const routeUrl=`/app/system-routes-v227.js?v=${encodeURIComponent(releaseVersion)}-five-system-route-contract-v227`;
  return new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname==='/app/system-routes-v227.js');
    const ready=()=>globalThis.CivweaveSystemRoutesV227?resolve(globalThis.CivweaveSystemRoutesV227):reject(new Error('Route contract loaded without becoming ready.'));
    if(existing){existing.addEventListener('load',ready,{once:true});existing.addEventListener('error',()=>reject(new Error('Route contract failed to load.')),{once:true});return}
    const script=document.createElement('script');script.src=routeUrl;script.async=false;script.onload=ready;script.onerror=()=>reject(new Error('Route contract failed to load.'));document.head.append(script);
  });
}
async function boot(){
  authorize();
  const releaseVersion=await resolveReleaseVersion();
  await refreshWorker(releaseVersion);
  const requested=params.get('system')||params.get('target')||'civweave';
  const aliases={hub:'civweave',cabinet:'civweave',cabinets:'civweave',cabinetonly:'civweave',lite:'civweave'};
  const system=aliases[requested]||requested;
  try{
    const routes=await ensureRoutes(releaseVersion);
    const destination=routes.urlFor(routes.routeFor(system)?system:'civweave',{origin:location.origin,version:releaseVersion,source:'installed-entry',developer:localDeveloper()});
    location.replace(destination.href);
  }catch{
    const destination=new URL('/app/working-campus-v156.html',location.origin);destination.searchParams.set('installed','1');destination.searchParams.set('version',releaseVersion);destination.searchParams.set('navigation','five-system-route-contract-v227-fallback');location.replace(destination.href);
  }
}
boot();
globalThis.CivweaveInstalledEntryV146=Object.freeze({version:'1.0.118-chat-convergence-v250',installedDisplay,explicitInstalled,resolveReleaseVersion,refreshWorker});
})();
