(()=>{
'use strict';
const VERSION='1.7.1-litert-runtime-v1-sdk-text-stream-and-safe-sampling';
const PRIOR_VERSION='1.4.0-litert-gemma4-fast-runtime-v1-formatted-output';
const MODEL_CACHE='civweave-model-generative-v266';
const MODULE_URL='/app/vendor/litert-lm/dist/index.js?v=0.17.1-civweave-qwen35';
const WASM_ROOT='/app/vendor/litert-lm/wasm/';
const QWEN_FAST='qwen35-4b-litert-web';
const QWEN_DEEP='qwen35-9b-litert-web';
const PROFILES=Object.freeze({
  'gemma4-e2b-it-litert-web':Object.freeze({id:'gemma4-e2b-it-litert-web',aliases:Object.freeze(['gemma4-e2b-it-litert-web','gemma4-e2b-it-q4f16','gemma4-e2b-it-q2f16-mobile']),repo:'litert-community/gemma-4-E2B-it-litert-lm',contextTokens:4096,maxOutputTokens:2400,label:'Gemma 4 E2B LiteRT',family:'gemma4',constrainedTools:true,sampler:Object.freeze({k:64,p:.95,temperature:1})}),
  'gemma4-e4b-it-litert-web':Object.freeze({id:'gemma4-e4b-it-litert-web',aliases:Object.freeze(['gemma4-e4b-it-litert-web','gemma4-e4b-it-q4f16','gemma4-e4b-it-q2f16-mobile']),repo:'litert-community/gemma-4-E4B-it-litert-lm',contextTokens:3072,maxOutputTokens:2800,label:'Gemma 4 E4B LiteRT',family:'gemma4',constrainedTools:true,sampler:Object.freeze({k:64,p:.95,temperature:1})}),
  [QWEN_FAST]:Object.freeze({id:QWEN_FAST,aliases:Object.freeze([QWEN_FAST]),repo:'litert-community/Qwen3.5-4B',contextTokens:4096,maxOutputTokens:2400,label:'Qwen 3.5 4B LiteRT',family:'qwen35',constrainedTools:false,sampler:Object.freeze({k:20,p:.95,temperature:.6})}),
  [QWEN_DEEP]:Object.freeze({id:QWEN_DEEP,aliases:Object.freeze([QWEN_DEEP]),repo:'litert-community/Qwen3.5-9B-LiteRT',contextTokens:3072,maxOutputTokens:3200,label:'Qwen 3.5 9B LiteRT',family:'qwen35',constrainedTools:false,sampler:Object.freeze({k:20,p:.95,temperature:.6})})
});
const ALIAS_TO_FAST=new Map(Object.values(PROFILES).flatMap(profile=>profile.aliases.map(id=>[id,profile.id])));
const GEMMA_FAST_ALIASES=new Set(PROFILES['gemma4-e2b-it-litert-web'].aliases);
const GEMMA_DEEP_ALIASES=new Set(PROFILES['gemma4-e4b-it-litert-web'].aliases);
if(globalThis.CivweaveLiteRTGemma4FastRuntimeV1?.version===VERSION)return;
let pendingUnloadReason='',engineReleasePromise=null;
let modulePromise=null,enginePromise=null,enginePromiseModelId='',engine=null,engineModelId='',engineUsesMtp=false,engineMode='',wrapped=null,generationActive=false,lastMetrics=null,activeChat=null,cancelRequested=false;
const now=()=>performance.now();
const clean=(value,max=200000)=>String(value??'').slice(0,max);
const emit=(type,detail={})=>{try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}};
const selected=()=>{try{return globalThis.CivweaveLocalModelDownloadV266?.selection?.()||null}catch{return null}};
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
const manager=()=>globalThis.CivweaveLocalModelDownloadV266;
const qwenFlagshipSelected=()=>{const id=String(selected()?.id||'');return id===QWEN_FAST||id===QWEN_DEEP};
const profileFor=id=>{
  let key=String(id||'');
  if(qwenFlagshipSelected()){
    if(GEMMA_FAST_ALIASES.has(key))key=QWEN_FAST;
    else if(GEMMA_DEEP_ALIASES.has(key))key=QWEN_DEEP;
  }
  return PROFILES[ALIAS_TO_FAST.get(key)||key]||null;
};
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
  // LiteRT-LM 0.17.1 passes the complete GPU_ARTISAN struct to WebAssembly.
  // Omitted Boolean fields cause "Missing field" errors before model initialization.
  return {
    num_output_candidates:1,
    wait_for_weight_uploads:true,
    num_decode_steps_per_sync:1,
    sequence_batch_size:0,
    supported_lora_ranks:[],
    max_top_k:64,
    enable_decode_logits:false,
    enable_external_embeddings:false,
    use_submodel:Boolean(useSubmodel),
    prefer_texture_weights:!(/Mac/i.test(globalThis.navigator?.platform||'')),
    set_enable_host_mapped_pointer:true,
    disallow_8bit_convs:true,
    use_autosized_ringbuffers:false
  };
}
async function unloadEngine(reason='model-switch',{afterGeneration=false}={}){
  if(generationActive&&!afterGeneration&&reason!=='switch-model'){pendingUnloadReason=reason;return false}
  if(engineReleasePromise)return engineReleasePromise;
  if(enginePromise){try{await enginePromise}catch{}}
  const prior=engine,priorId=engineModelId,priorMtp=engineUsesMtp;
  engine=null;engineModelId='';engineUsesMtp=false;engineMode='';
  engineReleasePromise=(async()=>{
    if(prior)try{await prior.delete?.()}catch{}
    if(priorId)emit('civweave:litert-gemma4-engine-released',{model:priorId,reason,mtpEnabled:priorMtp});
    return true;
  })();
  try{return await engineReleasePromise}finally{engineReleasePromise=null}
}
async function instantiateEngine(mod,profile,mode='standard'){
  const model=await modelStream(profile.id);
  // The supported Web SDK uses Engine.create({model,mainExecutorSettings})
  // and selects WebGPU automatically. Explicit GPU_ARTISAN backendConfig
  // values were copied from a private struct and are unsafe across phones.
  const settings={model,mainExecutorSettings:{maxNumTokens:profile.contextTokens},benchmarkEnabled:true};
  if(mode==='compat'){
    settings.backend=mod.Backend.GPU_ARTISAN;
    settings.mainExecutorSettings.backendConfig=artisanConfig(false);
  }
  return mod.Engine.create(settings,'Civweave local assistant');
}
async function createEngine(modelId){
  const profile=profileFor(modelId);if(!profile)throw new Error(`Unsupported LiteRT local model: ${modelId}`);
  if(!globalThis.navigator?.gpu)throw Object.assign(new Error(`${profile.label} requires WebGPU.`),{code:'LOCAL_BACKEND_CAPABILITY_UNAVAILABLE',capability:'webgpu'});
  if(!supportsJspi())throw Object.assign(new Error(`${profile.label} requires WebAssembly JSPI.`),{code:'LOCAL_BACKEND_CAPABILITY_UNAVAILABLE',capability:'webassembly-jspi'});
  const mod=await loadModule();
  if(engine&&engineModelId!==profile.id)await unloadEngine('switch-model');
  const started=now();emit('civweave:litert-gemma4-progress',{phase:'loading-model',model:profile.id,backend:'webgpu',mtpRequested:false,jspi:true});
  let value,mode='standard';
  try{value=await instantiateEngine(mod,profile,'standard')}
  catch(standardError){
    mode='compat';
    emit('civweave:litert-gemma4-backend-fallback',{model:profile.id,reason:'standard-engine-create-failed',message:String(standardError?.message||standardError),mtpEnabled:false});
    // Preserve device compatibility without activating untested MTP.
    try{value=await instantiateEngine(mod,profile,'compat')}catch(error){
      error.standardEngineError=String(standardError?.message||standardError);throw error;
    }
  }
  engine=value;engineModelId=profile.id;engineUsesMtp=false;engineMode=mode;
  emit('civweave:litert-gemma4-progress',{phase:'model-ready',model:profile.id,backend:'webgpu',engineMode:mode,loadMs:Math.round(now()-started),maxNumTokens:profile.contextTokens,oneEngineAtATime:true,mtpEnabled:false,jspi:true});
  return value;
}
async function ensureEngine(modelId){
  if(engineReleasePromise)await engineReleasePromise;
  const profile=profileFor(modelId);if(!profile)throw new Error(`Unsupported LiteRT local model: ${modelId}`);
  if(engine&&engineModelId===profile.id)return engine;
  if(enginePromise&&enginePromiseModelId===profile.id)return enginePromise;
  if(enginePromise&&enginePromiseModelId!==profile.id){try{await enginePromise}catch{}}
  if(engine&&engineModelId!==profile.id)await unloadEngine('switch-model');
  enginePromiseModelId=profile.id;
  enginePromise=createEngine(profile.id).catch(error=>{engine=null;engineModelId='';engineUsesMtp=false;engineMode='';throw error}).finally(()=>{enginePromise=null;enginePromiseModelId=''});
  return enginePromise;
}
function messageText(value){if(typeof value==='string')return clean(value,12000);return clean(value?.content??value?.text??'',12000)}
function normalizedMessages(systemPrompt,messages=[],maxInputChars=5000){
  // Preserve complete system / current user instructions. Drop old chat
  // turns rather than overflowing a small on-device KV cache.
  const available=Math.max(900,Number(maxInputChars)||5000);
  const system=clean(systemPrompt,Math.min(1700,Math.floor(available*.35))).trim();
  const tail=(Array.isArray(messages)?messages:[]).slice(-4).map(row=>({
    role:/^(assistant|model)$/i.test(String(row?.role||''))?'assistant':'user',
    content:messageText(row).trim()
  })).filter(row=>row.content);
  const latest=tail.pop()||{role:'user',content:''};
  // The final user instruction is mandatory. If it is itself longer than
  // the available context, report this rather than sending broken JSON.
  const maxLatest=available-system.length-96;
  if(latest.content.length>maxLatest)throw Object.assign(
    new Error(`The local prompt is too long (${latest.content.length} characters for a ${maxLatest} character budget). A shorter request or smaller schema is required.`),
    {code:'LOCAL_PROMPT_CONTEXT_OVERFLOW',inputCharacters:latest.content.length,maxInputCharacters:maxLatest}
  );
  let remaining=available-system.length-latest.content.length;
  const history=[];
  while(tail.length&&remaining>200){
    const row=tail.pop();if(row.content.length+64>remaining)break;
    history.unshift(row);remaining-=row.content.length+64;
  }
  return [...(system?[{role:'system',content:system}]:[]),...history,latest];
}
function chunkText(chunk){
  if(!chunk)return'';
  if(typeof chunk==='string')return chunk;
  if(typeof chunk.content==='string')return chunk.content;
  if(Array.isArray(chunk.content))return chunk.content.map(part=>{
    // Only forward visible text parts; a tool call or thinking channel is not
    // equivalent to user-facing output.
    if(!part||typeof part!=='object')return typeof part==='string'?part:'';
    if(part.type&&part.type!=='text')return'';
    return String(part.text??part.content??'').slice(0,12000);
  }).join('');
  if(chunk.message)return chunkText(chunk.message);
  return clean(chunk.text??chunk.delta??'',12000);
}
function structuredJsonContract(tool){
  const name=clean(tool?.function?.name||'civweave_result',120),schema=tool?.function?.parameters||{type:'object'};
  let serialized='{}';try{serialized=JSON.stringify(schema)}catch{}
  return `Return exactly one JSON object for ${name}. Do not use markdown fences, commentary, analysis, or <think> tags. The JSON must satisfy this schema: ${serialized}`;
}
function normalizeStructuredTool(value){
  if(!value||typeof value!=='object')return null;
  if(value.type==='function'&&value.function?.name)return value;
  if(value.name)return{type:'function',function:{name:clean(value.name,120),description:clean(value.description,600),parameters:value.parameters||{type:'object',properties:{}}}};
  return null;
}
function chunkToolCalls(chunk){const calls=Array.isArray(chunk?.tool_calls)?chunk.tool_calls:Array.isArray(chunk?.toolCalls)?chunk.toolCalls:[];return calls.filter(call=>call&&typeof call==='object')}
function toolArgumentText(call){const raw=call?.function?.arguments??call?.arguments;if(typeof raw==='string')return clean(raw).trim();if(raw&&typeof raw==='object')try{return JSON.stringify(raw)}catch{}return''}
function benchmarkMetrics(info){
  if(!info||typeof info!=='object')return{};
  const keys=['timeToFirstTokenInSecond','lastPrefillTokenCount','lastPrefillTokensPerSecond','lastPrefillTokensPerSec','lastDecodeTokenCount','lastDecodeTokensPerSecond','lastDecodeTokensPerSec'];
  const out={};for(const key of keys)if(info[key]!=null)out[key]=info[key];
  for(const [key,value] of Object.entries(info))if((/decode|prefill|token|init/i.test(key))&&(typeof value==='number'||typeof value==='string'))out[key]=value;
  return out;
}
async function runFast(args={},forcedModelId=''){
  const pick=selected(),profile=profileFor(forcedModelId||pick?.id);
  if(!profile)throw Object.assign(new Error('No supported LiteRT model profile is selected.'),{code:'LITERT_GEMMA4_PROFILE_MISSING'});
  if(generationActive)throw Object.assign(new Error('The selected LiteRT model engine is already generating.'),{code:'LOCAL_MODEL_BUSY'});
  generationActive=true;cancelRequested=false;
  const progress=(phase,detail={})=>{const payload={phase,model:profile.id,...detail};emit('civweave:litert-gemma4-progress',payload);try{args.onProgress?.(payload)}catch{}};
  const ensureNotCancelled=()=>{if(cancelRequested)throw Object.assign(new Error('LiteRT generation cancelled.'),{code:'CIVWEAVE_GENERATION_STOPPED',executionModel:profile.id,cancelled:true})};
  const started=now();let chat=null,firstTokenAt=0,index=0,text='',toolCall=null,chunkCount=0,nontextChunks=0;
  const rawDiagnostics=()=>({model:profile.id,chunksObserved:chunkCount,textDeltas:index,nontextChunks,outputCharacters:text.length});
  try{
    progress('checking-model');
    const status=await fastStatus(profile.id);if(!status?.available)throw Object.assign(new Error(`${profile.label} is not installed.`),{code:'LITERT_GEMMA4_NOT_INSTALLED',model:profile.id});
    progress('loading-engine');
    const activeEngine=await ensureEngine(profile.id);ensureNotCancelled();
    progress('engine-ready',{engineModelId,mtpEnabled:engineUsesMtp,contextTokens:profile.contextTokens});
    const requestedTool=normalizeStructuredTool(args.structuredTool),formattedTool=profile.constrainedTools===false?null:requestedTool,systemPrompt=requestedTool&&!formattedTool?`${clean(args.systemPrompt,12000)}\n\n${structuredJsonContract(requestedTool)}`.trim():args.systemPrompt,maxOutputTokens=Math.max(64,Math.min(profile.maxOutputTokens,Number(args.maxNewTokens)||1024)),maxInputChars=Math.max(1500,Math.min(5000,Math.floor((profile.contextTokens-maxOutputTokens-128)*2.5))),rows=normalizedMessages(systemPrompt,args.messages,maxInputChars),latestIndex=[...rows].map(row=>row.role).lastIndexOf('user'),latest=latestIndex>=0?rows[latestIndex]:{role:'user',content:''},preface=latestIndex>=0?rows.filter((_,i)=>i!==latestIndex):rows;
    // Disable Gemma 4 thinking in the *free-streaming* stages as well as tool calls.
    // Otherwise a mobile token budget can be consumed by a non-user-visible
    // thought channel and the application sees no answer text at all.
    const prefaceConfig={messages:preface};
    if(profile.family==='gemma4'||formattedTool)prefaceConfig.extra_context={enable_thinking:false};
    if(formattedTool)prefaceConfig.tools=[formattedTool];
    const sampler=profile.sampler||{k:64,p:.95,temperature:1};
    // Planning stages use the model-packaged sampler. A partial custom sampler
    // without an explicit type is not necessary for inference and may make
    // first-turn decode less portable across Android WebGPU implementations.
    const sdkDefaultSampler=Boolean(args.__civweaveStage||args.__civweaveProbe||args.preferModelDefaultSampling);
    const sessionConfig={maxOutputTokens};
    if(!sdkDefaultSampler)sessionConfig.samplerParams={k:sampler.k??64,p:sampler.p??.95,temperature:formattedTool?0.2:(sampler.temperature??1)};
    const conversationConfig={sessionConfig,preface:prefaceConfig,prefillPrefaceOnInit:true,filterChannelContentFromKvCache:true};
    if(formattedTool)conversationConfig.enableConstrainedDecoding=true;
    progress('prefilling-preface',{prefaceCharacters:preface.reduce((n,row)=>n+row.content.length,0),maxOutputTokens,maxInputChars,prefillPrefaceOnInit:true,engineMode,sdkDefaultSampler});
    chat=await activeEngine.createConversation(conversationConfig);activeChat=chat;ensureNotCancelled();
    progress('conversation-ready',{backend:'webgpu',maxOutputTokens,maxNumTokens:profile.contextTokens,oneEngineAtATime:true,mtpEnabled:engineUsesMtp,jspi:true,formattedOutput:Boolean(formattedTool),constrainedDecoding:Boolean(formattedTool),sdkDefaultSampler});
    if(formattedTool){
      progress('prompt-submitted',{inputCharacters:latest.content.length,constrainedDecoding:true});
      const response=await chat.sendMessage(latest);ensureNotCancelled();
      firstTokenAt=now();
      const calls=chunkToolCalls(response);if(calls.length)toolCall=calls.at(-1);
      text=chunkText(response);
    }else{
      progress('prompt-submitted',{inputCharacters:latest.content.length,constrainedDecoding:false});
      // Text-only streaming follows the documented LiteRT Web SDK call shape.
      const stream=chat.sendMessageStreaming(latest.content);
      progress('awaiting-first-token',{inputCharacters:latest.content.length,prefaceCharacters:preface.reduce((n,row)=>n+row.content.length,0),engineMode,mtpEnabled:false});
      for await(const chunk of stream){ensureNotCancelled();chunkCount++;if(chunkCount===1)progress('first-stream-chunk',{containsVisibleText:Boolean(chunkText(chunk))});const piece=chunkText(chunk);if(!piece){nontextChunks++;continue}if(!firstTokenAt)firstTokenAt=now();text+=piece;try{args.onToken?.({text:piece,index:index++,model:profile.id,backend:'litert-webgpu',mtpEnabled:engineUsesMtp,formattedOutput:false})}catch{}}
    }
    ensureNotCancelled();
    const formattedText=formattedTool?toolArgumentText(toolCall):'';
    if(formattedTool&&!formattedText)throw Object.assign(new Error(`LiteRT-LM constrained decoding completed without the required ${formattedTool.function.name} tool call.`),{code:'LITERT_FORMATTED_OUTPUT_MISSING',formattedOutput:true,toolName:formattedTool.function.name});
    const outputText=(formattedTool?formattedText:text).replace(/^\s*<think>[\s\S]*?<\/think>\s*/i,'').trim();
    if(!outputText)throw Object.assign(new Error(`${profile.label} emitted no visible output (${chunkCount} chunks, ${index} text deltas). The raw stage diagnostics are available in Show failing message.`),{code:'LOCAL_MODEL_EMPTY_OUTPUT',rawDiagnostics:rawDiagnostics(),executionModel:profile.id,rejectedText:text});
    let benchmark={};try{benchmark=benchmarkMetrics(await chat.getBenchmarkInfo())}catch{}
    const completed=now(),generationMs=Math.round(completed-started),ttftMs=firstTokenAt?Math.round(firstTokenAt-started):null,decodeSeconds=Math.max(.001,(completed-(firstTokenAt||started))/1000),approxTokens=Math.max(1,Math.round(outputText.length/3.7)),measuredApproxTokensPerSecond=Number((approxTokens/decodeSeconds).toFixed(2));
    const metrics={runtime:'litert-lm-web-0.17.1',backend:'webgpu-gpu-artisan',model:profile.id,modelFamily:profile.family||'local',generationMs,ttftMs,maxNumTokens:profile.contextTokens,maxOutputTokens,approxGeneratedTokens:approxTokens,approxTokensPerSecond:measuredApproxTokensPerSecond,oneEngineAtATime:true,phoneProfile:profile.family==='qwen35'?'qwen35-flagship':'12gb-dual',mtpEnabled:engineUsesMtp,jspi:true,webBindingSpeculativeDecodingConfigured:engineUsesMtp,formattedOutput:Boolean(formattedTool),constrainedDecoding:Boolean(formattedTool),structuredJsonPrompt:Boolean(requestedTool&&!formattedTool),...benchmark};
    lastMetrics=metrics;emit('civweave:litert-gemma4-complete',metrics);
    return{status:'success',outputText,text:outputText,toolCall:toolCall||null,formattedOutput:formattedTool?{used:true,constrainedDecoding:true,toolName:formattedTool.function.name,toolCall:toolCall||null}:null,model:{id:profile.id,repo:profile.repo,runtime:'litert-lm-web'},backend:'webgpu',streamed:formattedTool?false:Boolean(args.onToken),metrics,executionId:profile.id,usage:null};
  }catch(error){
    // Propagate the actual executing model, not the model selected for chat.
    if(error&&typeof error==='object')try{error.executionModel=profile.id;error.rawDiagnostics=error.rawDiagnostics||rawDiagnostics();error.rejectedText=error.rejectedText??text}catch{}
    emit('civweave:litert-gemma4-failed',{model:profile.id,code:error?.code||'LOCAL_LITERT_EXECUTION_FAILED',message:clean(error?.message||error,500),rawDiagnostics:error?.rawDiagnostics||null});
    throw error;
  }finally{
    try{
      if(chat)try{await chat.delete()}catch{}
      if(activeChat===chat)activeChat=null;
      if(pendingUnloadReason){const reason=pendingUnloadReason;pendingUnloadReason='';await unloadEngine(reason,{afterGeneration:true})}
    }finally{generationActive=false;cancelRequested=false}
  }
}
async function accelerationTarget(selectedId){const profile=profileFor(selectedId);if(!profile)return null;if(selectedId===profile.id)return profile;return Boolean((await fastStatus(profile.id))?.available)?profile:null}
async function shouldAccelerate(){const pick=selected();if(!pick?.active)return false;return Boolean(await accelerationTarget(pick.id))}
function install(){
  const api=globalThis.CivweaveLocalChatRuntimeV295;if(!api?.generate)return false;
  if(api.__civweaveLiteRTGemma4FastV1===VERSION){wrapped=api;return true}
  const base=api;
  const generate=async args=>{
    const pick=selected(),profile=pick?.active?profileFor(pick.id):null;
    if(!profile)return base.generate(args);
    let target=null;try{target=await accelerationTarget(pick.id)}catch{}
    if(!target){if(pick.id===profile.id)throw Object.assign(new Error(`${profile.label} is selected but its optimized model file is not installed.`),{code:'LITERT_GEMMA4_NOT_INSTALLED',model:profile.id});return base.generate(args)}
    try{return await runFast(args,target.id)}catch(error){emit('civweave:litert-gemma4-fallback',{model:target.id,selectedModel:pick.id,message:String(error?.message||error),capability:error?.capability||null,formattedOutput:Boolean(args?.structuredTool)});if(pick.id!==profile.id)return base.generate(args);throw error}
  };
  const next=Object.freeze({...base,generate,__civweaveLiteRTGemma4FastV1:VERSION,litertGemma4Fast:true,litertGemma4Dual:true,litertGemma4Mtp:true,litertGemma4Jspi:true,litertGemma4FormattedOutput:true,litertGemma4ConstrainedDecoding:true,litertQwen35Phone:true,qwen35FastModelId:QWEN_FAST,qwen35DeepModelId:QWEN_DEEP,qwen35GemmaRoleBridge:true,get litertModelId(){return profileFor(selected()?.id)?.id||''},litertModelIds:Object.freeze(Object.keys(PROFILES)),legacyAcceleratedModelId:'gemma4-e2b-it-q4f16',legacyAcceleratedModelIds:Object.freeze([...ALIAS_TO_FAST.keys()].filter(id=>!PROFILES[id])),oneEngineAtATime:true,phoneProfile:'qwen35-flagship'});
  try{globalThis.CivweaveLocalChatRuntimeV295=next}catch{return false}
  wrapped=next;emit('civweave:litert-gemma4-fast-runtime-ready',{models:Object.keys(PROFILES),transparentAliases:[...ALIAS_TO_FAST.keys()],qwen35Models:[QWEN_FAST,QWEN_DEEP],qwen35GemmaRoleBridge:true,oneEngineAtATime:true,phoneProfile:'qwen35-flagship',mtpRequested:true,jspiRequired:true,formattedOutput:true,constrainedDecoding:true});return true;
}
function cancel(){
  if(!generationActive)return false;
  cancelRequested=true;
  try{activeChat?.cancel?.()}catch{}
  emit('civweave:litert-gemma4-cancel-requested',{model:engineModelId||enginePromiseModelId||'',reason:'user-or-no-progress'});
  return true;
}
async function unload(){
  if(generationActive)cancel();
  await unloadEngine('manual-unload');lastMetrics=null;return true;
}
for(const name of ['civweave:local-model-runtime-ready','civweave:gemma4-litert-fast-extension-ready','civweave:guide-loader-reset','pageshow'])addEventListener(name,()=>queueMicrotask(install));
addEventListener('civweave:local-model-selection',()=>{const pick=selected(),target=profileFor(pick?.id);if(engine&&(!pick?.active||!target||target.id!==engineModelId))void unloadEngine('selection-change')});
addEventListener('pagehide',()=>{void unloadEngine('pagehide')});
install();
globalThis.CivweaveLiteRTGemma4FastRuntimeV1=Object.freeze({version:VERSION,priorVersion:PRIOR_VERSION,get fastModelId(){return globalThis.CivweaveLocalGenerationModelPolicyV1?.resolve?.('fast')||selected()?.id||''},fastModelIds:Object.freeze(Object.keys(PROFILES)),qwen35FastModelId:QWEN_FAST,qwen35DeepModelId:QWEN_DEEP,qwen35GemmaRoleBridge:true,legacyQ4Id:'gemma4-e2b-it-q4f16',profiles:PROFILES,moduleUrl:MODULE_URL,wasmRoot:WASM_ROOT,get engineContextTokens(){return profileFor(selected()?.id)?.contextTokens||0},oneEngineAtATime:true,mtpRequested:true,jspiRequired:true,get phoneProfile(){return profileFor(selected()?.id)?.family||'none'},formattedOutput:true,constrainedDecoding:true,structuredToolCalling:true,supportsJspi,install,runFast,cancel,fastStatus,accelerationTarget,shouldAccelerate,unload,state:()=>Object.freeze({installed:Boolean(wrapped),engineReady:Boolean(engine),engineMode,engineLoading:Boolean(enginePromise),engineLoadingModelId:enginePromiseModelId,engineModelId,engineUsesMtp,jspiAvailable:supportsJspi(),generationActive,lastMetrics})});
})();