(()=>{
'use strict';

const VERSION='1.0.3-local-provider-authority-v1-inference-core-first';
const PROFILE_KEY='civweave-model-profiles-v1';
const LEGACY_KEY='civweave.universal-ai.v127';
const LOCAL_SELECTION_KEY='civweave.local-ai.selection.v266';
const LOCAL_RUNTIME_SRC='/app/local-chat-runtime-v295.js?v=1.0.130-v325-inference-core-first';
const LOCAL_RUNTIME_REVISION='v312-runtime-first-bootstrap';
const SYSTEMS=new Set(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
const LOCAL_PROVIDERS=new Set(['downloaded-local','generative-local','smollm2','smollm3','qwen','browser']);
const GEMMA4_MOBILE_IDS=new Set(['gemma4-e2b-it-q2f16-mobile','gemma4-e4b-it-q2f16-mobile']);
const GEMMA4_RUNTIME_FLOOR='4.3.0';
const BUNDLED_TRANSFORMERS_V4='4.2.0';
const GEMMA4_LOCAL_FALLBACK_IDS=Object.freeze([
  'gemma3-1b-it-q4f16',
  'qwen3-1.7b-q4f16',
  'qwen3-0.6b-q4f16',
  'smollm2-360m-instruct-q4f16',
  'smollm2-135m-instruct-q8-wasm',
  'qwen3-0.6b-q8-wasm'
]);
const GUIDE=Object.freeze({
  civweave:{name:'Weaveling',mode:'Plan',role:'Quest guide and central orchestrator'},
  'living-school':{name:'Moss',mode:'Learn',role:'Learning Journey guide'},
  cerbanimo:{name:'Kamiya',mode:'Build',role:'Endeavor guide'},
  fellowfare:{name:'Rook',mode:'Acquire',role:'Manifest guide and Quartermaster'},
  anarchadia:{name:'Merlin',mode:'Govern',role:'civic and automation guide'}
});
const FALLBACK_TEXT_RE=/(?:could not finish this request with the selected local ai model|could not reach an available guild or cloudflare ai|deterministic(?:-| )local|kept this locally\.)/i;

let localRuntimePromise=null;
let assistantTarget=null;
let serverTarget=null;
let registryTarget=null;
let installTimer=0;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};

function objectFrom(storage,key){
  try{
    const value=parse(storage.getItem(key),{});
    return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  }catch{return{}}
}
function selectedLocal(){
  try{
    const live=globalThis.CivweaveLocalModelDownloadV266?.selection?.();
    if(live?.active&&live.id)return live;
  }catch{}
  try{
    const saved=parse(localStorage.getItem(LOCAL_SELECTION_KEY),{});
    return saved?.active&&saved.id?saved:null;
  }catch{return null}
}
function configuredInteractive(){
  try{
    const shared=globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive');
    if(shared&&typeof shared==='object')return shared;
  }catch{}
  const profiles=objectFrom(localStorage,PROFILE_KEY);
  if(profiles.interactive&&typeof profiles.interactive==='object')return profiles.interactive;
  return objectFrom(localStorage,LEGACY_KEY);
}
function configuredProvider(){
  const value=configuredInteractive();
  return clean(value.provider||value.route,80).toLowerCase();
}
function localPinned(){
  return Boolean(selectedLocal()||LOCAL_PROVIDERS.has(configuredProvider()));
}
function systemFor(args={}){
  const value=clean(args.systemId||args?.context?.guide?.system,80).toLowerCase();
  return SYSTEMS.has(value)?value:'civweave';
}
function guideFor(system){
  return GUIDE[SYSTEMS.has(system)?system:'civweave'];
}
function emit(type,detail={}){
  try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}
}
function localControl(args={}){
  if(systemFor(args)!=='civweave')return false;
  const text=clean(args.text,300).toLowerCase().replace(/[.!?]+$/,'').trim();
  return /^(?:activate|activate it|activate quest|activate the quest|approve|approve it|review|review it|review quest|review the quest|revise|revise it|revise quest|revise the quest|pause|pause it|return to review)$/.test(text);
}
function explicitNetworkRequest(request={}){
  return request?.guildOnly===true||request?.__civweaveExplicitNetwork===true||request?.explicitNetwork===true;
}
function implicitGuideNetwork(request={}){
  if(explicitNetworkRequest(request))return false;
  const purpose=clean(request.purpose,300).toLowerCase();
  return request?.__civweaveNetworkRequired===true||
    /(?:guide-cloud-fallback|guide-response|weaveling-intention-json|high-tier-review|guide-capability-owner|structured-guide)/.test(purpose);
}
function historyRows(args={}){
  const rows=Array.isArray(args.history)?args.history:[];
  return rows.slice(-10)
    .map(row=>({role:row?.role==='assistant'?'assistant':'user',content:clean(row?.content||row?.text,5000)}))
    .filter(row=>row.content&&!FALLBACK_TEXT_RE.test(row.content))
    .slice(-6);
}
function systemPrompt(system){
  const guide=guideFor(system);
  return `You are ${guide.name}, ${guide.role} in Civweave. The Hero explicitly selected a downloaded local AI model. Answer the current message directly using only this on-device model. Do not claim network access, saved state, tool use, activation, purchases, votes, or other app actions unless the supplied conversation explicitly proves they happened. If the local model cannot complete something, say so plainly instead of pretending another provider handled it.`;
}
function outputText(result){
  if(typeof result==='string')return clean(result,120000);
  const json=result?.outputJson;
  if(json&&typeof json==='object')return clean(json.answer||json.text||json.message||'',120000);
  return clean(result?.outputText||result?.text||result?.output||result?.generatedText||result?.message,120000);
}
function setDecisionStrip(text,state='local'){
  try{
    const node=document.querySelector?.('#cw-persistent-guide-chat-v215 [data-minilm-decision-strip]');
    if(!node)return;
    node.dataset.state=state;
    const label=node.querySelector?.('span')||node;
    label.textContent=text;
  }catch{}
}
function publishLocalRoute(system,model,extra={}){
  const detail={
    schema:'civweave.response-route.v1',
    system,
    taskClass:'local-guide',
    artifactClass:null,
    networkRequired:false,
    confidence:1,
    source:'local-provider-authority-v1',
    provider:'downloaded-local',
    model,
    localProviderPinned:true,
    ...extra
  };
  try{dispatchEvent(new CustomEvent('civweave:response-route',{detail}))}catch{}
  emit('civweave:local-provider-authority-route',detail);
  setDecisionStrip(
    extra.localTierFallback
      ?`Local route · ${model||'downloaded model'} · local fallback from ${extra.requestedModel||'selected model'}`
      :`Local route · ${model||'downloaded model'} · provider pinned`,
    'local'
  );
  return detail;
}
function runtimeFloorError(model){
  return Object.assign(
    new Error(`${model||'The selected Gemma 4 mobile model'} uses the Q2F16 mobile graph, which requires Transformers.js ${GEMMA4_RUNTIME_FLOOR} or newer. Civweave currently bundles Transformers.js ${BUNDLED_TRANSFORMERS_V4}. The model pack can stay installed, but this runtime cannot execute it yet. Install or select another downloaded local model until the browser runtime is upgraded.`),
    {code:'LOCAL_MODEL_RUNTIME_TOO_OLD',requiredRuntime:GEMMA4_RUNTIME_FLOOR,bundledRuntime:BUNDLED_TRANSFORMERS_V4,model}
  );
}
function localFailure(args,error){
  const system=systemFor(args);
  const guide=guideFor(system);
  const selected=selectedLocal();
  const message=clean(error?.message||error||'The selected local model did not finish.',1600);
  const model=clean(selected?.id||configuredInteractive()?.model,240);
  const runtimeFloor=error?.code==='LOCAL_MODEL_RUNTIME_TOO_OLD';
  setDecisionStrip(`Local route · ${model||'downloaded model'} · unavailable`,'error');
  emit('civweave:local-provider-authority-failed',{system,model,message,code:error?.code||'LOCAL_AI_UNAVAILABLE'});
  return{
    response:{
      answer:`${guide.name} could not finish this request with the selected local AI model. Civweave kept the request on this device and did not contact a Guild or Cloudflare AI.\n\nLocal runtime detail: ${message}`,
      choice:{
        mode:guide.mode,
        system,
        room:'',
        nextAction:runtimeFloor
          ?'Select an already-installed compatible local model. The Gemma 4 pack can remain installed until Civweave upgrades its Transformers.js runtime.'
          :'Retry locally, choose another local model, or change the AI route in Settings if you want network processing.'
      },
      assumptions:[],
      requiresConsent:false,
      confidence:1
    },
    requestedProvider:'downloaded-local',
    provider:'local-ai-unavailable',
    model,
    usage:null,
    responseRouting:{
      schema:'civweave.response-route.v1',
      system,
      networkRequired:false,
      source:'local-provider-authority-v1',
      provider:'downloaded-local',
      localProviderPinned:true
    },
    fallbackFrom:{provider:'downloaded-local',reason:message},
    providerRouteFailure:{
      code:error?.code||'LOCAL_AI_UNAVAILABLE',
      message,
      requiredRuntime:error?.requiredRuntime||null,
      bundledRuntime:error?.bundledRuntime||null,
      component:error?.component||null
    }
  };
}
function localRuntimeReady(){
  const runtime=globalThis.CivweaveLocalChatRuntimeV295;
  return Boolean(
    runtime?.generate&&
    runtime?.revision===LOCAL_RUNTIME_REVISION&&
    runtime?.inferenceCoreFirst===true&&
    runtime?.fullBootstrapBlocking===false
  );
}
function evictStaleLocalRuntime(){
  if(localRuntimeReady())return false;
  const stale=globalThis.CivweaveLocalChatRuntimeV295;
  if(stale)try{delete globalThis.CivweaveLocalChatRuntimeV295}catch{globalThis.CivweaveLocalChatRuntimeV295=undefined}
  for(const node of [...(document.scripts||[])]){
    try{
      if(new URL(node.src,location.href).pathname==='/app/local-chat-runtime-v295.js')node.remove?.();
    }catch{}
  }
  return Boolean(stale);
}
function loadLocalRuntime(){
  if(localRuntimeReady())return Promise.resolve(globalThis.CivweaveLocalChatRuntimeV295);
  if(localRuntimePromise)return localRuntimePromise;
  evictStaleLocalRuntime();
  localRuntimePromise=new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(ok,error)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      ok?resolve(globalThis.CivweaveLocalChatRuntimeV295):reject(error);
    };
    const script=document.createElement('script');
    const timer=setTimeout(
      ()=>finish(false,Object.assign(new Error('The downloaded-local chat runtime did not become inference-core ready.'),{code:'LOCAL_CHAT_RUNTIME_UNAVAILABLE'})),
      18000
    );
    script.src=`${LOCAL_RUNTIME_SRC}&ts=${Date.now()}`;
    script.async=false;
    script.dataset.civweaveLocalProviderAuthority='v1.0.3';
    script.onload=()=>finish(
      localRuntimeReady(),
      Object.assign(new Error('The downloaded-local chat runtime loaded without the inference-core-first contract.'),{code:'LOCAL_CHAT_RUNTIME_CONTRACT_FAILED'})
    );
    script.onerror=()=>finish(false,Object.assign(new Error('The downloaded-local chat runtime failed to load.'),{code:'LOCAL_CHAT_RUNTIME_LOAD_FAILED'}));
    const head=document.head;
    if(!head?.isConnected){
      finish(false,Object.assign(new Error('The downloaded-local chat runtime could not mount because the document is leaving.'),{code:'LOCAL_CHAT_RUNTIME_LOAD_FAILED'}));
      return;
    }
    head.append(script);
  }).finally(()=>{localRuntimePromise=null});
  return localRuntimePromise;
}
function patchGemma4Registry(){
  const registry=globalThis.CivweaveLocalModelRegistryV266;
  if(!registry?.models){
    registryTarget=registry||registryTarget;
    return Boolean(registry);
  }
  if(registry.__civweaveGemma4RuntimeFloorV1){
    registryTarget=registry;
    return true;
  }
  const replacements=new Map();
  for(const model of registry.models){
    if(!GEMMA4_MOBILE_IDS.has(model?.id))continue;
    replacements.set(model.id,Object.freeze({
      ...model,
      status:'runtime-blocked',
      recommended:'',
      runtimeRequirement:Object.freeze({
        package:'@huggingface/transformers',
        minimumVersion:GEMMA4_RUNTIME_FLOOR,
        bundledVersion:BUNDLED_TRANSFORMERS_V4,
        feature:'2-bit-gather'
      }),
      reason:`This Q2F16 mobile graph requires Transformers.js ${GEMMA4_RUNTIME_FLOOR}+; Civweave currently bundles ${BUNDLED_TRANSFORMERS_V4}.`,
      fallbackIds:Object.freeze([...GEMMA4_LOCAL_FALLBACK_IDS])
    }));
  }
  const models=Object.freeze(registry.models.map(model=>replacements.get(model?.id)||model));
  const runtimeModels=Object.freeze(registry.runtimeModels||[]);
  const map=new Map([...models,...runtimeModels].map(model=>[model.id,model]));
  const byId=id=>map.get(id)||null;
  const fallbacks=modelOrId=>{
    const model=typeof modelOrId==='string'?byId(modelOrId):byId(modelOrId?.id)||modelOrId;
    return (model?.fallbackIds||[]).map(byId).filter(Boolean);
  };
  const installable=()=>models.filter(model=>model.installable);
  const experimental=()=>models.filter(model=>!model.installable);
  const capable=request=>{
    try{return (registry.capable?.(request)||[]).map(model=>byId(model.id)||model)}
    catch{return[]}
  };
  try{
    globalThis.CivweaveLocalModelRegistryV266=Object.freeze({
      ...registry,
      models,
      runtimeModels,
      byId,
      fallbacks,
      installable,
      experimental,
      capable,
      __civweaveGemma4RuntimeFloorV1:true,
      gemma4MobileRuntimeFloor:GEMMA4_RUNTIME_FLOOR,
      gemma4MobileBundledRuntime:BUNDLED_TRANSFORMERS_V4,
      gemma4MobileRuntimeBlocked:true
    });
  }catch{return false}
  registryTarget=globalThis.CivweaveLocalModelRegistryV266;
  emit('civweave:gemma4-mobile-runtime-floor',{
    required:GEMMA4_RUNTIME_FLOOR,
    bundled:BUNDLED_TRANSFORMERS_V4,
    fallbackIds:[...GEMMA4_LOCAL_FALLBACK_IDS]
  });
  return true;
}
async function installedGemma4Fallback(){
  patchGemma4Registry();
  const manager=globalThis.CivweaveLocalModelDownloadV266;
  const registry=globalThis.CivweaveLocalModelRegistryV266;
  if(!manager?.status||!registry?.byId)return null;
  for(const id of GEMMA4_LOCAL_FALLBACK_IDS){
    const spec=registry.byId(id);
    if(!spec)continue;
    try{
      const status=await manager.status(id);
      if(status?.available)return spec;
    }catch{}
  }
  return null;
}
async function runLocalModel(runtime,args,messages,requestedModel){
  const generateArgs={
    systemPrompt:systemPrompt(systemFor(args)),
    messages,
    onToken:typeof args.onToken==='function'?args.onToken:undefined,
    onProgress:typeof args.onProgress==='function'?args.onProgress:undefined
  };
  if(!GEMMA4_MOBILE_IDS.has(requestedModel)){
    return{result:await runtime.generate(generateArgs),requestedModel,executedModel:requestedModel,localTierFallback:false};
  }

  await runtime.ready?.(generateArgs.onProgress);
  patchGemma4Registry();
  const fallback=await installedGemma4Fallback();
  if(!fallback)throw runtimeFloorError(requestedModel);

  const manager=globalThis.CivweaveLocalModelDownloadV266;
  const original=manager?.selection?.()||selectedLocal();
  if(!manager?.select)throw runtimeFloorError(requestedModel);

  emit('civweave:gemma4-local-tier-fallback',{
    requestedModel,
    model:fallback.id,
    requiredRuntime:GEMMA4_RUNTIME_FLOOR,
    bundledRuntime:BUNDLED_TRANSFORMERS_V4
  });
  setDecisionStrip(`Local route · ${requestedModel} · using installed local fallback ${fallback.id}`,'local');
  manager.select(fallback.id);
  try{
    const result=await runtime.generate(generateArgs);
    const executedModel=clean(result?.executionId||result?.id||fallback.id,240)||fallback.id;
    return{
      result,
      requestedModel,
      executedModel,
      localTierFallback:true,
      fallbackReason:`${requestedModel} requires Transformers.js ${GEMMA4_RUNTIME_FLOOR}+; Civweave ${BUNDLED_TRANSFORMERS_V4} used the already-installed local fallback ${executedModel}.`
    };
  }finally{
    try{
      if(original?.active&&original.id)manager.select(original.id);
      else manager.select(null);
    }catch{}
  }
}
async function localRespond(args={}){
  const system=systemFor(args);
  const guide=guideFor(system);
  const selected=selectedLocal();
  const requestedModel=clean(selected?.id||configuredInteractive()?.model,240);
  if(!selected?.id&&!requestedModel){
    return localFailure(args,Object.assign(new Error('No downloaded local model is selected.'),{code:'LOCAL_MODEL_NOT_SELECTED'}));
  }
  setDecisionStrip(`Local route · ${requestedModel||'downloaded model'} · starting on-device`,'local');
  try{
    const runtime=await loadLocalRuntime();
    const history=historyRows(args);
    const text=clean(args.text,12000);
    const messages=[...history];
    if(text&&!(messages.at(-1)?.role==='user'&&messages.at(-1)?.content===text)){
      messages.push({role:'user',content:text});
    }
    const run=await runLocalModel(runtime,args,messages,requestedModel);
    const result=run.result;
    if(result?.status&&!['success','fallback'].includes(result.status)){
      throw Object.assign(new Error(result?.error?.message||`Local provider ended with ${result.status}.`),{code:result?.error?.code||'LOCAL_MODEL_GENERATION_FAILED'});
    }
    const answer=outputText(result);
    if(!answer)throw Object.assign(new Error('The selected local model returned no text.'),{code:'LOCAL_MODEL_EMPTY_RESPONSE'});
    const route=publishLocalRoute(system,run.executedModel,{
      requestedModel,
      localTierFallback:run.localTierFallback,
      fallbackReason:run.fallbackReason||null
    });
    return{
      response:{answer,choice:{mode:guide.mode,system,room:'',nextAction:''},assumptions:[],requiresConsent:false,confidence:.8},
      requestedProvider:'downloaded-local',
      provider:'downloaded-local',
      model:run.executedModel,
      usage:result?.usage||null,
      responseRouting:route,
      fallbackFrom:run.localTierFallback?{provider:'downloaded-local',model:requestedModel,reason:run.fallbackReason}:null,
      context:{localProviderAuthority:{version:VERSION,pinned:true,direct:true,inferenceCoreFirst:true}}
    };
  }catch(error){
    return localFailure(args,error);
  }
}
function installAssistant(){
  const api=globalThis.CivweaveAssistantV141;
  const current=api?.respond;
  if(!api||typeof current!=='function')return false;
  if(current.__civweaveLocalProviderAuthorityV1&&current.__civweaveLocalProviderAuthorityVersion===VERSION){
    assistantTarget=api;
    return true;
  }
  const baseFn=current.__civweaveLocalProviderAuthorityV1&&current.__prior?current.__prior:current;
  const previous=baseFn.bind(api);
  const respond=async args=>{
    if(!localPinned()||explicitNetworkRequest(args)||localControl(args))return previous(args);
    return localRespond(args||{});
  };
  respond.__civweaveLocalProviderAuthorityV1=true;
  respond.__civweaveLocalProviderAuthorityVersion=VERSION;
  respond.__prior=baseFn;
  try{api.respond=respond}catch{}
  if(api.respond!==respond){
    try{globalThis.CivweaveAssistantV141={...api,respond}}catch{return false}
  }
  assistantTarget=globalThis.CivweaveAssistantV141;
  emit('civweave:local-provider-authority-installed',{surface:'assistant',inferenceCoreFirst:true});
  return true;
}
function installServerGuard(){
  const router=globalThis.CivweaveServerAIRouterV301;
  const current=router?.handle;
  if(!router||typeof current!=='function')return false;
  if(current.__civweaveLocalProviderAuthorityV1&&current.__civweaveLocalProviderAuthorityVersion===VERSION){
    serverTarget=router;
    return true;
  }
  const baseFn=current.__civweaveLocalProviderAuthorityV1&&current.__prior?current.__prior:current;
  const previous=baseFn.bind(router);
  const handle=async request=>{
    if(localPinned()&&implicitGuideNetwork(request)){
      const purpose=clean(request?.purpose,300);
      const model=clean(selectedLocal()?.id||configuredInteractive()?.model,240);
      emit('civweave:local-provider-authority-blocked-network',{purpose,model});
      return{
        handled:false,
        blocked:true,
        reason:'LOCAL_PROVIDER_PINNED',
        result:null,
        diagnostics:[{code:'LOCAL_PROVIDER_PINNED',message:'Automatic Guild/Cloudflare guide routing is disabled while downloaded-local is selected.',purpose}]
      };
    }
    return previous(request);
  };
  handle.__civweaveLocalProviderAuthorityV1=true;
  handle.__civweaveLocalProviderAuthorityVersion=VERSION;
  handle.__prior=baseFn;
  try{router.handle=handle}catch{}
  if(router.handle!==handle){
    try{globalThis.CivweaveServerAIRouterV301={...router,handle}}catch{return false}
  }
  serverTarget=globalThis.CivweaveServerAIRouterV301;
  emit('civweave:local-provider-authority-installed',{surface:'server-router'});
  return true;
}
function guardWeavelingOrchestratorApi(api){
  if(!api||typeof api!=='object')return api;
  if(api.__civweaveLocalProviderAuthorityVersion===VERSION)return api;
  const original=api.install;
  if(typeof original==='function'){
    const install=function(...args){
      const result=original.apply(api,args);
      queueMicrotask(installAssistant);
      return result;
    };
    install.__civweaveLocalProviderAuthorityV1=true;
    install.__civweaveLocalProviderAuthorityVersion=VERSION;
    install.__prior=original;
    try{api.install=install}catch{try{api={...api,install}}catch{}}
  }
  try{
    Object.defineProperty(api,'__civweaveLocalProviderAuthorityV1',{value:true,configurable:true});
    Object.defineProperty(api,'__civweaveLocalProviderAuthorityVersion',{value:VERSION,configurable:true});
  }catch{
    try{
      api.__civweaveLocalProviderAuthorityV1=true;
      api.__civweaveLocalProviderAuthorityVersion=VERSION;
    }catch{}
  }
  return api;
}
function watchWeavelingOrchestrator(){
  const key='CivweaveWeavelingPlanJsonV190';
  const existing=globalThis[key];
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);
  if(existing){
    const guarded=guardWeavelingOrchestratorApi(existing);
    if(guarded!==existing)try{globalThis[key]=guarded}catch{}
    queueMicrotask(installAssistant);
    return true;
  }
  if(descriptor&&!descriptor.configurable)return false;
  let value;
  try{
    Object.defineProperty(globalThis,key,{
      configurable:true,
      enumerable:true,
      get(){return value},
      set(next){
        value=guardWeavelingOrchestratorApi(next);
        queueMicrotask(installAssistant);
      }
    });
    return true;
  }catch{return false}
}
function install(){
  watchWeavelingOrchestrator();
  patchGemma4Registry();
  installAssistant();
  installServerGuard();
  return true;
}

