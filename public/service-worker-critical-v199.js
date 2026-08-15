'use strict';
(()=>{
const VERSION='fellowfare-active-v203-parent-mobile-v205-cerbanimo-boundary-v204-memory-bridge-v205';
if(self.CivweaveCriticalBootV205)return;
const nativeAddEventListener=self.addEventListener;
const capturedInstallListeners=[];
const updating=Boolean(self.registration?.active);
const CRITICAL_CACHE='cwboot-critical-fellowfare-active-v203-parent-mobile-v205-cerbanimo-boundary-v204-memory-bridge-v205';
const BASE_CACHE='civweave-static-1.0.7-direct-family-r45-memory-credential-v191-five-system-chat-r46-weaveling-memory-direct-software-r38-v106-device-package-r41-no-native-dialog-direct-entry-r45-memory-credential-v191';
const EXTENSION_CACHE='cwext-working-campus-additions-v197-assistant-runtime-package';
const BASE_EXPECTED_FILES=111;
const EXTENSION_EXPECTED_FILES=53;
const FETCH_TIMEOUT_MS=12000;
const BASE_SENTINELS=['/index.html','/app/installed-entry-v146.html','/app/cabinets/living-school/living-school-cabinet-v151.mjs','/app/services/fellowfare/app.js','/app/anarchadia-console-v139.html'];
const EXTENSION_SENTINELS=['/app/fast-interactive-runtime-v192.js','/app/context-plan-composer-v198.js','/app/themed-system-nav-v178.js','/app/cabinets/living-school/living-school-mutation-guard-v196.js','/extensions/civweave-additions-v156.js'];
const CRITICAL_FILES=[
  '/app/cabinets/living-school/index.html',
  '/app/cabinets/living-school/living-school-cabinet-v151.css',
  '/app/cabinets/living-school/living-school-cabinet-v151.mjs',
  '/app/cabinets/living-school/living-school-bootstrap-v194.js',
  '/app/cabinets/living-school/living-school-flat-loader-v203.js',
  '/app/cabinets/living-school/living-school-two-agent-relay-v165.js',
  '/app/cabinets/living-school/living-school-mutation-guard-v196.js',
  '/app/cabinets/living-school/living-school-workbench-v158.css',
  '/app/cabinets/living-school/living-school-workbench-v158.js',
  '/app/cabinets/living-school/living-school-research-v162.js',
  '/app/cabinets/living-school/living-school-runtime-stability-v159.css',
  '/app/cabinets/living-school/living-school-runtime-stability-v159.js',
  '/app/cabinets/living-school/living-school-paths-v160.js',
  '/app/services/living-school/modules/rubric-engine.mjs',
  '/app/services/living-school/modules/project-gate.mjs',
  '/app/services/living-school/modules/cerbanimo-bridge.mjs',
  '/app/fellowfare-cabinet-v144.html',
  '/app/fellowfare-cabinet-v144.css',
  '/app/fellowfare-parent-theme-v205.css',
  '/app/fellowfare-mobile-flow-v205.js',
  '/app/services/fellowfare/cabinet-embed.css',
  '/app/themed-system-nav-v178.js',
  '/app/install-boundary-v146.js',
  '/app/core-interface-runtime-v1.js',
  '/app/settings-gateway-v317.js',
  '/app/local-first-policy-v131.js',
  '/app/platform-stability-v159.js','/app/platform-stability-v159.css',
  '/app/platform-experience-v160.js','/app/platform-experience-v160.css',
  '/app/model-settings-controller-v173.js',
  '/app/family-ai-loader-v105.js',
  '/app/fast-interactive-runtime-v192.js',
  '/app/weaveling-memory-bridge-v191.js',
  '/app/realm-console-v140.html',
  '/app/cerbanimo-deterministic-boundary-v203.js',
  '/app/family-shell-v104.js','/app/family-shell-v104.css',
  '/app/system-interface-v157.css',
  '/app/local-rails-validator-v170.js',
  '/app/mobile-regression-v170.js','/app/mobile-regression-v170.css',
  '/app/merlinites-semantic-planner-v164.js',
  '/app/pwa-v130.js',
  '/extensions/civweave-antigravity-live-source-guard-v167.js',
  '/app/assets/ai/moss-acorn.png',
  '/app/assets/ai/weaveling-compass.png',
  '/app/assets/navigation/200-civweave-nav.webp',
  '/app/assets/navigation/200-cerbanimo-nav.webp',
  '/app/assets/navigation/200-living-school-nav.webp',
  '/app/assets/navigation/200-fellowfare-nav.webp',
  '/app/assets/navigation/200-anarchadia-nav.webp'
];
const CRITICAL_PATHS=new Set(CRITICAL_FILES);
let finalized=false;
function wrongMime(response,pathname){
  const type=String(response?.headers?.get('content-type')||'');
  if(!response?.ok)return true;
  if(pathname.endsWith('.html'))return !/text\/html/i.test(type);
  if(/\.(?:js|mjs)$/.test(pathname))return /text\/html/i.test(type)||(!/javascript|ecmascript|text\/plain/i.test(type)&&Boolean(type));
  if(pathname.endsWith('.css'))return /text\/html/i.test(type)||(!/text\/css/i.test(type)&&Boolean(type));
  if(/\.(?:png|webp|jpe?g|gif|svg|avif)$/i.test(pathname))return !/^image\//i.test(type)&&!/svg\+xml/i.test(type);
  return false;
}
async function named(name,pathname){try{return await (await caches.open(name)).match(pathname,{ignoreSearch:true,ignoreMethod:true})}catch{return null}}
async function inventory(name){try{const keys=await (await caches.open(name)).keys();return{count:keys.length,paths:new Set(keys.map(request=>new URL(request.url).pathname))}}catch{return{count:0,paths:new Set()}}}
async function fullPackageStatus(){
  const [base,extensions]=await Promise.all([inventory(BASE_CACHE),inventory(EXTENSION_CACHE)]);
  const baseReady=base.count>=BASE_EXPECTED_FILES&&BASE_SENTINELS.every(path=>base.paths.has(path));
  const extensionsReady=extensions.count>=EXTENSION_EXPECTED_FILES&&EXTENSION_SENTINELS.every(path=>extensions.paths.has(path));
  return{ready:baseReady&&extensionsReady,baseReady,extensionsReady,baseCount:base.count,extensionCount:extensions.count};
}
async function network(requestOrPath){
  const pathname=typeof requestOrPath==='string'?requestOrPath:new URL(requestOrPath.url).pathname;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{
    const headers=typeof requestOrPath==='string'?new Headers():new Headers(requestOrPath.headers);headers.set('x-civweave-package','flat-core-repair');
    const target=typeof requestOrPath==='string'?requestOrPath:new Request(requestOrPath,{cache:'no-store',headers,signal:controller.signal});
    const response=typeof target==='string'?await fetch(target,{cache:'no-store',headers,signal:controller.signal}):await fetch(target);
    return wrongMime(response,pathname)?null:response;
  }catch{return null}finally{clearTimeout(timer)}
}
async function warmOne(pathname,cache,preferNetwork){
  if(preferNetwork){const fresh=await network(pathname);if(fresh){await cache.put(pathname,fresh.clone());return true}}
  const fallback=await named(BASE_CACHE,pathname)||await named(EXTENSION_CACHE,pathname)||await caches.match(pathname,{ignoreSearch:true,ignoreMethod:true});
  if(fallback&&!wrongMime(fallback,pathname)){await cache.put(pathname,fallback.clone());return true}
  if(!preferNetwork){const fresh=await network(pathname);if(fresh){await cache.put(pathname,fresh.clone());return true}}
  return false;
}
async function warmCritical(preferNetwork=false){
  const cache=await caches.open(CRITICAL_CACHE);let ready=0;
  for(let index=0;index<CRITICAL_FILES.length;index+=4){const batch=CRITICAL_FILES.slice(index,index+4),results=await Promise.all(batch.map(path=>warmOne(path,cache,preferNetwork)));ready+=results.filter(Boolean).length}
  if(ready<CRITICAL_FILES.length)throw new Error(`Flat Living School core incomplete: ${ready}/${CRITICAL_FILES.length}`);
  return{ready,total:CRITICAL_FILES.length};
}
async function runCaptured(event){
  const waits=[],installEvent=Object.create(event);
  Object.defineProperty(installEvent,'waitUntil',{value:promise=>waits.push(Promise.resolve(promise))});
  for(const entry of capturedInstallListeners){try{entry.listener.call(self,installEvent)}catch(error){waits.push(Promise.reject(error))}}
  await Promise.all(waits);return waits.length;
}
function head(response){return new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers})}
async function criticalResponse(request){
  const pathname=new URL(request.url).pathname,cache=await caches.open(CRITICAL_CACHE);
  let response=await cache.match(pathname,{ignoreSearch:true,ignoreMethod:true});
  if(!response||wrongMime(response,pathname))response=await network(request)||await named(BASE_CACHE,pathname)||await named(EXTENSION_CACHE,pathname)||await caches.match(pathname,{ignoreSearch:true,ignoreMethod:true});
  if(response&&!wrongMime(response,pathname)){if(request.method==='GET')await cache.put(pathname,response.clone());return request.method==='HEAD'?head(response):response}
  return new Response(`Flat Living School core asset unavailable: ${pathname}`,{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-civweave-critical-boot':VERSION}});
}
nativeAddEventListener.call(self,'fetch',event=>{
  const request=event.request;if(!['GET','HEAD'].includes(request.method))return;
  const url=new URL(request.url);if(url.origin!==self.location.origin||!CRITICAL_PATHS.has(url.pathname))return;
  event.stopImmediatePropagation();event.respondWith(criticalResponse(request));
});
nativeAddEventListener.call(self,'activate',event=>event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith('cwboot-critical-')&&name!==CRITICAL_CACHE).map(name=>caches.delete(name)))})()));
self.addEventListener=function(type,listener,options){if(type==='install'){capturedInstallListeners.push({listener,options});return}return nativeAddEventListener.call(self,type,listener,options)};
function finalize(){
  if(finalized)return;finalized=true;self.addEventListener=nativeAddEventListener;
  nativeAddEventListener.call(self,'install',event=>event.waitUntil((async()=>{
    const before=await fullPackageStatus();
    if(before.ready)await warmCritical(true);
    else{await runCaptured(event);const after=await fullPackageStatus();if(!after.ready)throw new Error(`Full package incomplete: core ${after.baseCount}/${BASE_EXPECTED_FILES}, shared ${after.extensionCount}/${EXTENSION_EXPECTED_FILES}`);await warmCritical(false)}
    await self.skipWaiting();
  })()));
  nativeAddEventListener.call(self,'message',event=>{
    if(event.data?.type!=='GET_CRITICAL_BOOT_STATUS')return;
    event.waitUntil((async()=>{const cache=await caches.open(CRITICAL_CACHE),keys=await cache.keys(),present=new Set(keys.map(request=>new URL(request.url).pathname)),missing=CRITICAL_FILES.filter(path=>!present.has(path)),full=await fullPackageStatus(),packet={type:'CIVWEAVE_CRITICAL_BOOT_STATUS',version:VERSION,mode:'flat',updateInstall:updating,capturedInstallListeners:capturedInstallListeners.length,cache:CRITICAL_CACHE,ready:missing.length===0&&full.ready,present:CRITICAL_FILES.length-missing.length,total:CRITICAL_FILES.length,missing,fullPackage:full};event.ports?.[0]?.postMessage(packet);event.source?.postMessage?.(packet)})());
  });
}
const api={version:VERSION,mode:'flat',cache:CRITICAL_CACHE,paths:CRITICAL_FILES.slice(),updating,capturedInstallListeners,finalize,fullPackageStatus};
self.CivweaveCriticalBootV199=api;self.CivweaveCriticalBootV200=api;self.CivweaveCriticalBootV201=api;self.CivweaveCriticalBootV202=api;self.CivweaveCriticalBootV203=api;self.CivweaveCriticalBootV204=api;self.CivweaveCriticalBootV205=api;
})();
