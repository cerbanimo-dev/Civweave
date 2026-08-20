(()=>{
'use strict';
const VERSION='1.1.0-local-guide-control-bypass-v1-planner-first';
if(globalThis.CivweaveLocalGuideControlBypassV1?.version===VERSION)return;
let patched=null,timer=0;
const clean=value=>String(value??'').trim();
function controlKind(text=''){
  const value=clean(text).toLowerCase().replace(/[!?.,]+$/,'').trim();
  if(/^(?:test|testing|ping|check|mic check)$/.test(value))return'test';
  if(/^(?:hi|hello|hey|good morning|good afternoon|good evening)$/.test(value))return'greeting';
  if(/^(?:thanks|thank you|thx|got it|okay|ok)$/.test(value))return'ack';
  if(/\b(?:are you (?:real|alive|sentient|a real boy)|who are you|what are you|are you a person)\b/.test(value))return'identity';
  return'';
}
function systemFor(args={}){const value=clean(args.systemId||args?.context?.guide?.system).toLowerCase();return value||'civweave'}
function plannerContext(args={}){return{currentContext:{systemId:'civweave',roomId:'civweave.quad'},guide:{system:'civweave',name:'Weaveling'},routingAnswer:{system:'civweave',room:'civweave.quad',mode:'Plan'},...(args.context||{})}}
function platformPlan(args={}){
  if(systemFor(args)!=='civweave')return null;
  const planner=globalThis.CivweaveIntentionPlanner,text=clean(args.text),history=Array.isArray(args.history)?args.history:[],context=plannerContext(args);
  if(!text||!planner?.shouldCreate||!planner?.maybeCreate)return null;
  let should=false;try{should=Boolean(planner.shouldCreate({text,history,context}))}catch{return null}if(!should)return null;
  let created=null;try{created=planner.maybeCreate({text,history,context})}catch{return null}if(!created?.response?.answer)return null;
  return{
    ...created,
    provider:'civweave-platform-planner',
    requestedProvider:'downloaded-local',
    model:'platform-plan',
    responseRouting:{schema:'civweave.response-route.v1',system:'civweave',taskClass:'platform-plan',artifactClass:'Quest',networkRequired:false,confidence:1,source:'local-guide-control-bypass-v1-planner-first',provider:'civweave-platform-planner',model:'platform-plan',localProviderPinned:true},
    platformPlanning:true,
    localGenerationSkipped:true
  };
}
function patch(){
  const api=globalThis.CivweaveAssistantV141,current=api?.respond;if(!api||typeof current!=='function')return false;
  if(current.__cwLocalGuideControlBypassV1&&current.__cwLocalGuideControlBypassVersion===VERSION){patched=current;return true}
  if(!current.__civweaveLocalProviderAuthorityV1||typeof current.__prior!=='function')return false;
  const local=current.bind(api),deterministic=current.__prior.bind(api);
  const respond=async args=>{
    const input=args||{},control=controlKind(input.text);
    if(control)return deterministic(input);
    const planned=platformPlan(input);if(planned)return planned;
    return local(input);
  };
  respond.__cwLocalGuideControlBypassV1=true;respond.__cwLocalGuideControlBypassVersion=VERSION;respond.__prior=current;respond.__cwWeavelingPlannerFirstV1=true;
  for(const key of ['__civweaveLocalProviderAuthorityV1','__civweaveLocalProviderAuthorityVersion','__cwPlatformGuideGuardsV1','__cwUnifiedChatSystemV1','__weavelingPlanJsonV190','__guideIdentityIntegrityV216','__cwGuideCapabilityPassoverV1','__deterministicModeV175','__cwMossLearningGoalPlannerV1'])if(current[key])respond[key]=current[key];
  try{api.respond=respond}catch{}if(api.respond!==respond){try{globalThis.CivweaveAssistantV141={...api,respond}}catch{return false}}
  patched=globalThis.CivweaveAssistantV141?.respond||respond;
  try{dispatchEvent(new CustomEvent('civweave:local-guide-control-bypass-ready',{detail:{version:VERSION,controls:['test','greeting','ack','identity'],weavelingPlannerFirst:true}}))}catch{}
  return true
}
for(const name of ['civweave:local-provider-authority-installed','civweave:assistant-runtime-ready','civweave:guide-loader-reset','civweave:unified-chat-system-ready','civweave:guide-capability-passover-ready','pageshow'])addEventListener(name,()=>queueMicrotask(patch));
patch();let attempts=0;timer=setInterval(()=>{attempts+=1;patch();if(attempts>=240)clearInterval(timer)},125);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
globalThis.CivweaveLocalGuideControlBypassV1=Object.freeze({version:VERSION,patch,controlKind,platformPlan,weavelingPlannerFirst:true,state:()=>Object.freeze({installed:Boolean(patched)})});
})();