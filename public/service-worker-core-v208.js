'use strict';

const VERSION='1.0.160';
const BUILD='lightweight-shell-v208-interface-rebase-v1';
const SHELL_CACHE=`civweave-shell-${VERSION}-${BUILD}`;
const RUNTIME_CACHE=`civweave-runtime-${VERSION}-${BUILD}`;
const OFFLINE_CACHE=`civweave-offline-${VERSION}-${BUILD}`;
const MODEL_CACHE='civweave-model-generative-v266';
const OFFLINE_MANIFEST_URL='/app/offline-package-v208.json';
const OFFLINE_META_URL='/__civweave/offline-package-v208.json';
const FETCH_TIMEOUT_MS=12000;
const OPEN_MEDIA_ROUTE_PREFIX='/__civweave_open_media__/';
const OPEN_MEDIA_CACHE='cw-open-learning-media-v1';

const REQUIRED_SHELL_ASSETS=[
  '/index.html',
  '/install-v130.css',
  '/install-v130.js',
  '/offline.html',
  '/app/manifest.webmanifest',
  '/app/index.html',
  '/app/installed-entry-v146.html',
  '/app/installed-entry-v146.js',
  '/app/legal-consent-v1.js',
  '/legal/civweave-legal-release-v1.json',
  '/app/working-campus-v156.html',
  '/app/working-campus-v156.css',
  '/app/system-interface-v157.css',
  '/app/working-campus-v156.js',
  '/app/system-routes-v227.js',
  '/app/settings-gateway-v317.js',
  '/app/model-settings-controller-v173.js',
  '/app/family-ai-loader-v105.js',
  '/app/fullscreen-family-v104.html',
  '/app/logos/civweave-icon-192.png',
  '/app/logos/civweave-icon-512.png',
  '/app/logos/civweave-pwa-192-v247.png',
  '/app/logos/civweave-prismatic-wordmark-v1.png',
  '/app/logos/cerbanimo-steward-mark-v1.png'
];
const OPTIONAL_SHELL_ASSETS=[
  '/app/low-end-device-lab-v1.html',
  '/app/low-end-device-lab-v1.js',
  '/app/local-ai/model-registry-v266.js',
  '/app/local-ai/download-manager-v267.js',
  '/app/local-ai/settings-panel-v267.js',
  '/app/local-ai/runtime-v266.js',
  '/app/minilm-context-router-v344.js',
  '/app/models/all-minilm-l6-v2/adapter.js',
  '/app/open-learning-media-cache-v1.mjs',
  '/app/open-learning-media-installer-v1.mjs',
  '/app/offline-package-v208.json',
  '/app/logos/civweave-app-icon.png',
  '/app/logos/civweave-icon-maskable-192.png',
  '/app/logos/civweave-icon-maskable-512.png'
];
const SHELL_ASSETS=[...REQUIRED_SHELL_ASSETS,...OPTIONAL_SHELL_ASSETS];
const MODEL_PREFIXES=['/app/models/','/app/vendor/onnxruntime/'];
const COMPAT_ENTRY_PATHS=new Set(['/app/installed-entry-v146.html','/app/installed-entry-v146','/app/fullscreen-family-v104.html','/app/fullscreen-family-v104']);
const WORKER_PATHS=new Set(['/service-worker.js','/service-worker-v156.js','/service-worker-v203.js']);
const PRESERVE_CACHE_PREFIXES=['cw-open-learning-media-','cwknowledge-','cwupdate-','civweave-model-','civweave-offline-'];

