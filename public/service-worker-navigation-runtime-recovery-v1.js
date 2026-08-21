'use strict';
(()=>{
const REVISION='staging-navigation-runtime-recovery-v2-purge-only';
const STAGING_HOST='civweave-staging.pages.dev';
const RECOVERY_CACHE='cwrecovery-v445-navigation-runtime-purge-only';
const MARKER='/__civweave/staging-navigation-runtime-recovery-v2';
const STALE_RUNTIME_PATHS=Object.freeze([
  '/app/system-routes-v227.js',
  '/app/themed-system-nav-v178.js',
  '/app/persistent-system-context-v1.js',
  '/app/persistent-shell-actions-v1.js',
  '/app/install-boundary-v146.js'
]);
const STALE_PAGE_PATHS=Object.freeze([
  '/app/working-campus-v156.html',
  '/app/working-campus-v440.html',
  '/app/cabinets/living-school/index.html',
  '/app/realm-console-v140.html',
  '/app/fellowfare-cabinet-v144.html',
  '/app/anarchadia-console-v139.html'
]);
function markerRequest(){return new Request(new URL(MARKER,self.location.origin).href)}
async function pending(){if(self.location.hostname!==STAGING_HOST)return false;try{return !(await(await caches.open(RECOVERY_CACHE)).match(markerRequest()))}catch{return true}}
async function purgeStaleNavigationRuntime(){
  const names=await caches.keys();
  await Promise.all(names.map(async name=>{
    if(name===RECOVERY_CACHE||name==='cw-five-system-pages-v1')return;
    const cache=await caches.open(name);
    const paths=[...STALE_RUNTIME_PATHS,...STALE_PAGE_PATHS];
    await Promise.all(paths.map(path=>cache.delete(new Request(new URL(path,self.location.origin).href),{ignoreSearch:true}))).catch(()=>{});
  }));
}
if(self.location.hostname===STAGING_HOST){
  self.addEventListener('install',event=>event.waitUntil((async()=>{if(await pending())await self.skipWaiting()})()));
  self.addEventListener('activate',event=>event.waitUntil((async()=>{
    if(!(await pending()))return;
    await purgeStaleNavigationRuntime();
    await self.clients.claim();
    const cache=await caches.open(RECOVERY_CACHE);
    await cache.put(markerRequest(),new Response(REVISION,{headers:{'content-type':'text/plain','cache-control':'no-store'}}));
  })()));
}
self.CivweaveStagingNavigationRuntimeRecoveryV1=Object.freeze({revision:REVISION,stagingHost:STAGING_HOST,staleRuntimePaths:[...STALE_RUNTIME_PATHS],stalePagePaths:[...STALE_PAGE_PATHS],policy:'purge-stale-navigation-only-never-navigate-clients-never-redirect-pages'});
})();
