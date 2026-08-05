'use strict';
(()=>{
const VERSION='living-school-image-runtime-v202';
if(self.CommonweaveCriticalBootV202)return;

const nativeAddEventListener=self.addEventListener;
const capturedInstallListeners=[];
const updating=Boolean(self.registration?.active);
const CRITICAL_CACHE='cwboot-critical-living-school-v202';
const BASE_CACHE='commonweave-static-1.0.6-direct-family-r45-memory-credential-v191-five-system-chat-r46-weaveling-memory-direct-software-r38-v106-device-package-r41-no-native-dialog-direct-entry-r45-memory-credential-v191';
const EXTENSION_CACHE='cwext-working-campus-additions-v197-assistant-runtime-package';
const BASE_EXPECTED_FILES=111;
const EXTENSION_EXPECTED_FILES=53;
const FETCH_TIMEOUT_MS=15000;
const BASE_SENTINELS=[
  '/index.html',
  '/app/installed-entry-v146.html',
  '/app/cabinets/living-school/living-school-cabinet-v151.mjs',
  '/app/services/fellowfare/app.js',
  '/app/anarchadia-console-v139.html'
];
const EXTENSION_SENTINELS=[
  '/app/fast-interactive-runtime-v192.js',
  '/app/context-plan-composer-v198.js',
  '/app/themed-system-nav-v178.js',
  '/app/cabinets/living-school/living-school-mutation-guard-v196.js',
  '/extensions/commonweave-additions-v156.js'
];
const CRITICAL_FILES=[
  '/app/cabinets/living-school/index.html',
  '/app/cabinets/living-school/living-school-cabinet-v151.css',
  '/app/cabinets/living-school/living-school-cabinet-v151.mjs',
  '/app/cabinets/living-school/living-school-bootstrap-v194.js',
  '/app/cabinets/living-school/living-school-visual-shell-v202.css',
  '/app/cabinets/living-school/living-school-visual-shell-v202.js',
  '/app/cabinets/living-school/living-school-enhancements-v202.js',
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
  '/app/themed-system-nav-v178.js',
  '/app/assets/navigation/200-commonweave-nav.webp',
  '/app/assets/navigation/200-cerbanimo-nav.webp',
  '/app/assets/navigation/200-living-school-nav.webp',
  '/app/assets/navigation/200-fellowfare-nav.webp',
  '/app/assets/navigation/200-anarchadia-nav.webp',
  '/app/assets/living-school/home.webp',
  '/app/assets/living-school/forge.webp',
  '/app/assets/living-school/library.webp',
  '/app/assets/living-school/moss.webp',
  '/app/assets/living-school/workshop.webp',
  '/app/assets/ai/moss.png',
  '/app/install-boundary-v146.js',
  '/app/local-first-policy-v131.js',
  '/app/platform-stability-v159.js',
  '/app/platform-stability-v159.css',
  '/app/platform-experience-v160.js',
  '/app/platform-experience-v160.css',
  '/app/model-settings-controller-v173.js',
  '/app/family-ai-loader-v105.js',
  '/app/family-shell-v104.js',
  '/app/family-shell-v104.css',
  '/app/system-interface-v157.css',
  '/app/local-rails-validator-v170.js',
  '/app/mobile-regression-v170.js',
  '/app/mobile-regression-v170.css',
  '/app/merlinites-semantic-planner-v164.js',
  '/app/pwa-v130.js',
  '/extensions/commonweave-antigravity-live-source-guard-v167.js'
];
const CRITICAL_PATHS=new Set(CRITICAL_FILES);
let finalized=false;

function mimeLooksWrong(response,pathname){
  const type=String(response.headers.get('content-type')||'');
  if(pathname.endsWith('.html'))return !/text\/html/i.test(type);
  if(/\.(?:js|mjs)$/.test(pathname))return /text\/html/i.test(type)||(!/javascript|ecmascript|text\/plain/i.test(type)&&Boolean(type));
  if(pathname.endsWith('.css'))return /text\/html/i.test(type)||(!/text\/css/i.test(type)&&Boolean(type));
  if(/\.(?:png|webp|jpe?g|svg)$/.test(pathname))return /text\/html/i.test(type);
  return false;
}

async function matchNamedCache(name,pathname){
  try{return await (await caches.open(name)).match(pathname,{ignoreSearch:true,ignoreMethod:true})}catch{return null}
}

async function cacheInventory(name){
  try{
    const keys=await (await caches.open(name)).keys();
    return{count:keys.length,paths:new Set(keys.map(request=>new URL(request.url).pathname))};
  }catch{return{count:0,paths:new Set()}}
}

async function fullPackageStatus(){
  const [base,extensions]=await Promise.all([cacheInventory(BASE_CACHE),cacheInventory(EXTENSION_CACHE)]);
  const baseReady=base.count>=BASE_EXPECTED_FILES&&BASE_SENTINELS.every(pathname=>base.paths.has(pathname));
  const extensionsReady=extensions.count>=EXTENSION_EXPECTED_FILES&&EXTENSION_SENTINELS.every(pathname=>extensions.paths.has(pathname));
  return{ready:baseReady&&extensionsReady,baseReady,extensionsReady,baseCount:base.count,extensionCount:extensions.count};
}

async function networkResponse(requestOrPath){
  const pathname=typeof requestOrPath==='string'?requestOrPath:new URL(requestOrPath.url).pathname;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{
    const headers=typeof requestOrPath==='string'?new Headers():new Headers(requestOrPath.headers);
    headers.set('x-commonweave-package','install');
    const target=typeof requestOrPath==='string'?requestOrPath:new Request(requestOrPath,{headers,cache:'no-store',signal:controller.signal});
    const response=typeof target==='string'
      ?await fetch(target,{cache:'no-store',headers,signal:controller.signal})
      :await fetch(target);
    if(!response.ok||mimeLooksWrong(response,pathname))return null;
    return response;
  }catch{return null}
  finally{clearTimeout(timer)}
}

async function warmOne(pathname,cache,preferNetwork){
  if(preferNetwork){
    const fresh=await networkResponse(pathname);
    if(fresh){await cache.put(pathname,fresh.clone());return true}
  }
  const fallback=await matchNamedCache(BASE_CACHE,pathname)||await matchNamedCache(EXTENSION_CACHE,pathname)||await caches.match(pathname,{ignoreSearch:true,ignoreMethod:true});
  if(fallback){await cache.put(pathname,fallback.clone());return true}
  if(!preferNetwork){
    const fresh=await networkResponse(pathname);
    if(fresh){await cache.put(pathname,fresh.clone());return true}
  }
  return false;
}

async function warmCritical(preferNetwork=false){
  const cache=await caches.open(CRITICAL_CACHE);
  let ready=0;
  for(let index=0;index<CRITICAL_FILES.length;index+=4){
    const batch=CRITICAL_FILES.slice(index,index+4);
    const results=await Promise.all(batch.map(pathname=>warmOne(pathname,cache,preferNetwork)));
    ready+=results.filter(Boolean).length;
  }
  if(ready<CRITICAL_FILES.length)throw new Error(`Critical Living School image package incomplete: ${ready}/${CRITICAL_FILES.length}`);
  return{ready,total:CRITICAL_FILES.length};
}

async function runCapturedInstallListeners(event){
  const waits=[];
  const installEvent=Object.create(event);
  Object.defineProperty(installEvent,'waitUntil',{value:promise=>waits.push(Promise.resolve(promise)),enumerable:false});
  for(const entry of capturedInstallListeners){
    try{entry.listener.call(self,installEvent)}catch(error){waits.push(Promise.reject(error))}
  }
  await Promise.all(waits);
  return waits.length;
}

function head(response){return new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers})}

