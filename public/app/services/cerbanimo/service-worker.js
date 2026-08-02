/* District workers retire themselves. Commonweave's /app service worker owns the single offline and update channel. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const prefixes=['living-school-','cerbanimo-','fellowfare-','anarchadia-'];
  const keys=await caches.keys();await Promise.all(keys.filter(key=>prefixes.some(prefix=>key.startsWith(prefix))).map(key=>caches.delete(key)));
  await self.clients.claim();
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});windows.forEach(client=>client.postMessage({type:'COMMONWEAVE_DISTRICT_WORKER_RETIRED'}));
  await self.registration.unregister();
})()));
