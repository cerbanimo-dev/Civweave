;(()=>{
'use strict';

const LUDDITE_REVISION='luddite-package-v1';
const LUDDITE_MANIFEST_URL='/app/luddite-package-v1.json';
const LUDDITE_META_URL='/__civweave/luddite-package-v1.json';
let ludditeDownloadPromise=null;

const ludditeNow=()=>new Date().toISOString();
const ludditeUnique=values=>[...new Set((Array.isArray(values)?values:[]).filter(Boolean).map(String))];
function ludditePost(event,payload){try{post(event,payload)}catch{try{event.source?.postMessage?.(payload)}catch{}}}
async function ludditeBroadcast(payload){try{const clients=await self.clients?.matchAll?.({type:'window',includeUncontrolled:true})||[];for(const client of clients)try{client.postMessage(payload)}catch{}}catch{}return payload}
function ludditePacket(value={}){return{type:'CIVWEAVE_LUDDITE_PACKAGE_STATUS',mode:'luddite',revision:LUDDITE_REVISION,version:typeof VERSION==='string'?VERSION:'unknown',cache:typeof OFFLINE_CACHE==='string'?OFFLINE_CACHE:null,ready:Boolean(value.ready),running:Boolean(value.running),downloaded:Number(value.downloaded||0),total:Number(value.total||0),bytes:Number(value.bytes||0),failed:Array.isArray(value.failed)?value.failed:[],failedCount:Array.isArray(value.failed)?value.failed.length:0,entry:value.entry||'/app/luddite-campus-v1.html',assets:ludditeUnique(value.assets),updatedAt:value.updatedAt||null}}
async function ludditeCache(){return caches.open(OFFLINE_CACHE)}
async function readLudditeMeta(){try{const response=await(await ludditeCache()).match(LUDDITE_META_URL);return response?await response.json():null}catch{return null}}
async function writeLudditeMeta(value){const packet=ludditePacket(value);await(await ludditeCache()).put(LUDDITE_META_URL,new Response(JSON.stringify(packet),{headers:{'content-type':'application/json','cache-control':'no-store'}}));return packet}
async function loadLudditeManifest(){
  const response=await fetch(LUDDITE_MANIFEST_URL,{cache:'no-store'});if(!response.ok)throw new Error(`Luddite manifest returned ${response.status}.`);
  const manifest=await response.json();if(manifest?.schema!=='civweave.luddite-package.v1'||manifest?.mode!=='luddite'||manifest?.policy?.aiGeneration!==false||manifest?.policy?.recursiveDiscovery!==false)throw new Error('Luddite manifest policy is invalid.');
  const assets=ludditeUnique(manifest.assets),forbidden=ludditeUnique(manifest.forbiddenPathFragments).map(value=>value.toLowerCase());if(!assets.length)throw new Error('Luddite manifest has no assets.');
  for(const asset of assets){
    let url;try{url=new URL(asset,self.location.origin)}catch{throw new Error(`Invalid Luddite asset: ${asset}`)}
    if(url.origin!==self.location.origin||!url.pathname.startsWith('/'))throw new Error(`Luddite asset leaves the Civweave origin: ${asset}`);
    const lower=url.pathname.toLowerCase();const blocked=forbidden.find(fragment=>lower.includes(fragment));if(blocked)throw new Error(`Luddite manifest rejected AI/model path ${asset} (${blocked}).`);
  }
  return{...manifest,assets,entry:String(manifest.entry||'/app/luddite-campus-v1.html')};
}
async function ludditeStatus(){
  const meta=await readLudditeMeta();if(meta)return ludditePacket(meta);
  try{const manifest=await loadLudditeManifest();return ludditePacket({ready:false,running:false,downloaded:0,total:manifest.assets.length,assets:manifest.assets,entry:manifest.entry})}catch(error){return ludditePacket({ready:false,running:false,downloaded:0,total:0,failed:[{pathname:'manifest',message:String(error?.message||error)}]})}
}
async function downloadLuddite(event){
  const manifest=await loadLudditeManifest(),cache=await ludditeCache(),failed=[],downloadedAssets=[];let bytes=0;
  let packet=await writeLudditeMeta({ready:false,running:true,downloaded:0,total:manifest.assets.length,assets:manifest.assets,entry:manifest.entry,failed,bytes,updatedAt:ludditeNow()});ludditePost(event,{...packet,type:'CIVWEAVE_LUDDITE_PACKAGE_PROGRESS'});await ludditeBroadcast({...packet,type:'CIVWEAVE_LUDDITE_PACKAGE_PROGRESS'});
  for(const pathname of manifest.assets){
    try{
      const response=await fetch(pathname,{cache:'reload'});if(!response.ok)throw new Error(`${pathname} returned ${response.status}.`);
      const type=String(response.headers.get('content-type')||'');if(/\.(?:js|html|svg)$/i.test(pathname)&&/text\/html/i.test(type)&&!/\.html$/i.test(pathname))throw new Error(`${pathname} returned HTML instead of its required asset type.`);
      const length=Number(response.headers.get('content-length')||0);if(Number.isFinite(length)&&length>0)bytes+=length;
      await cache.put(pathname,response.clone());downloadedAssets.push(pathname);
    }catch(error){failed.push({pathname,message:String(error?.message||error)});break}
    packet=await writeLudditeMeta({ready:false,running:true,downloaded:downloadedAssets.length,total:manifest.assets.length,assets:manifest.assets,entry:manifest.entry,failed,bytes,updatedAt:ludditeNow()});const progress={...packet,type:'CIVWEAVE_LUDDITE_PACKAGE_PROGRESS'};ludditePost(event,progress);await ludditeBroadcast(progress);
  }
  const ready=failed.length===0&&downloadedAssets.length===manifest.assets.length;
  packet=await writeLudditeMeta({ready,running:false,downloaded:downloadedAssets.length,total:manifest.assets.length,assets:manifest.assets,entry:manifest.entry,failed,bytes,updatedAt:ludditeNow()});ludditePost(event,packet);await ludditeBroadcast(packet);return packet;
}
function startLudditeDownload(event){
  if(ludditeDownloadPromise)return ludditeDownloadPromise.then(packet=>{ludditePost(event,packet);return packet});
  ludditeDownloadPromise=downloadLuddite(event).finally(()=>{ludditeDownloadPromise=null});return ludditeDownloadPromise;
}
async function clearLuddite(){const cache=await ludditeCache();const meta=await readLudditeMeta();for(const pathname of meta?.assets||[])try{await cache.delete(pathname)}catch{}await cache.delete(LUDDITE_META_URL);return ludditeStatus()}
self.addEventListener('message',event=>{
  const type=event.data?.type;
  if(type==='GET_LUDDITE_PACKAGE_STATUS')event.waitUntil(ludditeStatus().then(packet=>ludditePost(event,packet)));
  else if(type==='DOWNLOAD_LUDDITE_PACKAGE')event.waitUntil(startLudditeDownload(event));
  else if(type==='CLEAR_LUDDITE_PACKAGE')event.waitUntil(clearLuddite().then(packet=>ludditePost(event,packet)));
});
})();
