(()=>{
'use strict';

const VERSION='1.4.6-structured-task-authority-v1-model-cache-inventory';
const rolePolicy=()=>globalThis.CivweaveLocalGenerationModelPolicyV1;
const modelFor=(role='deep',config={})=>rolePolicy()?.resolve?.(role,{config})||globalThis.CivweaveGemma4LiteRTRequestAuthorityV1?.deepRoleModel?.()||selectedLocal()?.id||'';
const intakeModel=()=>modelFor('intake');
const deepModel=(config={})=>modelFor('deep',config);
const modelName=id=>rolePolicy()?.display?.(id)||id||'Local model';
const TASK_TIMEOUT_MS=240000;
const INTAKE_TIMEOUT_MS=90000;
const LEARNING_MAX_TOKENS=900;
const QUEST_MIN_TOKENS=1800;
const INTAKE_MAX_TOKENS=800;
const INTAKE_KEY='civweave.weaveling.local-intake.v1';
const INTAKE_TTL_MS=2*60*60*1000;
const QUEST_PURPOSE='civweave-weaveling-intention-json-v190';
const LEARNING_PURPOSE='living-school-learning-plan-review-v2';
const TASK_PURPOSES=new Set([QUEST_PURPOSE,LEARNING_PURPOSE]);
const LOCAL_PROVIDERS=new Set(['downloaded-local','generative-local','local-ai','browser','smollm2','smollm3','qwen']);
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

function emit(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,intakeModel:intakeModel(),deepModel:deepModel(),at:new Date().toISOString(),...detail}}))}catch{}}
function copyMetadata(target,source){for(const key of COMPOSITION_KEYS)if(source?.[key]!==undefined)try{target[key]=source[key]}catch{};return target}
function selectedLocal(){try{return globalThis.CivweaveLocalModelDownloadV266?.selection?.()||null}catch{return null}}
function systemFor(args={}){return clean(args.systemId||args?.context?.guide?.system||'civweave',80).toLowerCase()||'civweave'}
function localProvider(request){return LOCAL_PROVIDERS.has(clean(request?.config?.provider||request?.config?.route,120).toLowerCase())}
function taskKind(purpose){return purpose===LEARNING_PURPOSE?'learning-plan':'quest'}
function intakeEligible(args={}){const pick=selectedLocal();return systemFor(args)==='civweave'&&Boolean(clean(args.text,12000))&&Boolean(pick?.active&&rolePolicy()?.supportsSelected?.())}
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
  // The shared guide can start before the local download manager finishes
  // loading. Do not falsely label a model "not installed" on a bootstrap race.
  let manager=globalThis.CivweaveLocalModelDownloadV266;
  if(typeof manager?.status!=='function'){
    const start=Date.now();
    while(Date.now()-start<2500){
      await sleep(100);
      manager=globalThis.CivweaveLocalModelDownloadV266;
      if(typeof manager?.status==='function')break;
    }
  }
  if(typeof manager?.status!=='function')return{available:false,reason:'download-manager-unavailable'};
  try{return await manager.status(id)}catch(error){return{available:false,reason:'model-status-error',error}}
}
function inventoryIssue(status){
  if(status?.reason==='download-manager-unavailable')return 'The local download manager has not loaded. No model cache inspection was possible.';
  if(status?.reason==='model-status-error')return 'The offline cache could not be inspected: '+clean(status.error?.message||status.error||'unknown error',350);
  const missing=Array.isArray(status?.missing)?status.missing:[];
  const list=missing.slice(0,5).map(row=>{
    const why=clean(row?.reason||'missing',55);
    const suffix=Number.isSafeInteger(row?.index)?' at fragment '+(row.index+1):'';
    return clean(row?.path||'unknown file',110)+' ('+why+suffix+')';
  });
  const state=clean(status?.state?.status||'',55);
  const counts=Array.isArray(status?.rows)?status.rows.filter(row=>row?.required&&row?.ok).length+'/'+status.rows.filter(row=>row?.required).length:'unknown';
  if(missing.length)return 'Offline model cache is incomplete ('+counts+' required artifacts present). Missing: '+list.join(', ')+(missing.length>list.length?' and '+(missing.length-list.length)+' more.':'.')+(state?' Saved download state: '+state+'.':'')+' Existing cached files were preserved.';
  return 'Offline model verification failed without a missing-file inventory. '+(state?'Saved download state: '+state+'. ':'')+'No files were downloaded or removed.';
}
async function requireModel(id,code,label){
  const status=await modelStatus(id);
  if(status?.available)return id;
  const error=new Error(`${label} is selected but its offline files are not verified. ${inventoryIssue(status)} Check Settings → AI Downloads or the isolated test cache inventory; do not retry GPU inference until verification succeeds.`);
  error.code=code;error.model=id;error.status=status;error.missingArtifacts=status?.missing||[];throw error;
}
const requireIntakeModel=()=>requireModel(intakeModel(),'LOCAL_INTAKE_MODEL_REQUIRED',`${modelName(intakeModel())} intake`);
const requireDeepModel=()=>requireModel(deepModel(),'LOCAL_PLANNING_MODEL_REQUIRED',`${modelName(deepModel())} planning`);

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
  throw Object.assign(new Error('The selected local model runtime did not become ready.'),{code:'CIVWEAVE_E4B_INTAKE_RUNTIME_NOT_READY'});
}