for(const name of [
  'civweave:assistant-runtime-ready',
  'civweave:guide-loader-reset',
  'civweave:response-router-installed',
  'civweave:unified-chat-system-ready',
  'civweave:guide-capability-passover-ready',
  'civweave:model-config-changed',
  'civweave:local-model-runtime-ready',
  'civweave:local-model-registry-ready',
  'pageshow'
])addEventListener(name,()=>queueMicrotask(install));

install();
let attempts=0;
installTimer=setInterval(()=>{
  attempts+=1;
  install();
  if(attempts>=240)clearInterval(installTimer);
},125);
addEventListener('pagehide',()=>clearInterval(installTimer),{once:true});

globalThis.CivweaveLocalProviderAuthorityV1=Object.freeze({
  version:VERSION,
  install,
  localPinned,
  configuredProvider,
  selectedLocal,
  localRespond,
  implicitGuideNetwork,
  watchWeavelingOrchestrator,
  patchGemma4Registry,
  installedGemma4Fallback,
  gemma4MobileRuntimeFloor:GEMMA4_RUNTIME_FLOOR,
  bundledTransformersV4:BUNDLED_TRANSFORMERS_V4,
  gemma4LocalFallbackIds:GEMMA4_LOCAL_FALLBACK_IDS,
  localProviderPinned:true,
  directLocalGuideExecution:true,
  implicitGuideNetworkBlocked:true,
  latePlannerRewrap:true,
  inferenceCoreFirst:true,
  staleLocalRuntimeEvicted:true,
  cloudFallbackWhenLocal:false,
  deterministicFallbackWhenLocal:false
});
})();
