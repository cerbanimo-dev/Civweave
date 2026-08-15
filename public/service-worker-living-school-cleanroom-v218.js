'use strict';
(()=>{
const REVISION='living-school-cleanroom-v218-local-first';
const CANONICAL='/app/cabinets/living-school/index.html';
const FRESH_PREFIX='/app/cabinets/living-school/living-school-cleanroom-';
const GENERATION_GUARD='/app/living-school-generation-guard-v262.mjs';
const SAFE_POLICY='/app/safe-mode-v1.mjs';
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
    await Promise.all(keys.map(request=>RETIRED_PATHS.has(new URL(request.url).pathname)?cache.delete(request):false));
  }
}
async function localOnly(request){
  const cached=await caches.match(request,{ignoreSearch:true});
  if(cached)return request.method==='HEAD'?new Response(null,{status:cached.status,statusText:cached.statusText,headers:cached.headers}):cached;
  return new Response('Living School is not installed locally on this device yet.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-civweave-local-first':'package-required'}});
}
self.addEventListener('install',event=>event.waitUntil(evictRetired()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{await evictRetired();await self.clients.claim()})()));
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
    event.respondWith(localOnly(request));
    return;
  }
  if(RETIRED_PATHS.has(url.pathname)){
    event.stopImmediatePropagation();
    event.respondWith(Promise.resolve(retiredResponse(url.pathname)));
  }
});
self.CivweaveLivingSchoolCleanroomV218=Object.freeze({revision:REVISION,canonical:CANONICAL,generationGuard:GENERATION_GUARD,safePolicy:SAFE_POLICY,retired:[...RETIRED_PATHS],policy:'cache-only-runtime',runtimeNetworkFallback:false});
})();
