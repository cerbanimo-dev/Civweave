(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const BOOT_KEY='civweave.install-boundary.boot.v228';
const SAFE_KEY='civweave.boot-recovery.safe.v426';
const LEGAL_MANIFEST='/legal/civweave-legal-release-v1.json';
const OFFLINE_META='/__civweave/offline-package-v208.json';
const FALLBACK_VERSION='1.0.160';
const RELEASE_TIMEOUT_MS=1500;
const WORKER_STEP_TIMEOUT_MS=1800;
const ROUTE_TIMEOUT_MS=2200;
const installedDisplay=()=>navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);
const explicitInstalled=params.get('installed')==='1'&&installedDisplay();
const localDeveloper=()=>['localhost','127.0.0.1','::1'].includes(location.hostname)&&params.get('developer')==='1';
const semver=value=>/^\d+\.\d+\.\d+$/.test(String(value||''))?String(value):'';
const recoveryUi=()=>globalThis.CivweaveBootRecoveryV426||null;
function bounded(promise,timeoutMs,label='operation'){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const timer=setTimeout(()=>{if(settled)return;settled=true;reject(new Error(`${label} timed out after ${timeoutMs} ms`))},timeoutMs);
    Promise.resolve(promise).then(value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value)},error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error)});
  });
}
function installerUrl(source='installed-entry-runtime-browser-gate-v1'){
  const installer=new URL('/app/index.html',location.origin);
  installer.searchParams.set('install','required');
  installer.searchParams.set('source',source);
  return installer.href;
}
function authorize(){try{sessionStorage.setItem(BOOT_KEY,'1')}catch{}}
function safeRecoveryRequested(){
  if(params.get('recovery')==='safe')return true;
  try{return sessionStorage.getItem(SAFE_KEY)==='1'}catch{return false}
}
async function cachedResponse(pathname){
  if(!('caches'in globalThis))return null;
  try{return await caches.match(pathname,{ignoreSearch:true})}catch{return null}
}
async function ensureLegalConsent(){
  const runtime=globalThis.CivweaveLegalConsentV1;
  if(runtime?.ensureConsent)return runtime.ensureConsent();
  let value;
  try{
    let response=await cachedResponse(LEGAL_MANIFEST);
    if(!response&&localDeveloper())response=await bounded(fetch(`${LEGAL_MANIFEST}?boot=${Date.now()}`,{cache:'no-store'}),1200,'legal release manifest');
    if(!response?.ok)throw new Error('The cached legal release manifest is unavailable.');
    value=await bounded(response.json(),600,'legal release manifest parse');
  }catch(error){
    throw new Error(`The legal-consent runtime is unavailable and its local release state could not be verified: ${error?.message||error}`);
  }
  if(value?.status==='final'&&value?.enforcement==='required')throw new Error('This release requires Terms acceptance, but the legal-consent runtime did not load.');
  return Object.freeze({required:false,status:value?.status||'unknown',enforcement:value?.enforcement||'disabled'});
}
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
    const cached=await cachedResponse('/app/manifest.webmanifest');
    if(cached?.ok){const resolved=versionFromManifest(await bounded(cached.json(),700,'cached release manifest parse'));if(resolved)return resolved}
  }catch{}
  if(!localDeveloper())return FALLBACK_VERSION;
  const controller=typeof AbortController==='function'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),RELEASE_TIMEOUT_MS):null;
  try{
    const response=await bounded(fetch(`/app/manifest.webmanifest?boot=${Date.now()}`,{cache:'no-store',signal:controller?.signal}),RELEASE_TIMEOUT_MS,'release manifest');
    if(response.ok){const resolved=versionFromManifest(await bounded(response.json(),700,'release manifest parse'));if(resolved)return resolved}
  }catch{}finally{if(timer)clearTimeout(timer)}
  return FALLBACK_VERSION;
}
function workerPath(worker){try{return new URL(worker?.scriptURL||'',location.href).pathname}catch{return''}}
function waitForControllerChange(timeout=1600){
  return new Promise(resolve=>{
    let settled=false;
    const finish=()=>{if(settled)return;settled=true;clearTimeout(timer);navigator.serviceWorker?.removeEventListener?.('controllerchange',finish);resolve(true)};
    const timer=setTimeout(finish,timeout);
    navigator.serviceWorker?.addEventListener?.('controllerchange',finish,{once:true});
  });
}
async function refreshWorker(releaseVersion,{allowProvision=false}={}){
  if(!('serviceWorker'in navigator))return null;
  const ui=recoveryUi();
  let registration=await bounded(navigator.serviceWorker.getRegistration('/'),700,'service worker lookup').catch(()=>null);
  if(registration?.active&&workerPath(registration.active)==='/service-worker-v203.js')return registration;
  if(!allowProvision){ui?.setStatus?.('The local campus package has not been prepared on this device yet.');return null}
  try{
    const workerUrl=`/service-worker-v203.js?v=${encodeURIComponent(releaseVersion)}-lightweight-shell-v208&revision=boot-recovery-v426-install-only-pwa-v1`;
    ui?.setStatus?.('Preparing the localhost developer worker…');
    registration=await bounded(navigator.serviceWorker.register(workerUrl,{scope:'/',updateViaCache:'none'}),WORKER_STEP_TIMEOUT_MS,'service worker registration');
    await bounded(registration.update(),WORKER_STEP_TIMEOUT_MS,'service worker update').catch(()=>null);
    registration=await bounded(navigator.serviceWorker.getRegistration('/'),700,'service worker lookup').catch(()=>registration)||registration;
    const candidate=registration.waiting||registration.installing;
    if(candidate){
      const activate=()=>{try{candidate.postMessage({type:'SKIP_WAITING'})}catch{}};
      if(candidate.state==='installed')activate();
      else candidate.addEventListener('statechange',()=>{if(candidate.state==='installed')activate()});
      await waitForControllerChange(1600);
      registration=await navigator.serviceWorker.getRegistration('/');
    }
    return registration?.active&&workerPath(registration.active)==='/service-worker-v203.js'?registration:null;
  }catch{
    ui?.setStatus?.('The existing local shell is taking over startup.');
    return null;
  }
}
async function localCampusReady(){
  if(localDeveloper())return true;
  if(!('caches'in globalThis))return false;
  try{
    const names=await caches.keys();
    for(const name of names.filter(value=>value.startsWith('civweave-offline-'))){
      const cache=await caches.open(name);
      const response=await cache.match(OFFLINE_META,{ignoreSearch:true});
      if(!response?.ok)continue;
      const meta=await response.clone().json().catch(()=>null);
      if(meta?.ready===true&&meta?.running!==true)return true;
    }
  }catch{}
  return false;
}
function ensureRoutes(releaseVersion){
  if(globalThis.CivweaveSystemRoutesV227)return Promise.resolve(globalThis.CivweaveSystemRoutesV227);
  const routeUrl=`/app/system-routes-v227.js?v=${encodeURIComponent(releaseVersion)}-five-system-route-contract-v227`;
  return bounded(new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname==='/app/system-routes-v227.js');
    const ready=()=>globalThis.CivweaveSystemRoutesV227?resolve(globalThis.CivweaveSystemRoutesV227):reject(new Error('Route contract loaded without becoming ready.'));
    if(existing){
      if(globalThis.CivweaveSystemRoutesV227){resolve(globalThis.CivweaveSystemRoutesV227);return}
      existing.addEventListener('load',ready,{once:true});existing.addEventListener('error',()=>reject(new Error('Route contract failed to load.')),{once:true});return;
    }
    const script=document.createElement('script');script.src=routeUrl;script.async=false;script.onload=ready;script.onerror=()=>reject(new Error('Route contract failed to load.'));document.head.append(script);
  }),ROUTE_TIMEOUT_MS,'route contract');
}
function fallbackDestination(releaseVersion){
  const destination=new URL('/app/working-campus-v156.html',location.origin);
  destination.searchParams.set('installed','1');
  destination.searchParams.set('version',releaseVersion);
  destination.searchParams.set('navigation','five-system-route-contract-v227-fallback');
  destination.searchParams.set('launch','installed-entry-v426');
  if(safeRecoveryRequested())destination.searchParams.set('recovery','safe');
  return destination;
}
async function boot(){
  if(!installedDisplay()&&!localDeveloper()){
    location.replace(installerUrl());
    return;
  }
  const ui=recoveryUi();
  ui?.setStatus?.('Checking this release’s local consent state…');
  await ensureLegalConsent();
  authorize();
  ui?.setStatus?.('Reading the installed release…');
  const releaseVersion=await bounded(resolveReleaseVersion(),RELEASE_TIMEOUT_MS+350,'release resolution').catch(()=>FALLBACK_VERSION);
  const registration=await refreshWorker(releaseVersion,{allowProvision:localDeveloper()});
  const campusReady=registration?await localCampusReady():false;
  if((!registration||!campusReady)&&!localDeveloper()){
    ui?.setStatus?.('The local campus package is not installed yet. Civweave will not fetch missing runtime files silently.');
    location.replace(installerUrl('installed-entry-local-package-required'));
    return;
  }
  const requested=params.get('system')||params.get('target')||'civweave';
  const aliases={hub:'civweave',cabinet:'civweave',cabinets:'civweave',cabinetonly:'civweave',lite:'civweave'};
  const system=aliases[requested]||requested;
  ui?.setStatus?.('Opening the local campus…');
  let destination;
  try{
    const routes=await ensureRoutes(releaseVersion);
    destination=routes.urlFor(routes.routeFor(system)?system:'civweave',{origin:location.origin,version:releaseVersion,source:'installed-entry-v426',developer:localDeveloper()});
    if(safeRecoveryRequested())destination.searchParams.set('recovery','safe');
  }catch{
    destination=fallbackDestination(releaseVersion);
  }
  ui?.markRouted?.();
  location.replace(destination.href);
}
boot().catch(error=>{
  console.error('[Civweave] Installed bootstrap recovery caught a launch failure.',error);
  recoveryUi()?.showRecovery?.(`The normal startup path stopped before the campus opened: ${error?.message||error}`);
});
globalThis.CivweaveInstalledEntryV146=Object.freeze({version:'1.0.160-boot-recovery-v426-legal-consent-v1-install-only-pwa-v1-local-first',installedDisplay,explicitInstalled,resolveReleaseVersion,refreshWorker,localCampusReady,safeRecoveryRequested,ensureLegalConsent,installerUrl,browserRuntimePolicy:'installed-display-cache-only'});
})();
