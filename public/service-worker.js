'use strict';
const VERSION='1.0.4';
const CACHE_REVISION='instant-shell-r37';
const GUIDE_REVISION='lazy-five-system-chat-r37';
const CABINET_REVISION='direct-software-r35';
const DEVICE_REVISION='progressive-device-r37';
const CALIBRATION_REVISION='marketing-only-r1';
const INSTALL_REVISION='instant-entry-r37';
const LEDGER_HYDRATION_REVISION='direct-software-r35';
const STATIC_CACHE=`commonweave-static-${VERSION}-${CACHE_REVISION}-${GUIDE_REVISION}-${CABINET_REVISION}-${DEVICE_REVISION}-${INSTALL_REVISION}`;
const RUNTIME_CACHE=`commonweave-runtime-${VERSION}-${CACHE_REVISION}-${GUIDE_REVISION}-${CABINET_REVISION}-${DEVICE_REVISION}-${INSTALL_REVISION}`;
const MODEL_PREFIX='/app/models/';
const MODEL_GRAPH_PREFIX='/app/models/all-minilm-l6-v2/onnx/';
const ONNX_BACKEND_PREFIX='/app/vendor/transformers/wasm/';
const ARCHIVED_LOCATION_PREFIXES=['/app/services/living-school/visual-assets/','/app/services/cerbanimo/assets/visual/','/app/services/fellowfare/assets/mall/','/app/services/anarchadia/assets/screens/'];

const CORE=[
  '/index.html','/install-v130.css','/install-v130.js','/offline.html',
  '/app/manifest.webmanifest','/app/installed-entry-v146.html','/app/installed-entry-v146.js','/app/install-boundary-v146.js',
  '/app/fullscreen-family-v104.html','/app/working-campus-v156.html','/app/working-campus-v156.css','/app/working-campus-v156.js',
  '/app/working-campus-v156.part1.txt','/app/working-campus-v156.part2.txt','/app/working-campus-v156.part3.txt','/app/working-campus-v156.part4.txt','/app/working-campus-v156.part5.txt',
  '/app/logos/commonweave.webp','/app/logos/commonweave-icon-192.png','/app/logos/commonweave-icon-512.png','/app/logos/commonweave-icon-maskable-192.png','/app/logos/commonweave-icon-maskable-512.png',
  '/app/assets/ai/weaveling.png','/app/assets/ai/moss.png','/app/assets/ai/kamiya.png','/app/assets/ai/rook.png','/app/assets/ai/merlin.png'
];
const DEVICE_REQUIRED=[...CORE];
async function cacheRequired(cache,url){
  const response=await packageFetch(url,{cache:'reload'});
  if(!response.ok)throw new Error(`Device package asset ${url} returned ${response.status}`);
  await cache.put(url,response.clone());
  return true;
}

