'use strict';
(()=>{
const REVISION='navigation-runtime-recovery-v4-family-shell-mixed-generation';
const RECOVERY_CACHE='cwrecovery-v447-navigation-runtime-family-shell';
const MARKER='/__civweave/navigation-runtime-recovery-v4';
const STALE_RUNTIME_PATHS=Object.freeze([
  '/app/system-routes-v227.js',
  '/app/themed-system-nav-v178.js',
  '/app/five-system-direct-navigation-v1.js',
  '/app/persistent-system-context-v1.js',
  '/app/persistent-system-shell-v1.js',
  '/app/persistent-shell-actions-v1.js',
  '/app/family-shell-v104.js',
  '/app/family-shell-v104.css',
  '/app/family-ai-loader-v105.js',
  '/app/platform-stability-v159.js',
  '/app/platform-stability-v159.css',
  '/app/mobile-regression-v170.css',
  '/app/merlinites-shell-fix-v166.css',
  '/app/subsystem-avatar-state-v347.js',
  '/app/platform-experience-v160.css',
  '/app/system-interface-v157.css',
  '/app/working-campus-v156.css',
  '/app/working-campus-v156.js',
  '/app/working-campus-home-declutter-v1.js',
  '/app/working-campus-home-relocation-v441.js',
  '/app/working-campus-topbar-v243.js',
  '/app/guild-symbol-v1.js',
  '/app/guide-chat-surface-v350.js',
  '/app/shared-guide-surface-v236.js',
  '/app/shared-guide-surface-v236-core-v244.js',
  '/app/install-boundary-v146.js'
]);
const STALE_PAGE_PATHS=Object.freeze([
  '/app/pwa-start-v436.html',
  '/app/persistent-system-shell-v1.html',
  '/app/working-campus-v156.html',
  '/app/working-campus-v440.html',
  '/app/cabinets/living-school/index.html',
  '/app/realm-console-v140.html',
  '/app/fellowfare-cabinet-v144.html',
  '/app/anarchadia-console-v139.html'
]);
function markerRequest(){return new Request(new URL(MARKER,self.location.origin).href)}
async function pending(){try{return !(await(await caches.open(RECOVERY_CACHE)).match(markerRequest()))}catch{return true}}
async function purgeStaleNavigationRuntime(){
  const names=await caches.keys();
  await Promise.all(names.map(async name=>{
    if(name===RECOVERY_CACHE)return;
    const cache=await caches.open(name);
    const paths=[...STALE_RUNTIME_PATHS,...STALE_PAGE_PATHS];
    await Promise.all(paths.map(path=>cache.delete(new Request(new URL(path,self.location.origin).href),{ignoreSearch:true}))).catch(()=>{});
  }));
}
self.addEventListener('install',event=>event.waitUntil((async()=>{if(await pending())await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  if(!(await pending()))return;
  await purgeStaleNavigationRuntime();
  await self.clients.claim();
  const cache=await caches.open(RECOVERY_CACHE);
  await cache.put(markerRequest(),new Response(REVISION,{headers:{'content-type':'text/plain','cache-control':'no-store'}}));
})()));
const api=Object.freeze({revision:REVISION,recoveryCache:RECOVERY_CACHE,staleRuntimePaths:[...STALE_RUNTIME_PATHS],stalePagePaths:[...STALE_PAGE_PATHS],policy:'one-shot-origin-local-static-shell-purge-never-delete-user-data-never-navigate-clients'});
self.CivweaveNavigationRuntimeRecoveryV1=api;
self.CivweaveStagingNavigationRuntimeRecoveryV1=api;
})();