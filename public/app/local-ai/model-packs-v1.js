(()=>{
'use strict';

const VERSION='1.0.1-local-ai-model-packs-v1-browser-guard';
const CACHE='civweave-specialized-model-packs-v1';
const STATE_KEY='civweave.local-ai.packs.v1';
const EVENT='civweave:local-model-pack-progress';
const BROWSER_MANAGED_PACK_IDS=freeze(['premier-phone','server-quality']);
const BROWSER_INSTALL_ERROR='CIVWEAVE_AI_PACK_BROWSER_DOWNLOAD_REQUIRED';
if(globalThis.CivweaveLocalModelPacksV1?.version===VERSION)return;

const HF='https://huggingface.co';
const clean=(value,max=240)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const freeze=value=>Object.freeze(value);
const manager=()=>globalThis.CivweaveLocalModelDownloadV266;
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
const states=parse(localStorage.getItem(STATE_KEY),{});
const jobs=new Map();
let lastSave=0,lastEmit=0;

const artifact=(path,minBytes,sizeBytes)=>freeze({path,minBytes:Number(minBytes)||1,sizeBytes:Number(sizeBytes)||Number(minBytes)||1});
const specialized=(id,value)=>freeze({id,...value,artifacts:freeze((value.artifacts||[]).map(row=>artifact(...row)))});

const SPECIALIZED=freeze({
  'silero-vad-onnx':specialized('silero-vad-onnx',{
    label:'Silero VAD',repo:'csukuangfj/vad',revision:'af4fcfc9b8305246b1fe2ebcaf248975673166f1',estimatedBytes:1_807_522,license:'MIT',
    artifacts:[['silero_vad.onnx',1_700_000,1_807_522]]
  }),
  'parakeet-tdt-0.6b-v3-int8':specialized('parakeet-tdt-0.6b-v3-int8',{
    label:'Parakeet TDT 0.6B v3 INT8',repo:'csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8',revision:'876ff91b4ab4b89c328afdb2b27ff879d3e42f87',estimatedBytes:670_480_000,license:'CC-BY-4.0',
    artifacts:[
      ['encoder.int8.onnx',640_000_000,652_184_281],
      ['decoder.int8.onnx',11_000_000,11_845_275],
      ['joiner.int8.onnx',6_000_000,6_355_277],
      ['tokens.txt',80_000,93_900]
    ]
  }),
  'parakeet-tdt-0.6b-v3-fp32':specialized('parakeet-tdt-0.6b-v3-fp32',{
    label:'Parakeet TDT 0.6B v3 full precision',repo:'csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3',revision:'1a468a35cbba69418f126de829e75261dea4a4e4',estimatedBytes:2_550_000_000,license:'CC-BY-4.0',
    artifacts:[
      ['encoder.onnx',40_000_000,41_800_000],
      ['encoder.weights',2_400_000_000,2_435_420_160],
      ['decoder.onnx',45_000_000,47_233_743],
      ['joiner.onnx',24_000_000,25_286_330],
      ['tokens.txt',80_000,93_900]
    ]
  }),
  'omnilingual-asr-300m-int8':specialized('omnilingual-asr-300m-int8',{
    label:'Omnilingual ASR 300M INT8',repo:'csukuangfj2/sherpa-onnx-omnilingual-asr-1600-languages-300M-ctc-int8-2025-11-12',revision:'6fc542a3b0661c8278cca1230c34deb989f31202',estimatedBytes:365_100_000,license:'Apache-2.0',
    artifacts:[['model.int8.onnx',350_000_000,365_000_000],['tokens.txt',70_000,86_400]]
  }),
  'omnilingual-asr-1b-int8':specialized('omnilingual-asr-1b-int8',{
    label:'Omnilingual ASR 1B INT8',repo:'csukuangfj/sherpa-onnx-omnilingual-asr-1600-languages-1B-ctc-int8-2025-11-12',revision:'17db76eab583b0b868ffb0df104ab879145087e5',estimatedBytes:1_030_100_000,license:'Apache-2.0',
    artifacts:[['model.int8.onnx',1_000_000_000,1_030_000_000],['tokens.txt',70_000,86_400]]
  }),
  'supertonic-3-tts-int8':specialized('supertonic-3-tts-int8',{
    label:'Supertonic 3 TTS INT8',repo:'csukuangfj2/sherpa-onnx-supertonic-3-tts-int8-2026-05-11',revision:'cca5a0e6c96e1d2c720986bf7e75fcc81dee3ae4',estimatedBytes:180_000_000,license:'MIT',
    artifacts:[
      ['duration_predictor.int8.onnx',1_000_000,8_000_000],
      ['text_encoder.int8.onnx',1_000_000,15_000_000],
      ['vector_estimator.int8.onnx',70_000_000,78_400_833],
      ['vocoder.int8.onnx',24_000_000,25_991_073],
      ['tts.json',1_000,20_000],
      ['unicode_indexer.bin',250_000,262_144],
      ['voice.bin',500_000,517_168]
    ]
  })
});

const pack=(id,value)=>freeze({id,...value,generative:freeze([...(value.generative||[])]),specialized:freeze([...(value.specialized||[])]),installOrder:freeze([...(value.installOrder||[])])});
const PACKS=freeze({
  'minimum-spec':pack('minimum-spec',{
    label:'Minimum Spec Pack',
    target:'6–8 GB RAM · 4+ CPU cores · no WebGPU required for core chat',
    storage:'About 1.7 GB download; keep at least 3 GB free',
    estimatedBytes:1_653_000_000,
    primaryModel:'qwen3-0.6b-q8-wasm',
    fallbackModel:'smollm2-135m-instruct-q8-wasm',
    summary:'Smallest complete offline voice + chat pack. Its main text model runs in CPU/WASM and does not require WebGPU.',
    generative:['qwen3-0.6b-q8-wasm','smollm2-135m-instruct-q8-wasm'],
    specialized:['silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','supertonic-3-tts-int8'],
    installOrder:['qwen3-0.6b-q8-wasm','smollm2-135m-instruct-q8-wasm','silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','supertonic-3-tts-int8']
  }),
  'premier-phone':pack('premier-phone',{
    label:'Premier Phone Pack',
    target:'12 GB RAM · modern Android-class WebGPU',
    storage:'About 7.6 GB download; keep at least 11 GB free',
    estimatedBytes:7_577_000_000,
    primaryModel:'gemma4-e2b-it-q2f16-mobile',
    deepModel:'gemma4-e4b-it-q2f16-mobile',
    fallbackModel:'qwen3-0.6b-q8-wasm',
    summary:'Full phone-local multimodel ladder with fast Gemma 4, deep Gemma 4, multilingual speech, and a CPU-safe fallback.',
    generative:['gemma4-e2b-it-q2f16-mobile','gemma4-e4b-it-q2f16-mobile','qwen3-0.6b-q8-wasm'],
    specialized:['silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','omnilingual-asr-300m-int8','supertonic-3-tts-int8'],
    installOrder:['qwen3-0.6b-q8-wasm','gemma4-e2b-it-q2f16-mobile','silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','supertonic-3-tts-int8','omnilingual-asr-300m-int8','gemma4-e4b-it-q2f16-mobile']
  }),
  'server-quality':pack('server-quality',{
    label:'Server Quality Pack',
    target:'24+ GB RAM · 8+ modern CPU cores · strong WebGPU',
    storage:'About 13.0 GB download; keep at least 20 GB free',
    estimatedBytes:12_990_000_000,
    primaryModel:'gemma4-e4b-it-q2f16-mobile',
    fastModel:'gemma4-e2b-it-q2f16-mobile',
    alternateModel:'qwen3-4b-q4f16',
    fallbackModel:'qwen3-0.6b-q8-wasm',
    summary:'Higher-quality Guild/server bundle using the strongest currently executable Civweave local models plus full-precision realtime speech and wider ASR.',
    generative:['gemma4-e4b-it-q2f16-mobile','gemma4-e2b-it-q2f16-mobile','qwen3-4b-q4f16','qwen3-0.6b-q8-wasm'],
    specialized:['silero-vad-onnx','parakeet-tdt-0.6b-v3-fp32','omnilingual-asr-1b-int8','supertonic-3-tts-int8'],
    installOrder:['qwen3-0.6b-q8-wasm','gemma4-e2b-it-q2f16-mobile','silero-vad-onnx','supertonic-3-tts-int8','parakeet-tdt-0.6b-v3-fp32','omnilingual-asr-1b-int8','gemma4-e4b-it-q2f16-mobile','qwen3-4b-q4f16']
  })
});

function save(force=false){const t=Date.now();if(!force&&t-lastSave<500)return;lastSave=t;try{localStorage.setItem(STATE_KEY,JSON.stringify(states))}catch{}}
function set(id,patch,force=false){
  const previous=states[id]||{},next={...previous,...patch,updatedAt:now()};states[id]=next;save(force);
  const t=Date.now();
  if(force||t-lastEmit>180||previous.percent!==next.percent){
    lastEmit=t;
    try{dispatchEvent(new CustomEvent(EVENT,{detail:{version:VERSION,id,state:{...next}}}))}catch{}
  }
  return next;
}
function packById(id){const found=PACKS[clean(id,120)];if(!found)throw new Error(`Unknown AI pack: ${id}`);return found}
function specFor(id){return SPECIALIZED[id]||registry()?.byId?.(id)||null}
function isSpecialized(id){return Boolean(SPECIALIZED[id])}
function installMode(id){return BROWSER_MANAGED_PACK_IDS.includes(packById(id).id)?'browser':'in-app'}
function browserInstallRequired(item){
  const error=new Error(`${item.label} uses Civweave's browser-managed AI pack download/import path so its multi-gigabyte payload never has to pass through legacy Cache Storage.`);
  error.name='CivweaveBrowserPackInstallRequired';error.code=BROWSER_INSTALL_ERROR;error.packId=item.id;error.downloadMode='browser';return error;
}
function directUrl(model,art){return `${HF}/${model.repo}/resolve/${encodeURIComponent(model.revision)}/${art.path}`}
function assetUrl(modelId,path){const model=SPECIALIZED[clean(modelId,120)];if(!model)throw new Error(`Unknown specialized model: ${modelId}`);const art=model.artifacts.find(row=>row.path===path);if(!art)throw new Error(`Unknown asset ${path} for ${modelId}`);return directUrl(model,art)}
async function cachedAsset(model,art){
  const cache=await caches.open(CACHE),url=directUrl(model,art),response=await cache.match(url);
  if(!response?.ok)return{ok:false,url,path:art.path,bytes:0};
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(type.includes('text/html')){await cache.delete(url);return{ok:false,url,path:art.path,bytes:0,corrupt:true}}
  const bytes=Number(response.headers.get('content-length')||0)||art.sizeBytes||art.minBytes;
  if(bytes<art.minBytes){await cache.delete(url);return{ok:false,url,path:art.path,bytes,corrupt:true}}
  return{ok:true,url,path:art.path,bytes};
}
async function specializedStatus(id){
  const model=SPECIALIZED[id];if(!model)throw new Error(`Unknown specialized model: ${id}`);
  const rows=[];for(const art of model.artifacts)rows.push({...art,...await cachedAsset(model,art)});
  return{id,label:model.label,available:rows.every(row=>row.ok),rows,missing:rows.filter(row=>!row.ok),bytes:rows.filter(row=>row.ok).reduce((sum,row)=>sum+Number(row.bytes||0),0)};
}
async function componentStatus(id){
  if(isSpecialized(id))return specializedStatus(id);
  const m=manager();if(!m?.status)throw new Error('The local generative download manager is unavailable.');
  return m.status(id);
}
async function status(id){
  const item=packById(id),components=[];
  for(const component of item.installOrder)components.push({id:component,...await componentStatus(component)});
  const available=components.every(row=>row.available);
  const installedBytes=components.reduce((sum,row)=>sum+Number(row.bytes||row.state?.bytesDownloaded||row.rows?.reduce?.((n,a)=>n+Number(a.bytes||0),0)||0),0);
  if(available&&states[id]?.status!=='ready')set(id,{status:'ready',percent:100,installedAt:states[id]?.installedAt||now(),error:'',installedBytes},true);
  return{id:item.id,label:item.label,available,installed:available,components,installedBytes,state:states[id]||null};
}
async function storage(){
  const m=manager();if(m?.storage)return m.storage();
  if(!navigator.storage?.estimate)return{usage:0,quota:0,available:0,persisted:null};
  const estimate=await navigator.storage.estimate();return{usage:Number(estimate.usage||0),quota:Number(estimate.quota||0),available:Math.max(0,Number(estimate.quota||0)-Number(estimate.usage||0)),persisted:null};
}
async function missingBytes(item){
  let total=0;
  for(const id of item.installOrder){
    const current=await componentStatus(id);
    if(current.available)continue;
    if(isSpecialized(id))total+=current.missing.reduce((sum,row)=>sum+Number(row.sizeBytes||row.minBytes||0),0);
    else total+=Number(registry()?.byId?.(id)?.estimatedBytes||0);
  }
  return total;
}
function report(item,patch,force=false){
  const current=states[item.id]||{},completed=Number(patch.completedBytes??current.completedBytes??0),total=Math.max(1,Number(patch.totalBytes??current.totalBytes??item.estimatedBytes)||1);
  const percent=patch.percent==null?clamp(Math.floor(completed/total*100),0,99):clamp(patch.percent,0,100);
  return set(item.id,{...patch,completedBytes:completed,totalBytes:total,percent},force);
}
async function streamArtifact(model,art,signal,onChunk){
  const cached=await cachedAsset(model,art);if(cached.ok)return cached.bytes;
  const cache=await caches.open(CACHE),url=directUrl(model,art),response=await fetch(url,{cache:'no-store',redirect:'follow',signal});
  if(!response.ok)throw new Error(`${model.label} · ${art.path} returned HTTP ${response.status}.`);
  const type=String(response.headers.get('content-type')||'').toLowerCase();if(type.includes('text/html'))throw new Error(`${model.label} · ${art.path} returned HTML instead of model data.`);
  const declared=Number(response.headers.get('content-length')||0);if(declared&&declared<art.minBytes)throw new Error(`${model.label} · ${art.path} is smaller than its model manifest.`);
  if(!response.body?.getReader){await cache.put(url,response);onChunk(declared||art.sizeBytes);return declared||art.sizeBytes}
  const reader=response.body.getReader();let loaded=0;
  const body=new ReadableStream({
    async pull(controller){const part=await reader.read();if(part.done){controller.close();return}loaded+=part.value?.byteLength||0;onChunk(loaded);controller.enqueue(part.value)},
    cancel(reason){reader.cancel(reason).catch?.(()=>{})}
  });
  await cache.put(url,new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers}));
  onChunk(loaded||declared||art.sizeBytes);
  return loaded||declared||art.sizeBytes;
}
async function installSpecialized(item,model,job,progressBase,total,onProgress){
  let base=progressBase;
  for(const art of model.artifacts){
    const current=await cachedAsset(model,art);
    if(current.ok){base+=current.bytes;continue}
    report(item,{status:'downloading',phase:'specialized',component:model.id,artifact:art.path,completedBytes:base,totalBytes:total},false);
    const bytes=await streamArtifact(model,art,job.controller.signal,loaded=>{
      report(item,{status:'downloading',phase:'specialized',component:model.id,artifact:art.path,completedBytes:base+loaded,totalBytes:total},false);
      try{onProgress?.({pack:item,component:model,artifact:art,completedBytes:base+loaded,totalBytes:total,state:states[item.id]})}catch{}
    });
    base+=bytes;
  }
  return base;
}
async function waitGenerative(id,signal,onProgress){
  const m=manager();const started=Date.now();
  while(Date.now()-started<7_200_000){
    if(signal.aborted)throw Object.assign(new Error('Pack download paused.'),{name:'AbortError'});
    const current=await m.status(id);if(current.available)return current;
    const state=m.state?.(id)||current.state||{};
    try{onProgress?.(state)}catch{}
    if(['error','paused','aborted'].includes(String(state.status||'')))throw new Error(state.error||`${id} download paused.`);
    await new Promise(resolve=>setTimeout(resolve,350));
  }
  throw new Error(`${id} did not finish within the pack download session.`);
}
async function installGenerative(item,id,job,progressBase,total,onProgress){
  const m=manager(),spec=registry()?.byId?.(id);if(!m?.start||!spec)throw new Error(`Generative model ${id} is unavailable.`);
  const current=await m.status(id);if(current.available)return progressBase+Number(spec.estimatedBytes||0);
  report(item,{status:'downloading',phase:'generative',component:id,artifact:'',completedBytes:progressBase,totalBytes:total},true);
  await m.start(id,{preferBackground:false,onProgress:state=>{
    const downloaded=Number(state?.bytesDownloaded||0);
    report(item,{status:'downloading',phase:'generative',component:id,completedBytes:progressBase+downloaded,totalBytes:total},false);
    try{onProgress?.({pack:item,component:spec,completedBytes:progressBase+downloaded,totalBytes:total,state:states[item.id]})}catch{}
  }});
  await waitGenerative(id,job.controller.signal);
  return progressBase+Number(spec.estimatedBytes||0);
}
async function install(id,{onProgress}={}){
  const item=packById(id);if(jobs.has(item.id))return states[item.id];
  if(installMode(item.id)==='browser'){
    const error=browserInstallRequired(item);
    report(item,{status:'error',phase:'browser-download-required',downloadMode:'browser',errorCode:error.code,error:error.message,completedBytes:0,totalBytes:item.estimatedBytes,percent:0},true);
    throw error;
  }
  if(!('caches'in globalThis))throw new Error('Cache Storage is unavailable on this device.');
  const m=manager(),r=registry();if(!m?.start||!r?.byId)throw new Error('Civweave local model download modules are not ready.');
  await m.requestPersistence?.();
  const need=await missingBytes(item),space=await storage();
  if(space.available&&need&&space.available<need*1.12)throw new Error(`Not enough storage for ${item.label}. About ${(need/1e9).toFixed(1)} GB remains to download; ${(space.available/1e9).toFixed(1)} GB is available.`);
  const job={controller:new AbortController(),currentGenerative:''};jobs.set(item.id,job);
  const total=Math.max(1,item.estimatedBytes);let completed=0;
  report(item,{status:'downloading',phase:'starting',startedAt:now(),completedBytes:0,totalBytes:total,error:''},true);
  try{
    for(const component of item.installOrder){
      if(job.controller.signal.aborted)throw Object.assign(new Error('Pack download paused.'),{name:'AbortError'});
      const before=await componentStatus(component);
      if(before.available){
        const spec=specFor(component);completed+=Number(spec?.estimatedBytes||before.bytes||0);continue;
      }
      if(isSpecialized(component))completed=await installSpecialized(item,SPECIALIZED[component],job,completed,total,onProgress);
      else{job.currentGenerative=component;completed=await installGenerative(item,component,job,completed,total,onProgress);job.currentGenerative=''}
    }
    const checked=await status(item.id);if(!checked.available)throw new Error(`${item.label} ended without all required components.`);
    report(item,{status:'ready',phase:'ready',percent:100,completedBytes:checked.installedBytes||item.estimatedBytes,totalBytes:checked.installedBytes||item.estimatedBytes,installedAt:now(),error:''},true);
    try{dispatchEvent(new CustomEvent('civweave:local-model-pack-installed',{detail:{version:VERSION,id:item.id,label:item.label}}))}catch{}
    return checked;
  }catch(error){
    const paused=job.controller.signal.aborted||error?.name==='AbortError';
    report(item,{status:paused?'paused':'error',phase:paused?'paused':'error',error:paused?'Pack download paused. Resume to continue from completed model files.':String(error?.message||error)},true);
    throw error;
  }finally{jobs.delete(item.id)}
}
async function cancel(id){
  const item=packById(id),job=jobs.get(item.id);if(job){job.controller.abort();if(job.currentGenerative)await manager()?.cancel?.(job.currentGenerative).catch?.(()=>false);report(item,{status:'paused',phase:'paused',error:'Pack download paused. Resume to continue.'},true);return true}
  for(const modelId of item.generative){const state=manager()?.state?.(modelId);if(['downloading','finalizing'].includes(String(state?.status||'')))await manager()?.cancel?.(modelId).catch?.(()=>false)}
  report(item,{status:'paused',phase:'paused',error:'Pack download paused. Resume to continue.'},true);return false;
}
function readyPackIds(except=''){return Object.keys(PACKS).filter(id=>id!==except&&states[id]?.status==='ready')}
function referencedElsewhere(component,except){return readyPackIds(except).some(id=>PACKS[id].installOrder.includes(component))}
async function remove(id){
  const item=packById(id);await cancel(id).catch(()=>false);
  const cache=await caches.open(CACHE);
  for(const modelId of item.specialized){
    if(referencedElsewhere(modelId,item.id))continue;
    const model=SPECIALIZED[modelId];for(const art of model.artifacts)await cache.delete(directUrl(model,art));
  }
  for(const modelId of item.generative){
    if(referencedElsewhere(modelId,item.id))continue;
    await manager()?.remove?.(modelId);
  }
  delete states[item.id];save(true);
  try{dispatchEvent(new CustomEvent('civweave:local-model-pack-removed',{detail:{version:VERSION,id:item.id,label:item.label}}))}catch{}
  return true;
}
async function use(id){
  const item=packById(id),checked=await status(item.id);if(!checked.available)throw new Error(`Finish downloading ${item.label} before using it.`);
  const preferred=await manager().status(item.primaryModel);
  const selected=preferred.available?item.primaryModel:item.fallbackModel;
  if(!selected)throw new Error(`${item.label} has no available interactive model.`);
  manager().select(selected);
  set(item.id,{status:'ready',selectedModel:selected,lastUsedAt:now()},true);
  try{dispatchEvent(new CustomEvent('civweave:local-model-pack-selected',{detail:{version:VERSION,id:item.id,label:item.label,model:selected}}))}catch{}
  return{pack:item,model:selected};
}
async function cachedResponse(modelId,path){
  const model=SPECIALIZED[clean(modelId,120)];if(!model)return null;
  const art=model.artifacts.find(row=>row.path===path);if(!art)return null;
  return (await caches.open(CACHE)).match(directUrl(model,art));
}
function state(id){return id?states[clean(id,120)]||null:{...states}}
function catalogue(){return Object.values(PACKS)}

const api=freeze({version:VERSION,cache:CACHE,stateKey:STATE_KEY,packs:PACKS,specialized:SPECIALIZED,byId:packById,catalogue,state,status,install,start:install,cancel,remove,use,storage,assetUrl,cachedResponse,specializedStatus,componentStatus,installMode,browserManagedPackIds:BROWSER_MANAGED_PACK_IDS,browserInstallErrorCode:BROWSER_INSTALL_ERROR,progressEvent:EVENT});
globalThis.CivweaveLocalModelPacksV1=api;
try{dispatchEvent(new CustomEvent('civweave:local-model-packs-ready',{detail:{version:VERSION,packIds:Object.keys(PACKS),cache:CACHE}}))}catch{}
})();