const APP_FILES=[
  ...CORE,
  '/app/local-object-mesh-v146.js','/app/local-first-policy-v131.js',
  '/app/family-shell-v104.css','/app/family-shell-v104.js','/app/family-ai-loader-v105.js',
  '/app/realm-console-v140.html','/app/realm-console-v140.css','/app/realm-console-v140.js','/app/cerbanimo-quest-engine-v144.css','/app/cerbanimo-quest-engine-v144.js','/app/cerbanimo-ai-validator-v156.js','/app/cabinet-home-v142.css','/app/cabinet-home-v142.js','/app/cabinet-surfaces-v143.css','/app/cabinet-surfaces-v143.js','/app/sharing-library-v143.js',
  '/app/cabinets/living-school/index.html','/app/cabinets/living-school/living-school-cabinet-v151.css','/app/cabinets/living-school/living-school-cabinet-v151.mjs','/app/services/living-school/modules/rubric-engine.mjs','/app/services/living-school/modules/project-gate.mjs','/app/services/living-school/modules/cerbanimo-bridge.mjs',
  '/app/fellowfare-cabinet-v144.html','/app/fellowfare-cabinet-v144.css','/app/fellowfare-cabinet-v144.js',
  '/app/anarchadia-console-v139.html','/app/anarchadia-console-v139.css','/app/anarchadia-console-v139.js','/app/anarchadia-cabinet-workbench-v144.js',
  '/app/anarchadia-governance-v145.html','/app/anarchadia-governance-v145.css','/app/anarchadia-governance-v145.js','/app/anarchadia-governance-kernel-v145.js','/app/anarchadia-governance-store-v145.js','/app/anarchadia-governance-bridge-v145.js',
  '/app/anarchadia-sovereignty-v146.html','/app/anarchadia-sovereignty-v146.css','/app/anarchadia-sovereignty-v146.js','/app/anarchadia-sovereignty-kernel-v146.js','/app/anarchadia-local-sovereignty-v146.js','/app/anarchadia-sovereignty-bridge-v146.js',
  '/app/guide-contracts-v141.js','/app/assistant-runtime-v141.js','/app/assistant-runtime-v141.css','/app/core-loop-v152.js','/app/guide-chat-v153.js','/app/capability-readiness-v154.js','/app/intention-planner-v141.js','/app/intention-ui-v138.js','/app/intention-ui-v138.css',
  '/app/minilm-reflex-runtime-v138.js','/app/minilm-model-settings-v138.js','/app/model-settings-v133.css','/app/shared/commonweave-parity-runtime.js','/app/shared/commonweave-model-runtime.js','/app/shared/commonweave-parity-ledger.json',
  '/app/services/anarchadia/workbench.html','/app/services/anarchadia/cabinet-workbench-v144.css','/app/services/anarchadia/cabinet-workbench-loader-v144.js','/app/services/anarchadia/styles.css','/app/services/anarchadia/src/app.js','/app/services/anarchadia/src/domain.js','/app/services/anarchadia/src/store.js','/app/services/anarchadia/src/export.js','/app/services/anarchadia/src/ai.js','/app/services/anarchadia/commonweave-handoff-consumer.js','/app/services/anarchadia/commonweave-presence.js','/app/services/anarchadia/docs/PROVISIONAL_CONSTITUTION.md',
  '/app/services/fellowfare/cabinet.html','/app/services/fellowfare/cabinet-embed.css','/app/services/fellowfare/cabinet-bridge.js','/app/services/fellowfare/styles.css','/app/services/fellowfare/app.js','/app/services/fellowfare/ai.js','/app/services/fellowfare/ledger.js','/app/services/fellowfare/shared/commonweave-model-runtime.js','/app/services/fellowfare/commonweave-handoff-consumer.js',
  '/app/logos/cerbanimo.webp','/app/logos/fellowfare-v2.webp'
];

const MODEL_FILES=[
  '/app/models/all-minilm-l6-v2/model-manifest.json','/app/models/all-minilm-l6-v2/adapter.js','/app/models/all-minilm-l6-v2/worker.js','/app/models/all-minilm-l6-v2/reflex-index.json','/app/models/all-minilm-l6-v2/config.json','/app/models/all-minilm-l6-v2/tokenizer.json','/app/models/all-minilm-l6-v2/tokenizer_config.json','/app/models/all-minilm-l6-v2/vocab.txt','/app/models/all-minilm-l6-v2/onnx/model_q4f16.onnx','/app/models/all-minilm-l6-v2/onnx/model_quantized.onnx',
  '/app/vendor/transformers/transformers.min.js','/app/vendor/transformers/stage-manifest.json','/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.mjs','/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.wasm'
];

const OPTIONAL_FILES=[...new Set([...CORE,...APP_FILES,...MODEL_FILES])];

async function packageFetch(pathname,{cache='no-cache'}={}){
  return fetch(pathname,{cache,headers:{'x-commonweave-package':'install'}});
}
async function cacheBatch(cache,urls,concurrency=6){
  const queue=[...new Set(urls)];
  let cursor=0;
  const workers=Array.from({length:Math.min(concurrency,queue.length)},async()=>{
    while(cursor<queue.length){
      const url=queue[cursor++];
      await cacheRequired(cache,url);
    }
  });
  await Promise.all(workers);
}
async function cachePresence(required){
  const keys=await Promise.all((await caches.keys()).filter(key=>key.startsWith('commonweave-')).map(key=>caches.open(key).then(cache=>cache.keys())));
  const present=new Set(keys.flat().map(request=>new URL(request.url).pathname));
  const missing=required.filter(url=>!present.has(url));
  return{present,missing};
}
async function packageStatus(){
  const shell=await cachePresence(DEVICE_REQUIRED);
  const optional=await cachePresence(OPTIONAL_FILES);
  return{
    type:'COMMONWEAVE_DEVICE_PACKAGE',
    ready:shell.missing.length===0,
    complete:optional.missing.length===0,
    version:VERSION,
    revision:INSTALL_REVISION,
    deviceRevision:DEVICE_REVISION,
    ledgerHydrationRevision:LEDGER_HYDRATION_REVISION,
    cache:STATIC_CACHE,
    assetCount:DEVICE_REQUIRED.length,
    presentCount:DEVICE_REQUIRED.length-shell.missing.length,
    optionalAssetCount:OPTIONAL_FILES.length,
    optionalPresentCount:OPTIONAL_FILES.length-optional.missing.length,
    missing:shell.missing,
    optionalMissing:optional.missing
  };
}
async function warmOptional(){
  const cache=await caches.open(RUNTIME_CACHE);
  const status=await packageStatus();
  if(status.optionalMissing.length)await cacheBatch(cache,status.optionalMissing,4);
  return packageStatus();
}
function reply(event,packet){
  event.ports?.[0]?.postMessage(packet);
  event.source?.postMessage?.(packet);
}

