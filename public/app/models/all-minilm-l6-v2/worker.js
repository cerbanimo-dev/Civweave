import { pipeline, env } from '/app/vendor/transformers/transformers.min.js';

const MODEL_ID='all-minilm-l6-v2';
const MODEL_ROOT='/app/models/';
const INDEX_URL='/app/models/all-minilm-l6-v2/reflex-index.json';
const PRECOMPUTED_VECTORS_URL='/app/models/all-minilm-l6-v2/reflex-vectors.json';
const BACKEND_VERSION='onnx-r14-lazy-index';
const BACKEND_ROOT=new URL('/app/vendor/transformers/wasm/',self.location.origin).href;
const BACKEND_MJS=new URL(`ort-wasm-simd-threaded.jsep.mjs?v=${BACKEND_VERSION}`,BACKEND_ROOT).href;
const BACKEND_WASM=new URL(`ort-wasm-simd-threaded.jsep.wasm?v=${BACKEND_VERSION}`,BACKEND_ROOT).href;
const VECTOR_DB='commonweave-semantic-cache-v1';
const VECTOR_STORE='reflex-vectors';
const EMBEDDING_DIMENSIONS=384;
const REQUEST_BATCH_SIZE=4;
const INDEX_BATCH_SIZE=1;
let statePromise=null,stateProfileKey='';
let indexPromise=null,indexProfileKey='';
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
async function fromDevicePackage(url,{optional=false}={}){
  const response=await caches.match(url,{ignoreSearch:true});
  if(response)return response;
  if(optional)return null;
  throw new Error(`${new URL(url,self.location.origin).pathname} is missing from the installed device package.`);
}
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
async function pause(ms=0){await new Promise(resolve=>setTimeout(resolve,ms))}
async function embedBatches(id,extractor,texts,{phase='embedding',batchSize=REQUEST_BATCH_SIZE,yieldMs=0}={}){
  const rows=[];
  for(let start=0;start<texts.length;start+=batchSize){
    const batch=texts.slice(start,start+batchSize);
    progress(id,{status:phase,completed:start,total:texts.length,batchSize:batch.length});
    const output=await extractor(batch,{pooling:'mean',normalize:true});
    const values=output.tolist();
    output.dispose?.();
    rows.push(...values);
    await pause(yieldMs);
  }
  progress(id,{status:phase,completed:texts.length,total:texts.length,batchSize:0});
  return rows;
}
function stableHash(value){let hash=2166136261;for(let index=0;index<value.length;index+=1){hash^=value.charCodeAt(index);hash=Math.imul(hash,16777619)}return(hash>>>0).toString(16).padStart(8,'0')}
function indexSignature(index){const entries=Array.isArray(index?.entries)?index.entries:[];return stableHash(`${index?.schema||''}\n${entries.map(entry=>`${entry.id||''}\n${entry.embeddingText||''}`).join('\n\u241e\n')}`)}
function vectorKey(index,profile){return`${MODEL_ID}:${index?.schema||'unknown'}:${indexSignature(index)}:${profileKey(profile)}:${EMBEDDING_DIMENSIONS}`}
function validVectors(vectors,count){return Array.isArray(vectors)&&vectors.length===count&&vectors.every(row=>Array.isArray(row)&&row.length===EMBEDDING_DIMENSIONS&&row.every(Number.isFinite))}
function openVectorDb(){
  if(!('indexedDB'in self))return Promise.resolve(null);
  return new Promise((resolve,reject)=>{const request=indexedDB.open(VECTOR_DB,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(VECTOR_STORE))db.createObjectStore(VECTOR_STORE,{keyPath:'key'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Could not open the semantic vector cache.'))});
}
async function readVectorRecord(key){const db=await openVectorDb().catch(()=>null);if(!db)return null;try{return await new Promise((resolve,reject)=>{const request=db.transaction(VECTOR_STORE,'readonly').objectStore(VECTOR_STORE).get(key);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error)})}finally{db.close()}}
async function writeVectorRecord(record){const db=await openVectorDb().catch(()=>null);if(!db)return false;try{await new Promise((resolve,reject)=>{const request=db.transaction(VECTOR_STORE,'readwrite').objectStore(VECTOR_STORE).put(record);request.onsuccess=()=>resolve(true);request.onerror=()=>reject(request.error)});return true}catch{return false}finally{db.close()}}
async function loadIndexDefinition(){const index=await fromDevicePackage(INDEX_URL).then(response=>response.json());return{index,entries:Array.isArray(index.entries)?index.entries:[]}}
async function loadPrecomputedVectors(index,profile){
  const response=await fromDevicePackage(PRECOMPUTED_VECTORS_URL,{optional:true});if(!response)return null;
  try{const payload=await response.json(),key=vectorKey(index,profile);if(payload?.key===key&&validVectors(payload.vectors,index.entries.length))return{vectors:payload.vectors,source:'precomputed-package',key}}catch{}
  return null;
}
async function loadCachedVectors(index,profile){
  const precomputed=await loadPrecomputedVectors(index,profile);if(precomputed)return precomputed;
  const key=vectorKey(index,profile),record=await readVectorRecord(key);if(record&&validVectors(record.vectors,index.entries.length))return{vectors:record.vectors,source:'indexeddb',key};
  return{vectors:null,source:'cold',key};
}
async function inspectIndex(profile){const definition=await loadIndexDefinition();const cached=await loadCachedVectors(definition.index,profile);return{...definition,...cached,cached:Boolean(cached.vectors)}}
async function load(id,requestedProfile){
  const profile=validateProfile(requestedProfile),key=profileKey(profile);
  if(statePromise){
    if(stateProfileKey!==key){const error=new Error(`MiniLM is already starting with ${stateProfileKey}; refusing a second backend in the same worker.`);error.code='MINILM_PROFILE_CONFLICT';throw error}
    return statePromise;
  }
  stateProfileKey=key;
  statePromise=(async()=>{const backend=await configure(id,profile);const loaded=await createExtractor(id,profile);return{...loaded,backend,profile}})().catch(error=>{statePromise=null;stateProfileKey='';throw error});
  return statePromise;
}
async function ensureIndexVectors(id,state){
  const key=profileKey(state.profile);
  if(indexPromise){if(indexProfileKey!==key){const error=new Error(`Reflex vectors are already loading for ${indexProfileKey}.`);error.code='MINILM_INDEX_PROFILE_CONFLICT';throw error}return indexPromise}
  indexProfileKey=key;
  indexPromise=(async()=>{
    const current=await inspectIndex(state.profile);
    if(current.cached){progress(id,{status:'index-cache-ready',source:current.source,total:current.entries.length});return current}
    progress(id,{status:'index-cache-miss',total:current.entries.length});
    const vectors=await embedBatches(id,state.extractor,current.entries.map(entry=>entry.embeddingText),{phase:'index-embedding',batchSize:INDEX_BATCH_SIZE,yieldMs:16});
    const stored=await writeVectorRecord({key:current.key,model:MODEL_ID,indexSchema:current.index.schema,indexSignature:indexSignature(current.index),profile:state.profile,dimensions:EMBEDDING_DIMENSIONS,vectors,createdAt:new Date().toISOString()});
    progress(id,{status:'index-cache-written',stored,total:current.entries.length});
    return{...current,vectors,source:stored?'indexeddb-new':'memory',cached:false};
  })().catch(error=>{indexPromise=null;indexProfileKey='';throw error});
  return indexPromise;
}
async function embed(id,extractor,texts){return embedBatches(id,extractor,texts,{phase:'request-embedding',batchSize:Math.min(REQUEST_BATCH_SIZE,Math.max(1,texts.length)),yieldMs:0})}
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
  const message=event.data||{};if(!message.id)return;
  try{
    const state=await load(message.id,message.profile);
    if(message.type==='prewarm'){
      const index=await inspectIndex(state.profile);
      self.postMessage({id:message.id,type:'ready',device:state.device,dtype:state.dtype,count:index.entries.length,backend:state.backend,profile:state.profile,index:{cached:index.cached,source:index.source,key:index.key}});return;
    }
    if(message.type==='match'){
      const index=await ensureIndexVectors(message.id,state);
      const [vector]=await embed(message.id,state.extractor,[String(message.text||'').slice(0,4000)]);
      const matches=index.entries.map((entry,indexPosition)=>({id:entry.id,system:entry.system,score:cosine(vector,index.vectors[indexPosition])})).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(8,Number(message.limit||5))));
      self.postMessage({id:message.id,type:'match',device:state.device,dtype:state.dtype,matches,indexSource:index.source});return;
    }
    if(message.type==='rank'){
      const matches=await rankedCandidates(message.id,state,message);
      self.postMessage({id:message.id,type:'rank',device:state.device,dtype:state.dtype,matches});return;
    }
    throw new Error(`Unknown MiniLM worker request: ${message.type}`);
  }catch(error){self.postMessage({id:message.id,type:'error',error:serialize(error)})}
});
