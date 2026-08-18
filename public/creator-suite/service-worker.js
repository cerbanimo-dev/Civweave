const CACHE='civweave-creator-suite-v1';
const CORE=[
  '/creator-suite/',
  '/creator-suite/index.html',
  '/creator-suite/manifest.webmanifest',
  '/creator-suite/creator-suite-v1.css',
  '/creator-suite/creator-suite-v1.js',
  '/creator-suite/shared/session-store-v1.js',
  '/creator-suite/shared/packet-crypto-v1.js',
  '/creator-suite/shared/ai-tools-v1.js',
  '/creator-suite/text-editor-v1.js',
  '/creator-suite/audio-editor-v1.js',
  '/creator-suite/video-editor-v1.js',
  '/app/content-provenance-v1.js'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('civweave-creator-suite-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==location.origin)return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{if(response.ok&&(url.pathname.startsWith('/creator-suite/')||url.pathname==='/app/content-provenance-v1.js')){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>caches.match('/creator-suite/index.html'))))});
