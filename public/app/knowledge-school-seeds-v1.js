(()=>{
'use strict';
const CATALOG_URL='/downloads/knowledge-schools/catalog.json';
const CACHE_NAME='cwknowledge-school-seeds-v2';
const LEGACY_CACHE_NAMES=['civweave-knowledge-schools-v1'];
const RECEIPT_KEY='civweave.knowledge-schools.v2';
const LEGACY_RECEIPT_KEY='civweave.knowledge-schools.v1';
let catalogPromise=null;
let migrationPromise=null;

function assertAvailable(){
  if(!('caches'in window))throw new Error('This browser cannot store optional school seeds offline.');
  if(!globalThis.crypto?.subtle)throw new Error('This browser cannot verify school-seed checksums.');
}
function hex(bytes){return Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('')}
function normalizeSlugs(slugs){return[...new Set((slugs||[]).map(String).map(value=>value.trim()).filter(Boolean))]}
function legacySeedUrl(record){return new URL(`/downloads/knowledge-schools/${record.zip_file}`,location.origin).href}
function seedUrl(record){const direct=String(record?.download_url||'').trim();return direct?new URL(direct,location.origin).href:legacySeedUrl(record)}
function seedUrls(record){return[...new Set([seedUrl(record),legacySeedUrl(record)])]}
async function matchCachedSeed(cache,record){for(const url of seedUrls(record)){const response=await cache.match(url);if(response)return{url,response}}return{url:seedUrl(record),response:null}}
function seedFilename(record){return String(record.zip_file||`${record.school_slug}.zip`).split('/').pop()||`${record.school_slug}.zip`}
function parseReceipt(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{return{}}}
function readReceipt(){return{...parseReceipt(LEGACY_RECEIPT_KEY),...parseReceipt(RECEIPT_KEY)}}
function writeReceipt(receipt){localStorage.setItem(RECEIPT_KEY,JSON.stringify(receipt))}
async function sha256(buffer){return hex(await crypto.subtle.digest('SHA-256',buffer))}
function headerNumber(response,name){const value=Number(response?.headers?.get(name));return Number.isFinite(value)?value:0}
function cachedCurrent(response,school,receipt={}){
  if(!response)return false;
  const expectedBytes=Number(school.zip_bytes||0);
  const cachedBytes=headerNumber(response,'content-length')||Number(receipt.zip_bytes||0);
  const cachedSha=String(response.headers.get('x-civweave-sha256')||receipt.zip_sha256||'').toLowerCase();
  return cachedBytes===expectedBytes&&cachedSha===String(school.zip_sha256||'').toLowerCase();
}
async function persistStorage(){
  if(!navigator.storage?.persist)return{supported:false,persisted:false};
  try{
    const already=await navigator.storage.persisted?.();
    const persisted=already||await navigator.storage.persist();
    return{supported:true,persisted:Boolean(persisted)};
  }catch{return{supported:true,persisted:false}}
}
async function migrateLegacyCaches(){
  assertAvailable();
  if(migrationPromise)return migrationPromise;
  migrationPromise=(async()=>{
    const target=await caches.open(CACHE_NAME);
    let copied=0;
    for(const legacyName of LEGACY_CACHE_NAMES){
      if(legacyName===CACHE_NAME)continue;
      const legacy=await caches.open(legacyName);
      const requests=await legacy.keys();
      for(const request of requests){
        if(await target.match(request))continue;
        const response=await legacy.match(request);
        if(response){await target.put(request,response.clone());copied+=1}
      }
      if(requests.length)await caches.delete(legacyName);
    }
    const receipt=readReceipt();
    writeReceipt(receipt);
    return{copied,cache:CACHE_NAME};
  })().catch(error=>{migrationPromise=null;throw error});
  return migrationPromise;
}
async function loadCatalog(options={}){
  if(options.refresh)catalogPromise=null;
  if(catalogPromise)return catalogPromise;
  catalogPromise=fetch(CATALOG_URL,{cache:'no-store'}).then(async response=>{
    if(!response.ok)throw new Error(`School catalog request failed (${response.status}).`);
    const catalog=await response.json();
    if(catalog?.schema!=='civweave.knowledge-school-catalog.v1'||!Array.isArray(catalog.schools))throw new Error('The school catalog is not compatible with this installer.');
    return catalog;
  }).catch(error=>{catalogPromise=null;throw error});
  return catalogPromise;
}
async function status(catalog=null){
  assertAvailable();
  await migrateLegacyCaches();
  const activeCatalog=catalog||await loadCatalog();
  const cache=await caches.open(CACHE_NAME);
  const receipt=readReceipt();
  const persistence=navigator.storage?.persisted?await navigator.storage.persisted().catch(()=>false):false;
  const records=[];
  for(const school of activeCatalog.schools){
    const cached=await matchCachedSeed(cache,school);
    const response=cached.response;
    const saved=receipt[school.school_slug]||{};
    const current=cachedCurrent(response,school,saved);
    records.push({
      school_slug:school.school_slug,
      school_name:school.school_name,
      staged:Boolean(response),
      current,
      needs_update:Boolean(response)&&!current,
      zip_bytes:school.zip_bytes,
      zip_sha256:school.zip_sha256,
      staged_at:saved.staged_at||null,
      persistent:Boolean(persistence),
      source_url:cached.url,
    });
  }
  return records;
}
async function stage(slugs,options={}){
  assertAvailable();
  await migrateLegacyCaches();
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
    const cached=await matchCachedSeed(cache,school);
    if(cachedCurrent(cached.response,school,receipt[slug])){
      completed+=1;
      completedBytes+=Number(school.zip_bytes||0);
      options.onProgress?.({phase:'cached',school,completed,total:selected.length,completedBytes,totalBytes});
      continue;
    }
    options.onProgress?.({phase:'fetching',school,completed,total:selected.length,completedBytes,totalBytes});
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok)throw new Error(`${school.school_name} download failed (${response.status}).`);
    const buffer=await response.arrayBuffer();
    if(buffer.byteLength!==Number(school.zip_bytes))throw new Error(`${school.school_name} size mismatch.`);
    options.onProgress?.({phase:'verifying',school,completed,total:selected.length,completedBytes,totalBytes});
    const actualSha=await sha256(buffer);
    if(actualSha!==school.zip_sha256)throw new Error(`${school.school_name} checksum mismatch.`);
    const filename=seedFilename(school);
    await cache.put(url,new Response(buffer,{headers:{
      'Content-Type':'application/zip',
      'Content-Length':String(buffer.byteLength),
      'Content-Disposition':`attachment; filename="${filename}"`,
      'X-Civweave-SHA256':actualSha,
      'X-Civweave-School':slug,
      'X-Civweave-Knowledge-Cache':CACHE_NAME,
      'X-Civweave-Source-URL':url,
    }}));
    receipt[slug]={staged_at:new Date().toISOString(),zip_sha256:actualSha,zip_bytes:buffer.byteLength,url,filename};
    writeReceipt(receipt);
    completed+=1;
    completedBytes+=buffer.byteLength;
    options.onProgress?.({phase:'stored',school,completed,total:selected.length,completedBytes,totalBytes});
  }
  const persistence=await persistStorage();
  options.onProgress?.({phase:'persistent',completed,total:selected.length,completedBytes,totalBytes,persistence});
  return status(catalog);
}
async function save(slugs,options={}){
  assertAvailable();
  await migrateLegacyCaches();
  const catalog=await loadCatalog();
  const bySlug=new Map(catalog.schools.map(record=>[record.school_slug,record]));
  const selected=normalizeSlugs(slugs);
  const cache=await caches.open(CACHE_NAME);
  const receipt=readReceipt();
  const files=[];
  for(const slug of selected){
    const school=bySlug.get(slug);
    if(!school)continue;
    const cached=await matchCachedSeed(cache,school);
    if(!cachedCurrent(cached.response,school,receipt[slug]))throw new Error(`${school.school_name} is not fully downloaded yet.`);
    files.push({school,response:cached.response,filename:seedFilename(school)});
  }
  if(!files.length)throw new Error('Select at least one downloaded school to save.');
  if(typeof globalThis.showDirectoryPicker==='function'){
    const directory=await globalThis.showDirectoryPicker({mode:'readwrite'});
    let completed=0;
    for(const file of files){
      options.onProgress?.({phase:'saving',school:file.school,completed,total:files.length});
      const handle=await directory.getFileHandle(file.filename,{create:true});
      const writable=await handle.createWritable();
      await writable.write(await file.response.blob());
      await writable.close();
      completed+=1;
      options.onProgress?.({phase:'saved',school:file.school,completed,total:files.length});
    }
    return{mode:'directory',saved:completed,total:files.length};
  }
  let completed=0;
  for(const file of files){
    options.onProgress?.({phase:'saving',school:file.school,completed,total:files.length});
    const blob=await file.response.blob();
    const href=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=href;
    anchor.download=file.filename;
    anchor.rel='noopener';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(href),60000);
    completed+=1;
    options.onProgress?.({phase:'saved',school:file.school,completed,total:files.length});
    await new Promise(resolve=>setTimeout(resolve,350));
  }
  return{mode:'downloads',saved:completed,total:files.length};
}
async function remove(slugs){
  assertAvailable();
  await migrateLegacyCaches();
  const catalog=await loadCatalog();
  const bySlug=new Map(catalog.schools.map(record=>[record.school_slug,record]));
  const selected=normalizeSlugs(slugs);
  const cache=await caches.open(CACHE_NAME);
  const receipt=readReceipt();
  for(const slug of selected){
    const school=bySlug.get(slug);
    if(!school)continue;
    for(const url of seedUrls(school))await cache.delete(url);
    delete receipt[slug];
  }
  writeReceipt(receipt);
  return status(catalog);
}
async function clear(){
  await caches.delete(CACHE_NAME);
  for(const legacy of LEGACY_CACHE_NAMES)await caches.delete(legacy);
  localStorage.removeItem(RECEIPT_KEY);
  localStorage.removeItem(LEGACY_RECEIPT_KEY);
}
async function openSeed(slug){
  await migrateLegacyCaches();
  const catalog=await loadCatalog();
  const school=catalog.schools.find(record=>record.school_slug===slug);
  if(!school)return null;
  const cache=await caches.open(CACHE_NAME);
  return (await matchCachedSeed(cache,school)).response;
}
window.CivweaveKnowledgeSchools=Object.freeze({CATALOG_URL,CACHE_NAME,LEGACY_CACHE_NAMES,loadCatalog,status,stage,save,remove,clear,openSeed,seedUrl,seedFilename,migrateLegacyCaches,persistStorage});
})();
