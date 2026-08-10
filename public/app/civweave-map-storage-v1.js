(()=>{
'use strict';

const VERSION='civweave-map-v1-storage-1.0.0';
const DB_NAME='civweave-map-v1';
const DB_VERSION=1;
const PACK_STORE='packs';
const CHUNK_STORE='chunks';
const CHUNK_SIZE=1024*1024;
const BUDGET_KEY='civweave.map.storage-budget.v1';
const DEFAULT_BUDGET=256*1024*1024;
const FALLBACK_BUFFER_LIMIT=16*1024*1024;
let dbPromise=null;
let shaModulePromise=null;
const touchClock=new Map();
const now=()=>new Date().toISOString();
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const requestPromise=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('IndexedDB request failed.'))});
const txDone=tx=>new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted.'));tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed.'))});

function openDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(PACK_STORE)){
        const packs=db.createObjectStore(PACK_STORE,{keyPath:'packId'});packs.createIndex('lastAccess','lastAccess');packs.createIndex('pinned','pinned');
      }
      if(!db.objectStoreNames.contains(CHUNK_STORE)){
        const chunks=db.createObjectStore(CHUNK_STORE,{keyPath:'key'});chunks.createIndex('packId','packId');
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>{dbPromise=null;reject(request.error||new Error('Could not open Civweave Map storage.'))};
  });
  return dbPromise;
}
async function shaModule(){return shaModulePromise||(shaModulePromise=import('/app/shared/civweave-sha256-stream-v1.mjs').catch(error=>{shaModulePromise=null;throw error}))}
function sourceKey(packId){return `civweave-cache:${encodeURIComponent(clean(packId,220))}`}
async function getPack(packId){const db=await openDb(),tx=db.transaction(PACK_STORE,'readonly');return requestPromise(tx.objectStore(PACK_STORE).get(clean(packId,220)))}
async function putPack(row){const db=await openDb(),tx=db.transaction(PACK_STORE,'readwrite');tx.objectStore(PACK_STORE).put(row);await txDone(tx);return row}
async function putChunk(packId,index,data){const db=await openDb(),tx=db.transaction(CHUNK_STORE,'readwrite');tx.objectStore(CHUNK_STORE).put({key:`${packId}:${index}`,packId,index,data});await txDone(tx)}
async function getChunk(packId,index){const db=await openDb(),tx=db.transaction(CHUNK_STORE,'readonly'),result=await requestPromise(tx.objectStore(CHUNK_STORE).get(`${packId}:${index}`));return result}
async function listPacks(){
  const db=await openDb(),tx=db.transaction(PACK_STORE,'readonly'),rows=await requestPromise(tx.objectStore(PACK_STORE).getAll());
  return rows.sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||Date.parse(b.lastAccess||b.cachedAt||0)-Date.parse(a.lastAccess||a.cachedAt||0));
}
async function deleteChunks(packId){
  const db=await openDb(),tx=db.transaction(CHUNK_STORE,'readwrite'),index=tx.objectStore(CHUNK_STORE).index('packId');
  await new Promise((resolve,reject)=>{const req=index.openCursor(IDBKeyRange.only(packId));req.onerror=()=>reject(req.error);req.onsuccess=()=>{const cursor=req.result;if(!cursor){resolve();return}cursor.delete();cursor.continue()}});await txDone(tx);
}
async function removePack(packId,{reason='user'}={}){
  const id=clean(packId,220);if(!id)return false;
  await deleteChunks(id);
  const db=await openDb(),tx=db.transaction(PACK_STORE,'readwrite');tx.objectStore(PACK_STORE).delete(id);await txDone(tx);
  dispatchEvent(new CustomEvent('civweave:map-pack-removed',{detail:{packId:id,reason,at:now()}}));return true;
}
async function setPinned(packId,pinned=true){const row=await getPack(packId);if(!row)return false;row.pinned=Boolean(pinned);row.lastAccess=now();await putPack(row);dispatchEvent(new CustomEvent('civweave:map-pack-pin-changed',{detail:{packId:row.packId,pinned:row.pinned,at:now()}}));return row.pinned}
async function touch(packId){
  const last=touchClock.get(packId)||0;if(Date.now()-last<30000)return;touchClock.set(packId,Date.now());
  const row=await getPack(packId).catch(()=>null);if(!row)return;row.lastAccess=now();await putPack(row).catch(()=>{});
}
async function estimate(){
  const rows=await listPacks();const mapBytes=rows.reduce((sum,row)=>sum+Math.max(0,Number(row.bytes)||0),0);
  let usage=null,quota=null;try{const result=await navigator.storage?.estimate?.();usage=finite(result?.usage);quota=finite(result?.quota)}catch{}
  const override=Math.max(0,Math.trunc(finite(localStorage.getItem(BUDGET_KEY))||0));
  const dynamic=quota?Math.max(64*1024*1024,Math.min(DEFAULT_BUDGET,Math.floor(quota*0.25))):DEFAULT_BUDGET;
  return{mapBytes,usage,quota,budgetBytes:override||dynamic,freeBytes:quota!=null&&usage!=null?Math.max(0,quota-usage):null,packs:rows.length,pinned:rows.filter(row=>row.pinned).length,chunkSize:CHUNK_SIZE};
}
async function prune({reserveBytes=0}={}){
  const reserve=Math.max(0,Math.trunc(Number(reserveBytes)||0));let stats=await estimate();const removed=[];
  const over=()=>stats.mapBytes+reserve>stats.budgetBytes||(stats.freeBytes!=null&&stats.freeBytes<reserve+16*1024*1024);
  const candidates=(await listPacks()).filter(row=>!row.pinned).sort((a,b)=>Date.parse(a.lastAccess||a.cachedAt||0)-Date.parse(b.lastAccess||b.cachedAt||0));
  for(const row of candidates){if(!over())break;await removePack(row.packId,{reason:'lru-prune'});removed.push(row.packId);stats=await estimate()}
  return{removed,stats,room:!over()};
}
async function ensureRoom(bytes){
  const requested=Math.max(0,Math.trunc(Number(bytes)||0));const result=await prune({reserveBytes:requested});
  if(!result.room)throw new DOMException('Not enough map storage space. Unpin or remove a downloaded region first.','QuotaExceededError');
  return result;
}
async function writeBuffered(packId,reader,maxBytes,hasher){
  let index=0,total=0,buffer=new Uint8Array(CHUNK_SIZE),used=0;
  const flush=async()=>{if(!used)return;await putChunk(packId,index++,buffer.slice(0,used).buffer);buffer=new Uint8Array(CHUNK_SIZE);used=0};
  while(true){const {done,value}=await reader.read();if(done)break;const chunk=value instanceof Uint8Array?value:new Uint8Array(value);total+=chunk.byteLength;if(total>maxBytes){await reader.cancel().catch(()=>{});throw new RangeError('Map pack exceeded the configured download ceiling.')}hasher.update(chunk);let offset=0;while(offset<chunk.byteLength){const take=Math.min(CHUNK_SIZE-used,chunk.byteLength-offset);buffer.set(chunk.subarray(offset,offset+take),used);used+=take;offset+=take;if(used===CHUNK_SIZE)await flush()}}
  await flush();return{bytes:total,chunks:index};
}
async function importResponse(pack,response,{maxBytes=1024*1024*1024,expectedSha256=''}={}){
  const packId=clean(pack?.packId||pack?.id,220);if(!packId)throw new TypeError('packId is required.');
  const declared=Math.max(0,Math.trunc(Number(response.headers.get('content-length')||pack?.bytes||0)));if(declared>maxBytes)throw new RangeError('Map pack is larger than the configured download ceiling.');
  await ensureRoom(declared||Math.min(maxBytes,64*1024*1024));await removePack(packId,{reason:'replace'}).catch(()=>{});
  const {Sha256Stream}=await shaModule();const hasher=new Sha256Stream();let result;
  try{
    if(response.body?.getReader){result=await writeBuffered(packId,response.body.getReader(),maxBytes,hasher)}
    else{
      if((declared||maxBytes)>FALLBACK_BUFFER_LIMIT)throw new Error('Streaming response bodies are required for map packs larger than 16 MiB on this browser.');
      const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>maxBytes)throw new RangeError('Map pack exceeded the configured download ceiling.');hasher.update(bytes);let index=0;for(let offset=0;offset<bytes.byteLength;offset+=CHUNK_SIZE)await putChunk(packId,index++,bytes.slice(offset,offset+CHUNK_SIZE).buffer);result={bytes:bytes.byteLength,chunks:index};
    }
    const sha256=hasher.hex();const expected=clean(expectedSha256||pack?.sha256,128).toLowerCase();if(expected&&sha256!==expected)throw new Error('Map pack SHA-256 does not match its signed advertisement.');
    const record={...pack,packId,bytes:result.bytes,chunks:result.chunks,sha256,verified:Boolean(expected),cachedAt:now(),lastAccess:now(),pinned:Boolean(pack?.pinned),storage:'indexeddb-chunks',chunkSize:CHUNK_SIZE,status:'ready'};await putPack(record);
    dispatchEvent(new CustomEvent('civweave:map-pack-cached',{detail:{packId,bytes:result.bytes,chunks:result.chunks,sha256,verified:record.verified,at:now()}}));return record;
  }catch(error){await removePack(packId,{reason:'failed-import'}).catch(()=>{});throw error}
}
async function getBytes(packId,offset,length){
  const id=clean(packId,220),start=Math.max(0,Math.trunc(Number(offset)||0)),size=Math.max(0,Math.trunc(Number(length)||0));const row=await getPack(id);if(!row||row.status!=='ready')throw new Error(`Map pack ${id} is not available offline.`);if(start+size>Number(row.bytes))throw new RangeError('Requested PMTiles byte range exceeds the cached archive.');if(size===0)return{data:new ArrayBuffer(0)};
  const first=Math.floor(start/CHUNK_SIZE),last=Math.floor((start+size-1)/CHUNK_SIZE),out=new Uint8Array(size);let written=0;
  for(let index=first;index<=last;index++){
    const chunk=await getChunk(id,index);if(!chunk?.data)throw new Error(`Cached map chunk ${index} is missing.`);const bytes=chunk.data instanceof ArrayBuffer?new Uint8Array(chunk.data):new Uint8Array(chunk.data.buffer||chunk.data);const chunkStart=index*CHUNK_SIZE;const from=Math.max(start,chunkStart)-chunkStart;const to=Math.min(start+size,chunkStart+bytes.byteLength)-chunkStart;out.set(bytes.subarray(from,to),written);written+=to-from;
  }
  touch(id).catch(()=>{});return{data:out.buffer};
}
function openSource(packId){const id=clean(packId,220);return{getKey:()=>sourceKey(id),getBytes:(offset,length)=>getBytes(id,offset,length)}}
async function status(){return{version:VERSION,dbName:DB_NAME,...await estimate()}}

const api=Object.freeze({version:VERSION,DB_NAME,CHUNK_SIZE,sourceKey,openDb,getPack,listPacks,estimate,prune,ensureRoom,importResponse,getBytes,openSource,removePack,setPinned,touch,status});
globalThis.CivweaveMapStorageV1=api;dispatchEvent(new CustomEvent('civweave:map-storage-ready',{detail:{version:VERSION,at:now()}}));
})();
