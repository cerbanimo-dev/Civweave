;(()=>{
'use strict';

const LUD_REVISION='lud-package-v1.1-game-ui';
const LUD_MANIFEST_URL='/app/lud-package-v1.json';
const LUD_META_URL='/__civweave/lud-package-v1.json';
const LUD_ENTRY_ASSET='/app/lud/campus.html';
const LUD_ENTRY_ROUTE='/app/lud/campus';
const LUD_STANDALONE=typeof OFFLINE_CACHE!=='string';
const LUD_CACHE_NAME=LUD_STANDALONE?'civweave-lud-v1':OFFLINE_CACHE;
const LUD_INSTALLER_PATHS=new Set([
  '/app/lud/',
  '/app/lud/index.html',
  '/app/lud-installer-v1.js',
  '/app/lud-mode-v1.js',
  LUD_MANIFEST_URL,
  '/service-worker-lud-package-v1.js'
]);
const LUD_NETWORK_PATHS=new Set([
  '/api/federation/health',
  '/.well-known/civweave',
  '/api/host-node-status',
  '/api/host-node-search',
  '/api/ai/node/session',
  '/api/commerce/membership/prejoin',
  '/api/federation/capacity',
  '/api/federation/residents/admit',
  '/api/node/human-validation/request',
  '/api/node/human-validation/claim',
  '/api/node/human-validation/status'
]);
let ludDownloadPromise=null;
const ludNow=()=>new Date().toISOString();
const ludUnique=values=>[...new Set((Array.isArray(values)?values:[]).filter(Boolean).map(String))];
const ludKey=pathname=>new Request(new URL(pathname,self.location.origin).href,{method:'GET'});
function ludPost(event,payload){try{post(event,payload)}catch{try{event.ports?.[0]?.postMessage?.(payload)}catch{}try{event.source?.postMessage?.(payload)}catch{}}}
async function ludBroadcast(payload){try{const clients=await self.clients?.matchAll?.({type:'window',includeUncontrolled:true})||[];for(const client of clients)try{client.postMessage(payload)}catch{}}catch{}return payload}
function ludPacket(value={}){return{type:'CIVWEAVE_LUD_PACKAGE_STATUS',mode:'lud',revision:LUD_REVISION,version:typeof VERSION==='string'?VERSION:'lud-v1',cache:LUD_CACHE_NAME,ready:Boolean(value.ready),running:Boolean(value.running),downloaded:Number(value.downloaded||0),total:Number(value.total||0),bytes:Number(value.bytes||0),failed:Array.isArray(value.failed)?value.failed:[],failedCount:Array.isArray(value.failed)?value.failed.length:0,entry:value.entry||LUD_ENTRY_ASSET,entryRoute:value.entryRoute||LUD_ENTRY_ROUTE,assets:ludUnique(value.assets),updatedAt:value.updatedAt||null}}
async function ludCache(){return caches.open(LUD_CACHE_NAME)}
async function readLudMeta(){try{const response=await(await ludCache()).match(ludKey(LUD_META_URL),{ignoreSearch:true});return response?await response.json():null}catch{return null}}
async function writeLudMeta(value){const packet=ludPacket(value);await(await ludCache()).put(ludKey(LUD_META_URL),new Response(JSON.stringify(packet),{headers:{'content-type':'application/json','cache-control':'no-store'}}));return packet}
async function normalizeLudHtmlResponse(response){
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('location');
  if(!headers.get('content-type'))headers.set('content-type','text/html; charset=utf-8');
  headers.set('cache-control','no-store');
  headers.set('x-civweave-lud-entry','canonical-route-v1');
  const body=await response.clone().arrayBuffer();
  return new Response(body,{status:200,statusText:'OK',headers});
}
async function loadLudManifest(){
  const response=await fetch(LUD_MANIFEST_URL,{cache:'no-store'});if(!response.ok)throw new Error(`Lud manifest returned ${response.status}.`);
  const manifest=await response.json();if(manifest?.schema!=='civweave.lud-package.v1'||manifest?.mode!=='lud'||manifest?.policy?.aiGeneration!==false||manifest?.policy?.recursiveDiscovery!==false||manifest?.policy?.generatedVisualAssets!==false)throw new Error('Lud manifest policy is invalid.');
  const assets=ludUnique(manifest.assets),forbidden=ludUnique(manifest.forbiddenPathFragments).map(value=>value.toLowerCase());if(!assets.length)throw new Error('Lud manifest has no assets.');
  for(const asset of assets){let url;try{url=new URL(asset,self.location.origin)}catch{throw new Error(`Invalid Lud asset: ${asset}`)}if(url.origin!==self.location.origin||!url.pathname.startsWith('/'))throw new Error(`Lud asset leaves the Civweave origin: ${asset}`);const lower=url.pathname.toLowerCase();const blocked=forbidden.find(fragment=>lower.includes(fragment));if(blocked)throw new Error(`Lud manifest rejected forbidden path ${asset} (${blocked}).`)}
  return{...manifest,assets,entry:String(manifest.entry||LUD_ENTRY_ASSET),entryRoute:String(manifest.entryRoute||LUD_ENTRY_ROUTE)};
}
async function ludStatus(){const meta=await readLudMeta();if(meta?.revision===LUD_REVISION)return ludPacket(meta);try{const manifest=await loadLudManifest();return ludPacket({ready:false,running:false,downloaded:0,total:manifest.assets.length,assets:manifest.assets,entry:manifest.entry,entryRoute:manifest.entryRoute})}catch(error){return ludPacket({ready:false,running:false,downloaded:0,total:0,failed:[{pathname:'manifest',message:String(error?.message||error)}]})}}
async function downloadLud(event){
  const manifest=await loadLudManifest(),cache=await ludCache(),failed=[],downloadedAssets=[];let bytes=0;
  let packet=await writeLudMeta({ready:false,running:true,downloaded:0,total:manifest.assets.length,assets:manifest.assets,entry:manifest.entry,entryRoute:manifest.entryRoute,failed,bytes,updatedAt:ludNow()});ludPost(event,{...packet,type:'CIVWEAVE_LUD_PACKAGE_PROGRESS'});await ludBroadcast({...packet,type:'CIVWEAVE_LUD_PACKAGE_PROGRESS'});
  for(const pathname of manifest.assets){try{const response=await fetch(pathname,{cache:'reload'});if(!response.ok)throw new Error(`${pathname} returned ${response.status}.`);const type=String(response.headers.get('content-type')||'');if(/\.(?:js|html)$/i.test(pathname)&&/text\/html/i.test(type)&&!/\.html$/i.test(pathname))throw new Error(`${pathname} returned HTML instead of its required asset type.`);const length=Number(response.headers.get('content-length')||0);if(Number.isFinite(length)&&length>0)bytes+=length;const stored=/\.html$/i.test(pathname)?await normalizeLudHtmlResponse(response):response.clone();await cache.put(ludKey(pathname),stored);downloadedAssets.push(pathname)}catch(error){failed.push({pathname,message:String(error?.message||error)});break}packet=await writeLudMeta({ready:false,running:true,downloaded:downloadedAssets.length,total:manifest.assets.length,assets:manifest.assets,entry:manifest.entry,entryRoute:manifest.entryRoute,failed,bytes,updatedAt:ludNow()});const progress={...packet,type:'CIVWEAVE_LUD_PACKAGE_PROGRESS'};ludPost(event,progress);await ludBroadcast(progress)}
  const ready=failed.length===0&&downloadedAssets.length===manifest.assets.length;packet=await writeLudMeta({ready,running:false,downloaded:downloadedAssets.length,total:manifest.assets.length,assets:manifest.assets,entry:manifest.entry,entryRoute:manifest.entryRoute,failed,bytes,updatedAt:ludNow()});ludPost(event,packet);await ludBroadcast(packet);return packet;
}
function startLudDownload(event){if(ludDownloadPromise)return ludDownloadPromise.then(packet=>{ludPost(event,packet);return packet});ludDownloadPromise=downloadLud(event).finally(()=>{ludDownloadPromise=null});return ludDownloadPromise}
async function clearLud(){const cache=await ludCache();const meta=await readLudMeta();for(const pathname of meta?.assets||[])try{await cache.delete(ludKey(pathname),{ignoreSearch:true})}catch{}await cache.delete(ludKey(LUD_META_URL),{ignoreSearch:true});return ludStatus()}
async function standaloneAssetPolicy(){
  const meta=await readLudMeta();
  if(meta?.revision===LUD_REVISION&&Array.isArray(meta?.assets)&&meta.assets.length)return{assets:new Set(ludUnique(meta.assets)),entry:String(meta.entry||LUD_ENTRY_ASSET),entryRoute:String(meta.entryRoute||LUD_ENTRY_ROUTE),ready:Boolean(meta.ready)};
  try{const manifest=await loadLudManifest();return{assets:new Set(manifest.assets),entry:manifest.entry,entryRoute:manifest.entryRoute,ready:false}}catch{return{assets:new Set(),entry:LUD_ENTRY_ASSET,entryRoute:LUD_ENTRY_ROUTE,ready:false}}
}
function ludOfflineError(message,status=503){return new Response(message,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}})}
async function fetchLudEntry(){
  for(const pathname of [LUD_ENTRY_ROUTE,LUD_ENTRY_ASSET]){
    try{
      const request=new Request(new URL(pathname,self.location.origin).href,{method:'GET',cache:'no-store',credentials:'same-origin'});
      const response=await fetch(request);
      if(response.ok)return normalizeLudHtmlResponse(response);
    }catch{}
  }
  return null;
}
async function networkOnly(request,pathname){
  try{return await fetch(request)}catch{return ludOfflineError(`Lud Mode network service is unavailable offline: ${pathname}`,503)}
}
async function standaloneFetch(request){
  const url=new URL(request.url);
  if(request.method!=='GET'&&request.method!=='POST')return fetch(request);
  if(url.origin!==self.location.origin)return fetch(request);
  const pathname=url.pathname,cache=await ludCache(),policy=await standaloneAssetPolicy();
  if(LUD_NETWORK_PATHS.has(pathname))return networkOnly(request,pathname);
  if(request.method!=='GET')return ludOfflineError(`Lud Mode blocked a non-allowlisted request: ${pathname}`,403);
  if(request.mode==='navigate'){
    if(pathname==='/app/lud/'||pathname==='/app/lud/index.html'){
      try{const response=await fetch(request);if(response.ok)return response}catch{}
      if(policy.ready){const cached=await cache.match(ludKey(policy.entry),{ignoreSearch:true});if(cached)return normalizeLudHtmlResponse(cached)}
      return ludOfflineError('Lud Mode is not ready offline on this device. Reconnect and finish Download Lud Mode.');
    }
    if(pathname===policy.entryRoute||pathname===LUD_ENTRY_ROUTE||pathname===policy.entry||pathname===LUD_ENTRY_ASSET){
      const network=await fetchLudEntry();
      if(network){try{await cache.put(ludKey(policy.entry||LUD_ENTRY_ASSET),network.clone())}catch{}return network}
      const cached=await cache.match(ludKey(policy.entry),{ignoreSearch:true})||await cache.match(ludKey(LUD_ENTRY_ASSET),{ignoreSearch:true});if(cached)return normalizeLudHtmlResponse(cached);
      return ludOfflineError('The Lud Mode campus is not cached on this device.');
    }
    if(pathname.startsWith('/app/lud/'))return ludOfflineError(`Lud Mode blocked a non-allowlisted navigation: ${pathname}`,403);
    return fetch(request);
  }
  if(policy.assets.has(pathname)){
    try{const response=await fetch(request);if(response.ok){try{await cache.put(ludKey(pathname),response.clone())}catch{}return response}}catch{}
    const cached=await cache.match(ludKey(pathname),{ignoreSearch:true});if(cached)return cached;
    return ludOfflineError(`Lud Mode required asset is unavailable: ${pathname}`,504);
  }
  if(LUD_INSTALLER_PATHS.has(pathname)){try{return await fetch(request)}catch{return ludOfflineError(`Lud Mode installer asset is unavailable: ${pathname}`,504)}}
  return ludOfflineError(`Lud Mode blocked a non-allowlisted request: ${pathname}`,403);
}
self.addEventListener('message',event=>{const type=event.data?.type;if(type==='SKIP_WAITING'){event.waitUntil(self.skipWaiting());return}if(type==='GET_LUD_PACKAGE_STATUS')event.waitUntil(ludStatus().then(packet=>ludPost(event,packet)));else if(type==='DOWNLOAD_LUD_PACKAGE')event.waitUntil(startLudDownload(event));else if(type==='CLEAR_LUD_PACKAGE')event.waitUntil(clearLud().then(packet=>ludPost(event,packet)))});
if(LUD_STANDALONE){
  self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
  self.addEventListener('fetch',event=>event.respondWith((async()=>{try{return await standaloneFetch(event.request)}catch(error){return ludOfflineError(`Lud Mode request failed safely: ${String(error?.message||error)}`,event.request.mode==='navigate'?503:504)}})()));
}
})();
