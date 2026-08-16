(()=>{
'use strict';

const VERSION='1.0.0-guide-provider-policy-v1';
const SETTINGS_KEY='civweave.universal-ai.v127';
const PROFILES_KEY='civweave-model-profiles-v1';
const SERVER_ORDER=Object.freeze(['device-local','server-local','cloudflare-workers-ai']);
const SYSTEMS=new Set(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
let patchedRuntime=null,patchedAssistant=null;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
function objectFrom(storage,key){try{const value=parse(storage.getItem(key),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return{}}}
function configuredInteractive(){
  let shared=null;
  try{shared=globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive')||null}catch{}
  const profiles=objectFrom(localStorage,PROFILES_KEY),legacy=objectFrom(localStorage,SETTINGS_KEY),raw=shared||(profiles.interactive&&typeof profiles.interactive==='object'?profiles.interactive:legacy)||{};
  return raw&&typeof raw==='object'?raw:{};
}
function configuredRoute(){const raw=configuredInteractive();return clean(raw.provider||raw.route,80).toLowerCase()}
function serverAutoConfigured(){return configuredRoute()==='server-auto'}
function selectedLocal(){
  try{const live=globalThis.CivweaveLocalModelDownloadV266?.selection?.();if(live?.active&&live?.id)return live}catch{}
  try{const saved=parse(localStorage.getItem('civweave.local-ai.selection.v266'),{});return saved?.active&&saved?.id?saved:null}catch{return null}
}
function isGuideRequest(request={}){const purpose=clean(request.purpose,220);return /(?:^civweave-guide-response(?:-v141)?$|-guide-chat-v350$)/.test(purpose)}
function serverAutoConfig(request={}){
  const configured=configuredInteractive(),existing=request.config&&typeof request.config==='object'?request.config:{};
  return{...existing,...configured,provider:'server-auto',route:'server-auto',model:'civweave-server-auto-v1',externalConsent:true,serverOrder:[...SERVER_ORDER]};
}
function normalizeGuideRequest(request={}){
  if(!serverAutoConfigured()||!isGuideRequest(request))return request;
  const explicit=clean(request?.config?.provider||request?.config?.route,80).toLowerCase();
  if(explicit&&!['downloaded-local','server-auto','deterministic'].includes(explicit))return request;
  return{...request,config:serverAutoConfig(request),__civweaveGuideProviderPolicyV1:true,providerPolicy:{schema:'civweave.guide-provider-policy.v1',primary:'server-auto',order:[...SERVER_ORDER],selectedLocalModel:selectedLocal()?.id||'',networkRequired:Boolean(request.__civweaveNetworkRequired)}};
}
function emit(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}}
function patchRuntime(){
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate)return false;
  if(runtime.__civweaveGuideProviderPolicyV1){patchedRuntime=runtime;return true}
  if(patchedRuntime===runtime)return true;
  const previous=runtime.generate.bind(runtime);
  const generate=async request=>{
    const normalized=normalizeGuideRequest(request||{});
    if(normalized!==request)emit('civweave:guide-provider-policy-route',{purpose:clean(request?.purpose,220),configured:'server-auto',selectedLocalModel:selectedLocal()?.id||'',networkRequired:Boolean(normalized.__civweaveNetworkRequired)});
    return previous(normalized);
  };
  try{Object.defineProperty(generate,'__prior',{value:previous,configurable:false})}catch{}
  globalThis.CivweaveModelRuntime={...runtime,generate,__civweaveGuideProviderPolicyV1:true,guideProviderPolicyVersion:VERSION};
  patchedRuntime=globalThis.CivweaveModelRuntime;
  emit('civweave:guide-provider-policy-runtime',{installed:true});
  return true;
}
function guideName(system){return system==='living-school'?'Moss':system==='cerbanimo'?'Kamiya':system==='fellowfare'?'Rook':system==='anarchadia'?'Merlin':'Weaveling'}
function unavailableResult(args={},error,result=null){
  const system=SYSTEMS.has(args.systemId)?args.systemId:'civweave',name=guideName(system),message=clean(error?.message||error||result?.fallbackFrom?.reason||'No permitted server-side AI route completed the request.',900);
  return{response:{answer:`${name} could not complete this through server-side AI. The selected device model, paired Guild host, and capacity-backed Cloudflare route were unavailable or could not finish the call. Your prompt was not replaced with a deterministic answer.`,choice:{mode:system==='living-school'?'Learn':system==='cerbanimo'?'Build':system==='fellowfare'?'Acquire':system==='anarchadia'?'Govern':'Reflect',system,room:result?.context?.currentContext?.roomId||'',nextAction:'Retry when a model route is available, or change the AI route in Settings.'},assumptions:[],requiresConsent:false,confidence:1},requestedProvider:'server-auto',provider:'server-auto-unavailable',model:'',usage:null,responseRouting:result?.responseRouting||null,fallbackFrom:{provider:'server-auto',reason:message},context:result?.context||null,providerRouteFailure:{code:error?.code||'SERVER_AUTO_UNAVAILABLE',message}};
}
function resultShowsServerFailure(result){return Boolean(result&&(result.requestedProvider==='server-auto'||result?.fallbackFrom?.provider==='server-auto')&&['local-contract','deterministic-local','server-auto-unavailable'].includes(clean(result.provider,120)))}
function effectiveSelectedConfig(original){
  if(!serverAutoConfigured())return original?.()||{};
  const local=selectedLocal();return{...configuredInteractive(),provider:'server-auto',route:'server-auto',model:'civweave-server-auto-v1',externalConsent:true,serverOrder:[...SERVER_ORDER],selectedLocalModel:local?.id||''};
}
function patchAssistant(){
  const assistant=globalThis.CivweaveAssistantV141;
  if(!assistant?.respond)return false;
  if(assistant.__civweaveGuideProviderPolicyV1){patchedAssistant=assistant;return true}
  if(patchedAssistant===assistant)return true;
  const previousRespond=assistant.respond.bind(assistant),previousSelected=typeof assistant.selectedConfig==='function'?assistant.selectedConfig.bind(assistant):null;
  const respond=async args=>{
    if(!serverAutoConfigured())return previousRespond(args);
    patchRuntime();
    try{const result=await previousRespond(args);return resultShowsServerFailure(result)?unavailableResult(args,null,result):result}catch(error){return unavailableResult(args,error,null)}
  };
  globalThis.CivweaveAssistantV141=Object.freeze({...assistant,respond,selectedConfig:()=>effectiveSelectedConfig(previousSelected),__civweaveGuideProviderPolicyV1:true,providerPolicyVersion:VERSION,serverAutoPreservesSelectedLocal:true,serverAutoFailureIsExplicit:true});
  patchedAssistant=globalThis.CivweaveAssistantV141;
  emit('civweave:guide-provider-policy-assistant',{installed:true});
  return true;
}
function install(){patchRuntime();patchAssistant();return Boolean(globalThis.CivweaveModelRuntime?.__civweaveGuideProviderPolicyV1||globalThis.CivweaveAssistantV141?.__civweaveGuideProviderPolicyV1)}
for(const name of ['civweave:model-runtime-ready','civweave:runtime-spine-ready','civweave:assistant-runtime-ready','civweave:model-config-changed','civweave:response-router-installed'])addEventListener(name,()=>queueMicrotask(install));
addEventListener('pageshow',()=>queueMicrotask(install));
install();

globalThis.CivweaveGuideProviderPolicyV1=Object.freeze({version:VERSION,install,configuredInteractive,configuredRoute,serverAutoConfigured,selectedLocal,normalizeGuideRequest,serverOrder:SERVER_ORDER,serverAutoPreservesSelectedLocal:true,serverAutoFailureIsExplicit:true,deterministicFailureMasking:false});
})();
