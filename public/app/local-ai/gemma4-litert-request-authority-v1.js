(()=>{
'use strict';

const VERSION='1.0.0-gemma4-litert-request-authority-v1';
const LOCAL_CHAT_SRC='/app/local-chat-runtime-v295.js?v=1.0.130-v325-inference-core-first';
const LOCAL_CHAT_REVISION='v312-runtime-first-bootstrap';
const FAST_EXTENSION_VERSION='1.1.1-gemma4-litert-fast-extension-v1-browser-handoff-guard';
const FAST_EXTENSION_SRC='/app/local-ai/gemma4-litert-fast-extension-v1.js?v=1.1.1-browser-handoff-guard';
const FAST_RUNTIME_VERSION='1.4.0-litert-gemma4-fast-runtime-v1-formatted-output';
const FAST_RUNTIME_SRC='/app/local-ai/litert-gemma4-fast-runtime-v1.js?v=1.4.0-formatted-output';
const FAST_IDS=new Set(['gemma4-e2b-it-litert-web','gemma4-e4b-it-litert-web']);
const SELECTION_KEY='civweave.local-ai.selection.v266';

if(globalThis.CivweaveGemma4LiteRTRequestAuthorityV1?.version===VERSION){
  globalThis.CivweaveGemma4LiteRTRequestAuthorityV1.schedule?.();
  return;
}

let ensureFlight=null;
let assistantTarget=null;
let queued=false;
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
function selected(){
  try{
    const live=globalThis.CivweaveLocalModelDownloadV266?.selection?.();
    if(live?.active&&live.id)return live;
  }catch{}
  try{
    const saved=parse(localStorage.getItem(SELECTION_KEY),{});
    return saved?.active&&saved.id?saved:null;
  }catch{return null}
}
function selectedFast(){
  const pick=selected();
  return Boolean(pick?.active&&FAST_IDS.has(clean(pick.id,240)));
}
function emit(type,detail={}){
  try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}
}
function scriptFor(path){
  try{return [...(document.scripts||[])].find(node=>new URL(node.src,location.href).pathname===path)||null}catch{return null}
}
function loadScript(src,ready,label){
  if(ready())return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const target=new URL(src,location.href),path=target.pathname;
    const existing=scriptFor(path);
    if(existing&&!ready())try{existing.remove()}catch{}
    const script=document.createElement('script');
    let settled=false;
    const finish=(ok,error)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      ok?resolve(true):reject(error);
    };
    const timer=setTimeout(
      ()=>finish(false,Object.assign(new Error(`${label} did not become ready.`),{code:'LOCAL_GEMMA4_LITERT_STARTUP_TIMEOUT',component:label})),
      20000
    );
    script.src=`${src}${src.includes('?')?'&':'?'}cwGemmaFirst=${Date.now()}`;
    script.async=false;
    script.dataset.civweaveGemma4FirstRequest='v1';
    script.onload=()=>finish(
      ready(),
      Object.assign(new Error(`${label} loaded without satisfying its runtime contract.`),{code:'LOCAL_GEMMA4_LITERT_STARTUP_CONTRACT',component:label})
    );
    script.onerror=()=>finish(false,Object.assign(new Error(`${label} could not load.`),{code:'LOCAL_GEMMA4_LITERT_STARTUP_LOAD',component:label}));
    const head=document.head;
    if(!head?.isConnected){
      finish(false,Object.assign(new Error(`${label} could not mount because the document is leaving.`),{code:'LOCAL_GEMMA4_LITERT_STARTUP_LOAD',component:label}));
      return;
    }
    head.append(script);
  });
}
function localChatReady(){
  const runtime=globalThis.CivweaveLocalChatRuntimeV295;
  return Boolean(runtime?.generate&&runtime?.revision===LOCAL_CHAT_REVISION&&runtime?.inferenceCoreFirst===true);
}
async function ensureLocalChat(onProgress){
  if(!localChatReady())await loadScript(LOCAL_CHAT_SRC,localChatReady,'downloaded-local chat runtime');
  const runtime=globalThis.CivweaveLocalChatRuntimeV295;
  if(typeof runtime?.ready==='function')await runtime.ready(onProgress);
  if(!localChatReady())throw Object.assign(new Error('The downloaded-local chat runtime did not become inference-core ready.'),{code:'LOCAL_GEMMA4_LITERT_STARTUP_CONTRACT',component:'local-chat-runtime'});
  return runtime;
}
function fastExtensionReady(){return globalThis.CivweaveGemma4LiteRTFastExtensionV1?.version===FAST_EXTENSION_VERSION}
function fastRuntimeReady(){return globalThis.CivweaveLiteRTGemma4FastRuntimeV1?.version===FAST_RUNTIME_VERSION}
function fastWrapperReady(){return globalThis.CivweaveLocalChatRuntimeV295?.__civweaveLiteRTGemma4FastV1===FAST_RUNTIME_VERSION}
async function ensure({onProgress,reason='local-request'}={}){
  if(!selectedFast())return globalThis.CivweaveLocalChatRuntimeV295||null;
  if(ensureFlight)return ensureFlight;
  ensureFlight=(async()=>{
    const pick=selected();
    emit('civweave:gemma4-litert-first-request-start',{reason,model:pick?.id||''});
    await ensureLocalChat(onProgress);
    if(!fastExtensionReady())await loadScript(FAST_EXTENSION_SRC,fastExtensionReady,'Gemma 4 LiteRT model extension');
    try{globalThis.CivweaveGemma4LiteRTFastExtensionV1?.watch?.()}catch{}
    try{globalThis.CivweaveGemma4CurrentRegistryAuthorityV1?.repairRegistry?.()}catch{}
    if(!fastRuntimeReady())await loadScript(FAST_RUNTIME_SRC,fastRuntimeReady,'Gemma 4 LiteRT inference runtime');
    globalThis.CivweaveLiteRTGemma4FastRuntimeV1?.install?.();
    if(!fastWrapperReady()){
      await Promise.resolve();
      globalThis.CivweaveLiteRTGemma4FastRuntimeV1?.install?.();
    }
    if(!fastWrapperReady()){
      throw Object.assign(new Error('Gemma 4 LiteRT loaded, but it did not take ownership of the selected local model before inference.'),{code:'LOCAL_GEMMA4_LITERT_OWNERSHIP_FAILED',component:'litert-fast-runtime'});
    }
    emit('civweave:gemma4-litert-first-request-ready',{reason,model:pick?.id||'',firstRequestOwned:true});
    return globalThis.CivweaveLocalChatRuntimeV295;
  })().catch(error=>{
    emit('civweave:gemma4-litert-first-request-failed',{reason,model:selected()?.id||'',code:error?.code||'LOCAL_GEMMA4_LITERT_STARTUP_FAILED',message:String(error?.message||error)});
    throw error;
  }).finally(()=>{ensureFlight=null});
  return ensureFlight;
}
function installAssistant(){
  const api=globalThis.CivweaveAssistantV141;
  if(!api?.respond)return false;
  if(api.respond.__civweaveGemma4LiteRTFirstRequest===VERSION){assistantTarget=api;return true}
  const prior=api.respond;
  const respond=async args=>{
    if(selectedFast())await ensure({onProgress:args?.onProgress,reason:'guide-request'});
    return prior.call(api,args);
  };
  respond.__civweaveGemma4LiteRTFirstRequest=VERSION;
  respond.__prior=prior;
  const next={...api,respond,gemma4LiteRTFirstRequestAuthority:VERSION};
  try{globalThis.CivweaveAssistantV141=next}catch{return false}
  assistantTarget=next;
  return true;
}
function schedule(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{queued=false;installAssistant()});
}
function prewarm(){
  if(!selectedFast())return Promise.resolve(false);
  return ensure({reason:'explicit-prewarm'}).then(()=>true,()=>false);
}
for(const name of ['civweave:assistant-runtime-ready','civweave:unified-chat-system-ready','civweave:local-model-selection','civweave:guide-loader-reset','pageshow'])addEventListener(name,schedule);
for(const delay of [0,40,160,500,1200,2600])setTimeout(schedule,delay);

globalThis.CivweaveGemma4LiteRTRequestAuthorityV1=Object.freeze({
  version:VERSION,
  fastRuntimeVersion:FAST_RUNTIME_VERSION,
  fastExtensionVersion:FAST_EXTENSION_VERSION,
  selected,selectedFast,ensure,prewarm,installAssistant,schedule,
  firstRequestOwnership:true,
  requestTriggeredOwnership:true,
  passivePrewarm:false,
  genericTransformersBypass:true,
  state:()=>Object.freeze({
    selected:selected()?.id||'',selectedFast:selectedFast(),localChatReady:localChatReady(),fastExtensionReady:fastExtensionReady(),fastRuntimeReady:fastRuntimeReady(),fastWrapperReady:fastWrapperReady(),ensuring:Boolean(ensureFlight),assistantWrapped:Boolean(assistantTarget)
  })
});
schedule();
})();