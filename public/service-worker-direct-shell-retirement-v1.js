'use strict';
(()=>{
const VERSION='direct-shell-retirement-v1';
const RETIRED=new Set([
  '/app/persistent-family-shell-v1.html',
  '/app/fullscreen-family-v104.html'
]);
const ROUTES=Object.freeze({
  civweave:'/app/working-campus-v156.html',
  'living-school':'/app/cabinets/living-school/index.html',
  cerbanimo:'/app/realm-console-v140.html',
  fellowfare:'/app/fellowfare-cabinet-v144.html',
  anarchadia:'/app/anarchadia-console-v139.html'
});
function destination(url){
  const system=String(url.searchParams.get('system')||'civweave').toLowerCase();
  const pathname=ROUTES[system]||ROUTES.civweave;
  const target=new URL(pathname,self.location.origin);
  target.searchParams.set('installed','1');
  target.searchParams.set('navigation','five-system-route-contract-v228-direct-shell');
  target.searchParams.set('source','retired-iframe-shell');
  return target;
}
async function purgeRetiredEntries(){
  const names=await caches.keys();
  await Promise.all(names.map(async name=>{
    const cache=await caches.open(name);
    await Promise.all([...RETIRED].map(path=>cache.delete(new Request(new URL(path,self.location.origin).href),{ignoreSearch:true}))).catch(()=>{});
  }));
}
async function evacuateRetiredClients(){
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  await Promise.all(clients.map(async client=>{
    try{
      const url=new URL(client.url);
      if(url.origin!==self.location.origin||!RETIRED.has(url.pathname))return;
      await client.navigate(destination(url).href);
    }catch{}
  }));
}
self.addEventListener('activate',event=>event.waitUntil(Promise.all([purgeRetiredEntries(),evacuateRetiredClients()])));
self.addEventListener('fetch',event=>{
  if(!['GET','HEAD'].includes(event.request.method))return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!RETIRED.has(url.pathname))return;
  event.stopImmediatePropagation();
  event.respondWith(Promise.resolve(Response.redirect(destination(url).href,302)));
});
self.CivweaveDirectShellRetirementV1=Object.freeze({version:VERSION,retired:[...RETIRED],policy:'purge-retired-iframe-shell-cache-and-redirect-direct'});
})();
