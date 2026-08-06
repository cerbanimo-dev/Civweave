;(()=>{
'use strict';
const REVISION='canonical-five-system-navigation-v227';
const TIMEOUT_MS=9000;
const routes=self.CommonweaveSystemRoutesV227;
const originalNetworkFirst=networkFirst;
function canonical(request){return request.mode==='navigate'&&Boolean(routes?.identify?.(new URL(request.url).pathname))}
function packageRequest(request){
  const headers=new Headers(request.headers);
  headers.set('x-commonweave-package',REVISION);
  headers.set('x-commonweave-navigation',routes.identify(new URL(request.url).pathname));
  return new Request(request.url,{method:request.method,headers,credentials:'same-origin',cache:'no-store',redirect:'follow'});
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
function recoveryPage(pathname){
  const system=routes?.identify?.(pathname)||'commonweave';
  const home=routes?.urlFor?.('commonweave',{origin:self.location.origin}).href||'/app/working-campus-v156.html?installed=1';
  const retry=new URL(pathname,self.location.origin);retry.searchParams.set('installed','1');retry.searchParams.set('navigation',REVISION);
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Commonweave navigation recovery</title><style>html,body{margin:0;min-height:100%;background:#07131e;color:#f5f7ff;font:16px/1.5 system-ui}main{max-width:42rem;margin:auto;padding:12vh 1.25rem}a{display:inline-block;margin:.5rem .5rem 0 0;padding:.8rem 1rem;border-radius:.8rem;background:#1c3559;color:#fff;text-decoration:none}</style></head><body><main><h1>${system} could not open yet</h1><p>The requested system was not available from the network or this device package. Commonweave did not substitute the installer or another system.</p><a href="${retry.pathname}${retry.search}">Retry this system</a><a href="${home}">Open Commonweave</a></main></body></html>`,{status:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-commonweave-canonical-navigation':REVISION}});
}
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
self.CommonweaveCanonicalNavigationV227=Object.freeze({revision:REVISION,timeoutMs:TIMEOUT_MS,routes:routes?.routes?.().map(route=>route.pathname)||[],policy:'exact-route-network-first-exact-route-cache-never-launcher-fallback',packageHeader:true});
})();
