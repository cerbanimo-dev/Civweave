(()=>{
'use strict';
const VERSION='1.0.66-local-ai-runtime-v270-streaming';
const WORKER='/app/local-ai/worker-v266.js?v=1.0.66-v270';
if(globalThis.CivweaveLocalModelRuntimeV266?.version===VERSION)return;
let worker=null,sequence=0;const pending=new Map();
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
const downloads=()=>globalThis.CivweaveLocalModelDownloadV266;
function activeSpec(){const selected=downloads()?.selection?.();return selected?.active?registry()?.byId?.(selected.id):null}
function ensureWorker(){if(worker)return worker;worker=new Worker(WORKER,{name:'civweave-local-generative-v266'});worker.addEventListener('message',event=>{const message=event.data||{},task=pending.get(message.id);if(!task)return;if(message.type==='progress'){task.onProgress?.(message.progress);return}if(message.type==='token'){task.onToken?.(message.token);return}pending.delete(message.id);clearTimeout(task.timer);if(message.type==='error')task.reject(Object.assign(new Error(message.error?.message||'Local model failed.'),{code:'LOCAL_MODEL_FAILED',details:message.error}));else task.resolve(message.result)});worker.addEventListener('error',event=>{const error=new Error(event.message||'Local model worker crashed.');for(const task of pending.values()){clearTimeout(task.timer);task.reject(error)}pending.clear();worker?.terminate();worker=null});return worker}
function request(type,payload,{timeoutMs=180000,onProgress,onToken}={}){const id=`cwlocal-${Date.now().toString(36)}-${(++sequence).toString(36)}`;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Object.assign(new Error(`Local model ${type} timed out.`),{code:'LOCAL_MODEL_TIMEOUT'}))},timeoutMs);pending.set(id,{resolve,reject,timer,onProgress,onToken});ensureWorker().postMessage({id,type,...payload})})}
async function ready(id){const spec=registry()?.byId?.(id);if(!spec?.installable)return false;const state=await downloads().status(spec.id);return state.available}
async function generate({messages=[],maxNewTokens=1024,temperature=.2,timeoutMs=180000,stream=false,onProgress,onToken}={}){const spec=activeSpec();if(!spec)throw Object.assign(new Error('No downloaded local model is active.'),{code:'LOCAL_MODEL_NOT_SELECTED'});if(!await ready(spec.id))throw Object.assign(new Error(`${spec.label} is selected but is not fully downloaded on this device.`),{code:'LOCAL_MODEL_NOT_DOWNLOADED'});const started=performance.now();const result=await request('generate',{spec:{id:spec.id,repo:spec.repo,revision:spec.revision,task:spec.task,dtype:spec.dtype,device:spec.device},messages,maxNewTokens,temperature,stream:Boolean(stream)},{timeoutMs,onProgress,onToken});return{...result,id:spec.id,label:spec.label,elapsedMs:Math.round(performance.now()-started)}}
function shutdown(){if(!worker)return false;worker.terminate();worker=null;for(const task of pending.values()){clearTimeout(task.timer);task.reject(new Error('Local model stopped.'))}pending.clear();return true}
const api=Object.freeze({version:VERSION,activeSpec,ready,generate,shutdown,streaming:true});
globalThis.CivweaveLocalModelRuntimeV266=api;
dispatchEvent(new CustomEvent('civweave:local-model-runtime-ready',{detail:{version:VERSION,dormant:true,streaming:true}}));
})();
