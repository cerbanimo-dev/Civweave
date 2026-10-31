// Civweave in-browser GGUF runtime. No localhost server, LiteRT, or network inference.
const ENGINE='/app/vendor/wllama/esm/index.js';
const WASM='/app/vendor/wllama/esm/wasm/wllama.wasm';
export const GGUF_SELECTION_KEY='civweave.mobile.gguf-primary.v2';
export const GGUF_PRESETS=Object.freeze([
  Object.freeze({id:'qwen35-4b-iq2m-gguf',label:'Qwen 3.5 4B · GGUF IQ2_M',url:'https://huggingface.co/eaddario/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-IQ2_M.gguf',sizeHint:'~1.6 GB',primary:true,note:'Lower-quality quantization to fit the browser single-file size limit. Not identical to your GGUF benchmark.'}),
  Object.freeze({id:'qwen35-2b-q4km-gguf',label:'Qwen 3.5 2B · GGUF Q4_K_M',url:'https://huggingface.co/SoAIHQ/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',sizeHint:'~1.3 GB',primary:false,note:'Optional smaller GGUF; only one model is kept loaded at a time.'})
]);
let instance=null,loadedUrl='',loading=null,downloading=false,importing=false;
const OPFS='/app/local-ai/browser-gguf-opfs-v1.js?v=gguf-opfs-v1';
const clean=value=>String(value??'').trim();
function err(code,message){return Object.assign(new Error(message),{code})}
function validateURL(value){
  let url;try{url=new URL(clean(value))}catch{throw err('GGUF_URL_INVALID','Enter a valid model download URL.')}
  if(url.protocol!=='https:'||url.hostname!=='huggingface.co'||!url.pathname.toLowerCase().endsWith('.gguf')||url.username||url.password||url.search||url.hash)
    throw err('GGUF_URL_NOT_ALLOWED','GGUF downloads must use a direct https://huggingface.co/.../resolve/.../*.gguf URL without credentials.');
  return url.href;
}
export function current(){try{const s=JSON.parse(localStorage.getItem(GGUF_SELECTION_KEY)||'null');return s?.enabled&&s?.engine==='wllama'&&s?.url&&s?.model? s:null}catch{return null}}
function notify(stage,detail={}){try{dispatchEvent(new CustomEvent('civweave:gguf-browser-progress',{detail:{stage,...detail}}))}catch{}}
async function engine(){
  if(instance)return instance;
  const module=await import(ENGINE);
  if(typeof module.Wllama!=='function')throw err('GGUF_ENGINE_UNAVAILABLE','The self-hosted browser GGUF runtime was not staged.');
  instance=new module.Wllama({default:WASM});
  return instance;
}
async function models(){
  const api=await engine();
  return api.modelManager.getModels();
}
export async function installed(url){
  const key=validateURL(url);
  const cached=await models();
  return cached.find(item=>item.url===key && item.validate()==='valid')||null;
}
export async function download(url,{onProgress}={}){
  if(downloading)throw err('GGUF_DOWNLOAD_BUSY','Another GGUF download is already running.');
  const key=validateURL(url);
  const cached=await installed(key);if(cached)return{url:key,bytes:cached.size,cached:true};
  downloading=true;notify('downloading',{url:key,loaded:0,total:0});
  try{
    const api=await engine();
    const saved=await api.modelManager.downloadModel(key,{progressCallback:progress=>{
      const loaded=Number(progress?.loaded||0),total=Number(progress?.total||0);
      notify('downloading',{url:key,loaded,total});
      try{onProgress?.({loaded,total})}catch{}
    }});
    if(saved.validate()!=='valid')throw err('GGUF_CACHE_INCOMPLETE','Download ended without a complete verified GGUF cache entry.');
    notify('ready',{url:key,bytes:saved.size});
    return{url:key,bytes:saved.size,cached:false};
  }catch(error){notify('failed',{url:key,error:clean(error?.message)});throw error}
  finally{downloading=false}
}

