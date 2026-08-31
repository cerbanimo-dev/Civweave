(()=>{
'use strict';
const VERSION='1.0.0-premier-phone-qwen-download-v1';
const ID='qwen3-0.6b-q8-wasm';
const LABEL='Qwen 3 0.6B CPU compatibility';
const CACHE='civweave-model-generative-v266';
const STATE_KEY='civweave.local-ai.downloads.v266';
const EVENT='civweave:local-model-download-progress';
const WORKER='/app/local-ai/premier-phone-support-worker-v1.js?v=1.0.0-worker-cache-stream';
const REPO='onnx-community/Qwen3-0.6B-ONNX';
const REVISION='558750086ed49d78cb701ed6fa85af33fd16453f';
const ARTIFACTS=Object.freeze([
  Object.freeze({path:'config.json',minBytes:500,sizeBytes:500,required:true}),
  Object.freeze({path:'tokenizer.json',minBytes:1_000_000,sizeBytes:1_000_000,required:true}),
  Object.freeze({path:'tokenizer_config.json',minBytes:500,sizeBytes:500,required:true}),
  Object.freeze({path:'generation_config.json',minBytes:50,sizeBytes:50,required:true}),
  Object.freeze({path:'onnx/model_quantized.onnx',minBytes:600_000_000,sizeBytes:650_000_000,required:true})
]);
if(globalThis.CivweavePremierPhoneQwenDownloadV1?.version===VERSION)return;
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const urlFor=path=>`https://huggingface.co/${REPO}/resolve/${encodeURIComponent(REVISION)}/${String(path||'').replace(/^\/+/, '')}`;
const readStates=()=>parse(localStorage.getItem(STATE_KEY),{});
function writeState(patch){
  const states=readStates(),previous=states[ID]||{},next={...previous,...patch,updatedAt:now()};
  states[ID]=next;
  try{localStorage.setItem(STATE_KEY,JSON.stringify(states))}catch{}
  try{dispatchEvent(new CustomEvent(EVENT,{detail:{version:VERSION,id:ID,state:{...next},internalSupport:true}}))}catch{}
  return next;
}
function state(id=ID){if(id&&id!==ID)return null;return readStates()[ID]||null}
async function validCachedArtifact(cache,artifact){
  const url=urlFor(artifact.path),response=await cache.match(url);
  if(!response?.ok)return{...artifact,url,ok:false,bytes:0,reason:'missing'};
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(type.includes('text/html')){await cache.delete(url);return{...artifact,url,ok:false,bytes:0,reason:'html',corrupt:true}}
  const declared=Number(response.headers.get('content-length')||0);
  if(declared&&declared<artifact.minBytes){await cache.delete(url);return{...artifact,url,ok:false,bytes:declared,reason:'too-small',corrupt:true}}
  if(/\.json$/i.test(artifact.path)){
    try{JSON.parse(await response.clone().text())}catch{await cache.delete(url);return{...artifact,url,ok:false,bytes:0,reason:'invalid-json',corrupt:true}}
  }
  return{...artifact,url,ok:true,bytes:declared||artifact.sizeBytes||artifact.minBytes,reason:''};
}
async function status(id=ID){
  if(id!==ID)throw new Error(`Premier Phone support downloader only owns ${ID}.`);
  if(!('caches'in globalThis))throw new Error('Cache Storage is unavailable for the Qwen compatibility model.');
  const cache=await caches.open(CACHE),rows=[];
  for(const artifact of ARTIFACTS)rows.push(await validCachedArtifact(cache,artifact));
  const available=rows.every(row=>row.ok),bytes=rows.filter(row=>row.ok).reduce((sum,row)=>sum+Number(row.bytes||0),0);
  if(available)writeState({status:'ready',phase:'ready',percent:100,bytesDownloaded:bytes,totalBytes:bytes,installedAt:state()?.installedAt||now(),error:'',storageBackend:'cache-storage',supportAutoDetected:true});
  return{id:ID,label:LABEL,available,installed:available,rows,missing:rows.filter(row=>!row.ok),bytes,state:state(),cache:CACHE,internalSupport:true};
}
async function requestPersistence(){try{return Boolean(await navigator.storage?.persist?.())}catch{return false}}
function workerInstall({onProgress}={}){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(WORKER),artifacts=ARTIFACTS.map(artifact=>({...artifact,url:urlFor(artifact.path)}));
    const cleanup=()=>{try{worker.terminate()}catch{}};
    worker.onmessage=event=>{
      const packet=event.data||{};if(packet.componentId!==ID)return;
      if(packet.type==='progress'){
        const percent=packet.total?Math.max(0,Math.min(99,Math.floor(Number(packet.loaded||0)/Math.max(1,Number(packet.total||1))*100))):0;
        const current=writeState({status:'downloading',phase:'downloading',percent,artifact:packet.artifact||'',error:'',storageBackend:'cache-storage'});
        try{onProgress?.(current)}catch{}
        return;
      }
      if(packet.type==='complete'){cleanup();resolve(packet);return}
      if(packet.type==='error'){cleanup();reject(new Error(packet.message||`${LABEL} download failed.`))}
    };
    worker.onerror=event=>{cleanup();reject(new Error(event?.message||`${LABEL} support worker failed.`))};
    writeState({status:'downloading',phase:'downloading',percent:0,startedAt:now(),repo:REPO,revision:REVISION,error:'',storageBackend:'cache-storage'});
    worker.postMessage({type:'install-support-component',cacheName:CACHE,component:{id:ID,label:LABEL,artifacts}});
  });
}
async function start(id=ID,{onProgress}={}){
  if(id!==ID)throw new Error(`Premier Phone support downloader only owns ${ID}.`);
  await requestPersistence();
  const current=await status(ID);if(current.available)return current.state;
  try{
    await workerInstall({onProgress});
    const verified=await status(ID);
    if(!verified.available)throw new Error(`${LABEL} finished downloading but was not detected in Civweave internal storage.`);
    try{dispatchEvent(new CustomEvent('civweave:local-model-downloaded',{detail:{version:VERSION,id:ID,repo:REPO,revision:REVISION,bytes:verified.bytes,storageBackend:'cache-storage',internalSupport:true}}))}catch{}
    return verified.state;
  }catch(error){writeState({status:'error',phase:'error',error:String(error?.message||error)});throw error}
}
const api=Object.freeze({version:VERSION,cache:CACHE,stateKey:STATE_KEY,start,install:start,status,state,requestPersistence,internalSupportOnly:true,qwenCompatibilityOnly:true,workerOnly:true,mainThreadLargeCachePut:false,autoDetect:true});
globalThis.CivweavePremierPhoneQwenDownloadV1=api;
const existing=globalThis.CivweaveLocalModelDownloadV266;
if(!existing?.start||!existing?.status)globalThis.CivweaveLocalModelDownloadV266=api;
try{dispatchEvent(new CustomEvent('civweave:local-model-download-ready',{detail:{version:VERSION,cache:CACHE,internalSupportOnly:true,qwenCompatibilityOnly:true}}))}catch{}
})();