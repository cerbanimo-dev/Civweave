(()=>{
'use strict';
const VERSION='1.1.0-selected-provider-authority-v1-all-routes';
const PROFILE_KEY='civweave-model-profiles-v1';
const LEGACY_KEY='civweave.universal-ai.v127';
const LOCAL_SELECTION_KEY='civweave.local-ai.selection.v266';
const LOCAL_PROVIDERS=new Set(['downloaded-local','generative-local','local-ai','smollm2','smollm3','qwen','browser']);
const NETWORK_PROVIDERS=new Set(['server-auto','cloudflare-workers-ai','workers-ai','cloudflare']);
let timer=0;
if(globalThis.CivweaveSelectedProviderAuthorityV1?.version===VERSION)return;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
function objectFrom(storage,key){try{const value=parse(storage.getItem(key),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return{}}}
function routeOf(value={}){return clean(value.provider||value.route,100).toLowerCase()}
function canonicalNetworkRoute(value=''){const route=clean(value,100).toLowerCase();return route==='workers-ai'||route==='cloudflare'?'cloudflare-workers-ai':route}
function canonicalState(){try{const value=globalThis.CivweaveSettingsV320?.readState?.();return value&&typeof value==='object'?value:null}catch{return null}}
function persistedInteractive(){
  const profiles=objectFrom(localStorage,PROFILE_KEY),profile=profiles.interactive&&typeof profiles.interactive==='object'?profiles.interactive:null,legacy=objectFrom(localStorage,LEGACY_KEY),canonical=canonicalState();
  const canonicalRoute=routeOf(canonical||{});
  if(canonicalRoute){
    const matching=routeOf(profile||{})===canonicalRoute?profile:routeOf(legacy)===canonicalRoute?legacy:null;
    return matching?{...matching,...canonical,provider:canonicalRoute,route:canonicalRoute}:{...canonical,provider:canonicalRoute,route:canonicalRoute};
  }
  if(profile&&routeOf(profile))return profile;
  if(routeOf(legacy))return legacy;
  return{};
}
function selectedLocal(){
  try{const value=globalThis.CivweaveLocalModelDownloadV266?.selection?.();if(value?.active&&value.id)return value}catch{}
  try{const value=parse(localStorage.getItem(LOCAL_SELECTION_KEY),{});return value?.active&&value.id?value:null}catch{return null}
}
function authority(){
  const persisted=persistedInteractive(),route=routeOf(persisted);
  if(route==='gemini')return{kind:'gemini',route,config:persisted};
  if(LOCAL_PROVIDERS.has(route))return{kind:'local',route,config:persisted,local:selectedLocal()};
  if(NETWORK_PROVIDERS.has(route))return{kind:'network',route:canonicalNetworkRoute(route),config:persisted};
  return{kind:'open',route,config:persisted};
}
function explicitNetwork(request={}){return request.__civweaveExplicitNetwork===true||request.explicitNetwork===true||request.__civweaveUserApprovedNeuronSpend===true||request.userApprovedNeuronSpend===true}
function interactive(request={}){const profile=clean(request.executionProfile||'interactive',80).toLowerCase();return profile!=='agentic'||/guide|chat|endeavor|quest|curriculum|plan|interactive/i.test(clean(request.purpose,240))}
function networkSelection(auth,existing={}){
  const route=canonicalNetworkRoute(auth.route),configuredModel=clean(auth.config?.model,240),selected={...existing,...auth.config,provider:route,route};
  if(route==='server-auto'){
    selected.model=configuredModel&&!/^gemini-/i.test(configuredModel)&&!LOCAL_PROVIDERS.has(configuredModel.toLowerCase())?configuredModel:'civweave-server-auto-v1';
  }else{
    selected.model=/^@(cf|hf)\//i.test(configuredModel)?configuredModel:'';
  }
  return selected;
}
function enforceConfig(request={}){
  if(!interactive(request)||explicitNetwork(request))return request;
  const auth=authority();if(auth.kind==='open')return request;
  const existing=request.config&&typeof request.config==='object'?request.config:{},incoming=canonicalNetworkRoute(routeOf(existing));
  if(auth.kind==='gemini'){
    if(incoming==='gemini')return request;
    const selected={...existing,...auth.config,provider:'gemini',route:'gemini'};
    if(!clean(selected.model,240)||/^@(?:cf|hf)\//i.test(clean(selected.model,240))||NETWORK_PROVIDERS.has(clean(selected.model,240).toLowerCase()))selected.model=clean(auth.config.model,240)||'gemini-3.1-flash-lite';
    return{...request,config:selected,__civweaveSelectedProviderAuthorityV1:true,providerAuthority:{schema:'civweave.selected-provider-authority.v1',selected:'gemini',crossProvider:false}};
  }
  if(auth.kind==='network'){
    const selected=networkSelection(auth,existing),sameRoute=incoming===auth.route,sameModel=clean(existing.model,240)===clean(selected.model,240);
    if(sameRoute&&sameModel)return request;
    return{...request,config:selected,__civweaveSelectedProviderAuthorityV1:true,providerAuthority:{schema:'civweave.selected-provider-authority.v1',selected:auth.route,crossProvider:false}};
  }
  const local=auth.local,selectedModel=clean(local?.id||auth.config.model,240),selectedProvider=LOCAL_PROVIDERS.has(auth.route)?auth.route:'downloaded-local';
  if(LOCAL_PROVIDERS.has(incoming)&&(!selectedModel||clean(existing.model,240)===selectedModel))return request;
  return{...request,config:{...existing,...auth.config,provider:selectedProvider,route:selectedProvider,model:selectedModel||clean(auth.config.model,240)},__civweaveSelectedProviderAuthorityV1:true,providerAuthority:{schema:'civweave.selected-provider-authority.v1',selected:'local-only',crossProvider:false}};
}
function blockedServerResult(request,auth){
  const label=auth.kind==='gemini'?'Gemini':'local-only';
  return{schema:'civweave-model-result-1.0',requestId:clean(request?.requestId,180)||`provider-authority-${Date.now().toString(36)}`,purpose:clean(request?.purpose,160)||'interactive',status:'provider-error',requested:{provider:label.toLowerCase(),model:clean(auth.config?.model,240),executionProfile:clean(request?.executionProfile,40)||'interactive'},actual:{provider:label.toLowerCase(),model:clean(auth.config?.model,240)},outputText:'',usage:{chargedNeurons:0},structured:{requested:Boolean(request?.schema||request?.responseSchema),valid:false,repairAttempts:0},fallback:{used:false},error:{code:'SELECTED_PROVIDER_AUTHORITY_BLOCKED_NETWORK',message:`Civweave blocked an unapproved Cloudflare/server AI request because ${label} is selected. No neurons were spent.`},providerAuthority:{schema:'civweave.selected-provider-authority.v1',selected:auth.kind,crossProvider:false,blockedNetwork:true}};
}
function emit(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}}
function patchRuntime(){
  const runtime=globalThis.CivweaveModelRuntime;if(!runtime?.generate)return false;
  if(runtime.generate.__cwSelectedProviderAuthorityV1===VERSION)return true;
  const previous=runtime.generate.bind(runtime),generate=async request=>{const normalized=enforceConfig(request||{});if(normalized!==request)emit('civweave:selected-provider-authority-enforced',{purpose:clean(request?.purpose,200),selected:authority().kind,blockedRoute:routeOf(request?.config||{})});return previous(normalized)};
  generate.__cwSelectedProviderAuthorityV1=VERSION;try{Object.defineProperty(generate,'__prior',{value:previous})}catch{}
  globalThis.CivweaveModelRuntime={...runtime,generate,__civweaveSelectedProviderAuthorityV1:true,selectedProviderAuthorityVersion:VERSION};return true;
}
function patchAssistant(){
  const assistant=globalThis.CivweaveAssistantV141;if(!assistant?.respond)return false;
  if(assistant.selectedConfig?.__cwSelectedProviderAuthorityV1===VERSION)return true;
  const previousSelected=typeof assistant.selectedConfig==='function'?assistant.selectedConfig.bind(assistant):()=>({}),selectedConfig=()=>{const auth=authority(),prior=previousSelected()||{};if(auth.kind==='open')return prior;if(auth.kind==='gemini')return{...prior,...auth.config,provider:'gemini',route:'gemini',model:clean(auth.config.model,240)||clean(prior.model,240)||'gemini-3.1-flash-lite'};if(auth.kind==='network')return networkSelection(auth,prior);const local=auth.local,route=LOCAL_PROVIDERS.has(auth.route)?auth.route:'downloaded-local';return{...prior,...auth.config,provider:route,route,model:clean(local?.id||auth.config.model||prior.model,240)}};
  selectedConfig.__cwSelectedProviderAuthorityV1=VERSION;
  globalThis.CivweaveAssistantV141={...assistant,selectedConfig,__civweaveSelectedProviderAuthorityV1:true,selectedProviderAuthorityVersion:VERSION};return true;
}
function patchServer(){
  const api=globalThis.CivweaveServerAIRouterV301;if(!api?.handle)return false;
  if(api.handle.__cwSelectedProviderAuthorityV1===VERSION)return true;
  const previous=api.handle.bind(api),handle=async request=>{const auth=authority();if((auth.kind==='gemini'||auth.kind==='local')&&interactive(request||{})&&!explicitNetwork(request||{})){emit('civweave:selected-provider-authority-blocked-server',{selected:auth.kind,purpose:clean(request?.purpose,200)});return blockedServerResult(request||{},auth)}return previous(request||{})};
  handle.__cwSelectedProviderAuthorityV1=VERSION;handle.__prior=api.handle;
  globalThis.CivweaveServerAIRouterV301=Object.freeze({...api,handle,__civweaveSelectedProviderAuthorityV1:true,selectedProviderAuthorityVersion:VERSION});return true;
}
function install(){patchRuntime();patchAssistant();patchServer();return true}
for(const name of ['civweave:model-runtime-ready','civweave:runtime-spine-ready','civweave:assistant-runtime-ready','civweave:server-ai-router-ready','civweave:model-config-changed','civweave:guide-loader-reset','civweave:guide-provider-policy-runtime','civweave:guide-provider-policy-assistant','civweave:local-provider-authority-ready','civweave:response-router-installed','pageshow'])addEventListener(name,()=>queueMicrotask(install));
install();let attempts=0;timer=setInterval(()=>{attempts+=1;install();if(attempts>=240)clearInterval(timer)},125);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
globalThis.CivweaveSelectedProviderAuthorityV1=Object.freeze({version:VERSION,install,authority,persistedInteractive,enforceConfig,explicitNetwork,selectedLocal,providerAuthority:'persisted-user-selection-first',crossProviderFallbackWithoutConsent:false,neuronSpendRequiresSelectedOrExplicitNetwork:true,allPersistedRoutesAuthoritative:true});
})();
