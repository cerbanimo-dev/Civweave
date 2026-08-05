(()=>{
'use strict';
const CATALOG_URL='/downloads/knowledge-schools/catalog.json';
const CACHE_NAME='commonweave-knowledge-schools-v1';
const RECEIPT_KEY='commonweave.knowledge-schools.v1';
let catalogPromise=null;

function assertAvailable(){
  if(!('caches'in window))throw new Error('This browser cannot store optional school seeds offline.');
  if(!globalThis.crypto?.subtle)throw new Error('This browser cannot verify school-seed checksums.');
}
function hex(bytes){return Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('')}
function normalizeSlugs(slugs){return[...new Set((slugs||[]).map(String).map(value=>value.trim()).filter(Boolean))]}
function seedUrl(record){return new URL(`/downloads/knowledge-schools/${record.zip_file}`,location.origin).href}
function readReceipt(){try{return JSON.parse(localStorage.getItem(RECEIPT_KEY)||'{}')}catch{return{}}}
function writeReceipt(receipt){localStorage.setItem(RECEIPT_KEY,JSON.stringify(receipt))}
async function sha256(buffer){return hex(await crypto.subtle.digest('SHA-256',buffer))}
async function loadCatalog(options={}){
  if(options.refresh)catalogPromise=null;
  if(catalogPromise)return catalogPromise;
  catalogPromise=fetch(CATALOG_URL,{cache:'no-store'}).then(async response=>{
    if(!response.ok)throw new Error(`School catalog request failed (${response.status}).`);
    const catalog=await response.json();
    if(catalog?.schema!=='commonweave.knowledge-school-catalog.v1'||!Array.isArray(catalog.schools))throw new Error('The school catalog is not compatible with this installer.');
    return catalog;
  }).catch(error=>{catalogPromise=null;throw error});
  return catalogPromise;
}
async function status(catalog=null){
  assertAvailable();
  const activeCatalog=catalog||await loadCatalog();
  const cache=await caches.open(CACHE_NAME);
  const receipt=readReceipt();
  const records=[];
  for(const school of activeCatalog.schools){
    const url=seedUrl(school);
    const response=await cache.match(url);
    records.push({
      school_slug:school.school_slug,
      school_name:school.school_name,
      staged:Boolean(response),
      zip_bytes:school.zip_bytes,
      zip_sha256:school.zip_sha256,
      staged_at:receipt[school.school_slug]?.staged_at||null,
    });
  }
  return records;
}
async function stage(slugs,options={}){
  assertAvailable();
  const catalog=await loadCatalog();
  const bySlug=new Map(catalog.schools.map(record=>[record.school_slug,record]));
  const selected=normalizeSlugs(slugs);
  const unknown=selected.filter(slug=>!bySlug.has(slug));
  if(unknown.length)throw new Error(`Unknown knowledge schools: ${unknown.join(', ')}`);
  const cache=await caches.open(CACHE_NAME);
  const receipt=readReceipt();
  let completed=0;
  const totalBytes=selected.reduce((sum,slug)=>sum+Number(bySlug.get(slug).zip_bytes||0),0);
  let completedBytes=0;
  for(const slug of selected){
    const school=bySlug.get(slug);
    const url=seedUrl(school);
    options.onProgress?.({phase:'fetching',school,completed,total:selected.length,completedBytes,totalBytes});
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok)throw new Error(`${school.school_name} download failed (${response.status}).`);
    const buffer=await response.arrayBuffer();
    if(buffer.byteLength!==Number(school.zip_bytes))throw new Error(`${school.school_name} size mismatch.`);
    options.onProgress?.({phase:'verifying',school,completed,total:selected.length,completedBytes,totalBytes});
    const actualSha=await sha256(buffer);
    if(actualSha!==school.zip_sha256)throw new Error(`${school.school_name} checksum mismatch.`);
    await cache.put(url,new Response(buffer,{headers:{'Content-Type':'application/zip','Content-Length':String(buffer.byteLength),'X-Commonweave-SHA256':actualSha,'X-Commonweave-School':slug}}));
    receipt[slug]={staged_at:new Date().toISOString(),zip_sha256:actualSha,zip_bytes:buffer.byteLength,url};
    writeReceipt(receipt);
    completed+=1;
    completedBytes+=buffer.byteLength;
    options.onProgress?.({phase:'stored',school,completed,total:selected.length,completedBytes,totalBytes});
  }
  return status(catalog);
}
async function remove(slugs){
  assertAvailable();
  const catalog=await loadCatalog();
  const bySlug=new Map(catalog.schools.map(record=>[record.school_slug,record]));
  const selected=normalizeSlugs(slugs);
  const cache=await caches.open(CACHE_NAME);
  const receipt=readReceipt();
  for(const slug of selected){
    const school=bySlug.get(slug);
    if(!school)continue;
    await cache.delete(seedUrl(school));
    delete receipt[slug];
  }
  writeReceipt(receipt);
  return status(catalog);
}
async function clear(){
  await caches.delete(CACHE_NAME);
  localStorage.removeItem(RECEIPT_KEY);
}
async function openSeed(slug){
  const catalog=await loadCatalog();
  const school=catalog.schools.find(record=>record.school_slug===slug);
  if(!school)return null;
  const cache=await caches.open(CACHE_NAME);
  return cache.match(seedUrl(school));
}
window.CommonweaveKnowledgeSchools=Object.freeze({CATALOG_URL,CACHE_NAME,loadCatalog,status,stage,remove,clear,openSeed,seedUrl});
})();
