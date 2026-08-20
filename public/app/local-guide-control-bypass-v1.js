(()=>{
'use strict';
const VERSION='1.3.1-local-guide-control-bypass-v1-ai-quest-route';
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
function findLayer(fn,flag){let current=fn,depth=0;while(typeof current==='function'&&depth<24){if(current[flag])return current;current=current.__prior;depth++}return null}
function questContext(args={}){return{currentContext:{systemId:'civweave',roomId:'civweave.quad'},guide:{system:'civweave',name:'Weaveling'},routingAnswer:{system:'civweave',room:'civweave.quad',mode:'Plan'},...(args.context||{})}}
function questIntent(args={}){const system=clean(args.systemId||args?.context?.guide?.system||'civweave').toLowerCase();if(system!=='civweave')return false;const orchestrator=globalThis.CivweaveWeavelingPlanJsonV190;if(!orchestrator?.planIntent)return false;try{return Boolean(orchestrator.planIntent(clean(args.text),Array.isArray(args.history)?args.history:[],questContext(args)))}catch{return false}}
function patch(){
  const api=globalThis.CivweaveAssistantV141,current=api?.respond;if(!api||typeof current!=='function')return false;
  if(current.__cwLocalGuideControlBypassV1&&current.__cwLocalGuideControlBypassVersion===VERSION){patched=current;return true}
  if(!current.__civweaveLocalProviderAuthorityV1||typeof current.__prior!=='function')return false;
  const local=current.bind(api),deterministic=current.__prior.bind(api);
  const respond=async args=>{
    const input=args||{},control=controlKind(input.text);
    if(control)return deterministic(input);
    if(questIntent(input)){
      const structured=findLayer(current,'__weavelingPlanJsonV190');
      if(structured)return structured.call(api,input);
      const orchestrator=globalThis.CivweaveWeavelingPlanJsonV190;
      try{orchestrator?.install?.()}catch{}
      const installed=findLayer(globalThis.CivweaveAssistantV141?.respond,'__weavelingPlanJsonV190');
      if(installed&&installed!==respond)return installed.call(globalThis.CivweaveAssistantV141,input);
      return{
        response:{answer:'I could not start AI Quest generation because the structured Weaveling authoring layer is unavailable. Nothing was created or saved.',choice:{mode:'Plan',system:'civweave',room:'civweave.quad',nextAction:'Retry after the AI runtime is ready.'},assumptions:[],requiresConsent:false,confidence:1},
        provider:'weaveling-ai-generation-unavailable',model:'',plan:null,questAuthoring:{aiGenerated:false,required:true,questCreated:false}
      };
    }
    return local(input);
  };
  respond.__cwLocalGuideControlBypassV1=true;
  respond.__cwLocalGuideControlBypassVersion=VERSION;
  respond.__cwWeavelingAIQuestRequiredV1=true;
  respond.__cwWeavelingStructuredQuestRouteV1=true;
  respond.__prior=current;
  for(const key of ['__civweaveLocalProviderAuthorityV1','__civweaveLocalProviderAuthorityVersion','__cwPlatformGuideGuardsV1','__cwUnifiedChatSystemV1','__weavelingPlanJsonV190','__guideIdentityIntegrityV216','__cwGuideCapabilityPassoverV1','__deterministicModeV175','__cwMossLearningGoalPlannerV1'])if(current[key])respond[key]=current[key];
  try{api.respond=respond}catch{}
  if(api.respond!==respond){try{globalThis.CivweaveAssistantV141={...api,respond}}catch{return false}}
  patched=globalThis.CivweaveAssistantV141?.respond||respond;
  try{dispatchEvent(new CustomEvent('civweave:local-guide-control-bypass-ready',{detail:{version:VERSION,controls:['test','greeting','ack','identity'],aiQuestAuthoringRequired:true,structuredQuestRoute:true,deterministicQuestCreation:false}}))}catch{}
  return true
}
for(const name of ['civweave:local-provider-authority-installed','civweave:assistant-runtime-ready','civweave:guide-loader-reset','civweave:unified-chat-system-ready','civweave:guide-capability-passover-ready','pageshow'])addEventListener(name,()=>queueMicrotask(patch));
patch();let attempts=0;timer=setInterval(()=>{attempts+=1;patch();if(attempts>=240)clearInterval(timer)},125);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
globalThis.CivweaveLocalGuideControlBypassV1=Object.freeze({version:VERSION,patch,controlKind,findLayer,questIntent,aiQuestAuthoringRequired:true,structuredQuestRoute:true,deterministicQuestCreation:false,state:()=>Object.freeze({installed:Boolean(patched)})});
})();