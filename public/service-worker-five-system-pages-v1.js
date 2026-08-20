'use strict';
(()=>{
const VERSION='five-system-pages-v1-exact-realm-owner';
const CACHE='cw-five-system-pages-v1';
const PATHS=Object.freeze({
  '/app/cabinets/living-school/index.html':{system:'living-school',markers:['data-civweave-system="living-school"','Opening Living School']},
  '/app/realm-console-v140.html':{system:'cerbanimo',markers:['Civweave Realm Console','/app/realm-console-v140.js']},
  '/app/fellowfare-cabinet-v144.html':{system:'fellowfare',markers:['data-civweave-system="fellowfare"','FellowFare Marketplace']},
  '/app/anarchadia-console-v139.html':{system:'anarchadia',markers:['data-civweave-system="anarchadia"','Anarchadia Citizen Console']}
});
const PATH_SET=new Set(Object.keys(PATHS));
function validType(response){return response?.ok&&!String(response.headers.get('content-type')||'').toLowerCase().includes('application/json')}
async function validated(response,pathname){
  if(!validType(response))return null;
  const text=await response.clone().text();
  const spec=PATHS[pathname];
  if(!spec||!spec.markers.every(marker=>text.includes(marker)))return null;
  const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('content-encoding');headers.delete('location');headers.set('cache-control','no-store');headers.set('x-civweave-five-system-pages',VERSION);headers.set('x-civweave-system',spec.system);
  return new Response(text,{status:response.status,statusText:response.statusText,headers});
}
async function exact(request,pathname){
  try{
    const fresh=await fetch(new Request(request,{cache:'no-store',redirect:'follow'}));
    const checked=await validated(fresh,pathname);
    if(checked){if(request.method==='GET')await(await caches.open(CACHE)).put(pathname,checked.clone());return request.method==='HEAD'?new Response(null,{status:checked.status,headers:checked.headers}):checked}
  }catch{}
  const cached=await(await caches.open(CACHE)).match(pathname,{ignoreSearch:true});
  const checked=await validated(cached,pathname);
  if(checked)return request.method==='HEAD'?new Response(null,{status:checked.status,headers:checked.headers}):checked;
  return new Response(`${PATHS[pathname].system} is unavailable. Civweave refused to substitute the home page for this realm.`,{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-civweave-five-system-pages':VERSION,'x-civweave-system':PATHS[pathname].system}});
}
self.addEventListener('activate',event=>event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith('cw-five-system-pages-')&&name!==CACHE).map(name=>caches.delete(name)))})()));
self.addEventListener('fetch',event=>{
  const request=event.request;if(!['GET','HEAD'].includes(request.method)||request.mode!=='navigate')return;
  let url;try{url=new URL(request.url)}catch{return}
  if(url.origin!==self.location.origin||!PATH_SET.has(url.pathname))return;
  event.stopImmediatePropagation();event.respondWith(exact(request,url.pathname));
});
self.CivweaveFiveSystemPagesV1=Object.freeze({version:VERSION,cache:CACHE,paths:[...PATH_SET],policy:'exact-network-first-validated-realm-html-never-home-substitution'});
})();
