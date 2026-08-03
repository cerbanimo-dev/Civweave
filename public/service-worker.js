'use strict';
const VERSION='1.0.31';
const CACHE_REVISION='cabinet-mode-r22';
const GUIDE_REVISION='guide-orchestration-r21';
const CABINET_REVISION='cabinet-home-r22';
const DEVICE_REVISION='device-package-r23';
const STATIC_CACHE=`commonweave-static-${VERSION}-${CACHE_REVISION}-${GUIDE_REVISION}-${CABINET_REVISION}-${DEVICE_REVISION}`;
const RUNTIME_CACHE=`commonweave-runtime-${VERSION}-${CACHE_REVISION}-${GUIDE_REVISION}-${CABINET_REVISION}-${DEVICE_REVISION}`;
const MODEL_PREFIX='/app/models/';
const MODEL_GRAPH_PREFIX='/app/models/all-minilm-l6-v2/onnx/';
const ONNX_BACKEND_PREFIX='/app/vendor/transformers/wasm/';
const ARCHIVED_LOCATION_PREFIXES=[
  '/app/services/living-school/visual-assets/',
  '/app/services/cerbanimo/assets/visual/',
  '/app/services/fellowfare/assets/mall/',
  '/app/services/anarchadia/assets/screens/'
];
const CORE=[
  '/loom/','/lite/','/offline.html',
  '/app/cabinet-mode-v142.html','/app/cabinet-mode-v142.css','/app/cabinet-mode-v142.js','/app/cabinet-runtime-v143.css',
  '/app/cabinet-visual-v141.html',
  '/app/realm-console-v140.html','/app/realm-console-v140.css','/app/realm-console-v140.js',
  '/app/anarchadia-console-v139.html','/app/anarchadia-console-v139.css','/app/anarchadia-console-v139.js',
  '/app/cabinet-home-v142.css','/app/cabinet-home-v142.js','/app/cabinet-surfaces-v143.css','/app/cabinet-surfaces-v143.js','/app/sharing-library-v143.js',
  '/app/manifest.webmanifest','/app/local-first-policy-v131.js',
  '/app/loom-v128.css','/app/loom-v141.js','/app/hub-runtime-v143.css','/app/hub-runtime-v143.js',
  '/app/weaveling-hologram-v133.css','/app/guide-contracts-v141.js','/app/assistant-runtime-v141.js','/app/assistant-runtime-v141.css','/app/minilm-reflex-runtime-v138.js','/app/minilm-model-settings-v138.js','/app/intention-planner-v141.js','/app/intention-ui-v138.js','/app/intention-ui-v138.css',
  '/app/shared/commonweave-parity-runtime.js','/app/shared/commonweave-model-runtime.js','/app/shared/commonweave-parity-ledger.json','/app/shared/cabinet-shells-v129.json',
  '/app/model-settings-v133.css','/app/v130-cabinet-launcher.css','/app/v130-cabinet-launcher.js','/app/pwa-v130.css','/app/pwa-v130.js',
  '/app/lite-v129.html','/app/lite-v129-base.css','/app/lite-v129-components.css','/app/lite-v129-themes.css','/app/lite-source-v129.css','/app/lite-v129-core.js','/app/lite-v129-native.js','/app/lite-v129-app.js',
  '/app/cabinet-calibration-v131.css','/app/cabinet-calibration-v131.js','/app/model-settings-v131.css','/app/model-settings-v131.js',
  '/app/assets/cabinets/commonweave.webp','/app/assets/cabinets/living-school.webp','/app/assets/cabinets/cerbanimo.webp','/app/assets/cabinets/fellowfare.webp','/app/assets/cabinets/anarchadia.webp',
  '/app/assets/world/town-square-home.webp','/app/logos/commonweave.webp','/app/logos/commonweave-icon-192.png','/app/logos/commonweave-icon-512.png','/app/logos/commonweave-icon-maskable-192.png','/app/logos/commonweave-icon-maskable-512.png',
  '/app/assets/ai/weaveling.png','/app/assets/ai/moss.png','/app/assets/ai/kamiya.png','/app/assets/ai/rook.png','/app/assets/ai/merlin.png',
  '/app/assets/generated/commonweave-navigation-icons/weaveling-compass.png','/app/assets/generated/commonweave-navigation-icons/commonweave-realms.png','/app/assets/generated/commonweave-navigation-icons/commonweave-ai-config.png','/app/assets/generated/commonweave-navigation-icons/commonweave-home.png','/app/assets/generated/commonweave-navigation-icons/commonweave-route.png'
];
const DEVICE_REQUIRED=[
  ...CORE,
  '/app/models/all-minilm-l6-v2/model-manifest.json','/app/models/all-minilm-l6-v2/adapter.js','/app/models/all-minilm-l6-v2/worker.js','/app/models/all-minilm-l6-v2/reflex-index.json',
  '/app/models/all-minilm-l6-v2/config.json','/app/models/all-minilm-l6-v2/tokenizer.json','/app/models/all-minilm-l6-v2/tokenizer_config.json','/app/models/all-minilm-l6-v2/vocab.txt',
  '/app/models/all-minilm-l6-v2/onnx/model_q4f16.onnx','/app/models/all-minilm-l6-v2/onnx/model_quantized.onnx',
  '/app/vendor/transformers/transformers.min.js','/app/vendor/transformers/stage-manifest.json','/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.mjs','/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.wasm'
];
async function cacheRequired(cache,url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`Device package asset ${url} returned ${response.status}`);await cache.put(url,response.clone());return true}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(STATIC_CACHE);
  await Promise.all([...new Set(DEVICE_REQUIRED)].map(url=>cacheRequired(cache,url)));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();const stale=keys.filter(key=>(key.startsWith('commonweave-')&&key!==STATIC_CACHE&&key!==RUNTIME_CACHE)||/^(living-school|cerbanimo|fellowfare|anarchadia)-/.test(key));await Promise.all(stale.map(key=>caches.delete(key)));await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();if(event.data?.type==='GET_VERSION')event.source?.postMessage?.({type:'COMMONWEAVE_VERSION',version:VERSION,revision:`${CACHE_REVISION}-${GUIDE_REVISION}-${CABINET_REVISION}-${DEVICE_REVISION}`,localFirstRevision:CACHE_REVISION,guideRevision:GUIDE_REVISION,cabinetRevision:CABINET_REVISION,deviceRevision:DEVICE_REVISION})});
