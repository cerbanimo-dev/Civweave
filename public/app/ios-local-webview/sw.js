/* Isolated WKWebView offline capability probe. Never alters Civweave's root PWA worker. */
const CACHE='civweave-ios-webview-check-v1';
const ROOT='/app/ios-local-webview/';
const FILES=[ROOT+'index.html',ROOT+'offline-data.json'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    for(const path of FILES){const response=await fetch(path,{cache:'reload'});if(!response.ok)throw Error('Failed to pre-cache '+path);await cache.put(path,response)}
    await self.skipWaiting();
  }));
});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith(ROOT)||event.request.method!=='GET')return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const found=await cache.match(event.request,{ignoreSearch:true});
    if(found)return found;
    return fetch(event.request);
  }));
});
