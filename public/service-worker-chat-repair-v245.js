;(()=>{
'use strict';

const REVISION='chat-css-contract-v344-avatar-expression';
const HARDENING_REVISION='mobile-ai-hardening-v302';
const LOCAL_AI_COHERENCE_REVISION='local-ai-cache-coherence-v306';
const CHAT_PATHS=new Set([
  '/app/manifest.webmanifest',
  '/app/installed-entry-v146.html',
  '/app/installed-entry-v146.js',
  '/app/install-boundary-v146.js',
  '/app/mobile-ai-hardening-v302.js',
  '/app/realm-console-v140.html',
  '/app/family-ai-loader-v105.js',
  '/app/platform-stability-v159.js',
  '/app/guide-workspace-v242.js',
  '/app/shared-guide-surface-v236.js',
  '/app/shared-chat-face-icons-v255.js',
  '/app/avatar-expression-director-v313.js',
  '/app/assets/ai/chat/expressions/manifest-v313.json',
  '/app/assets/ai/chat/expressions/atlases/weaveling-expressions-v314.webp',
  '/app/assets/ai/chat/expressions/atlases/moss-expressions-v314.webp',
  '/app/assets/ai/chat/expressions/atlases/kamiya-expressions-v314.webp',
  '/app/assets/ai/chat/expressions/atlases/rook-expressions-v314.webp',
  '/app/assets/ai/chat/expressions/atlases/merlin-expressions-v314.webp',
  '/app/regression-fixes-v243.js',
  '/app/working-campus-v156.js',
  '/app/working-campus-v156.part1.txt',
  '/app/working-campus-v156.part2.txt',
  '/app/working-campus-v156.part3.txt',
  '/app/working-campus-v156.part4.txt',
  '/app/working-campus-v156.part5.txt',
  '/app/working-campus-topbar-v243.js',
  '/app/working-campus-v156.css',
  '/app/working-campus-v156.html',
  '/app/local-chat-runtime-v295.js',
  '/app/local-chat-owner-v295.js',
  '/app/ai-capability-broker-v268.js',
  '/app/fast-interactive-runtime-v192.js',
  '/app/local-ai/bootstrap-v266.js',
  '/app/local-ai/model-registry-v266.js',
  '/app/local-ai/download-manager-v267.js',
  '/app/local-ai/download-policy-v278.js',
  '/app/local-ai/metadata-repair-v276.js',
  '/app/local-ai/small-model-policy-v283.js',
  '/app/local-ai/runtime-v266.js',
  '/app/local-ai/runtime-bridge-v266.js',
  '/app/local-ai/settings-panel-v267.js',
  '/app/local-ai/primary-route-v283.js',
  '/app/local-ai/hardware-tier-ui-v278.js',
  '/app/local-ai/worker-v266.js',
  '/app/local-ai/test-pulse-v269.js'
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
  return{revision:REVISION,hardeningRevision:HARDENING_REVISION,localAICoherenceRevision:LOCAL_AI_COHERENCE_REVISION,deleted,paths:[...PURGE_PATHS],retired:[...RETIRED_CHAT_PATHS]};
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

self.CivweaveChatCacheRepairV245=Object.freeze({revision:REVISION,hardeningRevision:HARDENING_REVISION,localAICoherenceRevision:LOCAL_AI_COHERENCE_REVISION,paths:[...PURGE_PATHS],retired:[...RETIRED_CHAT_PATHS],purge:purgeChatRuntimeCaches});
})();
