(()=>{
'use strict';
const VERSION='1.3.0-litert-gemma4-fast-runtime-v1-dual-phone-mtp-jspi';
const MODEL_CACHE='civweave-model-generative-v266';
const MODULE_URL='/app/vendor/litert-lm/dist/index.js?v=0.14.0-civweave-v1';
const WASM_ROOT='/app/vendor/litert-lm/wasm/';
const PROFILES=Object.freeze({
  'gemma4-e2b-it-litert-web':Object.freeze({
    id:'gemma4-e2b-it-litert-web',
    aliases:Object.freeze(['gemma4-e2b-it-litert-web','gemma4-e2b-it-q4f16','gemma4-e2b-it-q2f16-mobile']),
    repo:'litert-community/gemma-4-E2B-it-litert-lm',
    contextTokens:4096,
    maxOutputTokens:2400,
    label:'Gemma 4 E2B LiteRT'
  }),
  'gemma4-e4b-it-litert-web':Object.freeze({
    id:'gemma4-e4b-it-litert-web',
    aliases:Object.freeze(['gemma4-e4b-it-litert-web','gemma4-e4b-it-q4f16','gemma4-e4b-it-q2f16-mobile']),
    repo:'litert-community/gemma-4-E4B-it-litert-lm',
    contextTokens:4096,
    maxOutputTokens:2800,
    label:'Gemma 4 E4B LiteRT'
  })
});
const ALIAS_TO_FAST=new Map(Object.values(PROFILES).flatMap(profile=>profile.aliases.map(id=>[id,profile.id])));
if(globalThis.CivweaveLiteRTGemma4FastRuntimeV1?.version===VERSION)return;
let modulePromise=null,enginePromise=null,enginePromiseModelId='',engine=null,engineModelId='',engineUsesMtp=false,wrapped=null,generationActive=false,lastMetrics=null;
const now=()=>performance.now();
const clean=(value,max=200000)=>String(value??'').slice(0,max);
const emit=(type,detail={})=>{try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}};
const selected=()=>{try{return globalThis.CivweaveLocalModelDownloadV266?.selection?.()||null}catch{return null}};
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
const manager=()=>globalThis.CivweaveLocalModelDownloadV266;
const profileFor=id=>PROFILES[ALIAS_TO_FAST.get(id)||id]||null;
const supportsJspi=()=>typeof globalThis.WebAssembly?.Suspending==='function'&&typeof globalThis.WebAssembly?.promising==='function';

async function fastStatus(id){try{return await manager()?.status?.(id)}catch{return{available:false}}}
function modelUrl(modelId){
  const spec=registry()?.byId?.(modelId);if(!spec)throw new Error(`The LiteRT Gemma 4 model specification is not registered: ${modelId}`);
  const artifact=spec.artifacts?.find?.(row=>row.required)||spec.artifacts?.[0];if(!artifact)throw new Error(`The LiteRT Gemma 4 model artifact is not registered: ${modelId}`);
  return{spec,artifact,url:registry().directUrl(spec,artifact.path)};
}
async function modelStream(modelId){
  if(!('caches'in globalThis))throw new Error('Cache Storage is unavailable for the LiteRT Gemma 4 model.');
  const {url}=modelUrl(modelId),cache=await caches.open(MODEL_CACHE),response=await cache.match(url);
  if(!response?.ok||!response.body)throw Object.assign(new Error(`${profileFor(modelId)?.label||modelId} is not downloaded yet. Install its performance upgrade from Local models first.`),{code:'LITERT_GEMMA4_NOT_INSTALLED',model:modelId});
  return response.body;
}
async function loadModule(){
  if(modulePromise)return modulePromise;
  modulePromise=import(MODULE_URL).then(async mod=>{
    if(!mod?.Engine||!mod?.Backend)throw new Error('The staged LiteRT-LM module is missing Engine or Backend.');
    if(typeof mod.getOrLoadGlobalLiteRtLm==='function')await mod.getOrLoadGlobalLiteRtLm(WASM_ROOT);
    else if(typeof mod.loadLiteRtLm==='function')await mod.loadLiteRtLm(WASM_ROOT);
    else throw new Error('The staged LiteRT-LM module cannot initialize its local WASM runtime.');
    return mod;
  }).catch(error=>{modulePromise=null;throw error});
  return modulePromise;
}
function artisanConfig(useSubmodel=true){
  return{
    num_output_candidates:1,
    wait_for_weight_uploads:true,
    num_decode_steps_per_sync:1,
    sequence_batch_size:0,
    supported_lora_ranks:[],
    max_top_k:64,
    enable_decode_logits:false,
    enable_external_embeddings:false,
    use_submodel:Boolean(useSubmodel)
  };
}
async function unloadEngine(reason='model-switch'){
  if(enginePromise){try{await enginePromise}catch{}}
  const prior=engine,priorId=engineModelId,priorMtp=engineUsesMtp;
  engine=null;engineModelId='';engineUsesMtp=false;
  if(prior)try{await prior.delete?.()}catch{}
  if(priorId)emit('civweave:litert-gemma4-engine-released',{model:priorId,reason,mtpEnabled:priorMtp});
  return true;
}
async function instantiateEngine(mod,profile,useSubmodel){
  const stream=await modelStream(profile.id);
  return mod.Engine.create({
    model:stream,
    backend:mod.Backend.GPU_ARTISAN,
    mainExecutorSettings:{maxNumTokens:profile.contextTokens,backendConfig:artisanConfig(useSubmodel)},
    benchmarkEnabled:true
  },'Civweave local assistant');
}
async function createEngine(modelId){
  const profile=profileFor(modelId);if(!profile)throw new Error(`Unsupported LiteRT Gemma 4 model: ${modelId}`);
  if(!globalThis.navigator?.gpu)throw Object.assign(new Error(`${profile.label} requires WebGPU.`),{code:'LOCAL_BACKEND_CAPABILITY_UNAVAILABLE',capability:'webgpu'});
  if(!supportsJspi())throw Object.assign(new Error(`${profile.label} fast mode requires WebAssembly JSPI (Chromium 137+). Civweave will use the existing compatibility runtime instead.`),{code:'LOCAL_BACKEND_CAPABILITY_UNAVAILABLE',capability:'webassembly-jspi'});
  const mod=await loadModule();
  if(engine&&engineModelId!==profile.id)await unloadEngine('switch-model');
  const started=now();
  emit('civweave:litert-gemma4-progress',{phase:'loading-model',model:profile.id,backend:'webgpu-gpu-artisan',phoneProfile:'12gb-dual',mtpRequested:true,jspi:true});
  let value,mtpEnabled=true;
  try{
    value=await instantiateEngine(mod,profile,true);
  }catch(mtpError){
    mtpEnabled=false;
    emit('civweave:litert-gemma4-mtp-fallback',{model:profile.id,message:String(mtpError?.message||mtpError),reason:'engine-create-with-submodel-failed'});
    value=await instantiateEngine(mod,profile,false);
  }
  engine=value;engineModelId=profile.id;engineUsesMtp=mtpEnabled;
  emit('civweave:litert-gemma4-progress',{phase:'model-ready',model:profile.id,backend:'webgpu-gpu-artisan',loadMs:Math.round(now()-started),maxNumTokens:profile.contextTokens,webBindingSettings:'official-v0.14-gpu-artisan',oneEngineAtATime:true,mtpEnabled,jspi:true});
  return value;
}
async function ensureEngine(modelId){
  const profile=profileFor(modelId);if(!profile)throw new Error(`Unsupported LiteRT Gemma 4 model: ${modelId}`);
  if(engine&&engineModelId===profile.id)return engine;
  if(enginePromise&&enginePromiseModelId===profile.id)return enginePromise;
  if(enginePromise&&enginePromiseModelId!==profile.id){try{await enginePromise}catch{}}
  if(engine&&engineModelId!==profile.id)await unloadEngine('switch-model');
  enginePromiseModelId=profile.id;
  enginePromise=createEngine(profile.id).catch(error=>{engine=null;engineModelId='';engineUsesMtp=false;throw error}).finally(()=>{enginePromise=null;enginePromiseModelId=''});
  return enginePromise;
}
function messageText(value){if(typeof value==='string')return clean(value,12000);return clean(value?.content??value?.text??'',12000)}
function normalizedMessages(systemPrompt,messages=[]){
  const rows=[];const system=clean(systemPrompt,12000).trim();if(system)rows.push({role:'system',content:system});
  for(const row of (Array.isArray(messages)?messages:[]).slice(-10)){
    const role=/^(assistant|model)$/i.test(String(row?.role||''))?'assistant':'user',content=messageText(row).trim();if(content)rows.push({role,content});
  }
  let chars=rows.reduce((sum,row)=>sum+row.content.length,0);
  while(rows.length>2&&chars>16000){const removed=rows.splice(rows[0]?.role==='system'?1:0,1)[0];chars-=removed?.content?.length||0}
  return rows;
}
function chunkText(chunk){if(!chunk)return'';if(typeof chunk==='string')return chunk;if(typeof chunk.content==='string')return chunk.content;if(Array.isArray(chunk.content))return chunk.content.map(part=>clean(part?.text??part?.content??'',12000)).join('');return clean(chunk.text??chunk.delta??'',12000)}
function benchmarkMetrics(info){
  if(!info||typeof info!=='object')return{};
  const keys=['timeToFirstTokenInSecond','lastPrefillTokenCount','lastPrefillTokensPerSecond','lastPrefillTokensPerSec','lastDecodeTokenCount','lastDecodeTokensPerSecond','lastDecodeTokensPerSec'];
  const out={};for(const key of keys)if(info[key]!=null)out[key]=info[key];
  for(const [key,value] of Object.entries(info))if((/decode|prefill|token|init/i.test(key))&&(typeof value==='number'||typeof value==='string'))out[key]=value;
  return out;
}
async function runFast(args={},forcedModelId=''){
  const pick=selected(),profile=profileFor(forcedModelId||pick?.id);
  if(!profile)throw Object.assign(new Error('No supported Gemma 4 LiteRT profile is selected.'),{code:'LITERT_GEMMA4_PROFILE_MISSING'});
  if(generationActive)throw Object.assign(new Error('The LiteRT Gemma 4 engine is already generating.'),{code:'LOCAL_MODEL_BUSY'});
  generationActive=true;
  const started=now();let chat=null,firstTokenAt=0,index=0,text='';
  try{
    const status=await fastStatus(profile.id);if(!status?.available)throw Object.assign(new Error(`${profile.label} is not installed.`),{code:'LITERT_GEMMA4_NOT_INSTALLED',model:profile.id});
    const activeEngine=await ensureEngine(profile.id),rows=normalizedMessages(args.systemPrompt,args.messages),latestIndex=[...rows].map(row=>row.role).lastIndexOf('user'),latest=latestIndex>=0?rows[latestIndex]:{role:'user',content:''},preface=latestIndex>=0?rows.filter((_,index)=>index!==latestIndex):rows;
    const maxOutputTokens=Math.max(64,Math.min(profile.maxOutputTokens,Number(args.maxNewTokens)||1024));
    chat=await activeEngine.createConversation({sessionConfig:{maxOutputTokens,samplerParams:{k:64,p:.95,temperature:1}},preface:{messages:preface},prefillPrefaceOnInit:true,filterChannelContentFromKvCache:true});
    emit('civweave:litert-gemma4-progress',{phase:'generating',model:profile.id,backend:'webgpu-gpu-artisan',maxOutputTokens,maxNumTokens:profile.contextTokens,oneEngineAtATime:true,mtpEnabled:engineUsesMtp,jspi:true});
    const stream=chat.sendMessageStreaming(latest);
    for await(const chunk of stream){
      const piece=chunkText(chunk);if(!piece)continue;if(!firstTokenAt)firstTokenAt=now();text+=piece;
      try{args.onToken?.({text:piece,index:index++,model:profile.id,backend:'litert-webgpu',mtpEnabled:engineUsesMtp})}catch{}
    }
    let benchmark={};try{benchmark=benchmarkMetrics(await chat.getBenchmarkInfo())}catch{}
    const completed=now(),generationMs=Math.round(completed-started),ttftMs=firstTokenAt?Math.round(firstTokenAt-started):null,decodeSeconds=Math.max(.001,(completed-(firstTokenAt||started))/1000),approxTokens=Math.max(1,Math.round(text.length/3.7)),measuredApproxTokensPerSecond=Number((approxTokens/decodeSeconds).toFixed(2));
    const metrics={runtime:'litert-lm-web-0.14.0',backend:'webgpu-gpu-artisan',model:profile.id,generationMs,ttftMs,maxNumTokens:profile.contextTokens,maxOutputTokens,approxGeneratedTokens:approxTokens,approxTokensPerSecond:measuredApproxTokensPerSecond,oneEngineAtATime:true,phoneProfile:'12gb-dual',mtpEnabled:engineUsesMtp,jspi:true,webBindingSpeculativeDecodingConfigured:engineUsesMtp,...benchmark};
    lastMetrics=metrics;emit('civweave:litert-gemma4-complete',metrics);
    return{status:'success',outputText:text.trim(),text:text.trim(),model:{id:profile.id,repo:profile.repo,runtime:'litert-lm-web'},backend:'webgpu',streamed:Boolean(args.onToken),metrics,executionId:profile.id,usage:null};
  }finally{generationActive=false;if(chat)try{await chat.delete()}catch{}}
}
async function accelerationTarget(selectedId){
  const profile=profileFor(selectedId);if(!profile)return null;
  if(selectedId===profile.id)return profile;
  return Boolean((await fastStatus(profile.id))?.available)?profile:null;
}
async function shouldAccelerate(){const pick=selected();if(!pick?.active)return false;return Boolean(await accelerationTarget(pick.id))}
function install(){
  const api=globalThis.CivweaveLocalChatRuntimeV295;if(!api?.generate)return false;
  if(api.__civweaveLiteRTGemma4FastV1===VERSION){wrapped=api;return true}
  const base=api;
  const generate=async args=>{
    const pick=selected(),profile=pick?.active?profileFor(pick.id):null;
    if(!profile)return base.generate(args);
    let target=null;try{target=await accelerationTarget(pick.id)}catch{}
    if(!target){
      if(pick.id===profile.id)throw Object.assign(new Error(`${profile.label} is selected but its optimized model file is not installed.`),{code:'LITERT_GEMMA4_NOT_INSTALLED',model:profile.id});
      return base.generate(args);
    }
    try{return await runFast(args,target.id)}
    catch(error){
      emit('civweave:litert-gemma4-fallback',{model:target.id,selectedModel:pick.id,message:String(error?.message||error),capability:error?.capability||null});
      if(pick.id!==profile.id)return base.generate(args);
      throw error;
    }
  };
  const next=Object.freeze({...base,generate,__civweaveLiteRTGemma4FastV1:VERSION,litertGemma4Fast:true,litertGemma4Dual:true,litertGemma4Mtp:true,litertGemma4Jspi:true,litertModelId:PROFILES['gemma4-e2b-it-litert-web'].id,litertModelIds:Object.freeze(Object.keys(PROFILES)),legacyAcceleratedModelId:'gemma4-e2b-it-q4f16',legacyAcceleratedModelIds:Object.freeze([...ALIAS_TO_FAST.keys()].filter(id=>!PROFILES[id])),oneEngineAtATime:true,phoneProfile:'12gb-dual'});
  try{globalThis.CivweaveLocalChatRuntimeV295=next}catch{return false}
  wrapped=next;emit('civweave:litert-gemma4-fast-runtime-ready',{models:Object.keys(PROFILES),transparentAliases:[...ALIAS_TO_FAST.keys()],oneEngineAtATime:true,phoneProfile:'12gb-dual',mtpRequested:true,jspiRequired:true});return true;
}
async function unload(){await unloadEngine('manual-unload');lastMetrics=null;return true}
for(const name of ['civweave:local-model-runtime-ready','civweave:gemma4-litert-fast-extension-ready','civweave:guide-loader-reset','pageshow'])addEventListener(name,()=>queueMicrotask(install));
addEventListener('civweave:local-model-selection',()=>{const pick=selected(),target=profileFor(pick?.id);if(engine&&(!pick?.active||!target||target.id!==engineModelId))void unloadEngine('selection-change')});
addEventListener('pagehide',()=>{void unloadEngine('pagehide')});
install();
globalThis.CivweaveLiteRTGemma4FastRuntimeV1=Object.freeze({
  version:VERSION,
  fastModelId:'gemma4-e2b-it-litert-web',
  fastModelIds:Object.freeze(Object.keys(PROFILES)),
  legacyQ4Id:'gemma4-e2b-it-q4f16',
  profiles:PROFILES,
  moduleUrl:MODULE_URL,
  wasmRoot:WASM_ROOT,
  engineContextTokens:4096,
  oneEngineAtATime:true,
  mtpRequested:true,
  jspiRequired:true,
  phoneProfile:'12gb-dual',
  supportsJspi,
  install,
  runFast,
  fastStatus,
  accelerationTarget,
  shouldAccelerate,
  unload,
  state:()=>Object.freeze({installed:Boolean(wrapped),engineReady:Boolean(engine),engineLoading:Boolean(enginePromise),engineLoadingModelId:enginePromiseModelId,engineModelId,engineUsesMtp,jspiAvailable:supportsJspi(),generationActive,lastMetrics})
});
})();