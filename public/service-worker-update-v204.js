'use strict';
(()=>{
const CACHE='cwupdate-visible-v207';
const FILES=[
  '/app/pwa-update-controller-v204.js',
  '/app/knowledge-school-seeds-v1.js',
  '/app/knowledge-school-installer-v1.js',
  '/app/knowledge-school-installer-v1.css',
  '/install-v130.js',
  '/index.html'
];
async function populate(){
  const cache=await caches.open(CACHE);
  for(const url of FILES){
    const response=await fetch(`${url}${url.includes('?')?'&':'?'}v=visible-update-library-v207-registration-watchdog`,{cache:'no-store',headers:{'x-commonweave-package':'update-controls'}});
    if(!response.ok)throw new Error(`Update control asset ${url} returned ${response.status}`);
    await cache.put(url,response.clone());
  }
}
self.addEventListener('install',event=>event.waitUntil(populate()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(name=>name.startsWith('cwupdate-')&&name!==CACHE).map(name=>caches.delete(name))))));
self.CommonweaveUpdatePackageV204=Object.freeze({version:'v207-registration-watchdog',cache:CACHE,files:[...FILES],knowledgeCache:'cwknowledge-school-seeds-v2'});
})();
