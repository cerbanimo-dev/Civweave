'use strict';

// Settings v325 delivery boundary.
// This override runs before the general app cache handlers so an installed PWA
// cannot keep serving the historical v324 Settings gateway or eagerly execute
// local-model lifecycle code merely to display the Local models tab.
const CW_SETTINGS_V325_GATEWAY='/app/settings-gateway-v317.js';
const CW_SETTINGS_V325_PATCH='/app/settings-local-models-direct-v325.js';
const CW_SETTINGS_V325_CACHE='cw-settings-v325-bootstrap-v1';
const CW_SETTINGS_V325_ACTION_PARAM='cwAction';
const CW_SETTINGS_V325_VIEW_ROUTES=new Set([
  '/app/settings-local-route-v323.js',
  '/app/settings-local-route-v325.js',
  '/app/settings-local-route-v327.js',
  '/app/settings-local-route-v331.js'
]);
const CW_SETTINGS_V325_PURGE_PATHS=new Set([
  '/app/index.html',
  '/app/persistent-system-shell-v1.html',
  '/app/persistent-system-shell-v1.js',
  '/app/working-campus-v440.html',
  CW_SETTINGS_V325_GATEWAY,
  ...CW_SETTINGS_V325_VIEW_ROUTES
]);
const CW_SETTINGS_V325_ROUTE_VERSION='1.1.3-settings-local-route-v326-canonical-inert-hard-local';
const CW_SETTINGS_V325_SHIM=`(()=>{'use strict';const VERSION='${CW_SETTINGS_V325_ROUTE_VERSION}';const existing=globalThis.CivweaveSettingsLocalRouteV323;if(existing?.version===VERSION&&existing?.settingsV325DisplayShim===true)return;globalThis.CivweaveSettingsLocalRouteV323=Object.freeze({version:VERSION,route:'downloaded-local',settingsV325DisplayShim:true,savedStateOnlyView:true,viewWritesState:false,managerDependencyOnView:false,cacheReadOnView:false,serviceWorkerReadyOnView:false,hardwareProbeOnView:false,renderLocalModels(layer){try{return Boolean(globalThis.CivweaveSettingsLocalDirectV325?.render?.(layer))}catch{return false}},selection(){try{return JSON.parse(localStorage.getItem('civweave.local-ai.selection.v266')||'{"active":false,"id":null}')}catch{return{active:false,id:null}}}});})();`;

function cwSettingsV325Headers(source,contentType='application/javascript; charset=utf-8'){
  const headers=new Headers(source?.headers||{});
  headers.delete('content-length');headers.delete('content-encoding');headers.delete('etag');headers.delete('last-modified');
  headers.set('content-type',contentType);headers.set('cache-control','no-store');headers.set('x-civweave-settings-build','v325');
  return headers;
}
async function cwSettingsV325Network(pathname){
  return fetch(new Request(new URL(pathname,self.location.origin).href,{method:'GET',cache:'no-store',credentials:'same-origin'}));
}
async function cwSettingsV325Cached(pathname){
  try{return await caches.match(new Request(new URL(pathname,self.location.origin).href),{ignoreSearch:true})}catch{return null}
}
async function cwSettingsV325PatchText(){
  const cache=await caches.open(CW_SETTINGS_V325_CACHE);
  try{
    const response=await cwSettingsV325Network(CW_SETTINGS_V325_PATCH);
    if(response?.ok){await cache.put(CW_SETTINGS_V325_PATCH,response.clone());return response.text()}
  }catch{}
  const cached=await cache.match(CW_SETTINGS_V325_PATCH,{ignoreSearch:true});
  if(cached)return cached.text();
  return `(()=>{addEventListener('civweave:model-settings-opened',()=>{const layer=document.getElementById('cw-settings-v320');const label=layer?.querySelector('header small');if(label)label.textContent='CIVWEAVE SETTINGS · v325';const target=layer?.querySelector('[data-settings-tab-panel="local-models"]');if(target)target.innerHTML='<section class="cw-clean-panel"><h3>Local models could not open</h3><p>The v325 direct renderer was unavailable. Settings will not remain on an endless loading state.</p><small>SETTINGS BUILD v325 · renderer bootstrap unavailable</small></section>';});})();`;
}
function cwSettingsV325TransformGateway(text){
  let output=String(text||'');
  output=output.replaceAll('1.0.133-settings-v324-direct-local-model-view','1.0.134-settings-v325-direct-local-model-view');
  output=output.replaceAll('CIVWEAVE SETTINGS · v324','CIVWEAVE SETTINGS · v325');
  output=output.replaceAll('settings-v324','settings-v325');
  output=output.replaceAll("civweaveSettingsService='v324'","civweaveSettingsService='v325'");
  return output;
}
async function cwSettingsV325GatewayResponse(request){
  let response=null;
  try{response=await fetch(new Request(request,{cache:'no-store'}))}catch{}
  if(!response?.ok)response=await cwSettingsV325Cached(CW_SETTINGS_V325_GATEWAY);
  if(!response)return new Response('Civweave Settings v325 gateway is unavailable.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  let source=await response.clone().text();
  source=cwSettingsV325TransformGateway(source);
  if(!source.includes('CivweaveSettingsLocalDirectV325'))source+=`\n;${await cwSettingsV325PatchText()}\n`;
  return new Response(source,{status:200,statusText:'OK',headers:cwSettingsV325Headers(response)});
}
async function cwSettingsV325ActionResponse(request){
  let response=null;
  try{response=await fetch(new Request(request,{cache:'no-store'}))}catch{}
  if(!response?.ok)response=await cwSettingsV325Cached(new URL(request.url).pathname);
  if(!response)return new Response('Local model action code is unavailable.',{status:503,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store'}});
  return new Response(await response.clone().arrayBuffer(),{status:response.status,statusText:response.statusText,headers:cwSettingsV325Headers(response)});
}
async function cwSettingsV325Prime(){
  try{await cwSettingsV325PatchText()}catch{}
}
async function cwSettingsV325Purge(){
  const names=await caches.keys();
  for(const name of names){
    const cache=await caches.open(name),requests=await cache.keys();
    for(const request of requests){
      let pathname='';try{pathname=new URL(request.url).pathname}catch{}
      if(CW_SETTINGS_V325_PURGE_PATHS.has(pathname))await cache.delete(request,{ignoreSearch:true});
    }
  }
}
self.addEventListener('install',event=>{event.waitUntil(cwSettingsV325Prime())});
self.addEventListener('activate',event=>{event.waitUntil(cwSettingsV325Purge())});
self.addEventListener('fetch',event=>{
  const request=event.request;if(!['GET','HEAD'].includes(request.method))return;
  const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  if(url.pathname===CW_SETTINGS_V325_GATEWAY){
    event.stopImmediatePropagation();event.respondWith(cwSettingsV325GatewayResponse(request));return;
  }
  if(CW_SETTINGS_V325_VIEW_ROUTES.has(url.pathname)){
    event.stopImmediatePropagation();
    if(url.searchParams.get(CW_SETTINGS_V325_ACTION_PARAM)==='1')event.respondWith(cwSettingsV325ActionResponse(request));
    else event.respondWith(Promise.resolve(new Response(CW_SETTINGS_V325_SHIM,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store','x-civweave-settings-build':'v325-shim'}})));
  }
});