self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(STATIC_CACHE);
  try{
    await cacheBatch(cache,DEVICE_REQUIRED,6);
    await self.skipWaiting();
  }catch(error){
    await caches.delete(STATIC_CACHE);
    console.error('[Commonweave] Instant shell installation failed:',error);
    throw error;
  }
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await self.clients.claim();
  const keys=await caches.keys();
  const previousStatic=keys.filter(key=>key.startsWith('commonweave-static-')&&key!==STATIC_CACHE).at(-1);
  const previousRuntime=keys.filter(key=>key.startsWith('commonweave-runtime-')&&key!==RUNTIME_CACHE).at(-1);
  const retained=new Set([previousStatic,previousRuntime].filter(Boolean));
  const stale=keys.filter(key=>((key.startsWith('commonweave-')&&key!==STATIC_CACHE&&key!==RUNTIME_CACHE&&!retained.has(key))||/^(living-school|cerbanimo|fellowfare|anarchadia)-/.test(key)));
  await Promise.all(stale.map(key=>caches.delete(key)));
})()));

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='GET_VERSION'){
    reply(event,{type:'COMMONWEAVE_VERSION',version:VERSION,revision:`${CACHE_REVISION}-${GUIDE_REVISION}-${CABINET_REVISION}-${DEVICE_REVISION}-${INSTALL_REVISION}`,localFirstRevision:CACHE_REVISION,guideRevision:GUIDE_REVISION,cabinetRevision:CABINET_REVISION,deviceRevision:DEVICE_REVISION,calibrationRevision:CALIBRATION_REVISION,installRevision:INSTALL_REVISION,ledgerHydrationRevision:LEDGER_HYDRATION_REVISION});
  }
  if(event.data?.type==='GET_DEVICE_PACKAGE_STATUS'){
    event.waitUntil(packageStatus().then(packet=>reply(event,packet)));
  }
  if(event.data?.type==='PREFETCH_DEVICE_PACKAGE'){
    event.waitUntil(warmOptional().then(packet=>reply(event,packet)).catch(error=>reply(event,{type:'COMMONWEAVE_DEVICE_PACKAGE_ERROR',message:error.message||String(error)})));
  }
});

self.addEventListener('sync',event=>{
  if(event.tag==='commonweave-community-outbox')event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
    for(const client of clients)client.postMessage({type:'COMMONWEAVE_OUTBOX_SYNC_REQUESTED'});
    return true;
  }));
});

