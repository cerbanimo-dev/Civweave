(()=>{
'use strict';

const VERSION='1.1.1-gemma4-structured-task-authority-v1-e2b-intake-e4b-generation-progress';
const INTAKE_MODEL='gemma4-e2b-it-litert-web';
const DEEP_MODEL='gemma4-e4b-it-litert-web';
const TASK_TIMEOUT_MS=600000;
const LEARNING_MAX_TOKENS=900;
const QUEST_MIN_TOKENS=1800;
const INTAKE_MAX_TOKENS=520;
const INTAKE_KEY='civweave.weaveling.local-intake.v1';
const INTAKE_TTL_MS=2*60*60*1000;
const QUEST_PURPOSE='civweave-weaveling-intention-json-v190';
const LEARNING_PURPOSE='living-school-learning-plan-review-v2';
const TASK_PURPOSES=new Set([QUEST_PURPOSE,LEARNING_PURPOSE]);
const LOCAL_PROVIDERS=new Set(['downloaded-local','generative-local','local-ai','browser','smollm2','smollm3','qwen']);
const GEMMA4_LOCAL=/^gemma4-e(?:2|4)b-it-(?:litert-web|q4f16|q2f16-mobile)$/i;
const CONTROL=/^\s*(?:activate|activate it|activate quest|activate the quest|approve|approve it|review|review it|review quest|review the quest|revise|revise it|revise quest|revise the quest|pause|pause it|return to review)\s*[.!?]*\s*$/i;
const CANCEL=/^\s*(?:cancel|never\s*mind|forget it|drop it)\b/i;
const COMPOSITION_KEYS=[
  '__civweaveLocalProviderAuthorityV1','__civweaveLocalProviderAuthorityVersion',
  '__cwLocalGuideControlBypassV1','__cwLocalGuideControlBypassVersion',
  '__cwWeavelingAIQuestRequiredV1','__cwWeavelingStructuredQuestRouteV1','__cwWeavelingQualificationHandoffV1',
  '__cwPlatformGuideGuardsV1','__cwUnifiedChatSystemV1','__weavelingPlanJsonV190',
  '__guideIdentityIntegrityV216','__cwGuideCapabilityPassoverV1','__deterministicModeV175','__cwMossLearningGoalPlannerV1'
];
let scheduled=false;
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function emit(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,intakeModel:INTAKE_MODEL,deepModel:DEEP_MODEL,at:new Date().toISOString(),...detail}}))}catch{}}
function copyMetadata(target,source){for(const key of COMPOSITION_KEYS)if(source?.[key]!==undefined)try{target[key]=source[key]}catch{};return target}
function selectedLocal(){try{return globalThis.CivweaveLocalModelDownloadV266?.selection?.()||null}catch{return null}}
function systemFor(args={}){return clean(args.systemId||args?.context?.guide?.system||'civweave',80).toLowerCase()||'civweave'}
function localProvider(request){return LOCAL_PROVIDERS.has(clean(request?.config?.provider||request?.config?.route,120).toLowerCase())}
function taskKind(purpose){return purpose===LEARNING_PURPOSE?'learning-plan':'quest'}
function intakeEligible(args={}){const pick=selectedLocal();return systemFor(args)==='civweave'&&Boolean(clean(args.text,12000))&&Boolean(pick?.active&&GEMMA4_LOCAL.test(clean(pick.id,240)))}
function paintPending(text=''){
  const value=clean(text,500);if(!value)return false;
  try{
    const api=globalThis.CivweaveRealmSessionIntegrityV237,thread=api?.readThread?.('civweave');
    if(thread?.messages?.length&&typeof api?.writeThread==='function'){
      const messages=thread.messages.map(row=>({...row}));
      for(let i=messages.length-1;i>=0;i-=1){
        const row=messages[i];
        if(row?.role==='assistant'&&row?.pending){messages[i]={...row,text:value,intakeProgress:true};api.writeThread('civweave',{...thread,messages,updatedAt:new Date().toISOString()});return true}
      }
    }
  }catch{}
  try{
    if(typeof document==='undefined')return false;
    const root=document.getElementById?.('cw-persistent-guide-chat-v215'),rows=[...(root?.querySelectorAll?.('article[data-pending="true"]')||[])],bubble=rows.at(-1)?.querySelector?.('.cw350-bubble,.cw237-bubble');
    if(bubble){bubble.textContent=value;return true}
  }catch{}
  return false;
}

