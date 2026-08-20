'use strict';
const WORKER_REVISION='1.0.126-v315-gemma4-template-logits';
const CACHE='civweave-model-generative-v266';
const RUNTIME_CACHE='civweave-local-runtime-v287';
const TRANSFORMERS_V3='/app/vendor/transformers/transformers.min.js';
const WASM_V3='/app/vendor/transformers/wasm/';
const runtimeModules=new Map();
const wasmBinaryCache=new Map();
let hfRuntime=null,tokenizer=null,model=null,loaded=null,loading=null;
const clean=(value,max=200000)=>String(value??'').slice(0,max);
const now=()=>performance.now();
const post=(id,type,payload={})=>self.postMessage({id,type,...payload});
const phase=(id,name,started,detail={})=>post(id,'progress',{progress:{phase:name,elapsedMs:Math.round(now()-started),workerRevision:WORKER_REVISION,...detail}});
const artifactFor=(spec,path)=>spec?.artifacts?.find?.(row=>row?.path===path)||null;
const revisionFor=(spec,path)=>artifactFor(spec,path)?.revision||spec.revision;
const remoteUrl=(spec,path)=>`https://huggingface.co/${spec.repo}/resolve/${encodeURIComponent(revisionFor(spec,path))}/${path}`;
const runtimeAsset=spec=>spec?.runtimeAsset||TRANSFORMERS_V3;
const wasmRoot=spec=>spec?.wasmRoot||WASM_V3;
const isGemma4=spec=>/gemma[-_ ]?4/i.test(`${spec?.id||''} ${spec?.repo||''} ${spec?.label||''}`);
function requestUrl(input){try{return typeof input==='string'?input:input?.url||String(input)}catch{return String(input||'')}}
function cacheAdapter(cache,spec){
  const localPrefix=`/models/${spec.repo}/`,repoPrefix=`https://huggingface.co/${spec.repo}/resolve/`;
  const miss=()=>new Response('',{status:404,statusText:'Downloaded model cache miss'});
  const withKnownLength=(response,path)=>{const known=Math.max(0,Number(artifactFor(spec,path)?.sizeBytes)||0);if(!response?.ok||response.headers.get('content-length')||!known)return response;const headers=new Headers(response.headers);headers.set('content-length',String(known));headers.set('x-civweave-artifact-length','registry-v300');return new Response(response.body,{status:response.status,statusText:response.statusText,headers})};
  const find=async path=>{const hit=await cache.match(remoteUrl(spec,path));return hit?.ok?withKnownLength(hit,path):miss()};
  return{async match(request){const key=requestUrl(request);if(key.startsWith(localPrefix))return find(key.slice(localPrefix.length));if(key.startsWith(repoPrefix)){const rest=key.slice(repoPrefix.length),slash=rest.indexOf('/');if(slash>=0)return find(rest.slice(slash+1))}try{const hit=await cache.match(request);return hit?.ok?hit:undefined}catch{return undefined}},put:(request,response)=>cache.put(request,response)};
}
function friendlyError(error,spec,stage='inference'){
  const raw=String(error?.message||error);
  if(/^\s*\d{6,}\s*$/.test(raw))return `${spec?.label||spec?.id||'The selected model'} could not create its local inference session during ${stage}. The browser backend returned diagnostic code ${raw.trim()} without an explanation; Civweave released that worker instead of leaving it resident.`;
  if(raw.includes('/models/')&&(raw.includes('env.allowRemoteModels=false')||raw.includes('local_files_only=true')))return `Downloaded model cache miss for ${spec?.label||spec?.id||'the selected model'} during ${stage}. Resume this model while online so Civweave can fetch only the missing artifact.`;
  if(/Unexpected end of JSON input|Unexpected token\s*['"]?<|<!doctype|not valid JSON/i.test(raw))return `Downloaded model metadata is missing, truncated, or invalid for ${spec?.label||spec?.id||'the selected model'} during ${stage}. Reopen model settings while online so Civweave can repair only the bad metadata artifact.\n\nTransport detail: ${raw}`;
  if(/Gemma 4 runtime chunk/i.test(raw))return `The Gemma 4 browser runtime is incomplete on this device. Open Civweave online once and test the model so the split ONNX runtime can be cached for offline use.\n\nRuntime detail: ${raw}`;
  if(/shader-f16/i.test(raw))return `${spec?.label||spec?.id||'The selected model'} requires WebGPU shader-f16 support for its mobile q2f16 graph. Civweave can step down to a compatible local tier when the request permits it.\n\nBackend detail: ${raw}`;
  if(/Failed to get GPU adapter|WebGPU adapter|no available backend|WebGPU is unavailable/i.test(raw))return `This browser did not provide a usable WebGPU adapter during ${stage}. Civweave can use its local fallback ladder when the request allows it.\n\nBackend detail: ${raw}`;
  if(/shader|device lost|out of memory|allocation|buffer/i.test(raw))return `${spec?.label||spec?.id||'The selected model'} reached a WebGPU/device limit during ${stage}. ${raw}`;
  return raw;
}
async function importRuntime(spec){
  const asset=runtimeAsset(spec);
  if(runtimeModules.has(asset))return runtimeModules.get(asset);
  const promise=import(asset).catch(error=>{runtimeModules.delete(asset);throw error});
  runtimeModules.set(asset,promise);
  return promise;
}
async function runtimeChunk(path){
  const cache=globalThis.caches?await caches.open(RUNTIME_CACHE):null;
  const hit=cache?await cache.match(path):null;
  if(hit?.ok)return new Uint8Array(await hit.arrayBuffer());
  const response=await fetch(path,{cache:'no-store'});
  if(!response.ok)throw new Error(`Gemma 4 runtime chunk ${path} returned HTTP ${response.status}.`);
  if(cache)try{await cache.put(path,response.clone())}catch{}
  return new Uint8Array(await response.arrayBuffer());
}
async function splitWasmBinary(spec){
  const chunks=Array.isArray(spec?.wasmChunks)?spec.wasmChunks.filter(Boolean):[];
  if(!chunks.length)return null;
  const key=chunks.join('|');
  if(wasmBinaryCache.has(key))return wasmBinaryCache.get(key);
  const promise=(async()=>{
    const parts=[];let total=0;
    for(const path of chunks){const bytes=await runtimeChunk(path);if(!bytes.byteLength)throw new Error(`Gemma 4 runtime chunk ${path} was empty.`);parts.push(bytes);total+=bytes.byteLength}
    const merged=new Uint8Array(total);let offset=0;
    for(const part of parts){merged.set(part,offset);offset+=part.byteLength}
    return merged;
  })().catch(error=>{wasmBinaryCache.delete(key);throw error});
  wasmBinaryCache.set(key,promise);
  return promise;
}
function runtimeProfile(hf,spec){
  const hardwareConcurrency=Math.max(1,Number(self.navigator?.hardwareConcurrency||1));
  const isolated=Boolean(self.crossOriginIsolated);
  const requestedThreads=Math.max(1,Math.min(4,Math.floor(hardwareConcurrency/2)||1));
  const forceSingleThread=Boolean(spec?.forceSingleThread),wasmThreads=forceSingleThread?1:(isolated?requestedThreads:1);
  const wasm=hf.env.backends?.onnx?.wasm||null;
  if(wasm){
    wasm.wasmPaths=wasmRoot(spec);
    wasm.numThreads=wasmThreads;
    wasm.simd=true;
  }
  return{
    runtime:spec.runtime||'transformers-js-v3',
    runtimeAsset:runtimeAsset(spec),
    crossOriginIsolated:isolated,
    hardwareConcurrency,
    wasmThreads,
    forceSingleThread,
    wasmSimd:Boolean(wasm?.simd),
    workerInference:true,
    threadedWasmEligible:Boolean(isolated&&wasmThreads>1),
    workerRevision:WORKER_REVISION
  };
}
function annotate(error,stage,spec){const value=error instanceof Error?error:new Error(clean(error,1000));if(!value.phase)value.phase=stage;if(!value.model)value.model=spec?.id||'';if(!value.modelLabel)value.modelLabel=spec?.label||spec?.id||'';if(!value.backend)value.backend=spec?.device||'';return value}
async function atStage(stage,spec,work){try{return await work()}catch(error){throw annotate(error,stage,spec)}}
async function backendProfile(spec){
  if(spec.device!=='webgpu')return{backend:'wasm',gpu:null};
  if(!self.navigator?.gpu?.requestAdapter)throw Object.assign(new Error('WebGPU is unavailable in this worker.'),{code:'LOCAL_BACKEND_CAPABILITY_UNAVAILABLE'});
  let adapter;try{adapter=await self.navigator.gpu.requestAdapter()}catch(error){throw Object.assign(new Error(`Failed to get GPU adapter: ${clean(error?.message||error,1000)}`),{code:'LOCAL_BACKEND_CAPABILITY_UNAVAILABLE'})}
  if(!adapter)throw Object.assign(new Error('Failed to get GPU adapter.'),{code:'LOCAL_BACKEND_CAPABILITY_UNAVAILABLE'});
  const info=adapter.info||{},shaderF16=Boolean(adapter.features?.has?.('shader-f16'));
  if(spec.requiresShaderF16&&!shaderF16)throw Object.assign(new Error('WebGPU shader-f16 is required by this mobile q2f16 model, but the active adapter does not expose shader-f16.'),{code:'LOCAL_BACKEND_CAPABILITY_UNAVAILABLE'});
  return{backend:'webgpu',gpu:{available:true,shaderF16,vendor:clean(info.vendor||'',120),architecture:clean(info.architecture||'',120),device:clean(info.device||'',120),description:clean(info.description||'',180),maxBufferSize:Number(adapter.limits?.maxBufferSize||0),maxStorageBufferBindingSize:Number(adapter.limits?.maxStorageBufferBindingSize||0)}};
}
async function configureRuntime(hf,cache,spec){
  hf.env.allowLocalModels=true;
  hf.env.allowRemoteModels=false;
  hf.env.useBrowserCache=false;
  hf.env.useCustomCache=true;
  hf.env.customCache=cacheAdapter(cache,spec);
  const profile=runtimeProfile(hf,spec),wasm=hf.env.backends?.onnx?.wasm||null;
  if(wasm&&spec.wasmChunks?.length){
    const binary=await splitWasmBinary(spec);
    wasm.wasmBinary=binary;
    profile.wasmBinaryBytes=binary?.byteLength||0;
    profile.wasmChunkCount=spec.wasmChunks.length;
    profile.wasmBinaryCached=true;
  }
  return profile;
}
function progressReporter(id,name,started,base={}){let high=0;return value=>{const p=value||{},raw=Number(p.progress_total??p.progress),detail={...base,...p};if(Number.isFinite(raw)&&raw>=0){const pct=Math.max(0,Math.min(100,raw<=1?raw*100:raw));high=Math.max(high,pct);detail.artifactProgress=Number.isFinite(Number(p.progress))?Number(p.progress):null;detail.progress=high;detail.progressOverall=high}if(!detail.artifact&&p.file)detail.artifact=p.file;phase(id,name,started,detail)}}
function externalDataSetting(spec){const rows=(spec?.artifacts||[]).filter(row=>/\.onnx_data$/i.test(String(row?.path||'')));return rows.length===1?true:false}
function repairGemma4ChatTemplate(spec){
  if(!isGemma4(spec)||typeof tokenizer?.chat_template!=='string')return{gemma4:false,patched:false,canonical:false};
  const current=tokenizer.chat_template;
  if(/not\s+enable_thinking\s*\|\s*default\(false\)/i.test(current)&&current.includes('<|channel>thought\\n<channel|>'))return{gemma4:true,patched:false,canonical:true};
  const marker='{%- if add_generation_prompt -%}',modelTurn="{{- '<|turn>model\\n' -}}",start=current.lastIndexOf(marker);
  if(start<0)return{gemma4:true,patched:false,canonical:false,reason:'generation-prompt-marker-missing'};
  const tail=current.slice(start),outerEnd=tail.lastIndexOf('{%- endif -%}');
  if(!tail.includes(modelTurn)||outerEnd<0)return{gemma4:true,patched:false,canonical:false,reason:'generation-prompt-shape-unrecognized'};
  const insertion="{%- if not enable_thinking | default(false) -%}\n{{- '<|channel>thought\\n<channel|>' -}}\n{%- endif -%}\n";
  try{tokenizer.chat_template=current.slice(0,start)+tail.slice(0,outerEnd)+insertion+tail.slice(outerEnd);return{gemma4:true,patched:true,canonical:true}}catch{return{gemma4:true,patched:false,canonical:false,reason:'template-not-writable'}}
}
function forceNextTokenLogits(feeds){
  if(!hfRuntime?.Tensor||!feeds||typeof feeds!=='object')return feeds;
  try{
    const present=feeds.num_logits_to_keep,raw=present?.data?.[0];
    if(present&&raw!==0&&raw!==0n&&String(raw)!=='0')return feeds;
    return{...feeds,num_logits_to_keep:new hfRuntime.Tensor('int64',[1n],[])};
  }catch{return feeds}
}
function patchGemma4LogitsSessions(root,spec){
  if(!isGemma4(spec)||!root||!hfRuntime?.Tensor)return[];
  const seen=new Set(),patched=[];
  const visit=(value,path,depth)=>{
    if(!value||typeof value!=='object'||seen.has(value)||depth>5)return;
    seen.add(value);
    try{
      if(typeof value.run==='function'&&Array.isArray(value.inputNames)&&value.inputNames.includes('num_logits_to_keep')&&!value.__cwGemma4NextLogitV1){
        const original=value.run.bind(value);
        value.run=(feeds,...args)=>original(forceNextTokenLogits(feeds),...args);
        try{Object.defineProperty(value,'__cwGemma4NextLogitV1',{value:true,configurable:true})}catch{value.__cwGemma4NextLogitV1=true}
        patched.push(path||'session');
      }
    }catch{}
    if(value.sessions&&typeof value.sessions==='object')for(const [key,session] of Object.entries(value.sessions))visit(session,`${path}.sessions.${key}`,depth+1);
    for(const key of ['model','decoder','language_model','text_model'])if(value[key])visit(value[key],`${path}.${key}`,depth+1);
  };
  visit(root,'model',0);return patched;
}
const promptTokenCount=inputs=>Number(inputs?.input_ids?.dims?.at?.(-1)||inputs?.input_ids?.tolist?.()?.[0]?.length||0);
const generatedIds=(sequences,count)=>{try{return sequences?.tolist?.()?.[0]?.slice(count)||[]}catch{return[]}};
function makeStreamer(id,requested,timing){if(!hfRuntime?.TextStreamer||!tokenizer)return null;return new hfRuntime.TextStreamer(tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:text=>{const value=clean(text,12000);if(!value)return;timing.decoded+=value;if(requested)post(id,'token',{token:{text:value,index:timing.index++}})},token_callback_function:tokens=>{if(!timing.firstTokenAt)timing.firstTokenAt=now();timing.generatedTokens+=Math.max(1,tokens?.length||1)}})}
async function warmBenchmark(id,started,profile){
  const benchmarkStarted=now();
  phase(id,'benchmarking-model',started,{model:loaded?.id||'',backend:profile.backend,targetTokens:10});
  const inputs=tokenizer('Civweave local inference benchmark');
  const promptTokens=promptTokenCount(inputs);
  const timing={firstTokenAt:0,generatedTokens:0,index:0,decoded:''};
  const streamer=makeStreamer(id,false,timing);
  const options={...inputs,max_new_tokens:10,min_new_tokens:10,do_sample:false,use_cache:true,return_dict_in_generate:true};
  if(streamer)options.streamer=streamer;
  if(isGemma4(loaded)&&hfRuntime?.Tensor)options.num_logits_to_keep=new hfRuntime.Tensor('int64',[1n],[]);
  const output=await model.generate(options);
  const completed=now(),ids=generatedIds(output?.sequences,promptTokens),tokens=ids.length||timing.generatedTokens||10;
  const benchmarkMs=Math.max(1,Math.round(completed-benchmarkStarted));
  const benchmarkTtftMs=timing.firstTokenAt?Math.round(timing.firstTokenAt-benchmarkStarted):null;
  const benchmarkDecodeMs=Math.max(1,completed-(timing.firstTokenAt||benchmarkStarted));
  const benchmarkTokensPerSecond=Number((tokens/(benchmarkDecodeMs/1000)).toFixed(2));
  return{benchmarkMs,benchmarkTtftMs,benchmarkTokens:tokens,benchmarkTokensPerSecond};
}
async function unload(){try{await model?.dispose?.()}catch{}tokenizer=null;model=null;loaded=null;hfRuntime=null}
async function ensure(spec,id,{benchmark=false}={}){
  const key=`${spec.id}:${spec.runtime||'transformers-js-v3'}:${spec.device||'wasm'}:${spec.dtype||''}:${spec.textOnly?'text':''}`;
  if(loaded?.key===key&&tokenizer&&model){if(benchmark&&!loaded.benchmark)loaded.benchmark=await warmBenchmark(id,now(),loaded);return{coldStart:false,coldStartMs:0,tokenizerLoadMs:0,modelLoadMs:0,warmupMs:0,backend:loaded.backend,gpu:loaded.gpu,...loaded.runtime,gemma4ChatTemplate:loaded.gemma4ChatTemplate,gemma4LogitsSessions:loaded.gemma4LogitsSessions,...(loaded.benchmark||{})}};
  if(loading)return loading;
  loading=(async()=>{
    if(loaded?.key&&loaded.key!==key)await unload();
    const started=now();phase(id,'loading-runtime',started,{model:spec.id,runtime:spec.runtime||'transformers-js-v3'});
    const hf=await atStage('loading-runtime',spec,()=>importRuntime(spec));hfRuntime=hf;
    const cache=await atStage('loading-runtime',spec,()=>caches.open(CACHE)),runtime=await atStage('loading-runtime',spec,()=>configureRuntime(hf,cache,spec));
    phase(id,'runtime-profile',started,{model:spec.id,...runtime});
    phase(id,'checking-backend',started,{model:spec.id,requestedBackend:spec.device||'wasm',requiresShaderF16:Boolean(spec.requiresShaderF16)});const profile=await atStage('checking-backend',spec,()=>backendProfile(spec));
    phase(id,'loading-tokenizer',started,{model:spec.id,backend:profile.backend,gpu:profile.gpu});const tokenizerStarted=now();
    tokenizer=await atStage('loading-tokenizer',spec,()=>hf.AutoTokenizer.from_pretrained(spec.repo,{revision:spec.revision,progress_callback:progressReporter(id,'loading-tokenizer',started,{model:spec.id,backend:profile.backend})}));
    const tokenizerLoadMs=Math.round(now()-tokenizerStarted),gemma4ChatTemplate=repairGemma4ChatTemplate(spec);
    if(isGemma4(spec))phase(id,'gemma4-chat-template',started,{model:spec.id,backend:profile.backend,...gemma4ChatTemplate});
    phase(id,'loading-model',started,{model:spec.id,backend:profile.backend,textOnly:Boolean(spec.textOnly),progress:0,progressOverall:0});const modelStarted=now();
    const modelOptions={revision:spec.revision,device:spec.device||profile.backend,dtype:spec.dtype,progress_callback:progressReporter(id,'loading-model',started,{model:spec.id,backend:profile.backend})};
    const externalData=externalDataSetting(spec);if(externalData)modelOptions.use_external_data_format=externalData;
    if(spec.textOnly)modelOptions.textOnly=true;
    model=await atStage('loading-model',spec,()=>hf.AutoModelForCausalLM.from_pretrained(spec.repo,modelOptions));
    const modelLoadMs=Math.round(now()-modelStarted),gemma4LogitsSessions=patchGemma4LogitsSessions(model,spec);
    if(isGemma4(spec))phase(id,'gemma4-next-logit-patch',started,{model:spec.id,backend:profile.backend,patchedSessions:gemma4LogitsSessions,nextTokenLogitsOnly:true});
    const warmupMs=0;
    loaded={key,id:spec.id,repo:spec.repo,revision:spec.revision,label:spec.label,backend:profile.backend,dtype:spec.dtype,gpu:profile.gpu,runtime,benchmark:null,gemma4ChatTemplate,gemma4LogitsSessions};
    const benchmarkResult=benchmark?await warmBenchmark(id,started,profile):null;
    loaded.benchmark=benchmarkResult;
    const coldStartMs=Math.round(now()-started);
    const metrics={coldStart:true,coldStartMs,tokenizerLoadMs,modelLoadMs,warmupMs,backend:profile.backend,gpu:profile.gpu,...runtime,externalDataFormat:Boolean(externalData),gemma4ChatTemplate,gemma4LogitsSessions,nextTokenLogitsOnly:Boolean(isGemma4(spec)),...(benchmarkResult||{})};
    phase(id,'model-ready',started,{model:spec.id,progress:100,progressOverall:100,...metrics});
    return metrics;
  })().catch(async error=>{await unload();throw error}).finally(()=>{loading=null});
  return loading;
}
function parseJsonLoose(text){const source=clean(text).replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();for(let start=0;start<source.length;start++){if(source[start]!=='{'&&source[start]!=='[')continue;const open=source[start],close=open==='{'?'}':']';let depth=0,quoted=false,escaped=false;for(let i=start;i<source.length;i++){const c=source[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}if(c==='"'){quoted=true;continue}if(c===open)depth++;else if(c===close&&--depth===0){try{return JSON.parse(source.slice(start,i+1))}catch{break}}}}return null}
function prepareInputs(message,id,started,spec){
  const source=Array.isArray(message.messages)?message.messages.filter(row=>row&&typeof row.content==='string'):[],messages=source.map(row=>({...row})),budget=Math.max(0,Number(message.promptTokenBudget||0));
  const tokenize=()=>tokenizer.apply_chat_template(messages,{add_generation_prompt:true,tokenize:true,return_dict:true,enable_thinking:Boolean(message.thinking),preserve_thinking:false});
  let inputs=tokenize(),tokens=promptTokenCount(inputs),removed=0;
  while(budget&&tokens>budget&&messages.length>2){messages.splice(1,1);removed++;inputs=tokenize();tokens=promptTokenCount(inputs)}
  if(removed)phase(id,'trimming-context',started,{model:spec.id,backend:spec.device||'',removedMessages:removed,promptTokens:tokens,promptTokenBudget:budget});
  return{inputs,promptTokens:tokens,removedMessages:removed,promptTokenBudget:budget};
}
async function prewarm(message,id){const spec=message.spec,started=now();const metrics=await ensure(spec,id,{benchmark:false});phase(id,'prewarm-ready',started,{model:spec.id,backend:metrics.backend,coldStart:metrics.coldStart,coldStartMs:metrics.coldStartMs,wasmThreads:metrics.wasmThreads});return{prewarmed:true,model:spec.id,backend:metrics.backend,metrics}}
async function generate(message,id){
  const spec=message.spec,requestStarted=now();let currentPhase='loading-model';
  try{
  const load=await ensure(spec,id,{benchmark:Boolean(message.benchmark)});
  currentPhase='preparing-prompt';phase(id,currentPhase,requestStarted,{model:spec.id,backend:load.backend,thinking:Boolean(message.thinking)});const prepStarted=now();
  const prepared=prepareInputs(message,id,requestStarted,spec),inputs=prepared.inputs,promptTokens=prepared.promptTokens;
  const promptPrepareMs=Math.round(now()-prepStarted),window=Number(spec.contextWindowTokens||0),working=Number(spec.workingContextTokens||0),maxNewTokens=Math.max(8,Math.min(4096,Number(message.maxNewTokens||256)));
  if(window&&promptTokens+maxNewTokens>window){const error=new Error(`Prompt is ${promptTokens.toLocaleString()} tokens and asks for ${maxNewTokens.toLocaleString()} output tokens, beyond ${spec.label}'s ${window.toLocaleString()}-token model window.`);error.code='LOCAL_MODEL_CONTEXT_EXCEEDED';throw error}
  if(working&&promptTokens>working)phase(id,'context-warning',requestStarted,{model:spec.id,promptTokens,workingContextTokens:working,contextWindowTokens:window});
  const timing={firstTokenAt:0,generatedTokens:0,index:0,decoded:''},generationStarted=now(),streamer=makeStreamer(id,Boolean(message.stream),timing),temperature=Math.max(.01,Math.min(2,Number(message.temperature??.7)));
  currentPhase='generating';phase(id,currentPhase,requestStarted,{model:spec.id,backend:load.backend,streaming:Boolean(message.stream),thinking:Boolean(message.thinking),promptTokens,maxNewTokens,contextWindowTokens:window,workingContextTokens:working,promptTokenBudget:prepared.promptTokenBudget,removedMessages:prepared.removedMessages,wasmThreads:load.wasmThreads,crossOriginIsolated:load.crossOriginIsolated,wasmSimd:load.wasmSimd,runtime:load.runtime,gemma4ChatTemplate:load.gemma4ChatTemplate,gemma4LogitsSessions:load.gemma4LogitsSessions,nextTokenLogitsOnly:Boolean(isGemma4(spec))});
  const options={...inputs,max_new_tokens:maxNewTokens,do_sample:true,temperature,top_k:Number(spec.generation?.topK||20),top_p:Number(spec.generation?.topP??.95),use_cache:true,return_dict_in_generate:true};
  if(isGemma4(spec)&&hfRuntime?.Tensor)options.num_logits_to_keep=new hfRuntime.Tensor('int64',[1n],[]);
  if(streamer)options.streamer=streamer;
  const output=await model.generate(options),completed=now(),ids=generatedIds(output?.sequences,promptTokens);let text='';try{text=clean(tokenizer.decode(ids,{skip_special_tokens:true})).trim()}catch{}if(!text)text=clean(timing.decoded).trim();
  const tokenCount=ids.length||timing.generatedTokens,generationMs=Math.round(completed-generationStarted),ttftMs=timing.firstTokenAt?Math.round(timing.firstTokenAt-generationStarted):null,decodeMs=Math.max(1,completed-(timing.firstTokenAt||generationStarted)),tokensPerSecond=tokenCount?Number((tokenCount/(decodeMs/1000)).toFixed(2)):0;
  return{text,json:parseJsonLoose(text),model:{id:spec.id,repo:spec.repo,revision:spec.revision,runtime:spec.runtime||'transformers-js-v3'},backend:load.backend,streamed:Boolean(message.stream&&streamer),streamRequested:Boolean(message.stream),metrics:{...load,promptPrepareMs,promptTokens,promptTokenBudget:prepared.promptTokenBudget,removedMessages:prepared.removedMessages,contextWindowTokens:window,workingContextTokens:working,maxNewTokens,thinking:Boolean(message.thinking),generationMs,ttftMs,prefillAndFirstTokenMs:ttftMs,decodeMs:Math.round(decodeMs),generatedTokens:tokenCount,tokensPerSecond,totalMs:Math.round(completed-requestStarted),kvCache:true,nextTokenLogitsOnly:Boolean(isGemma4(spec)),workerRevision:WORKER_REVISION}};
  }catch(error){throw annotate(error,currentPhase,spec)}
}
self.addEventListener('message',async event=>{const message=event.data||{},id=message.id;if(!id)return;try{if(message.type==='shutdown'){await unload();post(id,'done',{result:{shutdown:true}});return}if(message.type==='prewarm'){post(id,'done',{result:await prewarm(message,id)});return}if(message.type!=='generate')throw new Error(`Unsupported local-model worker request: ${message.type}`);post(id,'done',{result:await generate(message,id)})}catch(error){const stage=error?.code==='LOCAL_MODEL_CONTEXT_EXCEEDED'?'context check':error?.phase||'inference',detail={message:friendlyError(error,message.spec,stage),name:error?.name||'Error',code:error?.code||'LOCAL_MODEL_FAILED',phase:error?.phase||stage,model:error?.model||message.spec?.id||'',modelLabel:error?.modelLabel||message.spec?.label||message.spec?.id||'',backend:error?.backend||message.spec?.device||'',rawMessage:clean(error?.message||error,1000),stack:clean(error?.stack,4000),sessionReleased:true};await unload();post(id,'error',{error:detail})}});