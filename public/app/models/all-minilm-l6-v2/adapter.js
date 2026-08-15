const ROOT='/app/models/all-minilm-l6-v2';
const WORKER_URL=`${ROOT}/worker.js?v=device-package-r41-fixed-ort-wasm`;
const MODEL_CACHE='civweave-model-1.0.7-minilm-fixed-ort-r1';
const CIRCUIT_KEY='civweave.minilm.circuit.v2';
const FIXED_PROFILE=Object.freeze({device:'wasm',dtype:'q8',runtime:'onnxruntime-web'});
const REQUIRED=[
  {url:`${ROOT}/config.json`,minBytes:300},
  {url:`${ROOT}/tokenizer_config.json`,minBytes:100},
  {url:`${ROOT}/vocab.txt`,minBytes:200000},
  {url:`${ROOT}/reflex-index.json`,minBytes:3000},
  {url:'/app/vendor/onnxruntime/ort.wasm.min.mjs',minBytes:30000},
  {url:'/app/vendor/onnxruntime/ort-wasm-simd-threaded.mjs',minBytes:10000},
  {url:'/app/vendor/onnxruntime/ort-wasm-simd-threaded.wasm',minBytes:1000000}
];
const GRAPH={url:`${ROOT}/onnx/model_quantized.onnx`,minBytes:18000000,device:'wasm',dtype:'q8'};
const DEFAULT_DOWNLOAD=[...REQUIRED,GRAPH];
const BODY_PROBE_LIMIT=2_000_000;
const DEFAULT_INIT_TIMEOUT=45_000;
const DEFAULT_REQUEST_TIMEOUT=20_000;
const FAILURE_COOLDOWN_MS=10*60_000;
let worker=null,sequence=0,readyState=null,initPromise=null;
const pending=new Map();

