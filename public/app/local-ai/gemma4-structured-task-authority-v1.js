(()=>{
'use strict';

const VERSION='1.2.0-gemma4-structured-task-authority-v1-e2b-intake-e4b-constrained-stop';
const INTAKE_MODEL='gemma4-e2b-it-litert-web';
const DEEP_MODEL='gemma4-e4b-it-litert-web';
const TASK_TIMEOUT_MS=600000;
const INTAKE_TIMEOUT_MS=90000;
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
let activeFastRun=null;
let activeRequest=null;
const activeRuntimeControllers=new Set();
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
function stopError(message='Generation stopped by the Hero.'){return Object.assign(new Error(message),{code:'CIVWEAVE_GENERATION_STOPPED',cancelled:true})}
function timeoutError(stage,timeoutMs){return Object.assign(new Error(`${stage} did not finish within ${Math.round(timeoutMs/1000)} seconds.`),{code:'CIVWEAVE_LOCAL_STAGE_TIMEOUT',stage,timeoutMs})}
function requestCancelled(){return Boolean(activeRequest?.cancelled)}
function throwIfCancelled(){if(requestCancelled())throw stopError()}

function paintPending(text=''){
  const value=clean(text,500);if(!value)return false;
  let painted=false;
  try{
    const api=globalThis.CivweaveRealmSessionIntegrityV237,thread=api?.readThread?.('civweave');
    if(thread?.messages?.length&&typeof api?.writeThread==='function'){
      const messages=thread.messages.map(row=>({...row}));
      for(let i=messages.length-1;i>=0;i-=1){
        const row=messages[i];
        if(row?.role==='assistant'&&row?.pending){messages[i]={...row,text:value,intakeProgress:true};api.writeThread('civweave',{...thread,messages,updatedAt:new Date().toISOString()});painted=true;break}
      }
    }
  }catch{}
  try{
    if(typeof document!=='undefined'){
      const root=document.getElementById?.('cw-persistent-guide-chat-v215'),rows=[...(root?.querySelectorAll?.('article[data-pending="true"]')||[])],bubble=rows.at(-1)?.querySelector?.('.cw350-bubble,.cw237-bubble');
      if(bubble){bubble.textContent=value;painted=true}
    }
  }catch{}
  syncStopButton();
  return painted;
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

function controlledFastRun(args,model,stage,timeoutMs){
  throwIfCancelled();
  return new Promise(async(resolve,reject)=>{
    let settled=false,timer=null;
    const fast=await intakeRuntime().catch(error=>{settled=true;reject(error);return null});
    if(!fast||settled)return;
    const finish=(ok,value)=>{
      if(settled)return;settled=true;
      if(timer!=null&&typeof clearTimeout==='function')try{clearTimeout(timer)}catch{}
      if(activeFastRun?.finish===finish)activeFastRun=null;
      syncStopButton();
      ok?resolve(value):reject(value);
    };
    const cancel=(error=stopError())=>{
      if(settled)return false;
      finish(false,error);
      try{void fast.unload?.()}catch{}
      emit('civweave:generation-cancelled',{stage,model,code:error.code||'CIVWEAVE_GENERATION_STOPPED'});
      return true;
    };
    activeFastRun={model,stage,finish,cancel};syncStopButton();
    if(Number(timeoutMs)>0&&typeof setTimeout==='function')timer=setTimeout(()=>cancel(timeoutError(stage,timeoutMs)),timeoutMs);
    try{
      Promise.resolve(fast.runFast(args,model)).then(value=>finish(true,value),error=>finish(false,error));
    }catch(error){finish(false,error)}
  });
}
function cancelActiveGeneration(reason='user-stop'){
  let stopped=false;
  if(activeRequest){activeRequest.cancelled=true;activeRequest.reason=reason;stopped=true}
  if(activeFastRun?.cancel)stopped=activeFastRun.cancel(stopError())||stopped;
  for(const controller of [...activeRuntimeControllers])try{controller.abort(stopError());stopped=true}catch{}
  try{void globalThis.CivweaveLiteRTGemma4FastRuntimeV1?.unload?.()}catch{}
  if(stopped){paintPending('Generation stopped.');emit('civweave:generation-stop-requested',{reason})}
  syncStopButton();
  return stopped;
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
function structuredTool(schema,purpose){return{
  name:purpose===LEARNING_PURPOSE?'emit_learning_journey_plan':'emit_civweave_quest',
  description:purpose===LEARNING_PURPOSE?'Return the complete high-level Learning Journey review plan.':'Return the complete reviewable Civweave Quest.',
  parameters:schema&&typeof schema==='object'?schema:{type:'object',properties:{}}
}}
function directE4BTransport(purpose){
  const stage=purpose===LEARNING_PURPOSE?'Moss E4B Learning Journey plan':'Weaveling E4B Quest';
  return async({config={},messages=[],schema=null,signal,emit:runtimeEmit}={})=>{
    throwIfCancelled();
    if(signal?.aborted)throw stopError();
    await requireDeepModel();
    const systemRow=(Array.isArray(messages)?messages:[]).find(row=>clean(row?.role,20).toLowerCase()==='system');
    const modelMessages=(Array.isArray(messages)?messages:[]).filter(row=>clean(row?.role,20).toLowerCase()!=='system').map(row=>({role:row.role,content:row.content??row.text??''}));
    try{runtimeEmit?.('connecting',{provider:'downloaded-local',model:DEEP_MODEL,mode:'litert-constrained-tool'})}catch{}
    const result=await controlledFastRun({
      systemPrompt:clean(systemRow?.content||systemRow?.text,12000)||'Return only the required structured result.',
      messages:modelMessages,
      maxNewTokens:Math.max(64,Number(config.maxTokens)|| (purpose===LEARNING_PURPOSE?LEARNING_MAX_TOKENS:QUEST_MIN_TOKENS)),
      structuredTool:structuredTool(schema,purpose)
    },DEEP_MODEL,stage,Number(config.timeoutMs)||TASK_TIMEOUT_MS);
    throwIfCancelled();
    const text=clean(result?.outputText||result?.text,48000);
    if(!text)throw Object.assign(new Error(`${stage} returned no structured arguments.`),{code:'CIVWEAVE_E4B_STRUCTURED_OUTPUT_EMPTY'});
    return{text,payload:{text},model:DEEP_MODEL,provider:'downloaded-local',streamed:false,diagnostics:[{kind:'litert-constrained-tool',model:DEEP_MODEL,purpose}]};
  };
}
async function prepareStructuredRequest(request){
  const purpose=clean(request?.purpose,180);
  if(!TASK_PURPOSES.has(purpose)||!localProvider(request))return request;
  await requireDeepModel();
  return{
    ...request,
    config:deepConfig(request?.config||{},purpose),
    transport:directE4BTransport(purpose),
    maxRepairAttempts:0,
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
  await requireIntakeModel();throwIfCancelled();
  const prior=pendingIntake();
  const context={currentMessage:clean(args.text,5000),pendingIntake:prior?{route:prior.route,objective:prior.objective,facts:prior.facts,missingContext:prior.missingContext,latestText:prior.latestText}:null,recentConversation:recentRows(args.history)};
  emit('civweave:weaveling-intake-progress',{phase:'classifying',model:INTAKE_MODEL});
  const result=await controlledFastRun({systemPrompt:intakeSystemPrompt(),messages:[{role:'user',content:`Classify this intake context:\n${JSON.stringify(context)}`}],maxNewTokens:INTAKE_MAX_TOKENS,structuredTool:intakeTool()},INTAKE_MODEL,'Weaveling E2B intake',INTAKE_TIMEOUT_MS);
  throwIfCancelled();
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
  const answer=record.reply||(record.route==='ordinary'?'I am ready.':record.ready?'I have enough context to hand this to structured generation.':'I need one more detail before I generate this.');
  return{response:{answer,choice:{mode,system:'civweave',room:'civweave.quad',nextAction:record.ready?'':'Answer the intake question so Weaveling can continue.'},assumptions:[],requiresConsent:false,confidence:.98},requestedProvider:'downloaded-local',provider:'downloaded-local',model:INTAKE_MODEL,intake:{...record,model:INTAKE_MODEL},fallbackFrom:null};
}
function learningGenerationText(record){return `I want to learn to ${clean(record.objective,1200)||'demonstrate the requested capability'}.`}
function questGenerationText(record){
  const facts=record.facts.length?`\n\nKnown context from E2B intake:\n${record.facts.map(item=>`- ${item}`).join('\n')}`:'';
  return `I want to ${clean(record.objective,1200)||clean(record.latestText,1200)}.${facts}`;
}
async function handoffIntake(record,args={}){
  throwIfCancelled();
  if(record.route==='learning'){
    paintPending('E2B has enough context. Moss is drafting the Learning Journey with E4B…');
    const unified=globalThis.CivweaveUnifiedChatSystemV1;
    if(typeof unified?.generateLivingSchoolPlan!=='function')throw Object.assign(new Error('Moss high-level Learning Journey generation is unavailable.'),{code:'CIVWEAVE_LEARNING_PLAN_GENERATOR_NOT_READY'});
    let result=await unified.generateLivingSchoolPlan({...args,text:learningGenerationText(record),systemId:'living-school',sourceSystemId:'civweave',sourceGuide:'Weaveling',__civweaveE2BIntakeCompleted:true,intake:record});
    throwIfCancelled();
    if(/could not generate the high-level Learning Journey plan/i.test(clean(result?.response?.answer,3000)))result={...result,provider:'downloaded-local',model:DEEP_MODEL,generationStage:'e4b-learning-plan'};
    saveIntake({...record,state:'handed-off',handedOffTo:'living-school',handedOffAt:new Date().toISOString()});
    return result;
  }
  if(record.route==='quest'){
    paintPending('E2B has enough context. Weaveling is drafting the Quest with E4B…');
    const task=await orchestrator();throwIfCancelled();
    const result=await task.createModelPlan({...args,text:questGenerationText(record),latestRequest:clean(args.text,5000),__civweaveE2BIntakeCompleted:true,intake:record},globalThis.CivweaveAssistantV141);
    throwIfCancelled();
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
  const prior=baseFn.bind(runtime),generate=async request=>{
    let controller=null,nextRequest=request||{};
    if(typeof AbortController==='function'&&!nextRequest.signal){controller=new AbortController();activeRuntimeControllers.add(controller);nextRequest={...nextRequest,signal:controller.signal};syncStopButton()}
    try{return await prior(await prepareStructuredRequest(nextRequest))}finally{if(controller){activeRuntimeControllers.delete(controller);syncStopButton()}}
  };
  generate.__civweaveStructuredTaskAuthorityV1=VERSION;generate.__prior=baseFn;
  for(const key of Object.keys(baseFn))try{generate[key]=baseFn[key]}catch{}
  try{runtime.generate=generate;if(runtime.generate===generate)return true}catch{}
  try{globalThis.CivweaveModelRuntime={...runtime,generate};return globalThis.CivweaveModelRuntime?.generate===generate}catch{return false}
}
function cancellationPacket(error){
  if(error?.code==='CIVWEAVE_GENERATION_STOPPED')return{response:{answer:'Generation stopped.',choice:{mode:'Plan',system:'civweave',room:'civweave.quad',nextAction:''},assumptions:[],requiresConsent:false,confidence:1},requestedProvider:'downloaded-local',provider:'generation-stopped',model:clean(activeFastRun?.model||'',240),cancelled:true,fallbackFrom:null};
  if(error?.code==='CIVWEAVE_LOCAL_STAGE_TIMEOUT')return{response:{answer:`The local ${clean(error.stage,200)} stopped because it exceeded its ${Math.round(Number(error.timeoutMs||0)/1000)} second stage limit. Nothing was generated or queued.`,choice:{mode:'Plan',system:'civweave',room:'civweave.quad',nextAction:'Retry the request or check the local model runtime.'},assumptions:[],requiresConsent:false,confidence:1},requestedProvider:'downloaded-local',provider:'local-stage-timeout',model:error.stage?.includes('E2B')?INTAKE_MODEL:DEEP_MODEL,timeout:true,fallbackFrom:null};
  return null;
}
function installAssistant(){
  const api=globalThis.CivweaveAssistantV141,current=api?.respond;
  if(!api||typeof current!=='function')return false;
  if(current.__civweaveStructuredTaskAuthorityV1===VERSION)return true;
  const baseFn=current.__civweaveStructuredTaskAuthorityV1&&current.__prior?current.__prior:current;
  const prior=baseFn.bind(api),respond=async args=>{
    if(!intakeEligible(args))return prior(args);
    if(CONTROL.test(clean(args?.text,500)))return prior(args);
    activeRequest={id:`intake-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,cancelled:false};syncStopButton();
    try{return await intakeRespond(args)}catch(error){
      const cancelled=cancellationPacket(error);if(cancelled)return cancelled;
      const message=clean(error?.message||error,1400);
      return{response:{answer:`Weaveling could not complete the local E2B intake stage. Nothing was handed to E4B.\n\nIntake detail: ${message}`,choice:{mode:'Plan',system:'civweave',room:'civweave.quad',nextAction:'Retry after both Gemma 4 local packs are ready.'},assumptions:[],requiresConsent:false,confidence:1},requestedProvider:'downloaded-local',provider:'weaveling-e2b-intake-failed',model:INTAKE_MODEL,intake:{failed:true,error:message,code:error?.code||'CIVWEAVE_E2B_INTAKE_FAILED'},fallbackFrom:null};
    }finally{activeRequest=null;syncStopButton()}
  };
  copyMetadata(respond,baseFn);
  respond.__civweaveStructuredTaskAuthorityV1=VERSION;
  respond.__civweaveE2BIntakeFirstV1=true;
  respond.__civweaveE4BStructuredTaskOnly=true;
  respond.__civweaveGenerationStopV1=true;
  respond.__prior=baseFn;
  const next={...api,respond,structuredTaskAuthority:VERSION,structuredTaskDeepModel:DEEP_MODEL,structuredTaskIntakeModel:INTAKE_MODEL};
  try{globalThis.CivweaveAssistantV141=next;return globalThis.CivweaveAssistantV141?.respond===respond}catch{return false}
}

function hasPendingGuideMessage(){
  try{
    const system=globalThis.CivweavePersistentGuideChatV215?.activeWindow?.()||'civweave';
    const thread=globalThis.CivweaveRealmSessionIntegrityV237?.readThread?.(system);
    return Boolean((thread?.messages||[]).some(row=>row?.role==='assistant'&&row?.pending));
  }catch{return false}
}
function syncStopButton(){
  try{
    if(typeof document==='undefined')return false;
    const button=document.querySelector?.('#cw-persistent-guide-chat-v215 [data-send]');if(!button)return false;
    const running=Boolean(activeRequest||activeFastRun||activeRuntimeControllers.size||hasPendingGuideMessage());
    if(running){button.disabled=false;button.type='button';button.textContent='Stop';button.dataset.generationStop='true';button.setAttribute('aria-label','Stop generation');button.title='Stop generation'}
    else{button.disabled=false;button.type='submit';button.textContent='Send';delete button.dataset.generationStop;button.setAttribute('aria-label','Send message');button.title='Send message'}
    return true;
  }catch{return false}
}
function installStopUI(){
  if(typeof document==='undefined')return false;
  if(!globalThis.__civweaveGenerationStopUIV1){
    globalThis.__civweaveGenerationStopUIV1=true;
    document.addEventListener('click',event=>{
      const button=event.target?.closest?.('#cw-persistent-guide-chat-v215 [data-send][data-generation-stop="true"]');if(!button)return;
      event.preventDefault();event.stopPropagation();try{event.stopImmediatePropagation?.()}catch{}
      globalThis.CivweaveGemma4StructuredTaskAuthorityV1?.cancelActiveGeneration?.('stop-button');
    },true);
    for(const name of ['civweave:realm-guide-thread-changed','civweave:litert-gemma4-progress','civweave:litert-gemma4-complete','civweave:model-event','civweave:guide-chat-opened'])addEventListener?.(name,()=>queueMicrotask(syncStopButton));
  }
  queueMicrotask(syncStopButton);return true;
}
function install(){
  const runtime=installRuntime(),assistant=installAssistant(),stopUI=installStopUI();
  if(runtime||assistant||stopUI)emit('civweave:structured-task-authority-ready',{runtime,assistant,stopUI,timeoutMs:TASK_TIMEOUT_MS,intakeTimeoutMs:INTAKE_TIMEOUT_MS,intakeFirst:true,intakeModel:INTAKE_MODEL,deepModel:DEEP_MODEL,learningMaxTokens:LEARNING_MAX_TOKENS,structuredTaskFallbackToE2B:false,visibleIntakeProgress:true,constrainedE4B:true,stopButton:true});
  return runtime||assistant||stopUI;
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;install()})}
for(const name of ['civweave:assistant-runtime-ready','civweave:unified-chat-system-ready','civweave:local-provider-authority-installed','civweave:local-guide-control-bypass-ready','civweave:guide-capability-passover-ready','civweave:local-model-runtime-ready','civweave:gemma4-litert-fast-runtime-ready','civweave:guide-loader-reset','civweave:guide-chat-ready','pageshow'])addEventListener?.(name,schedule);
for(const delay of [0,50,200,700,1500,3000,6000,12000,20000,30000])setTimeout(schedule,delay);

globalThis.CivweaveGemma4StructuredTaskAuthorityV1=Object.freeze({
  version:VERSION,intakeModel:INTAKE_MODEL,deepModel:DEEP_MODEL,taskTimeoutMs:TASK_TIMEOUT_MS,intakeTimeoutMs:INTAKE_TIMEOUT_MS,learningMaxTokens:LEARNING_MAX_TOKENS,questPurpose:QUEST_PURPOSE,learningPurpose:LEARNING_PURPOSE,
  selectedLocal,intakeEligible,paintPending,modelStatus,requireIntakeModel,requireDeepModel,orchestrator,intakeRuntime,controlledFastRun,cancelActiveGeneration,deepConfig,structuredTool,directE4BTransport,prepareStructuredRequest,
  readIntake,pendingIntake,saveIntake,clearIntake,intakeTool,intakeSystemPrompt,normalizeIntake,classifyIntake,intakePacket,learningGenerationText,questGenerationText,handoffIntake,intakeRespond,
  installRuntime,installAssistant,installStopUI,syncStopButton,install,schedule,
  policy:'E2B is the mandatory local intake/classification stage; only ready learning or quest intake records may hand off to E4B structured generation.',
  intakeFirst:true,fallbackToE2B:false,classificationByObject:true,visibleIntakeProgress:true,constrainedE4B:true,stopButton:true
});
schedule();
})();