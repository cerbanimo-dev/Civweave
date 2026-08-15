'use strict';
(()=>{
const CANONICAL='/app/cabinets/living-school/index.html';
const FRESH_PREFIX='/app/cabinets/living-school/living-school-cleanroom-';
const GENERATION_GUARD='/app/living-school-generation-guard-v262.mjs';
const SAFE_POLICY='/app/safe-mode-v1.mjs';
const SERVICE_PREFIX='/app/services/living-school/';

async function evictManaged(){
  const names=await caches.keys();
  for(const name of names){
    const cache=await caches.open(name);
    const keys=await cache.keys();
    await Promise.all(keys.map(request=>{
      const pathname=new URL(request.url).pathname;
      if(pathname===CANONICAL||pathname===GENERATION_GUARD||pathname===SAFE_POLICY||pathname.startsWith(FRESH_PREFIX)||pathname.startsWith(SERVICE_PREFIX))return cache.delete(request);
      return false;
    }));
  }
}
async function fresh(request){
  try{return await fetch(new Request(request,{cache:'no-store'}))}
  catch{
    const cached=await caches.match(request,{ignoreSearch:true});
    return cached||new Response('Living School is temporarily unavailable.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
  }
}
self.addEventListener('install',event=>event.waitUntil(evictManaged()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{await evictManaged();await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(!['GET','HEAD'].includes(request.method))return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'&&url.pathname.startsWith(SERVICE_PREFIX)){
    event.stopImmediatePropagation();
    event.respondWith(Response.redirect(new URL(CANONICAL,self.location.origin),302));
    return;
  }
  if(url.pathname===CANONICAL||url.pathname===GENERATION_GUARD||url.pathname===SAFE_POLICY||url.pathname.startsWith(FRESH_PREFIX)){
    event.stopImmediatePropagation();
    event.respondWith(fresh(request));
  }
});
self.CivweaveLivingSchoolCleanroom=Object.freeze({canonical:CANONICAL,generationGuard:GENERATION_GUARD,safePolicy:SAFE_POLICY});
})();
