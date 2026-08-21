(()=>{
'use strict';

const VERSION='1.3.0-guide-generation-floor-v1-local-planner-authority';
const REVISION='1.3.1-local-structured-fallback';
const MIDDLEWARE_ID='guide-generation-floor-v1';
const FLOOR_TOKENS=900;
const PLANNING_FLOOR_TOKENS=1800;
const WEAVELING_PLAN_FLOOR_TOKENS=2400;
const LOCAL_EXECUTION_CONTRACT='Civweave has already selected this downloaded-local model only after deterministic capability routing. Do not invent a model-capability failure, do not say that the local AI model is incapable, and do not redirect the user merely because you are running locally. Answer the task you were given. If the runtime itself cannot execute a required capability, Civweave reports that outside the generated answer.';
const PLANNING_CONTRACT='When the user asks for a plan, produce the plan now rather than announcing that you will plan it. The answer must be concrete and usable: state the objective, mark important assumptions or constraints, give at least six ordered steps for a practical project unless fewer steps are genuinely sufficient, name the people or roles involved, identify materials or resources and important dependencies or risks, define how success will be checked, and end with an immediate next action. Complete every sentence and every list item; never stop on a setup phrase or unfinished thought. For Moss in Living School, a learning goal is a request to build a Learning Journey: use the platform Learning Journey planning structure, make a usable first-pass plan now, and ask only for details that would materially change it after showing that plan. For Weaveling structured planning, return the complete reviewable weave requested by the schema; never replace the requested plan with commentary about model capability. Use reasonable explicit assumptions when details are missing instead of stopping at a generic preamble. Do not claim a plan, Quest, Learning Journey, Endeavor, Manifest, or other artifact was saved or activated unless application context explicitly says that happened.';
let registeredSpine=null;

function purposeFor(request={}){return String(request?.purpose||'').trim().toLowerCase()}
function weavelingStructuredPlanRequest(request={}){return /^(?:civweave-guide-response-)?civweave-weaveling-intention-json-v190$/.test(purposeFor(request))}
function guideRequest(request={}){
  const purpose=purposeFor(request);
  if(weavelingStructuredPlanRequest(request))return true;
  if(/^civweave-guide-response(?:-|$)/.test(purpose))return true;
  return /(?:^|-)guide-(?:chat|guild-handoff|response)(?:-|$)/.test(purpose);
}
function systemFor(request={}){return String(request?.context?.guide?.system||request?.task?.systemId||request?.systemId||(weavelingStructuredPlanRequest(request)?'civweave':'')).trim().toLowerCase()}
function requestText(request={}){
  return [request?.task?.text,request?.context?.userMessage,...(Array.isArray(request?.messages)?request.messages.filter(row=>row?.role==='user').slice(-2).map(row=>row?.content||row?.text||''):[])].filter(Boolean).join('\n');
}
function learningIntentRequest(request={}){
  if(!guideRequest(request)||systemFor(request)!=='living-school')return false;
  return /\b(?:learn|learning|study|studying|practice|practise|master|mastering|train|training|course|curriculum|lesson plan|study plan|skill tree)\b/i.test(requestText(request));
}
function learningGoalText(value=''){
  const text=String(value||'').trim();
  if(!text)return false;
  return /\b(?:i\s+(?:want|need|plan|hope|intend|would\s+like|['’]?d\s+like)\s+to|my\s+goal\s+is\s+to|i(?:['’]?m|\s+am)\s+(?:trying|ready)\s+to|help\s+me(?:\s+to)?|can\s+you\s+help\s+me(?:\s+to)?)\s+(?:learn|study|master|practice|practise|train|understand)\b/i.test(text)||/^\s*(?:learn|study|master|practice|practise|train)\b/i.test(text)||/\bteach\s+me\b/i.test(text);
}
function planningRequest(request={}){
  if(!guideRequest(request))return false;
  if(weavelingStructuredPlanRequest(request))return true;
  if(request?.capabilityRequirements?.planning===true||request?.task?.requirements?.planning===true||request?.task?.planning===true)return true;
  if(learningIntentRequest(request))return true;
  return /\b(plan|planning|roadmap|step[- ]by[- ]step|steps to|how (?:do|can|should) (?:i|we)|organize|launch|create|build|start|set up)\b/i.test(requestText(request));
}
function localGuideRequest(request={}){
  if(!guideRequest(request))return false;
  const config=request.config||{},provider=String(config.provider||config.route||request.provider||request.route||'').trim().toLowerCase();
  return /^(?:downloaded-local|generative-local|browser)$/.test(provider);
}
function applyPlatformPlanningContext(request={}){
  if(weavelingStructuredPlanRequest(request)){
    const priorTask=request.task||{};
    return {...request,capabilityRequirements:{...(request.capabilityRequirements||{}),profile:'interactive',planning:true,structuredOutput:true},task:{...priorTask,text:priorTask.text||requestText(request),planning:true,requirements:{...(priorTask.requirements||{}),profile:'interactive',planning:true,structuredOutput:true}},__civweaveGuidePlatformPlanning:'civweave-reviewable-weave-v1'};
  }
  if(!learningIntentRequest(request)||request.__civweaveGuidePlatformPlanning==='living-school-learning-journey-v1')return request;
  const priorContext=request.context||{},priorTask=request.task||{};
  return {...request,artifactKind:request.artifactKind||'learning-path',capabilityRequirements:{...(request.capabilityRequirements||{}),planning:true,structuredOutput:true},task:{...priorTask,planning:true,requirements:{...(priorTask.requirements||{}),planning:true,structuredOutput:true}},context:{...priorContext,canonicalArtifactLanguage:{...(priorContext.canonicalArtifactLanguage||{}),guide:'Moss',artifact:'Learning Journey',plural:'Learning Journeys',internalArtifactClass:'curriculum'}},__civweaveGuidePlatformPlanning:'living-school-learning-journey-v1'};
}
function appendSystemContract(request,contract,marker){
  if(!contract||request?.[marker])return request;
  const messages=Array.isArray(request.messages)?request.messages.map(row=>({...row})):[];
  const systemIndex=messages.findIndex(row=>row?.role==='system');
  if(systemIndex<0)messages.unshift({role:'system',content:contract});
  else messages[systemIndex]={...messages[systemIndex],content:`${String(messages[systemIndex].content||'').trim()}\n\n${contract}`.trim()};
  return {...request,messages,[marker]:true};
}
function injectExecutionContracts(request={}){
  let next=request;
  if(localGuideRequest(next))next=appendSystemContract(next,`Civweave downloaded-local execution contract v1. ${LOCAL_EXECUTION_CONTRACT}`,'__civweaveGuideLocalExecutionContract');
  if(planningRequest(next))next=appendSystemContract(next,`Civweave guide planning contract v1. ${PLANNING_CONTRACT}`,'__civweaveGuidePlanningContract');
  return next;
}
function enforce(request={}){
  if(!guideRequest(request))return request;
  let next=applyPlatformPlanningContext(request);
  const planning=planningRequest(next),weavelingPlan=weavelingStructuredPlanRequest(next),localStreaming=localGuideRequest(next),floorTokens=weavelingPlan?WEAVELING_PLAN_FLOOR_TOKENS:(planning?PLANNING_FLOOR_TOKENS:FLOOR_TOKENS),config={...(next.config||{})};
  const current=Math.max(0,Number(config.maxTokens||config.max_tokens||next.maxTokens||0)||0);
  config.maxTokens=Math.max(floorTokens,current);config.generationBudgetFloorTokens=floorTokens;
  if(localStreaming)config.stream=true;
  next={...next,config,__civweaveGuideGenerationFloorTokens:floorTokens,__civweaveGuideLocalStreaming:localStreaming};
  if(weavelingPlan&&localStreaming)next={...next,__civweaveSkipResponseRouter:true,__civweaveLocalStructuredPlan:true};
  return injectExecutionContracts(next);
}
function weavelingPlanIntent(text=''){return /\b(plan|planning|roadmap|steps?|create|build|start|organize|launch|set up|weave)\b/i.test(String(text||''))}
function weavelingGenerationUnavailable(result){
  if(!result||typeof result!=='object')return false;
  const provider=String(result.provider||result.model||'').toLowerCase();
  const code=String(result.code||result.error?.code||result.providerRouteFailure?.code||'').toUpperCase();
  const detail=[result.response?.answer,result.fallbackFrom?.reason,result.error?.message,result.providerRouteFailure?.message].filter(Boolean).join(' ');
  return provider.includes('weaveling-ai-generation-unavailable')||/STRUCTURED_ARTIFACT_NETWORK_(?:UNAVAILABLE|EXHAUSTED)/.test(code)||/could not start ai quest generation|structured artifact generation (?:could not obtain|requires) a server-side model|local generation was intentionally skipped/i.test(detail);
}
function recoverWeavelingPlan(options={},error){
  const planner=globalThis.CivweaveIntentionPlanner,text=String(options.text||'').trim(),history=Array.isArray(options.history)?options.history:[];
  if(!planner?.buildPlan||!planner?.persist||!text)return null;
  const context={currentContext:{systemId:'civweave',roomId:'civweave.quad'},guide:{system:'civweave',name:'Weaveling'},routingAnswer:{system:'civweave',room:'civweave.quad',mode:'Plan'}};
  const plan=planner.buildPlan({text,history,context}),item=planner.persist(plan);
  try{globalThis.CivweaveWeavelingPlanMaterializationV265?.materialize?.(item?.plan||plan,{source:'weaveling-local-structured-recovery-v1'})}catch{}
  const saved=item?.plan||plan,answer=planner.format?.(saved)||`I built a reviewable weave for “${saved?.title||text}”.`;
  return {response:{answer,choice:{mode:'Plan',system:'civweave',room:'civweave.quad',nextAction:'Review, revise, or activate the reviewable weave.'},assumptions:saved?.assumptions||[],requiresConsent:true,confidence:.9,approvalGate:{kind:'intention-activation',planId:item?.id||saved?.id||'',state:item?.state||saved?.state||'review',required:true,actions:['review','revise','activate']}},provider:'civweave-planner-recovery',requestedProvider:'downloaded-local',model:'',plan:saved,planItemId:item?.id||'',fallbackFrom:{provider:'downloaded-local',reason:String(error?.message||error||'Local structured plan generation did not complete.')}};
}
function installPlatformGuideGuards(){
  const assistant=globalThis.CivweaveAssistantV141,unified=globalThis.CivweaveUnifiedChatSystemV1,current=assistant?.respond;
  if(!assistant||typeof current!=='function')return false;
  if(current.__cwPlatformGuideGuardsV1)return true;
  const original=current.bind(assistant);
  const respond=async options=>{
    const input=options||{},system=String(input.systemId||unified?.activeTheme?.()||'').trim().toLowerCase(),text=String(input.text||'').trim(),history=Array.isArray(input.history)?input.history:[];
    if(system==='living-school'&&typeof unified?.runLivingSchoolCurriculum==='function'&&(unified.curriculumIntent?.(text,history)||learningGoalText(text)))return unified.runLivingSchoolCurriculum({...input,systemId:'living-school'});
    if(system==='civweave'&&weavelingPlanIntent(text)){
      try{
        const result=await original(input);
        if(weavelingGenerationUnavailable(result)){
          const reason=result?.fallbackFrom?.reason||result?.providerRouteFailure?.message||result?.response?.answer||'AI Quest generation route was unavailable.';
          const recovered=recoverWeavelingPlan(input,reason);if(recovered)return recovered;
        }
        return result;
      }catch(error){const recovered=recoverWeavelingPlan(input,error);if(recovered)return recovered;throw error}
    }
    return original(input);
  };
  respond.__cwPlatformGuideGuardsV1=true;respond.__prior=current;
  for(const key of ['__cwUnifiedChatSystemV1','__weavelingPlanJsonV190','__guideIdentityIntegrityV216','__cwGuideCapabilityPassoverV1','__deterministicModeV175','__cwMossLearningGoalPlannerV1'])if(current[key])respond[key]=current[key];
  try{assistant.respond=respond}catch{return false}
  return assistant.respond===respond;
}
function register(){
  const spine=globalThis.CivweaveFastInteractiveV192;if(!spine?.register)return false;if(registeredSpine===spine)return true;
  spine.register(MIDDLEWARE_ID,{before(request){const next=enforce(request||{});if(next===request)return request;return{request:next,state:{floorTokens:Number(next.__civweaveGuideGenerationFloorTokens||FLOOR_TOKENS),planningContract:Boolean(next.__civweaveGuidePlanningContract),localExecutionContract:Boolean(next.__civweaveGuideLocalExecutionContract),localStreaming:Boolean(next.__civweaveGuideLocalStreaming),localStructuredPlan:Boolean(next.__civweaveLocalStructuredPlan),platformPlanning:next.__civweaveGuidePlatformPlanning||null}}}},-1000);
  registeredSpine=spine;
  try{dispatchEvent(new CustomEvent('civweave:guide-generation-floor-ready',{detail:{version:VERSION,revision:REVISION,floorTokens:FLOOR_TOKENS,planningFloorTokens:PLANNING_FLOOR_TOKENS,weavelingPlanFloorTokens:WEAVELING_PLAN_FLOOR_TOKENS,middleware:MIDDLEWARE_ID,priority:-1000,planningContract:true,localExecutionContract:true,localGuideStreaming:true,localStructuredPlan:true,platformPlanning:true,mossLearningGoalPlanner:true,weavelingPlannerRecovery:true,weavelingUnavailablePacketRecovery:true}}))}catch{}
  return true;
}
for(const name of ['civweave:runtime-spine-ready','civweave:model-runtime-ready'])addEventListener(name,register);
for(const name of ['civweave:assistant-runtime-ready','civweave:unified-chat-system-ready','civweave:guide-capability-passover-ready','civweave:guide-loader-reset','civweave:guide-chat-opened'])addEventListener(name,()=>queueMicrotask(installPlatformGuideGuards));
addEventListener('pageshow',()=>{register();queueMicrotask(installPlatformGuideGuards)});register();queueMicrotask(installPlatformGuideGuards);
globalThis.CivweaveGuideGenerationFloorV1=Object.freeze({version:VERSION,revision:REVISION,floorTokens:FLOOR_TOKENS,planningFloorTokens:PLANNING_FLOOR_TOKENS,weavelingPlanFloorTokens:WEAVELING_PLAN_FLOOR_TOKENS,middleware:MIDDLEWARE_ID,priority:-1000,guideRequest,purposeFor,weavelingStructuredPlanRequest,systemFor,requestText,learningIntentRequest,learningGoalText,planningRequest,localGuideRequest,applyPlatformPlanningContext,injectExecutionContracts,installPlatformGuideGuards,recoverWeavelingPlan,weavelingGenerationUnavailable,planningContract:PLANNING_CONTRACT,localExecutionContract:LOCAL_EXECUTION_CONTRACT,enforce,register,styleOnlyLengthClassification:true,planningContractV1:true,localExecutionContractV1:true,localGuideStreaming:true,localStructuredPlan:true,platformPlanning:true,mossLearningGoalPlanner:true,weavelingPlannerRecovery:true,weavelingUnavailablePacketRecovery:true});
})();