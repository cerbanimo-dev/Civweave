'use strict';
(()=>{
const VERSION='canonical-navbar-network-first-v5-direct-realm-actions';
const NAV_PATH='/app/themed-system-nav-v178.js';
const PATHS=Object.freeze([
  '/app/system-routes-v227.js',
  NAV_PATH,
  '/app/persistent-shell-actions-v1.js',
  '/app/subsystem-avatar-state-v347.js',
  '/app/shared-guide-surface-v236-core-v244.js',
  '/app/platform-experience-v160.css'
]);
const PATH_SET=new Set(PATHS);
const CACHE='cw-nav-canonical-v5';
const FETCH_TIMEOUT_MS=10000;
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
  const network=await fresh(request,path);
  if(network){
    if(request.method==='GET')await (await caches.open(CACHE)).put(path,network.clone());
    return request.method==='HEAD'?head(network):network;
  }
  const canonical=await ownCached(path);
  if(canonical)return request.method==='HEAD'?head(canonical):canonical;
  return unavailable(path,request.method);
}
async function warm(){
  const cache=await caches.open(CACHE);
  const missing=[];
  for(const path of PATHS){
    const request=new Request(new URL(path,self.location.origin).href,{cache:'no-store'});
    const network=await fresh(request,path);
    if(!network){missing.push(path);continue}
    await cache.put(path,network.clone());
  }
  if(missing.length)throw new Error(`Canonical navbar package incomplete: ${missing.join(', ')}`);
  return true;
}
self.addEventListener('install',event=>event.waitUntil(warm()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('cw-nav-canonical-')&&name!==CACHE).map(name=>caches.delete(name)));
})()));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(!['GET','HEAD'].includes(request.method))return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||!PATH_SET.has(url.pathname))return;
  event.stopImmediatePropagation();
  event.respondWith(responseFor(request,url.pathname));
});
self.CivweaveCanonicalNavbarV1=Object.freeze({version:VERSION,path:NAV_PATH,paths:[...PATHS],cache:CACHE,policy:'network-first-direct-system-pages-no-canonical-realm-click-interception',warm});
})();