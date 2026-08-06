(()=>{
'use strict';
const VERSION='1.0.7-cerbanimo-deterministic-boundary-v203';
const SETTINGS_KEY='civweave.universal-ai.v127';
const PROFILES_KEY='civweave-model-profiles-v1';
const LOCAL_PROVIDERS=new Set(['','bundled','packaged','reflex','minilm','local-reflex','smollm2','browser','deterministic']);
const root=globalThis;
let timer=0;
let assistantSource=null;
let runtimeSource=null;
const parse=(value,fallback={})=>{try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'?parsed:fallback}catch{return fallback}};
const clean=value=>String(value??'').trim().toLowerCase();
function canonicalProvider(value){
  const raw=clean(value||'deterministic');
  if(LOCAL_PROVIDERS.has(raw))return'deterministic';
  if(['openai','compatible','openai-compatible'].includes(raw))return'openai-compatible';
  if(raw==='local-api')return'ollama';
  return['gemini','ollama','openai-compatible','hosted'].includes(raw)?raw:'deterministic';
}
function selectedProvider(){
  const profiles=parse(root.localStorage?.getItem?.(PROFILES_KEY),{});
  const settings=parse(root.localStorage?.getItem?.(SETTINGS_KEY),{});
  const selected=profiles.interactive&&typeof profiles.interactive==='object'?profiles.interactive:settings;
  return canonicalProvider(selected.provider||selected.route);
}
function deterministicSelected(){return selectedProvider()==='deterministic'}
function requestSystem(request={}){
  return clean(request?.context?.guide?.system||request?.context?.currentContext?.systemId||request?.systemId||'');
}
function isCerbanimoCall(args={}){
  const explicit=clean(args.systemId||args.system||'');
  if(explicit)return explicit==='cerbanimo';
  try{
    const query=new URLSearchParams(root.location?.search||'').get('system');
    if(query)return clean(query)==='cerbanimo';
  }catch{}
  const path=clean(root.location?.pathname||'');
  const host=clean(root.location?.hostname||'');
  return path.includes('cerbanimo')||host==='cerbanimo.com'||host.startsWith('cerbanimo.');
}
function blockedResult(request={}){
  const provider=canonicalProvider(request?.config?.provider||request?.config?.route||selectedProvider());
  return{
    schema:'civweave-model-result-1.0',
    requestId:String(request.requestId||`model-${Date.now().toString(36)}`),
    purpose:String(request.purpose||'civweave-guide-response-v141'),
    status:'provider-error',
    requested:{provider,model:String(request?.config?.model||'')},
    actual:{provider:'deterministic',model:'civweave-deterministic-v175'},
    timing:{startedAt:new Date().toISOString(),completedAt:new Date().toISOString(),elapsedMs:0},
    events:[],diagnostics:['Cerbanimo deterministic mode blocked an external guide-model call.'],
    outputText:'',usage:{},stream:{requested:false,used:false},structured:{requested:false,valid:false,repairAttempts:0},fallback:{used:false},
    error:{code:'DETERMINISTIC_PROVIDER_BOUNDARY',message:'Cerbanimo is in deterministic local mode, so external model generation is disabled.'}
  };
}
function patchModelRuntime(){
  const runtime=root.CivweaveModelRuntime;
  if(!runtime?.generate)return false;
  if(runtime.generate.__cerbanimoDeterministicBoundaryV203){runtimeSource=runtime;return true}
  const original=runtime.generate.bind(runtime);
  const guarded=async request=>{
    const guideCall=/^civweave-guide-response-v141/.test(String(request?.purpose||''));
    if(guideCall&&requestSystem(request)==='cerbanimo'&&deterministicSelected())return blockedResult(request);
    return original(request);
  };
  Object.defineProperties(guarded,{
    __cerbanimoDeterministicBoundaryV203:{value:true},
    __prior:{value:original},
  });
  const proxy=Object.freeze({...runtime,generate:guarded,cerbanimoDeterministicBoundaryRevision:VERSION});
  try{root.CivweaveModelRuntime=proxy}catch{return false}
  runtimeSource=root.CivweaveModelRuntime;
  return root.CivweaveModelRuntime===proxy;
}
function localFallback(args={}){
  const text=String(args.text||'').trim();
  const contracts=root.CivweaveGuideContractsV141;
  const ctx={schema:'civweave.deterministic-context.v2',userMessage:text,guide:{name:'Kamiya',role:'Questwright and skilled-work guide',system:'cerbanimo',realm:'Cerbanimo'},routingAnswer:{system:'cerbanimo',mode:'Build',confidence:.9,evidence:['deterministic provider boundary'],provider:'deterministic'},recentConversation:Array.isArray(args.history)?args.history.slice(-12):[],requestedModel:{route:'deterministic',provider:'deterministic',model:'civweave-deterministic-v175',endpoint:'',externalConsent:false}};
  const action=text&&contracts?.compose?.(text,'cerbanimo',ctx)||null;
  const missing=Array.isArray(action?.missingRequired)?action.missingRequired:[];
  const answer=action?(contracts?.answer?.(action)||'Kamiya created a Cerbanimo quest draft.'):"I’m Kamiya, Cerbanimo’s Questwright and skilled-work guide. Tell me what visible result should exist.";
  return{response:{answer,choice:{mode:'Build',system:'cerbanimo',room:'',nextAction:missing.length?`Provide ${missing.join(' and ')}.`:action?.approval?.required?`Review and approve “${action.title}.”`:'Tell Kamiya what visible result should exist.'},assumptions:[],requiresConsent:Boolean(action?.approval?.required),confidence:.92,...(action?{approvalGate:{kind:'realm-action-approval',actionId:action.id,state:action.state,required:Boolean(action.approval?.required),label:action.approval?.label,missingRequired:missing}}:{})},provider:'deterministic',requestedProvider:'deterministic',model:'civweave-action-contract-v141',action,context:ctx,fallbackFrom:null};
}
function patchAssistant(){
  const api=root.CivweaveAssistantV141;
  if(!api?.respond)return false;
  if(api.respond.__cerbanimoDeterministicBoundaryV203){assistantSource=api;return true}
  const original=api.respond.bind(api);
  const wrapped=async args=>{
    if(isCerbanimoCall(args)&&deterministicSelected()){
      const deterministic=root.CivweaveDeterministicModeV175;
      if(deterministic?.respond)return deterministic.respond({...args,systemId:'cerbanimo'});
      return localFallback({...args,systemId:'cerbanimo'});
    }
    return original(args);
  };
  Object.defineProperties(wrapped,{
    __cerbanimoDeterministicBoundaryV203:{value:true},
    __prior:{value:original},
  });
  try{api.respond=wrapped}catch{return false}
  assistantSource=api;
  return api.respond===wrapped;
}
function install(){
  const runtimeChanged=root.CivweaveModelRuntime!==runtimeSource;
  const assistantChanged=root.CivweaveAssistantV141!==assistantSource;
  if(runtimeChanged||!root.CivweaveModelRuntime?.generate?.__cerbanimoDeterministicBoundaryV203)patchModelRuntime();
  if(assistantChanged||!root.CivweaveAssistantV141?.respond?.__cerbanimoDeterministicBoundaryV203)patchAssistant();
  return{version:VERSION,provider:selectedProvider(),runtimeGuarded:Boolean(root.CivweaveModelRuntime?.generate?.__cerbanimoDeterministicBoundaryV203),assistantGuarded:Boolean(root.CivweaveAssistantV141?.respond?.__cerbanimoDeterministicBoundaryV203)};
}
function stabilize(){
  install();
  if(timer)return timer;
  timer=setInterval(install,500);
  return timer;
}
for(const eventName of ['civweave:model-settings-saved','civweave:model-config-changed','civweave:guide-loader-reset','civweave:fast-interactive-installed'])root.addEventListener?.(eventName,install);
const api=Object.freeze({version:VERSION,install,stabilize,selectedProvider,deterministicSelected,status:install});
root.CivweaveCerbanimoDeterministicBoundaryV203=api;
stabilize();
})();
