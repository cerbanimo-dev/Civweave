'use strict';
(()=>{
const REVISION='staging-navigation-runtime-recovery-v1';
const STAGING_HOST='civweave-staging.pages.dev';
const RECOVERY_CACHE='cwrecovery-v444-navigation-runtime-refresh';
const MARKER='/__civweave/staging-navigation-runtime-recovery-v1';
const SHELL='/app/working-campus-v156.html';
const FRESH_SHELL='/app/working-campus-v440.html';
const ROUTES=Object.freeze({
  civweave:SHELL,
  'living-school':'/app/cabinets/living-school/index.html',
  cerbanimo:'/app/realm-console-v140.html',
  fellowfare:'/app/fellowfare-cabinet-v144.html',
  anarchadia:'/app/anarchadia-console-v139.html'
});
const CANONICAL=new Set([...Object.values(ROUTES),FRESH_SHELL]);
const STALE_RUNTIME_PATHS=Object.freeze([
  '/app/system-routes-v227.js',
  '/app/themed-system-nav-v178.js',
  '/app/persistent-system-context-v1.js',
  '/app/persistent-shell-actions-v1.js',
  '/app/install-boundary-v146.js'
]);
function markerRequest(){return new Request(new URL(MARKER,self.location.origin).href)}
async function pending(){
  if(self.location.hostname!==STAGING_HOST)return false;
  try{return !(await (await caches.open(RECOVERY_CACHE)).match(markerRequest()))}catch{return true}
}
async function purgeStaleNavigationRuntime(){
  const names=await caches.keys();
  await Promise.all(names.map(async name=>{
    if(name===RECOVERY_CACHE||name==='cw-nav-canonical-v4')return;
    const cache=await caches.open(name);
    await Promise.all(STALE_RUNTIME_PATHS.map(path=>cache.delete(new Request(new URL(path,self.location.origin).href),{ignoreSearch:true}))).catch(()=>{});
  }));
}
function directTarget(url){
  if(url.pathname!==SHELL&&url.pathname!==FRESH_SHELL)return null;
  const requested=String(url.searchParams.get('context')||url.searchParams.get('system')||'').toLowerCase();
  if(!ROUTES[requested]||requested==='civweave')return null;
  const target=new URL(ROUTES[requested],self.location.origin);
  if(requested==='living-school'||requested==='fellowfare'||requested==='anarchadia')target.searchParams.set('cabinet','1');
  if(requested==='cerbanimo'){target.searchParams.set('system','cerbanimo');target.searchParams.set('cabinet','1')}
  for(const key of ['feature','weave','developer','lang','locale'])if(url.searchParams.has(key))target.searchParams.set(key,url.searchParams.get(key));
  target.searchParams.set('installed','1');
  target.searchParams.set('navigation',REVISION);
  target.searchParams.set('source','stale-single-shell-recovery');
  return target;
}
async function refreshCanonicalClients(){
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  await Promise.all(windows.map(async client=>{
    try{
      const url=new URL(client.url);
      if(url.origin!==self.location.origin||!CANONICAL.has(url.pathname))return;
      const target=directTarget(url)||new URL(url.href);
      target.searchParams.set('nav-runtime',REVISION);
      await client.navigate(target.href);
    }catch{}
  }));
}
if(self.location.hostname===STAGING_HOST){
  self.addEventListener('install',event=>event.waitUntil((async()=>{if(await pending())await self.skipWaiting()})()));
  self.addEventListener('activate',event=>event.waitUntil((async()=>{
    if(!(await pending()))return;
    await purgeStaleNavigationRuntime();
    await self.clients.claim();
    await refreshCanonicalClients();
    const cache=await caches.open(RECOVERY_CACHE);
    await cache.put(markerRequest(),new Response(REVISION,{headers:{'content-type':'text/plain','cache-control':'no-store'}}));
  })()));
}
self.addEventListener('fetch',event=>{
  if(self.location.hostname!==STAGING_HOST||event.request.mode!=='navigate')return;
  let url;try{url=new URL(event.request.url)}catch{return}
  if(url.origin!==self.location.origin)return;
  const target=directTarget(url);if(!target)return;
  event.stopImmediatePropagation();
  event.respondWith(Promise.resolve(Response.redirect(target.href,302)));
});
self.CivweaveStagingNavigationRuntimeRecoveryV1=Object.freeze({revision:REVISION,stagingHost:STAGING_HOST,staleRuntimePaths:[...STALE_RUNTIME_PATHS],routes:{...ROUTES},policy:'purge-stale-nav-runtime-refresh-canonical-clients-migrate-single-shell-context'});
})();