async function modelStatus(id){
  const manager=globalThis.CivweaveLocalModelDownloadV266;
  if(typeof manager?.status!=='function')return{available:false,reason:'download-manager-unavailable'};
  try{return await manager.status(id)}catch(error){return{available:false,error}}
}
async function requireModel(id,code,label){
  const status=await modelStatus(id);
  if(status?.available)return id;
  const error=new Error(`${label} is required for this local AI stage but is not installed and ready.`);
  error.code=code;error.model=id;error.status=status;throw error;
}
const requireIntakeModel=()=>requireModel(INTAKE_MODEL,'CIVWEAVE_E2B_INTAKE_REQUIRED','Gemma 4 E2B intake');
const requireDeepModel=()=>requireModel(DEEP_MODEL,'CIVWEAVE_E4B_STRUCTURED_TASK_REQUIRED','Gemma 4 E4B structured generation');

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
async function intakeRuntime(timeoutMs=12000){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    const fast=globalThis.CivweaveLiteRTGemma4FastRuntimeV1;
    if(typeof fast?.runFast==='function')return fast;
    await sleep(50);
  }
  throw Object.assign(new Error('The Gemma 4 LiteRT intake runtime did not become ready.'),{code:'CIVWEAVE_E2B_INTAKE_RUNTIME_NOT_READY'});
}

function deepConfig(config={},purpose=''){
  const learning=purpose===LEARNING_PURPOSE;
  const current=Math.max(0,Number(config.maxTokens)||0);
  return{
    ...config,
    provider:'downloaded-local',route:'downloaded-local',model:DEEP_MODEL,
    timeoutMs:TASK_TIMEOUT_MS,
    maxTokens:learning?Math.max(640,Math.min(LEARNING_MAX_TOKENS,current||LEARNING_MAX_TOKENS)):Math.max(QUEST_MIN_TOKENS,current),
    stream:false
  };
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
    config:deepConfig(request?.config||{},purpose),
    transport,
    __civweaveSkipResponseRouter:true,
    __civweaveStructuredTaskAuthorityV1:true,
    __civweaveLocalStructuredPlan:true,
    __civweaveE2BIntakeCompleted:Boolean(request?.__civweaveE2BIntakeCompleted),
    ...(purpose===LEARNING_PURPOSE?{__civweaveLocalStructuredLearningPlan:true}:{__civweaveLocalStructuredQuest:true})
  };
}

