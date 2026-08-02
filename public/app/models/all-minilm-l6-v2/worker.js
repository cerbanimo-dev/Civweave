import { pipeline, env } from '/app/vendor/transformers/transformers.min.js';

const MODEL_ID='all-minilm-l6-v2';
const MODEL_ROOT='/app/models/';
const INDEX_URL='/app/models/all-minilm-l6-v2/reflex-index.json';
let statePromise=null;

function serialize(error){return {message:String(error?.message||error||'MiniLM worker error'),code:error?.code||null,stack:String(error?.stack||'').slice(0,3000)}}
function cosine(a,b){let dot=0,aa=0,bb=0;const n=Math.min(a.length,b.length);for(let i=0;i<n;i+=1){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return dot/(Math.sqrt(aa)*Math.sqrt(bb)||1)}

async function load(){
  if(statePromise)return statePromise;
  statePromise=(async()=>{
    env.allowRemoteModels=false;
    env.allowLocalModels=true;
    env.localModelPath=MODEL_ROOT;
    env.useBrowserCache=true;
    if(env.backends?.onnx?.wasm){
      env.backends.onnx.wasm.wasmPaths='/app/vendor/transformers/wasm/';
      env.backends.onnx.wasm.numThreads=self.crossOriginIsolated?Math.max(1,Math.min(4,navigator.hardwareConcurrency||1)):1;
    }
    const attempts=navigator.gpu?[['webgpu','q4f16'],['wasm','q8']]:[['wasm','q8']];
    let extractor=null,device='',lastError=null;
    for(const [candidate,dtype] of attempts){
      try{
        extractor=await pipeline('feature-extraction',MODEL_ID,{device:candidate,dtype,local_files_only:true});
        device=candidate;
        break;
      }catch(error){lastError=error}
    }
    if(!extractor)throw lastError||new Error('No MiniLM backend initialized.');
    const index=await fetch(INDEX_URL,{cache:'force-cache'}).then(response=>{if(!response.ok)throw new Error(`Reflex index returned ${response.status}`);return response.json()});
    const entries=Array.isArray(index.entries)?index.entries:[];
    const output=await extractor(entries.map(entry=>entry.embeddingText),{pooling:'mean',normalize:true});
    const vectors=output.tolist();
    return {extractor,device,entries,vectors};
  })().catch(error=>{statePromise=null;throw error});
  return statePromise;
}

self.addEventListener('message',async event=>{
  const message=event.data||{};
  if(!message.id)return;
  try{
    const state=await load();
    if(message.type==='prewarm'){
      self.postMessage({id:message.id,type:'ready',device:state.device,count:state.entries.length});
      return;
    }
    if(message.type==='match'){
      const output=await state.extractor(String(message.text||''),{pooling:'mean',normalize:true});
      const vector=output.tolist()[0];
      const matches=state.entries.map((entry,index)=>({id:entry.id,system:entry.system,score:cosine(vector,state.vectors[index])})).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(8,Number(message.limit||5))));
      self.postMessage({id:message.id,type:'match',device:state.device,matches});
      return;
    }
    throw new Error(`Unknown MiniLM worker request: ${message.type}`);
  }catch(error){self.postMessage({id:message.id,type:'error',error:serialize(error)})}
});