async function cachedResponse(requestOrUrl){return caches.match(requestOrUrl,{ignoreSearch:true,ignoreMethod:true})}
async function deviceOnly(request,fallback=''){
  const cached=await cachedResponse(request)||await cachedResponse(new URL(request.url).pathname)||(fallback?await cachedResponse(fallback):null);
  if(!cached)return new Response('This asset is missing from the installed Commonweave device package.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-commonweave-device-package':'missing'}});
  if(request.method==='HEAD')return new Response(null,{status:cached.status,statusText:cached.statusText,headers:cached.headers});
  return cached;
}
self.addEventListener('fetch',event=>{
  const request=event.request;if(!['GET','HEAD'].includes(request.method))return;
  const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/'))return;
  if(ARCHIVED_LOCATION_PREFIXES.some(prefix=>url.pathname.startsWith(prefix))){event.respondWith(Promise.resolve(new Response('Location scene archived from this Cabinet Mode release',{status:410,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-commonweave-asset-status':'archived'}})));return}
  if(url.pathname==='/service-worker.js'){event.respondWith(fetch(request,{cache:'no-store'}));return}
  if(url.pathname.startsWith('/downloads/'))return;
  if(request.mode==='navigate'){
    const cabinetPath=url.pathname.includes('cabinet-mode')||url.pathname.includes('cabinet-visual');
    const fallback=url.pathname.startsWith('/lite')?'/lite/':cabinetPath?'/app/cabinet-mode-v142.html':'/loom/';
    event.respondWith(deviceOnly(request,fallback));return;
  }
  if(url.pathname.startsWith(MODEL_GRAPH_PREFIX)||url.pathname.startsWith(ONNX_BACKEND_PREFIX)||url.pathname.startsWith(MODEL_PREFIX)){event.respondWith(deviceOnly(request));return}
  if(url.pathname.startsWith('/app/')||url.pathname.startsWith('/loom/')||url.pathname.startsWith('/lite/')||url.pathname==='/offline.html'){event.respondWith(deviceOnly(request));return}
});
