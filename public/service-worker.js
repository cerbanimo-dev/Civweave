'use strict';
const APP_CACHE='civweave-app-current';
const RUNTIME_CACHE='civweave-runtime-current';
const MODEL_CACHE='civweave-minilm';
const APP_SHELL=[
  '/app/campus.html','/app/common.css','/app/campus.css','/app/campus.js','/app/routes.js',
  '/app/chat.html','/app/chat.css','/app/chat.js',
  '/app/settings.html','/app/settings.css','/app/settings.js',
  '/app/downloads.html','/app/downloads.css','/app/downloads.js',
  '/app/living-school.html','/app/cerbanimo.html','/app/fellowfare.html','/app/anarchadia.html','/app/realm.css','/app/realm.js',
  '/app/merlin-customization.js','/app/customization-loader.js','/app/recovery/','/app/recovery/recovery.css','/app/recovery/recovery.js',
  '/app/shared/civweave-model-runtime.js','/app/manifest.webmanifest',
  '/app/assets/ai/weaveling.png','/app/assets/ai/moss.png','/app/assets/ai/kamiya.png','/app/assets/ai/rook.png','/app/assets/ai/merlin.png',
  '/app/logos/icon-192.png','/app/logos/icon-512.png','/app/logos/icon-maskable-512.png','/app/logos/civweave-app-icon.png','/app/logos/civweave-day-logo.jpg','/app/logos/civweave-night-logo.jpg'
];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(APP_CACHE);for(const url of APP_SHELL){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`Civweave shell asset ${url} returned ${response.status}`);await cache.put(url,response.clone())}await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('civweave-')&&!new Set([APP_CACHE,RUNTIME_CACHE,MODEL_CACHE]).has(key)).map(key=>caches.delete(key)));await self.clients.claim()})()));
async function networkFirst(request){const runtime=await caches.open(RUNTIME_CACHE);try{const response=await fetch(request,{cache:'no-store'});if(response.ok&&request.method==='GET')await runtime.put(request,response.clone());return response}catch{const cached=await caches.match(request,{ignoreSearch:true});if(cached)return cached;if(request.mode==='navigate')return(await caches.match('/app/campus.html'))||new Response('Civweave is offline and the current shell is not installed.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});throw new Error('Offline asset unavailable')}}
async function cacheImage(request){const cached=await caches.match(request,{ignoreSearch:true});if(cached)return cached;const response=await fetch(request);if(response.ok){const runtime=await caches.open(RUNTIME_CACHE);await runtime.put(request,response.clone())}return response}
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==self.location.origin)return;if(url.pathname.startsWith('/app/models/all-minilm-l6-v2/')||url.pathname.startsWith('/app/vendor/onnxruntime/'))return;const destination=request.destination;if(destination==='image'||destination==='font')event.respondWith(cacheImage(request));else event.respondWith(networkFirst(request))});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();if(event.data?.type==='GET_VERSION'){const packet={type:'CIVWEAVE_VERSION',runtime:'single-current-tree',historicalSourceSelection:false,sourceHotSwap:false,cache:APP_CACHE};event.ports?.[0]?.postMessage(packet);event.source?.postMessage?.(packet)}});
