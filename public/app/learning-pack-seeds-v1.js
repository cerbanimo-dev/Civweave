(()=>{
'use strict';
const VERSION='1.1.0-learning-pack-seeds-v1';
const CATALOG_URL='/downloads/learning-packs/catalog.json';
const CACHE_NAME='civweave-learning-packs-v1';
const RECEIPT_KEY='civweave.learning-packs.v1';
let catalogPromise=null;

const clean=(value,max=2400)=>String(value??'').trim().slice(0,max);
const unique=values=>[...new Set((values||[]).map(value=>clean(value,180)).filter(Boolean))];
function assertAvailable(){
  if(typeof window==='undefined'||!('caches'in window))throw new Error('This browser cannot store optional learning packs offline.');
  if(!globalThis.crypto?.subtle)throw new Error('This browser cannot verify learning-pack checksums.');
}
function readReceipt(){try{return JSON.parse(localStorage.getItem(RECEIPT_KEY)||'{}')||{}}catch{return{}}}
function writeReceipt(value){localStorage.setItem(RECEIPT_KEY,JSON.stringify(value))}
function hex(bytes){return Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('')}
async function sha256(buffer){return hex(await crypto.subtle.digest('SHA-256',buffer))}
function packUrl(record){return new URL(`/downloads/learning-packs/${record.file||`${record.id}.json`}`,location.origin).href}
function cachedCurrent(response,record,receipt={}){
  if(!response)return false;
  if(record.module){
    const moduleMatches=response.headers.get('x-civweave-pack-module')===record.module;
    const exportMatches=(response.headers.get('x-civweave-pack-export')||'')===clean(record.export,160);
    return moduleMatches&&exportMatches;
  }
  const expectedBytes=Number(record.bytes||0),cachedBytes=Number(response.headers.get('content-length')||receipt.bytes||0);
  const expectedSha=clean(record.sha256,128).toLowerCase(),cachedSha=clean(response.headers.get('x-civweave-sha256')||receipt.sha256,128).toLowerCase();
  return (!expectedBytes||cachedBytes===expectedBytes)&&Boolean(expectedSha)&&cachedSha===expectedSha;
}
async function loadCatalog(options={}){
  if(options.refresh)catalogPromise=null;
  if(catalogPromise)return catalogPromise;
  catalogPromise=fetch(CATALOG_URL,{cache:'no-store'}).then(async response=>{
    if(!response.ok)throw new Error(`Learning-pack catalog request failed (${response.status}).`);
    const catalog=await response.json();
    if(catalog?.schema!=='civweave.learning-pack-catalog.v1'||!Array.isArray(catalog.packs))throw new Error('The learning-pack catalog is not compatible with this runtime.');
    return catalog;
  }).catch(error=>{catalogPromise=null;throw error});
  return catalogPromise;
}
async function status(catalog=null){
  assertAvailable();
  const active=catalog||await loadCatalog(),cache=await caches.open(CACHE_NAME),receipt=readReceipt(),persistent=navigator.storage?.persisted?await navigator.storage.persisted().catch(()=>false):false,rows=[];
  for(const record of active.packs){
    const response=await cache.match(packUrl(record)),saved=receipt[record.id]||{},current=cachedCurrent(response,record,saved);
    rows.push({id:record.id,title:record.title,packType:record.packType||'mixed',audience:record.audience||[],tags:record.tags||[],optional:record.optional!==false,generated:record.generated===true,bundled:record.bundled===true,available:Boolean(record.module)||record.available!==false,staged:Boolean(response),current,needs_update:Boolean(response)&&!current,bytes:Number(record.bytes||saved.bytes||0),sha256:record.sha256||saved.sha256||'',staged_at:saved.staged_at||null,persistent:Boolean(persistent)});
  }
  return rows;
}
async function persistStorage(){
  if(!navigator.storage?.persist)return{supported:false,persisted:false};
  try{const existing=await navigator.storage.persisted?.();return{supported:true,persisted:Boolean(existing||await navigator.storage.persist())}}catch{return{supported:true,persisted:false}}
}
async function moduleBuffer(record){
  const module=await import(record.module);
  const pack=record.export?module[record.export]:(module.default||module.pack);
  if(!pack||typeof pack!=='object')throw new Error(`${record.title} module did not export learning pack ${record.export||'default'}.`);
  return new TextEncoder().encode(`${JSON.stringify(pack)}\n`).buffer;
}
async function stage(ids,options={}){
  assertAvailable();
  const catalog=await loadCatalog(),byId=new Map(catalog.packs.map(record=>[record.id,record])),selected=unique(ids),unknown=selected.filter(id=>!byId.has(id));
  if(unknown.length)throw new Error(`Unknown learning packs: ${unknown.join(', ')}`);
  const unavailable=selected.filter(id=>byId.get(id)?.available===false&&!byId.get(id)?.module);if(unavailable.length)throw new Error(`These learning packs must be built or published before download: ${unavailable.join(', ')}`);
  const cache=await caches.open(CACHE_NAME),receipt=readReceipt(),totalBytes=selected.reduce((sum,id)=>sum+Number(byId.get(id)?.bytes||0),0);let completed=0,completedBytes=0;
  for(const id of selected){
    const record=byId.get(id),url=packUrl(record),existing=await cache.match(url);
    if(cachedCurrent(existing,record,receipt[id])){completed++;completedBytes+=Number(record.bytes||receipt[id]?.bytes||0);options.onProgress?.({phase:'cached',record,completed,total:selected.length,completedBytes,totalBytes});continue}
    options.onProgress?.({phase:record.module?'materializing':'fetching',record,completed,total:selected.length,completedBytes,totalBytes});
    let buffer;
    if(record.module)buffer=await moduleBuffer(record);
    else{
      const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`${record.title} download failed (${response.status}).`);
      buffer=await response.arrayBuffer();
      if(record.bytes&&buffer.byteLength!==Number(record.bytes))throw new Error(`${record.title} size mismatch.`);
    }
    options.onProgress?.({phase:'verifying',record,completed,total:selected.length,completedBytes,totalBytes});
    const actual=await sha256(buffer);
    if(!record.module&&actual!==clean(record.sha256,128).toLowerCase())throw new Error(`${record.title} checksum mismatch.`);
    const headers={'Content-Type':record.contentType||'application/json','Content-Length':String(buffer.byteLength),'X-Civweave-SHA256':actual,'X-Civweave-Pack-Id':id,'X-Civweave-Pack-File':record.file||`${id}.json`};
    if(record.module){headers['X-Civweave-Pack-Module']=record.module;headers['X-Civweave-Pack-Export']=clean(record.export,160)}
    await cache.put(url,new Response(buffer,{headers}));
    receipt[id]={staged_at:new Date().toISOString(),sha256:actual,bytes:buffer.byteLength,url,file:record.file||`${id}.json`,module:record.module||'',export:record.export||''};writeReceipt(receipt);
    completed++;completedBytes+=buffer.byteLength;options.onProgress?.({phase:'stored',record,completed,total:selected.length,completedBytes,totalBytes});
  }
  const persistence=await persistStorage();options.onProgress?.({phase:'persistent',completed,total:selected.length,completedBytes,totalBytes,persistence});
  try{dispatchEvent(new CustomEvent('civweave:learning-packs-staged',{detail:{ids:selected,persistence}}))}catch{}
  return status(catalog);
}
async function remove(ids){
  assertAvailable();
  const catalog=await loadCatalog(),byId=new Map(catalog.packs.map(record=>[record.id,record])),cache=await caches.open(CACHE_NAME),receipt=readReceipt();
  for(const id of unique(ids)){const record=byId.get(id);if(!record)continue;await cache.delete(packUrl(record));delete receipt[id]}
  writeReceipt(receipt);return status(catalog);
}
async function clear(){await caches.delete(CACHE_NAME);localStorage.removeItem(RECEIPT_KEY)}
async function openPack(id){
  assertAvailable();
  const catalog=await loadCatalog(),record=catalog.packs.find(row=>row.id===id);if(!record)return null;
  const cache=await caches.open(CACHE_NAME),response=await cache.match(packUrl(record));return cachedCurrent(response,record,readReceipt()[id])?response:null;
}
async function bootstrapCore(){
  try{
    const catalog=await loadCatalog(),core=catalog.packs.filter(record=>record.bundled===true&&record.autoStage!==false).map(record=>record.id);
    if(core.length)await stage(core);
    return core;
  }catch(error){console.warn('[Learning packs bootstrap]',error);return[]}
}
globalThis.CivweaveLearningPackSeedsV1=Object.freeze({version:VERSION,CATALOG_URL,CACHE_NAME,RECEIPT_KEY,loadCatalog,status,stage,remove,clear,openPack,packUrl,persistStorage,bootstrapCore});
})();
