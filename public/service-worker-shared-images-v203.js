'use strict';
(()=>{
const VERSION='shared-image-delivery-v203';
if(self.CivweaveSharedImagesV203)return;
const CACHE='cwimg-shared-v203';
const FETCH_TIMEOUT_MS=12000;
const ESSENTIAL=[
  '/app/assets/ai/weaveling-compass.png',
  '/app/assets/ai/moss-acorn.png',
  '/app/assets/ai/kamiya-gift.png',
  '/app/assets/ai/rook-coin-button.png',
  '/app/assets/ai/merlin-hat.png',
  '/app/assets/ai/weaveling.png',
  '/app/assets/ai/moss.png',
  '/app/assets/ai/kamiya.png',
  '/app/assets/ai/rook.png',
  '/app/assets/ai/merlin.png',
  '/app/assets/navigation/200-civweave-nav.webp',
  '/app/assets/navigation/200-cerbanimo-nav.webp',
  '/app/assets/navigation/200-living-school-nav.webp',
  '/app/assets/navigation/200-fellowfare-nav.webp',
  '/app/assets/navigation/200-anarchadia-nav.webp',
  '/app/logos/civweave.webp',
  '/app/logos/cerbanimo.webp',
  '/app/logos/civweave-prismatic-wordmark-v1.png',
  '/app/logos/cerbanimo-steward-mark-v1.png',
  '/app/logos/fellowfare-v2.webp'
];
const IMAGE_EXT=/\.(?:png|webp|jpe?g|gif|svg|avif)$/i;
function owns(pathname){return IMAGE_EXT.test(pathname)&&(pathname.startsWith('/app/assets/')||pathname.startsWith('/app/logos/'))}
function valid(response){if(!response?.ok)return false;const type=String(response.headers.get('content-type')||'').toLowerCase();return type.startsWith('image/')||type.includes('svg+xml')}
function head(response){return new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers})}
async function network(requestOrPath){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{
    const target=typeof requestOrPath==='string'
      ?new Request(requestOrPath,{cache:'no-store',headers:{'x-civweave-image':'repair'},signal:controller.signal})
      :new Request(requestOrPath,{cache:'no-store',headers:new Headers(requestOrPath.headers),signal:controller.signal});
    target.headers?.set?.('x-civweave-image','repair');
    const response=await fetch(target);
    return valid(response)?response:null;
  }catch{return null}
  finally{clearTimeout(timer)}
}
async function anyValid(pathname,request){
  const own=await (await caches.open(CACHE)).match(pathname,{ignoreSearch:true,ignoreMethod:true});
  if(valid(own))return own;
  const any=await caches.match(request||pathname,{ignoreSearch:true,ignoreMethod:true});
  return valid(any)?any:null;
}
async function imageResponse(request){
  const pathname=new URL(request.url).pathname;
  const cache=await caches.open(CACHE);
  const fresh=await network(request);
  if(fresh){if(request.method==='GET')await cache.put(pathname,fresh.clone());return request.method==='HEAD'?head(fresh):fresh}
  const cached=await anyValid(pathname,request);
  if(cached){if(request.method==='GET'&&!(await cache.match(pathname,{ignoreSearch:true})))await cache.put(pathname,cached.clone());return request.method==='HEAD'?head(cached):cached}
  const label=pathname.split('/').pop()||'image';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect width="200" height="100" rx="14" fill="#10251d"/><path d="M42 69l25-28 18 20 16-17 29 25z" fill="#8db66f"/><circle cx="128" cy="30" r="9" fill="#e7bd45"/><text x="100" y="91" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#f1e6c7">${label.replace(/[&<>]/g,'')}</text></svg>`;
  return new Response(request.method==='HEAD'?null:svg,{status:503,headers:{'content-type':'image/svg+xml','cache-control':'no-store','x-civweave-image-lane':VERSION,'x-civweave-image-missing':pathname}})
}
async function warm(){
  const cache=await caches.open(CACHE);
  const missing=[];
  for(let index=0;index<ESSENTIAL.length;index+=4){
    const batch=ESSENTIAL.slice(index,index+4);
    const results=await Promise.all(batch.map(async pathname=>{
      const existing=await anyValid(pathname);
      if(existing){await cache.put(pathname,existing.clone());return true}
      const response=await network(pathname);
      if(response){await cache.put(pathname,response.clone());return true}
      return false;
    }));
    results.forEach((ready,i)=>{if(!ready)missing.push(batch[i])});
  }
  return{ready:missing.length===0,missing,present:ESSENTIAL.length-missing.length,total:ESSENTIAL.length};
}
async function status(){
  const cache=await caches.open(CACHE);
  const missing=[];
  for(const pathname of ESSENTIAL){const response=await cache.match(pathname,{ignoreSearch:true});if(!valid(response))missing.push(pathname)}
  return{type:'CIVWEAVE_SHARED_IMAGE_STATUS',version:VERSION,cache:CACHE,ready:missing.length===0,present:ESSENTIAL.length-missing.length,total:ESSENTIAL.length,missing};
}
self.addEventListener('install',event=>event.waitUntil(warm()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith('cwimg-')&&name!==CACHE).map(name=>caches.delete(name)))})()));
self.addEventListener('message',event=>{if(event.data?.type!=='GET_SHARED_IMAGE_STATUS')return;event.waitUntil(status().then(packet=>{event.ports?.[0]?.postMessage(packet);event.source?.postMessage?.(packet)}))});
self.addEventListener('fetch',event=>{
  const request=event.request;if(!['GET','HEAD'].includes(request.method))return;
  const url=new URL(request.url);if(url.origin!==self.location.origin||!owns(url.pathname))return;
  event.stopImmediatePropagation();
  event.respondWith(imageResponse(request));
});
self.CivweaveSharedImagesV203={version:VERSION,cache:CACHE,essential:ESSENTIAL.slice(),warm,status};
})();
