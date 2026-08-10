'use strict';
const CACHE='civweave-model-generative-v266';
const TRANSFORMERS='/app/vendor/transformers/transformers.min.js';
let pipe=null,loaded=null,loading=null,hfRuntime=null;
const clean=(value,max=200000)=>String(value??'').slice(0,max);
function post(id,type,payload={}){self.postMessage({id,type,...payload})}
function extractGenerated(output){const row=Array.isArray(output)?output[0]:output;const generated=row?.generated_text;if(typeof generated==='string')return generated;if(Array.isArray(generated)){const last=generated.at(-1);return typeof last==='string'?last:clean(last?.content||last?.text)}return clean(row?.text||row?.content||generated)}
function requestUrl(input){try{return typeof input==='string'?input:input?.url||String(input)}catch{return String(input||'')}}
function pinnedRemoteRoot(spec){return `https://huggingface.co/${spec.repo}/resolve/${encodeURIComponent(spec.revision)}/`}
function cacheAdapter(cache,spec){
  const localPrefix=`/models/${spec.repo}/`,remotePrefix=pinnedRemoteRoot(spec);
  const miss=()=>new Response('',{status:404,statusText:'Downloaded model cache miss'});
  return{
    async match(request){
      const key=requestUrl(request);
      if(key.startsWith(localPrefix)){
        const remote=remotePrefix+key.slice(localPrefix.length),hit=await cache.match(remote);
        return hit?.ok?hit.clone():miss();
      }
      if(key.startsWith(remotePrefix)){
        const hit=await cache.match(key);
        return hit?.ok?hit.clone():miss();
      }
      try{const hit=await cache.match(request);return hit?.ok?hit.clone():undefined}catch{return undefined}
    },
    put(request,response){return cache.put(request,response)}
  };
}
function friendlyError(error,spec){const raw=String(error?.message||error);if(raw.includes('/models/')&&(raw.includes('env.allowRemoteModels=false')||raw.includes('local_files_only=true')))return `Downloaded model cache miss for ${spec?.label||spec?.id||'the selected model'}. Re-download this model while online before using it offline.`;if(/Unexpected end of JSON input|Unexpected token\s*['"]?<|<!doctype|not valid JSON/i.test(raw))return `Downloaded model metadata is missing, truncated, or invalid for ${spec?.label||spec?.id||'the selected model'}. Civweave now treats runtime JSON metadata as required and repairs only the missing or invalid metadata file. Reopen model settings while online, then test the model again.\n\nTransport detail: ${raw}`;return raw}
async function configureRuntime(hf,cache,spec){
  hf.env.allowLocalModels=true;
  hf.env.allowRemoteModels=false;
  hf.env.useBrowserCache=false;
  hf.env.useCustomCache=true;
  hf.env.customCache=cacheAdapter(cache,spec);
  if(hf.env.backends?.onnx?.wasm)hf.env.backends.onnx.wasm.wasmPaths='/app/vendor/transformers/wasm/';
}
async function ensure(spec,id){if(loaded?.id===spec.id&&pipe)return pipe;if(loading)return loading;loading=(async()=>{const hf=hfRuntime||(hfRuntime=await import(TRANSFORMERS));const cache=await caches.open(CACHE);await configureRuntime(hf,cache,spec);post(id,'progress',{progress:{phase:'loading-runtime',model:spec.id}});pipe=await hf.pipeline(spec.task,spec.repo,{revision:spec.revision,device:spec.device,dtype:spec.dtype,progress_callback:progress=>post(id,'progress',{progress:{phase:'loading-model',model:spec.id,...progress}})});loaded={id:spec.id,repo:spec.repo,revision:spec.revision};return pipe})().finally(()=>{loading=null});return loading}
function parseJsonLoose(text){const source=clean(text).replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();for(let start=0;start<source.length;start++){if(source[start]!=='{'&&source[start]!=='[')continue;const open=source[start],close=open==='{'?'}':']';let depth=0,quoted=false,escaped=false;for(let i=start;i<source.length;i++){const c=source[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}if(c==='"'){quoted=true;continue}if(c===open)depth++;else if(c===close&&--depth===0){try{return JSON.parse(source.slice(start,i+1))}catch{break}}}}return null}
function makeStreamer(generator,id,requested){
  if(!requested||!hfRuntime?.TextStreamer||!generator?.tokenizer)return null;
  let index=0;
  return new hfRuntime.TextStreamer(generator.tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:text=>{const value=clean(text,12000);if(value)post(id,'token',{token:{text:value,index:index++}})}});
}
self.addEventListener('message',async event=>{const message=event.data||{},id=message.id;if(!id)return;try{if(message.type==='shutdown'){pipe=null;loaded=null;post(id,'done',{result:{shutdown:true}});return}if(message.type!=='generate')throw new Error(`Unsupported local-model worker request: ${message.type}`);if(!self.navigator?.gpu)throw new Error('WebGPU is unavailable in this worker.');const generator=await ensure(message.spec,id);const options={max_new_tokens:Math.max(16,Math.min(4096,Number(message.maxNewTokens||1024))),do_sample:Number(message.temperature||0)>0,temperature:Math.max(.01,Math.min(2,Number(message.temperature||.2))),top_p:.95};const streamer=makeStreamer(generator,id,Boolean(message.stream));if(streamer)options.streamer=streamer;post(id,'progress',{progress:{phase:'generating',model:message.spec.id,streaming:Boolean(streamer)}});const output=await generator(message.messages||[],options);const text=extractGenerated(output),json=parseJsonLoose(text);post(id,'done',{result:{text,json,model:loaded,streamed:Boolean(streamer),streamRequested:Boolean(message.stream)}})}catch(error){post(id,'error',{error:{message:friendlyError(error,message.spec),name:error?.name||'Error',stack:clean(error?.stack,4000)}})}});
