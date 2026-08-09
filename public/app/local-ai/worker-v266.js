'use strict';
const CACHE='civweave-model-generative-v266';
const TRANSFORMERS='/app/vendor/transformers/transformers.min.js';
let pipe=null,loaded=null,loading=null;
const clean=(value,max=200000)=>String(value??'').slice(0,max);
function post(id,type,payload={}){self.postMessage({id,type,...payload})}
function extractGenerated(output){const row=Array.isArray(output)?output[0]:output;const generated=row?.generated_text;if(typeof generated==='string')return generated;if(Array.isArray(generated)){const last=generated.at(-1);return typeof last==='string'?last:clean(last?.content||last?.text)}return clean(row?.text||row?.content||generated)}
function requestUrl(input){try{return typeof input==='string'?input:input?.url||String(input)}catch{return String(input||'')}}
function pinnedRemoteRoot(spec){return `https://huggingface.co/${spec.repo}/resolve/${encodeURIComponent(spec.revision)}/`}
async function validatedHit(cache,key,response){
  if(!response?.ok)return null;
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(type.includes('text/html')){try{await cache.delete(key)}catch{}return null}
  if(/\.json(?:$|[?#])/i.test(key)){
    try{const text=await response.clone().text();if(!text.trim())throw new Error('empty json');JSON.parse(text)}catch{try{await cache.delete(key)}catch{}return null}
  }
  return response.clone();
}
function cacheAdapter(cache,spec){
  const localPrefix=`/models/${spec.repo}/`,remotePrefix=pinnedRemoteRoot(spec);
  const miss=()=>new Response('',{status:404,statusText:'Downloaded model cache miss'});
  return{
    async match(request){
      const key=requestUrl(request);
      if(key.startsWith(localPrefix)){
        const remote=remotePrefix+key.slice(localPrefix.length),hit=await validatedHit(cache,remote,await cache.match(remote));
        return hit||miss();
      }
      if(key.startsWith(remotePrefix)){
        const hit=await validatedHit(cache,key,await cache.match(key));
        return hit||miss();
      }
      try{return await validatedHit(cache,key,await cache.match(request))||undefined}catch{return undefined}
    },
    put(request,response){return cache.put(request,response)}
  };
}
function friendlyError(error,spec){const raw=String(error?.message||error);if(/Unexpected (?:end of JSON input|token .*JSON)/i.test(raw))return `Downloaded model metadata is invalid for ${spec?.label||spec?.id||'the selected model'}. Civweave will repair the damaged metadata files when online.`;if(raw.includes('/models/')&&(raw.includes('env.allowRemoteModels=false')||raw.includes('local_files_only=true')))return `Downloaded model cache miss for ${spec?.label||spec?.id||'the selected model'}. Open AI Settings and tap Resume so Civweave can repair the missing files.`;return raw}
async function configureRuntime(hf,cache,spec){
  hf.env.allowLocalModels=true;
  hf.env.allowRemoteModels=false;
  hf.env.useBrowserCache=false;
  hf.env.useCustomCache=true;
  hf.env.customCache=cacheAdapter(cache,spec);
  if(hf.env.backends?.onnx?.wasm)hf.env.backends.onnx.wasm.wasmPaths='/app/vendor/transformers/wasm/';
}
async function ensure(spec,id){if(loaded?.id===spec.id&&pipe)return pipe;if(loading)return loading;loading=(async()=>{const hf=await import(TRANSFORMERS);const cache=await caches.open(CACHE);await configureRuntime(hf,cache,spec);post(id,'progress',{progress:{phase:'loading-runtime',model:spec.id}});pipe=await hf.pipeline(spec.task,spec.repo,{revision:spec.revision,device:spec.device,dtype:spec.dtype,progress_callback:progress=>post(id,'progress',{progress:{phase:'loading-model',model:spec.id,...progress}})});loaded={id:spec.id,repo:spec.repo,revision:spec.revision};return pipe})().finally(()=>{loading=null});return loading}
function parseJsonLoose(text){const source=clean(text).replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();for(let start=0;start<source.length;start++){if(source[start]!=='{'&&source[start]!=='[')continue;const open=source[start],close=open==='{'?'}':']';let depth=0,quoted=false,escaped=false;for(let i=start;i<source.length;i++){const c=source[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}if(c==='"'){quoted=true;continue}if(c===open)depth++;else if(c===close&&--depth===0){try{return JSON.parse(source.slice(start,i+1))}catch{break}}}}return null}
self.addEventListener('message',async event=>{const message=event.data||{},id=message.id;if(!id)return;try{if(message.type==='shutdown'){pipe=null;loaded=null;post(id,'done',{result:{shutdown:true}});return}if(message.type!=='generate')throw new Error(`Unsupported local-model worker request: ${message.type}`);if(!self.navigator?.gpu)throw new Error('WebGPU is unavailable in this worker.');const generator=await ensure(message.spec,id);const options={max_new_tokens:Math.max(16,Math.min(4096,Number(message.maxNewTokens||1024))),do_sample:Number(message.temperature||0)>0,temperature:Math.max(.01,Math.min(2,Number(message.temperature||.2))),top_p:.95};post(id,'progress',{progress:{phase:'generating',model:message.spec.id}});const output=await generator(message.messages||[],options);const text=extractGenerated(output),json=parseJsonLoose(text);post(id,'done',{result:{text,json,model:loaded}})}catch(error){post(id,'error',{error:{message:friendlyError(error,message.spec),name:error?.name||'Error',stack:clean(error?.stack,4000)}})}});