function post(event,packet){
  try{event.ports?.[0]?.postMessage(packet)}catch{}
  try{event.source?.postMessage?.(packet)}catch{}
}
function timeout(promise,ms=FETCH_TIMEOUT_MS){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(`Timed out after ${ms} ms`)),ms);
    Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)});
  });
}
function cacheKey(pathname){return new Request(new URL(pathname,self.location.origin).href,{method:'GET'})}
function valid(response,pathname=''){
  if(!response?.ok)return false;
  const type=String(response.headers.get('content-type')||'');
  if(pathname.endsWith('.html'))return /text\/html/i.test(type)||!type;
  if(/\.(?:m?js)$/i.test(pathname))return !/text\/html/i.test(type);
  if(pathname.endsWith('.css'))return !/text\/html/i.test(type);
  return true;
}
async function fetchFresh(pathname,purpose='runtime',ms=FETCH_TIMEOUT_MS){
  const request=new Request(new URL(pathname,self.location.origin).href,{cache:'no-store',credentials:'same-origin',headers:{'x-civweave-package':purpose}});
  const response=await timeout(fetch(request),ms);
  if(!valid(response,new URL(request.url).pathname))throw new Error(`${pathname} returned ${response?.status||'no response'}`);
  return response;
}
async function put(cacheName,pathname,response){
  await (await caches.open(cacheName)).put(cacheKey(pathname),response.clone());
  return response;
}
async function findCached(pathname){
  for(const name of [SHELL_CACHE,RUNTIME_CACHE,OFFLINE_CACHE,MODEL_CACHE]){
    const response=await (await caches.open(name)).match(cacheKey(pathname),{ignoreSearch:true});
    if(valid(response,pathname))return response;
  }
  const response=await caches.match(cacheKey(pathname),{ignoreSearch:true});
  return valid(response,pathname)?response:null;
}
async function cacheShell(){
  const failures=[];
  for(let index=0;index<SHELL_ASSETS.length;index+=4){
    const batch=SHELL_ASSETS.slice(index,index+4);
    const settled=await Promise.allSettled(batch.map(async pathname=>put(SHELL_CACHE,pathname,await fetchFresh(pathname,'shell-install'))));
    settled.forEach((result,offset)=>{if(result.status==='rejected')failures.push({pathname:batch[offset],message:String(result.reason?.message||result.reason)})});
  }
  const required=failures.filter(item=>REQUIRED_SHELL_ASSETS.includes(item.pathname));
  if(required.length){
    const error=new Error(`App shell incomplete: ${required.length}/${REQUIRED_SHELL_ASSETS.length} required files failed.`);
    error.failures=required;
    throw error;
  }
  return{optionalFailures:failures.filter(item=>OPTIONAL_SHELL_ASSETS.includes(item.pathname))};
}
async function cleanCaches(){
  const keep=new Set([SHELL_CACHE,RUNTIME_CACHE,OFFLINE_CACHE,MODEL_CACHE]);
  for(const name of await caches.keys()){
    if(keep.has(name)||PRESERVE_CACHE_PREFIXES.some(prefix=>name.startsWith(prefix)))continue;
    if(/^(?:civweave-(?:shell|runtime|static)|cw(?:ext|boot|img)|living-school-|cerbanimo-|fellowfare-|anarchadia-)/.test(name))await caches.delete(name);
  }
}
async function shellStatus(){
  const cache=await caches.open(SHELL_CACHE);
  const missing=[];
  const optionalMissing=[];
  for(const pathname of REQUIRED_SHELL_ASSETS)if(!valid(await cache.match(cacheKey(pathname),{ignoreSearch:true}),pathname))missing.push(pathname);
  for(const pathname of OPTIONAL_SHELL_ASSETS)if(!valid(await cache.match(cacheKey(pathname),{ignoreSearch:true}),pathname))optionalMissing.push(pathname);
  return{
    type:'CIVWEAVE_DEVICE_PACKAGE',
    mode:'lightweight-shell',
    version:VERSION,
    revision:BUILD,
    cache:SHELL_CACHE,
    ready:missing.length===0,
    assetCount:REQUIRED_SHELL_ASSETS.length,
    presentCount:REQUIRED_SHELL_ASSETS.length-missing.length,
    optionalAssetCount:OPTIONAL_SHELL_ASSETS.length,
    optionalPresentCount:OPTIONAL_SHELL_ASSETS.length-optionalMissing.length,
    missing,
    optionalMissing,
    offlinePackageOptional:true,
    modelOnDemand:true,
    knowledgeLibrarySeparate:true
  };
}

