(()=>{
'use strict';

const VERSION='1.1.0-browser-pack-download-v1-pwa-import';
const PENDING_KEY='civweave.ai-pack.browser-downloads.v1';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const GENERATIVE_CACHE='civweave-model-generative-v266';
const SPECIALIZED_CACHE='civweave-specialized-model-packs-v1';
const LARGE_BYTES=32*1024*1024;
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

function loadScript(src,marker,test){
  if(test())return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const path=new URL(src,location.href).pathname;
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===path);
    if(existing){
      const done=()=>test()?resolve(true):reject(new Error(`${marker} loaded without becoming ready.`));
      existing.addEventListener('load',done,{once:true});
      existing.addEventListener('error',()=>reject(new Error(`${marker} could not load.`)),{once:true});
      setTimeout(()=>{if(test())resolve(true)},0);
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
function pending(packId){return pendingMap()[clean(packId,120)]||null}
function savePending(packId,value){const map=pendingMap();map[clean(packId,120)]=value;localStorage.setItem(PENDING_KEY,JSON.stringify(map));return value}
function clear(packId){const id=clean(packId,120),map=pendingMap();if(!(id in map))return false;delete map[id];localStorage.setItem(PENDING_KEY,JSON.stringify(map));return true}
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
  return rows.map((row,index)=>({...row,index,basename:basename(row.path),expectedBytes:Number(row.sizeBytes||row.minBytes||0),large:Math.max(row.sizeBytes,row.minBytes)>=LARGE_BYTES}));
}
function receiptFor(pack){
  const large=recordsFor(pack).filter(row=>row.large);
  if(!large.length)throw new Error(`${pack.label} has no browser-managed large files.`);
  return{version:1,packId:pack.id,label:pack.label,createdAt:now(),origin:location.origin,largeThreshold:LARGE_BYTES,large:large.map(({kind,componentId,label,path,url,minBytes,sizeBytes,expectedBytes,basename})=>({kind,componentId,label,path,url,minBytes,sizeBytes,expectedBytes,basename}))};
}
async function queue(packId,{onProgress}={}){
  await ensureCatalog();
  const p=packs(),pack=p.byId(packId);
  if(!BROWSER_PACKS.has(pack.id))throw new Error(`${pack.label} is not a browser-managed AI pack.`);
  const receipt=savePending(pack.id,receiptFor(pack));
  setPackState(pack,{status:'browser-queuing',phase:'browser-queuing',percent:0,completedBytes:0,totalBytes:pack.estimatedBytes,startedAt:now(),errorCode:''});
  for(let index=0;index<receipt.large.length;index++){
    const record=receipt.large[index],link=document.createElement('a');
    link.href=forceDownload(record.url);link.download=record.basename;link.rel='noopener';link.style.display='none';
    document.body.append(link);link.click();link.remove();
    try{onProgress?.({pack,phase:'queueing',queued:index+1,total:receipt.large.length,record,message:`Queued ${index+1}/${receipt.large.length} · ${record.basename}`})}catch{}
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  const queuedAt=now(),saved=savePending(pack.id,{...receipt,queuedAt});
  const state=setPackState(pack,{status:'browser-queued',phase:'waiting-for-browser-downloads',percent:0,completedBytes:0,totalBytes:pack.estimatedBytes,queuedAt,errorCode:''});
  try{onProgress?.({pack,phase:'queued',queued:receipt.large.length,total:receipt.large.length,state,message:`${pack.label} downloads are queued in the browser.`})}catch{}
  return{pack,receipt:saved,state};
}

function candidateScore(file,record){
  const normalized=normalizeFilename(file.name),target=normalizeFilename(record.basename);
  if(normalized!==target)return Infinity;
  const size=Number(file.size||0),min=Number(record.minBytes||0),expected=Number(record.expectedBytes||record.sizeBytes||0);
  if(min&&size<min*.97)return Infinity;
  if(expected){const ratio=Math.abs(size-expected)/Math.max(1,expected);if(ratio>.08)return Infinity;return ratio}
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
  return !bytes||bytes>=Number(record.minBytes||0);
}
async function fetchSmall(record){
  if(await cached(record))return true;
  const response=await fetch(record.url,{cache:'no-store',redirect:'follow'});
  if(!response.ok)throw new Error(`${record.label} · ${record.path} returned HTTP ${response.status}.`);
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(type.includes('text/html'))throw new Error(`${record.label} · ${record.path} returned HTML instead of model data.`);
  const declared=Number(response.headers.get('content-length')||0);
  if(declared&&declared<Number(record.minBytes||0))throw new Error(`${record.label} · ${record.path} was incomplete.`);
  if(/\.json$/i.test(record.path)){try{JSON.parse(await response.clone().text())}catch{throw new Error(`${record.label} · ${record.path} was not valid JSON.`)}}
  const cache=await caches.open(cacheFor(record.kind));await cache.put(record.url,response);return true;
}
async function importFiles(packId,files,{onProgress}={}){
  if(!('caches'in globalThis))throw new Error('Cache Storage is unavailable in this browser.');
  const receipt=pending(packId);
  if(!receipt?.large?.length)throw new Error('This pack has no pending browser-download receipt. Queue the pack once from Civweave first.');
  const selected=[...(files||[])];
  if(!selected.length)return{cancelled:true,packId};
  const assigned=assignFiles(selected,receipt.large);
  if(assigned.missing.length){
    const missing=assigned.missing.slice(0,3).map(row=>row.basename).join(', '),more=assigned.missing.length>3?` +${assigned.missing.length-3} more`:'';
    throw new Error(`Still missing ${assigned.missing.length} large download${assigned.missing.length===1?'':'s'}: ${missing}${more}. Select the completed browser downloads and try again.`);
  }
  const {packs:p}=await ensureCatalog(),pack=p.byId(packId);
  setPackState(pack,{status:'browser-importing',phase:'browser-importing',percent:0,completedBytes:0,totalBytes:pack.estimatedBytes,errorCode:''});
  let imported=0;
  for(const match of assigned.matches){
    await putFile(match.record,match.file);imported+=1;
    try{onProgress?.({pack,phase:'importing-large',completed:imported,total:assigned.matches.length,record:match.record,message:`Importing browser downloads · ${imported}/${assigned.matches.length}`})}catch{}
  }
  const all=recordsFor(pack),small=all.filter(row=>!row.large);
  for(let index=0;index<small.length;index++){
    try{onProgress?.({pack,phase:'finishing-small',completed:index+1,total:small.length,record:small[index],message:`Finishing small support files · ${index+1}/${small.length}`})}catch{}
    await fetchSmall(small[index]);
  }
  const incomplete=[];
  for(const record of all)if(!(await cached(record)))incomplete.push(record);
  if(incomplete.length)throw new Error(`${incomplete.length} pack file${incomplete.length===1?' is':'s are'} still missing after import.`);
  const installedBytes=all.reduce((sum,row)=>sum+Number(row.expectedBytes||row.sizeBytes||row.minBytes||0),0);
  savePending(packId,{...receipt,importedAt:now(),completed:true});
  const state=setPackState(pack,{status:'ready',phase:'ready',percent:100,completedBytes:installedBytes||pack.estimatedBytes,totalBytes:installedBytes||pack.estimatedBytes,installedBytes:installedBytes||pack.estimatedBytes,installedAt:now(),errorCode:''});
  try{dispatchEvent(new CustomEvent('civweave:local-model-pack-installed',{detail:{version:VERSION,id:pack.id,label:pack.label,source:'browser-import'}}))}catch{}
  try{onProgress?.({pack,phase:'ready',completed:all.length,total:all.length,state,message:`${pack.label} is installed in Civweave local storage.`})}catch{}
  return{pack,receipt:pending(packId),state,available:true,installedBytes};
}
function pickAndImport(packId,{onProgress}={}){
  const input=document.createElement('input');
  input.type='file';input.multiple=true;input.setAttribute('aria-label','Select completed Civweave AI pack downloads');
  input.style.position='fixed';input.style.left='-10000px';input.style.top='0';input.style.width='1px';input.style.height='1px';input.style.opacity='0';
  document.body.append(input);
  return new Promise((resolve,reject)=>{
    let settled=false;
    const cleanup=()=>{input.remove();window.removeEventListener('focus',onFocus,true)};
    const finish=(fn,value)=>{if(settled)return;settled=true;cleanup();fn(value)};
    const onFocus=()=>setTimeout(()=>{if(!settled&&!input.files?.length)finish(resolve,{cancelled:true,packId})},700);
    input.addEventListener('change',()=>{
      const chosen=[...(input.files||[])];
      if(!chosen.length){finish(resolve,{cancelled:true,packId});return}
      importFiles(packId,chosen,{onProgress}).then(value=>finish(resolve,value),error=>finish(reject,error));
    },{once:true});
    window.addEventListener('focus',onFocus,true);
    input.click();
  });
}
function importUrl(packId){const next=new URL('/app/index.html',location.origin);next.searchParams.set('source','settings-ai-pack-import');next.searchParams.set('pack',clean(packId,120));next.hash='cw-ai-pack-browser-title';return next.href}

globalThis.CivweaveBrowserPackDownloadV1=Object.freeze({
  version:VERSION,queue,pending,clear,recordsFor,receiptFor,importFiles,pickAndImport,importUrl,
  pendingKey:PENDING_KEY,packStateKey:PACK_STATE_KEY,largeThreshold:LARGE_BYTES,browserPackIds:Object.freeze([...BROWSER_PACKS])
});
})();