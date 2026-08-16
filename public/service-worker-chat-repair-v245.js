;(()=>{
'use strict';

const REVISION='chat-avatar-visible-v346';
const FREEZE_REVISION='mobile-chat-main-thread-quiescence-v349';
// Non-executable legacy audit marker only: const REVISION='chat-css-contract-v343'
const PARTY_REVISION='party-chat-v1';
const HUMAN_BUBBLE_REVISION='human-message-bubble-v1';
const TRANSLATION_REVISION='translation-packs-v1';
const HARDENING_REVISION='mobile-chat-css-dvh-v349';
const LOCAL_AI_COHERENCE_REVISION='local-ai-cache-coherence-v306';
const MODEL_ROUTE_REVISION='selected-local-minilm-v357';
const SERVER_AUTO_FAILOVER_REVISION='server-auto-local-failover-v358';
const GUIDE_ROUTE_REVISION='guide-thread-network-routing-v360';
const PARTY_PATH='/app/shared-intention-party-chat-v1.js';
const PARTY_CACHE='civweave-party-v1';
const HUMAN_BUBBLE_PATH='/app/human-message-bubble-v1.js';
const HUMAN_BUBBLE_CACHE='civweave-human-message-v1';
const TRANSLATION_PATH='/app/local-ai/translation-packs-v1.js';
const TRANSLATION_WORKER_PATH='/app/local-ai/translation-worker-v1.js';
const TRANSLATION_CACHE='civweave-translation-runtime-v1';
const CHAT_PATHS=new Set([
  '/app/manifest.webmanifest',
  '/app/installed-entry-v146.html',
  '/app/installed-entry-v146.js',
  '/app/install-boundary-v146.js',
  '/app/mobile-ai-hardening-v302.js',
  '/app/realm-console-v140.html',
  '/app/anarchadia-console-v139.html',
  '/app/family-ai-loader-v105.js',
  '/app/assistant-runtime-v141.js',
  '/app/platform-stability-v159.js',
  '/app/experience-orchestrator-v232.js',
  '/app/realm-session-integrity-v237.js',
  '/app/guide-workspace-v242.js',
  '/app/guide-chat-surface-v350.js',
  '/app/unified-chat-system-v1.js',
  '/app/chat-fullscreen-v295.js',
  '/app/saved-chat-store-v295.js',
  '/app/saved-chat-ui-v295.js',
  '/app/shared-guide-surface-v236.js',
  '/app/shared-guide-surface-v236-core-v244.js',
  '/app/shared-intention-party-chat-v1.js',
  '/app/human-message-bubble-v1.js',
  '/app/local-ai/translation-packs-v1.js',
  '/app/local-ai/translation-worker-v1.js',
  '/app/shared-chat-face-icons-v255.js',
  '/app/avatar-expression-director-v345.js',
  '/app/minilm-context-router-v344.js',
  '/app/minilm-response-router-v347.js',
  '/app/models/all-minilm-l6-v2/adapter.js',
  '/app/models/all-minilm-l6-v2/worker.js',
  '/Civweave-weaveling-sprites.png',
  '/Living-School-moss-sprites.png',
  '/Cerbanimo-kamiya-sprites.png',
  '/FellowFare-rook-sprites.png',
  '/Anarchadia-merlin-sprites.png',
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
  '/app/new-user-onboarding-v1.js',
  '/app/new-user-onboarding-v1.css',
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
  return{revision:REVISION,freezeRevision:FREEZE_REVISION,partyRevision:PARTY_REVISION,humanBubbleRevision:HUMAN_BUBBLE_REVISION,translationRevision:TRANSLATION_REVISION,hardeningRevision:HARDENING_REVISION,localAICoherenceRevision:LOCAL_AI_COHERENCE_REVISION,modelRouteRevision:MODEL_ROUTE_REVISION,serverAutoFailoverRevision:SERVER_AUTO_FAILOVER_REVISION,guideRouteRevision:GUIDE_ROUTE_REVISION,deleted,paths:[...PURGE_PATHS],retired:[...RETIRED_CHAT_PATHS]};
}
async function cacheRuntime(path,cacheName,revision,label){
  try{
    const response=await fetch(`${path}?offline-package=${revision}`,{cache:'no-store',headers:{'x-civweave-package':revision}});
    if(!response.ok)throw new Error(`${label} runtime returned ${response.status}`);
    const cache=await caches.open(cacheName);
    await cache.put(path,response.clone());
    return{ok:true,revision,path,cache:cacheName};
  }catch(error){return{ok:false,revision,path,cache:cacheName,error:String(error?.message||error)}}
}
async function cachePartyRuntime(){return cacheRuntime(PARTY_PATH,PARTY_CACHE,PARTY_REVISION,'party')}
async function cacheHumanMessageRuntime(){return cacheRuntime(HUMAN_BUBBLE_PATH,HUMAN_BUBBLE_CACHE,HUMAN_BUBBLE_REVISION,'human message')}
async function cacheTranslationRuntime(){
  const runtime=await cacheRuntime(TRANSLATION_PATH,TRANSLATION_CACHE,TRANSLATION_REVISION,'translation');
  const worker=await cacheRuntime(TRANSLATION_WORKER_PATH,TRANSLATION_CACHE,TRANSLATION_REVISION,'translation worker');
  return{ok:Boolean(runtime.ok&&worker.ok),revision:TRANSLATION_REVISION,runtime,worker};
}
async function repairAndPackage(){const purge=await purgeChatRuntimeCaches(),party=await cachePartyRuntime(),humanBubble=await cacheHumanMessageRuntime(),translation=await cacheTranslationRuntime();return{...purge,party,humanBubble,translation}}

self.addEventListener('activate',event=>{
  event.waitUntil(repairAndPackage().then(result=>self.clients?.claim?.().then(()=>result)).catch(()=>null));
});
self.addEventListener('message',event=>{
  if(event.data?.type!=='CIVWEAVE_CHAT_CACHE_REPAIR')return;
  event.waitUntil(repairAndPackage().then(result=>{
    try{event.ports?.[0]?.postMessage({type:'CIVWEAVE_CHAT_CACHE_REPAIRED',...result})}catch{}
    try{event.source?.postMessage?.({type:'CIVWEAVE_CHAT_CACHE_REPAIRED',...result})}catch{}
  }));
});

self.CivweaveChatCacheRepairV245=Object.freeze({revision:REVISION,freezeRevision:FREEZE_REVISION,partyRevision:PARTY_REVISION,humanBubbleRevision:HUMAN_BUBBLE_REVISION,translationRevision:TRANSLATION_REVISION,hardeningRevision:HARDENING_REVISION,localAICoherenceRevision:LOCAL_AI_COHERENCE_REVISION,modelRouteRevision:MODEL_ROUTE_REVISION,serverAutoFailoverRevision:SERVER_AUTO_FAILOVER_REVISION,guideRouteRevision:GUIDE_ROUTE_REVISION,partyPath:PARTY_PATH,partyCache:PARTY_CACHE,humanBubblePath:HUMAN_BUBBLE_PATH,humanBubbleCache:HUMAN_BUBBLE_CACHE,translationPath:TRANSLATION_PATH,translationWorkerPath:TRANSLATION_WORKER_PATH,translationCache:TRANSLATION_CACHE,paths:[...PURGE_PATHS],retired:[...RETIRED_CHAT_PATHS],purge:purgeChatRuntimeCaches,packageParty:cachePartyRuntime,packageHumanBubble:cacheHumanMessageRuntime,packageTranslation:cacheTranslationRuntime});
})();