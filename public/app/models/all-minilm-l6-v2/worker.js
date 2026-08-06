import * as ort from '/app/vendor/onnxruntime/ort.wasm.min.mjs';

const MODEL_ID='all-minilm-l6-v2';
const ROOT='/app/models/all-minilm-l6-v2';
const MODEL_URL=`${ROOT}/onnx/model_quantized.onnx`;
const VOCAB_URL=`${ROOT}/vocab.txt`;
const INDEX_URL=`${ROOT}/reflex-index.json`;
const PRECOMPUTED_VECTORS_URL=`${ROOT}/reflex-vectors.json`;
const RUNTIME_MJS='/app/vendor/onnxruntime/ort-wasm-simd-threaded.mjs';
const RUNTIME_WASM='/app/vendor/onnxruntime/ort-wasm-simd-threaded.wasm';
const RUNTIME_MJS_URL=new URL(RUNTIME_MJS,self.location.origin).href;
const RUNTIME_WASM_URL=new URL(RUNTIME_WASM,self.location.origin).href;
const VECTOR_DB='civweave-semantic-cache-v1';
const VECTOR_STORE='reflex-vectors';
const EMBEDDING_DIMENSIONS=384;
const REQUEST_BATCH_SIZE=1;
const INDEX_BATCH_SIZE=1;
const MAX_TOKENS=128;
const FIXED_PROFILE=Object.freeze({device:'wasm',dtype:'q8',runtime:'onnxruntime-web'});
let statePromise=null;
let indexPromise=null;
const rankCache=new Map();

