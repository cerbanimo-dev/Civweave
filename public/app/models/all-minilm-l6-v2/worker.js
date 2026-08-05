import { pipeline, env } from '/app/vendor/transformers/transformers.min.js';

const MODEL_ID='all-minilm-l6-v2';
const MODEL_ROOT='/app/models/';
const INDEX_URL='/app/models/all-minilm-l6-v2/reflex-index.json';
const BACKEND_VERSION='onnx-r13-safe-session';
const BACKEND_ROOT=new URL('/app/vendor/transformers/wasm/',self.location.origin).href;
const BACKEND_MJS=new URL(`ort-wasm-simd-threaded.jsep.mjs?v=${BACKEND_VERSION}`,BACKEND_ROOT).href;
const BACKEND_WASM=new URL(`ort-wasm-simd-threaded.jsep.wasm?v=${BACKEND_VERSION}`,BACKEND_ROOT).href;
const EMBED_BATCH_SIZE=4;
let statePromise=null,stateProfileKey='';
const rankCache=new Map();

function serialize(error){
  const raw=String(error?.message||error||'MiniLM worker error');
  const numeric=typeof error==='number'||/^\d+$/.test(raw);
  return{message:numeric?`ONNX Runtime aborted during session creation (numeric exception ${raw}).`:raw,code:error?.code||null,stack:String(error?.stack||'').slice(0,3000)};
}
function cosine(a,b){let dot=0,aa=0,bb=0;const n=Math.min(a.length,b.length);for(let i=0;i<n;i+=1){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return dot/(Math.sqrt(aa)*Math.sqrt(bb)||1)}
function profileKey(profile){return`${profile?.device||''}:${profile?.dtype||''}`}
function validateProfile(profile){
  const device=String(profile?.device||''),dtype=String(profile?.dtype||'');
  if(device==='webgpu'&&dtype==='q4f16'){
    if(!navigator.gpu){const error=new Error('WebGPU is unavailable in this worker.');error.code='MINILM_WEBGPU_UNAVAILABLE';throw error}
    return{device,dtype};
  }
  if(device==='wasm'&&dtype==='q8')return{device,dtype};
  const error=new Error(`Unsupported MiniLM execution profile: ${device||'none'} / ${dtype||'none'}.`);error.code='MINILM_PROFILE_UNSUPPORTED';throw error;
}
async function fromDevicePackage(url){const response=await caches.match(url,{ignoreSearch:true});if(!response)throw new Error(`${new URL(url).pathname} is missing from the installed device package.`);return response}
async function verifyLoader(url){
  const response=await fromDevicePackage(url);
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(!/(javascript|ecmascript|module)/.test(type))throw new Error(`ONNX loader MIME is ${type||'unknown'}`);
  const body=await response.text();
  if(body.length<10000)throw new Error(`ONNX loader payload is only ${body.length} bytes`);
  return{url,type,bytes:body.length,source:'cache-storage'};
}
async function prefix(response,count=4){
  const reader=response.body?.getReader?.();if(!reader)return new Uint8Array((await response.arrayBuffer()).slice(0,count));
  const output=new Uint8Array(count);let offset=0;
  try{while(offset<count){const part=await reader.read();if(part.done)break;const value=part.value||new Uint8Array();const take=Math.min(value.length,count-offset);output.set(value.slice(0,take),offset);offset+=take}}finally{await reader.cancel().catch(()=>{})}
  return output.slice(0,offset);
}
async function verifyWasm(url){
  const response=await fromDevicePackage(url);
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(!/^application\/wasm(?:;|$)/.test(type))throw new Error(`ONNX binary MIME is ${type||'unknown'}`);
  const bytes=await prefix(response.clone(),4);
  if(bytes.length<4||bytes[0]!==0||bytes[1]!==97||bytes[2]!==115||bytes[3]!==109)throw new Error('ONNX binary does not begin with the WebAssembly magic bytes');
  const total=Number(response.headers.get('content-length')||0)||1000000;
  if(total<1000000)throw new Error(`ONNX binary payload is only ${total} bytes`);
  return{url,type,bytes:total,magic:'0061736d',source:'cache-storage'};
}
function progress(id,payload){self.postMessage({id,type:'progress',progress:payload})}
async function configure(id,profile){
  env.allowRemoteModels=false;
  env.allowLocalModels=true;
  env.localModelPath=MODEL_ROOT;
  env.useBrowserCache=false;
  env.useWasmCache=true;
  env.cacheKey=`commonweave-minilm-${BACKEND_VERSION}`;
  if(env.backends?.onnx?.wasm){
    env.backends.onnx.wasm.wasmPaths=BACKEND_ROOT;
    env.backends.onnx.wasm.proxy=false;
    env.backends.onnx.wasm.numThreads=1;
    env.backends.onnx.wasm.initTimeout=30000;
  }
  const [loader,wasm]=await Promise.all([verifyLoader(BACKEND_MJS),verifyWasm(BACKEND_WASM)]);
  progress(id,{status:'backend-verified',profile,loaderBytes:loader.bytes,wasmBytes:wasm.bytes,wasmMagic:wasm.magic,source:'installed-device-package'});
  return{loader,wasm,profile};
}
async function createExtractor(id,profile){
  progress(id,{status:'backend-start',...profile});
  const extractor=await pipeline('feature-extraction',MODEL_ID,{...profile,local_files_only:true,progress_callback(value){progress(id,{...value,...profile})}});
  progress(id,{status:'session-ready',...profile});
  return{extractor,...profile};
}
async function pause(){await new Promise(resolve=>setTimeout(resolve,0))}
async function embedBatches(id,extractor,texts,{phase='embedding',batchSize=EMBED_BATCH_SIZE}={}){
  const rows=[];
  for(let start=0;start<texts.length;start+=batchSize){
    const batch=texts.slice(start,start+batchSize);
    progress(id,{status:phase,completed:start,total:texts.length,batchSize:batch.length});
    const output=await extractor(batch,{pooling:'mean',normalize:true});
    const values=output.tolist();
    output.dispose?.();
    rows.push(...values);
    await pause();
  }
  progress(id,{status:phase,completed:texts.length,total:texts.length,batchSize:0});
  return rows;
}
async function load(id,requestedProfile){
  const profile=validateProfile(requestedProfile),key=profileKey(profile);
  if(statePromise){
    if(stateProfileKey!==key){const error=new Error(`MiniLM is already starting with ${stateProfileKey}; refusing a second backend in the same worker.`);error.code='MINILM_PROFILE_CONFLICT';throw error}
    return statePromise;
  }
  stateProfileKey=key;
  statePromise=(async()=>{
    const backend=await configure(id,profile);
    const loaded=await createExtractor(id,profile);
    const index=await fromDevicePackage(INDEX_URL).then(response=>response.json());
    const entries=Array.isArray(index.entries)?index.entries:[];
    const vectors=await embedBatches(id,loaded.extractor,entries.map(entry=>entry.embeddingText),{phase:'index-embedding'});
    return{...loaded,backend,entries,vectors,profile};
  })().catch(error=>{statePromise=null;stateProfileKey='';throw error});
  return statePromise;
}
async function embed(id,extractor,texts){return embedBatches(id,extractor,texts,{phase:'request-embedding',batchSize:Math.min(EMBED_BATCH_SIZE,Math.max(1,texts.length))})}
async function rankedCandidates(id,state,message){
  const candidates=(Array.isArray(message.candidates)?message.candidates:[]).slice(0,64).map((item,index)=>({id:String(item?.id||`candidate-${index+1}`).slice(0,180),text:String(item?.text||'').trim().slice(0,3000)})).filter(item=>item.text);
  if(!candidates.length)return[];
  const cacheKey=String(message.cacheKey||'').slice(0,240);
  const signature=candidates.map(item=>`${item.id}\n${item.text}`).join('\u241e');
  const cached=cacheKey?rankCache.get(cacheKey):null;
  let vectors=cached?.signature===signature?cached.vectors:null;
  if(!vectors||vectors.length!==candidates.length){
    vectors=await embed(id,state.extractor,candidates.map(item=>item.text));
    if(cacheKey){rankCache.set(cacheKey,{signature,vectors});while(rankCache.size>12)rankCache.delete(rankCache.keys().next().value)}
  }
  const [query]=await embed(id,state.extractor,[String(message.text||'').slice(0,4000)]);
  return candidates.map((item,index)=>({id:item.id,score:cosine(query,vectors[index])})).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(16,Number(message.limit||8))));
}

self.addEventListener('message',async event=>{
  const message=event.data||{};
  if(!message.id)return;
  try{
    const state=await load(message.id,message.profile);
    if(message.type==='prewarm'){self.postMessage({id:message.id,type:'ready',device:state.device,dtype:state.dtype,count:state.entries.length,backend:state.backend,profile:state.profile});return}
    if(message.type==='match'){
      const [vector]=await embed(message.id,state.extractor,[String(message.text||'').slice(0,4000)]);
      const matches=state.entries.map((entry,index)=>({id:entry.id,system:entry.system,score:cosine(vector,state.vectors[index])})).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(8,Number(message.limit||5))));
      self.postMessage({id:message.id,type:'match',device:state.device,dtype:state.dtype,matches});return;
    }
    if(message.type==='rank'){
      const matches=await rankedCandidates(message.id,state,message);
      self.postMessage({id:message.id,type:'rank',device:state.device,dtype:state.dtype,matches});return;
    }
    throw new Error(`Unknown MiniLM worker request: ${message.type}`);
  }catch(error){self.postMessage({id:message.id,type:'error',error:serialize(error)})}
});
