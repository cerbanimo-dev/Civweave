'use strict';
const VERSION='1.0.30';
const CACHE_REVISION='minilm-runtime-r19';
const CABINET_REVISION='realm-cabinets-r18';
const STATIC_CACHE=`commonweave-static-${VERSION}-${CACHE_REVISION}-${CABINET_REVISION}`;
const RUNTIME_CACHE=`commonweave-runtime-${VERSION}-${CACHE_REVISION}-${CABINET_REVISION}`;
const CABINET_PREFIX='/app/assets/cabinets/';
const MODEL_PREFIX='/app/models/';
const MODEL_GRAPH_PREFIX='/app/models/all-minilm-l6-v2/onnx/';
const ONNX_BACKEND_PREFIX='/app/vendor/transformers/wasm/';
const CORE=[
  '/loom/','/lite/',
  '/loom/realm/living-school/','/loom/realm/cerbanimo/','/loom/realm/fellowfare/','/loom/realm/anarchadia/',
  '/app/manifest.webmanifest',
  '/app/loom-v128.css','/app/loom-v128.js','/app/realm-v128.js',
  '/app/weaveling-hologram-v133.css','/app/assistant-runtime-v138.js','/app/minilm-reflex-runtime-v138.js','/app/minilm-model-settings-v138.js','/app/intention-planner-v138.js','/app/intention-ui-v138.js','/app/intention-ui-v138.css',
  '/app/shared/commonweave-parity-runtime.js','/app/shared/commonweave-model-runtime.js',
  '/app/model-settings-v133.css',
  '/app/models/all-minilm-l6-v2/model-manifest.json','/app/models/all-minilm-l6-v2/adapter.js','/app/models/all-minilm-l6-v2/worker.js','/app/models/all-minilm-l6-v2/reflex-index.json',
  '/app/models/all-minilm-l6-v2/config.json','/app/models/all-minilm-l6-v2/tokenizer.json','/app/models/all-minilm-l6-v2/tokenizer_config.json','/app/models/all-minilm-l6-v2/special_tokens_map.json','/app/models/all-minilm-l6-v2/vocab.txt',
  '/app/vendor/transformers/transformers.min.js','/app/vendor/transformers/stage-manifest.json',
  '/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.mjs','/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.wasm',
  '/app/v130-cabinet-launcher.css','/app/v130-cabinet-launcher.js',
  '/app/realm-console-v140.html','/app/realm-console-v140.css','/app/realm-console-v140.js',
  '/app/anarchadia-console-v139.html','/app/anarchadia-console-v139.css','/app/anarchadia-console-v139.js',
  '/app/pwa-v130.css','/app/pwa-v130.js',
  '/app/lite-v129.html','/app/lite-v129-base.css','/app/lite-v129-components.css','/app/lite-v129-themes.css','/app/lite-source-v129.css',
  '/app/lite-v129-core.js','/app/lite-v129-native.js','/app/lite-v129-app.js',
  '/app/cabinet-calibration-v131.css','/app/cabinet-calibration-v131.js',
  '/app/model-settings-v131.css','/app/model-settings-v131.js',
  '/app/shared/commonweave-parity-ledger.json','/app/shared/cabinet-shells-v129.json',
  '/app/assets/cabinets/commonweave.webp','/app/assets/cabinets/living-school.webp','/app/assets/cabinets/cerbanimo.webp','/app/assets/cabinets/fellowfare.webp','/app/assets/cabinets/anarchadia.webp',
  '/app/assets/world/town-square-home.webp',
  '/app/logos/commonweave.webp','/app/logos/commonweave-icon-192.png','/app/logos/commonweave-icon-512.png','/app/logos/commonweave-icon-maskable-192.png','/app/logos/commonweave-icon-maskable-512.png','/app/logos/commonweave-icon-generation.json',
  '/app/assets/ai/weaveling.png','/app/assets/ai/moss.png','/app/assets/ai/kamiya.png','/app/assets/ai/rook.png','/app/assets/ai/merlin.png','/offline.html'
];
const report=async(kind,detail={})=>{try{await fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema:'commonweave.boot-log.v1',time:new Date().toISOString(),version:VERSION,build:'1.0.30-minilm-runtime-r19',kind:`service-worker:${kind}`,detail})})}catch{}};
async function cacheOne(cache,url){try{const response=await fetch(url,{cache:'reload'});if(response.ok)await cache.put(url,response.clone());return response.ok}catch{return false}}
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(STATIC_CACHE);const results=await Promise.all(CORE.map(url=>cacheOne(cache,url)));await report('installed',{cached:results.filter(Boolean).length,total:CORE.length,revision:CACHE_REVISION})})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();const stale=keys.filter(key=>(key.startsWith('commonweave-')&&key!==STATIC_CACHE&&key!==RUNTIME_CACHE)||/^(living-school|cerbanimo|fellowfare|anarchadia)-/.test(key));await Promise.all(stale.map(key=>caches.delete(key)));await self.clients.claim();await report('activated',{deleted:stale,revision:CACHE_REVISION})})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();if(event.data?.type==='GET_VERSION')event.source?.postMessage?.({type:'COMMONWEAVE_VERSION',version:VERSION,revision:CACHE_REVISION})});
async function networkFirst(request,fallback){const cache=await caches.open(RUNTIME_CACHE);try{const response=await Promise.race([fetch(request),new Promise((_,reject)=>setTimeout(()=>reject(new Error('network timeout')),3500))]);if(response?.ok&&request.method==='GET')await cache.put(request,response.clone());return response}catch{return(await cache.match(request))||(fallback?await caches.match(fallback):null)||new Response('Offline',{status:503,headers:{'content-type':'text/plain'}})}}
async function modelNetworkFirst(request){const cache=await caches.open(RUNTIME_CACHE),getRequest=request.method==='HEAD'?new Request(request.url,{method:'GET'}):request;try{const response=await fetch(request,{cache:'reload'});if(response?.ok&&request.method==='GET')await cache.put(getRequest,response.clone());return response}catch{const cached=await cache.match(getRequest)||await caches.match(getRequest);if(cached&&request.method==='HEAD')return new Response(null,{status:200,headers:cached.headers});return cached||new Response('MiniLM asset unavailable',{status:503,headers:{'content-type':'text/plain'}})}}
async function binaryStreamFirst(request){try{return await fetch(request,{cache:'reload'})}catch{const getRequest=new Request(request.url,{method:'GET'}),cached=await caches.match(getRequest);if(cached&&request.method==='HEAD')return new Response(null,{status:200,headers:cached.headers});return cached||new Response('MiniLM binary unavailable',{status:503,headers:{'content-type':'text/plain'}})}}
async function cacheFirst(request){const cached=await caches.match(request);if(cached)return cached;const response=await fetch(request);if(response.ok&&request.method==='GET'){const cache=await caches.open(RUNTIME_CACHE);await cache.put(request,response.clone())}return response}
self.addEventListener('fetch',event=>{const request=event.request;if(!['GET','HEAD'].includes(request.method))return;const url=new URL(request.url);if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;if(request.mode==='navigate'){if(url.pathname==='/'||url.pathname==='/index.html'){event.respondWith(networkFirst(request,'/'));return}const fallback=url.pathname.startsWith('/lite')?'/lite/':'/loom/';event.respondWith(cacheFirst(request).catch(()=>caches.match(fallback).then(r=>r||caches.match('/offline.html'))));return}if(url.pathname==='/service-worker.js'){event.respondWith(fetch(request,{cache:'no-store'}));return}if(url.pathname.startsWith(CABINET_PREFIX)){event.respondWith(networkFirst(new Request(request,{cache:'no-cache'})));return}if(url.pathname.startsWith(ONNX_BACKEND_PREFIX)||url.pathname.startsWith(MODEL_GRAPH_PREFIX)){event.respondWith(binaryStreamFirst(request));return}if(url.pathname.startsWith(MODEL_PREFIX)){const mutable=/\/(model-manifest\.json|adapter\.js|worker\.js|reflex-index\.json)$/.test(url.pathname);if(request.method==='HEAD'){event.respondWith(modelNetworkFirst(request));return}event.respondWith(mutable?modelNetworkFirst(request):cacheFirst(request));return}if(url.pathname.startsWith('/app/')||url.pathname.startsWith('/downloads/'))event.respondWith(cacheFirst(request))});
