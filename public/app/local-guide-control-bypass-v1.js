(()=>{
'use strict';
const VERSION='1.4.0-local-guide-control-bypass-v1-ai-quest-lazy-route';
const ORCHESTRATOR_SRC='/extensions/civweave-weaveling-plan-json-v190.js?v=1.2.0-ai-quest-intent';
if(globalThis.CivweaveLocalGuideControlBypassV1?.version===VERSION)return;
let patched=null,timer=0,orchestratorPromise=null;
const clean=value=>String(value??'').trim();
function controlKind(text=''){
  const value=clean(text).toLowerCase().replace(/[!?.,]+$/,'').trim();
  if(/^(?:test|testing|ping|check|mic check)$/.test(value))return'test';
  if(/^(?:hi|hello|hey|good morning|good afternoon|good evening)$/.test(value))return'greeting';
  if(/^(?:thanks|thank you|thx|got it|okay|ok)$/.test(value))return'ack';
  if(/\b(?:are you (?:real|alive|sentient|a real boy)|who are you|what are you|are you a person)\b/.test(value))return'identity';
  return'';
}
function systemFor(args={}){return clean(args.systemId||args?.context?.guide?.system||'civweave').toLowerCase()||'civweave'}
function stripGreeting(value=''){return clean(value).replace(/^\s*(?:(?:hi|hello|hey|yo|good\s+(?:morning|afternoon|evening))[\s,!;:.-]*)+/i,'').trim()}
function likelyQuestIntent(args={}){
  if(systemFor(args)!=='civweave')return false;
  const value=stripGreeting(args.text);
  if(!value)return false;
  if(/\b(?:plan|roadmap|quest|weave|steps|set (?:an )?intention|i want|i wish|my goal|we want|we wish|let['’]?s|help me)\b/i.test(value))return true;
  if(/^(?:(?:please|kindly)\s+|(?:(?:can|could|would)\s+you\s+)|help\s+(?:me|us)\s+)?(?:make|build|create|start|organize|launch|open|set\s*up|form|develop|design|run|establish|put\s+together|write|learn|improve|change|grow|find)\b/i.test(value))return true;
  if(/\b(?:i|we)\s+(?:want|need|would\s+like|wish|hope|plan|intend|aim)\s+to\s+(?:make|build|create|start|organize|launch|open|set\s*up|form|develop|design|run|establish|write|learn|improve|change|grow|find)\b/i.test(value))return true;
  if(/\b(?:me\s+and\s+(?:my\s+)?friends|my\s+friends\s+and\s+(?:me|i)|friends?\s+and\s+i|our\s+(?:friends|group|team|family|community)|we)\b[^.!?]{0,90}\b(?:make|build|create|start|organize|launch|open|set\s*up|form|develop|design|run|establish)\b/i.test(value))return true;
  return false;
}
function questContext(args={}){return{currentContext:{systemId:'civweave',roomId:'civweave.quad'},guide:{system:'civweave',name:'Weaveling'},routingAnswer:{system:'civweave',room:'civweave.quad',mode:'Plan'},...(args.context||{})}}
function questIntent(args={}){
  if(!likelyQuestIntent(args))return false;
  const orchestrator=globalThis.CivweaveWeavelingPlanJsonV190;
  if(!orchestrator?.planIntent)return true;
  try{return Boolean(orchestrator.planIntent(clean(args.text),Array.isArray(args.history)?args.history:[],questContext(args)))}catch{return true}
}
async function ensureOrchestrator(){
  const ready=globalThis.CivweaveWeavelingPlanJsonV190;
  if(ready?.createModelPlan&&ready?.planIntent)return ready;
  if(orchestratorPromise)return orchestratorPromise;
  orchestratorPromise=new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname==='/extensions/civweave-weaveling-plan-json-v190.js'}catch{return false}});
    const finish=()=>{const api=globalThis.CivweaveWeavelingPlanJsonV190;if(api?.createModelPlan&&api?.planIntent)resolve(api);else reject(new Error('The structured Weaveling Quest authoring module loaded without its AI authoring contract.'))};
    if(existing){existing.addEventListener('load',finish,{once:true});setTimeout(finish,0);return}
    const head=document.head;if(!head?.isConnected){reject(new Error('The structured Weaveling Quest authoring module could not mount.'));return}
    const script=document.createElement('script');script.src=ORCHESTRATOR_SRC;script.async=false;script.onload=finish;script.onerror=()=>reject(new Error('The structured Weaveling Quest authoring module failed to load.'));head.append(script);
  }).finally(()=>{orchestratorPromise=null});
  return orchestratorPromise;
}
function unavailable(error){const message=clean(error?.message||error||'The structured AI Quest authoring layer is unavailable.');return{response:{answer:`I could not start AI Quest generation. Nothing was created or saved.\n\nGeneration detail: ${message}`,choice:{mode:'Plan',system:'civweave',room:'civweave.quad',nextAction:'Retry after the selected AI runtime is ready.'},assumptions:[],requiresConsent:false,confidence:1},provider:'weaveling-ai-generation-unavailable',model:'',plan:null,questAuthoring:{aiGenerated:false,required:true,questCreated:false,error:message}}}
function patch(){
  const api=globalThis.CivweaveAssistantV141,current=api?.respond;if(!api||typeof current!=='function')return false;
  if(current.__cwLocalGuideControlBypassV1&&current.__cwLocalGuideControlBypassVersion===VERSION){patched=current;return true}
  if(!current.__civweaveLocalProviderAuthorityV1||typeof current.__prior!=='function')return false;
  const local=current.bind(api),deterministic=current.__prior.bind(api);
  const respond=async args=>{
    const input=args||{},control=controlKind(input.text);
    if(control)return deterministic(input);
    if(questIntent(input)){
      try{
        const orchestrator=await ensureOrchestrator();
        const context=questContext(input);
        if(!orchestrator.planIntent(clean(input.text),Array.isArray(input.history)?input.history:[],context))return local(input);
        return await orchestrator.createModelPlan(input,globalThis.CivweaveAssistantV141);
      }catch(error){return unavailable(error)}
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
  try{dispatchEvent(new CustomEvent('civweave:local-guide-control-bypass-ready',{detail:{version:VERSION,controls:['test','greeting','ack','identity'],aiQuestAuthoringRequired:true,structuredQuestRoute:true,lazyOrchestrator:true,deterministicQuestCreation:false}}))}catch{}
  return true
}
for(const name of ['civweave:local-provider-authority-installed','civweave:assistant-runtime-ready','civweave:guide-loader-reset','civweave:unified-chat-system-ready','civweave:guide-capability-passover-ready','pageshow'])addEventListener(name,()=>queueMicrotask(patch));
patch();let attempts=0;timer=setInterval(()=>{attempts+=1;patch();if(attempts>=240)clearInterval(timer)},125);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
globalThis.CivweaveLocalGuideControlBypassV1=Object.freeze({version:VERSION,patch,controlKind,systemFor,stripGreeting,likelyQuestIntent,questIntent,ensureOrchestrator,aiQuestAuthoringRequired:true,structuredQuestRoute:true,lazyOrchestrator:true,deterministicQuestCreation:false,state:()=>Object.freeze({installed:Boolean(patched),orchestratorLoading:Boolean(orchestratorPromise)})});
})();