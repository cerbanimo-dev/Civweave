'use strict';

const CW_GEMMA4_CURRENT_PHONE_SW_VERSION='gemma4-current-phone-worker-v2';
const CW_GEMMA4_STAGING_HOST='civweave-staging.pages.dev';
const CW_GEMMA4_RECOVERY_CACHE='cwrecovery-v457-gemma4-current-phone-owner';
const CW_GEMMA4_RECOVERY_MARKER='/__civweave/staging-gemma4-current-phone-owner-v2';
const CW_GEMMA4_CURRENT_PATHS=new Set([
  '/app/model-settings-controller-v173.js',
  '/app/local-ai/gemma4-dual-actions-v2.js',
  '/app/local-ai/gemma4-phone-performance-core-v1.js',
  '/app/local-ai/gemma4-litert-fast-extension-v1.js',
  '/app/local-ai/gemma4-browser-pack-coherence-v2.js',
  '/app/local-ai/gemma4-opfs-storage-v1.js',
  '/app/local-ai/gemma4-q2-retirement-v1.js',
  '/app/local-ai/browser-pack-download-v1.js',
  '/app/local-ai/browser-pack-import-worker-v2.js'
]);
const CW_GEMMA4_RETIRED_PRESENTATION_PATHS=new Map([
  ['/app/local-ai/gemma4-pack-extension-v1.js',`(()=>{'use strict';const VERSION='1.0.1-gemma4-pack-extension-v1-render-safe';if(globalThis.CivweaveGemma4PackExtensionV1?.version===VERSION)return;const passthrough=value=>value;globalThis.CivweaveGemma4PackExtensionV1=Object.freeze({version:VERSION,patchRegistry:passthrough,patchPackManager:passthrough,activate:()=>true,decorateSettings:()=>true,scheduleDecorate:()=>true,extensionStatus:async()=>({available:false}),extensionDownload:async()=>false,extensionRemove:async()=>false,completeCore:async()=>false,existingQ2Preserved:true,q2Optional:true,q4RequiredCore:false,fullReinstallRequired:false,renderLoopSafe:true,mutationObserver:false,presentationOwnership:false,retiredPresentation:true});})();`],
  ['/app/local-ai/gemma4-e4b-q4-extension-v1.js',`(()=>{'use strict';const VERSION='1.0.0-gemma4-e4b-q4-extension-v1';if(globalThis.CivweaveGemma4E4BQ4ExtensionV1?.version===VERSION)return;const passthrough=value=>value;globalThis.CivweaveGemma4E4BQ4ExtensionV1=Object.freeze({version:VERSION,patchRegistry:passthrough,patchPackManager:passthrough,activate:()=>true,decorateSettings:()=>true,scheduleDecorate:()=>true,completeCore:async()=>false,q4RequiredCore:false,q2Optional:true,textOnly:true,renderLoopSafe:true,mutationObserver:false,presentationOwnership:false,retiredPresentation:true});})();`],
  ['/app/local-ai/gemma4-dual-q4-actions-v1.js',`(()=>{'use strict';const VERSION='1.1.0-gemma4-dual-q4-actions-v1-retry-import';if(globalThis.CivweaveGemma4DualQ4ActionsV1?.version===VERSION)return;globalThis.CivweaveGemma4DualQ4ActionsV1=Object.freeze({version:VERSION,scheduleDecorate:()=>true,decorateSettings:()=>true,pendingSummary:()=>({receipt:null,missing:[],startedMissing:[],unstartedMissing:[],imported:0,total:0}),compatibilityOnly:true,presentationOwnership:false,mutationObserverGuarded:false,mutationObserver:false,q4PresentationRetired:true});})();`]
]);

