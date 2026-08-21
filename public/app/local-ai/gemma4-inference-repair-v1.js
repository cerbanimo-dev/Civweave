(()=>{
'use strict';
const VERSION='1.0.7-gemma4-inference-repair-v1-post-core-authority';
const EXPECTED_WORKER_REVISION='1.0.126-v315-gemma4-template-logits';
const RUNTIME_WORKER_URL='/app/local-ai/worker-v266.js?v=1.0.125-v314-smooth-fit';
const WORKER_PATH='/app/local-ai/worker-v266.js';
const V4_BUNDLE_PATH='/app/vendor/transformers-v4/transformers.min.js';
const V4_MANIFEST_PATH='/app/vendor/transformers-v4/stage-manifest.json';
const V4_STAGE_SCHEMA='civweave.transformers-stage.v7';
const V4_BACKPORT='huggingface-transformers-js-pr-1681';
const DEEP_VERSION='1.0.0-gemma4-e4b-q4-extension-v1';
const DEEP_SRC='/app/local-ai/gemma4-e4b-q4-extension-v1.js?v=1.0.0-e4b-q4-deep';
const PHONE_AUTH_VERSION='1.1.0-gemma4-phone-performance-core-v1-registry-authority';
const PHONE_AUTH_SRC='/app/local-ai/gemma4-phone-performance-core-v1.js?v=1.1.0-registry-authority';
const GEMMA4_RE=/gemma4|gemma-4/i;
const LITERT_RE=/litert/i;
const STALE_LOGITS_RE=/inputNames\.includes\("num_logits_to_keep"\)[^;]{0,220}\[0n\]/;
if(globalThis.CivweaveGemma4InferenceRepairV1?.version===VERSION)return;
let wrapped=null,refreshFlight=null,refreshDone=false,phoneAuthorityFlight=null;
const selected=()=>{try{return globalThis.CivweaveLocalModelDownloadV266?.selection?.()||null}catch{return null}};
const emit=(type,detail={})=>{try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}};
function activeGemma4(){const pick=selected(),id=String(pick?.id||''),spec=globalThis.CivweaveLocalModelRegistryV266?.byId?.(id);return Boolean(pick?.active&&GEMMA4_RE.test(id)&&!LITERT_RE.test(`${id} ${spec?.runtime||''}`))}
function loadScript(src,ready,label){
  if(ready())return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const target=new URL(src,location.href),path=target.pathname;
    const existing=[...(document.scripts||[])].find(node=>{try{return new URL(node.src,location.href).pathname===path}catch{return false}});
    if(existing&&!ready())try{existing.remove()}catch{}
    const script=document.createElement('script');script.src=`${src}${src.includes('?')?'&':'?'}cwPhoneAuthority=${Date.now()}`;script.async=false;
    script.onload=()=>ready()?resolve(true):reject(new Error(`${label} loaded without becoming ready.`));
    script.onerror=()=>reject(new Error(`${label} could not load.`));
    const head=document.head;if(!head?.isConnected){reject(new Error(`${label} could not mount because the document is leaving.`));return}head.append(script);
  });
}
async function ensurePhoneAuthority(){
  const phoneReady=()=>globalThis.CivweaveGemma4PhonePerformanceCoreV1?.version===PHONE_AUTH_VERSION;
  const deepReady=()=>globalThis.CivweaveGemma4E4BQ4ExtensionV1?.version===DEEP_VERSION;
  if(phoneReady()){
    globalThis.CivweaveGemma4PhonePerformanceCoreV1?.activate?.();
    return true;
  }
  if(phoneAuthorityFlight)return phoneAuthorityFlight;
  phoneAuthorityFlight=loadScript(DEEP_SRC,deepReady,'Gemma 4 E4B deep registration')
    .then(()=>loadScript(PHONE_AUTH_SRC,phoneReady,'Gemma 4 phone performance authority'))
    .then(()=>{globalThis.CivweaveGemma4PhonePerformanceCoreV1?.activate?.();emit('civweave:gemma4-phone-authority-ready',{deepModel:'gemma4-e4b-it-q4f16',fastModel:'gemma4-e2b-it-litert-web',deepFastModel:'gemma4-e4b-it-litert-web',registryAuthority:true});return true})
    .catch(error=>{emit('civweave:gemma4-phone-authority-failed',{message:String(error?.message||error)});throw error})
    .finally(()=>{phoneAuthorityFlight=null});
  return phoneAuthorityFlight;
}
async function fetchText(path,label){const fresh=new URL(path,location.href);fresh.searchParams.set('cwGemma4Repair',`${Date.now()}-${Math.random().toString(36).slice(2,8)}`);const response=await fetch(fresh.href,{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw new Error(`${label} refresh returned HTTP ${response.status}.`);return{response,text:await response.text()}}
async function freshWorkerSource(){
  const target=new URL(RUNTIME_WORKER_URL,location.href),fresh=new URL(target.href);fresh.searchParams.set('cwWorkerRepair',`${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
  const response=await fetch(fresh.href,{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw new Error(`Gemma 4 worker refresh returned HTTP ${response.status}.`);
  const text=await response.text();
  if(!text.includes(EXPECTED_WORKER_REVISION))throw new Error(`Gemma 4 worker refresh did not receive ${EXPECTED_WORKER_REVISION}.`);
  return{text,headers:new Headers(response.headers),target};
}
async function verifyPatchedV4Runtime(){
  const manifestPacket=await fetchText(V4_MANIFEST_PATH,'Transformers.js v4 manifest');let manifest;
  try{manifest=JSON.parse(manifestPacket.text)}catch{throw new Error('Transformers.js v4 manifest was not valid JSON.')}
  if(manifest?.schema!==V4_STAGE_SCHEMA||manifest?.gemma4NumLogitsBackport!==V4_BACKPORT||Number(manifest?.gemma4NumLogitsToKeep)!==1)throw new Error(`Gemma 4 runtime is not staged with ${V4_BACKPORT}.`);
  const bundle=await fetchText(V4_BUNDLE_PATH,'Transformers.js v4 bundle');
  if(!bundle.text.includes('num_logits_to_keep'))throw new Error('Transformers.js v4 bundle is missing the Gemma logits contract.');
  if(STALE_LOGITS_RE.test(bundle.text))throw new Error('Transformers.js v4 still contains the num_logits_to_keep=0 decode path.');
  return{schema:manifest.schema,backport:manifest.gemma4NumLogitsBackport,numLogitsToKeep:Number(manifest.gemma4NumLogitsToKeep)};
}
async function refreshWorkerAsset({force=false}={}){
  if(refreshDone&&!force)return true;if(refreshFlight)return refreshFlight;
  refreshFlight=(async()=>{
    const runtime=globalThis.CivweaveLocalModelRuntimeV266;
    try{runtime?.shutdown?.({reason:'gemma4-runtime-repair-v7'})}catch{}
    const cacheNames=globalThis.caches?await caches.keys():[],targets=[];let evicted=0;
    const stalePaths=new Set([WORKER_PATH,V4_BUNDLE_PATH,V4_MANIFEST_PATH]);
    for(const name of cacheNames){
      try{
        const cache=await caches.open(name),keys=await cache.keys();let touched=false;
        for(const request of keys){let url;try{url=new URL(request.url)}catch{continue}if(!stalePaths.has(url.pathname))continue;await cache.delete(request);evicted+=1;touched=true}
        if(touched)targets.push(cache);
      }catch{}
    }
    const [fresh,runtimeContract]=await Promise.all([freshWorkerSource(),verifyPatchedV4Runtime()]);
    for(const cache of targets){
      try{const headers=new Headers(fresh.headers);headers.delete('content-encoding');headers.set('content-type','text/javascript; charset=utf-8');headers.set('x-civweave-worker-revision',EXPECTED_WORKER_REVISION);await cache.put(RUNTIME_WORKER_URL,new Response(fresh.text,{status:200,headers}))}catch{}
    }
    const primed=await fetch(RUNTIME_WORKER_URL,{cache:'reload',credentials:'same-origin'}).catch(()=>null);if(primed?.ok){const text=await primed.clone().text().catch(()=> '');if(text&&!text.includes(EXPECTED_WORKER_REVISION))throw new Error('The runtime worker URL was still stale after cache repair.')}
    refreshDone=true;emit('civweave:gemma4-worker-repaired',{workerRevision:EXPECTED_WORKER_REVISION,runtimeContract,cachesUpdated:targets.length,entriesEvicted:evicted});return true;
  })().catch(error=>{refreshDone=false;emit('civweave:gemma4-worker-repair-failed',{message:String(error?.message||error)});throw error}).finally(()=>{refreshFlight=null});
  return refreshFlight;
}
function patch(){
  const api=globalThis.CivweaveLocalChatRuntimeV295;if(!api?.generate)return false;
  if(api.gemma4InferenceRepairV1===VERSION){wrapped=api;return true}
  const base=api,generate=async args=>{
    if(typeof base.ready==='function')await base.ready(args?.onProgress);
    await ensurePhoneAuthority();
    globalThis.CivweaveGemma4PhonePerformanceCoreV1?.assertSelectedPerformance?.();
    if(activeGemma4())await refreshWorkerAsset();
    return base.generate(args);
  };
  const next=Object.freeze({...base,generate,gemma4InferenceRepairV1:VERSION,gemma4WorkerRevision:EXPECTED_WORKER_REVISION,gemma4ChatTemplateRepair:true,gemma4NextTokenLogitsOnly:true,gemma4UpstreamLogitsBackport:true,gemma4RuntimeStageSchema:V4_STAGE_SCHEMA,gemma4PhoneAuthority:true,gemma4DeepRegistrationGuaranteed:true,gemma4PhonePerformanceCoreRequired:true,gemma4PhoneRegistryAuthority:true,phoneAuthorityHotReload:true,phoneAuthorityAfterInferenceCore:true,transformersRepairScope:'onnx-only'});
  try{globalThis.CivweaveLocalChatRuntimeV295=next}catch{return false}
  wrapped=next;emit('civweave:gemma4-inference-repair-installed',{workerRevision:EXPECTED_WORKER_REVISION,runtimeStageSchema:V4_STAGE_SCHEMA,scope:'onnx-only',phoneAuthority:true,registryAuthority:true,hotReload:true,afterInferenceCore:true});return true;
}
for(const name of ['civweave:local-model-runtime-ready','civweave:assistant-runtime-ready','civweave:guide-loader-reset','pageshow'])addEventListener(name,()=>queueMicrotask(()=>{patch();void ensurePhoneAuthority().catch(()=>null)}));
patch();void ensurePhoneAuthority().catch(()=>null);
globalThis.CivweaveGemma4InferenceRepairV1=Object.freeze({version:VERSION,expectedWorkerRevision:EXPECTED_WORKER_REVISION,runtimeWorkerUrl:RUNTIME_WORKER_URL,workerPath:WORKER_PATH,v4BundlePath:V4_BUNDLE_PATH,v4ManifestPath:V4_MANIFEST_PATH,v4StageSchema:V4_STAGE_SCHEMA,v4Backport:V4_BACKPORT,patch,refreshWorkerAsset,verifyPatchedV4Runtime,ensurePhoneAuthority,activeGemma4,gemma4PhoneAuthority:true,gemma4DeepRegistrationGuaranteed:true,gemma4PhonePerformanceCoreRequired:true,gemma4PhoneRegistryAuthority:true,phoneAuthorityHotReload:true,phoneAuthorityAfterInferenceCore:true,transformersRepairScope:'onnx-only',state:()=>Object.freeze({installed:Boolean(wrapped),refreshDone,refreshing:Boolean(refreshFlight),phoneAuthorityReady:globalThis.CivweaveGemma4PhonePerformanceCoreV1?.version===PHONE_AUTH_VERSION,phoneAuthorityLoading:Boolean(phoneAuthorityFlight)})});
})();