(()=>{
'use strict';

const VERSION='1.1.0-guide-generation-floor-v1-streaming-platform-planning';
const MIDDLEWARE_ID='guide-generation-floor-v1';
const FLOOR_TOKENS=900;
const PLANNING_FLOOR_TOKENS=1800;
const PLANNING_CONTRACT='When the user asks for a plan, produce the plan now rather than announcing that you will plan it. The answer must be concrete and usable: state the objective, mark important assumptions or constraints, give at least six ordered steps for a practical project unless fewer steps are genuinely sufficient, name the people or roles involved, identify materials or resources and important dependencies or risks, define how success will be checked, and end with an immediate next action. Complete every sentence and every list item; never stop on a setup phrase or unfinished thought. For Moss in Living School, a learning goal is a request to build a Learning Journey: use the platform Learning Journey planning structure, make a usable first-pass plan now, and ask only for details that would materially change it after showing that plan. Use reasonable explicit assumptions when details are missing instead of stopping at a generic preamble. Do not claim a plan, Quest, Learning Journey, Endeavor, Manifest, or other artifact was saved or activated unless application context explicitly says that happened.';
let registeredSpine=null;

function guideRequest(request={}){
  const purpose=String(request?.purpose||'').trim().toLowerCase();
  if(/^civweave-guide-response(?:-|$)/.test(purpose))return true;
  return /(?:^|-)guide-(?:chat|guild-handoff|response)(?:-|$)/.test(purpose);
}

function systemFor(request={}){
  return String(request?.context?.guide?.system||request?.task?.systemId||request?.systemId||'').trim().toLowerCase();
}

function requestText(request={}){
  return [
    request?.task?.text,
    request?.context?.userMessage,
    ...(Array.isArray(request?.messages)?request.messages.filter(row=>row?.role==='user').slice(-2).map(row=>row?.content||row?.text||''):[])
  ].filter(Boolean).join('\n');
}

function learningIntentRequest(request={}){
  if(!guideRequest(request)||systemFor(request)!=='living-school')return false;
  return /\b(?:learn|learning|study|studying|practice|practise|master|mastering|train|training|course|curriculum|lesson plan|study plan|skill tree)\b/i.test(requestText(request));
}

function planningRequest(request={}){
  if(!guideRequest(request))return false;
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
  if(!learningIntentRequest(request)||request.__civweaveGuidePlatformPlanning==='living-school-learning-journey-v1')return request;
  const priorContext=request.context||{},priorTask=request.task||{};
  return {
    ...request,
    artifactKind:request.artifactKind||'learning-path',
    capabilityRequirements:{...(request.capabilityRequirements||{}),planning:true,structuredOutput:true},
    task:{...priorTask,planning:true,requirements:{...(priorTask.requirements||{}),planning:true,structuredOutput:true}},
    context:{...priorContext,canonicalArtifactLanguage:{...(priorContext.canonicalArtifactLanguage||{}),guide:'Moss',artifact:'Learning Journey',plural:'Learning Journeys',internalArtifactClass:'curriculum'}},
    __civweaveGuidePlatformPlanning:'living-school-learning-journey-v1'
  };
}

function injectPlanningContract(request={}){
  if(!planningRequest(request)||request.__civweaveGuidePlanningContract==='v1')return request;
  const messages=Array.isArray(request.messages)?request.messages.map(row=>({...row})):[];
  const systemIndex=messages.findIndex(row=>row?.role==='system');
  const contract=`Civweave guide planning contract v1. ${PLANNING_CONTRACT}`;
  if(systemIndex<0)messages.unshift({role:'system',content:contract});
  else messages[systemIndex]={...messages[systemIndex],content:`${String(messages[systemIndex].content||'').trim()}\n\n${contract}`.trim()};
  return {...request,messages,__civweaveGuidePlanningContract:'v1'};
}

function enforce(request={}){
  if(!guideRequest(request))return request;
  let next=applyPlatformPlanningContext(request);
  const planning=planningRequest(next),localStreaming=localGuideRequest(next),floorTokens=planning?PLANNING_FLOOR_TOKENS:FLOOR_TOKENS,config={...(next.config||{})};
  const current=Math.max(0,Number(config.maxTokens||config.max_tokens||next.maxTokens||0)||0);
  config.maxTokens=Math.max(floorTokens,current);
  config.generationBudgetFloorTokens=floorTokens;
  if(localStreaming)config.stream=true;
  next={...next,config,__civweaveGuideGenerationFloorTokens:floorTokens,__civweaveGuideLocalStreaming:localStreaming};
  return injectPlanningContract(next);
}

function register(){
  const spine=globalThis.CivweaveFastInteractiveV192;
  if(!spine?.register)return false;
  if(registeredSpine===spine)return true;
  spine.register(MIDDLEWARE_ID,{before(request){
    const next=enforce(request||{});
    if(next===request)return request;
    return {request:next,state:{floorTokens:Number(next.__civweaveGuideGenerationFloorTokens||FLOOR_TOKENS),planningContract:Boolean(next.__civweaveGuidePlanningContract),localStreaming:Boolean(next.__civweaveGuideLocalStreaming),platformPlanning:next.__civweaveGuidePlatformPlanning||null}};
  }},-1000);
  registeredSpine=spine;
  try{dispatchEvent(new CustomEvent('civweave:guide-generation-floor-ready',{detail:{version:VERSION,floorTokens:FLOOR_TOKENS,planningFloorTokens:PLANNING_FLOOR_TOKENS,middleware:MIDDLEWARE_ID,priority:-1000,planningContract:true,localGuideStreaming:true,platformPlanning:true}}))}catch{}
  return true;
}

addEventListener('civweave:runtime-spine-ready',register);
addEventListener('civweave:model-runtime-ready',register);
addEventListener('pageshow',register);
register();

globalThis.CivweaveGuideGenerationFloorV1=Object.freeze({
  version:VERSION,
  floorTokens:FLOOR_TOKENS,
  planningFloorTokens:PLANNING_FLOOR_TOKENS,
  middleware:MIDDLEWARE_ID,
  priority:-1000,
  guideRequest,
  systemFor,
  requestText,
  learningIntentRequest,
  planningRequest,
  localGuideRequest,
  applyPlatformPlanningContext,
  injectPlanningContract,
  planningContract:PLANNING_CONTRACT,
  enforce,
  register,
  styleOnlyLengthClassification:true,
  planningContractV1:true,
  localGuideStreaming:true,
  platformPlanning:true,
});
})();