async function writeOfflineMeta(value){
  const body=JSON.stringify({...value,updatedAt:new Date().toISOString()});
  await (await caches.open(OFFLINE_CACHE)).put(cacheKey(OFFLINE_META_URL),new Response(body,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}}));
  return value;
}
async function readOfflineMeta(){
  const response=await (await caches.open(OFFLINE_CACHE)).match(cacheKey(OFFLINE_META_URL),{ignoreSearch:true});
  if(!response)return null;
  try{return await response.json()}catch{return null}
}
async function offlineManifest(){
  const cached=await findCached(OFFLINE_MANIFEST_URL);
  try{
    const fresh=await fetchFresh(OFFLINE_MANIFEST_URL,'offline-manifest');
    await put(OFFLINE_CACHE,OFFLINE_MANIFEST_URL,fresh);
    return await fresh.clone().json();
  }catch{
    if(cached)return cached.clone().json();
    throw new Error('Offline campus manifest is unavailable.');
  }
}
function offlinePacket(meta={}){
  const assets=Array.isArray(meta.assets)?meta.assets:[];
  const failed=Array.isArray(meta.failed)?meta.failed:[];
  return{
    type:'CIVWEAVE_OFFLINE_PACKAGE_STATUS',
    mode:'explicit-manifest-download',
    version:VERSION,
    revision:BUILD,
    cache:OFFLINE_CACHE,
    ready:Boolean(meta.ready),
    running:Boolean(meta.running),
    completed:Number(meta.completed||0),
    total:Number(meta.total||assets.length),
    failed,
    failedCount:failed.length,
    bytes:Number(meta.bytes||0),
    updatedAt:meta.updatedAt||null,
    assets
  };
}
async function offlineStatus(){
  const prior=await readOfflineMeta();
  if(prior)return offlinePacket(prior);
  const manifest=await offlineManifest().catch(()=>({seeds:[]}));
  return offlinePacket({ready:false,running:false,completed:0,total:manifest.seeds?.length||0,assets:manifest.seeds||[],failed:[],bytes:0});
}
async function downloadOfflinePackage(event){
  const manifest=await offlineManifest();
  const assets=[...new Set((manifest.seeds||[]).filter(item=>typeof item==='string'&&item.startsWith('/')))].slice(0,1500);
  const cache=await caches.open(OFFLINE_CACHE);
  const failed=[];
  let completed=0;
  let bytes=0;
  const report=async(running,ready)=>{
    const packet=offlinePacket({running,ready,completed,total:assets.length,assets,failed,bytes,updatedAt:new Date().toISOString()});
    await writeOfflineMeta(packet);
    post(event,{...packet,type:running?'CIVWEAVE_OFFLINE_PACKAGE_PROGRESS':packet.type});
    return packet;
  };
  await report(true,false);
  for(let index=0;index<assets.length;index+=4){
    const batch=assets.slice(index,index+4);
    const settled=await Promise.allSettled(batch.map(async pathname=>{
      let response=await findCached(pathname);
      try{response=await fetchFresh(pathname,'offline-campus')}catch{}
      if(!valid(response,pathname))throw new Error(`${pathname} is unavailable.`);
      await cache.put(cacheKey(pathname),response.clone());
      bytes+=Number(response.headers.get('content-length')||0);
      completed+=1;
    }));
    settled.forEach((result,offset)=>{if(result.status==='rejected'){completed+=1;failed.push({pathname:batch[offset],message:String(result.reason?.message||result.reason)})}});
    await report(true,false);
  }
  return report(false,failed.length===0);
}

