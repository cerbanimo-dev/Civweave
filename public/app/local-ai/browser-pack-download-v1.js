(()=>{
'use strict';

const VERSION='1.2.0-browser-pack-download-v1-explicit-files';
const PENDING_KEY='civweave.ai-pack.browser-downloads.v1';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const GENERATIVE_CACHE='civweave-model-generative-v266';
const SPECIALIZED_CACHE='civweave-specialized-model-packs-v1';
const LARGE_BYTES=32*1024*1024;
const RECEIPT_VERSION=2;
const BROWSER_PACKS=new Set(['premier-phone','server-quality']);
const REGISTRY_SRC='/app/local-ai/model-registry-v266.js?v=1.0.115-v302-gemma3-v4';
const PACKS_SRC='/app/local-ai/model-packs-v1.js?v=1.0.1-browser-guard';
if(globalThis.CivweaveBrowserPackDownloadV1?.version===VERSION)return;

const clean=(value,max=240)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const basename=path=>decodeURIComponent(String(path||'').split('/').pop()||'model-file');
const packs=()=>globalThis.CivweaveLocalModelPacksV1;
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
const forceDownload=url=>{const next=new URL(url,location.href);next.searchParams.set('download','true');return next.href};
const normalizeFilename=name=>String(name||'').replace(/\s*\(\d+\)(?=\.[^.]+$|$)/,'').replace(/\s+-\s+copy(?=\.[^.]+$|$)/i,'');
const guessType=path=>/\.json$/i.test(path)?'application/json':/\.txt$|\.jinja$/i.test(path)?'text/plain; charset=utf-8':'application/octet-stream';
const cacheFor=kind=>kind==='specialized'?SPECIALIZED_CACHE:GENERATIVE_CACHE;
const recordKey=row=>`${clean(row?.kind,40)}:${clean(row?.componentId,160)}:${String(row?.path||'').replace(/^\/+/, '')}`;

function loadScript(src,marker,test){
  if(test())return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const target=new URL(src,location.href).href;
    const exact=[...document.scripts].find(script=>script.src===target);
    if(exact){
      const done=()=>test()?resolve(true):reject(new Error(`${marker} loaded without becoming ready.`));
      exact.addEventListener('load',done,{once:true});
      exact.addEventListener('error',()=>reject(new Error(`${marker} could not load.`)),{once:true});
      queueMicrotask(()=>{if(test())resolve(true)});
      return;
    }
    const script=document.createElement('script');
    script.src=src;script.async=false;script.dataset.civweaveBrowserPackDependency=marker;
    script.onload=()=>test()?resolve(true):reject(new Error(`${marker} loaded without becoming ready.`));
    script.onerror=()=>reject(new Error(`${marker} could not load.`));
    document.head.append(script);
  });
}
async function ensureCatalog(){
  await loadScript(REGISTRY_SRC,'model registry',()=>Boolean(registry()?.byId&&registry()?.directUrl));
  await loadScript(PACKS_SRC,'AI pack catalogue',()=>Boolean(packs()?.byId&&packs()?.assetUrl));
  return{registry:registry(),packs:packs()};
}

