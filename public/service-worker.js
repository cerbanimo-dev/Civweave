'use strict';
const VERSION='1.0.30';
const CACHE_REVISION='smollm2-contract-icon-r11';
const STATIC_CACHE=`commonweave-static-${VERSION}-${CACHE_REVISION}`;
const RUNTIME_CACHE=`commonweave-runtime-${VERSION}-${CACHE_REVISION}`;
const CABINET_PREFIX='/app/assets/cabinets/';
const MODEL_PREFIX='/app/models/';
const ONNX_BACKEND_PREFIX='/app/vendor/transformers/wasm/';
const CORE=[
  '/loom/','/lite/',
  '/loom/realm/living-school/','/loom/realm/cerbanimo/','/loom/realm/fellowfare/','/loom/realm/anarchadia/',
  '/app/manifest.webmanifest',
  '/app/loom-v128.css','/app/loom-v128.js','/app/realm-v128.js',
  '/app/weaveling-hologram-v133.css','/app/assistant-runtime-v133.js','/app/smollm2-fallback-runtime-v134.js','/app/smollm2-small-model-v136.js',
  '/app/shared/commonweave-parity-runtime.js','/app/shared/commonweave-model-runtime.js',
  '/app/model-settings-v133.css','/app/model-settings-v133.js','/app/lite-model-settings-v133.js',
  '/app/models/smollm2-360m-instruct/model-manifest.json','/app/models/smollm2-360m-instruct/adapter.js','/app/models/smollm2-360m-instruct/worker.js',
  '/app/models/smollm2-360m-instruct/config.json','/app/models/smollm2-360m-instruct/generation_config.json','/app/models/smollm2-360m-instruct/tokenizer_config.json','/app/models/smollm2-360m-instruct/special_tokens_map.json',
  '/app/vendor/transformers/transformers.min.js','/app/vendor/transformers/stage-manifest.json',
  '/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.mjs','/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.wasm',
  '/app/v130-cabinet-launcher.css','/app/v130-cabinet-launcher.js',
  '/app/pwa-v130.css','/app/pwa-v130.js',
  '/app/lite-v129.html','/app/lite-v129-base.css','/app/lite-v129-components.css','/app/lite-v129-themes.css','/app/lite-source-v129.css',
  '/app/lite-v129-core.js','/app/lite-v129-native.js','/app/lite-v129-app.js',
  '/app/cabinet-calibration-v131.css','/app/cabinet-calibration-v131.js',
  '/app/model-settings-v131.css','/app/model-settings-v131.js',
  '/app/shared/commonweave-parity-ledger.json',
  '/app/shared/cabinet-shells-v129.json',
  '/app/assets/cabinets/commonweave.webp','/app/assets/cabinets/living-school.webp','/app/assets/cabinets/cerbanimo.webp','/app/assets/cabinets/fellowfare.webp','/app/assets/cabinets/anarchadia.webp',
  '/app/assets/world/town-square-home.webp',
  '/app/logos/commonweave.webp','/app/logos/commonweave-icon-192.png','/app/logos/commonweave-icon-512.png','/app/logos/commonweave-icon-maskable-192.png','/app/logos/commonweave-icon-maskable-512.png','/app/logos/commonweave-icon-generation.json',
  '/app/assets/ai/weaveling.png','/app/assets/ai/moss.png','/app/assets/ai/kamiya.png','/app/assets/ai/rook.png','/app/assets/ai/merlin.png',
  '/offline.html'
];
const report=async(kind,detail={})=>{
  try{await fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema:'commonweave.boot-log.v1',time:new Date().toISOString(),version:VERSION,build:'1.0.30-smollm2-contract-icon-r11',kind:`service-worker:${kind}`,detail})})}catch{}
};
async function cacheOne(cache,url){
  try{const response=await fetch(url,{cache:'reload'});if(response.ok)await cache.put(url,response.clone());return response.ok}catch{return false}
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(STATIC_CACHE);
  const results=await Promise.all(CORE.map(url=>cacheOne(cache,url)));
  await report('installed',{cached:results.filter(Boolean).length,total:CORE.length,revision:CACHE_REVISION});
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  const stale=keys.filter(key=>(key.startsWith('commonweave-')&&key!==STATIC_CACHE&&key!==RUNTIME_CACHE)||/^(living-school|cerbanimo|fellowfare|anarchadia)-/.test(key));
  await Promise.all(stale.map(key=>caches.delete(key)));
  await self.clients.claim();
  await report('activated',{deleted:stale,revision:CACHE_REVISION});
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='GET_VERSION')event.source?.postMessage?.({type:'COMMONWEAVE_VERSION',version:VERSION,revision:CACHE_REVISION});
});
async function networkFirst(request,fallback){
  const cache=await caches.open(RUNTIME_CACHE);
  try{
    const response=await Promise.race([
      fetch(request),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('network timeout')),3500))
    ]);
    if(response?.ok&&request.method==='GET')await cache.put(request,response.clone());
    return response;
  }catch{
    return (await cache.match(request))||(fallback?await caches.match(fallback):null)||new Response('Offline',{status:503,headers:{'content-type':'text/plain'}});
  }
}
async function cacheFirst(request){
  const cached=await caches.match(request);
  if(cached)return cached;
  const response=await fetch(request);
  if(response.ok&&request.method==='GET'){const cache=await caches.open(RUNTIME_CACHE);await cache.put(request,response.clone())}
  return response;
}
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(!['GET','HEAD'].includes(request.method))return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/'))return;
  if(request.mode==='navigate'){
    if(url.pathname==='/'||url.pathname==='/index.html'){event.respondWith(networkFirst(request,'/'));return}
    const fallback=url.pathname.startsWith('/lite')?'/lite/':'/loom/';
    event.respondWith(cacheFirst(request).catch(()=>caches.match(fallback).then(r=>r||caches.match('/offline.html'))));
    return;
  }
  if(url.pathname==='/service-worker.js'){event.respondWith(fetch(request,{cache:'no-store'}));return}
  if(url.pathname.startsWith(CABINET_PREFIX)){
    const revalidatingRequest=new Request(request,{cache:'no-cache'});
    event.respondWith(networkFirst(revalidatingRequest));
    return;
  }
  if(url.pathname.startsWith(ONNX_BACKEND_PREFIX)){
    const exactRequest=new Request(request,{cache:'reload'});
    event.respondWith(networkFirst(exactRequest));
    return;
  }
  if(url.pathname.startsWith(MODEL_PREFIX)){
    const mutable=/\/(model-manifest\.json|adapter\.js|worker\.js)$/.test(url.pathname);
    if(request.method==='HEAD'){
      event.respondWith((async()=>{
        const cached=await caches.match(new Request(request.url,{method:'GET'}));
        if(cached)return new Response(null,{status:200,headers:cached.headers});
        return fetch(request,{cache:'no-cache'});
      })());
      return;
    }
    event.respondWith(mutable?networkFirst(new Request(request,{cache:'no-cache'})):cacheFirst(request));
    return;
  }
  if(url.pathname.startsWith('/app/')||url.pathname.startsWith('/downloads/'))event.respondWith(cacheFirst(request));
});
