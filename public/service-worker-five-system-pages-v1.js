'use strict';
(()=>{
const VERSION='five-system-pages-v1-persistent-shell-r5';
const CACHE='cw-five-system-pages-v2';
const NETWORK_TIMEOUT_MS=4000;
const SHELL_PATH='/app/persistent-system-shell-v1.html';
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
async function cached(pathname){try{return await validated(await(await caches.open(CACHE)).match(pathname,{ignoreSearch:true}),pathname)}catch{return null}}
async function fresh(request,pathname){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),NETWORK_TIMEOUT_MS);
  try{return await validated(await fetch(new Request(request,{cache:'no-store',redirect:'follow',signal:controller.signal})),pathname)}catch{return null}finally{clearTimeout(timer)}
}
async function exact(request,pathname){
  const cachedPromise=cached(pathname),checked=await fresh(request,pathname);
  if(checked){if(request.method==='GET')await(await caches.open(CACHE)).put(pathname,checked.clone());return request.method==='HEAD'?new Response(null,{status:checked.status,headers:checked.headers}):checked}
  const fallback=await cachedPromise;if(fallback)return request.method==='HEAD'?new Response(null,{status:fallback.status,headers:fallback.headers}):fallback;
  return new Response(`${PATHS[pathname].system} is unavailable. Civweave refused to substitute another system page.`,{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-civweave-five-system-pages':VERSION,'x-civweave-system':PATHS[pathname].system}});
}
function shellRedirect(url,system){
  const target=new URL(SHELL_PATH,url.origin);target.searchParams.set('system',system);target.searchParams.set('installed','1');
  for(const key of ['feature','source','weave']){const value=url.searchParams.get(key);if(value)target.searchParams.set(key,value)}
  return Response.redirect(target.href,302);
}
self.addEventListener('activate',event=>event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith('cw-five-system-pages-')&&name!==CACHE).map(name=>caches.delete(name)))})()));
self.addEventListener('fetch',event=>{
  const request=event.request;if(!['GET','HEAD'].includes(request.method)||request.mode!=='navigate')return;
  let url;try{url=new URL(request.url)}catch{return}
  if(url.origin!==self.location.origin||!PATH_SET.has(url.pathname))return;
  event.stopImmediatePropagation();
  const spec=PATHS[url.pathname],embedded=url.searchParams.get('embed')==='1'||url.searchParams.get('persistentShell')==='1';
  event.respondWith(embedded?exact(request,url.pathname):Promise.resolve(shellRedirect(url,spec.system)));
});
self.CivweaveFiveSystemPagesV1=Object.freeze({version:VERSION,cache:CACHE,shellPath:SHELL_PATH,paths:[...PATH_SET],networkTimeoutMs:NETWORK_TIMEOUT_MS,policy:'top-level-realm-navigation-redirects-to-one-persistent-shell-embedded-realm-content-remains-direct'});
})();