// Respect the selected model's runtime family. The ONNX Llama 3B trial is
// NEVER a LiteRT profile; sending it to runFast() produces PROFILE_MISSING.
async function modelRuntimeFor(model){
  // Resolve from the registered model engine, never from a task/role label.
  // The role policy may choose Llama, SmolLM or Qwen ONNX: none are LiteRT.
  const spec=globalThis.CivweaveLocalModelRegistryV266?.byId?.(model);
  const runtimeFamily=String(spec?.runtime||'');
  const liteProfiles=globalThis.CivweaveLiteRTGemma4FastRuntimeV1?.profiles||{};
  // Cold-start compatibility for the LiteRT family without binding this guide to a named model.
  const isKnownLiteRTId=id=>/-litert-web$/.test(String(id||''));
  const isLiteRT=runtimeFamily==='litert-lm-web'
    ||(!runtimeFamily&&(Boolean(liteProfiles[model])||isKnownLiteRTId(model)));
  if(isLiteRT)return intakeRuntime();
  if(!['transformers-js-v3','transformers-js-v4'].includes(runtimeFamily))
    throw Object.assign(new Error('No supported local inference backend is registered for the selected model. LiteRT was not attempted.'),{code:'LOCAL_MODEL_RUNTIME_FAMILY_UNSUPPORTED',executionModel:model,runtimeFamily});
  const chat=globalThis.CivweaveLocalChatRuntimeV295;
  if(typeof chat?.ready!=='function')throw Object.assign(new Error('The ONNX inference core is not available; Llama 3.2 3B cannot use the LiteRT runner.'),{code:'LOCAL_ONNX_RUNTIME_UNAVAILABLE',executionModel:model});
  await chat.ready();
  const runtime=globalThis.CivweaveLocalModelRuntimeV266;
  if(typeof runtime?.generate!=='function')throw Object.assign(new Error('The selected ONNX inference runtime did not initialize.'),{code:'LOCAL_ONNX_RUNTIME_UNAVAILABLE',executionModel:model});
  return {
    async runFast(args,id){
      const messages=[...(args.systemPrompt?[{role:'system',content:String(args.systemPrompt)}]:[]),
        ...(Array.isArray(args.messages)?args.messages:[])];
      const result=await runtime.generate({messages,
        expectedModelId:id,strictModel:true,structuredOutputSchema:args.structuredOutputSchema||null,
        maxNewTokens:Math.min(1200,Math.max(32,Number(args.maxNewTokens)||512)),
        promptTokenBudget:1300,temperature:.3,thinking:false,stream:!args.structuredOutputSchema,
        timeoutMs:240000,onToken:args.onToken,onProgress:args.onProgress});
      if(result.executionId!==id)throw Object.assign(new Error('The requested local model was silently substituted.'),{code:'LOCAL_MODEL_EXECUTION_MISMATCH',executionModel:result.executionId});
      return{outputText:result.text,text:result.text,strictJson:Boolean(result.strictJson),jsonValidated:Boolean(result.jsonValidated),
        model:{id},executionId:id,metrics:result.metrics||{}};
    },
    cancel(reason='user-stop'){return runtime.shutdown?.({reason})},
    unload(){return runtime.shutdown?.({reason:'released'})}
  };
}
function controlledFastRun(args,model,stage,timeoutMs){
  throwIfCancelled();
  return new Promise(async(resolve,reject)=>{
    let settled=false,timer=null,stallTimer=null,phase='loading-runtime',lastProgressAt=Date.now(),tokens=0,lastRuntimeDetails={};
    const firstTokenLimitMs=Math.max(10000,Math.min(90000,Number(args?.__civweaveFirstTokenTimeoutMs)||90000));
    const fast=await modelRuntimeFor(model).catch(error=>{settled=true;reject(error);return null});
    if(!fast||settled)return;
    const clearTimers=()=>{
      if(timer!=null)try{clearTimeout(timer)}catch{}
      if(stallTimer!=null)try{clearTimeout(stallTimer)}catch{}
    };
    const finish=(ok,value)=>{
      if(settled)return;settled=true;clearTimers();
      if(activeFastRun?.finish===finish)activeFastRun=null;
      syncStopButton();
      ok?resolve(value):reject(value);
    };
    const timeout=(kind)=>{
      const error=timeoutError(stage,kind==='no-first-token'?firstTokenLimitMs:timeoutMs);
      error.code=kind==='no-first-token'?'CIVWEAVE_LOCAL_FIRST_TOKEN_STALL':'CIVWEAVE_LOCAL_STAGE_TIMEOUT';
      error.executionModel=model;error.runtimePhase=phase;
      if(kind==='no-first-token'){
        error.restartRequired=true;
        error.message+=' Local GPU inference never produced a token. Restart the local runtime before repeating this request.';
      }
      error.rawDiagnostics={stage,model,phase,visibleTextDeltas:tokens,idleMs:Date.now()-lastProgressAt,watchdog:kind,runtimeDetails:lastRuntimeDetails};
      return error;
    };
    const cancel=(error=stopError())=>{
      if(settled)return false;
      if(error&&typeof error==='object'){error.executionModel=error.executionModel||model;error.runtimePhase=error.runtimePhase||phase}
      finish(false,error);
      try{if(typeof fast.cancel==='function')fast.cancel(error?.code==='CIVWEAVE_LOCAL_FIRST_TOKEN_STALL'?'no-first-token':error?.code==='CIVWEAVE_LOCAL_STAGE_TIMEOUT'?'stage-limit':'user-stop');else void fast.unload?.()}catch{}
      emit('civweave:generation-cancelled',{stage,model,code:error.code||'CIVWEAVE_GENERATION_STOPPED',runtimePhase:phase,rawDiagnostics:error?.rawDiagnostics||null});
      return true;
    };
    const markProgress=detail=>{
      lastRuntimeDetails=Object.fromEntries(Object.entries(detail||{}).filter(([key,value])=>['phase','engineMode','backend','mtpEnabled','contextTokens','maxOutputTokens','maxInputChars','inputCharacters','prefaceCharacters','constrainedDecoding','maxNumTokens','containsVisibleText'].includes(key)&&['string','number','boolean'].includes(typeof value)));
      phase=clean(detail?.phase||phase,100);
      lastProgressAt=Date.now();
      emit('civweave:local-model-stage-progress',{stage,model,phase,visibleTextDeltas:tokens,runtimeDetails:lastRuntimeDetails});
      if(['prompt-submitted','awaiting-first-token'].includes(phase)&&tokens===0){
        if(stallTimer!=null)clearTimeout(stallTimer);
        stallTimer=setTimeout(()=>cancel(timeout('no-first-token')),firstTokenLimitMs);
      }
    };
    const priorProgress=args?.onProgress,priorToken=args?.onToken;
    const runArgs={...args,onProgress:detail=>{markProgress(detail);try{priorProgress?.(detail)}catch{}},
      onToken:detail=>{
        tokens++;lastProgressAt=Date.now();
        if(stallTimer!=null){clearTimeout(stallTimer);stallTimer=null}
        try{priorToken?.(detail)}catch{}
      }};
    activeFastRun={model,stage,finish,cancel};syncStopButton();
    if(Number(timeoutMs)>0&&typeof setTimeout==='function')timer=setTimeout(()=>cancel(timeout('stage-limit')),timeoutMs);
    try{Promise.resolve(fast.runFast(runArgs,model)).then(value=>finish(true,value),error=>{
      if(error&&typeof error==='object'){error.executionModel=error.executionModel||model;error.runtimePhase=error.runtimePhase||phase}
      finish(false,error);
    })}catch(error){finish(false,error)}
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
    provider:'downloaded-local',route:'downloaded-local',model:deepModel(config),
    timeoutMs:TASK_TIMEOUT_MS,
    maxTokens:learning?Math.max(640,Math.min(LEARNING_MAX_TOKENS,current||LEARNING_MAX_TOKENS)):Math.max(QUEST_MIN_TOKENS,current),
    stream:true
  };
}
function structuredTool(schema,purpose){return{
  name:purpose===LEARNING_PURPOSE?'emit_learning_journey_plan':'emit_civweave_quest',
  description:purpose===LEARNING_PURPOSE?'Return the complete high-level Learning Journey review plan.':'Return the complete reviewable Civweave Quest.',
  parameters:schema&&typeof schema==='object'?schema:{type:'object',properties:{}}
}}
function directE4BTransport(purpose){
  // All entrypoints must use the same observable Draft -> Compile -> Validate
  // transport. The legacy constrained-tool fallback silently blocks for 600s
  // and bypasses both token events and the rejected-output inspector.
  return async args=>{
    const pipeline=globalThis.CivweaveGemma4WeaveDraftPipelineV1;
    if(typeof pipeline?.weaveTransport!=='function')throw Object.assign(
      new Error('Local Weave Draft transport is unavailable. The non-streaming 600-second fallback is disabled.'),
      {code:'CIVWEAVE_E4B_WEAVE_REQUIRED',executionModel:deepModel()}
    );
    return pipeline.weaveTransport(purpose,args||{});
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
    __civweaveE4BIntakeCompleted:Boolean(request?.__civweaveE4BIntakeCompleted),
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
function intakeSystemPrompt(){return `You are Weaveling's fast model intake and routing stage. Every substantive local Weaveling request comes to you before any structured task generation.

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
Return exactly one JSON object with the required fields; no markdown, analysis, or tool call.`}
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
  paintPending('Weaveling is sorting this request with the selected planning model…');
  await requireIntakeModel();throwIfCancelled();
  const prior=pendingIntake();
  const context={currentMessage:clean(args.text,5000),pendingIntake:prior?{route:prior.route,objective:prior.objective,facts:prior.facts,missingContext:prior.missingContext,latestText:prior.latestText}:null,recentConversation:recentRows(args.history)};
  emit('civweave:weaveling-intake-progress',{phase:'classifying',model:intakeModel()});
  // A constrained tool call cannot stream and can yield an empty result.
  // Ask E4B to emit JSON as ordinary streamed text, then validate it deterministically.
  let streamed='',deltaCount=0,result;
  try{
    result=await controlledFastRun({__civweaveStage:'Intake',
      systemPrompt:intakeSystemPrompt()+'\\nReturn one valid JSON object conforming to this schema: '+JSON.stringify(intakeTool().parameters),
      messages:[{role:'user',content:`Classify this intake context:\n${JSON.stringify(context)}`}],
      maxNewTokens:INTAKE_MAX_TOKENS,structuredTool:null,
      onToken:event=>{
        const token=String(event?.text??'');if(!token)return;
        streamed=(streamed+token).slice(-48000);
        emit('civweave:weaveling-intake-progress',{phase:'streaming',model:intakeModel(),token,index:deltaCount++,outputLength:streamed.length});
      }
    },intakeModel(),'Weaveling intake',INTAKE_TIMEOUT_MS);
  }catch(error){
    emit('civweave:weaveling-intake-progress',{phase:'failed',model:intakeModel(),outputText:streamed,error:clean(error?.message||error,1200),code:error?.code||'CIVWEAVE_E4B_INTAKE_FAILED',deltaCount,rawDiagnostics:error?.rawDiagnostics||null});
    throw error;
  }
  throwIfCancelled();
  const outputText=clean(result?.outputText||result?.text||streamed,48000);
  const raw=globalThis.CivweaveGemma4WeaveDraftPipelineV1?.parseJsonLoose?.(outputText)||parse(outputText,null);
  const validRouting=raw&&typeof raw==='object'&&!Array.isArray(raw)
    &&['ordinary','learning','quest'].includes(raw.route)
    &&typeof raw.ready==='boolean'&&typeof raw.continuation==='boolean'
    &&typeof raw.objective==='string'&&Array.isArray(raw.facts)
    &&Array.isArray(raw.missingContext)&&typeof raw.reply==='string';
  if(!validRouting){
    const error=Object.assign(new Error('The selected local model returned invalid intake JSON or omitted required routing fields; the raw response is available in Show failing message.'),{code:'CIVWEAVE_E4B_INTAKE_INVALID',executionModel:intakeModel(),rejectedText:outputText});
    emit('civweave:weaveling-intake-progress',{phase:'failed',model:intakeModel(),outputText,error:error.message,code:error.code,deltaCount});
    throw error;
  }
  emit('civweave:weaveling-intake-progress',{phase:'complete',model:intakeModel(),outputText,deltaCount});
  const record=normalizeIntake(raw,args,prior);
  saveIntake(record);
  if(record.route==='learning'&&record.ready)paintPending('The local model has enough context. Moss is drafting the Learning Journey with the selected planning model…');
  else if(record.route==='quest'&&record.ready)paintPending('The local model has enough context. Weaveling is drafting the Quest with the selected planning model…');
  else if(!record.ready)paintPending('The selected local model is checking what context is still needed…');
  else paintPending('The selected local model is preparing the response…');
  emit('civweave:weaveling-intake-progress',{phase:record.ready&&record.route!=='ordinary'?'handoff':record.state,model:intakeModel(),route:record.route,ready:record.ready});
  return record;
}
function intakePacket(record){
  const mode=record.route==='learning'?'Learn':'Plan';
  const answer=record.reply||(record.route==='ordinary'?'I am ready.':record.ready?'I have enough context to hand this to structured generation.':'I need one more detail before I generate this.');
  return{response:{answer,choice:{mode,system:'civweave',room:'civweave.quad',nextAction:record.ready?'':'Answer the intake question so Weaveling can continue.'},assumptions:[],requiresConsent:false,confidence:.98},requestedProvider:'downloaded-local',provider:'downloaded-local',model:intakeModel(),intake:{...record,model:intakeModel()},fallbackFrom:null};
}
function learningGenerationText(record){return `I want to learn to ${clean(record.objective,1200)||'demonstrate the requested capability'}.`}
function questGenerationText(record){
  const facts=record.facts.length?`\n\nKnown context from model intake:\n${record.facts.map(item=>`- ${item}`).join('\n')}`:'';
  return `I want to ${clean(record.objective,1200)||clean(record.latestText,1200)}.${facts}`;
}
async function handoffIntake(record,args={}){
  throwIfCancelled();
  if(record.route==='learning'){
    paintPending('The local model has enough context. Moss is drafting the Learning Journey with the selected planning model…');
    const unified=globalThis.CivweaveUnifiedChatSystemV1;
    if(typeof unified?.generateLivingSchoolPlan!=='function')throw Object.assign(new Error('Moss high-level Learning Journey generation is unavailable.'),{code:'CIVWEAVE_LEARNING_PLAN_GENERATOR_NOT_READY'});
    let result=await unified.generateLivingSchoolPlan({...args,text:learningGenerationText(record),systemId:'living-school',sourceSystemId:'civweave',sourceGuide:'Weaveling',__civweaveE4BIntakeCompleted:true,intake:record});
    throwIfCancelled();
    if(/could not generate the high-level Learning Journey plan/i.test(clean(result?.response?.answer,3000)))result={...result,provider:'downloaded-local',model:result?.executionModel||deepModel(),generationStage:'local-learning-plan'};
    saveIntake({...record,state:'handed-off',handedOffTo:'living-school',handedOffAt:new Date().toISOString()});
    return result;
  }
  if(record.route==='quest'){
    paintPending('The local model has enough context. Weaveling is drafting the Quest with the selected planning model…');
    const task=await orchestrator();throwIfCancelled();
    const result=await task.createModelPlan({...args,text:questGenerationText(record),latestRequest:clean(args.text,5000),__civweaveE4BIntakeCompleted:true,intake:record},globalThis.CivweaveAssistantV141);
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
  if(error?.code==='CIVWEAVE_LOCAL_STAGE_TIMEOUT')return{response:{answer:`The local ${clean(error.stage,200)} stopped because it exceeded its ${Math.round(Number(error.timeoutMs||0)/1000)} second stage limit. Nothing was generated or queued.`,choice:{mode:'Plan',system:'civweave',room:'civweave.quad',nextAction:'Retry the request or check the local model runtime.'},assumptions:[],requiresConsent:false,confidence:1},requestedProvider:'downloaded-local',provider:'local-stage-timeout',model:error?.executionModel||intakeModel(),timeout:true,fallbackFrom:null};
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
      return{response:{answer:`Weaveling could not complete the local model intake stage. Nothing was handed to the planning model.\n\nIntake detail: ${message}`,choice:{mode:'Plan',system:'civweave',room:'civweave.quad',nextAction:'Check that the configured local model is installed and ready.'},assumptions:[],requiresConsent:false,confidence:1},requestedProvider:'downloaded-local',provider:'weaveling-e4b-intake-failed',model:intakeModel(),intake:{failed:true,error:message,code:error?.code||'CIVWEAVE_E4B_INTAKE_FAILED'},fallbackFrom:null};
    }finally{activeRequest=null;syncStopButton()}
  };
  copyMetadata(respond,baseFn);
  respond.__civweaveStructuredTaskAuthorityV1=VERSION;
  respond.__civweaveE4BIntakeFirstV1=true;
  respond.__civweaveE4BStructuredTaskOnly=true;
  respond.__civweaveGenerationStopV1=true;
  respond.__prior=baseFn;
  const next={...api,respond,structuredTaskAuthority:VERSION,structuredTaskDeepModel:deepModel(),structuredTaskIntakeModel:intakeModel()};
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
  if(runtime||assistant||stopUI)emit('civweave:structured-task-authority-ready',{runtime,assistant,stopUI,timeoutMs:TASK_TIMEOUT_MS,intakeTimeoutMs:INTAKE_TIMEOUT_MS,intakeFirst:true,intakeModel:intakeModel(),deepModel:deepModel(),learningMaxTokens:LEARNING_MAX_TOKENS,structuredTaskFallbackToE4B:false,visibleIntakeProgress:true,constrainedE4B:true,stopButton:true});
  return runtime||assistant||stopUI;
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;install()})}
for(const name of ['civweave:assistant-runtime-ready','civweave:unified-chat-system-ready','civweave:local-provider-authority-installed','civweave:local-guide-control-bypass-ready','civweave:guide-capability-passover-ready','civweave:local-model-runtime-ready','civweave:gemma4-litert-fast-runtime-ready','civweave:guide-loader-reset','civweave:guide-chat-ready','pageshow'])addEventListener?.(name,schedule);
for(const delay of [0,50,200,700,1500,3000,6000,12000,20000,30000])setTimeout(schedule,delay);

