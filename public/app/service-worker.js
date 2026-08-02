const VERSION='1.0.26';
const BUILD='1.0.26-loop-diagnostics';
const TARGET='/campus/';
const report=(kind,detail={})=>{const entry={schema:'commonweave.boot-log.v1',time:new Date().toISOString(),version:VERSION,build:BUILD,kind:`legacy-sw:${kind}`,detail};console.info('[CW-BOOT]',entry);fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(entry),keepalive:true}).catch(()=>{});self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>clients.forEach(client=>client.postMessage(entry))).catch(()=>{})};
self.addEventListener('install',event=>event.waitUntil((async()=>{report('install',{scope:self.registration.scope});await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  const stale=keys.filter(key=>key.startsWith('commonweave-pocket-campus-')||/^(living-school|cerbanimo|fellowfare|anarchadia)-/.test(key));
  await Promise.allSettled(stale.map(key=>caches.delete(key)));
  await self.clients.claim();
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  report('activate',{deleted:stale,clients:clients.map(client=>client.url)});
  await Promise.allSettled(clients.map(client=>{const url=new URL(TARGET,self.location.origin);url.searchParams.set('migrated','legacy-worker');url.searchParams.set('v',VERSION);url.searchParams.set('t',Date.now());return client.navigate(url.href)}));
  setTimeout(()=>self.registration.unregister().then(result=>report('unregistered',{result})).catch(error=>report('unregister-failed',{message:error.message})),2500);
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING'){report('skip-waiting-request');self.skipWaiting()}else report('message',{type:event.data?.type||'unknown'})});
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  if(request.mode==='navigate'){
    const url=new URL(TARGET,self.location.origin);url.searchParams.set('migrated','legacy-fetch');url.searchParams.set('v',VERSION);url.searchParams.set('t',Date.now());
    report('navigation-redirect',{from:request.url,to:url.href});
    event.respondWith(Response.redirect(url.href,302));
    return;
  }
  event.respondWith(fetch(request,{cache:'no-store'}));
});
