;(()=>{
'use strict';

const REVISION='chat-convergence-v251-legacy-purge';
const CHAT_PATHS=new Set([
  '/app/manifest.webmanifest',
  '/app/installed-entry-v146.html',
  '/app/installed-entry-v146.js',
  '/app/install-boundary-v146.js',
  '/app/realm-console-v140.html',
  '/app/family-ai-loader-v105.js',
  '/app/platform-stability-v159.js',
  '/app/guide-workspace-v242.js',
  '/app/shared-guide-surface-v236.js',
  '/app/regression-fixes-v243.js',
  '/app/working-campus-v156.js',
  '/app/working-campus-v156.part1.txt',
  '/app/working-campus-v156.part2.txt',
  '/app/working-campus-v156.part3.txt',
  '/app/working-campus-v156.part4.txt',
  '/app/working-campus-v156.part5.txt',
  '/app/working-campus-topbar-v243.js',
  '/app/working-campus-v156.css',
  '/app/working-campus-v156.html'
]);
const RETIRED_CHAT_PATHS=new Set([
  '/app/guide-chat-v153.js',
  '/app/cabinet-home-v142.js',
  '/app/cabinet-home-v142.css',
  '/app/cabinet-surfaces-v143.js',
  '/app/cabinet-surfaces-v143.css',
  '/app/sharing-library-v143.js',
  '/app/persistent-guide-chat-v214.js',
  '/app/persistent-guide-chat-v215.js',
  '/app/persistent-guide-viewport-v216.js',
  '/app/chat-single-owner-v245.js'
]);
const PURGE_PATHS=new Set([...CHAT_PATHS,...RETIRED_CHAT_PATHS]);

async function purgeChatRuntimeCaches(){
  const names=await caches.keys();
  let deleted=0;
  for(const name of names){
    const cache=await caches.open(name),requests=await cache.keys();
    for(const request of requests){
      let pathname='';
      try{pathname=new URL(request.url).pathname}catch{}
      if(!PURGE_PATHS.has(pathname))continue;
      if(await cache.delete(request,{ignoreSearch:true}))deleted+=1;
    }
  }
  return{revision:REVISION,deleted,paths:[...PURGE_PATHS],retired:[...RETIRED_CHAT_PATHS]};
}

self.addEventListener('activate',event=>{
  event.waitUntil(purgeChatRuntimeCaches().then(result=>self.clients?.claim?.().then(()=>result)).catch(()=>null));
});
self.addEventListener('message',event=>{
  if(event.data?.type!=='CIVWEAVE_CHAT_CACHE_REPAIR')return;
  event.waitUntil(purgeChatRuntimeCaches().then(result=>{
    try{event.ports?.[0]?.postMessage({type:'CIVWEAVE_CHAT_CACHE_REPAIRED',...result})}catch{}
    try{event.source?.postMessage?.({type:'CIVWEAVE_CHAT_CACHE_REPAIRED',...result})}catch{}
  }));
});

self.CivweaveChatCacheRepairV245=Object.freeze({revision:REVISION,paths:[...PURGE_PATHS],retired:[...RETIRED_CHAT_PATHS],purge:purgeChatRuntimeCaches});
})();