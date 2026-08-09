;(()=>{
'use strict';
const REVISION='canonical-five-system-package-navigation-v266';
const ROUTE_SCRIPT='/app/system-routes-v227.js';
const routes=self.CivweaveSystemRoutesV227;
const originalNetworkFirst=networkFirst;
function canonical(request){return request.mode==='navigate'&&Boolean(routes?.identify?.(new URL(request.url).pathname))}
function packageRequest(pathname){const url=new URL(pathname,self.location.origin);const headers=new Headers({'x-civweave-package':REVISION,'x-civweave-navigation':routes?.identify?.(url.pathname)||'precache'});return new Request(url.href,{method:'GET',headers,credentials:'same-origin',cache:'no-store',redirect:'follow'})}
async function normalize(response,request){
  if(!response||response.type==='opaqueredirect'||response.status===0||response.status>=300&&response.status<400)return null;
  const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('content-encoding');headers.delete('location');
  headers.set('content-type',headers.get('content-type')||(request.mode==='navigate'?'text/html; charset=utf-8':'application/javascript; charset=utf-8'));
  headers.set('x-civweave-canonical-navigation',REVISION);headers.set('x-civweave-runtime-source','downloaded-package');headers.set('cache-control','no-cache');
  const body=request.method==='HEAD'?null:await response.clone().arrayBuffer();return new Response(body,{status:response.status,statusText:response.statusText,headers});
}
async function currentPackage(pathname){
  const key=cacheKey(pathname);
  for(const name of [OFFLINE_CACHE,SHELL_CACHE,RUNTIME_CACHE]){const response=await(await caches.open(name)).match(key,{ignoreSearch:true});if(response?.ok)return response}
  return null;
}
async function precacheCanonicalRoutes(){
  const cache=await caches.open(SHELL_CACHE),failures=[];
  const assets=[ROUTE_SCRIPT,...(routes?.routes?.()||[]).map(route=>route.pathname)];
  for(const pathname of assets){
    try{const request=new Request(new URL(pathname,self.location.origin).href,{method:'GET'}),response=await fetch(packageRequest(pathname)),normalized=await normalize(response,request);if(!normalized?.ok)throw new Error(`${pathname} returned ${response?.status||'no response'}`);await cache.put(cacheKey(pathname),normalized.clone())}
    catch(error){failures.push({pathname,message:error?.message||String(error)})}
  }
  return failures;
}
function recoveryPage(pathname){
  const installer=new URL('/app/index.html',self.location.origin);installer.searchParams.set('repair','canonical-route');installer.searchParams.set('next',pathname);
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Civweave package repair</title><style>html,body{margin:0;min-height:100%;background:#07131e;color:#f5f7ff;font:16px/1.5 system-ui}main{max-width:42rem;margin:auto;padding:12vh 1.25rem}a{display:inline-block;padding:.8rem 1rem;border-radius:.8rem;background:#1c3559;color:#fff;text-decoration:none}</style></head><body><main><h1>Downloaded route unavailable</h1><p>Civweave did not substitute the hosted website. Finish or repair the local campus package, then try this route again.</p><a href="${installer.pathname}${installer.search}">Repair downloaded campus</a></main></body></html>`,{status:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-civweave-canonical-navigation':REVISION,'x-civweave-runtime-source':'package-miss'}})
}
self.addEventListener('install',event=>{event.waitUntil(precacheCanonicalRoutes().catch(()=>[]))});
networkFirst=async function canonicalFiveSystemPackageFirst(request,fallbackPath='/offline.html'){
  if(!canonical(request))return originalNetworkFirst(request,fallbackPath);
  const pathname=new URL(request.url).pathname,cached=await currentPackage(pathname),normalized=await normalize(cached,request);
  if(normalized)return normalized;
  return recoveryPage(pathname);
};
self.CivweaveCanonicalNavigationV227=Object.freeze({revision:REVISION,routeScript:ROUTE_SCRIPT,routes:routes?.routes?.().map(route=>route.pathname)||[],policy:'exact-route-current-package-first-no-live-network-runtime-fallback',packageHeader:true,precache:true,precacheCount:6,runtimeNetworkFallback:false});
})();