function readIntake(){
  try{
    const value=parse(localStorage.getItem(INTAKE_KEY),null);
    if(!value?.createdMs||Date.now()-Number(value.createdMs)>INTAKE_TTL_MS){clearIntake();return null}
    return value;
  }catch{return null}
}
function pendingIntake(){const value=readIntake();return value?.state==='gathering'?value:null}
function saveIntake(value={}){
  const next={schema:'civweave.weaveling.local-intake.v1',createdMs:Number(value.createdMs)||Date.now(),updatedMs:Date.now(),...value};
  try{localStorage.setItem(INTAKE_KEY,JSON.stringify(next))}catch{}
  return next;
}
function clearIntake(){try{localStorage.removeItem(INTAKE_KEY)}catch{}}
function recentRows(history=[]){
  return(Array.isArray(history)?history:[]).slice(-8).map(row=>({role:clean(row?.role,24).toLowerCase()==='assistant'?'assistant':'user',text:clean(row?.text||row?.content,900)})).filter(row=>row.text);
}
function intakeTool(){return{
  name:'route_civweave_request',
  description:'Classify and stage a Civweave request before any structured generation.',
  parameters:{type:'object',required:['route','ready','continuation','objective','facts','missingContext','reply'],properties:{
    route:{type:'string',enum:['ordinary','learning','quest']},
    ready:{type:'boolean'},
    continuation:{type:'boolean'},
    objective:{type:'string'},
    facts:{type:'array',maxItems:10,items:{type:'string'}},
    missingContext:{type:'array',maxItems:4,items:{type:'string'}},
    reply:{type:'string'}
  }}
}}
function intakeSystemPrompt(){return `You are Weaveling's fast E2B intake and routing stage. Every substantive local Weaveling request comes to you before any E4B task generation.

Classify by the OBJECT or OUTCOME the Hero is asking for, not by verbs such as help, build, create, make, or plan.
- learning: the Hero wants to gain, practice, memorize, study, understand, or master a capability, OR explicitly asks for a learning plan, Learning Journey, curriculum, course, syllabus, lesson plan, study plan, or skill tree.
- quest: the Hero wants to make, produce, organize, launch, change, finish, or accomplish a real-world project/outcome/product. A Quest may later contain a learning path, but the requested outcome itself is not learning.
- ordinary: conversation, explanation, factual questions, reflection, or anything that does not need a structured Learning Journey or Quest.

Important contrasts:
- "Help me build a learning plan for X" => learning. The noun phrase learning plan owns the route.
- "Help me build my first rock album" => quest. The album is the requested outcome.
- "Teach me how to learn and memorize the tarot" => learning.

If a pending intake record is supplied, decide whether the current message CONTINUES that same request. If not, continuation=false and do not carry its facts into the new request.
Facts must contain only information the Hero actually supplied. If continuation=true, return the complete merged set of useful supplied facts.
For learning, phrase objective as an observable capability that can follow "I want to learn to ...". For quest, phrase objective as an outcome that can follow "I want to ...". For ordinary, objective may be empty.
ready=true when there is enough information to produce a useful first-pass structure using explicit reasonable assumptions. Do not ask for preferences that can safely remain assumptions. ready=false only when one or two missing answers would materially change the shape of the generated work.
If ready=false, reply asks at most two concise high-value questions. If route=ordinary, reply directly answers the user's message. If ready=true for learning or quest, reply may be a short handoff acknowledgement.
Return only the required tool arguments.`}
function normalizeIntake(raw={},args={},prior=null){
  const route=['ordinary','learning','quest'].includes(clean(raw.route,40).toLowerCase())?clean(raw.route,40).toLowerCase():'ordinary';
  const continuation=Boolean(prior&&raw.continuation);
  const facts=(Array.isArray(raw.facts)?raw.facts:[]).map(item=>clean(item,600)).filter(Boolean).slice(0,10);
  const missingContext=(Array.isArray(raw.missingContext)?raw.missingContext:[]).map(item=>clean(item,500)).filter(Boolean).slice(0,4);
  const ready=route==='ordinary'?true:Boolean(raw.ready);
  return{
    route,ready,continuation,
    objective:clean(raw.objective,1200),facts,missingContext,
    reply:clean(raw.reply,3000),
    latestText:clean(args.text,5000),
    state:route==='ordinary'?'answered':ready?'ready':'gathering',
    createdMs:continuation?Number(prior?.createdMs)||Date.now():Date.now()
  };
}
async function classifyIntake(args={}){
  paintPending('Weaveling is sorting this request with E2B…');
  await requireIntakeModel();
  const fast=await intakeRuntime();
  const prior=pendingIntake();
  const context={currentMessage:clean(args.text,5000),pendingIntake:prior?{route:prior.route,objective:prior.objective,facts:prior.facts,missingContext:prior.missingContext,latestText:prior.latestText}:null,recentConversation:recentRows(args.history)};
  emit('civweave:weaveling-intake-progress',{phase:'classifying',model:INTAKE_MODEL});
  const result=await fast.runFast({systemPrompt:intakeSystemPrompt(),messages:[{role:'user',content:`Classify this intake context:\n${JSON.stringify(context)}`}],maxNewTokens:INTAKE_MAX_TOKENS,structuredTool:intakeTool()},INTAKE_MODEL);
  const raw=parse(clean(result?.outputText||result?.text,12000),null);
  if(!raw||typeof raw!=='object')throw Object.assign(new Error('Gemma 4 E2B intake did not return a valid routing record.'),{code:'CIVWEAVE_E2B_INTAKE_INVALID'});
  const record=normalizeIntake(raw,args,prior);
  saveIntake(record);
  if(record.route==='learning'&&record.ready)paintPending('E2B has enough context. Moss is drafting the Learning Journey with E4B…');
  else if(record.route==='quest'&&record.ready)paintPending('E2B has enough context. Weaveling is drafting the Quest with E4B…');
  else if(!record.ready)paintPending('E2B is checking what context is still needed…');
  else paintPending('E2B is preparing the response…');
  emit('civweave:weaveling-intake-progress',{phase:record.ready&&record.route!=='ordinary'?'handoff':record.state,model:INTAKE_MODEL,route:record.route,ready:record.ready});
  return record;
}
function intakePacket(record){
  const mode=record.route==='learning'?'Learn':'Plan';
  const answer=record.reply||(
    record.route==='ordinary'?'I am ready.':record.ready?'I have enough context to hand this to structured generation.':'I need one more detail before I generate this.'
  );
  return{response:{answer,choice:{mode,system:'civweave',room:'civweave.quad',nextAction:record.ready?'':'Answer the intake question so Weaveling can continue.'},assumptions:[],requiresConsent:false,confidence:.98},requestedProvider:'downloaded-local',provider:'downloaded-local',model:INTAKE_MODEL,intake:{...record,model:INTAKE_MODEL},fallbackFrom:null};
}
function learningGenerationText(record){return `I want to learn to ${clean(record.objective,1200)||'demonstrate the requested capability'}.`}
function questGenerationText(record){
  const facts=record.facts.length?`\n\nKnown context from E2B intake:\n${record.facts.map(item=>`- ${item}`).join('\n')}`:'';
  return `I want to ${clean(record.objective,1200)||clean(record.latestText,1200)}.${facts}`;
}
async function handoffIntake(record,args={}){
  if(record.route==='learning'){
    paintPending('E2B has enough context. Moss is drafting the Learning Journey with E4B…');
    const unified=globalThis.CivweaveUnifiedChatSystemV1;
    if(typeof unified?.generateLivingSchoolPlan!=='function')throw Object.assign(new Error('Moss high-level Learning Journey generation is unavailable.'),{code:'CIVWEAVE_LEARNING_PLAN_GENERATOR_NOT_READY'});
    const result=await unified.generateLivingSchoolPlan({...args,text:learningGenerationText(record),systemId:'living-school',sourceSystemId:'civweave',sourceGuide:'Weaveling',__civweaveE2BIntakeCompleted:true,intake:record});
    saveIntake({...record,state:'handed-off',handedOffTo:'living-school',handedOffAt:new Date().toISOString()});
    return result;
  }
  if(record.route==='quest'){
    paintPending('E2B has enough context. Weaveling is drafting the Quest with E4B…');
    const task=await orchestrator();
    const result=await task.createModelPlan({...args,text:questGenerationText(record),latestRequest:clean(args.text,5000),__civweaveE2BIntakeCompleted:true,intake:record},globalThis.CivweaveAssistantV141);
    saveIntake({...record,state:'handed-off',handedOffTo:'quest',handedOffAt:new Date().toISOString()});
    return result;
  }
  return intakePacket(record);
}
async function intakeRespond(args={}){
  if(CANCEL.test(clean(args.text,500))&&pendingIntake())clearIntake();
  if(CONTROL.test(clean(args.text,500)))return null;
  const record=await classifyIntake(args);
  if(record.route==='ordinary'||!record.ready)return intakePacket(record);
  return handoffIntake(record,args);
}