function pendingMap(){try{return parse(localStorage.getItem(PENDING_KEY),{})}catch{return{}}}
function savePending(packId,value){const map=pendingMap();map[clean(packId,120)]=value;localStorage.setItem(PENDING_KEY,JSON.stringify(map));return value}
function clear(packId){const id=clean(packId,120),map=pendingMap();if(!(id in map))return false;delete map[id];localStorage.setItem(PENDING_KEY,JSON.stringify(map));return true}
function withRecordDefaults(row,index=0){
  const normalized={...row,index:Number(row?.index??index),basename:row?.basename||basename(row?.path),expectedBytes:Number(row?.expectedBytes||row?.sizeBytes||row?.minBytes||0)};
  normalized.key=row?.key||recordKey(normalized);
  normalized.large=row?.large??Math.max(Number(normalized.sizeBytes||0),Number(normalized.minBytes||0))>=LARGE_BYTES;
  return normalized;
}
function normalizeReceipt(value){
  if(!value||typeof value!=='object')return null;
  const large=(value.large||[]).map((row,index)=>withRecordDefaults(row,index));
  const validKeys=new Set(large.map(row=>row.key));
  const importedKeys=[...new Set((value.importedKeys||[]).filter(key=>validKeys.has(key)))];
  const startedKeys=value.version>=RECEIPT_VERSION?[...new Set((value.startedKeys||[]).filter(key=>validKeys.has(key)&&!importedKeys.includes(key)))]:[];
  return{...value,version:RECEIPT_VERSION,large,largeBytes:Number(value.largeBytes||large.reduce((sum,row)=>sum+Number(row.expectedBytes||0),0)),importedKeys,startedKeys};
}
function pending(packId){return normalizeReceipt(pendingMap()[clean(packId,120)]||null)}
function setPackState(pack,patch={}){
  let map={};try{map=parse(localStorage.getItem(PACK_STATE_KEY),{})}catch{}
  const previous=map[pack.id]||{};
  const next={...previous,...patch,downloadMode:'browser',error:'',updatedAt:now()};
  map[pack.id]=next;
  try{localStorage.setItem(PACK_STATE_KEY,JSON.stringify(map))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:local-model-pack-progress',{detail:{version:VERSION,id:pack.id,state:{...next}}}))}catch{}
  return next;
}
function recordsFor(pack){
  const p=packs(),r=registry();if(!p?.assetUrl||!r?.byId||!r?.directUrl)throw new Error('Civweave AI pack catalogue is not ready.');
  const rows=[];
  for(const componentId of pack.installOrder||[]){
    const specialized=p.specialized?.[componentId];
    if(specialized){
      for(const art of specialized.artifacts||[])rows.push({kind:'specialized',componentId,label:specialized.label,path:art.path,url:p.assetUrl(componentId,art.path),minBytes:Number(art.minBytes||1),sizeBytes:Number(art.sizeBytes||0),required:true});
      continue;
    }
    const model=r.byId(componentId);if(!model)continue;
    for(const art of model.artifacts||[]){
      if(!art.required)continue;
      rows.push({kind:'generative',componentId,label:model.label,path:art.path,url:r.directUrl(model,art.path),minBytes:Number(art.minBytes||1),sizeBytes:Number(art.sizeBytes||0),required:true});
    }
  }
  return rows.map((row,index)=>withRecordDefaults({...row,index,large:Math.max(row.sizeBytes,row.minBytes)>=LARGE_BYTES},index));
}
function receiptFor(pack){
  const large=recordsFor(pack).filter(row=>row.large);
  if(!large.length)throw new Error(`${pack.label} has no browser-managed large files.`);
  return{version:RECEIPT_VERSION,packId:pack.id,label:pack.label,packEstimatedBytes:Number(pack.estimatedBytes||0),createdAt:now(),origin:location.origin,largeThreshold:LARGE_BYTES,largeBytes:large.reduce((sum,row)=>sum+Number(row.expectedBytes||0),0),large,startedKeys:[],importedKeys:[],completed:false};
}
function receiptCounts(receipt){
  const expected=receipt?.large?.length||0,started=receipt?.startedKeys?.length||0,imported=receipt?.importedKeys?.length||0;
  return{expected,started,imported,remainingToStart:Math.max(0,expected-started-imported),remainingToImport:Math.max(0,expected-imported)};
}
function statePatch(receipt,extra={}){
  const counts=receiptCounts(receipt);
  return{browserExpectedFiles:counts.expected,browserStartedFiles:counts.started,browserImportedFiles:counts.imported,browserRemainingToStart:counts.remainingToStart,browserRemainingFiles:counts.remainingToImport,browserLargeBytes:Number(receipt?.largeBytes||0),...extra};
}
async function prepare(packId,{resetStarted=false,onProgress}={}){
  await ensureCatalog();
  const p=packs(),pack=p.byId(packId);
  if(!BROWSER_PACKS.has(pack.id))throw new Error(`${pack.label} is not a browser-managed AI pack.`);
  const fresh=receiptFor(pack),existing=pending(pack.id);
  const sameKeys=existing&&existing.large?.length===fresh.large.length&&fresh.large.every(row=>existing.large.some(old=>old.key===row.key));
  const importedKeys=sameKeys?[...(existing.importedKeys||[])]:[];
  const startedKeys=resetStarted?[]:(sameKeys?[...(existing.startedKeys||[])]:[]);
  const receipt=savePending(pack.id,{...fresh,createdAt:existing?.createdAt||fresh.createdAt,queuedAt:existing?.queuedAt||'',importedKeys,startedKeys,completed:false});
  const state=setPackState(pack,statePatch(receipt,{status:importedKeys.length?'browser-partial':'browser-queued',phase:'waiting-for-browser-downloads',percent:Math.floor(importedKeys.length/Math.max(1,receipt.large.length)*100),completedBytes:0,totalBytes:pack.estimatedBytes,errorCode:''}));
  try{onProgress?.({pack,phase:'prepared',receipt,state,message:`${pack.label} needs ${receipt.large.length} browser-managed large files · about ${(receipt.largeBytes/1e9).toFixed(1)} GB before the smaller support files finish in Civweave.`})}catch{}
  return{pack,receipt,state};
}
function nextRecord(packId){
  const receipt=pending(packId);if(!receipt)return null;
  const imported=new Set(receipt.importedKeys||[]),started=new Set(receipt.startedKeys||[]);
  return receipt.large.find(row=>!imported.has(row.key)&&!started.has(row.key))||null;
}
function downloadUrl(record){return record?.url?forceDownload(record.url):''}
function markStarted(packId,key){
  const receipt=pending(packId);if(!receipt)return null;
  const row=receipt.large.find(item=>item.key===key);if(!row)return null;
  const imported=new Set(receipt.importedKeys||[]),started=new Set(receipt.startedKeys||[]);if(imported.has(key))return receipt;
  started.add(key);
  const nextReceipt=savePending(packId,{...receipt,startedKeys:[...started],queuedAt:receipt.queuedAt||now(),lastStartedAt:now(),lastStartedKey:key});
  const pack={id:nextReceipt.packId,label:nextReceipt.label,estimatedBytes:nextReceipt.packEstimatedBytes};
  setPackState(pack,statePatch(nextReceipt,{status:nextReceipt.importedKeys.length?'browser-partial':'browser-queued',phase:'waiting-for-browser-downloads',percent:Math.floor(nextReceipt.importedKeys.length/Math.max(1,nextReceipt.large.length)*100),completedBytes:0,totalBytes:nextReceipt.packEstimatedBytes||0,errorCode:''}));
  return nextReceipt;
}
async function queueNext(packId,{onProgress}={}){
  let receipt=pending(packId),pack;
  if(!receipt){const prepared=await prepare(packId,{onProgress});receipt=prepared.receipt;pack=prepared.pack}else{await ensureCatalog();pack=packs().byId(packId)}
  const record=nextRecord(packId);
  if(!record){const state=setPackState(pack,statePatch(receipt,{status:receipt.importedKeys.length?'browser-partial':'browser-queued',phase:'waiting-for-browser-downloads',percent:Math.floor(receipt.importedKeys.length/Math.max(1,receipt.large.length)*100),completedBytes:0,totalBytes:pack.estimatedBytes,errorCode:''}));return{pack,receipt,state,done:true,record:null}}
  const link=document.createElement('a');link.href=downloadUrl(record);link.download=record.basename;link.rel='noopener';link.style.display='none';document.body.append(link);link.click();link.remove();
  receipt=markStarted(packId,record.key)||receipt;
  const counts=receiptCounts(receipt),state=setPackState(pack,statePatch(receipt,{status:receipt.importedKeys.length?'browser-partial':'browser-queued',phase:'waiting-for-browser-downloads',percent:Math.floor(receipt.importedKeys.length/Math.max(1,receipt.large.length)*100),completedBytes:0,totalBytes:pack.estimatedBytes,errorCode:''}));
  try{onProgress?.({pack,phase:'started',record,receipt,state,started:counts.started,total:counts.expected,message:`Started browser download ${counts.started}/${counts.expected} · ${record.basename} · about ${(record.expectedBytes/1e9).toFixed(1)} GB.`})}catch{}
  return{pack,record,receipt,state,done:false};
}
async function queue(packId,{onProgress}={}){
  await prepare(packId,{onProgress});
  return queueNext(packId,{onProgress});
}
function retryMissing(packId){
  const receipt=pending(packId);if(!receipt)return null;
  const nextReceipt=savePending(packId,{...receipt,startedKeys:[],retryAt:now()});
  const pack={id:nextReceipt.packId,label:nextReceipt.label,estimatedBytes:nextReceipt.packEstimatedBytes};
  setPackState(pack,statePatch(nextReceipt,{status:nextReceipt.importedKeys.length?'browser-partial':'browser-queued',phase:'waiting-for-browser-downloads',percent:Math.floor(nextReceipt.importedKeys.length/Math.max(1,nextReceipt.large.length)*100),completedBytes:0,totalBytes:nextReceipt.packEstimatedBytes||0,errorCode:''}));
  return nextReceipt;
}

function candidateScore(file,record){
  const normalized=normalizeFilename(file.name),target=normalizeFilename(record.basename);
  if(normalized!==target)return Infinity;
  const size=Number(file.size||0),min=Number(record.minBytes||0),expected=Number(record.expectedBytes||record.sizeBytes||0);
  if(min&&size<min*.97)return Infinity;
  if(expected){const ratio=Math.abs(size-expected)/Math.max(1,expected);if(ratio>.12)return Infinity;return ratio}
  return Math.abs(size-min)/Math.max(1,min)+.2;
}
function assignFiles(files,records){
  const candidates=[];
  files.forEach((file,fileIndex)=>records.forEach((record,recordIndex)=>{const score=candidateScore(file,record);if(Number.isFinite(score))candidates.push({file,fileIndex,record,recordIndex,score})}));
  candidates.sort((a,b)=>a.score-b.score);
  const usedFiles=new Set(),usedRecords=new Set(),matches=[];
  for(const candidate of candidates){if(usedFiles.has(candidate.fileIndex)||usedRecords.has(candidate.recordIndex))continue;usedFiles.add(candidate.fileIndex);usedRecords.add(candidate.recordIndex);matches.push(candidate)}
  return{matches,missing:records.filter((_,index)=>!usedRecords.has(index)),unused:files.filter((_,index)=>!usedFiles.has(index))};
}
async function putFile(record,file){
  const cache=await caches.open(cacheFor(record.kind));
  const headers=new Headers({'content-type':file.type||guessType(record.path),'content-length':String(file.size),'x-civweave-imported':'browser-download-v1'});
  await cache.put(record.url,new Response(file,{status:200,headers}));
}
async function cached(record){
  const cache=await caches.open(cacheFor(record.kind)),response=await cache.match(record.url);
  if(!response?.ok)return false;
  const bytes=Number(response.headers.get('content-length')||0);
  return !bytes||bytes>=Number(record.minBytes||0)*.97;
}
async function fetchSmall(record){
  if(await cached(record))return true;
  const response=await fetch(record.url,{cache:'no-store',redirect:'follow'});
  if(!response.ok)throw new Error(`${record.label} · ${record.path} returned HTTP ${response.status}.`);
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(type.includes('text/html'))throw new Error(`${record.label} · ${record.path} returned HTML instead of model data.`);
  const declared=Number(response.headers.get('content-length')||0);
  if(declared&&declared<Number(record.minBytes||0)*.97)throw new Error(`${record.label} · ${record.path} was incomplete.`);
  if(/\.json$/i.test(record.path)){try{JSON.parse(await response.clone().text())}catch{throw new Error(`${record.label} · ${record.path} was not valid JSON.`)}}
  const cache=await caches.open(cacheFor(record.kind));await cache.put(record.url,response);return true;
}
async function importFiles(packId,files,{onProgress}={}){
  if(!('caches'in globalThis))throw new Error('Cache Storage is unavailable in this browser.');
  let receipt=pending(packId);
  if(!receipt?.large?.length)throw new Error('This pack has no pending browser-download receipt. Start the pack once from Civweave first.');
  const selected=[...(files||[])];if(!selected.length)return{cancelled:true,packId};
  const importedKeys=new Set(receipt.importedKeys||[]),remaining=receipt.large.filter(row=>!importedKeys.has(row.key));
  const assigned=assignFiles(selected,remaining);
  if(!assigned.matches.length)throw new Error('None of the selected files matched the remaining Civweave pack downloads. You can import one completed file at a time.');
  const {packs:p}=await ensureCatalog(),pack=p.byId(packId);
  setPackState(pack,statePatch(receipt,{status:'browser-importing',phase:'browser-importing',percent:Math.floor(importedKeys.size/Math.max(1,receipt.large.length)*100),completedBytes:0,totalBytes:pack.estimatedBytes,errorCode:''}));
  try{
    let importedNow=0;
    for(const match of assigned.matches){
      await putFile(match.record,match.file);importedKeys.add(match.record.key);importedNow+=1;
      receipt=savePending(packId,{...receipt,importedKeys:[...importedKeys],lastImportedAt:now(),lastImportedKey:match.record.key});
      try{onProgress?.({pack,phase:'importing-large',completed:importedKeys.size,total:receipt.large.length,record:match.record,message:`Imported browser file ${importedKeys.size}/${receipt.large.length} · ${match.record.basename}`})}catch{}
    }
    receipt=savePending(packId,{...receipt,importedKeys:[...importedKeys],importedAt:now()});
    const missingLarge=receipt.large.filter(row=>!importedKeys.has(row.key));
    if(missingLarge.length){
      const state=setPackState(pack,statePatch(receipt,{status:'browser-partial',phase:'waiting-for-browser-downloads',percent:Math.floor(importedKeys.size/Math.max(1,receipt.large.length)*100),completedBytes:0,totalBytes:pack.estimatedBytes,errorCode:''}));
      try{onProgress?.({pack,phase:'partial',completed:importedKeys.size,total:receipt.large.length,state,missing:missingLarge,message:`Imported ${importedKeys.size}/${receipt.large.length} large files. ${missingLarge.length} still need importing.`})}catch{}
      return{pack,receipt,state,partial:true,available:false,importedNow,importedTotal:importedKeys.size,missing:missingLarge,unused:assigned.unused};
    }
    const all=recordsFor(pack),small=all.filter(row=>!row.large);
    for(let index=0;index<small.length;index++){
      try{onProgress?.({pack,phase:'finishing-small',completed:index+1,total:small.length,record:small[index],message:`Finishing smaller support files · ${index+1}/${small.length}`})}catch{}
      await fetchSmall(small[index]);
    }
    const incomplete=[];for(const record of all)if(!(await cached(record)))incomplete.push(record);
    if(incomplete.length)throw new Error(`${incomplete.length} pack file${incomplete.length===1?' is':'s are'} still missing after import.`);
    const installedBytes=all.reduce((sum,row)=>sum+Number(row.expectedBytes||row.sizeBytes||row.minBytes||0),0);
    receipt=savePending(packId,{...receipt,importedKeys:[...importedKeys],completed:true,completedAt:now()});
    const state=setPackState(pack,statePatch(receipt,{status:'ready',phase:'ready',percent:100,completedBytes:installedBytes||pack.estimatedBytes,totalBytes:installedBytes||pack.estimatedBytes,installedBytes:installedBytes||pack.estimatedBytes,installedAt:now(),errorCode:''}));
    try{dispatchEvent(new CustomEvent('civweave:local-model-pack-installed',{detail:{version:VERSION,id:pack.id,label:pack.label,source:'browser-import'}}))}catch{}
    try{onProgress?.({pack,phase:'ready',completed:all.length,total:all.length,state,message:`${pack.label} is installed in Civweave local storage.`})}catch{}
    return{pack,receipt,state,partial:false,available:true,installedBytes,importedNow,importedTotal:importedKeys.size};
  }catch(error){
    receipt=pending(packId)||receipt;
    setPackState(pack,statePatch(receipt,{status:receipt.importedKeys?.length?'browser-partial':'browser-queued',phase:'waiting-for-browser-downloads',percent:Math.floor((receipt.importedKeys?.length||0)/Math.max(1,receipt.large?.length||1)*100),completedBytes:0,totalBytes:pack.estimatedBytes,errorCode:'CIVWEAVE_AI_PACK_BROWSER_IMPORT_FAILED'}));
    throw error;
  }
}
function pickAndImport(packId,{onProgress}={}){
  const input=document.createElement('input');input.type='file';input.multiple=true;input.setAttribute('aria-label','Select completed Civweave AI pack downloads');input.style.position='fixed';input.style.left='-10000px';input.style.top='0';input.style.width='1px';input.style.height='1px';input.style.opacity='0';document.body.append(input);
  return new Promise((resolve,reject)=>{
    let settled=false;const cleanup=()=>input.remove();const finish=(fn,value)=>{if(settled)return;settled=true;cleanup();fn(value)};
    input.addEventListener('change',()=>{const chosen=[...(input.files||[])];if(!chosen.length){finish(resolve,{cancelled:true,packId});return}importFiles(packId,chosen,{onProgress}).then(value=>finish(resolve,value),error=>finish(reject,error))},{once:true});
    input.addEventListener('cancel',()=>finish(resolve,{cancelled:true,packId}),{once:true});
    input.click();
  });
}
function importUrl(packId){const next=new URL('/app/index.html',location.origin);next.searchParams.set('source','settings-ai-pack-import');next.searchParams.set('pack',clean(packId,120));next.hash='cw-ai-pack-browser-title';return next.href}

globalThis.CivweaveBrowserPackDownloadV1=Object.freeze({
  version:VERSION,prepare,queue,queueNext,nextRecord,markStarted,retryMissing,downloadUrl,pending,clear,recordsFor,receiptFor,receiptCounts,importFiles,pickAndImport,importUrl,
  pendingKey:PENDING_KEY,packStateKey:PACK_STATE_KEY,largeThreshold:LARGE_BYTES,browserPackIds:Object.freeze([...BROWSER_PACKS]),explicitBrowserFiles:true,partialImport:true
});
})();
