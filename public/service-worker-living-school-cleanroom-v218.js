'use strict';
(()=>{
const REVISION='living-school-cleanroom-v221-batched-safe-pack-authority';
const CANONICAL='/app/cabinets/living-school/index.html';
const FRESH_PREFIX='/app/cabinets/living-school/living-school-cleanroom-';
const GENERATION_GUARD='/app/living-school-generation-guard-v262.mjs';
const QUIZ_GUARD='/app/living-school-quiz-contract-guard-v263.mjs';
const VIDEO_GUARD='/app/living-school-video-generation-guard-v1.mjs';
const MEDIA_RECOMMENDER='/app/living-school-media-pack-recommender-v1.mjs';
const SAFE_POLICY='/app/safe-mode-v1.mjs';
const ROUTE_LOCK='/app/living-school-route-lock-v1.js';
const RUNTIME_ROUTE='/app/living-school-runtime-route-v2.js';
const GROUNDED_DESIGN='/app/living-school-grounded-design-v337.js';
const GENERATION_BUDGET='/app/living-school-generation-budget-v2.js';
const ACTIVE_RUN_UI='/app/living-school-active-run-ui-v1.js';
const GEMINI_ROUTER='/app/gemini-task-tier-router-v213.js';
const FRESH_RUNTIME_PATHS=new Set([GENERATION_GUARD,QUIZ_GUARD,VIDEO_GUARD,MEDIA_RECOMMENDER,SAFE_POLICY,ROUTE_LOCK,RUNTIME_ROUTE,GROUNDED_DESIGN,GENERATION_BUDGET,ACTIVE_RUN_UI,GEMINI_ROUTER]);
const SERVICE_PREFIX='/app/services/living-school/';
const RETIRED_PATHS=new Set([
  '/app/cabinets/living-school/living-school-bootstrap-v194.js',
  '/app/cabinets/living-school/living-school-cabinet-v151.mjs',
  '/app/cabinets/living-school/living-school-curriculum-launch-v212.js',
  '/app/cabinets/living-school/living-school-flat-loader-v203.js',
  '/app/cabinets/living-school/living-school-flat-loader-v211.js',
  '/app/cabinets/living-school/living-school-flat-loader-v212.js',
  '/app/cabinets/living-school/living-school-flat-loader-v213.js',
  '/app/cabinets/living-school/living-school-interactions-v213.js',
  '/app/cabinets/living-school/living-school-mutation-guard-v196.js',
  '/app/cabinets/living-school/living-school-paths-v160.js',
  '/app/cabinets/living-school/living-school-paths-v211.js',
  '/app/cabinets/living-school/living-school-paths-v213.js',
  '/app/cabinets/living-school/living-school-research-v162.js',
  '/app/cabinets/living-school/living-school-runtime-stability-v159.js',
  '/app/cabinets/living-school/living-school-two-agent-relay-v165.js',
  '/app/cabinets/living-school/living-school-workbench-v158.js'
]);
function retiredResponse(pathname){
  const module=pathname.endsWith('.mjs');
  const body=module
    ? "export const active=false;export const replacement='/app/cabinets/living-school/index.html';export default {active,replacement};\n"
    : "(()=>{'use strict';globalThis.LivingSchoolLegacyRemovedV218={active:false,replacement:'/app/cabinets/living-school/index.html'};})();\n";
  return new Response(body,{status:410,headers:{'content-type':module?'text/javascript; charset=utf-8':'application/javascript; charset=utf-8','cache-control':'no-store','x-civweave-living-school':REVISION}});
}
async function evictRetired(){
  const names=await caches.keys();
  for(const name of names){
    const cache=await caches.open(name);
    const keys=await cache.keys();
    await Promise.all(keys.map(request=>{
      const pathname=new URL(request.url).pathname;
      if(pathname===CANONICAL||FRESH_RUNTIME_PATHS.has(pathname)||pathname.startsWith(FRESH_PREFIX)||pathname.startsWith(SERVICE_PREFIX)||RETIRED_PATHS.has(pathname))return cache.delete(request);
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

// Clean-room routing is enforced on every relevant fetch. Scanning every cache
// during both install and activate made Living School cleanup a global PWA boot
// dependency. Keep lifecycle bounded; cleanup is now explicit/background work.
self.addEventListener('install',event=>event.waitUntil(Promise.resolve()));
self.addEventListener('activate',event=>{
  event.waitUntil(self.clients.claim());
  void evictRetired().catch(()=>null);
});
self.addEventListener('message',event=>{
  if(event.data?.type!=='CIVWEAVE_LIVING_SCHOOL_CLEANROOM_CLEANUP')return;
  event.waitUntil(evictRetired().then(()=>{
    const packet={type:'CIVWEAVE_LIVING_SCHOOL_CLEANROOM_CLEANED',revision:REVISION};
    try{event.ports?.[0]?.postMessage(packet)}catch{}
    try{event.source?.postMessage?.(packet)}catch{}
  }));
});
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
  if(url.pathname===CANONICAL||FRESH_RUNTIME_PATHS.has(url.pathname)||url.pathname.startsWith(FRESH_PREFIX)){
    event.stopImmediatePropagation();
    event.respondWith(fresh(request));
    return;
  }
  if(RETIRED_PATHS.has(url.pathname)){
    event.stopImmediatePropagation();
    event.respondWith(Promise.resolve(retiredResponse(url.pathname)));
  }
});
self.CivweaveLivingSchoolCleanroomV218=Object.freeze({revision:REVISION,canonical:CANONICAL,generationGuard:GENERATION_GUARD,quizGuard:QUIZ_GUARD,videoGuard:VIDEO_GUARD,mediaRecommender:MEDIA_RECOMMENDER,safePolicy:SAFE_POLICY,routeLock:ROUTE_LOCK,runtimeRoute:RUNTIME_ROUTE,groundedDesign:GROUNDED_DESIGN,generationBudget:GENERATION_BUDGET,activeRunUI:ACTIVE_RUN_UI,geminiRouter:GEMINI_ROUTER,retired:[...RETIRED_PATHS],lifecyclePolicy:'deferred-cache-scan',cleanupMessage:'CIVWEAVE_LIVING_SCHOOL_CLEANROOM_CLEANUP'});
})();
