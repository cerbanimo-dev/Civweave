const ROOT='/app/models/all-minilm-l6-v2';
const WORKER_URL=`${ROOT}/worker.js?v=device-package-r23`;
const REQUIRED=[
  {url:`${ROOT}/config.json`,minBytes:300},
  {url:`${ROOT}/tokenizer.json`,minBytes:500000},
  {url:`${ROOT}/tokenizer_config.json`,minBytes:100},
  {url:`${ROOT}/vocab.txt`,minBytes:200000},
  {url:`${ROOT}/reflex-index.json`,minBytes:3000},
  {url:'/app/vendor/transformers/transformers.min.js',minBytes:100000}
];
const GRAPH_OPTIONS=[
  {url:`${ROOT}/onnx/model_q4f16.onnx`,minBytes:25000000,device:'webgpu'},
  {url:`${ROOT}/onnx/model_quantized.onnx`,minBytes:18000000,device:'wasm'}
];
const BODY_PROBE_LIMIT=2_000_000;
let worker=null,sequence=0;
const pending=new Map();

async function inspect(spec){
  try{
    if(!('caches'in globalThis))throw new Error('Cache Storage is unavailable.');
    const response=await caches.match(spec.url,{ignoreSearch:true});
    if(!response)return{...spec,status:0,length:0,type:'',ok:false,probe:'cache-storage',error:'Missing from installed device package'};
    const status=response.status;
    const type=String(response.headers.get('content-type')||'');
    let length=Number(response.headers.get('content-length')||0);
    if(spec.minBytes<=BODY_PROBE_LIMIT)length=(await response.clone().blob()).size;
    else if(!length)length=spec.minBytes;
    const htmlFallback=/text\/html/i.test(type);
    return{...spec,status,length,type,ok:status>=200&&status<300&&!htmlFallback&&length>=spec.minBytes,probe:'cache-storage'};
  }catch(error){return{...spec,status:0,length:0,type:'',ok:false,probe:'cache-storage',error:error.message}}
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
  return{available:files.every(item=>item.ok)&&usableGraphs.length>0,id:'Xenova/all-MiniLM-L6-v2',source:'installed-device-package',files,graphs,missing:[...files.filter(item=>!item.ok),...(usableGraphs.length?[]:graphs)],remoteDownloadsAllowed:false};
}
export async function prewarm({timeoutMs=120000}={}){return request('prewarm',{},timeoutMs)}
export async function match(text,{limit=5,timeoutMs=120000}={}){return request('match',{text,limit},timeoutMs)}
export async function benchmark(cases,{timeoutMs=120000}={}){
  const started=performance.now();const results=[];
  for(const item of cases||[]){const one=performance.now();try{const result=await match(item.text,{limit:3,timeoutMs});results.push({id:item.id,ok:true,elapsedMs:Math.round(performance.now()-one),device:result.device,matches:result.matches})}catch(error){results.push({id:item.id,ok:false,elapsedMs:Math.round(performance.now()-one),error:error.message})}}
  return{elapsedMs:Math.round(performance.now()-started),results};
}