function serialize(error){
  const raw=String(error?.message||error||'MiniLM worker error');
  const numeric=typeof error==='number'||/^\d+$/.test(raw);
  return{message:numeric?`ONNX Runtime aborted during session creation (numeric exception ${raw}).`:raw,code:error?.code||null,stack:String(error?.stack||'').slice(0,3000)};
}
function progress(id,payload){self.postMessage({id,type:'progress',progress:payload})}
function pause(ms=0){return new Promise(resolve=>setTimeout(resolve,ms))}
function cosine(a,b){let dot=0,aa=0,bb=0;const n=Math.min(a.length,b.length);for(let i=0;i<n;i+=1){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return dot/(Math.sqrt(aa)*Math.sqrt(bb)||1)}
function normalize(vector){let sum=0;for(const value of vector)sum+=value*value;const scale=Math.sqrt(sum)||1;return vector.map(value=>value/scale)}
function profileKey(profile){return`${profile?.device||''}:${profile?.dtype||''}:${profile?.runtime||''}`}
async function fromDevicePackage(url,{optional=false}={}){
  const response=await caches.match(url,{ignoreSearch:true});
  if(response)return response;
  if(optional)return null;
  throw new Error(`${new URL(url,self.location.origin).pathname} is missing from the installed device package.`);
}
async function verifyRuntimeAsset(url,{wasm=false}={}){
  const response=await fromDevicePackage(url);
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(/text\/html/.test(type))throw new Error(`${url} resolved to HTML instead of a runtime asset.`);
  if(wasm){
    const bytes=new Uint8Array((await response.clone().arrayBuffer()).slice(0,4));
    if(bytes.length<4||bytes[0]!==0||bytes[1]!==97||bytes[2]!==115||bytes[3]!==109)throw new Error('ONNX Runtime WASM asset has invalid magic bytes.');
  }
  return{url,type,bytes:Number(response.headers.get('content-length')||0),source:'cache-storage'};
}
function isCjk(char){
  const code=char.codePointAt(0)||0;
  return(code>=0x4e00&&code<=0x9fff)||(code>=0x3400&&code<=0x4dbf)||(code>=0x20000&&code<=0x2a6df)||(code>=0x2a700&&code<=0x2b73f)||(code>=0x2b740&&code<=0x2b81f)||(code>=0x2b820&&code<=0x2ceaf)||(code>=0xf900&&code<=0xfaff)||(code>=0x2f800&&code<=0x2fa1f);
}
function cleanText(value){return String(value||'').normalize('NFD').replace(/\p{M}+/gu,'').toLowerCase().replace(/[\u0000\ufffd]/g,' ').replace(/[\t\n\r]+/g,' ')}
function basicTokenize(value){
  const output=[];let current='';
  const flush=()=>{if(current){output.push(current);current=''}};
  for(const char of cleanText(value)){
    if(/\s/u.test(char)){flush();continue}
    if(isCjk(char)){flush();output.push(char);continue}
    if(/[\p{P}\p{S}]/u.test(char)){flush();output.push(char);continue}
    current+=char;
  }
  flush();return output;
}
function createTokenizer(vocabText){
  const vocab=new Map(vocabText.split(/\r?\n/).map((token,index)=>[token,index]));
  const required=['[PAD]','[UNK]','[CLS]','[SEP]'];
  for(const token of required)if(!vocab.has(token))throw new Error(`MiniLM vocabulary is missing ${token}.`);
  const ids=Object.fromEntries(required.map(token=>[token,vocab.get(token)]));
  function wordPiece(token){
    if(vocab.has(token))return[vocab.get(token)];
    const chars=Array.from(token);if(chars.length>100)return[ids['[UNK]']];
    const pieces=[];let start=0;
    while(start<chars.length){
      let end=chars.length,matched=null;
      while(start<end){
        const piece=`${start>0?'##':''}${chars.slice(start,end).join('')}`;
        if(vocab.has(piece)){matched={id:vocab.get(piece),end};break}
        end-=1;
      }
      if(!matched)return[ids['[UNK]']];
      pieces.push(matched.id);start=matched.end;
    }
    return pieces;
  }
  function encode(text){
    const tokens=[ids['[CLS]']];
    for(const token of basicTokenize(text)){
      for(const id of wordPiece(token)){
        if(tokens.length>=MAX_TOKENS-1)break;
        tokens.push(id);
      }
      if(tokens.length>=MAX_TOKENS-1)break;
    }
    tokens.push(ids['[SEP]']);return tokens;
  }
  return{encode,padId:ids['[PAD]'],size:vocab.size};
}
function int64Tensor(values,dims){const data=new BigInt64Array(values.length);for(let i=0;i<values.length;i+=1)data[i]=BigInt(values[i]);return new ort.Tensor('int64',data,dims)}
function buildFeeds(session,tokenizer,text){
  const inputIds=tokenizer.encode(text),length=inputIds.length;
  const attention=new Array(length).fill(1),types=new Array(length).fill(0);
  const tensors={input_ids:int64Tensor(inputIds,[1,length]),attention_mask:int64Tensor(attention,[1,length]),token_type_ids:int64Tensor(types,[1,length])};
  const feeds={};
  for(const name of session.inputNames){
    const key=String(name).toLowerCase();
    if(key.includes('input_ids'))feeds[name]=tensors.input_ids;
    else if(key.includes('attention_mask'))feeds[name]=tensors.attention_mask;
    else if(key.includes('token_type_ids')||key.includes('segment_ids'))feeds[name]=tensors.token_type_ids;
    else throw new Error(`Unsupported MiniLM ONNX input: ${name}`);
  }
  return{feeds,attention};
}
function chooseOutput(session,results){
  for(const name of ['sentence_embedding','last_hidden_state','token_embeddings','pooler_output'])if(results[name])return results[name];
  for(const name of session.outputNames)if(results[name])return results[name];
  const first=Object.values(results)[0];if(!first)throw new Error('MiniLM ONNX session returned no output tensor.');return first;
}
function poolOutput(output,attention){
  const dims=Array.from(output.dims||[]),data=output.data;
  if(dims.length===2)return normalize(Array.from(data.slice(0,dims[1])));
  if(dims.length!==3)throw new Error(`Unsupported MiniLM output dimensions: ${dims.join('x')}`);
  const sequence=dims[1],hidden=dims[2],sum=new Array(hidden).fill(0);let count=0;
  for(let token=0;token<sequence;token+=1){
    if(!attention[token])continue;
    const offset=token*hidden;
    for(let index=0;index<hidden;index+=1)sum[index]+=Number(data[offset+index]||0);
    count+=1;
  }
  const divisor=count||1;return normalize(sum.map(value=>value/divisor));
}
async function embedOne(state,text){const {feeds,attention}=buildFeeds(state.session,state.tokenizer,String(text||'').slice(0,4000));const results=await state.session.run(feeds);return poolOutput(chooseOutput(state.session,results),attention)}
async function embedBatches(id,state,texts,{phase='embedding',batchSize=REQUEST_BATCH_SIZE,yieldMs=0}={}){
  const rows=[];
  for(let start=0;start<texts.length;start+=batchSize){
    const batch=texts.slice(start,start+batchSize);
    progress(id,{status:phase,completed:start,total:texts.length,batchSize:batch.length});
    for(const text of batch)rows.push(await embedOne(state,text));
    await pause(yieldMs);
  }
  progress(id,{status:phase,completed:texts.length,total:texts.length,batchSize:0});return rows;
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
  void requestedProfile;
  if(statePromise)return statePromise;
  statePromise=(async()=>{
    progress(id,{status:'backend-verify',...FIXED_PROFILE});
    const [runtimeModule,runtimeWasm,modelResponse,vocabResponse]=await Promise.all([
      verifyRuntimeAsset(RUNTIME_MJS),verifyRuntimeAsset(RUNTIME_WASM,{wasm:true}),fromDevicePackage(MODEL_URL),fromDevicePackage(VOCAB_URL)
    ]);
    ort.env.wasm.wasmPaths={mjs:RUNTIME_MJS_URL,wasm:RUNTIME_WASM_URL};
    ort.env.wasm.proxy=false;
    ort.env.wasm.numThreads=1;
    ort.env.wasm.initTimeout=30000;
    progress(id,{status:'session-start',...FIXED_PROFILE,modelBytes:Number(modelResponse.headers.get('content-length')||22972370)});
    const session=await ort.InferenceSession.create(MODEL_URL,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
    progress(id,{status:'session-ready',...FIXED_PROFILE,inputNames:session.inputNames,outputNames:session.outputNames});
    const tokenizer=createTokenizer(await vocabResponse.text());
    return{session,tokenizer,device:'wasm',dtype:'q8',backend:{runtime:'onnxruntime-web',executionProviders:['wasm'],numThreads:1,module:runtimeModule,wasm:runtimeWasm},profile:FIXED_PROFILE};
  })().catch(error=>{statePromise=null;throw error});
  return statePromise;
}
async function ensureIndexVectors(id,state){
  if(indexPromise)return indexPromise;
  indexPromise=(async()=>{
    const current=await inspectIndex(state.profile);
    if(current.cached){progress(id,{status:'index-cache-ready',source:current.source,total:current.entries.length});return current}
    progress(id,{status:'index-cache-miss',total:current.entries.length});
    const vectors=await embedBatches(id,state,current.entries.map(entry=>entry.embeddingText),{phase:'index-embedding',batchSize:INDEX_BATCH_SIZE,yieldMs:16});
    const stored=await writeVectorRecord({key:current.key,model:MODEL_ID,indexSchema:current.index.schema,indexSignature:indexSignature(current.index),profile:state.profile,dimensions:EMBEDDING_DIMENSIONS,vectors,createdAt:new Date().toISOString()});
    progress(id,{status:'index-cache-written',stored,total:current.entries.length});
    return{...current,vectors,source:stored?'indexeddb-new':'memory',cached:false};
  })().catch(error=>{indexPromise=null;throw error});
  return indexPromise;
}
async function rankedCandidates(id,state,message){
  const candidates=(Array.isArray(message.candidates)?message.candidates:[]).slice(0,64).map((item,index)=>({id:String(item?.id||`candidate-${index+1}`).slice(0,180),text:String(item?.text||'').trim().slice(0,3000)})).filter(item=>item.text);
  if(!candidates.length)return[];
  const cacheKey=String(message.cacheKey||'').slice(0,240),signature=candidates.map(item=>`${item.id}\n${item.text}`).join('\u241e');
  const cached=cacheKey?rankCache.get(cacheKey):null;let vectors=cached?.signature===signature?cached.vectors:null;
  if(!vectors||vectors.length!==candidates.length){
    vectors=await embedBatches(id,state,candidates.map(item=>item.text),{phase:'candidate-embedding',batchSize:REQUEST_BATCH_SIZE,yieldMs:0});
    if(cacheKey){rankCache.set(cacheKey,{signature,vectors});while(rankCache.size>12)rankCache.delete(rankCache.keys().next().value)}
  }
  const query=await embedOne(state,String(message.text||''));
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
      const vector=await embedOne(state,String(message.text||''));
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
