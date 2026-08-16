;(()=>{
'use strict';

const LUD_REVISION='lud-package-v1';
const LUD_MANIFEST_URL='/app/lud-package-v1.json';
const LUD_META_URL='/__civweave/lud-package-v1.json';
const LUD_CACHE_NAME=typeof OFFLINE_CACHE==='string'?OFFLINE_CACHE:'civweave-lud-v1';
let ludDownloadPromise=null;
const ludNow=()=>new Date().toISOString();
const ludUnique=values=>[...new Set((Array.isArray(values)?values:[]).filter(Boolean).map(String))];
function ludPost(event,payload){try{post(event,payload)}catch{try{event.ports?.[0]?.postMessage?.(payload)}catch{}try{event.source?.postMessage?.(payload)}catch{}}}
async function ludBroadcast(payload){try{const clients=await self.clients?.matchAll?.({type:'window',includeUncontrolled:true})||[];for(const client of clients)try{client.postMessage(payload)}catch{}}catch{}return payload}
function ludPacket(value={}){return{type:'CIVWEAVE_LUD_PACKAGE_STATUS',mode:'lud',revision:LUD_REVISION,version:typeof VERSION==='string'?VERSION:'lud-v1',cache:LUD_CACHE_NAME,ready:Boolean(value.ready),running:Boolean(value.running),downloaded:Number(value.downloaded||0),total:Number(value.total||0),bytes:Number(value.bytes||0),failed:Array.isArray(value.failed)?value.failed:[],failedCount:Array.isArray(value.failed)?value.failed.length:0,entry:value.entry||'/app/lud/campus.html',assets:ludUnique(value.assets),updatedAt:value.updatedAt||null}}
async function ludCache(){return caches.open(LUD_CACHE_NAME)}
async function readLudMeta(){try{const response=await(await ludCache()).match(LUD_META_URL);return response?await response.json():null}catch{return null}}
async function writeLudMeta(value){const packet=ludPacket(value);await(await ludCache()).put(LUD_META_URL,new Response(JSON.stringify(packet),{headers:{'content-type':'application/json','cache-control':'no-store'}}));return packet}
async function loadLudManifest(){
  const response=await fetch(LUD_MANIFEST_URL,{cache:'no-store'});if(!response.ok)throw new Error(`Lud manifest returned ${response.status}.`);
  const manifest=await response.json();if(manifest?.schema!=='civweave.lud-package.v1'||manifest?.mode!=='lud'||manifest?.policy?.aiGeneration!==false||manifest?.policy?.recursiveDiscovery!==false||manifest?.policy?.generatedVisualAssets!==false)throw new Error('Lud manifest policy is invalid.');
  const assets=ludUnique(manifest.assets),forbidden=ludUnique(manifest.forbiddenPathFragments).map(value=>value.toLowerCase());if(!assets.length)throw new Error('Lud manifest has no assets.');
  for(const asset of assets){let url;try{url=new URL(asset,self.location.origin)}catch{throw new Error(`Invalid Lud asset: ${asset}`)}if(url.origin!==self.location.origin||!url.pathname.startsWith('/'))throw new Error(`Lud asset leaves the Civweave origin: ${asset}`);const lower=url.pathname.toLowerCase();const blocked=forbidden.find(fragment=>lower.includes(fragment));if(blocked)throw new Error(`Lud manifest rejected forbidden path ${asset} (${blocked}).`)}
  return{...manifest,assets,entry:String(manifest.entry||'/app/lud/campus.html')};
}
async function ludStatus(){const meta=await readLudMeta();if(meta)return ludPacket(meta);try{const manifest=await loadLudManifest();return ludPacket({ready:false,running:false,downloaded:0,total:manifest.assets.length,assets:manifest.assets,entry:manifest.entry})}catch(error){return ludPacket({ready:false,running:false,downloaded:0,total:0,failed:[{pathname:'manifest',message:String(error?.message||error)}]})}}
async function downloadLud(event){
  const manifest=await loadLudManifest(),cache=await ludCache(),failed=[],downloadedAssets=[];let bytes=0;
  let packet=await writeLudMeta({ready:false,running:true,downloaded:0,total:manifest.assets.length,assets:manifest.assets,entry:manifest.entry,failed,bytes,updatedAt:ludNow()});ludPost(event,{...packet,type:'CIVWEAVE_LUD_PACKAGE_PROGRESS'});await ludBroadcast({...packet,type:'CIVWEAVE_LUD_PACKAGE_PROGRESS'});
  for(const pathname of manifest.assets){try{const response=await fetch(pathname,{cache:'reload'});if(!response.ok)throw new Error(`${pathname} returned ${response.status}.`);const type=String(response.headers.get('content-type')||'');if(/\.(?:js|html)$/i.test(pathname)&&/text\/html/i.test(type)&&!/\.html$/i.test(pathname))throw new Error(`${pathname} returned HTML instead of its required asset type.`);const length=Number(response.headers.get('content-length')||0);if(Number.isFinite(length)&&length>0)bytes+=length;await cache.put(pathname,response.clone());downloadedAssets.push(pathname)}catch(error){failed.push({pathname,message:String(error?.message||error)});break}packet=await writeLudMeta({ready:false,running:true,downloaded:downloadedAssets.length,total:manifest.assets.length,assets:manifest.assets,entry:manifest.entry,failed,bytes,updatedAt:ludNow()});const progress={...packet,type:'CIVWEAVE_LUD_PACKAGE_PROGRESS'};ludPost(event,progress);await ludBroadcast(progress)}
  const ready=failed.length===0&&downloadedAssets.length===manifest.assets.length;packet=await writeLudMeta({ready,running:false,downloaded:downloadedAssets.length,total:manifest.assets.length,assets:manifest.assets,entry:manifest.entry,failed,bytes,updatedAt:ludNow()});ludPost(event,packet);await ludBroadcast(packet);return packet;
}
function startLudDownload(event){if(ludDownloadPromise)return ludDownloadPromise.then(packet=>{ludPost(event,packet);return packet});ludDownloadPromise=downloadLud(event).finally(()=>{ludDownloadPromise=null});return ludDownloadPromise}
async function clearLud(){const cache=await ludCache();const meta=await readLudMeta();for(const pathname of meta?.assets||[])try{await cache.delete(pathname)}catch{}await cache.delete(LUD_META_URL);return ludStatus()}
self.addEventListener('message',event=>{const type=event.data?.type;if(type==='SKIP_WAITING'){event.waitUntil(self.skipWaiting());return}if(type==='GET_LUD_PACKAGE_STATUS')event.waitUntil(ludStatus().then(packet=>ludPost(event,packet)));else if(type==='DOWNLOAD_LUD_PACKAGE')event.waitUntil(startLudDownload(event));else if(type==='CLEAR_LUD_PACKAGE')event.waitUntil(clearLud().then(packet=>ludPost(event,packet)))});
})();
