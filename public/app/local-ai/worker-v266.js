'use strict';
const CACHE='civweave-model-generative-v266';
const TRANSFORMERS='/app/vendor/transformers/transformers.min.js';
let tokenizer=null,model=null,loaded=null,loading=null,hfRuntime=null,residentLoad=null;
const clean=(value,max=200000)=>String(value??'').slice(0,max);
const clock=()=>performance.now();
function post(id,type,payload={}){self.postMessage({id,type,...payload})}
function phase(id,name,started,detail={}){post(id,'progress',{progress:{phase:name,elapsedMs:Math.round(clock()-started),...detail}})}
function requestUrl(input){try{return typeof input==='string'?input:input?.url||String(input)}catch{return String(input||'')}}
function artifactFor(spec,path){const cleanPath=String(path||'').replace(/^\/+/, '');return spec?.artifacts?.find?.(item=>item?.path===cleanPath)||null}
function artifactRevision(spec,path){return artifactFor(spec,path)?.revision||spec.revision}
function pinnedRemoteUrl(spec,path){const cleanPath=String(path||'').replace(/^\/+/, '');return `https://huggingface.co/${spec.repo}/resolve/${encodeURIComponent(artifactRevision(spec,cleanPath))}/${cleanPath}`}
function cacheAdapter(cache,spec){
  const localPrefix=`/models/${spec.repo}/`,repoPrefix=`https://huggingface.co/${spec.repo}/resolve/`;
  const miss=()=>new Response('',{status:404,statusText:'Downloaded model cache miss'});
  const find=async path=>{const hit=await cache.match(pinnedRemoteUrl(spec,path));return hit?.ok?hit.clone():miss()};
  return{
    async match(request){
      const key=requestUrl(request);
      if(key.startsWith(localPrefix))return find(key.slice(localPrefix.length));
      if(key.startsWith(repoPrefix)){
        const rest=key.slice(repoPrefix.length),slash=rest.indexOf('/');
        if(slash>=0)return find(rest.slice(slash+1));
      }
      try{const hit=await cache.match(request);return hit?.ok?hit.clone():undefined}catch{return undefined}
    },
    put(request,response){return cache.put(request,response)}
  };
}
function friendlyError(error,spec,stage='inference'){
  const raw=String(error?.message||error);
  if(raw.includes('/models/')&&(raw.includes('env.allowRemoteModels=false')||raw.includes('local_files_only=true')))return `Downloaded model cache miss for ${spec?.label||spec?.id||'the selected model'} during ${stage}. Resume this model while online so Civweave can fetch only the missing artifact.`;
  if(/Unexpected token\s*['"]?<|<!doctype|not valid JSON/i.test(raw))return `Downloaded model metadata contained HTML instead of JSON for ${spec?.label||spec?.id||'the selected model'}. Resume the model once so Civweave can repair only the bad metadata file.`;
  if(/shader|device lost|out of memory|allocation|buffer/i.test(raw))return `${spec?.label||spec?.id||'The selected model'} reached a WebGPU/device limit during ${stage}. ${raw}`;
  return raw;
}
async function configureRuntime(hf,cache,spec){
  hf.env.allowLocalModels=true;
  hf.env.allowRemoteModels=false;
  hf.env.useBrowserCache=false;
  hf.env.useCustomCache=true;
  hf.env.customCache=cacheAdapter(cache,spec);
  if(hf.env.backends?.onnx?.wasm)hf.env.backends.onnx.wasm.wasmPaths='/app/vendor/transformers/wasm/';
}
async function gpuProfile(){
  if(!self.navigator?.gpu)throw new Error('WebGPU is unavailable in this worker.');
  const adapter=await self.navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  if(!adapter)throw new Error('WebGPU is exposed by the browser, but no GPU adapter could be created.');
  const info=adapter.info||{};
  return{
    available:true,
    shaderF16:Boolean(adapter.features?.has?.('shader-f16')),
    vendor:clean(info.vendor||'',120),architecture:clean(info.architecture||'',120),device:clean(info.device||'',120),description:clean(info.description||'',180),
    maxBufferSize:Number(adapter.limits?.maxBufferSize||0),maxStorageBufferBindingSize:Number(adapter.limits?.maxStorageBufferBindingSize||0)
  };
}
async function ensure(spec,id){
  if(loaded?.id===spec.id&&tokenizer&&model)return{tokenizer,model,load:{coldStart:false,resident:true,runtimeLoadMs:0,gpuProbeMs:0,tokenizerLoadMs:0,modelLoadMs:0,warmupMs:0,coldStartMs:0,gpu:residentLoad?.gpu||null}};
  if(loading)return loading;
  loading=(async()=>{
    const allStarted=clock();
    const runtimeStarted=clock();
    const hf=hfRuntime||(hfRuntime=await import(TRANSFORMERS));
    const runtimeLoadMs=Math.round(clock()-runtimeStarted);
    const cache=await caches.open(CACHE);await configureRuntime(hf,cache,spec);
    phase(id,'checking-gpu',allStarted,{model:spec.id});
    const gpuStarted=clock(),gpu=await gpuProfile(),gpuProbeMs=Math.round(clock()-gpuStarted);
    phase(id,'loading-tokenizer',allStarted,{model:spec.id,gpu});
    const tokenizerStarted=clock();
    tokenizer=await hf.AutoTokenizer.from_pretrained(spec.repo,{revision:spec.revision,progress_callback:progress=>phase(id,'loading-tokenizer',allStarted,{model:spec.id,...progress})});
    const tokenizerLoadMs=Math.round(clock()-tokenizerStarted);
    phase(id,'loading-model',allStarted,{model:spec.id});
    const modelStarted=clock();
    model=await hf.AutoModelForCausalLM.from_pretrained(spec.repo,{revision:spec.revision,device:spec.device,dtype:spec.dtype,progress_callback:progress=>phase(id,'loading-model',allStarted,{model:spec.id,...progress})});
    const modelLoadMs=Math.round(clock()-modelStarted);
    phase(id,'warming-model',allStarted,{model:spec.id});
    const warmStarted=clock();
    const warmInputs=tokenizer('a');
    await model.generate({...warmInputs,max_new_tokens:1,do_sample:false});
    const warmupMs=Math.round(clock()-warmStarted);
    const coldStartMs=Math.round(clock()-allStarted);
    loaded={id:spec.id,repo:spec.repo,revision:spec.revision};
    residentLoad={coldStart:true,resident:false,runtimeLoadMs,gpuProbeMs,tokenizerLoadMs,modelLoadMs,warmupMs,coldStartMs,gpu};
    phase(id,'model-ready',allStarted,{model:spec.id,...residentLoad});
    return{tokenizer,model,load:{...residentLoad}};
  })().catch(error=>{tokenizer=null;try{model?.dispose?.()}catch{}model=null;loaded=null;throw error}).finally(()=>{loading=null});
  return loading;
}
function parseJsonLoose(text){const source=clean(text).replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();for(let start=0;start<source.length;start++){if(source[start]!=='{'&&source[start]!=='[')continue;const open=source[start],close=open==='{'?'}':']';let depth=0,quoted=false,escaped=false;for(let i=start;i<source.length;i++){const c=source[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}if(c==='"'){quoted=true;continue}if(c===open)depth++;else if(c===close&&--depth===0){try{return JSON.parse(source.slice(start,i+1))}catch{break}}}}return null}
function promptTokenCount(inputs){const dims=inputs?.input_ids?.dims;if(Array.isArray(dims)&&dims.length)return Number(dims[dims.length-1])||0;try{return Number(inputs?.input_ids?.tolist?.()?.[0]?.length||0)}catch{return 0}}
function generatedIds(sequences,promptTokens){try{const rows=sequences?.tolist?.();return Array.isArray(rows?.[0])?rows[0].slice(promptTokens):[]}catch{return[]}}
function makeStreamer(tok,id,requested,timing){
  if(!hfRuntime?.TextStreamer)return null;
  return new hfRuntime.TextStreamer(tok,{
    skip_prompt:true,skip_special_tokens:true,
    callback_function:text=>{const value=clean(text,12000);if(!value)return;timing.decoded+=value;if(requested)post(id,'token',{token:{text:value,index:timing.chunkIndex++}})},
    token_callback_function:tokens=>{const n=Array.isArray(tokens)||ArrayBuffer.isView(tokens)?tokens.length:1;if(!timing.firstTokenAt)timing.firstTokenAt=clock();timing.generatedTokens+=Math.max(1,n||1)}
  });
}
async function generate(message,id){
  const spec=message.spec,requestStarted=clock();
  const instance=await ensure(spec,id),tok=instance.tokenizer,causal=instance.model;
  phase(id,'preparing-prompt',requestStarted,{model:spec.id,thinking:Boolean(message.thinking)});
  const promptStarted=clock();
  const inputs=tok.apply_chat_template(message.messages||[],{add_generation_prompt:true,return_dict:true,enable_thinking:Boolean(message.thinking)});
  const promptPrepareMs=Math.round(clock()-promptStarted),promptTokens=promptTokenCount(inputs),contextWindowTokens=Number(spec.contextWindowTokens||0),workingContextTokens=Number(spec.workingContextTokens||0);
  const maxNewTokens=Math.max(8,Math.min(4096,Number(message.maxNewTokens||256)));
  if(contextWindowTokens&&promptTokens+maxNewTokens>contextWindowTokens)throw Object.assign(new Error(`Prompt is ${promptTokens.toLocaleString()} tokens and asks for ${maxNewTokens.toLocaleString()} more, beyond ${spec.label}'s ${contextWindowTokens.toLocaleString()}-token model window.`),{code:'LOCAL_MODEL_CONTEXT_EXCEEDED'});
  if(workingContextTokens&&promptTokens>workingContextTokens)phase(id,'context-warning',requestStarted,{model:spec.id,promptTokens,workingContextTokens,contextWindowTokens});
  const generationStarted=clock(),timing={firstTokenAt:0,generatedTokens:0,chunkIndex:0,decoded:''};
  const streamer=makeStreamer(tok,id,Boolean(message.stream),timing);
  const temperature=Math.max(.01,Math.min(2,Number(message.temperature??(message.thinking?.6:.7))));
  const options={...inputs,max_new_tokens:maxNewTokens,do_sample:true,temperature,top_k:Number(spec.generation?.topK||20),return_dict_in_generate:true};
  if(streamer)options.streamer=streamer;
  phase(id,'generating',requestStarted,{model:spec.id,streaming:Boolean(message.stream),thinking:Boolean(message.thinking),promptTokens,maxNewTokens,contextWindowTokens,workingContextTokens});
  const generated=await causal.generate(options);
  const completed=clock(),generationMs=Math.round(completed-generationStarted),ttftMs=timing.firstTokenAt?Math.round(timing.firstTokenAt-generationStarted):null;
  const ids=generatedIds(generated?.sequences,promptTokens);
  let text='';try{text=clean(tok.decode(ids,{skip_special_tokens:true})).trim()}catch{}
  if(!text)text=clean(timing.decoded).trim();
  const generatedTokens=ids.length||timing.generatedTokens;
  const decodeWindowMs=timing.firstTokenAt?Math.max(1,completed-timing.firstTokenAt):generationMs;
  const tokensPerSecond=generatedTokens?Number((generatedTokens/(Math.max(1,decodeWindowMs)/1000)).toFixed(2)):0;
  const metrics={...instance.load,promptPrepareMs,promptTokens,contextWindowTokens,workingContextTokens,maxNewTokens,thinking:Boolean(message.thinking),generationMs,ttftMs,generatedTokens,tokensPerSecond,totalMs:Math.round(completed-requestStarted),gpu:instance.load.gpu||residentLoad?.gpu||null};
  return{text,json:parseJsonLoose(text),model:loaded,streamed:Boolean(message.stream&&streamer),streamRequested:Boolean(message.stream),metrics};
}
self.addEventListener('message',async event=>{
  const message=event.data||{},id=message.id;if(!id)return;
  try{
    if(message.type==='shutdown'){try{model?.dispose?.()}catch{}tokenizer=null;model=null;loaded=null;residentLoad=null;post(id,'done',{result:{shutdown:true}});return}
    if(message.type!=='generate')throw new Error(`Unsupported local-model worker request: ${message.type}`);
    post(id,'progress',{progress:{phase:'starting',model:message.spec?.id||''}});
    const result=await generate(message,id);post(id,'done',{result});
  }catch(error){post(id,'error',{error:{message:friendlyError(error,message.spec,error?.code==='LOCAL_MODEL_CONTEXT_EXCEEDED'?'context check':'inference'),name:error?.name||'Error',code:error?.code||'LOCAL_MODEL_FAILED',stack:clean(error?.stack,4000)}})}
});