globalThis.CivweaveGemma4StructuredTaskAuthorityV1=Object.freeze({
  version:VERSION,get intakeModel(){return intakeModel()},get deepModel(){return deepModel()},taskTimeoutMs:TASK_TIMEOUT_MS,intakeTimeoutMs:INTAKE_TIMEOUT_MS,learningMaxTokens:LEARNING_MAX_TOKENS,questPurpose:QUEST_PURPOSE,learningPurpose:LEARNING_PURPOSE,
  selectedLocal,intakeEligible,paintPending,modelStatus,requireIntakeModel,requireDeepModel,orchestrator,intakeRuntime,controlledFastRun,cancelActiveGeneration,deepConfig,structuredTool,directE4BTransport,prepareStructuredRequest,
  readIntake,pendingIntake,saveIntake,clearIntake,intakeTool,intakeSystemPrompt,normalizeIntake,classifyIntake,intakePacket,learningGenerationText,questGenerationText,handoffIntake,intakeRespond,
  installRuntime,installAssistant,installStopUI,syncStopButton,install,schedule,
  policy:'The configured local planning model handles intake and structured generation; the fast chat selection is not silently substituted.',
  intakeFirst:true,fallbackToE4B:false,classificationByObject:true,visibleIntakeProgress:true,constrainedE4B:true,stopButton:true
});
schedule();
})();