(()=>{
'use strict';
const VERSION='1.0.67-local-ai-cache-integrity-v271';
const CACHE='civweave-model-generative-v266';
const MAX_METADATA_REPAIR_BYTES=16_000_000;
if(globalThis.CivweaveLocalModelCacheIntegrityV271?.version===VERSION)return;
const base=globalThis.CivweaveLocalModelDownloadV266;
if(!base)throw new Error('Local model download manager must load before cache integrity v271.');
const R=()=>globalThis.CivweaveLocalModelRegistryV266;
const enc=new TextEncoder();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const isJson=path=>/\.json$/i.test(String(path||''));
const isText=path=>/\.(?:json|txt|jinja)$/i.test(String(path||''));
const isWeight=path=>/^onnx\//i.test(String(path||''));
const direct=(model,artifact)=>R().directUrl(model,artifact.path);
function broken(artifact,reason,bytes=0){return{...artifact,ok:false,bytes:Number(bytes)||0,corrupt:reason!=='missing',reason}}
async function evict(cache,key){try{await cache.delete(key)}catch{}}
async function inspectArtifact(model,artifact,{evictBroken=true}={}){
  const cache=await caches.open(CACHE),key=direct(model,artifact),response=await cache.match(key);
  if(!response?.ok)return broken(artifact,'missing');
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  const declared=Math.max(0,Number(response.headers.get('content-length')||0));
  if(type.includes('text/html')){if(evictBroken)await evict(cache,key);return broken(artifact,'html-shell',declared)}
  if(declared&&declared<Number(artifact.minBytes||0)){if(evictBroken)await evict(cache,key);return broken(artifact,'truncated',declared)}
  if(isText(artifact.path)){
    let text='';
    try{text=await response.clone().text()}catch{if(evictBroken)await evict(cache,key);return broken(artifact,'unreadable',declared)}
    const bytes=enc.encode(text).byteLength;
    if(bytes<Number(artifact.minBytes||0)||!text.trim()){if(evictBroken)await evict(cache,key);return broken(artifact,'empty-or-truncated',bytes)}
    if(isJson(artifact.path)){try{JSON.parse(text)}catch{if(evictBroken)await evict(cache,key);return broken(artifact,'invalid-json',bytes)}}
    return{...artifact,ok:true,bytes,validated:'body'};
  }
  if(declared)return{...artifact,ok:declared>=Number(artifact.minBytes||0),bytes:declared,validated:'content-length'};
  try{
    const reader=response.clone().body?.getReader?.();
    if(!reader){if(evictBroken)await evict(cache,key);return broken(artifact,'empty-body')}
    const first=await reader.read();
    try{await reader.cancel()}catch{}
    const bytes=Number(first?.value?.byteLength||0);
    if(first?.done||!bytes){if(evictBroken)await evict(cache,key);return broken(artifact,'empty-body',bytes)}
    return{...artifact,ok:true,bytes:Number(artifact.minBytes||bytes),validated:'nonempty-stream'};
  }catch{if(evictBroken)await evict(cache,key);return broken(artifact,'unreadable',declared)}
}
async function status(id,{evictBroken=true}={}){
  const model=R()?.byId?.(id);if(!model)throw new Error(`Unknown local model: ${id}`);
  const rows=[];for(const artifact of model.artifacts)rows.push(await inspectArtifact(model,artifact,{evictBroken}));
  const missing=rows.filter(row=>row.required&&!row.ok),corrupt=rows.filter(row=>row.corrupt),available=missing.length===0;
  const rawState=base.state?.(id)||null;
  const metadataOnly=missing.length>0&&missing.every(row=>!isWeight(row.path));
  const repairBytes=missing.reduce((sum,row)=>sum+Number(row.minBytes||0),0);
  const repair={needed:!available,metadataOnly,estimatedBytes:repairBytes,paths:missing.map(row=>row.path)};
  let state=rawState;
  if(!available&&rawState){state={...rawState,status:'error',error:metadataOnly?'Cached model metadata failed integrity validation. Civweave can repair only the damaged metadata files.':'The downloaded model package is incomplete or damaged. Tap Resume to repair the missing files.'}}
  return{id,label:model.label,available,installed:available,rows,missing,corrupt,repair,selected:base.selection?.().active&&base.selection?.().id===id,state,cache:CACHE,integrityVersion:VERSION};
}
async function waitForRepair(id,{onProgress,timeoutMs=180000}={}){
  const deadline=Date.now()+Math.max(30000,Number(timeoutMs)||180000);
  while(Date.now()<deadline){
    const checked=await status(id);
    if(checked.available)return checked;
    const raw=base.state?.(id)||{};
    if(['error','paused','aborted'].includes(raw.status))throw new Error(raw.error||'Local model repair stopped before completion.');
    try{onProgress?.({phase:'repairing-cache',model:id,artifact:raw.artifact||'',percent:raw.percent||0})}catch{}
    await sleep(250);
  }
  throw new Error('Local model metadata repair timed out.');
}
async function repairMetadata(id,{onProgress}={}){
  const before=await status(id);
  if(before.available)return before;
  if(!before.repair.metadataOnly||before.repair.estimatedBytes>MAX_METADATA_REPAIR_BYTES)throw new Error('Model weights are missing or damaged. Open AI Settings and tap Resume to repair the package.');
  if(globalThis.navigator?.onLine===false)throw new Error('Downloaded model metadata is damaged and this device is offline. Reconnect once so Civweave can repair only the small metadata files.');
  try{onProgress?.({phase:'repairing-cache',model:id,paths:before.repair.paths,estimatedBytes:before.repair.estimatedBytes})}catch{}
  await base.start(id,{onProgress,preferBackground:false});
  return waitForRepair(id,{onProgress});
}
async function catalogueStatus(){const out=[];for(const model of R()?.models||[])out.push(model.installable?{spec:model,status:await status(model.id)}:{spec:model,status:{available:false,experimental:true}});return out}
const wrapped=Object.freeze({...base,version:VERSION,baseVersion:base.version,status,integrityStatus:status,repairMetadata,catalogueStatus,integrityVersion:VERSION});
globalThis.CivweaveLocalModelDownloadV266=wrapped;
const api=Object.freeze({version:VERSION,status,inspectArtifact,repairMetadata,baseVersion:base.version,maxMetadataRepairBytes:MAX_METADATA_REPAIR_BYTES});
globalThis.CivweaveLocalModelCacheIntegrityV271=api;
try{dispatchEvent(new CustomEvent('civweave:local-model-cache-integrity-ready',{detail:{version:VERSION,baseVersion:base.version,metadataRepair:true,jsonValidation:true}}))}catch{}
})();
