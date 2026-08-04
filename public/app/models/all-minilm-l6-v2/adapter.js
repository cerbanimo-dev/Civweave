const ROOT='/app/models/all-minilm-l6-v2';
const WORKER_URL=`${ROOT}/worker.js?v=device-package-r38-merlinites`;
const MODEL_CACHE='commonweave-model-1.0.4-minilm-on-demand-r1';
const REQUIRED=[
  {url:`${ROOT}/config.json`,minBytes:300},
  {url:`${ROOT}/tokenizer.json`,minBytes:500000},
  {url:`${ROOT}/tokenizer_config.json`,minBytes:100},
  {url:`${ROOT}/vocab.txt`,minBytes:200000},
  {url:`${ROOT}/reflex-index.json`,minBytes:3000},
  {url:'/app/vendor/transformers/transformers.min.js',minBytes:100000},
  {url:'/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.mjs',minBytes:10000},
  {url:'/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.wasm',minBytes:1000000}
];
const GRAPH_OPTIONS=[
  {url:`${ROOT}/onnx/model_q4f16.onnx`,minBytes:25000000,device:'webgpu'},
  {url:`${ROOT}/onnx/model_quantized.onnx`,minBytes:18000000,device:'wasm'}
];
const DEFAULT_DOWNLOAD=[...REQUIRED,GRAPH_OPTIONS[1]];
const BODY_PROBE_LIMIT=2_000_000;
let worker=null,sequence=0;
const pending=new Map();

async function inspect(spec){
  try{
    if(!('caches'in globalThis))throw new Error('Cache Storage is unavailable.');
    const response=await caches.match(spec.url,{ignoreSearch:true});
    if(!response)return{...spec,status:0,length:0,type:'',ok:false,probe:'cache-storage',error:'Not downloaded on this device'};
    const status=response.status;
    const type=String(response.headers.get('content-type')||'');
    let length=Number(response.headers.get('content-length')||0);
    if(spec.minBytes<=BODY_PROBE_LIMIT)length=(await response.clone().blob()).size;
    else if(!length)length=spec.minBytes;
    const htmlFallback=/text\/html/i.test(type);
    return{...spec,status,length,type,ok:status>=200&&status<300&&!htmlFallback&&length>=spec.minBytes,probe:'cache-storage'};
  }catch(error){return{...spec,status:0,length:0,type:'',ok:false,probe:'cache-storage',error:error.message}}
}
async function fetchAndCache(spec){
  const existing=await inspect(spec);if(existing.ok)return existing;
  const response=await fetch(spec.url,{cache:'no-store'});
  if(!response.ok)throw new Error(`${spec.url} returned ${response.status}`);
  const type=String(response.headers.get('content-type')||'');
  if(/text\/html/i.test(type))throw new Error(`${spec.url} returned HTML instead of a model asset.`);
  if('caches'in globalThis){const cache=await caches.open(MODEL_CACHE);await cache.put(spec.url,response.clone())}
  const checked=await inspect(spec);
  if(!checked.ok)throw new Error(`${spec.url} did not pass the local cache check.`);
  return checked;
}
export async function install({includeWebGPU=false,onProgress}={}){
  const files=includeWebGPU?[...DEFAULT_DOWNLOAD,GRAPH_OPTIONS[0]]:DEFAULT_DOWNLOAD;
  const unique=[...new Map(files.map(item=>[item.url,item])).values()];
  let completed=0;
  for(const spec of unique){
    onProgress?.({phase:'downloading',url:spec.url,completed,total:unique.length});
    await fetchAndCache(spec);completed+=1;
    onProgress?.({phase:'cached',url:spec.url,completed,total:unique.length});
  }
  const result=await status();
  if(!result.available)throw new Error('The local semantic model download completed, but the package is still incomplete.');
  return result;
}
function stopWorker(error){
  for(const task of pending.values()){clearTimeout(task.timer);task.reject(error)}
  pending.clear();worker?.terminate();worker=null;
}
function activeWorker(){
  if(worker)return worker;
  worker=new Worker(WORKER_URL,{type:'module',name:'commonweave-minilm-reflex'});
  worker.addEventListener('message',event=>{
    const message=event.data||{};const task=pending.get(message.id);if(!task)return;
    if(message.type==='progress')return;
    pending.delete(message.id);clearTimeout(task.timer);
    if(message.type==='error'){
      const error=new Error(message.error?.message||'MiniLM worker failed.');error.code=message.error?.code||'MINILM_WORKER_FAILED';task.reject(error);stopWorker(error);
    }else task.resolve(message);
  });
  worker.addEventListener('error',event=>stopWorker(new Error(event.message||'MiniLM worker crashed.')));
  return worker;
}
function request(type,payload={},timeoutMs=120000){
  const id=`minilm-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);const error=new Error(`MiniLM ${type} timed out.`);error.code='MINILM_TIMEOUT';reject(error);stopWorker(error)},timeoutMs);
    pending.set(id,{resolve,reject,timer});activeWorker().postMessage({id,type,...payload});
  });
}
export async function status(){
  const files=await Promise.all(REQUIRED.map(inspect));
  const graphs=await Promise.all(GRAPH_OPTIONS.map(inspect));
  const usableGraphs=graphs.filter(item=>item.ok);
  return{available:files.every(item=>item.ok)&&usableGraphs.length>0,id:'Xenova/all-MiniLM-L6-v2',source:'local-model-cache',cache:MODEL_CACHE,files,graphs,missing:[...files.filter(item=>!item.ok),...(usableGraphs.length?[]:graphs)],sameOriginDownloadsOnly:true,remoteModelHostsAllowed:false,installRequired:!(files.every(item=>item.ok)&&usableGraphs.length>0)};
}
export async function prewarm({timeoutMs=120000,installIfMissing=false,onProgress}={}){
  const current=await status();
  if(!current.available){
    if(!installIfMissing){const error=new Error('MiniLM is not downloaded on this device. Use Download local model in AI settings.');error.code='MINILM_NOT_DOWNLOADED';throw error}
    await install({onProgress});
  }
  return request('prewarm',{},timeoutMs);
}
export async function match(text,{limit=5,timeoutMs=120000}={}){return request('match',{text,limit},timeoutMs)}
export async function rank(text,candidates,{limit=8,cacheKey='',timeoutMs=120000}={}){
  const rows=(Array.isArray(candidates)?candidates:[]).slice(0,64).map((item,index)=>typeof item==='string'?{id:`candidate-${index+1}`,text:item}:{id:String(item?.id||`candidate-${index+1}`),text:String(item?.text||item?.label||item?.description||'')}).filter(item=>item.text.trim());
  if(!rows.length)return{type:'rank',device:'none',dtype:'none',matches:[]};
  return request('rank',{text:String(text||''),candidates:rows,limit,cacheKey:String(cacheKey||'')},timeoutMs);
}
export async function benchmark(cases,{timeoutMs=120000}={}){
  const started=performance.now();const results=[];
  for(const item of cases||[]){const one=performance.now();try{const result=await match(item.text,{limit:3,timeoutMs});results.push({id:item.id,ok:true,elapsedMs:Math.round(performance.now()-one),device:result.device,matches:result.matches})}catch(error){results.push({id:item.id,ok:false,elapsedMs:Math.round(performance.now()-one),error:error.message})}}
  return{elapsedMs:Math.round(performance.now()-started),results};
}
