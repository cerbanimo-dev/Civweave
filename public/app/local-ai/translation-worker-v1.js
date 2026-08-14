'use strict';

const VERSION='translation-worker-v1';
const CACHE='civweave-model-translation-v1';
const TRANSFORMERS='/app/vendor/transformers/transformers.min.js';
const WASM_ROOT='/app/vendor/transformers/wasm/';
let hf=null;
let pipe=null;
let loadedKey='';

const clean=(value,max=12000)=>String(value??'').slice(0,max);
const post=(id,type,payload={})=>self.postMessage(type==='progress'?{type,...payload}:{id,type,ok:type==='result',...payload});
function requestUrl(input){try{return typeof input==='string'?input:input?.url||String(input)}catch{return String(input||'')}}
function remoteUrl(spec,path){return `https://huggingface.co/${spec.repo}/resolve/${encodeURIComponent(spec.revision))}/${path}`}
function cacheAdapter(cache,spec){
  const localPrefix=`/models/${spec.repo}/`;
  const repoPrefix=`https://huggingface.co/${spec.repo}/resolve/`;
  const miss=()=>new Response('',{status:404,statusText:'Downloaded translation pack cache miss'});
  const find=async path=>{const hit=await cache.match(remoteUrl(spec,path));return hit?.ok?hit:miss()};
  return{
    async match(request){
      const key=requestUrl(request);
      if(key.startsWith(localPrefix))return find(key.slice(localPrefix.length));
      if(key.startsWith(repoPrefix)){
        const rest=key.slice(repoPrefix.length),slash=rest.indexOf('/');
        if(slash>=0)return find(rest.slice(slash+1));
      }
      try{const hit=await cache.match(request);return hit?.ok?hit:undefined}catch{return undefined}
    },
    put:(request,response)=>cache.put(request,response)
  };
}
async function runtime(spec){
  if(!hf)hf=await import(TRANSFORMERS);
  hf.env.allowLocalModels=true;
  hf.env.allowRemoteModels=false;
  hf.env.useBrowserCache=false;
  hf.env.useCustomCache=true;
  const cache=await caches.open(CACHE);
  hf.env.customCache=cacheAdapter(cache,spec);
  const wasm=hf.env.backends?.onnx?.wasm;
  if(wasm){
    wasm.wasmPaths=WASM_ROOT;
    wasm.numThreads=self.crossOriginIsolated?Math.max(1,Math.min(4,Math.floor((self.navigator?.hardwareConcurrency||2)/2))):1;
    wasm.simd=true;
  }
  return hf;
}
async function ensure(spec,id){
  const key=`${spec.id}:${spec.revision}`;
  if(pipe&&loadedKey===key)return pipe;
  if(pipe){try{await pipe.dispose?.()}catch{}pipe=null;loadedKey=''}
  const lib=await runtime(spec);
  post(id,'progress',{phase:'loading',model:spec.id});
  pipe=await lib.pipeline('translation',spec.repo,{
    revision:spec.revision,
    device:'wasm',
    dtype:{encoder_model:'q8',decoder_model_merged:'q8'},
    progress_callback:progress=>post(id,'progress',{phase:'loading',model:spec.id,progress})
  });
  loadedKey=key;
  post(id,'progress',{phase:'ready',model:spec.id});
  return pipe;
}
async function translate(id,spec,text){
  const translator=await ensure(spec,id);
  const source=clean(text,12000);
  const result=await translator(source,{max_new_tokens:768});
  const translated=clean(Array.isArray(result)?result[0]?.translation_text:result?.translation_text,12000);
  if(!translated)throw new Error('The local translation model returned no text.');
  post(id,'result',{translation:translated,model:spec.id,version:VERSION});
}
self.addEventListener('message',event=>{
  const message=event.data||{},id=message.id;
  if(!id)return;
  if(message.type==='dispose'){
    Promise.resolve(pipe?.dispose?.()).catch(()=>{}).finally(()=>{pipe=null;loadedKey='';post(id,'result',{disposed:true,version:VERSION})});
    return;
  }
  if(message.type!=='translate')return;
  translate(id,message.spec,message.text).catch(error=>post(id,'error',{error:clean(error?.message||error,2000),version:VERSION}));
});
