// Civweave in-browser GGUF runtime. No localhost server, LiteRT, or network inference.
const ENGINE='/app/vendor/wllama/esm/index.js';
const WASM='/app/vendor/wllama/esm/wasm/wllama.wasm';
export const GGUF_SELECTION_KEY='civweave.mobile.gguf-primary.v2';
export const GGUF_PRESETS=Object.freeze([
  Object.freeze({id:'qwen35-4b-iq2m-gguf',label:'Qwen 3.5 4B · GGUF IQ2_M',url:'https://huggingface.co/eaddario/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-IQ2_M.gguf',sizeHint:'~1.6 GB',primary:true,note:'Lower-quality quantization to fit the browser single-file size limit. Not identical to your GGUF benchmark.'}),
  Object.freeze({id:'qwen35-2b-q4km-gguf',label:'Qwen 3.5 2B · GGUF Q4_K_M',url:'https://huggingface.co/SoAIHQ/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',sizeHint:'~1.3 GB',primary:false,note:'Optional smaller GGUF; only one model is kept loaded at a time.'})
]);
let instance=null,loadedUrl='',loading=null,downloading=false;
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
export async function importFiles(input,{onProgress}={}){
  if(downloading)throw err('GGUF_DOWNLOAD_BUSY','Wait for the active GGUF transfer to finish.');
  let incoming=Array.from(input||[]);
  // The original Q4 model can be larger than Wllama's per-file ArrayBuffer
  // limit. Convert it in-browser into standard GGUF tensor-aligned shards.
  // Blob.slice keeps the original quantized tensor bytes unchanged.
  if(incoming.length===1&&incoming[0]?.size>MAX_GGUF_SHARD_BYTES){
    const original=incoming[0],family=modelFromFile(importName(original.name));
    const splitter=await import('/app/local-ai/gguf-split-browser-v1.js?v=gguf-split-v1');
    notify('auto-shard-plan',{model:family.id,bytes:original.size});
    // Use the splitter's tested Qwen-safe target (1.8GB). Tensor-aligned GGUF
    // shards must never cut a single quantized embedding tensor in half.
    const plan=await splitter.planGGUFSplit(original);
    incoming=plan.groups.map((group,index)=>{
      const blob=splitter.shardFromPlan(plan,index);
      return new File([blob],splitter.splitName(original.name,index,plan.groups.length),{type:'application/octet-stream'});
    });
    notify('auto-shard-ready',{model:family.id,shards:incoming.length,bytes:original.size});
    try{onProgress?.({loaded:0,total:original.size,file:'Prepared '+incoming.length+' lossless GGUF shards',index:0,count:incoming.length})}catch{}
  }
  const rows=orderedFiles(incoming),model=modelFromFile(rows[0].name);
  if(rows.some(row=>modelFromFile(row.name).family!==model.family))
    throw err('GGUF_SHARDS_MISMATCH','All selected GGUF shards must refer to the same Qwen model.');
  for(const row of rows){
    const magic=new Uint8Array(await row.file.slice(0,4).arrayBuffer());
    if(magic.length!==4||magic[0]!==71||magic[1]!==71||magic[2]!==85||magic[3]!==70)
      throw err('GGUF_BAD_HEADER',row.name+' is not a GGUF model file.');
  }
  const importId='file-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  const cache=await caches.open(IMPORT_CACHE),written=[],total=rows.reduce((sum,row)=>sum+row.file.size,0);
  const record={schema:'civweave.gguf.import.v1',importId,model:model.id,label:model.label,sourceNames:rows.map(row=>row.name),bytes:total,files:[],importedAt:new Date().toISOString()};
  let loaded=0;
  try{
    for(let i=0;i<rows.length;i++){
      const row=rows[i],key=cachePath(importId,i);
      notify('importing',{model:model.id,file:row.name,index:i+1,count:rows.length,loaded,total});
      await cache.put(key,new Response(row.file,{headers:{'content-type':'application/octet-stream'}}));
      written.push(key);
      record.files.push({index:i,name:row.name,size:row.file.size});
      loaded+=row.file.size;
      try{onProgress?.({loaded,total,file:row.name,index:i+1,count:rows.length})}catch{}
    }
    await blobsFor(record);
    const index=importIndex();
    index[importId]=record;
    localStorage.setItem(IMPORT_INDEX_KEY,JSON.stringify(index));
    notify('imported',{model:record.model,loaded:total,total,count:rows.length});
    return record;
  }catch(error){
    for(const key of written)try{await cache.delete(key)}catch{}
    notify('import-failed',{model:record.model,reason:String(error?.message||error).slice(0,240)});
    throw error;
  }
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
async function start(selected){
  const source=selected.source==='file'
    ?(await (async()=>{const record=importIndex()[selected.importId];if(!record||record.model!==selected.model)throw err('GGUF_IMPORT_NOT_FOUND','The selected imported GGUF is missing.');return blobsFor(record)})())
    :await installed(selected.url);
  if(!source)throw err('GGUF_CACHE_MISSING','The selected GGUF is not completely cached. Return to Settings to download it again.');
  if(instance?.isModelLoaded?.()&&loadedUrl===selected.url)return instance;
  if(loading)return loading;
  loading=(async()=>{
    const api=await engine();
    if(api.isModelLoaded?.()){await api.exit();instance=null;loadedUrl=''}
    const create=async gpuLayers=>{
      const current=await engine();
      await current.loadModel(source,{n_ctx:6144,n_threads:1,n_batch:128,n_ubatch:64,n_gpu_layers:gpuLayers,jinja:true,default_template_kwargs:{enable_thinking:false},reasoning:false});
      loadedUrl=selected.url;
      return current;
    };
    try{
      notify('loading',{model:selected.model,backend:'webgpu',gpuLayers:8});
      return await create(8);
    }catch(gpuError){
      notify('gpu-fallback',{model:selected.model,reason:clean(gpuError?.message).slice(0,300)});
      try{await instance?.exit()}catch{}
      instance=null;loadedUrl='';
      try{return await create(0)}
      catch(cpuError){throw err('GGUF_LOAD_FAILED','GGUF could not start in browser WebGPU or CPU/WASM: '+clean(cpuError?.message))}
    }
  })().finally(()=>{loading=null});
  return loading;
}
export async function generate({model,messages,temperature=.6,maxTokens=1024,structured=false,signal,onToken}={}){
  const selected=current();
  if(!selected||selected.model!==model)throw err('GGUF_SELECTION_MISMATCH','Browser GGUF is not selected, or another model replaced the selected ID.');
  const api=await start(selected);
  if(signal?.aborted)throw err('GGUF_ABORTED','GGUF generation cancelled.');
  let output='',chunks=0;
  const params={
    model:selected.model,
    messages:(Array.isArray(messages)?messages:[]).map(row=>({role:['system','assistant','user'].includes(row?.role)?row.role:'user',content:clean(row?.content)})).filter(row=>row.content),
    temperature:Number.isFinite(Number(temperature))?Math.max(0,Math.min(1.5,Number(temperature))):.6,
    max_tokens:Math.max(32,Math.min(4096,Number(maxTokens)||1024)),
    stream:true,abortSignal:signal,
    chat_template_kwargs:{enable_thinking:false},
    ...(structured?{response_format:{type:'json_object'}}:{})
  };
  notify('generating',{model:selected.model});
  try{
    const stream=await api.createChatCompletion(params);
    for await(const chunk of stream){
      if(signal?.aborted)throw err('GGUF_ABORTED','GGUF generation cancelled.');
      const text=String(chunk?.choices?.[0]?.delta?.content??'');
      if(!text)continue;
      output+=text;chunks++;
      try{onToken?.(text,output)}catch{}
    }
    if(!output.trim())throw err('GGUF_EMPTY','Embedded GGUF returned no visible answer.');
    notify('complete',{model:selected.model,chunks});
    return{text:output,model:selected.model,streamed:true,backend:'browser-wllama',chunks};
  }catch(error){notify('failed',{model:selected.model,error:clean(error?.message)});throw error}
}
export async function release(){
  if(loading)try{await loading}catch{}
  if(instance)try{await instance.exit()}catch{}
  instance=null;loadedUrl='';
}
