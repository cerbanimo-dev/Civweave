'use strict';
const VERSION='1.0.31';
const CACHE_REVISION='local-first-r20';
const STATIC_CACHE=`commonweave-static-${VERSION}-${CACHE_REVISION}`;
const RUNTIME_CACHE=`commonweave-runtime-${VERSION}-${CACHE_REVISION}`;
const MODEL_PREFIX='/app/models/';
const MODEL_GRAPH_PREFIX='/app/models/all-minilm-l6-v2/onnx/';
const ONNX_BACKEND_PREFIX='/app/vendor/transformers/wasm/';
const CORE=[
  '/loom/','/lite/',
  '/loom/realm/living-school/','/loom/realm/cerbanimo/','/loom/realm/fellowfare/','/loom/realm/anarchadia/',
  '/app/cabinet-visual-v141.html','/app/cabinet-visual-v141.css','/app/cabinet-visual-v141.js',
  '/app/realm-console-v140.html','/app/realm-console-v140.css','/app/realm-console-v140.js',
  '/app/anarchadia-console-v139.html','/app/anarchadia-console-v139.css','/app/anarchadia-console-v139.js',
  '/app/manifest.webmanifest','/app/local-first-policy-v131.js',
  '/app/loom-v128.css','/app/loom-v128.js','/app/realm-v128.js',
  '/app/weaveling-hologram-v133.css','/app/assistant-runtime-v138.js','/app/minilm-reflex-runtime-v138.js','/app/minilm-model-settings-v138.js','/app/intention-planner-v138.js','/app/intention-ui-v138.js','/app/intention-ui-v138.css',
  '/app/shared/commonweave-parity-runtime.js','/app/shared/commonweave-model-runtime.js','/app/shared/commonweave-parity-ledger.json','/app/shared/cabinet-shells-v129.json',
  '/app/model-settings-v133.css','/app/v130-cabinet-launcher.css','/app/v130-cabinet-launcher.js','/app/pwa-v130.css','/app/pwa-v130.js',
  '/app/lite-v129.html','/app/lite-v129-base.css','/app/lite-v129-components.css','/app/lite-v129-themes.css','/app/lite-source-v129.css','/app/lite-v129-core.js','/app/lite-v129-native.js','/app/lite-v129-app.js',
  '/app/cabinet-calibration-v131.css','/app/cabinet-calibration-v131.js','/app/model-settings-v131.css','/app/model-settings-v131.js',
  '/app/models/all-minilm-l6-v2/model-manifest.json','/app/models/all-minilm-l6-v2/adapter.js','/app/models/all-minilm-l6-v2/worker.js','/app/models/all-minilm-l6-v2/reflex-index.json',
  '/app/assets/cabinets/commonweave.webp','/app/assets/cabinets/living-school.webp','/app/assets/cabinets/cerbanimo.webp','/app/assets/cabinets/fellowfare.webp','/app/assets/cabinets/anarchadia.webp',
  '/app/assets/world/town-square-home.webp','/app/logos/commonweave.webp','/app/logos/commonweave-icon-192.png','/app/logos/commonweave-icon-512.png','/app/logos/commonweave-icon-maskable-192.png','/app/logos/commonweave-icon-maskable-512.png',
  '/app/assets/ai/weaveling.png','/app/assets/ai/moss.png','/app/assets/ai/kamiya.png','/app/assets/ai/rook.png','/app/assets/ai/merlin.png','/offline.html'
];
async function cacheOne(cache,url){try{const cached=await cache.match(url);if(cached)return true;const response=await fetch(url);if(response.ok)await cache.put(url,response.clone());return response.ok}catch{return false}}
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(STATIC_CACHE);await Promise.allSettled(CORE.map(url=>cacheOne(cache,url)))})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();const stale=keys.filter(key=>(key.startsWith('commonweave-')&&key!==STATIC_CACHE&&key!==RUNTIME_CACHE)||/^(living-school|cerbanimo|fellowfare|anarchadia)-/.test(key));await Promise.all(stale.map(key=>caches.delete(key)));await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();if(event.data?.type==='GET_VERSION')event.source?.postMessage?.({type:'COMMONWEAVE_VERSION',version:VERSION,revision:CACHE_REVISION})});
async function cacheFirst(request,fallback=''){const cached=await caches.match(request);if(cached)return cached;try{const response=await fetch(request);if(response.ok&&request.method==='GET'){const cache=await caches.open(RUNTIME_CACHE);await cache.put(request,response.clone())}return response}catch{return(fallback?await caches.match(fallback):null)||new Response('Offline',{status:503,headers:{'content-type':'text/plain'}})}}
async function staleWhileRevalidate(request){const cached=await caches.match(request);const update=fetch(request).then(async response=>{if(response.ok&&request.method==='GET'){const cache=await caches.open(RUNTIME_CACHE);await cache.put(request,response.clone())}return response}).catch(()=>null);return cached||await update||new Response('Offline',{status:503,headers:{'content-type':'text/plain'}})}
self.addEventListener('fetch',event=>{
  const request=event.request;if(!['GET','HEAD'].includes(request.method))return;
  const url=new URL(request.url);if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(request.mode==='navigate'){
    const fallback=url.pathname.startsWith('/lite')?'/lite/':url.pathname.includes('cabinet-visual')?'/app/cabinet-visual-v141.html':'/loom/';
    event.respondWith(cacheFirst(request,fallback).catch(()=>caches.match('/offline.html')));return;
  }
  if(url.pathname==='/service-worker.js'){event.respondWith(fetch(request,{cache:'no-store'}));return}
  if(url.pathname.startsWith(MODEL_GRAPH_PREFIX)||url.pathname.startsWith(ONNX_BACKEND_PREFIX)){event.respondWith(cacheFirst(request));return}
  if(url.pathname.startsWith(MODEL_PREFIX)){event.respondWith(cacheFirst(request));return}
  if(url.pathname==='/app/shared/commonweave-parity-ledger.json'||url.pathname==='/app/shared/cabinet-shells-v129.json'){event.respondWith(staleWhileRevalidate(request));return}
  if(url.pathname.startsWith('/app/')||url.pathname.startsWith('/downloads/'))event.respondWith(cacheFirst(request));
});
