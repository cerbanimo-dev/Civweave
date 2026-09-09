(()=>{
'use strict';

const VERSION='1.0.0-gemma4-structured-task-authority-v1-e4b-only';
const DEEP_MODEL='gemma4-e4b-it-litert-web';
const TASK_TIMEOUT_MS=600000;
const QUEST_PURPOSE='civweave-weaveling-intention-json-v190';
const LEARNING_PURPOSE='living-school-learning-plan-review-v2';
const TASK_PURPOSES=new Set([QUEST_PURPOSE,LEARNING_PURPOSE]);
const LOCAL_PROVIDERS=new Set(['downloaded-local','generative-local','local-ai','browser','smollm2','smollm3','qwen']);
const COMPOSITION_KEYS=[
  '__civweaveLocalProviderAuthorityV1','__civweaveLocalProviderAuthorityVersion',
  '__cwLocalGuideControlBypassV1','__cwLocalGuideControlBypassVersion',
  '__cwWeavelingAIQuestRequiredV1','__cwWeavelingStructuredQuestRouteV1','__cwWeavelingQualificationHandoffV1',
  '__cwPlatformGuideGuardsV1','__cwUnifiedChatSystemV1','__weavelingPlanJsonV190',
  '__guideIdentityIntegrityV216','__cwGuideCapabilityPassoverV1','__deterministicModeV175','__cwMossLearningGoalPlannerV1'
];
let scheduled=false;
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function emit(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,deepModel:DEEP_MODEL,at:new Date().toISOString(),...detail}}))}catch{}}
function copyMetadata(target,source){for(const key of COMPOSITION_KEYS)if(source?.[key]!==undefined)try{target[key]=source[key]}catch{};return target}
function localProvider(request){return LOCAL_PROVIDERS.has(clean(request?.config?.provider||request?.config?.route,120).toLowerCase())}
function taskKind(purpose){return purpose===LEARNING_PURPOSE?'learning-plan':'quest'}
function explicitTaskIntent(text=''){
  const value=clean(text,5000);
  if(!value)return false;
  const named=/\b(?:plan|roadmap|quest|weave|outline|step[- ]by[- ]step|steps)\b/i.test(value);
  const action=/\b(?:create|make|build|start|record|produce|release|write|organize|launch|develop|design|finish|publish|learn|master|practice|study|set\s*up|put\s+together)\b/i.test(value);
  const direct=/\b(?:make|create|build|draft|design|develop|give|show|map)\s+(?:me\s+|us\s+)?(?:a\s+|an\s+|the\s+)?(?:plan|roadmap|quest|weave|outline)\b/i.test(value);
  const planFor=/\b(?:a\s+)?plan\s+(?:to|for|of)\b/i.test(value);
  return direct||(named&&action)||(planFor&&action);
}
async function deepStatus(){
  const manager=globalThis.CivweaveLocalModelDownloadV266;
  if(typeof manager?.status!=='function')return{available:false,reason:'download-manager-unavailable'};
  try{return await manager.status(DEEP_MODEL)}catch(error){return{available:false,error}}
}
async function requireDeepModel(){
  const status=await deepStatus();
  if(status?.available)return DEEP_MODEL;
  const error=new Error('Gemma 4 E4B is required for local structured task generation but is not installed and ready. Civweave will not silently fall back to E2B for this task.');
  error.code='CIVWEAVE_E4B_STRUCTURED_TASK_REQUIRED';
  error.model=DEEP_MODEL;
  error.status=status;
  throw error;
}
async function orchestrator(timeoutMs=12000){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    const api=globalThis.CivweaveWeavelingPlanJsonV190;
    if(api?.createModelPlan&&api?.localStructuredTransport)return api;
    try{globalThis.CivweaveSharedGuideSurfaceV236Loader?.install?.()}catch{}
    await sleep(50);
  }
  throw Object.assign(new Error('The structured Weaveling task orchestrator did not become ready.'),{code:'CIVWEAVE_STRUCTURED_TASK_ORCHESTRATOR_NOT_READY'});
}
function deepConfig(config={}){
  return{...config,provider:'downloaded-local',route:'downloaded-local',model:DEEP_MODEL,timeoutMs:TASK_TIMEOUT_MS,maxTokens:Math.max(1800,Number(config.maxTokens)||0),stream:false};
}
async function prepareStructuredRequest(request){
  const purpose=clean(request?.purpose,180);
  if(!TASK_PURPOSES.has(purpose)||!localProvider(request))return request;
  await requireDeepModel();
  let transport=request?.transport;
  if(typeof transport!=='function'){
    const api=await orchestrator();
    transport=api.localStructuredTransport(taskKind(purpose));
  }
  return{
    ...request,
    config:deepConfig(request?.config||{}),
    transport,
    __civweaveSkipResponseRouter:true,
    __civweaveStructuredTaskAuthorityV1:true,
    __civweaveLocalStructuredPlan:true,
    ...(purpose===LEARNING_PURPOSE?{__civweaveLocalStructuredLearningPlan:true}:{__civweaveLocalStructuredQuest:true})
  };
}
function installRuntime(){
  const runtime=globalThis.CivweaveModelRuntime,current=runtime?.generate;
  if(!runtime||typeof current!=='function')return false;
  if(current.__civweaveStructuredTaskAuthorityV1===VERSION)return true;
  const prior=current.bind(runtime),generate=async request=>prior(await prepareStructuredRequest(request));
  generate.__civweaveStructuredTaskAuthorityV1=VERSION;
  generate.__prior=current;
  for(const key of Object.keys(current))try{generate[key]=current[key]}catch{}
  try{runtime.generate=generate;if(runtime.generate===generate)return true}catch{}
  try{globalThis.CivweaveModelRuntime={...runtime,generate};return globalThis.CivweaveModelRuntime?.generate===generate}catch{return false}
}
function installAssistant(){
  const api=globalThis.CivweaveAssistantV141,current=api?.respond;
  if(!api||typeof current!=='function')return false;
  if(current.__civweaveStructuredTaskAuthorityV1===VERSION)return true;
  const prior=current.bind(api),respond=async args=>{
    const system=clean(args?.systemId||'civweave',80).toLowerCase();
    if(system==='civweave'&&explicitTaskIntent(args?.text)){
      const task=await orchestrator();
      return task.createModelPlan({...args,latestRequest:clean(args?.text,5000)},globalThis.CivweaveAssistantV141);
    }
    return prior(args);
  };
  copyMetadata(respond,current);
  respond.__civweaveStructuredTaskAuthorityV1=VERSION;
  respond.__civweaveE4BStructuredTaskOnly=true;
  respond.__prior=current;
  const next={...api,respond,structuredTaskAuthority:VERSION,structuredTaskDeepModel:DEEP_MODEL};
  try{globalThis.CivweaveAssistantV141=next;return globalThis.CivweaveAssistantV141?.respond===respond}catch{return false}
}
function install(){
  const runtime=installRuntime(),assistant=installAssistant();
  if(runtime||assistant)emit('civweave:structured-task-authority-ready',{runtime,assistant,timeoutMs:TASK_TIMEOUT_MS,e2bRole:'conversation-and-qualification-only',structuredTaskFallbackToE2B:false});
  return runtime||assistant;
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;install()})}
for(const name of ['civweave:assistant-runtime-ready','civweave:unified-chat-system-ready','civweave:local-provider-authority-installed','civweave:local-guide-control-bypass-ready','civweave:guide-capability-passover-ready','civweave:local-model-runtime-ready','civweave:gemma4-litert-fast-runtime-ready','civweave:guide-loader-reset','pageshow'])addEventListener?.(name,schedule);
for(const delay of [0,50,200,700,1500,3000,6000,12000,20000])setTimeout(schedule,delay);

globalThis.CivweaveGemma4StructuredTaskAuthorityV1=Object.freeze({
  version:VERSION,deepModel:DEEP_MODEL,taskTimeoutMs:TASK_TIMEOUT_MS,questPurpose:QUEST_PURPOSE,learningPurpose:LEARNING_PURPOSE,
  explicitTaskIntent,deepStatus,requireDeepModel,orchestrator,deepConfig,prepareStructuredRequest,installRuntime,installAssistant,install,schedule,
  policy:'E2B may converse or qualify; local structured Quest and Learning Journey generation requires E4B.',
  fallbackToE2B:false
});
schedule();
})();