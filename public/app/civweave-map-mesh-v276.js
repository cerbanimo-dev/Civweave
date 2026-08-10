(()=>{
'use strict';

const VERSION='1.0.75-civweave-map-mesh-v276';
const PACK_KIND='civweave.map-pack-advert.v1';
const LOCALITY_KIND='civweave.map-locality-batch.v1';
const NEED_KIND='civweave.map-region-need.v1';
const PACK_SCHEMA='civweave.map-pack-advert.v1';
const LOCALITY_SCHEMA='civweave.map-locality-batch.v1';
const NEED_SCHEMA='civweave.map-region-need.v1';
const CACHE_NAME='civweave-map-packs-v1';
const REGISTRY_KEY='civweave.map-pack-registry.v1';
const GATEWAY_KEY='civweave.map-mesh.gateway.v1';
const DEFAULT_SYNC_MS=120_000;
const MAX_LOCALITY_FEATURES=256;
const MAX_PACK_BYTES=1024*1024*1024;
let syncTimer=null;
let onlineHandler=null;
let gatewayUrl='';
let syncIntervalMs=DEFAULT_SYNC_MS;

const now=()=>new Date().toISOString();
const clone=value=>value==null?value:structuredClone(value);
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const loadJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const saveJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const uid=prefix=>`${prefix}:${crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;

function safeHttp(value,base=location.href){
  try{const url=new URL(String(value||''),base);return ['http:','https:'].includes(url.protocol)?url.href:''}catch{return''}
}
function normalizeBbox(value){
  if(!Array.isArray(value)||value.length!==4)return null;
  const box=value.map(finite);if(box.some(v=>v==null))return null;
  if(box[0]>box[2]||box[1]>box[3]||box[0]<-180||box[2]>180||box[1]<-90||box[3]>90)return null;
  return box;
}
function normalizePoint(feature){
  const coords=feature?.geometry?.type==='Point'&&Array.isArray(feature.geometry.coordinates)?feature.geometry.coordinates:null;
  if(!coords||coords.length<2)return null;
  const lon=finite(coords[0]),lat=finite(coords[1]);if(lon==null||lat==null||lon<-180||lon>180||lat<-90||lat>90)return null;
  const properties={...(feature.properties||{})};
  delete properties.preciseDeviceLocation;delete properties.privateAddress;delete properties.privateNotes;
  return {type:'Feature',id:feature.id||properties.id||undefined,geometry:{type:'Point',coordinates:[lon,lat]},properties};
}
async function ensureMesh(){
  if(globalThis.CivweaveLocalMeshV146)return globalThis.CivweaveLocalMeshV146;
  await new Promise((resolve,reject)=>{
    const src='/app/local-object-mesh-v146.js?v=map-mesh-v276';
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===new URL(src,location.href).pathname);
    if(existing){let ticks=0;const timer=setInterval(()=>{if(globalThis.CivweaveLocalMeshV146){clearInterval(timer);resolve()}else if(++ticks>160){clearInterval(timer);reject(new Error('Local object mesh did not become ready.'))}},50);return}
    const script=document.createElement('script');script.src=src;script.async=false;script.onload=resolve;script.onerror=()=>reject(new Error('Could not load the Civweave local object mesh.'));document.head.append(script);
  });
  if(!globalThis.CivweaveLocalMeshV146)throw new Error('Civweave local object mesh is unavailable.');
  return globalThis.CivweaveLocalMeshV146;
}
async function upsert({id,kind,purpose,payload,expiresAt=null,hopLimit=8}){
  const mesh=await ensureMesh();
  const previous=await mesh.getObject(id).catch(()=>null);
  return mesh.createObject({id,revision:Number(previous?.revision||0)+1,kind,purpose,consent:'federated',audience:[],payload:clone(payload),expiresAt,hopLimit,publish:true,parentIds:previous?.revisionHash?[previous.id]:[]});
}
function normalizePack(input={}){
  const packId=clean(input.packId||input.id,220);if(!packId)throw new TypeError('packId is required.');
  const format=clean(input.format||'pmtiles',40).toLowerCase();if(!['pmtiles','geojson','json','mbtiles-manifest'].includes(format))throw new TypeError('Unsupported map pack format.');
  const urls=[...new Set((Array.isArray(input.urls)?input.urls:[input.url]).map(value=>safeHttp(value)).filter(Boolean))].slice(0,8);
  if(!urls.length)throw new TypeError('At least one HTTP(S) map pack URL is required.');
  const bytes=Math.max(0,Math.trunc(finite(input.bytes)||0));if(bytes>MAX_PACK_BYTES)throw new RangeError('Advertised map pack exceeds the Civweave 1 GiB exchange ceiling.');
  return {schema:PACK_SCHEMA,packId,title:clean(input.title||packId,220),region:clean(input.region||'',220),bbox:normalizeBbox(input.bbox),minZoom:finite(input.minZoom),maxZoom:finite(input.maxZoom),format,bytes,sha256:clean(input.sha256||'',128).toLowerCase(),urls,source:clean(input.source||'Civweave node',300),sourceUrl:safeHttp(input.sourceUrl||''),license:clean(input.license||'',220),attribution:clean(input.attribution||'',500),capabilities:[...new Set((input.capabilities||['vector-basemap']).map(value=>clean(value,100)).filter(Boolean))].slice(0,20),generatedAt:input.generatedAt||now(),expiresAt:input.expiresAt||null};
}
async function publishMapPack(input={},options={}){
  const pack=normalizePack(input);
  const expiresAt=options.expiresAt||pack.expiresAt||null;
  const object=await upsert({id:`map-pack:${encodeURIComponent(pack.packId)}`,kind:PACK_KIND,purpose:'Advertise a content-addressed map region that other Civweave nodes may fetch over HTTP when connected.',payload:pack,expiresAt,hopLimit:options.hopLimit??8});
  const registry=loadJson(REGISTRY_KEY,{});registry[pack.packId]={...pack,publishedObjectId:object.id,updatedAt:now()};saveJson(REGISTRY_KEY,registry);
  dispatchEvent(new CustomEvent('civweave:map-pack-published',{detail:{packId:pack.packId,objectId:object.id,at:now()}}));
  return object;
}
async function publishLocalityBatch({datasetId,title='',features=[],source='',sourceUrl='',license='',attribution='',expiresAt=null}={},options={}){
  const id=clean(datasetId,220);if(!id)throw new TypeError('datasetId is required.');
  const rows=(Array.isArray(features)?features:[]).map(normalizePoint).filter(Boolean).slice(0,MAX_LOCALITY_FEATURES);
  if(!rows.length)throw new TypeError('A locality batch requires at least one public point feature.');
  const payload={schema:LOCALITY_SCHEMA,datasetId:id,title:clean(title||id,220),features:rows,source:clean(source||'Civweave public locality exchange',300),sourceUrl:safeHttp(sourceUrl||''),license:clean(license||'',220),attribution:clean(attribution||'',500),createdAt:now(),expiresAt:expiresAt||null};
  const object=await upsert({id:`map-locality:${encodeURIComponent(id)}`,kind:LOCALITY_KIND,purpose:'Exchange bounded public locality/index deltas between Civweave nodes without exposing session-only device location.',payload,expiresAt:expiresAt||null,hopLimit:options.hopLimit??8});
  dispatchEvent(new CustomEvent('civweave:map-locality-published',{detail:{datasetId:id,count:rows.length,objectId:object.id,at:now()}}));
  return object;
}
async function publishRegionNeed({needId=null,region='',bbox=null,minZoom=null,maxZoom=null,formats=['pmtiles'],expiresAt=null}={},options={}){
  const id=clean(needId||uid('need'),220);
  const payload={schema:NEED_SCHEMA,needId:id,region:clean(region,220),bbox:normalizeBbox(bbox),minZoom:finite(minZoom),maxZoom:finite(maxZoom),formats:[...new Set((formats||[]).map(value=>clean(value,40)).filter(Boolean))].slice(0,8),createdAt:now(),expiresAt:expiresAt||new Date(Date.now()+24*60*60*1000).toISOString()};
  if(!payload.region&&!payload.bbox)throw new TypeError('A map region need requires a region label or bounding box.');
  return upsert({id:`map-need:${encodeURIComponent(id)}`,kind:NEED_KIND,purpose:'Let connected Civweave nodes announce map regions they are missing so peers can offer matching packs.',payload,expiresAt:payload.expiresAt,hopLimit:options.hopLimit??5});
}
async function objectsOf(kind){const mesh=await ensureMesh();return (await mesh.listObjects()).filter(object=>object?.kind===kind&&(!object.expiresAt||Date.parse(object.expiresAt)>Date.now()));}
async function listMapPacks(){
  const objects=await objectsOf(PACK_KIND),packs=[];
  for(const object of objects){try{const pack=normalizePack(object.payload||{});packs.push({...pack,originNodeId:object.origin?.nodeId||null,originFingerprint:object.origin?.fingerprint||null,objectId:object.id,objectRevision:Number(object.revision||0),receivedAt:object.receivedAt||null})}catch{}}
  return packs.sort((a,b)=>Date.parse(b.generatedAt||0)-Date.parse(a.generatedAt||0)||a.packId.localeCompare(b.packId));
}
async function listLocalityBatches(){
  const objects=await objectsOf(LOCALITY_KIND),batches=[];
  for(const object of objects){const p=object.payload;if(p?.schema!==LOCALITY_SCHEMA||!Array.isArray(p.features))continue;const features=p.features.map(normalizePoint).filter(Boolean);if(!features.length)continue;batches.push({...clone(p),features,originNodeId:object.origin?.nodeId||null,originFingerprint:object.origin?.fingerprint||null,objectId:object.id})}
  return batches;
}
async function listRegionNeeds(){return (await objectsOf(NEED_KIND)).map(object=>({...clone(object.payload),originNodeId:object.origin?.nodeId||null,objectId:object.id})).filter(row=>row.schema===NEED_SCHEMA)}
async function localityFeatures(){const batches=await listLocalityBatches();return batches.flatMap(batch=>batch.features.map(feature=>({...feature,properties:{...(feature.properties||{}),_civweaveMeshDataset:batch.datasetId,_civweaveMeshOrigin:batch.originNodeId,_civweaveMeshLicense:batch.license||''}})))}
function pointInBbox(point,bbox){return Array.isArray(point)&&bbox&&point[0]>=bbox[0]&&point[0]<=bbox[2]&&point[1]>=bbox[1]&&point[1]<=bbox[3]}
async function packsForPoint(point){return (await listMapPacks()).filter(pack=>!pack.bbox||pointInBbox(point,pack.bbox))}
async function sha256Hex(bytes){const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
async function pullMapPack(packOrId,{url=null,maxBytes=MAX_PACK_BYTES,verify=true}={}){
  const packs=await listMapPacks();const pack=typeof packOrId==='string'?packs.find(row=>row.packId===packOrId):packOrId;
  if(!pack)throw new Error('Map pack advertisement not found.');
  const source=safeHttp(url||pack.urls?.[0]);if(!source)throw new Error('Map pack has no reachable HTTP source.');
  const response=await fetch(source,{cache:'no-store'});if(!response.ok)throw new Error(`Map pack source returned ${response.status}.`);
  const declared=Number(response.headers.get('content-length')||pack.bytes||0);if(declared>maxBytes)throw new RangeError('Map pack is larger than the configured download ceiling.');
  let stored=response.clone(),verified=false,bytes=declared||0;
  if(verify&&pack.sha256){
    const buffer=await response.arrayBuffer();bytes=buffer.byteLength;if(bytes>maxBytes)throw new RangeError('Map pack exceeded the configured download ceiling.');
    const hash=await sha256Hex(buffer);if(hash!==pack.sha256)throw new Error('Map pack SHA-256 does not match its signed advertisement.');
    stored=new Response(buffer,{status:200,headers:response.headers});verified=true;
  }
  const cache=await caches.open(CACHE_NAME);await cache.put(source,stored);
  const registry=loadJson(REGISTRY_KEY,{});registry[pack.packId]={...pack,cachedUrl:source,cachedAt:now(),verified,bytes};saveJson(REGISTRY_KEY,registry);
  dispatchEvent(new CustomEvent('civweave:map-pack-cached',{detail:{packId:pack.packId,url:source,verified,bytes,at:now()}}));
  return {packId:pack.packId,url:source,verified,bytes};
}
async function cachedPack(packId){const row=loadJson(REGISTRY_KEY,{})[packId];if(!row?.cachedUrl)return null;const cache=await caches.open(CACHE_NAME),response=await cache.match(row.cachedUrl);return response?{...row,response}:null}
async function sync(baseUrl=gatewayUrl||location.origin){
  if(navigator.onLine===false)return{sent:0,received:0,offline:true};
  const mesh=await ensureMesh();
  const base=safeHttp(baseUrl||location.origin)||location.origin;
  const result=await mesh.syncGateway(base);
  dispatchEvent(new CustomEvent('civweave:map-mesh-sync',{detail:{...result,baseUrl:base,at:now()}}));
  if(result.received)dispatchEvent(new CustomEvent('civweave:map-knowledge-changed',{detail:{received:result.received,at:now()}}));
  return result;
}
function schedule(){if(syncTimer)clearTimeout(syncTimer);syncTimer=setTimeout(async()=>{try{await sync()}catch{}schedule()},Math.round(syncIntervalMs*(0.85+Math.random()*0.3)))}
async function start({baseUrl=null,intervalMs=DEFAULT_SYNC_MS}={}){
  stop();
  gatewayUrl=safeHttp(baseUrl||localStorage.getItem(GATEWAY_KEY)||location.origin)||location.origin;saveJson(GATEWAY_KEY,gatewayUrl);
  syncIntervalMs=Math.max(30_000,Math.min(30*60_000,Number(intervalMs)||DEFAULT_SYNC_MS));
  await ensureMesh();
  try{await sync(gatewayUrl)}catch{}
  onlineHandler=()=>sync(gatewayUrl).catch(()=>{});addEventListener('online',onlineHandler);
  schedule();
  return status();
}
function stop(){if(syncTimer){clearTimeout(syncTimer);syncTimer=null}if(onlineHandler){removeEventListener('online',onlineHandler);onlineHandler=null}return true}
function status(){return{version:VERSION,started:Boolean(syncTimer),online:navigator.onLine!==false,gatewayUrl:gatewayUrl||null,syncIntervalMs,packKind:PACK_KIND,localityKind:LOCALITY_KIND,needKind:NEED_KIND,cacheName:CACHE_NAME,privacy:'session-device-location-never-auto-published'}}

const api=Object.freeze({version:VERSION,PACK_KIND,LOCALITY_KIND,NEED_KIND,PACK_SCHEMA,LOCALITY_SCHEMA,NEED_SCHEMA,CACHE_NAME,ensureMesh,publishMapPack,publishLocalityBatch,publishRegionNeed,listMapPacks,listLocalityBatches,listRegionNeeds,localityFeatures,packsForPoint,pullMapPack,cachedPack,sync,start,stop,status});
globalThis.CivweaveMapMeshV276=api;
dispatchEvent(new CustomEvent('civweave:map-mesh-ready',{detail:status()}));
})();
