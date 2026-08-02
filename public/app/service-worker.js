const VERSION='1.0.25';
const CACHE='commonweave-pocket-campus-v72-freeze-recovery';
const CRITICAL=[
  './','./index.html','./manifest.webmanifest','./version.json','./host-node-setup.js','./host-node-v125.js',
  './commonweave-world.css','./commonweave-world.js','./commonweave-merlin-chat.css',
  './shared/commonweave-model-runtime.js','./shared/commonweave-ai-personas.js','./shared/commonweave-merlin-chat.js',
  './logos/commonweave.webp','./logos/commonweave-icon-96.png','./assets/ai/weaveling.png','./assets/world/town-square-home.webp',
  './assets/generated/commonweave-navigation-icons/commonweave-home.png',
  './assets/generated/commonweave-navigation-icons/commonweave-route.png',
  './assets/generated/commonweave-navigation-icons/commonweave-realms.png',
  './assets/generated/commonweave-navigation-icons/weaveling-compass.png',
  './assets/generated/commonweave-navigation-icons/commonweave-ai-config.png'
];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.allSettled([...new Set(CRITICAL)].map(url=>cache.add(new Request(url,{cache:'reload'}))));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.allSettled(keys.filter(key=>(key.startsWith('commonweave-pocket-campus-')||/^(living-school|cerbanimo|fellowfare|anarchadia)-/.test(key))&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  clients.forEach(client=>client.postMessage({type:'COMMONWEAVE_WORKER_ACTIVE',version:VERSION,cache:CACHE}));
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
function isHubNavigation(request){if(request.mode!=='navigate')return false;const path=new URL(request.url).pathname;return path.endsWith('/app/')||path.endsWith('/app/index.html')}
async function rewriteHub(response,request){
  if(!isHubNavigation(request))return response;
  const type=response.headers.get('content-type')||'';if(!type.includes('text/html'))return response;
  let text=await response.text();
  text=text.replaceAll('1.0.21-ai-uplift','1.0.25-freeze-recovery').replaceAll('HOST v1.0.21','HOST v1.0.25');
  const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');headers.set('x-commonweave-recovery','1.0.25');
  return new Response(text,{status:response.status,statusText:response.statusText,headers});
}
function timeout(ms){return new Promise((_,reject)=>setTimeout(()=>reject(new Error('network-timeout')),ms))}
async function fetchFresh(request){return Promise.race([fetch(request,{cache:'no-store'}),timeout(request.mode==='navigate'?7000:12000)])}
async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetchFresh(request);
    if(response?.ok){const rewritten=await rewriteHub(response,request);cache.put(request,rewritten.clone()).catch(()=>{});return rewritten}
  }catch{}
  const hit=await cache.match(request,{ignoreSearch:true});if(hit)return rewriteHub(hit,request);
  if(request.mode==='navigate'){
    const path=new URL(request.url).pathname;
    const fallback=path.includes('/services/living-school/')?'./services/living-school/index.html':path.includes('/services/cerbanimo/')?'./services/cerbanimo/index.html':path.includes('/services/fellowfare/')?'./services/fellowfare/index.html':path.includes('/services/anarchadia/')?'./services/anarchadia/index.html':'./index.html';
    const page=await cache.match(fallback,{ignoreSearch:true});if(page)return rewriteHub(page,request)
  }
  return new Response('Commonweave is offline and this resource is not in the recovery cache.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}})
}
async function imageFirst(request){
  const cache=await caches.open(CACHE),hit=await cache.match(request,{ignoreSearch:true});
  const refresh=fetch(request,{cache:'no-store'}).then(response=>{if(response.ok)cache.put(request,response.clone());return response}).catch(()=>null);
  if(hit){refresh.catch(()=>{});return hit}const response=await refresh;if(response)return response;
  return new Response('',{status:404})
}
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  if(/^\/(api|field|ollama|compatible|bigmoe|gemini|party|packaged)\//.test(url.pathname))return;
  if(request.mode==='navigate'||['script','style','document','manifest','worker'].includes(request.destination)||/\.(?:js|css|json|webmanifest)$/i.test(url.pathname)){event.respondWith(networkFirst(request));return}
  if(request.destination==='image'||/\.(?:png|jpe?g|webp|svg|gif|avif)$/i.test(url.pathname)){event.respondWith(imageFirst(request));return}
  event.respondWith(networkFirst(request));
});