async function cachedResponse(requestOrUrl){
  return caches.match(requestOrUrl,{ignoreSearch:true,ignoreMethod:true});
}
async function refresh(request,cacheName=RUNTIME_CACHE){
  const url=new URL(request.url);
  const response=await packageFetch(url.pathname,{cache:'no-cache'});
  if(response.ok){
    const cache=await caches.open(cacheName);
    await cache.put(url.pathname,response.clone());
  }
  return response;
}
async function cacheFirst(request){
  const cached=await cachedResponse(request)||await cachedResponse(new URL(request.url).pathname);
  if(cached)return request.method==='HEAD'?new Response(null,{status:cached.status,statusText:cached.statusText,headers:cached.headers}):cached;
  const response=await refresh(request);
  if(request.method==='HEAD')return new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers});
  return response;
}
async function staleWhileRevalidate(event,request,fallback=''){
  const pathname=new URL(request.url).pathname;
  const cached=await cachedResponse(request)||await cachedResponse(pathname)||(fallback?await cachedResponse(fallback):null);
  const update=refresh(request).catch(error=>{
    console.warn(`[Commonweave] Background refresh failed for ${pathname}:`,error);
    return null;
  });
  if(cached){
    event.waitUntil(update);
    return request.method==='HEAD'?new Response(null,{status:cached.status,statusText:cached.statusText,headers:cached.headers}):cached;
  }
  const network=await update;
  if(network)return request.method==='HEAD'?new Response(null,{status:network.status,statusText:network.statusText,headers:network.headers}):network;
  if(fallback){
    const fallbackResponse=await cachedResponse(fallback);
    if(fallbackResponse)return fallbackResponse;
  }
  return new Response('This Commonweave surface is not cached yet and the package source is unavailable.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-commonweave-device-package':'temporarily-unavailable'}});
}
async function injectNavigationPolicy(response,pathname=''){
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return response;
  const text=await response.text(),scripts=[];
  if(!text.includes('/app/install-boundary-v146.js'))scripts.push('<script src="/app/install-boundary-v146.js?v=1.0.4"></script>');
  if(pathname.includes('anarchadia')&&!text.includes('/app/anarchadia-local-sovereignty-v146.js'))scripts.push('<script src="/app/anarchadia-local-sovereignty-v146.js?v=1.0.4"></script><script src="/app/anarchadia-sovereignty-bridge-v146.js?v=1.0.4"></script>');
  if(!scripts.length)return new Response(text,{status:response.status,statusText:response.statusText,headers:response.headers});
  const insertion=scripts.join('');
  const html=/<\/head>/i.test(text)?text.replace(/<\/head>/i,insertion+'</head>'):text.replace(/<\/body>/i,insertion+'</body>');
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('x-commonweave-install-boundary','v146');
  if(pathname.includes('anarchadia'))headers.set('x-commonweave-local-sovereignty','v146');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}
function navigationFallback(url){
  const pathname=url.pathname;
  if(pathname.includes('installed-entry-v146'))return'/app/installed-entry-v146.html';
  if(pathname.includes('fullscreen-family-v104'))return'/app/fullscreen-family-v104.html';
  if(pathname.includes('working-campus-v156'))return'/app/working-campus-v156.html';
  if(pathname.endsWith('/services/fellowfare/cabinet.html'))return'/app/services/fellowfare/cabinet.html';
  if(pathname.includes('fellowfare-cabinet'))return'/app/fellowfare-cabinet-v144.html';
  if(pathname.includes('/app/cabinets/living-school/'))return'/app/cabinets/living-school/index.html';
  if(pathname.includes('anarchadia-console'))return'/app/anarchadia-console-v139.html';
  if(pathname.includes('realm-console'))return'/app/realm-console-v140.html';
  if(pathname.includes('anarchadia-sovereignty'))return'/app/anarchadia-sovereignty-v146.html';
  if(pathname.includes('anarchadia-governance'))return'/app/anarchadia-governance-v145.html';
  if(pathname.includes('cabinet-mode')||pathname.includes('cabinet-only')||pathname.includes('cabinet-visual')||pathname.startsWith('/loom')||pathname.startsWith('/lite')||pathname.startsWith('/cabinetonly'))return'/app/fullscreen-family-v104.html';
  if(pathname.startsWith('/app/'))return pathname;
  return'';
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(!['GET','HEAD'].includes(request.method))return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/'))return;
  if(ARCHIVED_LOCATION_PREFIXES.some(prefix=>url.pathname.startsWith(prefix))){
    event.respondWith(Promise.resolve(new Response('Location scene is not included in the installed software package.',{status:410,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-commonweave-asset-status':'marketing-only'}})));
    return;
  }
  if(url.pathname==='/service-worker.js'||url.pathname==='/service-worker-v156.js'){
    event.respondWith(fetch(request,{cache:'no-store'}));
    return;
  }
  if(url.pathname==='/'||url.pathname==='/index.html'||url.pathname.startsWith('/downloads/'))return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>injectNavigationPolicy(await staleWhileRevalidate(event,request,navigationFallback(url)),url.pathname))());
    return;
  }
  if(url.pathname.startsWith(MODEL_GRAPH_PREFIX)||url.pathname.startsWith(ONNX_BACKEND_PREFIX)||url.pathname.startsWith(MODEL_PREFIX)){
    event.respondWith(cacheFirst(request));
    return;
  }
  if(url.pathname.startsWith('/app/')||url.pathname.startsWith('/loom/')||url.pathname.startsWith('/lite/')||url.pathname.startsWith('/cabinetonly/')||url.pathname==='/offline.html'){
    event.respondWith(staleWhileRevalidate(event,request));
  }
});
