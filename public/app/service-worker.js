const CACHE='commonweave-pocket-campus-v66-unified-shell';
const CORE=[
  './','./index.html','./manifest.webmanifest','./host-node-setup.js',
  './commonweave-world.css','./commonweave-world.js','./commonweave-living-world.js','./commonweave-live-data.js',
  './commonweave-intention-orchestrator.js','./commonweave-model-steward.js','./commonweave-weaveling-steward.js','./commonweave-actionable-quad.js',
  './commonweave-merlin-chat.css','./shared/commonweave-model-runtime.js','./shared/commonweave-ai-personas.js','./shared/commonweave-merlin-chat.js','./shared/image-hotspot-calibrator.js','./shared/visual-shell-cleanup.css','./shared/visual-shell-cleanup.js',
  './logos/commonweave.webp','./logos/living-school.webp','./logos/fellowfare.png',
  './assets/ai/weaveling.png','./assets/ai/weaveling-compass.png','./assets/ai/kamiya.png','./assets/ai/moss.png','./assets/ai/rook.png','./assets/ai/merlin.png',
  './assets/world/town-square-home.webp','./assets/world/town-square-weaveling.webp','./assets/world/inside-quad.webp',
  './ui-icons/home.svg','./ui-icons/settings.svg','./ui-icons/back.svg','./ui-icons/search.svg','./ui-icons/nexus.svg','./ui-icons/directory.svg','./ui-icons/inbox.svg',
  './services/living-school/index.html','./services/cerbanimo/index.html','./services/fellowfare/index.html','./services/anarchadia/index.html'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(async cache=>{for(const url of CORE){try{await cache.add(new Request(url,{cache:'reload'}))}catch{}}}).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('commonweave-pocket-campus-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
async function cacheFirstRefresh(request){const cache=await caches.open(CACHE),cached=await cache.match(request,{ignoreSearch:true});const refresh=fetch(request).then(response=>{if(response.ok)cache.put(request,response.clone());return response}).catch(()=>null);return cached||refresh||Response.error()}
async function networkFirst(request){const cache=await caches.open(CACHE);try{const response=await fetch(request);if(response.ok)cache.put(request,response.clone());return response}catch(error){const cached=await cache.match(request,{ignoreSearch:request.mode==='navigate'});if(cached)return cached;throw error}}
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==location.origin)return;if(request.mode==='navigate'){event.respondWith(cacheFirstRefresh(request));return}if(['image','font','style','script'].includes(request.destination)){event.respondWith(cacheFirstRefresh(request));return}event.respondWith(networkFirst(request))});
