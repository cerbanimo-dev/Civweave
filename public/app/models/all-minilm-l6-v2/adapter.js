const ROOT='/app/models/all-minilm-l6-v2';
const WORKER_URL=`${ROOT}/worker.js?v=clean-baseline-v1`;
const REQUIRED=[
  {url:`${ROOT}/config.json`,minBytes:300},
  {url:`${ROOT}/tokenizer.json`,minBytes:500000},
  {url:`${ROOT}/tokenizer_config.json`,minBytes:100},
  {url:`${ROOT}/vocab.txt`,minBytes:200000},
  {url:`${ROOT}/reflex-index.json`,minBytes:500},
  {url:'/app/vendor/transformers/transformers.min.js',minBytes:100000}
];
const GRAPHS=[
  {url:`${ROOT}/onnx/model_q4f16.onnx`,minBytes:25000000,device:'webgpu'},
  {url:`${ROOT}/onnx/model_quantized.onnx`,minBytes:18000000,device:'wasm'}
];
let worker=null,sequence=0;const pending=new Map();
async function localResponse(url){let response='caches'in globalThis?await caches.match(url,{ignoreSearch:true}):null;if(response)return response;response=await fetch(url,{cache:'no-store'});if(response.ok&&'caches'in globalThis){const cache=await caches.open('commonweave-local-model-v1');await cache.put(url,response.clone())}return response}
async function inspect(spec){try{const response=await localResponse(spec.url);const type=response.headers.get('content-type')||'';const length=Number(response.headers.get('content-length')||0)||(spec.minBytes<2_000_000?(await response.clone().blob()).size:spec.minBytes);return{...spec,status:response.status,length,type,ok:response.ok&&!/text\/html/i.test(type)&&length>=spec.minBytes,source:'same-origin-local-package'}}catch(error){return{...spec,status:0,length:0,ok:false,error:error.message,source:'same-origin-local-package'}}}
function stop(error){for(const task of pending.values()){clearTimeout(task.timer);task.reject(error)}pending.clear();worker?.terminate();worker=null}
function active(){if(worker)return worker;worker=new Worker(WORKER_URL,{type:'module',name:'commonweave-local-minilm'});worker.onmessage=event=>{const message=event.data||{},task=pending.get(message.id);if(!task)return;pending.delete(message.id);clearTimeout(task.timer);if(message.type==='error'){const error=new Error(message.error?.message||'MiniLM failed.');task.reject(error)}else task.resolve(message)};worker.onerror=event=>stop(new Error(event.message||'MiniLM worker crashed.'));return worker}
function request(type,payload={},timeoutMs=120000){const id=`minilm-${Date.now().toString(36)}-${++sequence}`;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`MiniLM ${type} timed out.`))},timeoutMs);pending.set(id,{resolve,reject,timer});active().postMessage({id,type,...payload})})}
export async function status(){const files=await Promise.all(REQUIRED.map(inspect)),graphs=await Promise.all(GRAPHS.map(inspect));return{available:files.every(x=>x.ok)&&graphs.some(x=>x.ok),id:'Xenova/all-MiniLM-L6-v2',role:'semantic routing only',files,graphs,remoteDownloadsAllowed:false}}
export async function prewarm({timeoutMs=120000}={}){return request('prewarm',{},timeoutMs)}
export async function match(text,{limit=5,timeoutMs=120000}={}){return request('match',{text,limit},timeoutMs)}