function cwGemma4MarkerRequest(){return new Request(new URL(CW_GEMMA4_RECOVERY_MARKER,self.location.origin).href)}
async function cwGemma4RecoveryPending(){
  if(self.location.hostname!==CW_GEMMA4_STAGING_HOST)return false;
  try{return !(await(await caches.open(CW_GEMMA4_RECOVERY_CACHE)).match(cwGemma4MarkerRequest()))}catch{return true}
}
async function cwGemma4PurgeExecutablePaths(){
  const targets=new Set([...CW_GEMMA4_CURRENT_PATHS,...CW_GEMMA4_RETIRED_PRESENTATION_PATHS.keys()]);
  const names=await caches.keys();
  for(const name of names){
    const cache=await caches.open(name),requests=await cache.keys();
    for(const request of requests){
      let pathname='';try{pathname=new URL(request.url).pathname}catch{}
      if(targets.has(pathname))await cache.delete(request,{ignoreSearch:true});
    }
  }
}
async function cwGemma4ReloadAppClients(){
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of clients){
    try{
      const url=new URL(client.url);
      if(url.origin!==self.location.origin||!url.pathname.startsWith('/app/'))continue;
      await client.navigate(url.href);
    }catch{}
  }
}
function cwGemma4RetiredResponse(pathname){
  const body=CW_GEMMA4_RETIRED_PRESENTATION_PATHS.get(pathname);
  return body?new Response(body,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store','x-civweave-retired-presentation':'gemma4-q4'}}):null;
}
async function cwGemma4NetworkCurrent(request){
  const next=new Request(request,{cache:'no-store'}),response=await fetch(next);
  if(!response?.ok)throw new Error('Current Gemma code unavailable.');
  const type=String(response.headers.get('content-type')||'');
  if(/text\/html/i.test(type))throw new Error('Current Gemma code returned HTML.');
  return response;
}

if(self.location.hostname===CW_GEMMA4_STAGING_HOST){
  self.addEventListener('install',event=>{event.waitUntil((async()=>{if(await cwGemma4RecoveryPending())await self.skipWaiting()})())});
  self.addEventListener('activate',event=>{event.waitUntil((async()=>{
    const pending=await cwGemma4RecoveryPending();
    if(pending){
      await cwGemma4PurgeExecutablePaths();
      const cache=await caches.open(CW_GEMMA4_RECOVERY_CACHE);
      await cache.put(cwGemma4MarkerRequest(),new Response(CW_GEMMA4_CURRENT_PHONE_SW_VERSION,{headers:{'content-type':'text/plain','cache-control':'no-store'}}));
    }
    await self.clients.claim();
    if(pending)await cwGemma4ReloadAppClients();
  })())});
  self.addEventListener('fetch',event=>{
    const request=event.request;if(request.method!=='GET'&&request.method!=='HEAD')return;
    const url=new URL(request.url);if(url.origin!==self.location.origin)return;
    if(CW_GEMMA4_RETIRED_PRESENTATION_PATHS.has(url.pathname)){
      event.stopImmediatePropagation();
      event.respondWith(Promise.resolve(cwGemma4RetiredResponse(url.pathname)));
      return;
    }
    if(!CW_GEMMA4_CURRENT_PATHS.has(url.pathname))return;
    event.stopImmediatePropagation();
    event.respondWith(cwGemma4NetworkCurrent(request).catch(async()=>{
      const cached=await caches.match(request,{ignoreSearch:true});
      if(cached?.ok&&!/text\/html/i.test(String(cached.headers.get('content-type')||'')))return cached;
      return new Response(`Civweave current Gemma code unavailable: ${url.pathname}`,{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
    }));
  });
}

self.CivweaveGemma4CurrentPhoneWorkerV1=Object.freeze({
  version:CW_GEMMA4_CURRENT_PHONE_SW_VERSION,
  stagingHost:CW_GEMMA4_STAGING_HOST,
  currentPaths:Object.freeze([...CW_GEMMA4_CURRENT_PATHS]),
  retiredPresentationPaths:Object.freeze([...CW_GEMMA4_RETIRED_PRESENTATION_PATHS.keys()]),
  preservesDownloadedModels:true,
  preservesSavedModelState:true,
  purgesExecutablePathsOnly:true,
  retiredQ4PresentationNeutralized:true,
  currentCodeNetworkFirst:true,
  reloadsAppClientsOnce:true,
  recoveryMarker:CW_GEMMA4_RECOVERY_MARKER
});
