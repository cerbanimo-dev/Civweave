import { pipeline, env } from '/app/vendor/transformers/transformers.min.js';

const MODEL_ID='all-minilm-l6-v2';
const MODEL_ROOT='/app/models/';
const INDEX_URL='/app/models/all-minilm-l6-v2/reflex-index.json';
const BACKEND_VERSION='onnx-r12';
const BACKEND_ROOT=new URL('/app/vendor/transformers/wasm/',self.location.origin).href;
const BACKEND_MJS=new URL(`ort-wasm-simd-threaded.jsep.mjs?v=${BACKEND_VERSION}`,BACKEND_ROOT).href;
const BACKEND_WASM=new URL(`ort-wasm-simd-threaded.jsep.wasm?v=${BACKEND_VERSION}`,BACKEND_ROOT).href;
let statePromise=null;

function serialize(error){
  const raw=String(error?.message||error||'MiniLM worker error');
  const numeric=typeof error==='number'||/^\d+$/.test(raw);
  return {message:numeric?`ONNX Runtime aborted during session creation (numeric exception ${raw}).`:raw,code:error?.code||null,stack:String(error?.stack||'').slice(0,3000)};
}
function cosine(a,b){let dot=0,aa=0,bb=0;const n=Math.min(a.length,b.length);for(let i=0;i<n;i+=1){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return dot/(Math.sqrt(aa)*Math.sqrt(bb)||1)}
async function verifyLoader(url){
  const response=await fetch(url,{cache:'reload'});
  if(!response.ok)throw new Error(`ONNX loader returned ${response.status}`);
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(!/(javascript|ecmascript|module)/.test(type))throw new Error(`ONNX loader MIME is ${type||'unknown'}`);
  const body=await response.text();
  if(body.length<10000)throw new Error(`ONNX loader payload is only ${body.length} bytes`);
  return{url,type,bytes:body.length};
}
async function verifyWasm(url){
  const response=await fetch(url,{cache:'reload',headers:{range:'bytes=0-3'}});
  if(!response.ok)throw new Error(`ONNX binary returned ${response.status}`);
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(!/^application\/wasm(?:;|$)/.test(type))throw new Error(`ONNX binary MIME is ${type||'unknown'}`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<4||bytes[0]!==0||bytes[1]!==97||bytes[2]!==115||bytes[3]!==109)throw new Error('ONNX binary does not begin with the WebAssembly magic bytes');
  const contentRange=String(response.headers.get('content-range')||'');
  const rangeTotal=Number(contentRange.match(/\/(\d+)$/)?.[1]||0);
  const total=rangeTotal||Number(response.headers.get('content-length')||0)||bytes.length;
  if(total<1000000)throw new Error(`ONNX binary payload is only ${total} bytes`);
  return{url,type,bytes:total,magic:'0061736d'};
}
async function configure(){
  env.allowRemoteModels=false;
  env.allowLocalModels=true;
  env.localModelPath=MODEL_ROOT;
  env.useBrowserCache=false;
  env.useWasmCache=false;
  env.cacheKey=`commonweave-minilm-${BACKEND_VERSION}`;
  if(env.backends?.onnx?.wasm){
    env.backends.onnx.wasm.wasmPaths=BACKEND_ROOT;
    env.backends.onnx.wasm.proxy=false;
    env.backends.onnx.wasm.numThreads=1;
    env.backends.onnx.wasm.initTimeout=120000;
  }
  const [loader,wasm]=await Promise.all([verifyLoader(BACKEND_MJS),verifyWasm(BACKEND_WASM)]);
  self.postMessage({type:'progress',progress:{status:'backend-verified',loaderBytes:loader.bytes,wasmBytes:wasm.bytes,wasmMagic:wasm.magic}});
  return{loader,wasm};
}
async function createExtractor(device,dtype){
  self.postMessage({type:'progress',progress:{status:'backend-start',device,dtype}});
  const extractor=await pipeline('feature-extraction',MODEL_ID,{device,dtype,local_files_only:true,progress_callback(progress){self.postMessage({type:'progress',progress:{...progress,device,dtype}})}});
  return{extractor,device,dtype};
}
async function load(){
  if(statePromise)return statePromise;
  statePromise=(async()=>{
    const backend=await configure();
    const attempts=navigator.gpu?[['wasm','q8'],['webgpu','q4f16']]:[['wasm','q8']];
    let loaded=null;const failures=[];
    for(const [device,dtype] of attempts){try{loaded=await createExtractor(device,dtype);break}catch(error){failures.push({device,dtype,error:serialize(error)});self.postMessage({type:'progress',progress:{status:'backend-failed',device,dtype,message:serialize(error).message}})}}
    if(!loaded){const error=new Error(`No MiniLM backend initialized. ${failures.map(item=>`[${item.device}] ${item.error.message}`).join(' | ')}`);error.code='MINILM_BACKEND_UNAVAILABLE';error.failures=failures;throw error}
    const index=await fetch(INDEX_URL,{cache:'reload'}).then(response=>{if(!response.ok)throw new Error(`Reflex index returned ${response.status}`);return response.json()});
    const entries=Array.isArray(index.entries)?index.entries:[];
    const output=await loaded.extractor(entries.map(entry=>entry.embeddingText),{pooling:'mean',normalize:true});
    const vectors=output.tolist();
    return{...loaded,backend,entries,vectors};
  })().catch(error=>{statePromise=null;throw error});
  return statePromise;
}

self.addEventListener('message',async event=>{
  const message=event.data||{};
  if(!message.id)return;
  try{
    const state=await load();
    if(message.type==='prewarm'){self.postMessage({id:message.id,type:'ready',device:state.device,dtype:state.dtype,count:state.entries.length,backend:state.backend});return}
    if(message.type==='match'){
      const output=await state.extractor(String(message.text||''),{pooling:'mean',normalize:true});
      const vector=output.tolist()[0];
      const matches=state.entries.map((entry,index)=>({id:entry.id,system:entry.system,score:cosine(vector,state.vectors[index])})).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(8,Number(message.limit||5))));
      self.postMessage({id:message.id,type:'match',device:state.device,dtype:state.dtype,matches});return;
    }
    throw new Error(`Unknown MiniLM worker request: ${message.type}`);
  }catch(error){self.postMessage({id:message.id,type:'error',error:serialize(error)})}
});
