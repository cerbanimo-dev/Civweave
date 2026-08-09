'use strict';
const CACHE='civweave-model-generative-v266';
const TRANSFORMERS='/app/vendor/transformers/transformers.min.js';
let hfRuntime=null,tokenizer=null,model=null,loadedId='',loading=null,residentGpu=null;
const now=()=>performance.now();
const post=(id,type,payload={})=>self.postMessage({id,type,...payload});
const progress=(id,phase,started,detail={})=>post(id,'progress',{progress:{phase,elapsedMs:Math.round(now()-started),...detail}});
const artifact=(spec,path)=>spec.artifacts?.find?.(x=>x.path===path)||null;
const revisionFor=(spec,path)=>artifact(spec,path)?.revision||spec.revision;
const remoteUrl=(spec,path)=>`https://huggingface.co/${spec.repo}/resolve/${encodeURIComponent(revisionFor(spec,path))}/${path}`;
function cacheAdapter(cache,spec){
  const localPrefix=`/models/${spec.repo}/`,remotePrefix=`https://huggingface.co/${spec.repo}/resolve/`;
  const miss=()=>new Response('',{status:404,statusText:'Downloaded model cache miss'});
  const find=async path=>{const hit=await cache.match(remoteUrl(spec,path));return hit?.ok?hit.clone():miss()};
  return{async match(request){const key=typeof request==='string'?request:request?.url||String(request);if(key.startsWith(localPrefix))return find(key.slice(localPrefix.length));if(key.startsWith(remotePrefix)){const rest=key.slice(remotePrefix.length),slash=rest.indexOf('/');if(slash>=0)return find(rest.slice(slash+1))}const hit=await cache.match(request).catch(()=>null);return hit?.ok?hit.clone():undefined},put:(request,response)=>cache.put(request,response)};
}
async function configure(spec){
  const hf=hfRuntime||(hfRuntime=await import(TRANSFORMERS));
  const cache=await caches.open(CACHE);
  hf.env.allowLocalModels=true;hf.env.allowRemoteModels=false;hf.env.useBrowserCache=false;hf.env.useCustomCache=true;hf.env.customCache=cacheAdapter(cache,spec);
  if(hf.env.backends?.onnx?.wasm)hf.env.backends.onnx.wasm.wasmPaths='/app/vendor/transformers/wasm/';
  return hf;
}
async function gpuProfile(){
  if(!self.navigator?.gpu)throw new Error('WebGPU is unavailable in this worker.');
  const adapter=await self.navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  if(!adapter)throw new Error('WebGPU is exposed, but no GPU adapter could be created.');
  const info=adapter.info||{};
  return{available:true,shaderF16:Boolean(adapter.features?.has?.('shader-f16')),vendor:String(info.vendor||''),architecture:String(info.architecture||''),description:String(info.description||''),maxBufferSize:Number(adapter.limits?.maxBufferSize||0)};
}
async function ensure(spec,id){
  if(loadedId===spec.id&&tokenizer&&model)return{coldStart:false,coldStartMs:0,warmupMs:0,gpu:residentGpu};
  if(loading)return loading;
  loading=(async()=>{
    const started=now(),hf=await configure(spec);
    progress(id,'checking-gpu',started,{model:spec.id});const gpu=await gpuProfile();residentGpu=gpu;
    progress(id,'loading-tokenizer',started,{model:spec.id,gpu});const tokenizerStarted=now();
    tokenizer=await hf.AutoTokenizer.from_pretrained(spec.repo,{revision:spec.revision,progress_callback:x=>progress(id,'loading-tokenizer',started,{model:spec.id,...x})});
    const tokenizerLoadMs=Math.round(now()-tokenizerStarted);
    progress(id,'loading-model',started,{model:spec.id});const modelStarted=now();
    model=await hf.AutoModelForCausalLM.from_pretrained(spec.repo,{revision:spec.revision,device:spec.device,dtype:spec.dtype,progress_callback:x=>progress(id,'loading-model',started,{model:spec.id,...x})});
    const modelLoadMs=Math.round(now()-modelStarted);
    progress(id,'warming-model',started,{model:spec.id});const warmStarted=now();
    await model.generate({...tokenizer('a'),max_new_tokens:1,do_sample:false});
    const warmupMs=Math.round(now()-warmStarted),coldStartMs=Math.round(now()-started);loadedId=spec.id;
    const metrics={coldStart:true,coldStartMs,tokenizerLoadMs,modelLoadMs,warmupMs,gpu};progress(id,'model-ready',started,{model:spec.id,...metrics});return metrics;
  })().finally(()=>{loading=null});
  return loading;
}
const promptTokens=inputs=>Number(inputs?.input_ids?.dims?.at?.(-1)||inputs?.input_ids?.tolist?.()?.[0]?.length||0);
const idsAfterPrompt=(sequences,count)=>{try{return sequences?.tolist?.()?.[0]?.slice(count)||[]}catch{return[]}};
const looseJson=text=>{const s=String(text||'').replace(/<think>[\s\S]*?<\/think>/gi,'').trim();const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a>=0&&b>a)try{return JSON.parse(s.slice(a,b+1))}catch{}return null};
async function generate(message,id){
  const spec=message.spec,requestStarted=now(),load=await ensure(spec,id);
  progress(id,'preparing-prompt',requestStarted,{model:spec.id,thinking:Boolean(message.thinking)});
  const prepStarted=now();
  const inputs=tokenizer.apply_chat_template(message.messages||[],{add_generation_prompt:true,return_dict:true,enable_thinking:Boolean(message.thinking)});
  const promptPrepareMs=Math.round(now()-prepStarted),inputTokens=promptTokens(inputs),window=Number(spec.contextWindowTokens||0),working=Number(spec.workingContextTokens||0),maxNewTokens=Math.max(8,Math.min(4096,Number(message.maxNewTokens||256)));
  if(window&&inputTokens+maxNewTokens>window){const e=new Error(`Prompt is ${inputTokens} tokens plus ${maxNewTokens} requested output tokens, beyond ${spec.label}'s ${window}-token model window.`);e.code='LOCAL_MODEL_CONTEXT_EXCEEDED';throw e}
  if(working&&inputTokens>working)progress(id,'context-warning',requestStarted,{model:spec.id,promptTokens:inputTokens,workingContextTokens:working,contextWindowTokens:window});
  const timing={first:0,count:0,index:0,text:''},generationStarted=now();
  const streamer=new hfRuntime.TextStreamer(tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:text=>{const value=String(text||'');if(!value)return;timing.text+=value;if(message.stream)post(id,'token',{token:{text:value,index:timing.index++}})},token_callback_function:tokens=>{if(!timing.first)timing.first=now();timing.count+=Math.max(1,tokens?.length||1)}});
  const temperature=Number(message.temperature??(message.thinking ? .6 : .7));
  progress(id,'generating',requestStarted,{model:spec.id,promptTokens:inputTokens,maxNewTokens,contextWindowTokens:window,workingContextTokens:working,thinking:Boolean(message.thinking)});
  const result=await model.generate({...inputs,max_new_tokens:maxNewTokens,do_sample:true,temperature:Math.max(.01,Math.min(2,temperature)),top_k:Number(spec.generation?.topK||20),streamer,return_dict_in_generate:true});
  const completed=now(),generatedIds=idsAfterPrompt(result?.sequences,inputTokens);let text='';
  try{text=tokenizer.decode(generatedIds,{skip_special_tokens:true}).trim()}catch{}if(!text)text=timing.text.trim();
  const generatedTokens=generatedIds.length||timing.count,generationMs=Math.round(completed-generationStarted),ttftMs=timing.first?Math.round(timing.first-generationStarted):null,tps=generatedTokens?Number((generatedTokens/(Math.max(1,completed-(timing.first||generationStarted))/1000)).toFixed(2)):0;
  return{text,json:looseJson(text),model:{id:spec.id,repo:spec.repo,revision:spec.revision},streamed:Boolean(message.stream),streamRequested:Boolean(message.stream),metrics:{...load,promptPrepareMs,promptTokens:inputTokens,contextWindowTokens:window,workingContextTokens:working,maxNewTokens,thinking:Boolean(message.thinking),generationMs,ttftMs,generatedTokens,tokensPerSecond:tps,totalMs:Math.round(completed-requestStarted),gpu:residentGpu}};
}
self.addEventListener('message',async event=>{const m=event.data||{},id=m.id;if(!id)return;try{if(m.type==='shutdown'){try{model?.dispose?.()}catch{}model=null;tokenizer=null;loadedId='';residentGpu=null;post(id,'done',{result:{shutdown:true}});return}if(m.type!=='generate')throw new Error(`Unsupported local-model worker request: ${m.type}`);post(id,'done',{result:await generate(m,id)})}catch(error){post(id,'error',{error:{message:String(error?.message||error),name:error?.name||'Error',code:error?.code||'LOCAL_MODEL_FAILED'}})}});