async function criticalResponse(request){
  const pathname=new URL(request.url).pathname;
  const cache=await caches.open(CRITICAL_CACHE);
  let response=await cache.match(pathname,{ignoreSearch:true,ignoreMethod:true});
  if(!response)response=await matchNamedCache(BASE_CACHE,pathname)||await matchNamedCache(EXTENSION_CACHE,pathname);
  if(!response){
    response=await networkResponse(request);
    if(response&&request.method==='GET')await cache.put(pathname,response.clone());
  }
  if(!response)response=await caches.match(pathname,{ignoreSearch:true,ignoreMethod:true});
  if(!response)return new Response(`Critical Commonweave asset unavailable: ${pathname}`,{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-commonweave-critical-boot':VERSION}});
  return request.method==='HEAD'?head(response):response;
}

nativeAddEventListener.call(self,'fetch',event=>{
  const request=event.request;
  if(!['GET','HEAD'].includes(request.method))return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||!CRITICAL_PATHS.has(url.pathname))return;
  event.stopImmediatePropagation();
  event.respondWith(criticalResponse(request));
});

nativeAddEventListener.call(self,'activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('cwboot-critical-')&&name!==CRITICAL_CACHE).map(name=>caches.delete(name)));
})()));

self.addEventListener=function(type,listener,options){
  if(type==='install'){
    capturedInstallListeners.push({listener,options});
    return;
  }
  return nativeAddEventListener.call(self,type,listener,options);
};

function finalize(){
  if(finalized)return;
  finalized=true;
  self.addEventListener=nativeAddEventListener;
  nativeAddEventListener.call(self,'install',event=>event.waitUntil((async()=>{
    const before=await fullPackageStatus();
    if(before.ready){
      await warmCritical(true);
    }else{
      await runCapturedInstallListeners(event);
      const after=await fullPackageStatus();
      if(!after.ready)throw new Error(`Full Commonweave package incomplete after repair: base ${after.baseCount}/${BASE_EXPECTED_FILES}, additions ${after.extensionCount}/${EXTENSION_EXPECTED_FILES}`);
      await warmCritical(false);
    }
    await self.skipWaiting();
  })()));
  nativeAddEventListener.call(self,'message',event=>{
    if(event.data?.type!=='GET_CRITICAL_BOOT_STATUS')return;
    event.waitUntil((async()=>{
      const cache=await caches.open(CRITICAL_CACHE);
      const keys=await cache.keys();
      const present=new Set(keys.map(request=>new URL(request.url).pathname));
      const missing=CRITICAL_FILES.filter(pathname=>!present.has(pathname));
      const full=await fullPackageStatus();
      const packet={type:'COMMONWEAVE_CRITICAL_BOOT_STATUS',version:VERSION,updateInstall:updating,capturedInstallListeners:capturedInstallListeners.length,cache:CRITICAL_CACHE,ready:missing.length===0&&full.ready,present:CRITICAL_FILES.length-missing.length,total:CRITICAL_FILES.length,missing,fullPackage:full,imageRuntime:true,navigationImages:5,sceneImages:5};
      event.ports?.[0]?.postMessage(packet);
      event.source?.postMessage?.(packet);
    })());
  });
}

const api={version:VERSION,cache:CRITICAL_CACHE,paths:CRITICAL_FILES.slice(),updating,capturedInstallListeners,finalize,fullPackageStatus};
self.CommonweaveCriticalBootV199=api;
self.CommonweaveCriticalBootV200=api;
self.CommonweaveCriticalBootV201=api;
self.CommonweaveCriticalBootV202=api;
})();
