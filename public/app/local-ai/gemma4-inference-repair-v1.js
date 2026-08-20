(()=>{
'use strict';
const VERSION='1.0.0-gemma4-inference-repair-v1';
const EXPECTED_WORKER_REVISION='1.0.126-v315-gemma4-template-logits';
const RUNTIME_WORKER_URL='/app/local-ai/worker-v266.js?v=1.0.125-v314-smooth-fit';
const GEMMA4_RE=/gemma4|gemma-4/i;
if(globalThis.CivweaveGemma4InferenceRepairV1?.version===VERSION)return;
let wrapped=null,refreshFlight=null,refreshDone=false;
const selected=()=>{try{return globalThis.CivweaveLocalModelDownloadV266?.selection?.()||null}catch{return null}};
const emit=(type,detail={})=>{try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}};
function activeGemma4(){const pick=selected();return Boolean(pick?.active&&GEMMA4_RE.test(String(pick.id||'')))}
async function freshWorkerSource(){
  const target=new URL(RUNTIME_WORKER_URL,location.href),fresh=new URL(target.href);fresh.searchParams.set('cwWorkerRepair',`${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
  const response=await fetch(fresh.href,{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw new Error(`Gemma 4 worker refresh returned HTTP ${response.status}.`);
  const text=await response.text();
  if(!text.includes(EXPECTED_WORKER_REVISION))throw new Error(`Gemma 4 worker refresh did not receive ${EXPECTED_WORKER_REVISION}.`);
  return{text,headers:new Headers(response.headers),target};
}
async function refreshWorkerAsset({force=false}={}){
  if(refreshDone&&!force)return true;if(refreshFlight)return refreshFlight;
  refreshFlight=(async()=>{
    const runtime=globalThis.CivweaveLocalModelRuntimeV266;
    try{runtime?.shutdown?.({reason:'gemma4-worker-repair-v315'})}catch{}
    const cacheNames=globalThis.caches?await caches.keys():[],targets=[];
    for(const name of cacheNames){
      try{const cache=await caches.open(name),hit=await cache.match(RUNTIME_WORKER_URL);if(hit){await cache.delete(RUNTIME_WORKER_URL);targets.push(cache)}}catch{}
    }
    const fresh=await freshWorkerSource();
    for(const cache of targets){
      try{const headers=new Headers(fresh.headers);headers.delete('content-encoding');headers.set('content-type','text/javascript; charset=utf-8');headers.set('x-civweave-worker-revision',EXPECTED_WORKER_REVISION);await cache.put(RUNTIME_WORKER_URL,new Response(fresh.text,{status:200,headers}))}catch{}
    }
    try{await fetch(RUNTIME_WORKER_URL,{cache:'reload',credentials:'same-origin'})}catch{}
    refreshDone=true;emit('civweave:gemma4-worker-repaired',{workerRevision:EXPECTED_WORKER_REVISION,cachesUpdated:targets.length});return true;
  })().catch(error=>{refreshDone=false;emit('civweave:gemma4-worker-repair-failed',{message:String(error?.message||error)});throw error}).finally(()=>{refreshFlight=null});
  return refreshFlight;
}
function patch(){
  const api=globalThis.CivweaveLocalChatRuntimeV295;if(!api?.generate)return false;
  if(api.gemma4InferenceRepairV1===VERSION){wrapped=api;return true}
  const base=api,generate=async args=>{if(activeGemma4())await refreshWorkerAsset();return base.generate(args)};
  const next=Object.freeze({...base,generate,gemma4InferenceRepairV1:VERSION,gemma4WorkerRevision:EXPECTED_WORKER_REVISION,gemma4ChatTemplateRepair:true,gemma4NextTokenLogitsOnly:true});
  try{globalThis.CivweaveLocalChatRuntimeV295=next}catch{return false}
  wrapped=next;emit('civweave:gemma4-inference-repair-installed',{workerRevision:EXPECTED_WORKER_REVISION});return true;
}
for(const name of ['civweave:local-model-runtime-ready','civweave:assistant-runtime-ready','civweave:guide-loader-reset','pageshow'])addEventListener(name,()=>queueMicrotask(patch));
patch();
globalThis.CivweaveGemma4InferenceRepairV1=Object.freeze({version:VERSION,expectedWorkerRevision:EXPECTED_WORKER_REVISION,runtimeWorkerUrl:RUNTIME_WORKER_URL,patch,refreshWorkerAsset,activeGemma4,state:()=>Object.freeze({installed:Boolean(wrapped),refreshDone,refreshing:Boolean(refreshFlight)})});
})();