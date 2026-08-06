(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const BOOT_KEY='commonweave.install-boundary.boot.v227';
const LEGACY_BOOT_KEY='commonweave.install-boundary.boot.v226';
const scriptUrl=(()=>{try{return new URL(document.currentScript?.src||'',location.href)}catch{return null}})();
const releaseVersion=scriptUrl?.searchParams.get('v')||params.get('version')||'1.0.16';
const workerUrl=`/service-worker-v203.js?v=${encodeURIComponent(releaseVersion)}-lightweight-shell-v208&revision=release-coherence-v226`;
const routeUrl=`/app/system-routes-v227.js?v=${encodeURIComponent(releaseVersion)}-five-system-route-contract-v227`;
const installedDisplay=()=>navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);
const legacyEntry=/^\/app\/installed-entry-v146(?:\.html)?$/.test(location.pathname);
const explicitInstalled=params.get('installed')==='1'||legacyEntry;
const localDeveloper=()=>['localhost','127.0.0.1','::1'].includes(location.hostname)&&params.get('developer')==='1';
function authorize(){try{sessionStorage.setItem(BOOT_KEY,'1');sessionStorage.setItem(LEGACY_BOOT_KEY,'1')}catch{}}
async function refreshWorker(){
  if(!('serviceWorker'in navigator))return null;
  try{const registration=await navigator.serviceWorker.register(workerUrl,{scope:'/',updateViaCache:'none'});registration.update().catch(()=>{});return registration}catch{return null}
}
function ensureRoutes(){
  if(globalThis.CommonweaveSystemRoutesV227)return Promise.resolve(globalThis.CommonweaveSystemRoutesV227);
  return new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname==='/app/system-routes-v227.js');
    const ready=()=>globalThis.CommonweaveSystemRoutesV227?resolve(globalThis.CommonweaveSystemRoutesV227):reject(new Error('Route contract loaded without becoming ready.'));
    if(existing){existing.addEventListener('load',ready,{once:true});existing.addEventListener('error',()=>reject(new Error('Route contract failed to load.')),{once:true});return}
    const script=document.createElement('script');script.src=routeUrl;script.async=false;script.onload=ready;script.onerror=()=>reject(new Error('Route contract failed to load.'));document.head.append(script);
  });
}
async function boot(){
  refreshWorker().catch(()=>{});
  if(explicitInstalled||installedDisplay())authorize();
  const bootGranted=()=>{try{return sessionStorage.getItem(BOOT_KEY)==='1'||sessionStorage.getItem(LEGACY_BOOT_KEY)==='1'}catch{return explicitInstalled}};
  if(!installedDisplay()&&!bootGranted()&&!localDeveloper()){
    const installer=new URL('/',location.origin);installer.searchParams.set('install','required');location.replace(installer.href);return;
  }
  const requested=params.get('system')||params.get('target')||'commonweave';
  const aliases={hub:'commonweave',cabinet:'commonweave',cabinets:'commonweave',cabinetonly:'commonweave',lite:'commonweave'};
  const system=aliases[requested]||requested;
  try{
    const routes=await ensureRoutes();authorize();
    const destination=routes.urlFor(routes.routeFor(system)?system:'commonweave',{origin:location.origin,version:releaseVersion,source:'installed-entry',developer:localDeveloper()});
    location.replace(destination.href);
  }catch{
    const destination=new URL('/app/working-campus-v156.html',location.origin);destination.searchParams.set('installed','1');destination.searchParams.set('version',releaseVersion);destination.searchParams.set('navigation','five-system-route-contract-v227-fallback');location.replace(destination.href);
  }
}
boot();
})();
