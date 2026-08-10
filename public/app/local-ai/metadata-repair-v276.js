(()=>{
'use strict';
const VERSION='1.0.80-local-ai-metadata-repair-v276';
if(globalThis.CivweaveLocalModelMetadataRepairV276?.version===VERSION)return;
const base=globalThis.CivweaveLocalModelDownloadV266;
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
const CACHE=base?.cache||'civweave-model-generative-v266';
const metadataPath=path=>!/^onnx\//i.test(String(path||''))&&/\.(?:json|jinja)$/i.test(String(path||''));
const directUrl=(spec,artifact)=>registry()?.directUrl?.(spec,artifact.path);
async function fetchMetadata(spec,artifact,onProgress){
  const url=directUrl(spec,artifact);
  if(!url)throw new Error(`Could not resolve ${artifact.path}.`);
  onProgress?.({phase:'repairing',artifact:artifact.path,metadataOnly:true});
  const response=await fetch(url,{cache:'no-store',redirect:'follow'});
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
}
async function repairMetadataOnly(id,{onProgress}={}){
  if(!base?.status)throw new Error('Local model download manager is unavailable.');
  let current=await base.status(id);
  if(current.available)return current;
  const spec=registry()?.byId?.(id);
  if(!spec)throw new Error(`Unknown local model: ${id}`);
  const missing=(current.missing||[]).filter(artifact=>artifact.required);
  if(!missing.length)return current;
  if(!missing.every(artifact=>metadataPath(artifact.path)))return base.repair(id,{onProgress});
  await base.cancel?.(id).catch?.(()=>false);
  onProgress?.({phase:'repairing',artifact:missing[0]?.path||'',metadataOnly:true,total:missing.length,completed:0});
  let completed=0;
  for(const artifact of missing){
    await fetchMetadata(spec,artifact,onProgress);
    completed+=1;
    onProgress?.({phase:'repairing',artifact:artifact.path,metadataOnly:true,total:missing.length,completed});
  }
  current=await base.status(id);
  if(!current.available)throw new Error(`${spec.label} metadata repair finished but the package is still incomplete.`);
  try{dispatchEvent(new CustomEvent('civweave:local-model-metadata-repaired',{detail:{version:VERSION,id,spec:spec.id,files:missing.map(row=>row.path)}}))}catch{}
  return current;
}
if(base?.repair){
  globalThis.CivweaveLocalModelDownloadV266=Object.freeze({...base,repair:repairMetadataOnly,metadataRepairVersion:VERSION,metadataOnlyRepair:true});
}
globalThis.CivweaveLocalModelMetadataRepairV276=Object.freeze({version:VERSION,repair:repairMetadataOnly,metadataPath});
try{dispatchEvent(new CustomEvent('civweave:local-model-metadata-repair-ready',{detail:{version:VERSION,metadataOnly:true,preservesWeights:true}}))}catch{}
})();
