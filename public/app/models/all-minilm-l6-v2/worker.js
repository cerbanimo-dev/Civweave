import * as ort from '/app/vendor/onnxruntime/ort.wasm.min.mjs';

const ROOT='/app/models/all-minilm-l6-v2';
const MODEL_URL=`${ROOT}/onnx/model_quantized.onnx`;
const VOCAB_URL=`${ROOT}/vocab.txt`;
const INDEX_URL=`${ROOT}/reflex-index.json`;
const RUNTIME_MJS='/app/vendor/onnxruntime/ort-wasm-simd-threaded.mjs';
const RUNTIME_WASM='/app/vendor/onnxruntime/ort-wasm-simd-threaded.wasm';
const RUNTIME_MJS_URL=new URL(RUNTIME_MJS,self.location.origin).href;
const RUNTIME_WASM_URL=new URL(RUNTIME_WASM,self.location.origin).href;
const MAX_TOKENS=128;
const FIXED_PROFILE=Object.freeze({device:'wasm',dtype:'q8',runtime:'onnxruntime-web'});
let statePromise=null;
const rankCache=new Map();

function serialize(error){
  const raw=String(error?.message||error||'MiniLM worker error');
  const numeric=typeof error==='number'||/^\d+$/.test(raw);
  return{message:numeric?`ONNX Runtime aborted during session creation (numeric exception ${raw}).`:raw,code:error?.code||null,stack:String(error?.stack||'').slice(0,3000)};
}
function progress(id,payload){self.postMessage({id,type:'progress',progress:payload})}
function pause(){return new Promise(resolve=>setTimeout(resolve,0))}
function cosine(a,b){let dot=0,aa=0,bb=0;const n=Math.min(a.length,b.length);for(let i=0;i<n;i+=1){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return dot/(Math.sqrt(aa)*Math.sqrt(bb)||1)}
function normalize(vector){let sum=0;for(const value of vector)sum+=value*value;const scale=Math.sqrt(sum)||1;return vector.map(value=>value/scale)}
async function fromDevicePackage(url){const response=await caches.match(url,{ignoreSearch:true});if(!response)throw new Error(`${new URL(url,self.location.origin).pathname} is missing from the installed device package.`);return response}
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
function cleanText(value){
  return String(value||'').normalize('NFD').replace(/\p{M}+/gu,'').toLowerCase().replace(/[\u0000\ufffd]/g,' ').replace(/[\t\n\r]+/g,' ');
}
function basicTokenize(value){
  const output=[];let current='';
  const flush=()=>{if(current){output.push(current);current=''}};
  for(const char of cleanText(value)){
    if(/\s/u.test(char)){flush();continue}
    if(isCjk(char)){flush();output.push(char);continue}
    if(/[\p{P}\p{S}]/u.test(char)){flush();output.push(char);continue}
    current+=char;
  }
  flush();
  return output;
}
function createTokenizer(vocabText){
  const vocab=new Map(vocabText.split(/\r?\n/).map((token,index)=>[token,index]));
  const required=['[PAD]','[UNK]','[CLS]','[SEP]'];
  for(const token of required)if(!vocab.has(token))throw new Error(`MiniLM vocabulary is missing ${token}.`);
  const ids=Object.fromEntries(required.map(token=>[token,vocab.get(token)]));
  function wordPiece(token){
    if(vocab.has(token))return[vocab.get(token)];
    const chars=Array.from(token);
    if(chars.length>100)return[ids['[UNK]']];
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
    tokens.push(ids['[SEP]']);
    return tokens;
  }
  return{encode,padId:ids['[PAD]'],size:vocab.size};
}
function int64Tensor(values,dims){
  const data=new BigInt64Array(values.length);
  for(let i=0;i<values.length;i+=1)data[i]=BigInt(values[i]);
  return new ort.Tensor('int64',data,dims);
}
function buildFeeds(session,tokenizer,text){
  const inputIds=tokenizer.encode(text),length=inputIds.length;
  const attention=new Array(length).fill(1),types=new Array(length).fill(0);
  const tensors={
    input_ids:int64Tensor(inputIds,[1,length]),
    attention_mask:int64Tensor(attention,[1,length]),
    token_type_ids:int64Tensor(types,[1,length])
  };
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
  const first=Object.values(results)[0];
  if(!first)throw new Error('MiniLM ONNX session returned no output tensor.');
  return first;
}
function poolOutput(output,attention){
  const dims=Array.from(output.dims||[]),data=output.data;
  if(dims.length===2){
    const hidden=dims[1],row=Array.from(data.slice(0,hidden));
    return normalize(row);
  }
  if(dims.length!==3)throw new Error(`Unsupported MiniLM output dimensions: ${dims.join('x')}`);
  const sequence=dims[1],hidden=dims[2],sum=new Array(hidden).fill(0);let count=0;
  for(let token=0;token<sequence;token+=1){
    if(!attention[token])continue;
    const offset=token*hidden;
    for(let index=0;index<hidden;index+=1)sum[index]+=Number(data[offset+index]||0);
    count+=1;
  }
  const divisor=count||1;
  return normalize(sum.map(value=>value/divisor));
}
async function embedOne(state,text){
  const {feeds,attention}=buildFeeds(state.session,state.tokenizer,String(text||'').slice(0,4000));
  const results=await state.session.run(feeds);
  return poolOutput(chooseOutput(state.session,results),attention);
}
async function embedMany(id,state,texts,phase='embedding'){
  const vectors=[];
  for(let index=0;index<texts.length;index+=1){
    progress(id,{status:phase,completed:index,total:texts.length,batchSize:1});
    vectors.push(await embedOne(state,texts[index]));
    await pause();
  }
  progress(id,{status:phase,completed:texts.length,total:texts.length,batchSize:0});
  return vectors;
}
async function load(id){
  if(statePromise)return statePromise;
  statePromise=(async()=>{
    progress(id,{status:'backend-verify',...FIXED_PROFILE});
    const [runtimeModule,runtimeWasm,modelResponse,vocabResponse,indexResponse]=await Promise.all([
      verifyRuntimeAsset(RUNTIME_MJS),verifyRuntimeAsset(RUNTIME_WASM,{wasm:true}),fromDevicePackage(MODEL_URL),fromDevicePackage(VOCAB_URL),fromDevicePackage(INDEX_URL)
    ]);
    ort.env.wasm.wasmPaths={mjs:RUNTIME_MJS_URL,wasm:RUNTIME_WASM_URL};
    ort.env.wasm.proxy=false;
    ort.env.wasm.numThreads=1;
    ort.env.wasm.initTimeout=30000;
    const modelBytes=await modelResponse.arrayBuffer();
    progress(id,{status:'session-start',...FIXED_PROFILE,modelBytes:modelBytes.byteLength});
    const session=await ort.InferenceSession.create(modelBytes,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
    progress(id,{status:'session-ready',...FIXED_PROFILE,inputNames:session.inputNames,outputNames:session.outputNames});
    const tokenizer=createTokenizer(await vocabResponse.text());
    const index=await indexResponse.json(),entries=Array.isArray(index.entries)?index.entries:[];
    const base={session,tokenizer,entries,backend:{runtime:'onnxruntime-web',executionProviders:['wasm'],numThreads:1,module:runtimeModule,wasm:runtimeWasm},profile:FIXED_PROFILE};
    const vectors=await embedMany(id,base,entries.map(entry=>entry.embeddingText),'index-embedding');
    return{...base,vectors};
  })().catch(error=>{statePromise=null;throw error});
  return statePromise;
}
async function rankedCandidates(id,state,message){
  const candidates=(Array.isArray(message.candidates)?message.candidates:[]).slice(0,64).map((item,index)=>({id:String(item?.id||`candidate-${index+1}`).slice(0,180),text:String(item?.text||'').trim().slice(0,3000)})).filter(item=>item.text);
  if(!candidates.length)return[];
  const cacheKey=String(message.cacheKey||'').slice(0,240);
  const signature=candidates.map(item=>`${item.id}\n${item.text}`).join('\u241e');
  const cached=cacheKey?rankCache.get(cacheKey):null;
  let vectors=cached?.signature===signature?cached.vectors:null;
  if(!vectors||vectors.length!==candidates.length){
    vectors=await embedMany(id,state,candidates.map(item=>item.text),'candidate-embedding');
    if(cacheKey){rankCache.set(cacheKey,{signature,vectors});while(rankCache.size>12)rankCache.delete(rankCache.keys().next().value)}
  }
  const query=await embedOne(state,String(message.text||''));
  return candidates.map((item,index)=>({id:item.id,score:cosine(query,vectors[index])})).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(16,Number(message.limit||8))));
}

self.addEventListener('message',async event=>{
  const message=event.data||{};
  if(!message.id)return;
  try{
    const state=await load(message.id);
    if(message.type==='prewarm'){self.postMessage({id:message.id,type:'ready',device:'wasm',dtype:'q8',count:state.entries.length,backend:state.backend,profile:FIXED_PROFILE});return}
    if(message.type==='match'){
      const vector=await embedOne(state,String(message.text||''));
      const matches=state.entries.map((entry,index)=>({id:entry.id,system:entry.system,score:cosine(vector,state.vectors[index])})).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(8,Number(message.limit||5))));
      self.postMessage({id:message.id,type:'match',device:'wasm',dtype:'q8',matches});return
    }
    if(message.type==='rank'){
      const matches=await rankedCandidates(message.id,state,message);
      self.postMessage({id:message.id,type:'rank',device:'wasm',dtype:'q8',matches});return
    }
    throw new Error(`Unknown MiniLM worker request: ${message.type}`);
  }catch(error){self.postMessage({id:message.id,type:'error',error:serialize(error)})}
});
