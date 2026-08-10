(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const BOOT_KEY='civweave.install-boundary.boot.v227';
const LEGACY_BOOT_KEY='civweave.install-boundary.boot.v226';
const FALLBACK_VERSION='1.0.93';
const LOCAL_ROUTES=Object.freeze({
  civweave:'/app/working-campus-v156.html',
  'living-school':'/app/cabinets/living-school/index.html',
  cerbanimo:'/app/realm-console-v140.html',
  fellowfare:'/app/fellowfare-cabinet-v144.html',
  anarchadia:'/app/anarchadia-console-v139.html'
});
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
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),750);
    const response=await fetch(`/app/manifest.webmanifest?boot=${Date.now()}`,{cache:'no-store',signal:controller.signal});
    clearTimeout(timer);
    if(response.ok){const resolved=versionFromManifest(await response.json());if(resolved)return resolved}
  }catch{}
  return FALLBACK_VERSION;
}
function waitForControllerChange(timeout=2500){
  return new Promise(resolve=>{
    let settled=false;
    const finish=()=>{if(settled)return;settled=true;clearTimeout(timer);navigator.serviceWorker?.removeEventListener?.('controllerchange',finish);resolve(true)};
    const timer=setTimeout(finish,timeout);
    navigator.serviceWorker?.addEventListener?.('controllerchange',finish,{once:true});
  });
}
async function refreshWorker(releaseVersion=FALLBACK_VERSION){
  if(!('serviceWorker'in navigator))return null;
  try{
    const workerUrl=`/service-worker-v203.js?v=${encodeURIComponent(releaseVersion)}-lightweight-shell-v208&revision=chat-convergence-v250`;
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
function localDestination(system,releaseVersion){
  const pathname=LOCAL_ROUTES[system]||LOCAL_ROUTES.civweave;
  const destination=new URL(pathname,location.origin);
  destination.searchParams.set('installed','1');
  destination.searchParams.set('navigation','installed-entry-local-first-v146');
  destination.searchParams.set('version',releaseVersion||FALLBACK_VERSION);
  destination.searchParams.set('source','installed-entry');
  if(localDeveloper())destination.searchParams.set('developer','1');
  return destination;
}
function boot(){
  authorize();
  const requested=params.get('system')||params.get('target')||'civweave';
  const aliases={hub:'civweave',cabinet:'civweave',cabinets:'civweave',cabinetonly:'civweave',lite:'civweave'};
  const system=aliases[requested]||requested;
  const releaseVersion=semver(params.get('version'))||FALLBACK_VERSION;
  location.replace(localDestination(system,releaseVersion).href);
}
boot();
globalThis.CivweaveInstalledEntryV146=Object.freeze({
  version:'1.0.93-chat-convergence-v250',
  bootPolicy:'local-first-no-host-gate-v283',
  installedDisplay,
  explicitInstalled,
  localRoutes:LOCAL_ROUTES,
  localDestination,
  resolveReleaseVersion,
  refreshWorker
});
})();
