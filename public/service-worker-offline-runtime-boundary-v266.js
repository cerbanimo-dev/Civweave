;(()=>{
'use strict';

const REVISION='offline-runtime-boundary-v266';
const routes=self.CivweaveSystemRoutesV227;
const rawRelease=(()=>{try{return new URL(self.location.href).searchParams.get('v')||''}catch{return''}})();
const RELEASE=(rawRelease.match(/^(\d+\.\d+\.\d+)/)||[])[1]||'1.0.58';
const PACKAGE_PREFIXES=[`civweave-offline-${RELEASE}-`,`civweave-shell-${RELEASE}-`,`civweave-runtime-${RELEASE}-`];
const STATIC_PREFIXES=['/app/','/extensions/'];

function canonicalPath(value){
  try{return Boolean(routes?.identify?.(new URL(value,self.location.origin).pathname))}catch{return false}
}
function currentPackageCache(name){return PACKAGE_PREFIXES.some(prefix=>String(name||'').startsWith(prefix))}
async function packageCaches(){
  const names=(await caches.keys()).filter(currentPackageCache);
  const rank=name=>name.startsWith(`civweave-offline-${RELEASE}-`)?0:name.startsWith(`civweave-shell-${RELEASE}-`)?1:2;
  return names.sort((a,b)=>rank(a)-rank(b));
}
async function findCurrentPackage(request){
  const url=new URL(typeof request==='string'?request:request.url,self.location.origin);
  const key=new Request(url.origin+url.pathname,{method:'GET'});
  for(const name of await packageCaches()){
    const cache=await caches.open(name);
    const response=await cache.match(key,{ignoreSearch:true});
    if(response?.ok)return response;
  }
  return null;
}
function normalized(response,kind='asset'){
  if(!response)return null;
  const headers=new Headers(response.headers);
  headers.set('x-civweave-runtime-source','downloaded-package');
  headers.set('x-civweave-offline-runtime',REVISION);
  headers.set('x-civweave-release',RELEASE);
  if(kind==='document'&&!headers.get('content-type'))headers.set('content-type','text/html; charset=utf-8');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
function missingAsset(pathname){
  return new Response(`Civweave blocked a live-network fallback because ${pathname} is missing from the downloaded v${RELEASE} package. Return to the installer/updater to repair the device package.`,{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-civweave-runtime-source':'package-miss','x-civweave-offline-runtime':REVISION}});
}
function recoveryPage(pathname){
  const installer=new URL('/app/index.html',self.location.origin);
  installer.searchParams.set('repair','offline-package');
  installer.searchParams.set('next',pathname);
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Civweave package repair</title><style>html,body{margin:0;min-height:100%;background:#07131e;color:#f5f7ff;font:16px/1.5 system-ui}main{max-width:42rem;margin:auto;padding:12vh 1.25rem}a{display:inline-block;padding:.8rem 1rem;border-radius:.8rem;background:#1c3559;color:#fff;text-decoration:none}</style></head><body><main><h1>Downloaded campus needs repair</h1><p>Civweave refused to substitute the hosted website for a missing local route. Repair or finish the v${RELEASE} campus package, then reopen it.</p><a href="${installer.pathname}${installer.search}">Open installer / updater</a></main></body></html>`,{status:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-civweave-runtime-source':'package-miss','x-civweave-offline-runtime':REVISION}});
}
async function clientIsCanonical(event){
  const id=event.clientId||event.resultingClientId;
  if(!id)return false;
  try{const client=await self.clients.get(id);return Boolean(client&&canonicalPath(client.url))}catch{return false}
}
async function serve(event){
  const request=event.request,url=new URL(request.url);
  if(url.origin!==self.location.origin)return null;
  if(request.mode==='navigate'&&canonicalPath(url.href)){
    const cached=await findCurrentPackage(request);
    return cached?normalized(cached,'document'):recoveryPage(url.pathname);
  }
  if(!STATIC_PREFIXES.some(prefix=>url.pathname.startsWith(prefix)))return null;
  if(!await clientIsCanonical(event))return null;
  const cached=await findCurrentPackage(request);
  return cached?normalized(cached,'asset'):missingAsset(url.pathname);
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(!['GET','HEAD'].includes(request.method))return;
  const url=new URL(request.url);
  const canonicalNavigation=url.origin===self.location.origin&&request.mode==='navigate'&&canonicalPath(url.href);
  const maybeCanonicalAsset=url.origin===self.location.origin&&STATIC_PREFIXES.some(prefix=>url.pathname.startsWith(prefix));
  if(!canonicalNavigation&&!maybeCanonicalAsset)return;
  event.respondWith((async()=>{
    const response=await serve(event);
    if(response)return request.method==='HEAD'?new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers}):response;
    return fetch(request);
  })());
  event.stopImmediatePropagation();
});

self.CivweaveOfflineRuntimeBoundaryV266=Object.freeze({revision:REVISION,release:RELEASE,policy:'canonical-runtime-current-downloaded-package-only-no-live-site-fallback',canonicalPath,currentPackageCache,findCurrentPackage});
})();