const IMPORT_CACHE='civweave-gguf-file-import-v1';
const IMPORT_INDEX_KEY='civweave.mobile.gguf.import-index.v1';
const MAX_GGUF_SHARD_BYTES=2_000_000_000;
function importIndex(){
  try { const value=JSON.parse(localStorage.getItem(IMPORT_INDEX_KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{} }
  catch{return{}}
}
function importName(name){
  const value=String(name||'');
  if(!/\.gguf$/i.test(value)||value.length>200||/[/\\]/.test(value))throw err('GGUF_FILE_NAME','Select GGUF files with ordinary .gguf filenames.');
  return value;
}
function modelFromFile(name){
  if(/qwen[._-]?3[._-]?5[._-]?4b(?!\d)/i.test(name))return {family:'4b',id:'qwen35-4b-imported-gguf',label:'Qwen 3.5 4B · imported GGUF'};
  if(/qwen[._-]?3[._-]?5[._-]?2b(?!\d)/i.test(name))return {family:'2b',id:'qwen35-2b-imported-gguf',label:'Qwen 3.5 2B · imported GGUF'};
  throw err('GGUF_MODEL_NAME','The file name must identify Qwen 3.5 4B or 2B. Other models are not enabled for this phone-primary path.');
}
function orderedFiles(input){
  const files=Array.from(input||[]);
  if(!files.length||files.length>24)throw err('GGUF_IMPORT_FILES','Select a GGUF file or up to 24 proper GGUF split shards together.');
  const rows=files.map(file=>{
    const name=importName(file?.name);
    if(!file?.slice||!Number.isSafeInteger(file.size)||file.size<1)throw err('GGUF_IMPORT_FILE','A selected GGUF cannot be read by the browser.');
    if(file.size>MAX_GGUF_SHARD_BYTES)throw err('GGUF_FILE_TOO_LARGE',
      name+' is larger than the browser engine’s 2 GB per-file limit. Select proper llama-gguf-split shards of this same GGUF; do not download a different quantization. An unsplit original cannot be loaded here yet.');
    const match=/^(.*)-(\d{5})-of-(\d{5})\.gguf$/i.exec(name);
    return{file,name,match};
  });
  if(rows.length===1&&!rows[0].match)return rows;
  const first=rows[0].match;
  if(!first)throw err('GGUF_SPLIT_FORMAT','Multiple GGUF files must be proper llama-gguf-split shards named -00001-of-0000N.gguf.');
  const count=Number(first[3]),prefix=first[1];
  if(count!==rows.length||count<2)throw err('GGUF_SHARDS_MISSING','Select all '+count+' shards of the same GGUF together.');
  if(rows.some(r=>!r.match||r.match[1]!==prefix||Number(r.match[3])!==count))
    throw err('GGUF_SHARDS_MISMATCH','GGUF shards must have the same original model basename and shard count.');
  rows.sort((a,b)=>Number(a.match[2])-Number(b.match[2]));
  rows.forEach((row,i)=>{if(Number(row.match[2])!==i+1)throw err('GGUF_SHARDS_MISSING','Missing GGUF shard '+String(i+1).padStart(5,'0')+'.')});
  return rows;
}
function cachePath(importId,index){
  return new URL('/__civweave/gguf-file-import-v1/'+encodeURIComponent(importId)+'/'+String(index).padStart(5,'0')+'.gguf',location.origin).href;
}
async function blobsFor(record){
  if(record?.storage==='civweave.gguf.import-opfs.v1'){
    const store=await import(OPFS);
    return store.readGGUFShards(record);
  }
  if(!record||!Array.isArray(record.files)||!record.files.length)throw err('GGUF_IMPORT_RECORD','No saved imported GGUF shards found.');
  const cache=await caches.open(IMPORT_CACHE),blobs=[];
  for(const item of record.files){
    const response=await cache.match(cachePath(record.importId,item.index));
    if(!response)throw err('GGUF_IMPORT_MISSING','An imported GGUF shard is absent from browser storage. Re-import the model without changing its quantization.');
    const blob=await response.blob();
    if(blob.size!==item.size)throw err('GGUF_IMPORT_DAMAGED','An imported GGUF shard has the wrong size. Re-import the original file.');
    const magic=new Uint8Array(await blob.slice(0,4).arrayBuffer());
    if(magic.length!==4||magic[0]!==71||magic[1]!==71||magic[2]!==85||magic[3]!==70)
      throw err('GGUF_IMPORT_DAMAGED','A cached imported file does not contain a GGUF header.');
    blobs.push(blob);
  }
  return blobs;
}
export async function importFiles(input,{onProgress,signal}={}){
  if(downloading||importing)throw err('GGUF_IMPORT_BUSY','A GGUF model download or import is already running.');
  importing=true;
  let importId=null,store=null,written=[];
  const emitProgress=details=>{
    notify('importing',{model:details.model,loaded:details.loaded,total:details.total,
      file:details.file,index:details.index,count:details.count,phase:details.phase});
    try{onProgress?.(details)}catch{}
  };
  try{
    let incoming=Array.from(input||[]);
    if(signal?.aborted)throw err('GGUF_IMPORT_CANCELLED','Import was cancelled.');
    // A GGUF tensor can exceed 500MB; the splitter preserves each quantized
    // tensor intact, with correctly rewritten GGUF shard metadata and offsets.
    if(incoming.length===1&&incoming[0]?.size>MAX_GGUF_SHARD_BYTES){
      const original=incoming[0],family=modelFromFile(importName(original.name));
      const splitter=await import('/app/local-ai/gguf-split-browser-v1.js?v=gguf-split-v1');
      notify('auto-shard-plan',{model:family.id,bytes:original.size});
      const plan=await splitter.planGGUFSplit(original);
      incoming=plan.groups.map((group,index)=>{
        const blob=splitter.shardFromPlan(plan,index);
        return new File([blob],splitter.splitName(original.name,index,plan.groups.length),{type:'application/octet-stream'});
      });
      notify('auto-shard-ready',{model:family.id,shards:incoming.length,bytes:original.size});
      emitProgress({model:family.id,loaded:0,total:original.size,
        file:'Prepared '+incoming.length+' lossless GGUF shards',index:0,count:incoming.length,phase:'preparing'});
    }
    const rows=orderedFiles(incoming),model=modelFromFile(rows[0].name);
    if(rows.some(row=>modelFromFile(row.name).family!==model.family))
      throw err('GGUF_SHARDS_MISMATCH','All selected GGUF shards must refer to the same Qwen model.');
    for(const row of rows){
      const magic=new Uint8Array(await row.file.slice(0,4).arrayBuffer());
      if(magic.length!==4||magic[0]!==71||magic[1]!==71||magic[2]!==85||magic[3]!==70)
        throw err('GGUF_BAD_HEADER',row.name+' is not a GGUF model file.');
    }
    const total=rows.reduce((sum,row)=>sum+row.file.size,0);
    store=await import(OPFS);
    await store.checkCapacity(total);
    const dir=await store.directory();
    importId='file-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
    const record={schema:'civweave.gguf.import.v1',storage:store.GGUF_OPFS_SCHEMA,
      importId,model:model.id,label:model.label,
      sourceNames:rows.map(row=>row.name),bytes:total,files:[],importedAt:new Date().toISOString()};
    let completed=0;
    for(let i=0;i<rows.length;i++){
      if(signal?.aborted)throw err('GGUF_IMPORT_CANCELLED','Import cancelled. Your original GGUF file is unchanged.');
      const row=rows[i];
      // Track even an incomplete write, so errors never leave unpublished
      // multi-GB shard files consuming the user's OPFS storage.
      written.push(i);
      const result=await store.writeGGUFShard(dir,importId,i,row.file,{signal,onProgress:part=>{
        emitProgress({model:model.id,loaded:completed+part.written,total,
          file:row.name,index:i+1,count:rows.length,part:part.part,parts:part.parts,phase:'writing'});
      }});
      completed+=row.file.size;
      record.files.push({...result});
      emitProgress({model:model.id,loaded:completed,total,
        file:row.name,index:i+1,count:rows.length,phase:'shard-verified'});
    }
    emitProgress({model:model.id,loaded:total,total,
      file:'Verifying saved GGUF shards',index:rows.length,count:rows.length,phase:'verifying'});
    await store.readGGUFShards(record);
    if(signal?.aborted)throw err('GGUF_IMPORT_CANCELLED','Import cancelled before model activation.');
    const index=importIndex();
    index[importId]=record;
    localStorage.setItem(IMPORT_INDEX_KEY,JSON.stringify(index));
    notify('imported',{model:record.model,loaded:total,total,count:rows.length,storage:'opfs'});
    return record;
  }catch(error){
    if(importId&&store)await store.removeGGUFShards(importId,written);
    notify('import-failed',{reason:String(error?.message||error).slice(0,240)});
    throw error;
  }finally{importing=false}
}
// Direct preset installs stream into OPFS instead of buffering a multi-GB
// Response.blob(), duplicating CacheStorage weights or opening another tab.
// Only curated, explicitly selected sub-2GB GGUF URLs are accepted here.
export async function installPresetIntoImports(presetId,{signal,onProgress=()=>{},fetcher=fetch}={}){
 if(downloading||importing)throw err('GGUF_IMPORT_BUSY','Another model install/import is running.');
 const preset=GGUF_PRESETS.find(row=>row.id===presetId);
 if(!preset)throw err('GGUF_PRESET_UNKNOWN','This GGUF preset is not in the approved browser catalog.');
 const url=validateURL(preset.url);
 const name=decodeURIComponent(new URL(url).pathname.split('/').pop()||'');
 const model=modelFromFile(name);
 downloading=true;
 let store=null,importId=null,stream=null,complete=false;
 const progress=(loaded,total)=>{
   notify('importing',{model:model.id,loaded,total,file:name,phase:'downloading'});
   try{onProgress({model:model.id,loaded,total,file:name,phase:'downloading'})}catch{}
 };
 try{
   if(signal?.aborted)throw err('GGUF_IMPORT_CANCELLED','GGUF download cancelled.');
   const response=await fetcher(url,{mode:'cors',credentials:'omit',cache:'no-store',signal});
   if(!response.ok||!response.body?.getReader)
     throw err('GGUF_PRESET_DOWNLOAD_FAILED','The GGUF source did not provide a readable download stream (HTTP '+response.status+').');
   const declared=Number(response.headers?.get?.('content-length')||0);
   if(declared>MAX_GGUF_SHARD_BYTES)
     throw err('GGUF_FILE_TOO_LARGE','The chosen model is larger than the Wllama 2 GB limit; import pre-split GGUF files instead.');
   store=await import(OPFS);
   if(declared>0)await store.checkCapacity(declared);
   const dir=await store.directory();
   importId='file-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
   const handle=await dir.getFileHandle(importId+'-00000.gguf',{create:true});
   stream=await handle.createWritable();
   const reader=response.body.getReader();
   let bytes=0;
   try{
     while(true){
       if(signal?.aborted)throw err('GGUF_IMPORT_CANCELLED','GGUF download cancelled. Existing GGUFs are preserved.');
       const {done,value}=await reader.read();
       if(done)break;
       bytes+=value.byteLength;
       if(bytes>MAX_GGUF_SHARD_BYTES)
         throw err('GGUF_FILE_TOO_LARGE','Download exceeded this browser engine’s 2 GB single-shard limit.');
       await stream.write(value);
       progress(bytes,declared||0);
     }
   }finally{try{await reader.cancel()}catch{}}
   await stream.close();stream=null;
   const file=await handle.getFile();
   if(file.size!==bytes||bytes<24||(declared&&declared!==bytes))
     throw err('GGUF_IMPORT_DAMAGED','Downloaded GGUF size does not match the response.');
   const magic=new Uint8Array(await file.slice(0,4).arrayBuffer());
   if(magic.length!==4||magic[0]!==71||magic[1]!==71||magic[2]!==85||magic[3]!==70)
     throw err('GGUF_BAD_HEADER','The downloaded data is not a GGUF file.');
   const record={schema:'civweave.gguf.import.v1',storage:store.GGUF_OPFS_SCHEMA,
     importId,model:model.id,label:model.label,sourceNames:[name],bytes,
     files:[{name:importId+'-00000.gguf',index:0,size:bytes}],importedAt:new Date().toISOString()};
   await store.readGGUFShards(record);
   const index=importIndex();
   index[importId]=record;
   localStorage.setItem(IMPORT_INDEX_KEY,JSON.stringify(index));
   complete=true;progress(bytes,bytes);
   notify('imported',{model:record.model,loaded:bytes,total:bytes,count:1,storage:'opfs'});
   return record;
 }catch(error){
   notify('import-failed',{reason:String(error?.message||error).slice(0,240)});
   throw error;
 }finally{
   if(stream)try{await stream.abort()}catch{}
   if(store&&importId&&!complete)await store.removeGGUFShards(importId,[0]);
   downloading=false;
 }
}

// Read only Civweave's persisted import manifest and the actual saved shard
// headers/sizes. Fleet discovery never initializes Wllama, starts a model or
// downloads weights, and works with any imported quantization of these sizes.
export async function installedImports({verify=true}={}){
  const records=Object.values(importIndex()).filter(record=>
    record?.schema==='civweave.gguf.import.v1'&&
    ['qwen35-2b-imported-gguf','qwen35-4b-imported-gguf'].includes(record.model));
  const available=[];
  for(const record of records){
    let verified=false,error='';
    try{
      if(!Array.isArray(record.files)||!record.files.length)throw Error('Missing shard manifest.');
      if(verify)await blobsFor(record);
      verified=true;
    }catch(cause){error=String(cause?.message||cause).slice(0,240)}
    const name=String(record.sourceNames?.[0]||'');
    const quantization=(name.match(/(?:^|[-_.])(IQ[1-4]_[A-Za-z0-9_]+|Q[2-8]_[A-Za-z0-9_]+)/i)||[])[1]||'imported GGUF';
    available.push(Object.freeze({
      importId:String(record.importId),model:record.model,
      family:record.model.includes('-2b-')?'2b':'4b',
      label:String(record.label||record.model),quantization,
      sourceNames:Array.isArray(record.sourceNames)?record.sourceNames.slice(0,24):[],
      bytes:Number(record.bytes||0),importedAt:String(record.importedAt||''),
      verified,error
    }));
  }
  return available;
}
// Role-specific selection is transient. Activating a fleet role must not
// overwrite the primary GGUF selection shared with legacy consumers.
export function selectionForImported(importId){
  const record=importIndex()[String(importId||'')];
  if(!record||record.schema!=='civweave.gguf.import.v1'||
      !['qwen35-2b-imported-gguf','qwen35-4b-imported-gguf'].includes(record.model))
    throw err('GGUF_IMPORT_NOT_FOUND','The fleet-selected GGUF import is missing from Civweave storage.');
  return{schema:'civweave.mobile.gguf-browser.v2',enabled:true,engine:'wllama',
    source:'file',importId:record.importId,model:record.model,label:record.label,
    url:'civweave-gguf-import:'+record.importId,bytes:record.bytes};
}

// Remove only Civweave's browser-owned copy, never the original in Downloads.
// Wait for the in-flight request before unloading or deleting its shards.
export async function removeImported(importId){
  const id=String(importId||'');
  if(importing||downloading)throw err('GGUF_REMOVE_BUSY','Finish the current GGUF import/download before uninstalling.');
  const record=importIndex()[id];
  if(!record||record.schema!=='civweave.gguf.import.v1')
    throw err('GGUF_IMPORT_NOT_FOUND','The imported model was already removed.');
  await generationTail;
  const wasSelected=current()?.importId===id;
  if(wasSelected||loadedUrl==='civweave-gguf-import:'+id)await release();
  if(wasSelected)localStorage.removeItem(GGUF_SELECTION_KEY);
  if(record.storage==='civweave.gguf.import-opfs.v1'){
    const store=await import(OPFS);
    await store.removeGGUFShards(id,(record.files||[]).map(file=>file.index),{strict:true});
  }else{
    const cache=await caches.open(IMPORT_CACHE);
    for(const file of record.files||[])await cache.delete(cachePath(id,file.index));
  }
  const index=importIndex();delete index[id];
  localStorage.setItem(IMPORT_INDEX_KEY,JSON.stringify(index));
  notify('uninstalled',{model:record.model,importId:id,bytes:record.bytes});
  return{importId:id,model:record.model,bytes:record.bytes,wasSelected};
}

export async function activateImported(importId){
  const record=importIndex()[String(importId||'')];
  if(!record||record.schema!=='civweave.gguf.import.v1')
    throw err('GGUF_IMPORT_NOT_FOUND','The selected imported GGUF is not in Civweave browser storage.');
  await blobsFor(record);
  const selected={schema:'civweave.mobile.gguf-browser.v2',enabled:true,engine:'wllama',
    source:'file',importId:record.importId,model:record.model,label:record.label,
    url:'civweave-gguf-import:'+record.importId,bytes:record.bytes,selectedAt:new Date().toISOString()};
  localStorage.setItem(GGUF_SELECTION_KEY,JSON.stringify(selected));
  notify('selected',{model:selected.model,source:'file',bytes:selected.bytes});
  return selected;
}

export async function activate({url,id,label}){
  const key=validateURL(url);
  const fileName=decodeURIComponent(new URL(key).pathname.split('/').pop()||'');
  const expected=id==='qwen35-4b-iq2m-gguf'?/qwen[._-]?3[._-]?5[._-]?4b/i:id==='qwen35-2b-q4km-gguf'?/qwen[._-]?3[._-]?5[._-]?2b/i:null;
  if(!expected||!expected.test(fileName))throw err('GGUF_IDENTITY_MISMATCH','The downloaded GGUF filename does not match the selected Qwen 3.5 model size.');
  const file=await installed(key);
  if(!file)throw err('GGUF_NOT_DOWNLOADED','Download this GGUF within Civweave first. No server or alternate engine will be used.');
  const selected={schema:'civweave.mobile.gguf-browser.v2',enabled:true,engine:'wllama',model:clean(id||file.url.split('/').pop()).slice(0,120),label:clean(label||'GGUF on phone').slice(0,120),url:key,bytes:file.size,selectedAt:new Date().toISOString()};
  localStorage.setItem(GGUF_SELECTION_KEY,JSON.stringify(selected));
  notify('selected',{model:selected.model,url:key});
  return selected;
}
async function start(selected,onPhase=()=>{}){
  const source=selected.source==='file'
    ?(await (async()=>{const record=importIndex()[selected.importId];if(!record||record.model!==selected.model)throw err('GGUF_IMPORT_NOT_FOUND','The selected imported GGUF is missing.');return blobsFor(record)})())
    :await installed(selected.url);
  if(!source)throw err('GGUF_CACHE_MISSING','The selected GGUF is not completely cached. Return to Settings to download it again.');
  if(instance?.isModelLoaded?.()&&loadedUrl===selected.url){onPhase('ready',{reused:true});return instance}
  if(loading)return loading;
  loading=(async()=>{
    const api=await engine();
    if(api.isModelLoaded?.()){await api.exit();instance=null;loadedUrl=''}
    const create=async gpuLayers=>{
      const current=await engine();
      onPhase('loading',{backend:gpuLayers?'webgpu':'wasm-cpu',gpuLayers,bytes:selected.bytes});
      await current.loadModel(source,{n_ctx:2048,n_parallel:1,n_threads:1,n_batch:64,n_ubatch:64,n_gpu_layers:gpuLayers,jinja:true,default_template_kwargs:{enable_thinking:false},reasoning:false});
      loadedUrl=selected.url;
      onPhase('ready',{backend:gpuLayers?'webgpu':'wasm-cpu',gpuLayers,n_ctx:2048,n_parallel:1});
      return current;
    };
    try{
      notify('loading',{model:selected.model,backend:'webgpu',gpuLayers:8});
      return await create(8);
    }catch(gpuError){
      const gpuReason=clean(gpuError?.message).slice(0,500);
      notify('gpu-fallback',{model:selected.model,reason:gpuReason});
      onPhase('gpu-fallback',{reason:gpuReason});
      try{await instance?.exit()}catch{}
      instance=null;loadedUrl='';
      try{return await create(0)}
      catch(cpuError){throw err('GGUF_LOAD_FAILED','Browser GGUF did not load. WebGPU: '+gpuReason+'; CPU/WASM: '+clean(cpuError?.message).slice(0,500)+'. Your imported Q4 weights remain on this device.')}
    }
  })().finally(()=>{loading=null});
  return loading;
}
async function generateInternal({model,importId,messages,temperature=.6,maxTokens=1024,structured=false,signal,onToken,onPhase=()=>{}}={}){
  const selected=importId?selectionForImported(importId):current();
  if(!selected||selected.model!==model)throw err('GGUF_SELECTION_MISMATCH','Browser GGUF is not selected, or another model replaced the selected ID.');
  if(signal?.aborted)throw err('GGUF_ABORTED','GGUF generation cancelled before model loading.');
  let phase='model-loading';
  const updatePhase=(name,details={})=>{phase=name;try{onPhase?.(name,details)}catch{}};
  let api;
  try{api=await start(selected,updatePhase)}catch(error){
    if(error?.code)throw error;
    throw err('GGUF_LOAD_FAILED','Browser GGUF model load failed: '+clean(error?.message).slice(0,700));
  }
  if(signal?.aborted)throw err('GGUF_ABORTED','GGUF generation cancelled.');
  const watchdogModule=await import('/app/local-ai/gguf-generation-watch-v1.js?v=gguf-generation-watch-v2-prefill');
  const watchdog=watchdogModule.createGGUFGenerationWatch({
    signal,onProgress:(stage,details)=>updatePhase(stage,details)
  });
  let output='',chunks=0,finishReason=null,prefill=null,firstStreamAt=null,streamEvents=0;
  const params={
    model:selected.model,
    messages:(Array.isArray(messages)?messages:[]).map(row=>({role:['system','assistant','user'].includes(row?.role)?row.role:'user',content:clean(row?.content)})).filter(row=>row.content),
    temperature:Number.isFinite(Number(temperature))?Math.max(0,Math.min(1.5,Number(temperature))):.6,
    max_tokens:Math.max(24,Math.min(1024,Number(maxTokens)||1024)),
    stream:true,abortSignal:watchdog.signal,return_progress:true,cache_prompt:true,
    chat_template_kwargs:{enable_thinking:false},
    ...(structured?{response_format:{type:'json_object'}}:{})
  };
  notify('generating',{model:selected.model,maxTokens:params.max_tokens,structured});
  updatePhase('waiting-first-token',{backend:'wllama',maxTokens:params.max_tokens,
    timeoutMs:watchdogModule.GGUF_FIRST_VISIBLE_MS,structured});
  try{
    // Race each iterator read with the abort promise; even if a wasm/worker
    // iterator ignores AbortSignal, a stalled UI can terminate the request.
    const stream=await Promise.race([api.createChatCompletion(params),watchdog.cancelled]);
    if(!stream?.[Symbol.asyncIterator])throw err('GGUF_STREAM_UNAVAILABLE','Wllama did not provide the expected streaming iterator.');
    const iterator=stream[Symbol.asyncIterator]();
    while(true){
      const next=await Promise.race([iterator.next(),watchdog.cancelled]);
      if(next.done)break;
      const chunk=next.value;
      streamEvents++;
      if(firstStreamAt===null)firstStreamAt=Date.now();
      if(chunk?.prompt_progress){
        const progress=chunk.prompt_progress;
        const processed=Number(progress?.processed||0),total=Number(progress?.total||0),cached=Number(progress?.cache||0);
        prefill={processed,total,cached,timeMs:Number(progress?.time_ms||0),elapsedMs:watchdog.snapshot().elapsedMs};
        if(streamEvents<=3||streamEvents%16===0||processed>=total)
          updatePhase('prefill',{processed,total,cached,progressPercent:total?Math.round(processed/total*100):null,
            elapsedMs:prefill.elapsedMs,backend:'wllama'});
        watchdog.prefill?.(prefill);
      }
      const choice=chunk?.choices?.[0]||{},delta=choice.delta||{};
      finishReason=choice.finish_reason||finishReason;
      const visible=String(delta.content??'');
      const hidden=String(delta.reasoning_content??delta.reasoning??'');
      if(visible){
        output+=visible;chunks++;
        watchdog.chunk({visible:true});
        // Only surface the visible content, not hidden model reasoning.
        try{onToken?.(visible,output)}catch{}
      }else if(hidden){
        watchdog.chunk({hidden:true});
      }
    }
    if(!output.trim())throw err('GGUF_EMPTY','Wllama finished without visible text; stream events='+streamEvents+', hidden chunks='+watchdog.snapshot().hiddenChunks+', last prefill='+(prefill?prefill.processed+'/'+prefill.total:'not reported')+'. Your imported Q4 model remains available.');
    const metrics=watchdog.snapshot();
    updatePhase('complete',{chunks,finishReason,firstTokenMs:metrics.firstTokenMs,
      elapsedMs:metrics.elapsedMs,firstStreamMs:firstStreamAt===null?null:firstStreamAt-(Date.now()-metrics.elapsedMs),prefill});
    notify('complete',{model:selected.model,chunks,finishReason});
    return{text:output,model:selected.model,streamed:true,backend:'browser-wllama',chunks,finishReason,metrics};
  }catch(error){
    const reason=clean(error?.message).slice(0,700),metrics=watchdog.snapshot();
    notify('failed',{model:selected.model,phase,error:reason,code:error?.code,metrics});
    updatePhase('failed',{failedStage:phase,reason,code:error?.code||'GGUF_INFERENCE_FAILED',
      ...metrics,streamEvents,prefill,backend:'wllama'});
    if(signal?.aborted)throw err('GGUF_ABORTED','GGUF '+phase+' was cancelled. Imported Q4 weights remain installed.');
    // Do not hide the watchdog's actionable error behind a generic
    // 'Operation aborted' from Wllama.
    if(watchdog.signal.aborted&&watchdog.signal.reason?.code){
      const cause=watchdog.signal.reason;
      throw err(cause.code,cause.message+' Diagnostic: stream events='+streamEvents+
        ', hidden chunks='+metrics.hiddenChunks+', prefill='+
        (prefill?prefill.processed+'/'+prefill.total:'not reported')+
        ', first stream event='+(firstStreamAt===null?'none':'observed')+'.');
    }
    throw err(error?.code||'GGUF_INFERENCE_FAILED','Browser GGUF '+phase+' failed: '+reason+'. Imported Q4 weights were not removed.');
  }finally{watchdog.stop()}
}
// Wllama keeps one active model. Serializing complete generations prevents a
// 2B request from reusing an in-progress 4B load or unloading live inference.
let generationTail=Promise.resolve();
export function generate(request={}){
  const queued=generationTail.then(()=>{
    if(request.signal?.aborted)throw err('GGUF_ABORTED','Fleet generation was cancelled before its turn.');
    return generateInternal(request);
  });
  generationTail=queued.catch(()=>{});
  return queued;
}
export async function release(){
  if(loading)try{await loading}catch{}
  if(instance)try{await instance.exit()}catch{}
  instance=null;loadedUrl='';
}
