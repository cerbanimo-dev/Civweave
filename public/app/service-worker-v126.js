const VERSION='1.0.27';
const BUILD='1.0.27-clean-slate-shell';
const TARGET='/loom/';
const report=(kind,detail={})=>{const entry={schema:'civweave.boot-log.v1',time:new Date().toISOString(),version:VERSION,build:BUILD,kind:`campus-tombstone:${kind}`,detail};console.info('[CW-BOOT]',entry);fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(entry),keepalive:true}).catch(()=>{});self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>clients.forEach(client=>client.postMessage(entry))).catch(()=>{})};
self.addEventListener('install',event=>event.waitUntil((async()=>{report('install',{scope:self.registration.scope});await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  const stale=keys.filter(key=>key.startsWith('civweave-')||/^(living-school|cerbanimo|fellowfare|anarchadia)-/.test(key));
  await Promise.allSettled(stale.map(key=>caches.delete(key)));
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  report('activate',{deleted:stale,clients:windows.map(client=>client.url),target:TARGET});
  await Promise.allSettled(windows.filter(client=>new URL(client.url).pathname.startsWith('/campus/')).map(client=>client.navigate(new URL(TARGET,self.location.origin).href)));
  setTimeout(()=>self.registration.unregister().then(result=>report('unregistered',{result})).catch(error=>report('unregister-failed',{message:error.message})),1200);
})()));
self.addEventListener('message',event=>{report('message',{type:event.data?.type||'unknown'});if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;if(request.mode==='navigate'){const target=new URL(TARGET,self.location.origin);report('navigation-redirect',{from:request.url,to:target.href});event.respondWith(Response.redirect(target.href,302));return}event.respondWith(fetch(request,{cache:'no-store'}))});
