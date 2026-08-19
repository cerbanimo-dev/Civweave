(()=>{
'use strict';

const VERSION='1.0.0-browser-pack-download-v1';
const PENDING_KEY='civweave.ai-pack.browser-downloads.v1';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const LARGE_BYTES=32*1024*1024;
const BROWSER_PACKS=new Set(['premier-phone','server-quality']);
if(globalThis.CivweaveBrowserPackDownloadV1?.version===VERSION)return;

const clean=(value,max=240)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const basename=path=>decodeURIComponent(String(path||'').split('/').pop()||'model-file');
const packs=()=>globalThis.CivweaveLocalModelPacksV1;
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
const forceDownload=url=>{const next=new URL(url,location.href);next.searchParams.set('download','true');return next.href};

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
  const p=packs();if(!p?.byId||!registry()?.byId)throw new Error('Civweave local AI download modules are not ready.');
  const pack=p.byId(packId);
  if(!BROWSER_PACKS.has(pack.id)||p.installMode?.(pack.id)!=='browser')throw new Error(`${pack.label} is not a browser-managed AI pack.`);
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
function importUrl(packId){const next=new URL('/app/index.html',location.origin);next.searchParams.set('source','settings-ai-pack-import');next.searchParams.set('pack',clean(packId,120));next.hash='cw-ai-pack-browser-title';return next.href}

globalThis.CivweaveBrowserPackDownloadV1=Object.freeze({version:VERSION,queue,pending,clear,recordsFor,receiptFor,importUrl,pendingKey:PENDING_KEY,packStateKey:PACK_STATE_KEY,largeThreshold:LARGE_BYTES,browserPackIds:Object.freeze([...BROWSER_PACKS])});
})();
