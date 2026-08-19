'use strict';
(()=>{
const VERSION='canonical-navbar-network-first-v1';
const PATH='/app/themed-system-nav-v178.js';
const CACHE='cw-nav-canonical-v1';
const FETCH_TIMEOUT_MS=10000;
function valid(response){
  if(!response?.ok)return false;
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  return !type.includes('text/html');
}
function head(response){return new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers})}
async function fresh(request){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{
    const response=await fetch(new Request(request,{cache:'no-store',signal:controller.signal}));
    return valid(response)?response:null;
  }catch{return null}
  finally{clearTimeout(timer)}
}
async function cached(request){
  const own=await (await caches.open(CACHE)).match(PATH,{ignoreSearch:true,ignoreMethod:true});
  if(valid(own))return own;
  const any=await caches.match(PATH,{ignoreSearch:true,ignoreMethod:true});
  return valid(any)?any:null;
}
async function responseFor(request){
  const network=await fresh(request);
  if(network){
    if(request.method==='GET')await (await caches.open(CACHE)).put(PATH,network.clone());
    return request.method==='HEAD'?head(network):network;
  }
  const fallback=await cached(request);
  if(fallback)return request.method==='HEAD'?head(fallback):fallback;
  return new Response(request.method==='HEAD'?null:"throw new Error('Civweave canonical navigation is unavailable offline on this device.');",{status:503,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store','x-civweave-navbar':VERSION}});
}
async function warm(){
  const request=new Request(new URL(PATH,self.location.origin).href,{cache:'no-store'});
  const network=await fresh(request);
  if(!network)return false;
  await (await caches.open(CACHE)).put(PATH,network.clone());
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
  if(url.origin!==self.location.origin||url.pathname!==PATH)return;
  event.stopImmediatePropagation();
  event.respondWith(responseFor(request));
});
self.CivweaveCanonicalNavbarV1=Object.freeze({version:VERSION,path:PATH,cache:CACHE,policy:'network-first-exact-canonical-navbar-never-stale-shell-first',warm});
})();
