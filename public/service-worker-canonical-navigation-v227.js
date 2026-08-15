;(()=>{
'use strict';
const REVISION='canonical-five-system-navigation-v227-local-first';
const TIMEOUT_MS=9000;
const ROUTE_SCRIPT='/app/system-routes-v227.js';
const routes=self.CivweaveSystemRoutesV227;
const originalNetworkFirst=networkFirst;
function canonical(request){return request.mode==='navigate'&&Boolean(routes?.identify?.(new URL(request.url).pathname))}
function packageRequest(request){
  const url=typeof request==='string'?new URL(request,self.location.origin).href:request.url;
  const source=typeof request==='string'?null:request;
  const headers=new Headers(source?.headers);
  headers.set('x-civweave-package',REVISION);
  headers.set('x-civweave-navigation',routes.identify(new URL(url).pathname)||'precache');
  return new Request(url,{method:source?.method||'GET',headers,credentials:'same-origin',cache:'no-store',redirect:'follow'});
}
async function normalize(response,request){
  if(!response||response.type==='opaqueredirect'||response.status===0||response.status>=300&&response.status<400)return null;
  const headers=new Headers(response.headers);
  headers.delete('content-length');headers.delete('content-encoding');headers.delete('location');
  headers.set('content-type',headers.get('content-type')||(request.mode==='navigate'?'text/html; charset=utf-8':'application/javascript; charset=utf-8'));
  headers.set('x-civweave-canonical-navigation',REVISION);headers.set('x-civweave-local-first','cache-only-runtime');headers.set('cache-control','no-store');
  const body=request.method==='HEAD'?null:await response.clone().arrayBuffer();
  return new Response(body,{status:response.status,statusText:response.statusText,headers});
}
async function precacheCanonicalRoutes(){
  const cache=await caches.open(SHELL_CACHE),failures=[];
  const assets=[ROUTE_SCRIPT,...(routes?.routes?.()||[]).map(route=>route.pathname)];
  for(const pathname of assets){
    try{
      const request=new Request(new URL(pathname,self.location.origin).href,{method:'GET'});
      const response=await withTimeout(fetch(packageRequest(pathname)),TIMEOUT_MS);
      const normalized=await normalize(response,request);
      if(!normalized?.ok)throw new Error(`${pathname} returned ${response?.status||'no response'}`);
      await cache.put(cacheKey(pathname),normalized.clone());
    }catch(error){failures.push({pathname,message:error?.message||String(error)})}
  }
  return failures;
}
function recoveryPage(pathname){
  const system=routes?.identify?.(pathname)||'civweave';
  const home=routes?.urlFor?.('civweave',{origin:self.location.origin}).href||'/app/working-campus-v156.html?installed=1';
  const installer='/app/index.html?install=required&source=canonical-route-local-package-required';
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Civweave navigation recovery</title><style>html,body{margin:0;min-height:100%;background:#07131e;color:#f5f7ff;font:16px/1.5 system-ui}main{max-width:42rem;margin:auto;padding:12vh 1.25rem}a{display:inline-block;margin:.5rem .5rem 0 0;padding:.8rem 1rem;border-radius:.8rem;background:#1c3559;color:#fff;text-decoration:none}</style></head><body><main><h1>${system} is not installed locally yet</h1><p>The requested system is missing from this device package. Civweave did not fetch it from the network or substitute another system.</p><a href="${installer}">Open local package installer</a><a href="${home}">Open Civweave</a></main></body></html>`,{status:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-civweave-canonical-navigation':REVISION,'x-civweave-local-first':'package-required'}});
}
self.addEventListener('install',event=>{event.waitUntil(precacheCanonicalRoutes().catch(()=>[]))});
networkFirst=async function canonicalFiveSystemLocalFirst(request,fallbackPath='/offline.html'){
  if(!canonical(request))return originalNetworkFirst(request,fallbackPath);
  const pathname=new URL(request.url).pathname;
  const cached=await findCached(pathname),normalized=await normalize(cached,request);
  if(normalized)return normalized;
  return recoveryPage(pathname);
};
self.CivweaveCanonicalNavigationV227=Object.freeze({revision:REVISION,timeoutMs:TIMEOUT_MS,routeScript:ROUTE_SCRIPT,routes:routes?.routes?.().map(route=>route.pathname)||[],policy:'exact-route-cache-only-never-runtime-network-fallback',packageHeader:true,precache:true,precacheCount:6,runtimeNetworkFallback:false});
})();
