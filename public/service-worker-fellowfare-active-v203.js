'use strict';
(()=>{
const VERSION='fellowfare-active-surface-v203';
const CACHE='cwhotfix-fellowfare-active-surface-v203';
const FILES=[
  '/app/fellowfare-cabinet-v144.html',
  '/app/fellowfare-cabinet-v144.css',
  '/app/services/fellowfare/cabinet-embed.css',
  '/app/themed-system-nav-v178.js'
];
const PATHS=new Set(FILES);

function head(response){return new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers})}
function valid(response,pathname){
  if(!response?.ok)return false;
  const type=String(response.headers.get('content-type')||'');
  if(pathname.endsWith('.html'))return /text\/html/i.test(type);
  if(pathname.endsWith('.css'))return /text\/css/i.test(type)||!type;
  if(pathname.endsWith('.js'))return /javascript|ecmascript|text\/plain/i.test(type)||!type;
  return true;
}
async function fresh(pathname){
  const response=await fetch(`${pathname}?v=${VERSION}`,{cache:'no-store',headers:{'x-commonweave-package':'fellowfare-active-hotfix'}});
  if(!valid(response,pathname))throw new Error(`FellowFare active asset ${pathname} returned ${response.status}`);
  return response;
}
async function warm(){
  const cache=await caches.open(CACHE);
  for(const pathname of FILES)await cache.put(pathname,(await fresh(pathname)).clone());
  return true;
}
async function serve(request){
  const pathname=new URL(request.url).pathname;
  const cache=await caches.open(CACHE);
  let response=await cache.match(pathname,{ignoreSearch:true,ignoreMethod:true});
  if(!response){
    try{response=await fresh(pathname);if(request.method==='GET')await cache.put(pathname,response.clone())}
    catch{response=await caches.match(pathname,{ignoreSearch:true,ignoreMethod:true})}
  }
  if(!response)return new Response(`Active FellowFare asset unavailable: ${pathname}`,{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-commonweave-fellowfare-hotfix':VERSION}});
  return request.method==='HEAD'?head(response):response;
}

self.addEventListener('install',event=>event.waitUntil((async()=>{await warm();await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('cwhotfix-fellowfare-')&&name!==CACHE).map(name=>caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(!['GET','HEAD'].includes(request.method))return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||!PATHS.has(url.pathname))return;
  event.stopImmediatePropagation();
  event.respondWith(serve(request));
});
self.addEventListener('message',event=>{
  if(event.data?.type!=='GET_FELLOWFARE_ACTIVE_STATUS')return;
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE),keys=await cache.keys(),present=new Set(keys.map(request=>new URL(request.url).pathname)),missing=FILES.filter(pathname=>!present.has(pathname));
    const packet={type:'COMMONWEAVE_FELLOWFARE_ACTIVE_STATUS',version:VERSION,cache:CACHE,ready:missing.length===0,present:FILES.length-missing.length,total:FILES.length,missing};
    event.ports?.[0]?.postMessage(packet);
    event.source?.postMessage?.(packet);
  })());
});
})();
