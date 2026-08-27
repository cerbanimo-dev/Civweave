'use strict';

// Staging recovery boundary for the direct-route architecture.
// The installed PWA launches first-class realm pages directly, so the Local Models
// recovery loader must be bootstrapped in the same document as Settings rather than
// only from the retired/compatibility persistent-shell entrypoint.
const CW_SETTINGS_V337_GATEWAY='/app/settings-gateway-v317.js';
const CW_SETTINGS_V337_LOADER='/app/settings-local-loader-v337.js?v=1.2.0-stage-full-route-v337-direct-gateway';
const CW_SETTINGS_V337_CACHE='cw-settings-v337-direct-gateway-v1';
const CW_SETTINGS_V337_BOOTSTRAP_MARKER='v337-direct-gateway-bootstrap';

function cwSettingsV337Headers(source){
  const headers=new Headers(source?.headers||{});
  headers.delete('content-length');headers.delete('content-encoding');headers.delete('etag');headers.delete('last-modified');
  headers.set('content-type','application/javascript; charset=utf-8');
  headers.set('cache-control','no-store');
  headers.set('x-civweave-settings-build','v337-direct-gateway');
  return headers;
}

async function cwSettingsV337Network(request){
  return fetch(new Request(request,{method:'GET',cache:'no-store',credentials:'same-origin'}));
}

async function cwSettingsV337Cached(){
  try{return await caches.match(new Request(new URL(CW_SETTINGS_V337_GATEWAY,self.location.origin).href),{ignoreSearch:true})}catch{return null}
}

function cwSettingsV337LoaderBootstrap(){
  return `\n;(()=>{'use strict';const marker='${CW_SETTINGS_V337_BOOTSTRAP_MARKER}',src='${CW_SETTINGS_V337_LOADER}';if(globalThis.CivweaveSettingsLocalLoaderV337?.fullRouteRequired===true)return;const existing=[...document.scripts].some(script=>{try{return new URL(script.src,location.href).pathname==='/app/settings-local-loader-v337.js'}catch{return false}});if(existing)return;const script=document.createElement('script');script.src=src;script.async=false;script.dataset.civweaveSettingsLocalDirectBootstrap=marker;(document.head||document.documentElement).append(script);})();\n`;
}

function cwSettingsV337TransformGateway(text){
  let output=String(text||'');
  output=output.replaceAll('1.0.134-settings-v324-local-route-self-loading','1.0.135-settings-v325-local-route-v337-bootstrap');
  output=output.replaceAll('1.0.133-settings-v324-direct-local-model-view','1.0.135-settings-v325-local-route-v337-bootstrap');
  output=output.replaceAll('CIVWEAVE SETTINGS · v324','CIVWEAVE SETTINGS · v325');
  output=output.replaceAll('settings-v324','settings-v325');
  output=output.replaceAll("civweaveSettingsService='v324'","civweaveSettingsService='v325'");
  if(!output.includes(CW_SETTINGS_V337_BOOTSTRAP_MARKER))output+=cwSettingsV337LoaderBootstrap();
  return output;
}

async function cwSettingsV337GatewayResponse(request){
  let response=null;
  try{response=await cwSettingsV337Network(request)}catch{}
  if(!response?.ok)response=await cwSettingsV337Cached();
  if(!response)return new Response('Civweave Settings direct-route gateway is unavailable.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  const source=cwSettingsV337TransformGateway(await response.clone().text());
  try{const cache=await caches.open(CW_SETTINGS_V337_CACHE);await cache.put(CW_SETTINGS_V337_GATEWAY,new Response(source,{status:200,headers:cwSettingsV337Headers(response)}))}catch{}
  return new Response(source,{status:200,statusText:'OK',headers:cwSettingsV337Headers(response)});
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname!==CW_SETTINGS_V337_GATEWAY)return;
  event.stopImmediatePropagation();
  event.respondWith(cwSettingsV337GatewayResponse(request));
});
