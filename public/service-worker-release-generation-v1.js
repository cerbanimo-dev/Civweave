'use strict';
(()=>{
const REVISION='release-generation-boundary-v2-bounded-network-20260915';
const CACHE='cw-live-runtime-release-generation-v2-20260915';
const CACHE_PREFIX='cw-live-runtime-release-generation-';
const TEXT_ASSET=/\.(?:html?|css|m?js|json|webmanifest|txt|md)$/i;
const OWNED_PREFIXES=Object.freeze(['/app/','/extensions/','/finder/']);
const NETWORK_TIMEOUT_MS=3200;
const WARM_TIMEOUT_MS=2500;
const WARM_CONCURRENCY=6;
const WARM_PATHS=Object.freeze([
  '/index.html',
  '/app/',
  '/app/pwa-start-v436.html',
  '/app/persistent-system-shell-v1.html',
  '/app/persistent-system-shell-v1.js',
  '/app/system-routes-v227.js',
  '/app/themed-system-nav-v178.js',
  '/app/five-system-direct-navigation-v1.js',
  '/app/persistent-system-context-v1.js',
  '/app/persistent-shell-actions-v1.js',
  '/app/subsystem-avatar-state-v347.js',
  '/app/platform-experience-v160.css',
  '/app/working-campus-v440.html',
  '/app/realm-console-v140.html',
  '/app/realm-console-v140.css',
  '/app/cerbanimo-quest-engine-v144.css',
  '/app/shared/civweave-parity-runtime.js',
  '/app/realm-console-v140.js',
  '/app/cerbanimo-quest-engine-v144.js',
  '/app/cerbanimo-quest-path-v266.js',
  '/app/cerbanimo-proof-attachments-v165.js',
  '/app/cerbanimo-video-task-contract-v1.mjs',
  '/app/cw-reward-ledger-v2.js',
  '/app/civweave-basic-value-v1.js',
  '/app/cw-reward-receivers-v2.js',
  '/app/civweave-basic-value-model-v1.js',
  '/app/fellowfare-cabinet-v144.html',
  '/app/anarchadia-console-v139.html',
  '/app/cabinets/living-school/index.html',
  '/finder/index.html',
  '/app/hub-map-v1.html',
  '/app/federation-finder-map-v275.html',
  '/app/civweave-hub-map-v1.js',
  '/app/civweave-guild-map-runtime-v2.js',
  '/app/civweave-map-service-v275.js',
  '/app/civweave-map-bootstrap-v1.js',
  '/app/civweave-map-mesh-v276.js',
  '/app/civweave-map-mesh-bridge-v276.js',
  '/app/civweave-map-coverage-v277.js',
  '/app/civweave-map-storage-v1.js',
  '/app/civweave-map-offline-v1.js',
  '/app/civweave-map-ui-v1.js'
]);
function cacheKey(pathname){return new Request(new URL(pathname,self.location.origin).href,{method:'GET'})}
function ownedRuntimePath(pathname){
  if(pathname==='/'||pathname==='/index.html'||pathname==='/offline.html')return true;
  return OWNED_PREFIXES.some(prefix=>pathname.startsWith(prefix))&&TEXT_ASSET.test(pathname);
}
function valid(response,pathname){
  if(!response?.ok)return false;
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(/\.html?$/i.test(pathname))return type.includes('text/html')||!type;
  if(/\.(?:m?js)$/i.test(pathname))return !type.includes('text/html');
  if(/\.css$/i.test(pathname))return !type.includes('text/html');
  return true;
}
function head(response){return new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers})}
async function boundedFetch(request,timeout=NETWORK_TIMEOUT_MS){
  const controller=typeof AbortController==='function'?new AbortController():null;
  let timer=0;
  try{
    if(controller)timer=setTimeout(()=>controller.abort(),timeout);
    return await fetch(new Request(request,{cache:'no-store',...(controller?{signal:controller.signal}:{})}));
  }finally{if(timer)clearTimeout(timer)}
}
async function network(request,pathname){
  try{
    const response=await boundedFetch(request,NETWORK_TIMEOUT_MS);
    if(!valid(response,pathname))return null;
    if(request.method==='GET')await(await caches.open(CACHE)).put(cacheKey(pathname),response.clone());
    return request.method==='HEAD'?head(response):response;
  }catch{return null}
}
async function freshCached(pathname,method){
  const response=await(await caches.open(CACHE)).match(cacheKey(pathname),{ignoreSearch:true});
  if(!valid(response,pathname))return null;
  return method==='HEAD'?head(response):response;
}
async function legacyFallback(pathname,method){
  const response=await caches.match(cacheKey(pathname),{ignoreSearch:true});
  if(!valid(response,pathname))return null;
  return method==='HEAD'?head(response):response;
}
async function responseFor(request,pathname){
  const live=await network(request,pathname);
  if(live)return live;
  const fresh=await freshCached(pathname,request.method);
  if(fresh)return fresh;
  const legacy=await legacyFallback(pathname,request.method);
  if(legacy)return legacy;
  return new Response('Civweave runtime asset is unavailable offline on this device.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-civweave-release-generation':REVISION}});
}
async function warmOne(cache,pathname){
  try{
    const request=new Request(new URL(pathname,self.location.origin).href,{cache:'no-store'});
    const response=await boundedFetch(request,WARM_TIMEOUT_MS);
    if(!valid(response,pathname))return null;
    await cache.put(cacheKey(pathname),response.clone());
    return pathname;
  }catch{return null}
}
async function warm(){
  const cache=await caches.open(CACHE),queue=[...WARM_PATHS],warmed=[];
  async function worker(){
    while(queue.length){
      const pathname=queue.shift();if(!pathname)continue;
      const result=await warmOne(cache,pathname);if(result)warmed.push(result);
    }
  }
  const count=Math.max(1,Math.min(WARM_CONCURRENCY,queue.length));
  await Promise.all(Array.from({length:count},()=>worker()));
  return warmed;
}
async function purgeStaleRuntimeEntries(){
  const names=await caches.keys();
  for(const name of names){
    if(name===CACHE)continue;
    if(name.startsWith(CACHE_PREFIX)){await caches.delete(name);continue;}
    const cache=await caches.open(name);
    const requests=await cache.keys();
    await Promise.all(requests.map(async request=>{
      let url;try{url=new URL(request.url)}catch{return}
      if(url.origin!==self.location.origin||!ownedRuntimePath(url.pathname))return;
      await cache.delete(request,{ignoreSearch:true});
    }));
  }
}
async function activationRepair(){
  await purgeStaleRuntimeEntries();
  await new Promise(resolve=>setTimeout(resolve,750));
  await purgeStaleRuntimeEntries();
  await self.clients.claim();
}
self.addEventListener('install',event=>event.waitUntil((async()=>{await warm().catch(()=>[]);await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil(activationRepair()));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(!['GET','HEAD'].includes(request.method))return;
  let url;try{url=new URL(request.url)}catch{return}
  if(url.origin!==self.location.origin)return;
  const pathname=url.pathname;
  if(request.mode!=='navigate'&&!ownedRuntimePath(pathname))return;
  if(request.mode==='navigate'&&!(pathname==='/'||pathname==='/index.html'||OWNED_PREFIXES.some(prefix=>pathname.startsWith(prefix))))return;
  event.stopImmediatePropagation();
  event.respondWith(responseFor(request,pathname));
});
self.CivweaveReleaseGenerationV1=Object.freeze({revision:REVISION,cache:CACHE,warmPaths:[...WARM_PATHS],networkTimeoutMs:NETWORK_TIMEOUT_MS,warmTimeoutMs:WARM_TIMEOUT_MS,warmConcurrency:WARM_CONCURRENCY,policy:'bounded-network-first-current-release-code-with-finite-concurrency-warm-cache-stale-runtime-purge-user-data-preserved'});
})();
