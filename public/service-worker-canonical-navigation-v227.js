;(()=>{
'use strict';
const REVISION='canonical-five-system-navigation-v228-lifecycle-deferred';
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
  headers.set('x-civweave-canonical-navigation',REVISION);headers.set('cache-control','no-cache');
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
  const retry=new URL(pathname,self.location.origin);retry.searchParams.set('installed','1');retry.searchParams.set('navigation',REVISION);
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Civweave navigation recovery</title><style>html,body{margin:0;min-height:100%;background:#07131e;color:#f5f7ff;font:16px/1.5 system-ui}main{max-width:42rem;margin:auto;padding:12vh 1.25rem}a{display:inline-block;margin:.5rem .5rem 0 0;padding:.8rem 1rem;border-radius:.8rem;background:#1c3559;color:#fff;text-decoration:none}</style></head><body><main><h1>${system} could not open yet</h1><p>The requested system was not available from the network or this device package. Civweave did not substitute the installer or another system.</p><a href="${retry.pathname}${retry.search}">Retry this system</a><a href="${home}">Open Civweave</a></main></body></html>`,{status:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-civweave-canonical-navigation':REVISION}});
}

// Exact-route navigation already runs network-first and writes successful
// responses into the runtime cache. Sequentially precaching every realm route
// during install added up to six 9-second waits to worker activation. Keep that
// warm-up explicit instead of making it a launch prerequisite.
self.addEventListener('install',event=>{event.waitUntil(Promise.resolve())});
self.addEventListener('message',event=>{
  if(event.data?.type!=='CIVWEAVE_WARM_CANONICAL_ROUTES')return;
  event.waitUntil(precacheCanonicalRoutes().then(failures=>{
    const packet={type:'CIVWEAVE_CANONICAL_ROUTES_WARMED',revision:REVISION,failures};
    try{event.ports?.[0]?.postMessage(packet)}catch{}
    try{event.source?.postMessage?.(packet)}catch{}
  }));
});
networkFirst=async function canonicalFiveSystemNetworkFirst(request,fallbackPath='/offline.html'){
  if(!canonical(request))return originalNetworkFirst(request,fallbackPath);
  const pathname=new URL(request.url).pathname;
  try{
    const response=await withTimeout(fetch(packageRequest(request)),TIMEOUT_MS);
    const normalized=await normalize(response,request);
    if(normalized?.ok){if(request.method==='GET')await(await caches.open(RUNTIME_CACHE)).put(cacheKey(pathname),normalized.clone());return normalized}
  }catch{}
  const cached=await findCached(pathname),normalized=await normalize(cached,request);
  if(normalized)return normalized;
  return recoveryPage(pathname);
};
self.CivweaveCanonicalNavigationV227=Object.freeze({revision:REVISION,timeoutMs:TIMEOUT_MS,routeScript:ROUTE_SCRIPT,routes:routes?.routes?.().map(route=>route.pathname)||[],policy:'exact-route-network-first-exact-route-cache-never-launcher-fallback',packageHeader:true,precache:false,warmMessage:'CIVWEAVE_WARM_CANONICAL_ROUTES',precacheCount:6});
})();