async function networkFirst(request,fallbackPath='/offline.html'){
  const pathname=new URL(request.url).pathname;
  try{
    const response=await timeout(fetch(new Request(request,{cache:'no-store'})),7000);
    if(valid(response,pathname)){
      if(request.method==='GET')await put(RUNTIME_CACHE,pathname,response);
      return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response;
    }
  }catch{}
  const cached=await findCached(pathname)||await findCached(fallbackPath);
  if(cached)return request.method==='HEAD'?new Response(null,{status:cached.status,headers:cached.headers}):cached;
  return new Response('Civweave is offline and this room has not been downloaded yet.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
}
async function cacheFirst(request){
  const pathname=new URL(request.url).pathname;
  const cached=await findCached(pathname);
  if(cached){
    if(request.method==='GET')fetch(new Request(request,{cache:'no-store'})).then(response=>valid(response,pathname)?put(RUNTIME_CACHE,pathname,response):null).catch(()=>{});
    return request.method==='HEAD'?new Response(null,{status:cached.status,headers:cached.headers}):cached;
  }
  try{
    const response=await fetch(new Request(request,{cache:'no-store'}));
    if(valid(response,pathname)&&request.method==='GET')await put(RUNTIME_CACHE,pathname,response);
    return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response;
  }catch{
    return new Response(`Civweave asset unavailable: ${pathname}`,{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
  }
}
async function normalizeStableAppEntryResponse(response){
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('location');
  headers.set('content-type','text/html; charset=utf-8');
  headers.set('cache-control','no-store');
  headers.set('x-civweave-stable-entry','interface-rebase-v1');
  return new Response(await response.clone().arrayBuffer(),{status:200,statusText:'OK',headers});
}
async function stableAppEntry(request){
  let response=await findCached('/app/installed-entry-v146.html');
  if(!response)try{response=await put(SHELL_CACHE,'/app/installed-entry-v146.html',await fetchFresh('/app/installed-entry-v146.html','installed-entry'))}catch{}
  if(!response)return new Response('Civweave installed entry is unavailable.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  const normalized=await normalizeStableAppEntryResponse(response);
  return request.method==='HEAD'?new Response(null,{status:200,headers:normalized.headers}):normalized;
}
async function modelOnDemand(request){
  const pathname=new URL(request.url).pathname;
  const cache=await caches.open(MODEL_CACHE);
  const cached=await cache.match(cacheKey(pathname),{ignoreSearch:true});
  if(cached)return cached;
  try{
    const response=await fetch(new Request(request,{cache:'no-store'}));
    if(!valid(response,pathname))throw new Error(`${pathname} returned ${response?.status||'no response'}`);
    if(request.method==='GET')await cache.put(cacheKey(pathname),response.clone());
    return response;
  }catch(error){
    return new Response(`Local model asset unavailable: ${error?.message||error}`,{status:503,headers:{'content-type':'text/plain; charset=utf-8','x-civweave-model-package':'not-installed'}});
  }
}

self.addEventListener('install',event=>{event.waitUntil(cacheShell())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{await cleanCaches();await self.clients.claim()})())});
self.addEventListener('message',event=>{
  const type=event.data?.type;
  if(type==='SKIP_WAITING'){event.waitUntil(self.skipWaiting());return}
  if(type==='GET_VERSION'){post(event,{type:'CIVWEAVE_VERSION',version:VERSION,revision:BUILD,installMode:'lightweight-shell',offlinePackageOptional:true});return}
  if(type==='GET_DEVICE_PACKAGE_STATUS'){event.waitUntil(shellStatus().then(packet=>post(event,packet)));return}
  if(type==='GET_OFFLINE_PACKAGE_STATUS'){event.waitUntil(offlineStatus().then(packet=>post(event,packet)));return}
  if(type==='DOWNLOAD_OFFLINE_PACKAGE'){event.waitUntil(downloadOfflinePackage(event));return}
  if(type==='CLEAR_OFFLINE_PACKAGE'){event.waitUntil(caches.delete(OFFLINE_CACHE).then(()=>offlineStatus()).then(packet=>post(event,packet)));return}
  if(type==='GET_SHARED_IMAGE_STATUS'){post(event,{type:'CIVWEAVE_SHARED_IMAGE_STATUS',version:BUILD,mode:'on-demand',ready:true,present:0,total:0,missing:[]});return}
  if(type==='GET_CRITICAL_BOOT_STATUS'){post(event,{type:'CIVWEAVE_CRITICAL_BOOT_STATUS',version:BUILD,mode:'on-demand',ready:true,present:0,total:0,missing:[]});return}
  if(type==='GET_ADDITIONS_STATUS')post(event,{type:'CIVWEAVE_ADDITIONS_STATUS',version:BUILD,mode:'on-demand',ready:true,assetCount:0,presentCount:0,missing:[]});
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(!['GET','HEAD'].includes(request.method))return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(url.pathname.startsWith(OPEN_MEDIA_ROUTE_PREFIX)){
    event.respondWith((async()=>{
      const cached=await (await caches.open(OPEN_MEDIA_CACHE)).match(new Request(url.href,{method:'GET'}));
      return cached||new Response('Open learning media is not cached on this device.',{status:404,headers:{'content-type':'text/plain; charset=utf-8'}});
    })());
    return;
  }
  if(WORKER_PATHS.has(url.pathname)){event.respondWith(fetch(request,{cache:'no-store'}));return}
  if(MODEL_PREFIXES.some(prefix=>url.pathname.startsWith(prefix))){event.respondWith(modelOnDemand(request));return}
  if(request.mode==='navigate'&&COMPAT_ENTRY_PATHS.has(url.pathname)){event.respondWith(stableAppEntry(request));return}
  if(request.mode==='navigate'||url.pathname==='/'||url.pathname==='/index.html'){event.respondWith(networkFirst(request,url.pathname==='/'?'/index.html':'/offline.html'));return}
  if(url.pathname.startsWith('/app/')||url.pathname.startsWith('/extensions/')||url.pathname==='/offline.html'||url.pathname.startsWith('/install-'))event.respondWith(cacheFirst(request));
});
