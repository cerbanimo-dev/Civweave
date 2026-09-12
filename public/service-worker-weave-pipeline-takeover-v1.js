;(()=>{
'use strict';
const REVISION='weave-pipeline-takeover-v1-r2';
const STAGING_HOST='civweave-staging.pages.dev';
const CACHE='cwrecovery-v458-living-school-weave-rebind';
const MARKER='/__civweave/weave-pipeline-takeover-v1-r2';
const PURGE_PATHS=new Set([
  '/app/persistent-system-shell-v1.html',
  '/app/shared-guide-surface-v236.js',
  '/app/local-guide-control-bypass-v1.js',
  '/app/unified-chat-system-v1.js',
  '/app/guide-generation-tracker-v1.js',
  '/app/local-ai/gemma4-litert-request-authority-v1.js',
  '/app/local-ai/gemma4-structured-task-authority-v1.js',
  '/app/local-ai/gemma4-first-request-intake-bridge-v1.js',
  '/app/local-ai/gemma4-weave-draft-pipeline-v1.js'
]);
const RELOAD_PATHS=new Set([
  '/app/',
  '/app/index.html',
  '/app/pwa-start-v436.html',
  '/app/installed-entry-v146.html',
  '/app/persistent-system-shell-v1.html',
  '/app/working-campus-v440.html'
]);
function markerRequest(){return new Request(new URL(MARKER,self.location.origin).href)}
async function pending(){
  if(self.location.hostname!==STAGING_HOST)return false;
  try{return !(await (await caches.open(CACHE)).match(markerRequest()))}catch{return true}
}
async function purge(){
  for(const name of await caches.keys()){
    const cache=await caches.open(name);
    for(const request of await cache.keys()){
      let pathname='';
      try{pathname=new URL(request.url).pathname}catch{}
      if(PURGE_PATHS.has(pathname))await cache.delete(request,{ignoreSearch:true});
    }
  }
}
async function reloadControlledClients(){
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of clients){
    try{
      const url=new URL(client.url);
      if(url.origin!==self.location.origin||!RELOAD_PATHS.has(url.pathname))continue;
      await client.navigate(client.url);
    }catch{}
  }
}
if(self.location.hostname===STAGING_HOST){
  self.addEventListener('install',event=>{
    event.waitUntil((async()=>{if(await pending())await self.skipWaiting()})());
  });
  self.addEventListener('activate',event=>{
    event.waitUntil((async()=>{
      if(!(await pending()))return;
      await purge();
      await self.clients.claim();
      const cache=await caches.open(CACHE);
      await cache.put(markerRequest(),new Response(REVISION,{headers:{'content-type':'text/plain','cache-control':'no-store'}}));
      await reloadControlledClients();
    })());
  });
}
self.CivweaveWeavePipelineTakeoverV1=Object.freeze({revision:REVISION,purgePaths:[...PURGE_PATHS],reloadPaths:[...RELOAD_PATHS]});
})();