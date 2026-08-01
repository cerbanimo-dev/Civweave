const CACHE="cerbanimo-rc22.3.13-host-cache-recovery";
const SHELL=["../../commonweave-merlin-chat.css","../../shared/commonweave-merlin-chat.js","../../assets/ai/merlin.png","./","./index.html","./world-engine.js","./commonweave-handoff-consumer.js","./commonweave-presence.js","./manifest.webmanifest","../../logos/commonweave.webp","../../shared/image-hotspot-calibrator.js","../../ui-icons/back.svg","../../ui-icons/home.svg","../../ui-icons/map.svg","../../ui-icons/search.svg","../../ui-icons/inbox.svg","../../ui-icons/nexus.svg","../../ui-icons/directory.svg","../../ui-icons/settings.svg","./icons/icon-192.png","./icons/icon-maskable-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./icons/favicon-64.png","./assets/cerbanimo-logo.png","./assets/cerbanimo-mark.png","./assets/cerbanimo-wordmark.png","./commonweave-bridge.js","./shared/commonweave-model-runtime.js","./assets/visual/title.webp","./assets/visual/loading.webp","./assets/visual/nexus.webp","./assets/visual/mission.webp","./assets/visual/workshop.webp","./assets/visual/quest.webp","./assets/visual/skill.webp","./assets/visual/resource.webp","./assets/visual/transit.webp","./assets/visual/observatory.webp","./assets/visual/ai-core.webp","./assets/visual/hangar.webp","./assets/visual/systems.webp","./assets/visual/kiosks.webp","./assets/visual/showroom.webp","./assets/visual/map.webp","./assets/visual/kamiya-chamber.webp","./assets/visual/object-viewer.webp","./assets/visual/form-workbench.webp","./assets/visual/project-workbench.webp","./assets/visual/mission-room.webp","./assets/visual/asset-atlas.webp"];
const NETWORK_ONLY_PREFIXES=["/field/","/ollama/","/compatible/","/bigmoe/","/gemini/","/party/","/packaged/"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(NETWORK_ONLY_PREFIXES.some(prefix=>url.pathname.startsWith(prefix)))return;
  if(event.request.mode==="navigate"){
    event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put("./index.html",copy));}return response;}).catch(()=>caches.match("./index.html")));
    return;
  }
  event.respondWith(fetch(event.request,{cache:"reload"}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));
});

self.addEventListener("push",event=>{
  let data={};try{data=event.data?.json?.()||{};}catch{data={body:event.data?.text?.()||"A shared quest changed."};}
  const title=String(data.title||"Your shared quest moved").slice(0,120);
  const options={body:String(data.body||"A party member updated the quest.").slice(0,500),tag:String(data.tag||"cerbanimo-party-update").slice(0,120),icon:"icons/icon-192.png",badge:"icons/icon-192.png",data:{url:String(data.url||"./?sync=1").slice(0,1000)}};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();let target;try{target=new URL(event.notification.data?.url||"./?sync=1",self.location.origin);}catch{target=new URL("./?sync=1",self.location.origin);}const url=(target.origin===self.location.origin?target:new URL("./?sync=1",self.location.origin)).href;
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{for(const client of list){if(client.url.startsWith(self.location.origin)){client.focus();client.navigate(url);return;}}return clients.openWindow(url);}));
});