function installRuntime(){
  const runtime=globalThis.CivweaveModelRuntime,current=runtime?.generate;
  if(!runtime||typeof current!=='function')return false;
  if(current.__civweaveStructuredTaskAuthorityV1===VERSION)return true;
  const baseFn=current.__civweaveStructuredTaskAuthorityV1&&current.__prior?current.__prior:current;
  const prior=baseFn.bind(runtime),generate=async request=>prior(await prepareStructuredRequest(request));
  generate.__civweaveStructuredTaskAuthorityV1=VERSION;generate.__prior=baseFn;
  for(const key of Object.keys(baseFn))try{generate[key]=baseFn[key]}catch{}
  try{runtime.generate=generate;if(runtime.generate===generate)return true}catch{}
  try{globalThis.CivweaveModelRuntime={...runtime,generate};return globalThis.CivweaveModelRuntime?.generate===generate}catch{return false}
}
function installAssistant(){
  const api=globalThis.CivweaveAssistantV141,current=api?.respond;
  if(!api||typeof current!=='function')return false;
  if(current.__civweaveStructuredTaskAuthorityV1===VERSION)return true;
  const baseFn=current.__civweaveStructuredTaskAuthorityV1&&current.__prior?current.__prior:current;
  const prior=baseFn.bind(api),respond=async args=>{
    if(!intakeEligible(args))return prior(args);
    if(CONTROL.test(clean(args?.text,500)))return prior(args);
    try{return await intakeRespond(args)}catch(error){
      const message=clean(error?.message||error,1400);
      return{response:{answer:`Weaveling could not complete the local E2B intake stage. Nothing was handed to E4B.\n\nIntake detail: ${message}`,choice:{mode:'Plan',system:'civweave',room:'civweave.quad',nextAction:'Retry after both Gemma 4 local packs are ready.'},assumptions:[],requiresConsent:false,confidence:1},requestedProvider:'downloaded-local',provider:'weaveling-e2b-intake-failed',model:INTAKE_MODEL,intake:{failed:true,error:message,code:error?.code||'CIVWEAVE_E2B_INTAKE_FAILED'},fallbackFrom:null};
    }
  };
  copyMetadata(respond,baseFn);
  respond.__civweaveStructuredTaskAuthorityV1=VERSION;
  respond.__civweaveE2BIntakeFirstV1=true;
  respond.__civweaveE4BStructuredTaskOnly=true;
  respond.__prior=baseFn;
  const next={...api,respond,structuredTaskAuthority:VERSION,structuredTaskDeepModel:DEEP_MODEL,structuredTaskIntakeModel:INTAKE_MODEL};
  try{globalThis.CivweaveAssistantV141=next;return globalThis.CivweaveAssistantV141?.respond===respond}catch{return false}
}
function install(){
  const runtime=installRuntime(),assistant=installAssistant();
  if(runtime||assistant)emit('civweave:structured-task-authority-ready',{runtime,assistant,timeoutMs:TASK_TIMEOUT_MS,intakeFirst:true,intakeModel:INTAKE_MODEL,deepModel:DEEP_MODEL,learningMaxTokens:LEARNING_MAX_TOKENS,structuredTaskFallbackToE2B:false,visibleIntakeProgress:true});
  return runtime||assistant;
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;install()})}
for(const name of ['civweave:assistant-runtime-ready','civweave:unified-chat-system-ready','civweave:local-provider-authority-installed','civweave:local-guide-control-bypass-ready','civweave:guide-capability-passover-ready','civweave:local-model-runtime-ready','civweave:gemma4-litert-fast-runtime-ready','civweave:guide-loader-reset','pageshow'])addEventListener?.(name,schedule);
for(const delay of [0,50,200,700,1500,3000,6000,12000,20000,30000])setTimeout(schedule,delay);

globalThis.CivweaveGemma4StructuredTaskAuthorityV1=Object.freeze({
  version:VERSION,intakeModel:INTAKE_MODEL,deepModel:DEEP_MODEL,taskTimeoutMs:TASK_TIMEOUT_MS,learningMaxTokens:LEARNING_MAX_TOKENS,questPurpose:QUEST_PURPOSE,learningPurpose:LEARNING_PURPOSE,
  selectedLocal,intakeEligible,paintPending,modelStatus,requireIntakeModel,requireDeepModel,orchestrator,intakeRuntime,deepConfig,prepareStructuredRequest,
  readIntake,pendingIntake,saveIntake,clearIntake,intakeTool,intakeSystemPrompt,normalizeIntake,classifyIntake,intakePacket,learningGenerationText,questGenerationText,handoffIntake,intakeRespond,
  installRuntime,installAssistant,install,schedule,
  policy:'E2B is the mandatory local intake/classification stage; only ready learning or quest intake records may hand off to E4B structured generation.',
  intakeFirst:true,fallbackToE2B:false,classificationByObject:true,visibleIntakeProgress:true
});
schedule();
})();