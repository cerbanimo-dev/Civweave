(()=>{
'use strict';
const VERSION='1.0.81-local-ai-metadata-repair-v277-race-safe';
if(globalThis.CivweaveLocalModelMetadataRepairV276?.version===VERSION)return;
const base=globalThis.CivweaveLocalModelDownloadV266;
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
const CACHE=base?.cache||'civweave-model-generative-v266';
const FETCH_TIMEOUT_MS=20000;
const FINALIZING_GRACE_MS=4000;
const metadataPath=path=>!/^onnx\//i.test(String(path||''))&&/\.(?:json|jinja)$/i.test(String(path||''));
const directUrl=(spec,artifact)=>registry()?.directUrl?.(spec,artifact.path);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function requiredMissing(current){return(current?.missing||[]).filter(artifact=>artifact.required)}
function isFinalizing(current){const state=current?.state||{};return ['downloading','finalizing'].includes(String(state.status||''))&&Number(state.percent||0)>=99}
async function waitForConcurrentCompletion(id,{onProgress,graceMs=FINALIZING_GRACE_MS}={}){
  const started=Date.now();let current=await base.status(id);
  while(!current.available&&isFinalizing(current)&&Date.now()-started<graceMs){
    onProgress?.({phase:'repair-waiting',artifact:requiredMissing(current)[0]?.path||'',metadataOnly:true,concurrent:true});
    await delay(200);
    current=await base.status(id);
  }
  return current;
}
async function fetchMetadata(spec,artifact,onProgress){
  const url=directUrl(spec,artifact);
  if(!url)throw new Error(`Could not resolve ${artifact.path}.`);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  onProgress?.({phase:'repairing',artifact:artifact.path,metadataOnly:true});
  try{
    const response=await fetch(url,{cache:'no-store',redirect:'follow',signal:controller.signal});
    if(!response.ok)throw new Error(`${artifact.path} returned HTTP ${response.status}.`);
    const type=String(response.headers.get('content-type')||'').toLowerCase();
    if(type.includes('text/html'))throw new Error(`${artifact.path} returned HTML instead of model metadata.`);
    const declared=Number(response.headers.get('content-length')||0);
    if(declared&&declared<Number(artifact.minBytes||0))throw new Error(`${artifact.path} was truncated.`);
    if(/\.json$/i.test(artifact.path)){
      const text=await response.clone().text();
      try{JSON.parse(text)}catch{throw new Error(`${artifact.path} returned invalid JSON.`)}
    }
    const cache=await caches.open(CACHE);
    await cache.put(url,response);
  }catch(error){
    if(error?.name==='AbortError')throw new Error(`${artifact.path} metadata repair timed out after ${Math.round(FETCH_TIMEOUT_MS/1000)} seconds. The model weights were preserved; retry while online.`);
    throw error;
  }finally{clearTimeout(timer)}
}
async function repairMetadataOnly(id,{onProgress}={}){
  if(!base?.status)throw new Error('Local model download manager is unavailable.');
  let current=await base.status(id);
  if(current.available)return current;

  // A 99–100% Background Fetch may still be copying responses into Cache Storage.
  // Give that existing transfer a short chance to finish rather than racing or aborting it.
  current=await waitForConcurrentCompletion(id,{onProgress});
  if(current.available)return current;

  const spec=registry()?.byId?.(id);
  if(!spec)throw new Error(`Unknown local model: ${id}`);
  let missing=requiredMissing(current);
  if(!missing.length)return current;
  if(!missing.every(artifact=>metadataPath(artifact.path)))return base.repair(id,{onProgress});

  onProgress?.({phase:'repairing',artifact:missing[0]?.path||'',metadataOnly:true,total:missing.length,completed:0});
  let completed=0;
  for(const artifact of missing){
    // Another path may have completed this exact artifact while we were waiting/fetching.
    current=await base.status(id);
    if(current.available)return current;
    const stillMissing=requiredMissing(current).find(row=>row.path===artifact.path);
    if(!stillMissing){completed+=1;continue}
    await fetchMetadata(spec,stillMissing,onProgress);
    completed+=1;
    current=await base.status(id);
    onProgress?.({phase:'repairing',artifact:artifact.path,metadataOnly:true,total:missing.length,completed});
    if(current.available)return current;
  }

  current=await waitForConcurrentCompletion(id,{onProgress,graceMs:1500});
  if(!current.available)throw new Error(`${spec.label} metadata repair finished but the package is still incomplete.`);
  try{dispatchEvent(new CustomEvent('civweave:local-model-metadata-repaired',{detail:{version:VERSION,id,spec:spec.id,files:missing.map(row=>row.path)}}))}catch{}
  return current;
}
if(base?.repair){
  globalThis.CivweaveLocalModelDownloadV266=Object.freeze({...base,repair:repairMetadataOnly,metadataRepairVersion:VERSION,metadataOnlyRepair:true,metadataRepairRaceSafe:true});
}
globalThis.CivweaveLocalModelMetadataRepairV276=Object.freeze({version:VERSION,repair:repairMetadataOnly,metadataPath,fetchTimeoutMs:FETCH_TIMEOUT_MS,raceSafe:true});
try{dispatchEvent(new CustomEvent('civweave:local-model-metadata-repair-ready',{detail:{version:VERSION,metadataOnly:true,preservesWeights:true,raceSafe:true,fetchTimeoutMs:FETCH_TIMEOUT_MS}}))}catch{}
})();