function readCircuit(){
  try{return JSON.parse(sessionStorage.getItem(CIRCUIT_KEY)||'{}')||{}}catch{return{}}
}
function writeCircuit(value){try{sessionStorage.setItem(CIRCUIT_KEY,JSON.stringify(value))}catch{}}
function circuitError(){
  const state=readCircuit(),blockedUntil=Number(state.blockedUntil||0);
  if(blockedUntil<=Date.now())return null;
  const error=new Error(`MiniLM is paused after a failed runtime start. Retry after ${new Date(blockedUntil).toLocaleTimeString()}.`);
  error.code='MINILM_CIRCUIT_OPEN';
  error.details=state;
  return error;
}
function tripCircuit(error,profile){
  const prior=readCircuit(),failures=Math.max(0,Number(prior.failures||0))+1;
  writeCircuit({failures,blockedUntil:Date.now()+FAILURE_COOLDOWN_MS,lastError:String(error?.message||error||'MiniLM failed').slice(0,500),profile,at:new Date().toISOString()});
}
export function resetCircuit(){try{sessionStorage.removeItem(CIRCUIT_KEY)}catch{}}

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
  const response=await fetch(spec.url,{cache:'no-store',headers:{'x-civweave-package':'minilm-model-install'}});
  if(!response.ok)throw new Error(`${spec.url} returned ${response.status}`);
  const type=String(response.headers.get('content-type')||'');
  if(/text\/html/i.test(type))throw new Error(`${spec.url} returned HTML instead of a model asset.`);
  const routed=await inspect(spec);if(routed.ok)return routed;
  if('caches'in globalThis){const cache=await caches.open(MODEL_CACHE);await cache.put(spec.url,response.clone())}
  const checked=await inspect(spec);
  if(!checked.ok)throw new Error(`${spec.url} did not pass the local cache check.`);
  return checked;
}
export async function install({onProgress}={}){
  const unique=[...new Map(DEFAULT_DOWNLOAD.map(item=>[item.url,item])).values()];
  let completed=0;
  for(const spec of unique){
    onProgress?.({phase:'downloading',url:spec.url,completed,total:unique.length});
    await fetchAndCache(spec);completed+=1;
    onProgress?.({phase:'cached',url:spec.url,completed,total:unique.length});
  }
  const result=await status();
  if(!result.available)throw new Error('The fixed local semantic package downloaded, but its cache verification is incomplete.');
  return result;
}
function rejectPending(error){for(const task of pending.values()){clearTimeout(task.timer);task.reject(error)}pending.clear()}
function stopWorker(error,{trip=false,profile=null}={}){
  const failure=error instanceof Error?error:new Error(String(error||'MiniLM worker stopped.'));
  rejectPending(failure);
  worker?.terminate();worker=null;readyState=null;initPromise=null;
  if(trip)tripCircuit(failure,profile);
}
export function shutdown(reason='MiniLM was stopped.'){stopWorker(Object.assign(new Error(reason),{code:'MINILM_STOPPED'}))}
function activeWorker(){
  if(worker)return worker;
  worker=new Worker(WORKER_URL,{type:'module',name:'civweave-minilm-fixed-ort'});
  worker.addEventListener('message',event=>{
    const message=event.data||{};const task=pending.get(message.id);if(!task)return;
    if(message.type==='progress'){task.onProgress?.(message.progress||{});return}
    pending.delete(message.id);clearTimeout(task.timer);
    if(message.type==='error'){
      const error=new Error(message.error?.message||'MiniLM worker failed.');
      error.code=message.error?.code||'MINILM_WORKER_FAILED';
      error.details=message.error;
      task.reject(error);
    }else task.resolve(message);
  });
  worker.addEventListener('error',event=>{
    const error=new Error(event.message||'MiniLM worker crashed.');
    error.code='MINILM_WORKER_CRASHED';
    stopWorker(error,{trip:true,profile:readyState?.profile||FIXED_PROFILE});
  });
  return worker;
}
function request(type,payload={},options={}){
  const {timeoutMs=DEFAULT_REQUEST_TIMEOUT,onProgress,allowCircuit=false}=options;
  if(!allowCircuit){const blocked=circuitError();if(blocked)return Promise.reject(blocked)}
  const id=`minilm-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{
      pending.delete(id);
      const error=new Error(`MiniLM ${type} timed out after ${timeoutMs} ms.`);error.code='MINILM_TIMEOUT';
      stopWorker(error,{trip:true,profile:FIXED_PROFILE});
      reject(error);
    },timeoutMs);
    pending.set(id,{resolve,reject,timer,onProgress});
    activeWorker().postMessage({id,type,...payload,profile:FIXED_PROFILE});
  });
}
export async function status(){
  const files=await Promise.all(REQUIRED.map(inspect));
  const graph=await inspect(GRAPH);
  const circuit=readCircuit();
  const available=files.every(item=>item.ok)&&graph.ok;
  return{available,id:'Xenova/all-MiniLM-L6-v2',source:'local-model-cache',runtime:'onnxruntime-web/wasm',loaderPolicy:'fixed',cache:MODEL_CACHE,files,graphs:[graph],missing:[...files.filter(item=>!item.ok),...(graph.ok?[]:[graph])],sameOriginDownloadsOnly:true,remoteModelHostsAllowed:false,installRequired:!available,ready:Boolean(readyState),profile:readyState?.profile||FIXED_PROFILE,circuit};
}
export async function prewarm({timeoutMs=DEFAULT_INIT_TIMEOUT,installIfMissing=false,onProgress,explicit=false,force=false}={}){
  if(!explicit)return{ready:false,dormant:true,reason:'explicit-activation-required'};
  if(readyState)return{type:'ready',...readyState};
  if(initPromise)return initPromise;
  if(force)resetCircuit();
  const blocked=circuitError();if(blocked)throw blocked;
  initPromise=(async()=>{
    let current=await status();
    if(!current.available){
      if(!installIfMissing){const error=new Error('MiniLM is not downloaded on this device. Use Download local model in AI settings.');error.code='MINILM_NOT_DOWNLOADED';throw error}
      await install({onProgress});current=await status();
    }
    onProgress?.({phase:'starting',profile:FIXED_PROFILE});
    try{
      const result=await request('prewarm',{}, {timeoutMs,onProgress,allowCircuit:true});
      readyState={profile:FIXED_PROFILE,device:'wasm',dtype:'q8',count:result.count,backend:result.backend,readyAt:new Date().toISOString()};
      resetCircuit();
      return{type:'ready',...readyState};
    }catch(error){stopWorker(error,{trip:true,profile:FIXED_PROFILE});throw error}
  })().finally(()=>{initPromise=null});
  return initPromise;
}
function requireReady(){
  if(readyState)return readyState;
  const error=new Error('MiniLM is dormant. Run the reflex speed trial to start its fixed local session.');
  error.code='MINILM_NOT_READY';
  throw error;
}
export async function match(text,{limit=5,timeoutMs=DEFAULT_REQUEST_TIMEOUT}={}){requireReady();return request('match',{text,limit},{timeoutMs})}
export async function rank(text,candidates,{limit=8,cacheKey='',timeoutMs=DEFAULT_REQUEST_TIMEOUT}={}){
  requireReady();
  const rows=(Array.isArray(candidates)?candidates:[]).slice(0,64).map((item,index)=>typeof item==='string'?{id:`candidate-${index+1}`,text:item}:{id:String(item?.id||`candidate-${index+1}`),text:String(item?.text||item?.label||item?.description||'')}).filter(item=>item.text.trim());
  if(!rows.length)return{type:'rank',device:'none',dtype:'none',matches:[]};
  return request('rank',{text:String(text||''),candidates:rows,limit,cacheKey:String(cacheKey||'')},{timeoutMs});
}
export async function benchmark(cases,{timeoutMs=DEFAULT_REQUEST_TIMEOUT,initTimeoutMs=DEFAULT_INIT_TIMEOUT,onProgress,force=false}={}){
  await prewarm({explicit:true,timeoutMs:initTimeoutMs,onProgress,force});
  const started=performance.now();const results=[];
  for(const item of cases||[]){
    const one=performance.now();
    try{const result=await match(item.text,{limit:3,timeoutMs});results.push({id:item.id,ok:true,elapsedMs:Math.round(performance.now()-one),device:result.device,matches:result.matches})}
    catch(error){results.push({id:item.id,ok:false,elapsedMs:Math.round(performance.now()-one),error:error.message,code:error.code||null});break}
  }
  return{elapsedMs:Math.round(performance.now()-started),profile:FIXED_PROFILE,results};
}