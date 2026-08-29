'use strict';

// Direct-route Settings recovery boundary.
// The gateway is transformed only to attach the cache-distinct page-owned v339
// recovery. v339 renders saved Local Models state immediately and loads lifecycle
// code only after an explicit model action.
const CW_SETTINGS_V339_GATEWAY='/app/settings-gateway-v317.js';
const CW_SETTINGS_V339_ENTRY='/app/settings-direct-entry-v339.js?v=1.4.0-settings-direct-entry-v339';
const CW_SETTINGS_V339_CACHE='cw-settings-v339-direct-gateway-v1';
const CW_SETTINGS_V339_BOOTSTRAP_MARKER='v339-saved-state-first-bootstrap';

function cwSettingsV339Headers(source){
  const headers=new Headers(source?.headers||{});
  headers.delete('content-length');headers.delete('content-encoding');headers.delete('etag');headers.delete('last-modified');
  headers.set('content-type','application/javascript; charset=utf-8');
  headers.set('cache-control','no-store');
  headers.set('x-civweave-settings-build','v339-direct-gateway');
  return headers;
}
async function cwSettingsV339Network(request){return fetch(new Request(request,{method:'GET',cache:'no-store',credentials:'same-origin'}))}
async function cwSettingsV339Cached(){try{return await caches.match(new Request(new URL(CW_SETTINGS_V339_GATEWAY,self.location.origin).href),{ignoreSearch:true})}catch{return null}}
function cwSettingsV339Bootstrap(){
  return `\n;(()=>{'use strict';const marker='${CW_SETTINGS_V339_BOOTSTRAP_MARKER}',src='${CW_SETTINGS_V339_ENTRY}';if(globalThis.CivweaveSettingsDirectEntryV339?.savedStateFirst===true)return;const existing=[...document.scripts].some(script=>{try{return new URL(script.src,location.href).pathname==='/app/settings-direct-entry-v339.js'}catch{return false}});if(existing)return;const script=document.createElement('script');script.src=src;script.async=false;script.dataset.civweaveSettingsDirectBootstrap=marker;(document.head||document.documentElement).append(script);})();\n`;
}
function cwSettingsV339TransformGateway(text){
  let output=String(text||'');
  output=output.replaceAll('1.0.134-settings-v324-local-route-self-loading','1.0.136-settings-v339-saved-state-first');
  output=output.replaceAll('1.0.133-settings-v324-direct-local-model-view','1.0.136-settings-v339-saved-state-first');
  output=output.replaceAll('CIVWEAVE SETTINGS · v324','CIVWEAVE SETTINGS · v339');
  output=output.replaceAll('settings-v324','settings-v339');
  output=output.replaceAll("civweaveSettingsService='v324'","civweaveSettingsService='v339'");
  if(!output.includes(CW_SETTINGS_V339_BOOTSTRAP_MARKER))output+=cwSettingsV339Bootstrap();
  return output;
}
async function cwSettingsV339GatewayResponse(request){
  let response=null;try{response=await cwSettingsV339Network(request)}catch{}
  if(!response?.ok)response=await cwSettingsV339Cached();
  if(!response)return new Response('Civweave Settings v339 gateway is unavailable.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  const source=cwSettingsV339TransformGateway(await response.clone().text());
  try{const cache=await caches.open(CW_SETTINGS_V339_CACHE);await cache.put(CW_SETTINGS_V339_GATEWAY,new Response(source,{status:200,headers:cwSettingsV339Headers(response)}))}catch{}
  return new Response(source,{status:200,statusText:'OK',headers:cwSettingsV339Headers(response)});
}
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(url.origin!==self.location.origin||url.pathname!==CW_SETTINGS_V339_GATEWAY)return;
  event.stopImmediatePropagation();event.respondWith(cwSettingsV339GatewayResponse(request));
});

// v344 staging takeover: PR #765 changed the persistent shell bytes but the
// required-shell integrity manifest was not regenerated. Installed staging PWAs
// could therefore retain the previous shell generation even though Pages had the
// new Local Models code. This imported-worker byte change forces a service-worker
// update; activation purges only the Settings delivery surface and persistent
// shell document, never saved model state or downloaded model/model-pack bytes.
const CW_SETTINGS_V344_HOST='civweave-staging.pages.dev';
const CW_SETTINGS_V344_CACHE='cwrecovery-v457-settings-delivery-integrity-v344';
const CW_SETTINGS_V344_MARKER='/__civweave/settings-delivery-integrity-v344';
const CW_SETTINGS_V344_PURGE_PATHS=new Set([
  '/app/persistent-system-shell-v1.html',
  '/app/settings-gateway-v317.js',
  '/app/settings-direct-entry-v339.js',
  '/app/settings-local-loader-v337.js',
  '/app/settings-local-models-direct-v325.js',
  '/app/settings-local-route-v323.js',
  '/app/settings-local-route-v325.js',
  '/app/settings-local-route-v327.js',
  '/app/settings-local-route-v331.js',
  '/app/shell-integrity-v281.json'
]);
function cwSettingsV344MarkerRequest(){return new Request(new URL(CW_SETTINGS_V344_MARKER,self.location.origin).href)}
async function cwSettingsV344Pending(){
  if(self.location.hostname!==CW_SETTINGS_V344_HOST)return false;
  try{return !(await(await caches.open(CW_SETTINGS_V344_CACHE)).match(cwSettingsV344MarkerRequest()))}catch{return true}
}
async function cwSettingsV344Purge(){
  const names=await caches.keys();
  for(const name of names){
    const cache=await caches.open(name),requests=await cache.keys();
    for(const request of requests){
      let pathname='';try{pathname=new URL(request.url).pathname}catch{}
      if(CW_SETTINGS_V344_PURGE_PATHS.has(pathname))await cache.delete(request,{ignoreSearch:true});
    }
  }
}
if(self.location.hostname===CW_SETTINGS_V344_HOST){
  self.addEventListener('install',event=>{event.waitUntil((async()=>{if(await cwSettingsV344Pending())await self.skipWaiting()})())});
  self.addEventListener('activate',event=>{event.waitUntil((async()=>{
    if(!(await cwSettingsV344Pending()))return;
    await cwSettingsV344Purge();
    const cache=await caches.open(CW_SETTINGS_V344_CACHE);
    await cache.put(cwSettingsV344MarkerRequest(),new Response('settings-delivery-integrity-v344-activated',{headers:{'content-type':'text/plain','cache-control':'no-store'}}));
    await self.clients.claim();
  })())});
}
