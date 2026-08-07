;(()=>{
'use strict';

const REVISION='chat-send-preventdefault-v249';
const CHAT_PATHS=new Set([
  '/app/persistent-guide-chat-v215.js',
  '/app/persistent-guide-viewport-v216.js',
  '/app/guide-workspace-v242.js',
  '/app/shared-guide-surface-v236.js',
  '/app/regression-fixes-v243.js',
  '/app/chat-single-owner-v245.js',
  '/app/working-campus-topbar-v243.js',
  '/app/working-campus-v156.css',
  '/app/working-campus-v156.html'
]);

async function purgeChatRuntimeCaches(){
  const names=await caches.keys();
  let deleted=0;
  for(const name of names){
    const cache=await caches.open(name),requests=await cache.keys();
    for(const request of requests){
      let pathname='';
      try{pathname=new URL(request.url).pathname}catch{}
      if(!CHAT_PATHS.has(pathname))continue;
      if(await cache.delete(request,{ignoreSearch:true}))deleted+=1;
    }
  }
  return{revision:REVISION,deleted,paths:[...CHAT_PATHS]};
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

self.CivweaveChatCacheRepairV245=Object.freeze({revision:REVISION,paths:[...CHAT_PATHS],purge:purgeChatRuntimeCaches});
})();