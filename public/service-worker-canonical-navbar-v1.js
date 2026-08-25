'use strict';
(()=>{
const VERSION='canonical-navbar-cache-first-v11-current-rail';
const NAV_PATH='/app/themed-system-nav-v178.js';
const DIRECT_NAV_PATH='/app/five-system-direct-navigation-v1.js';
const OUTPUT_NORMALIZER_PATH='/app/server-ai-output-normalizer-v1.js';
const MERLINITES_STYLE_PATH='/app/merlinites-shell-fix-v166.css';
const PATHS=Object.freeze([
  '/app/system-routes-v227.js',
  NAV_PATH,
  DIRECT_NAV_PATH,
  OUTPUT_NORMALIZER_PATH,
  MERLINITES_STYLE_PATH,
  '/app/persistent-shell-actions-v1.js',
  '/app/subsystem-avatar-state-v347.js',
  '/app/shared-guide-surface-v236-core-v244.js',
  '/app/platform-experience-v160.css'
]);
const PATH_SET=new Set(PATHS);
const CACHE='cw-nav-canonical-v11-current-rail';
const FETCH_TIMEOUT_MS=2500;
function valid(response,path){
  if(!response?.ok)return false;
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(path.endsWith('.css'))return !type.includes('text/html');
  if(path.endsWith('.js'))return !type.includes('text/html');
  return true;
}
function head(response){return new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers})}
async function fresh(request,path){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{
    const response=await fetch(new Request(request,{cache:'no-store',signal:controller.signal}));
    return valid(response,path)?response:null;
  }catch{return null}
  finally{clearTimeout(timer)}
}
async function ownCached(path){
  const response=await (await caches.open(CACHE)).match(path,{ignoreSearch:true,ignoreMethod:true});
  return valid(response,path)?response:null;
}
function unavailable(path,method){
  const css=path.endsWith('.css');
  const body=method==='HEAD'?null:css?'':"console.error('Civweave canonical navigation dependency is unavailable offline on this device.');";
  return new Response(body,{status:503,headers:{'content-type':css?'text/css; charset=utf-8':'application/javascript; charset=utf-8','cache-control':'no-store','x-civweave-navbar':VERSION,'x-civweave-navbar-path':path}});
}
async function responseFor(request,path){
  const canonical=await ownCached(path);
  if(canonical)return request.method==='HEAD'?head(canonical):canonical;
  const network=await fresh(request,path);
  if(network){
    if(request.method==='GET')await (await caches.open(CACHE)).put(path,network.clone());
    return request.method==='HEAD'?head(network):network;
  }
  return unavailable(path,request.method);
}
async function warm(){
  const cache=await caches.open(CACHE);
  const results=await Promise.all(PATHS.map(async path=>{
    const request=new Request(new URL(path,self.location.origin).href,{cache:'no-store'});
    const network=await fresh(request,path);
    if(!network)return{path,ok:false};
    await cache.put(path,network.clone());
    return{path,ok:true};
  }));
  return{refreshed:results.filter(row=>row.ok).map(row=>row.path),missing:results.filter(row=>!row.ok).map(row=>row.path)};
}
self.addEventListener('install',event=>event.waitUntil(warm().catch(()=>({refreshed:[],missing:[...PATHS]}))));
self.addEventListener('activate',event=>event.waitUntil(Promise.resolve()));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(!['GET','HEAD'].includes(request.method))return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||!PATH_SET.has(url.pathname))return;
  event.stopImmediatePropagation();
  event.respondWith(responseFor(request,url.pathname));
});
self.CivweaveCanonicalNavbarV1=Object.freeze({version:VERSION,path:NAV_PATH,directNavigationPath:DIRECT_NAV_PATH,outputNormalizerPath:OUTPUT_NORMALIZER_PATH,merlinitesStylePath:MERLINITES_STYLE_PATH,paths:[...PATHS],cache:CACHE,fetchTimeoutMs:FETCH_TIMEOUT_MS,policy:'cache-first-shared-five-system-rail-with-install-refresh',warm});
})();