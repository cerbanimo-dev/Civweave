'use strict';
(()=>{
const VERSION='canonical-home-v1-persistent-shell-r2';
const PATH='/app/working-campus-v440.html';
const SHELL_PATH='/app/persistent-system-shell-v1.html';
const CACHE='cw-canonical-home-v1';
const MARKERS=Object.freeze(['data-civweave-system="civweave"','data-build="working-campus-v440','Civweave Working Campus']);
function validType(response){return response?.ok&&String(response.headers.get('content-type')||'').toLowerCase().includes('text/html')}
async function validated(response){
  if(!validType(response))return null;const text=await response.clone().text();if(!MARKERS.every(marker=>text.includes(marker)))return null;
  const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('content-encoding');headers.delete('location');headers.set('cache-control','no-store');headers.set('x-civweave-canonical-home',VERSION);return new Response(text,{status:response.status,statusText:response.statusText,headers});
}
function head(response){return new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers})}
async function exact(request){
  try{const checked=await validated(await fetch(new Request(request,{cache:'no-store',redirect:'follow'})));if(checked){if(request.method==='GET')await(await caches.open(CACHE)).put(PATH,checked.clone());return request.method==='HEAD'?head(checked):checked}}catch{}
  const checked=await validated(await(await caches.open(CACHE)).match(PATH,{ignoreSearch:true}));if(checked)return request.method==='HEAD'?head(checked):checked;
  return new Response('Civweave home is unavailable. Civweave refused to substitute a legacy campus or another system page.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-civweave-canonical-home':VERSION}});
}
function shellRedirect(url){const target=new URL(SHELL_PATH,url.origin);target.searchParams.set('system','civweave');target.searchParams.set('installed','1');for(const key of ['feature','source','weave']){const value=url.searchParams.get(key);if(value)target.searchParams.set(key,value)}return Response.redirect(target.href,302)}
self.addEventListener('activate',event=>event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith('cw-canonical-home-')&&name!==CACHE).map(name=>caches.delete(name)))})()));
self.addEventListener('fetch',event=>{
  const request=event.request;if(!['GET','HEAD'].includes(request.method)||request.mode!=='navigate')return;let url;try{url=new URL(request.url)}catch{return}
  if(url.origin!==self.location.origin||url.pathname!==PATH)return;event.stopImmediatePropagation();const embedded=url.searchParams.get('embed')==='1'||url.searchParams.get('persistentShell')==='1';event.respondWith(embedded?exact(request):Promise.resolve(shellRedirect(url)));
});
self.CivweaveCanonicalHomeV1=Object.freeze({version:VERSION,path:PATH,shellPath:SHELL_PATH,cache:CACHE,markers:[...MARKERS],policy:'top-level-home-navigation-redirects-to-one-persistent-shell-embedded-home-content-remains-direct'});
})();
