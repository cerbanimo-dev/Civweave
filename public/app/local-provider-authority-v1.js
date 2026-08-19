(()=>{
'use strict';

const VERSION='1.0.0-local-provider-authority-v1';
const PROFILE_KEY='civweave-model-profiles-v1';
const LEGACY_KEY='civweave.universal-ai.v127';
const LOCAL_SELECTION_KEY='civweave.local-ai.selection.v266';
const LOCAL_RUNTIME_SRC='/app/local-chat-runtime-v295.js?v=1.0.126-local-provider-authority';
const SYSTEMS=new Set(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
const LOCAL_PROVIDERS=new Set(['downloaded-local','generative-local','smollm2','smollm3','qwen','browser']);
const GUIDE=Object.freeze({
  civweave:{name:'Weaveling',mode:'Plan',role:'Quest guide and central orchestrator'},
  'living-school':{name:'Moss',mode:'Learn',role:'Learning Journey guide'},
  cerbanimo:{name:'Kamiya',mode:'Build',role:'Endeavor guide'},
  fellowfare:{name:'Rook',mode:'Acquire',role:'Manifest guide and Quartermaster'},
  anarchadia:{name:'Merlin',mode:'Govern',role:'civic and automation guide'}
});
const FALLBACK_TEXT_RE=/(?:could not finish this request with the selected local ai model|could not reach an available guild or cloudflare ai|deterministic(?:-| )local|kept this locally\.)/i;
let localRuntimePromise=null,assistantTarget=null,serverTarget=null,installTimer=0;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
function objectFrom(storage,key){try{const value=parse(storage.getItem(key),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return{}}}
function selectedLocal(){
  try{const live=globalThis.CivweaveLocalModelDownloadV266?.selection?.();if(live?.active&&live.id)return live}catch{}
  try{const saved=parse(localStorage.getItem(LOCAL_SELECTION_KEY),{});return saved?.active&&saved.id?saved:null}catch{return null}
}
function configuredInteractive(){
  try{const shared=globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive');if(shared&&typeof shared==='object')return shared}catch{}
  const profiles=objectFrom(localStorage,PROFILE_KEY);if(profiles.interactive&&typeof profiles.interactive==='object')return profiles.interactive;
  return objectFrom(localStorage,LEGACY_KEY);
}
function configuredProvider(){const value=configuredInteractive();return clean(value.provider||value.route,80).toLowerCase()}
function localPinned(){return Boolean(selectedLocal()||LOCAL_PROVIDERS.has(configuredProvider()))}
function systemFor(args={}){const value=clean(args.systemId||args?.context?.guide?.system,80).toLowerCase();return SYSTEMS.has(value)?value:'civweave'}
function guideFor(system){return GUIDE[SYSTEMS.has(system)?system:'civweave']}
function emit(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}}
function localControl(args={}){
  if(systemFor(args)!=='civweave')return false;
  const text=clean(args.text,300).toLowerCase().replace(/[.!?]+$/,'').trim();
  return /^(?:activate|activate it|activate quest|activate the quest|approve|approve it|review|review it|review quest|review the quest|revise|revise it|revise quest|revise the quest|pause|pause it|return to review)$/.test(text);
}
function explicitNetworkRequest(request={}){return request?.guildOnly===true||request?.__civweaveExplicitNetwork===true||request?.explicitNetwork===true}
function implicitGuideNetwork(request={}){
  if(explicitNetworkRequest(request))return false;
  const purpose=clean(request.purpose,300).toLowerCase();
  return request?.__civweaveNetworkRequired===true||/(?:guide-cloud-fallback|guide-response|weaveling-intention-json|high-tier-review|guide-capability-owner|structured-guide)/.test(purpose);
}
function historyRows(args={}){
  const rows=Array.isArray(args.history)?args.history:[];
  return rows.slice(-10).map(row=>({role:row?.role==='assistant'?'assistant':'user',content:clean(row?.content||row?.text,5000)})).filter(row=>row.content&&!FALLBACK_TEXT_RE.test(row.content)).slice(-6);
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
  try{const node=document.querySelector?.('#cw-persistent-guide-chat-v215 [data-minilm-decision-strip]');if(!node)return;node.dataset.state=state;const label=node.querySelector?.('span')||node;label.textContent=text}catch{}
}
function publishLocalRoute(system,model){
  const detail={schema:'civweave.response-route.v1',system,taskClass:'local-guide',artifactClass:null,networkRequired:false,confidence:1,source:'local-provider-authority-v1',provider:'downloaded-local',model,localProviderPinned:true};
  try{dispatchEvent(new CustomEvent('civweave:response-route',{detail}))}catch{}
  emit('civweave:local-provider-authority-route',detail);
  setDecisionStrip(`Local route · ${model||'downloaded model'} · provider pinned`,'local');
  return detail;
}
function localFailure(args,error){
  const system=systemFor(args),guide=guideFor(system),selected=selectedLocal(),message=clean(error?.message||error||'The selected local model did not finish.',1000),model=clean(selected?.id||configuredInteractive()?.model,240);
  setDecisionStrip(`Local route · ${model||'downloaded model'} · unavailable`,'error');
  emit('civweave:local-provider-authority-failed',{system,model,message,code:error?.code||'LOCAL_AI_UNAVAILABLE'});
  return{
    response:{answer:`${guide.name} could not finish this request with the selected local AI model. Civweave kept the request on this device and did not contact a Guild or Cloudflare AI.`,choice:{mode:guide.mode,system,room:'',nextAction:'Retry locally, choose another local model, or change the AI route in Settings if you want network processing.'},assumptions:[],requiresConsent:false,confidence:1},
    requestedProvider:'downloaded-local',provider:'local-ai-unavailable',model,usage:null,responseRouting:{schema:'civweave.response-route.v1',system,networkRequired:false,source:'local-provider-authority-v1',provider:'downloaded-local',localProviderPinned:true},fallbackFrom:{provider:'downloaded-local',reason:message},providerRouteFailure:{code:error?.code||'LOCAL_AI_UNAVAILABLE',message}
  };
}
function loadLocalRuntime(){
  if(globalThis.CivweaveLocalChatRuntimeV295?.generate)return Promise.resolve(globalThis.CivweaveLocalChatRuntimeV295);
  if(localRuntimePromise)return localRuntimePromise;
  localRuntimePromise=new Promise((resolve,reject)=>{
    const finish=()=>globalThis.CivweaveLocalChatRuntimeV295?.generate?resolve(globalThis.CivweaveLocalChatRuntimeV295):reject(Object.assign(new Error('The direct downloaded-local chat runtime did not become ready.'),{code:'LOCAL_CHAT_RUNTIME_UNAVAILABLE'}));
    const existing=[...(document.scripts||[])].find(node=>{try{return new URL(node.src,location.href).pathname==='/app/local-chat-runtime-v295.js'}catch{return false}});
    if(existing){if(globalThis.CivweaveLocalChatRuntimeV295?.generate){resolve(globalThis.CivweaveLocalChatRuntimeV295);return}existing.addEventListener?.('load',finish,{once:true});existing.addEventListener?.('error',()=>reject(Object.assign(new Error('The downloaded-local chat runtime failed to load.'),{code:'LOCAL_CHAT_RUNTIME_LOAD_FAILED'})),{once:true});setTimeout(finish,16000);return}
    const script=document.createElement('script');script.src=LOCAL_RUNTIME_SRC;script.async=false;script.onload=finish;script.onerror=()=>reject(Object.assign(new Error('The downloaded-local chat runtime failed to load.'),{code:'LOCAL_CHAT_RUNTIME_LOAD_FAILED'}));document.head?.append(script);setTimeout(finish,16000);
  }).finally(()=>{localRuntimePromise=null});
  return localRuntimePromise;
}
async function localRespond(args={}){
  const system=systemFor(args),guide=guideFor(system),selected=selectedLocal(),model=clean(selected?.id||configuredInteractive()?.model,240);
  if(!selected?.id&&!model)return localFailure(args,Object.assign(new Error('No downloaded local model is selected.'),{code:'LOCAL_MODEL_NOT_SELECTED'}));
  try{
    const runtime=await loadLocalRuntime(),history=historyRows(args),text=clean(args.text,12000),messages=[...history];
    if(text&&!(messages.at(-1)?.role==='user'&&messages.at(-1)?.content===text))messages.push({role:'user',content:text});
    const result=await runtime.generate({systemPrompt:systemPrompt(system),messages,onToken:typeof args.onToken==='function'?args.onToken:undefined,onProgress:typeof args.onProgress==='function'?args.onProgress:undefined});
    if(result?.status&&!['success','fallback'].includes(result.status))throw Object.assign(new Error(result?.error?.message||`Local provider ended with ${result.status}.`),{code:result?.error?.code||'LOCAL_MODEL_GENERATION_FAILED'});
    const answer=outputText(result);if(!answer)throw Object.assign(new Error('The selected local model returned no text.'),{code:'LOCAL_MODEL_EMPTY_RESPONSE'});
    const route=publishLocalRoute(system,model);
    return{response:{answer,choice:{mode:guide.mode,system,room:'',nextAction:''},assumptions:[],requiresConsent:false,confidence:.8},requestedProvider:'downloaded-local',provider:'downloaded-local',model,usage:result?.usage||null,responseRouting:route,fallbackFrom:null,context:{localProviderAuthority:{version:VERSION,pinned:true,direct:true}}};
  }catch(error){return localFailure(args,error)}
}
function installAssistant(){
  const api=globalThis.CivweaveAssistantV141,current=api?.respond;if(!api||typeof current!=='function')return false;
  if(current.__civweaveLocalProviderAuthorityV1){assistantTarget=api;return true}
  const previousFn=current,previous=previousFn.bind(api);
  const respond=async args=>{
    if(!localPinned()||explicitNetworkRequest(args)||localControl(args))return previous(args);
    return localRespond(args||{});
  };
  respond.__civweaveLocalProviderAuthorityV1=true;respond.__prior=previousFn;
  try{api.respond=respond}catch{}
  if(api.respond!==respond){try{globalThis.CivweaveAssistantV141={...api,respond}}catch{return false}}
  assistantTarget=globalThis.CivweaveAssistantV141;
  emit('civweave:local-provider-authority-installed',{surface:'assistant'});
  return true;
}
function installServerGuard(){
  const router=globalThis.CivweaveServerAIRouterV301,current=router?.handle;if(!router||typeof current!=='function')return false;
  if(current.__civweaveLocalProviderAuthorityV1){serverTarget=router;return true}
  const previousFn=current,previous=previousFn.bind(router);
  const handle=async request=>{
    if(localPinned()&&implicitGuideNetwork(request)){
      const purpose=clean(request?.purpose,300),model=clean(selectedLocal()?.id||configuredInteractive()?.model,240);
      emit('civweave:local-provider-authority-blocked-network',{purpose,model});
      return{handled:false,blocked:true,reason:'LOCAL_PROVIDER_PINNED',result:null,diagnostics:[{code:'LOCAL_PROVIDER_PINNED',message:'Automatic Guild/Cloudflare guide routing is disabled while downloaded-local is selected.',purpose}]};
    }
    return previous(request);
  };
  handle.__civweaveLocalProviderAuthorityV1=true;handle.__prior=previousFn;
  try{router.handle=handle}catch{}
  if(router.handle!==handle){try{globalThis.CivweaveServerAIRouterV301={...router,handle}}catch{return false}}
  serverTarget=globalThis.CivweaveServerAIRouterV301;
  emit('civweave:local-provider-authority-installed',{surface:'server-router'});
  return true;
}
function guardWeavelingOrchestratorApi(api){
  if(!api||typeof api!=='object')return api;
  if(api.__civweaveLocalProviderAuthorityV1)return api;
  const original=api.install;
  if(typeof original==='function'){
    const install=function(...args){const result=original.apply(api,args);queueMicrotask(installAssistant);return result};
    install.__civweaveLocalProviderAuthorityV1=true;install.__prior=original;
    try{api.install=install}catch{try{api={...api,install}}catch{}}
  }
  try{Object.defineProperty(api,'__civweaveLocalProviderAuthorityV1',{value:true,configurable:true})}catch{try{api.__civweaveLocalProviderAuthorityV1=true}catch{}}
  return api;
}
function watchWeavelingOrchestrator(){
  const key='CivweaveWeavelingPlanJsonV190',existing=globalThis[key],descriptor=Object.getOwnPropertyDescriptor(globalThis,key);
  if(existing){const guarded=guardWeavelingOrchestratorApi(existing);if(guarded!==existing)try{globalThis[key]=guarded}catch{};queueMicrotask(installAssistant);return true}
  if(descriptor&&!descriptor.configurable)return false;
  let value;
  try{Object.defineProperty(globalThis,key,{configurable:true,enumerable:true,get(){return value},set(next){value=guardWeavelingOrchestratorApi(next);queueMicrotask(installAssistant)}});return true}catch{return false}
}
function install(){watchWeavelingOrchestrator();installAssistant();installServerGuard();return true}
for(const name of ['civweave:assistant-runtime-ready','civweave:guide-loader-reset','civweave:response-router-installed','civweave:unified-chat-system-ready','civweave:guide-capability-passover-ready','civweave:model-config-changed','civweave:local-model-runtime-ready','pageshow'])addEventListener(name,()=>queueMicrotask(install));
install();let attempts=0;installTimer=setInterval(()=>{attempts+=1;install();if(attempts>=240)clearInterval(installTimer)},125);addEventListener('pagehide',()=>clearInterval(installTimer),{once:true});

globalThis.CivweaveLocalProviderAuthorityV1=Object.freeze({version:VERSION,install,localPinned,configuredProvider,selectedLocal,localRespond,implicitGuideNetwork,watchWeavelingOrchestrator,localProviderPinned:true,directLocalGuideExecution:true,implicitGuideNetworkBlocked:true,latePlannerRewrap:true,cloudFallbackWhenLocal:false,deterministicFallbackWhenLocal:false});
})();
