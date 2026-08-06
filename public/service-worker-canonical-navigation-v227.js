;(()=>{
'use strict';
const REVISION='canonical-five-system-navigation-v227';
const TIMEOUT_MS=9000;
const routes=self.CommonweaveSystemRoutesV227;
const originalNetworkFirst=networkFirst;
function canonical(request){return request.mode==='navigate'&&Boolean(routes?.identify?.(new URL(request.url).pathname))}
function packageRequest(request){
  const url=typeof request==='string'?new URL(request,self.location.origin).href:request.url;
  const source=typeof request==='string'?null:request;
  const headers=new Headers(source?.headers);
  headers.set('x-commonweave-package',REVISION);
  headers.set('x-commonweave-navigation',routes.identify(new URL(url).pathname)||'precache');
  return new Request(url,{method:source?.method||'GET',headers,credentials:'same-origin',cache:'no-store',redirect:'follow'});
}
async function normalize(response,request){
  if(!response||response.type==='opaqueredirect'||response.status===0||response.status>=300&&response.status<400)return null;
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('location');
  headers.set('content-type',headers.get('content-type')||'text/html; charset=utf-8');
  headers.set('x-commonweave-canonical-navigation',REVISION);
  headers.set('cache-control','no-cache');
  const body=request.method==='HEAD'?null:await response.clone().arrayBuffer();
  return new Response(body,{status:response.status,statusText:response.statusText,headers});
}
async function precacheCanonicalRoutes(){
  const cache=await caches.open(SHELL_CACHE),failures=[];
  for(const route of routes?.routes?.()||[]){
    try{
      const request=new Request(new URL(route.pathname,self.location.origin).href,{method:'GET'});
      const response=await withTimeout(fetch(packageRequest(route.pathname)),TIMEOUT_MS);
      const normalized=await normalize(response,request);
      if(!normalized?.ok)throw new Error(`${route.pathname} returned ${response?.status||'no response'}`);
      await cache.put(cacheKey(route.pathname),normalized.clone());
    }catch(error){failures.push({pathname:route.pathname,message:error?.message||String(error)})}
  }
  return failures;
}
function recoveryPage(pathname){
  const system=routes?.identify?.(pathname)||'commonweave';
  const home=routes?.urlFor?.('commonweave',{origin:self.location.origin}).href||'/app/working-campus-v156.html?installed=1';
  const retry=new URL(pathname,self.location.origin);retry.searchParams.set('installed','1');retry.searchParams.set('navigation',REVISION);
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Commonweave navigation recovery</title><style>html,body{margin:0;min-height:100%;background:#07131e;color:#f5f7ff;font:16px/1.5 system-ui}main{max-width:42rem;margin:auto;padding:12vh 1.25rem}a{display:inline-block;margin:.5rem .5rem 0 0;padding:.8rem 1rem;border-radius:.8rem;background:#1c3559;color:#fff;text-decoration:none}</style></head><body><main><h1>${system} could not open yet</h1><p>The requested system was not available from the network or this device package. Commonweave did not substitute the installer or another system.</p><a href="${retry.pathname}${retry.search}">Retry this system</a><a href="${home}">Open Commonweave</a></main></body></html>`,{status:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-commonweave-canonical-navigation':REVISION}});
}
self.addEventListener('install',event=>{event.waitUntil(precacheCanonicalRoutes().catch(()=>[]))});
networkFirst=async function canonicalFiveSystemNetworkFirst(request,fallbackPath='/offline.html'){
  if(!canonical(request))return originalNetworkFirst(request,fallbackPath);
  const url=new URL(request.url),pathname=url.pathname;
  try{
    const response=await withTimeout(fetch(packageRequest(request)),TIMEOUT_MS);
    const normalized=await normalize(response,request);
    if(normalized?.ok){
      if(request.method==='GET')await(await caches.open(RUNTIME_CACHE)).put(cacheKey(pathname),normalized.clone());
      return normalized;
    }
  }catch{}
  const cached=await findCached(pathname);
  const normalized=await normalize(cached,request);
  if(normalized)return normalized;
  return recoveryPage(pathname);
};
self.CommonweaveCanonicalNavigationV227=Object.freeze({revision:REVISION,timeoutMs:TIMEOUT_MS,routes:routes?.routes?.().map(route=>route.pathname)||[],policy:'exact-route-network-first-exact-route-cache-never-launcher-fallback',packageHeader:true,precache:true});
})();
