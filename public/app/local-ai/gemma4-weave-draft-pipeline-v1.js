(()=>{
'use strict';

const VERSION='1.0.0-gemma4-weave-draft-pipeline-v1-plan-compile-repair';
const DEEP_MODEL='gemma4-e4b-it-litert-web';
const LEARNING_PURPOSE='living-school-learning-plan-review-v2';
const QUEST_PURPOSE='civweave-weaveling-intention-json-v190';
const PURPOSES=new Set([LEARNING_PURPOSE,QUEST_PURPOSE]);
const LOCAL_PROVIDERS=new Set(['downloaded-local','generative-local','local-ai','browser','smollm2','smollm3','qwen']);
const ARTIFACT_PREFIX='civweave.weave-draft-pipeline.v1';
const DRAFT_TOKENS=Object.freeze({learning:1500,quest:2100});
const COMPILE_TOKENS=Object.freeze({learning:1400,quest:2100});
const REPAIR_TOKENS=Object.freeze({learning:1200,quest:1700});
const MAX_STAGE_TEXT=16000;

if(globalThis.CivweaveGemma4WeaveDraftPipelineV1?.version===VERSION){
  globalThis.CivweaveGemma4WeaveDraftPipelineV1.install?.();
  return;
}

const clean=(value,max=MAX_STAGE_TEXT)=>String(value??'').trim().slice(0,max);
const isObject=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
const now=()=>new Date().toISOString();
const uid=()=>`weave-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const authority=()=>globalThis.CivweaveGemma4StructuredTaskAuthorityV1||null;
let runtimeTarget=null;
let scheduled=false;
let lastArtifact=null;

function kindFor(purpose){return purpose===LEARNING_PURPOSE?'learning':'quest'}
function localProvider(request){return LOCAL_PROVIDERS.has(clean(request?.config?.provider||request?.config?.route,120).toLowerCase())}
function targeted(request){return PURPOSES.has(clean(request?.purpose,180))&&localProvider(request)}
function dispatch(detail={}){
  const payload={version:VERSION,at:now(),model:DEEP_MODEL,...detail};
  try{globalThis.dispatchEvent?.(new CustomEvent('civweave:weave-pipeline',{detail:payload}))}catch{}
  return payload;
}
function paint(text){try{authority()?.paintPending?.(text)}catch{}}
function artifactKey(kind){return `${ARTIFACT_PREFIX}.${kind}`}
function saveArtifact(value){
  lastArtifact={schema:'civweave.weave-draft-pipeline-artifact.v1',version:VERSION,...value,updatedAt:now()};
  try{localStorage.setItem(artifactKey(lastArtifact.kind),JSON.stringify(lastArtifact));localStorage.setItem(`${ARTIFACT_PREFIX}.latest`,JSON.stringify(lastArtifact))}catch{}
  return lastArtifact;
}
function readArtifact(kind='latest'){
  try{return JSON.parse(localStorage.getItem(kind==='latest'?`${ARTIFACT_PREFIX}.latest`:artifactKey(kind))||'null')}catch{return null}
}
function stripThink(text){return clean(text,48000).replace(/<think>[\s\S]*?<\/think>/gi,'').trim().replace(/^```(?:json|javascript|js)?\s*/i,'').replace(/\s*```$/,'').trim()}
function firstBalancedJson(text){
  const source=stripThink(text);
  for(let start=0;start<source.length;start+=1){
    const opener=source[start];if(opener!=='{'&&opener!=='[')continue;
    const closer=opener==='{'?'}':']';let depth=0,quoted=false,escaped=false;
    for(let i=start;i<source.length;i+=1){
      const char=source[i];
      if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue}
      if(char==='"'){quoted=true;continue}
      if(char===opener)depth+=1;else if(char===closer){depth-=1;if(depth===0)return source.slice(start,i+1)}
    }
  }
  return source;
}
function parseJsonLoose(text){try{return JSON.parse(firstBalancedJson(text))}catch{return null}}
function strings(value,maxItems=20,maxLength=1000){return Array.isArray(value)?value.map(item=>typeof item==='string'?clean(item,maxLength):item).filter(item=>typeof item==='string'?Boolean(item):Boolean(item)).slice(0,maxItems):[]}
function objectArray(value,maxItems=20){
  if(Array.isArray(value))return value.filter(Boolean).map(item=>isObject(item)?clone(item):{item:clean(item,900)}).slice(0,maxItems);
  if(isObject(value))return Object.entries(value).map(([key,item])=>isObject(item)?{name:key,...clone(item)}:{name:key,item:clean(item,900)}).slice(0,maxItems);
  if(clean(value,900))return[{item:clean(value,900)}];
  return[];
}
function companions(raw={}){
  const resourceManifest=objectArray(raw.resourceManifest??raw.resources??raw.resourceList??raw.materials,24);
  const specialistWork=objectArray(raw.specialistWork??raw.specialists??raw.licensedWork??raw.regulatedWork,16);
  const decisionGates=objectArray(raw.decisionGates??raw.governanceGates??raw.votes??raw.decisionPoints,16).map((gate,index)=>({
    id:clean(gate.id,120)||`gate-${index+1}`,
    decision:clean(gate.decision||gate.question||gate.title||gate.item,1000),
    why:clean(gate.why||gate.reason||gate.purpose,1200),
    options:strings(gate.options||gate.choices,10,700),
    prerequisites:strings(gate.prerequisites||gate.inputs||gate.before,10,700),
    blockingBeat:clean(gate.blockingBeat||gate.blocks||gate.blockedStep||gate.nextBeat,1000),
    voteRequired:gate.voteRequired!==false,
    realm:'anarchadia'
  })).filter(gate=>gate.decision);
  return{resourceManifest,specialistWork,decisionGates};
}
function canonicalModule(item,index){
  if(!isObject(item))return null;
  const title=clean(item.title||item.name,220),focus=clean(item.focus||item.purpose||item.goal||item.objective,1000),outcome=clean(item.outcome||item.demonstrableOutcome||item.result||item.evidence,1000);
  return title&&focus&&outcome?{...item,title,focus,outcome}:null;
}
function canonicalLearning(raw){
  if(!isObject(raw))return raw;
  const modules=(Array.isArray(raw.modules)?raw.modules:Array.isArray(raw.milestones)?raw.milestones:Array.isArray(raw.stages)?raw.stages:[]).map(canonicalModule).filter(Boolean).slice(0,8);
  const level=clean(raw.level,80).toLowerCase(),mode=clean(raw.mode,80).toLowerCase(),extra=companions(raw);
  return{
    ...raw,
    title:clean(raw.title||raw.name,240),
    capability:clean(raw.capability||raw.goal||raw.objective,2400),
    level:['beginner','intermediate','advanced'].includes(level)?level:level,
    ...(mode?{mode}:{}),
    proof:clean(raw.proof||raw.completionEvidence||raw.demonstration||raw.evidence,3000),
    modules,
    assumptions:strings(raw.assumptions,6,700),
    ...extra
  };
}
function canonicalPath(path){
  if(!isObject(path))return null;
  return{
    ...path,
    type:clean(path.type,80),realm:clean(path.realm,80),title:clean(path.title||path.name,240),purpose:clean(path.purpose||path.goal,1200),
    steps:strings(path.steps||path.beats||path.actions,8,800),
    completionCriteria:clean(path.completionCriteria||path.doneWhen||path.completion,1200),
    evidence:strings(path.evidence||path.receipts||path.proof,8,700)
  };
}
function ensureVotingPath(raw){
  if(!isObject(raw)||!Array.isArray(raw.decisionGates))return raw;
  const gates=raw.decisionGates.filter(gate=>gate?.voteRequired!==false&&clean(gate?.decision,1000));
  if(!gates.length)return raw;
  const paths=Array.isArray(raw.paths)?raw.paths.map(canonicalPath).filter(Boolean):[];
  let civic=paths.find(path=>path.realm==='anarchadia'&&path.type==='civic-governance');
  const voteSteps=gates.map(gate=>`Mandatory vote: ${clean(gate.decision,700)}${gate.blockingBeat?` — block “${clean(gate.blockingBeat,500)}” until the vote is resolved.`:' — do not proceed past this decision gate until the vote is resolved.'}`);
  if(civic){
    civic.steps=[...new Set([...(civic.steps||[]),...voteSteps])].slice(0,8);
    civic.evidence=[...new Set([...(civic.evidence||[]),'Anarchadia vote receipt for each mandatory decision gate.'])].slice(0,8);
    if(!civic.completionCriteria)civic.completionCriteria='Every mandatory Anarchadia vote is resolved before its blocked Quest beat proceeds.';
  }else if(paths.length<4){
    civic={type:'civic-governance',realm:'anarchadia',title:'Mandatory Decision Gates',purpose:'Resolve collective choices before dependent Quest beats proceed.',steps:voteSteps.slice(0,8),completionCriteria:'Every mandatory Anarchadia vote is resolved before its blocked Quest beat proceeds.',evidence:['Anarchadia vote receipt for each mandatory decision gate.']};
    paths.push(civic);
  }
  return{...raw,paths};
}
function canonicalQuest(raw){
  if(!isObject(raw))return raw;
  const extra=companions(raw),paths=(Array.isArray(raw.paths)?raw.paths:Array.isArray(raw.workstreams)?raw.workstreams:Array.isArray(raw.tracks)?raw.tracks:[]).map(canonicalPath).filter(Boolean).slice(0,4);
  const next={
    ...raw,
    title:clean(raw.title||raw.name,240),
    wish:clean(raw.wish||raw.request||raw.goal,4000),
    outcome:clean(raw.outcome||raw.result||raw.objective,2400),
    assumptions:strings(raw.assumptions,8,700),
    paths,
    ...extra
  };
  if(!next.assumptions.length)next.assumptions=['No unstated assumptions were added; unspecified details remain open for the Hero to decide.'];
  return ensureVotingPath(next);
}
function canonicalize(raw,kind){return kind==='learning'?canonicalLearning(raw):canonicalQuest(raw)}
function validateSchema(value,schema,path='$',errors=[],depth=0){
  if(!schema||!isObject(schema)||depth>24||errors.length>50)return errors;
  if(Array.isArray(schema.enum)&&!schema.enum.some(item=>JSON.stringify(item)===JSON.stringify(value))){errors.push(`${path} must match one of the declared values.`);return errors}
  const type=Array.isArray(schema.type)?schema.type.find(item=>item!=='null'):schema.type;
  if(type==='object'){
    if(!isObject(value)){errors.push(`${path} must be an object.`);return errors}
    for(const key of (Array.isArray(schema.required)?schema.required:[]))if(!(key in value))errors.push(`${path}.${key} is required.`);
    const properties=isObject(schema.properties)?schema.properties:{};
    for(const [key,child] of Object.entries(properties))if(key in value)validateSchema(value[key],child,`${path}.${key}`,errors,depth+1);
  }else if(type==='array'){
    if(!Array.isArray(value)){errors.push(`${path} must be an array.`);return errors}
    if(Number.isFinite(Number(schema.minItems))&&value.length<Number(schema.minItems))errors.push(`${path} must contain at least ${schema.minItems} items.`);
    if(Number.isFinite(Number(schema.maxItems))&&value.length>Number(schema.maxItems))errors.push(`${path} must contain no more than ${schema.maxItems} items.`);
    if(schema.items)value.slice(0,128).forEach((item,index)=>validateSchema(item,schema.items,`${path}[${index}]`,errors,depth+1));
  }else if(type==='string'&&typeof value!=='string')errors.push(`${path} must be a string.`);
  else if(type==='number'&&(typeof value!=='number'||!Number.isFinite(value)))errors.push(`${path} must be a number.`);
  else if(type==='integer'&&!Number.isInteger(value))errors.push(`${path} must be an integer.`);
  else if(type==='boolean'&&typeof value!=='boolean')errors.push(`${path} must be a boolean.`);
  return errors;
}
function validateCompiled(value,schema,kind){
  const errors=validateSchema(value,schema);
  if(!isObject(value))return errors;
  if(!Array.isArray(value.resourceManifest))errors.push('$.resourceManifest must be present as an array.');
  if(!Array.isArray(value.specialistWork))errors.push('$.specialistWork must be present as an array.');
  if(!Array.isArray(value.decisionGates))errors.push('$.decisionGates must be present as an array.');
  if(kind==='quest'){
    const gates=(value.decisionGates||[]).filter(gate=>gate?.voteRequired!==false);
    if(gates.length&&!((value.paths||[]).some(path=>path?.realm==='anarchadia'&&path?.type==='civic-governance')))errors.push('Mandatory decision gates require an Anarchadia civic-governance path.');
  }
  return errors.slice(0,30);
}
function draftSystem(kind){
  const subject=kind==='learning'?'high-level Learning Journey':'reviewable Quest';
  return `You are Gemma 4 E4B working in Civweave Weave Draft mode. Create the strongest useful ${subject} you can from the supplied request and context. This is a planning artifact, not JSON, not a tool call, and not private chain-of-thought. Give conclusions, structure, dependencies, and useful planning detail without narrating hidden reasoning.\n\nYou may organize the draft however you think is clearest. Content requirements:\n- State the intended outcome or observable capability.\n- Lay out the stages/modules/Quest beats and important dependencies.\n- Include a complete resource manifest: information, references, tools, materials, software, places, people, services, money/access, or other resources genuinely needed. If a category is unnecessary, say so rather than inventing a need.\n- Identify any specialist, licensed, regulated, certified, or otherwise professionally restricted work. State why it is required and what it blocks. If none is required, say none.\n- Identify decision gates. For collective/civic decisions, state the decision, useful options, prerequisites, what later beat is blocked, and that the vote must occur in Anarchadia before the blocked beat proceeds. If no collective vote is required, say none.\n- Distinguish user-supplied facts from assumptions; do not invent missing facts.\n- State completion/evidence criteria.\n${kind==='learning'?'- Keep this at high-level learning-plan depth. Do not write full lessons, quizzes, readings, or teaching content yet.':'- Use Living School only for learning, Cerbanimo for skilled work, FellowFare for resources/exchange, and Anarchadia for governance/consent/voting when actually needed.'}`;
}
function compilerSystem(kind){
  return `You are Gemma 4 E4B working as Civweave's compiler. Convert a completed Weave Draft into exactly one valid JSON object matching TARGET_SCHEMA. Do not output markdown, prose, a tool call, or code fences. Preserve the substance of the draft rather than redesigning it. Fill required fields that are clearly implied; leave genuinely unknown details as assumptions rather than inventing user facts.\n\nIn addition to TARGET_SCHEMA fields, ALWAYS include these companion arrays at the top level (additional properties are allowed):\n- resourceManifest: resources from the draft, each as an object with a useful name/category plus why/when needed when known. Empty array only when the draft genuinely requires no additional resources.\n- specialistWork: specialist/licensed/regulated work, each as an object with role/work, why required, licensedOrRegulated when known, and blockingBeat when known.\n- decisionGates: decisions, each as an object with decision, why, options, prerequisites, blockingBeat, voteRequired.\n\n${kind==='quest'?'For every decisionGates item where voteRequired is true, the target Quest paths MUST also contain an Anarchadia path with type "civic-governance". Its steps must contain the mandatory vote as a blocking Quest beat before the dependent work proceeds. Preserve or create governance review material consistent with those gates.':'For a Learning Journey, keep modules at review-plan depth and do not compile lesson content.'}`;
}
function repairSystem(kind){
  return `You are Gemma 4 E4B repairing a Civweave JSON compile. Return ONLY one corrected JSON object. Keep all valid content from the prior compile and Weave Draft. Correct every listed validation error, preserve resourceManifest, specialistWork, and decisionGates, and do not add unsupported user facts. ${kind==='quest'?'Any voteRequired decision gate must also be represented as a mandatory blocking Anarchadia civic-governance Quest beat.':''}`;
}
function modelMessages(messages=[]){return(Array.isArray(messages)?messages:[]).filter(row=>clean(row?.role,20).toLowerCase()!=='system').map(row=>({role:/assistant/i.test(clean(row?.role,20))?'assistant':'user',content:clean(row?.content??row?.text,12000)})).filter(row=>row.content).slice(-6)}
async function runE4B({pipelineId,purpose,kind,phase,label,systemPrompt,messages,maxNewTokens}){
  const auth=authority();
  if(typeof auth?.requireDeepModel==='function')await auth.requireDeepModel();
  const run=typeof auth?.controlledFastRun==='function'?auth.controlledFastRun.bind(auth):null;
  const fast=globalThis.CivweaveLiteRTGemma4FastRuntimeV1;
  if(!run&&typeof fast?.runFast!=='function')throw Object.assign(new Error('Gemma 4 E4B LiteRT runtime is unavailable.'),{code:'CIVWEAVE_E4B_WEAVE_RUNTIME_UNAVAILABLE'});
  let streamed='';let index=0;
  dispatch({pipelineId,purpose,kind,phase,state:'running',label});
  const args={systemPrompt,messages,maxNewTokens,structuredTool:null,onToken:event=>{
    const token=clean(event?.text,4000);if(!token)return;streamed+=token;dispatch({pipelineId,purpose,kind,phase,state:'streaming',label,token,index:index++,streamLength:streamed.length});
  }};
  const result=run?await run(args,DEEP_MODEL,label,Number(auth?.taskTimeoutMs)||600000):await fast.runFast(args,DEEP_MODEL);
  const text=clean(result?.outputText||result?.text||streamed,48000);
  dispatch({pipelineId,purpose,kind,phase,state:'complete',label,text,streamLength:text.length});
  return text;
}
async function weaveTransport(purpose,{config={},messages=[],schema=null,signal,emit:runtimeEmit}={}){
  const kind=kindFor(purpose),pipelineId=uid(),startedAt=now();
  if(signal?.aborted)throw Object.assign(new Error('Generation stopped.'),{code:'CIVWEAVE_GENERATION_STOPPED',cancelled:true});
  dispatch({pipelineId,purpose,kind,phase:'pipeline',state:'start',label:'Weave pipeline'});
  saveArtifact({pipelineId,purpose,kind,state:'running',startedAt,draft:'',compiled:null,resourceManifest:[],specialistWork:[],decisionGates:[],validationErrors:[]});
  try{
    paint(`E4B is freely drafting the ${kind==='learning'?'Learning Journey':'Quest'}…`);
    try{runtimeEmit?.('connecting',{provider:'downloaded-local',model:DEEP_MODEL,mode:'weave-draft-pass'})}catch{}
    const draft=await runE4B({pipelineId,purpose,kind,phase:'draft',label:'E4B Weave Draft',systemPrompt:draftSystem(kind),messages:modelMessages(messages),maxNewTokens:DRAFT_TOKENS[kind]});
    if(!draft)throw Object.assign(new Error('E4B Weave Draft returned no planning content.'),{code:'CIVWEAVE_E4B_WEAVE_DRAFT_EMPTY'});
    saveArtifact({...lastArtifact,state:'drafted',draft});

    paint('E4B has the plan. Compiling it into Civweave JSON…');
    const compilePayload={kind,targetSchema:schema&&typeof schema==='object'?schema:{type:'object'},weaveDraft:clean(draft,kind==='learning'?10000:13000)};
    const compiledText=await runE4B({pipelineId,purpose,kind,phase:'compile',label:'E4B JSON Compile',systemPrompt:compilerSystem(kind),messages:[{role:'user',content:`Compile this payload:\n${JSON.stringify(compilePayload)}`}],maxNewTokens:COMPILE_TOKENS[kind]});
    let compiled=canonicalize(parseJsonLoose(compiledText),kind);

    paint('Validating the compiled Civweave structure…');
    let errors=validateCompiled(compiled,schema,kind);
    dispatch({pipelineId,purpose,kind,phase:'validate',state:errors.length?'needs-repair':'complete',label:'Deterministic validation',errors:[...errors],resourceCount:compiled?.resourceManifest?.length||0,specialistCount:compiled?.specialistWork?.length||0,decisionGateCount:compiled?.decisionGates?.length||0});

    if(errors.length){
      paint(`The compile needs ${errors.length} structural fix${errors.length===1?'':'es'}. E4B is repairing only those fields…`);
      const repairPayload={kind,targetSchema:schema&&typeof schema==='object'?schema:{type:'object'},validationErrors:errors,priorCompile:compiled||parseJsonLoose(compiledText)||compiledText,weaveDraft:clean(draft,9000)};
      const repairedText=await runE4B({pipelineId,purpose,kind,phase:'repair',label:'E4B Targeted Repair',systemPrompt:repairSystem(kind),messages:[{role:'user',content:`Repair this payload:\n${JSON.stringify(repairPayload)}`}],maxNewTokens:REPAIR_TOKENS[kind]});
      compiled=canonicalize(parseJsonLoose(repairedText),kind);
      errors=validateCompiled(compiled,schema,kind);
      dispatch({pipelineId,purpose,kind,phase:'validate',state:errors.length?'failed':'complete',label:'Deterministic re-validation',errors:[...errors],resourceCount:compiled?.resourceManifest?.length||0,specialistCount:compiled?.specialistWork?.length||0,decisionGateCount:compiled?.decisionGates?.length||0});
    }

    if(errors.length){
      saveArtifact({...lastArtifact,state:'failed',draft,compiled,resourceManifest:compiled?.resourceManifest||[],specialistWork:compiled?.specialistWork||[],decisionGates:compiled?.decisionGates||[],validationErrors:errors});
      throw Object.assign(new Error(`E4B compiled the Weave Draft, but ${errors.length} required structure ${errors.length===1?'issue remains':'issues remain'}: ${errors.slice(0,6).join(' ')}`),{code:'CIVWEAVE_E4B_WEAVE_COMPILE_INVALID',validationErrors:errors,pipelineId});
    }

    const resourceManifest=compiled.resourceManifest||[],specialistWork=compiled.specialistWork||[],decisionGates=compiled.decisionGates||[];
    const artifact=saveArtifact({...lastArtifact,state:'complete',completedAt:now(),draft,compiled,resourceManifest,specialistWork,decisionGates,validationErrors:[]});
    paint(`Weave compiled: ${resourceManifest.length} resource${resourceManifest.length===1?'':'s'} · ${specialistWork.length} specialist flag${specialistWork.length===1?'':'s'} · ${decisionGates.length} decision gate${decisionGates.length===1?'':'s'}…`);
    dispatch({pipelineId,purpose,kind,phase:'pipeline',state:'complete',label:'Saved',artifactKey:artifactKey(kind),resourceCount:resourceManifest.length,specialistCount:specialistWork.length,decisionGateCount:decisionGates.length});
    const text=JSON.stringify(compiled);
    return{text,payload:{text,weavePipeline:{pipelineId,artifactKey:artifactKey(kind)}},model:DEEP_MODEL,provider:'downloaded-local',streamed:true,diagnostics:[{kind:'e4b-weave-draft-two-pass',model:DEEP_MODEL,purpose,pipelineId,repairUsed:Boolean(lastArtifact?.validationErrors?.length)}]};
  }catch(error){
    dispatch({pipelineId,purpose,kind,phase:'pipeline',state:error?.code==='CIVWEAVE_GENERATION_STOPPED'?'stopped':'failed',label:'Pipeline stopped',code:error?.code||'CIVWEAVE_E4B_WEAVE_PIPELINE_FAILED',message:clean(error?.message||error,1800)});
    if(lastArtifact?.pipelineId===pipelineId&&lastArtifact.state!=='failed')saveArtifact({...lastArtifact,state:error?.code==='CIVWEAVE_GENERATION_STOPPED'?'stopped':'failed',error:{code:error?.code||'CIVWEAVE_E4B_WEAVE_PIPELINE_FAILED',message:clean(error?.message||error,1800)}});
    throw error;
  }
}
function deepConfig(config={},purpose=''){
  const kind=kindFor(purpose),current=Math.max(0,Number(config.maxTokens)||0);
  return{...config,provider:'downloaded-local',route:'downloaded-local',model:DEEP_MODEL,timeoutMs:600000,maxTokens:Math.max(current,kind==='learning'?1200:1800),stream:false};
}
async function prepareRequest(request={}){
  const purpose=clean(request.purpose,180);if(!targeted(request))return request;
  if(typeof authority()?.requireDeepModel==='function')await authority().requireDeepModel();
  return{...request,config:deepConfig(request.config||{},purpose),transport:args=>weaveTransport(purpose,args),maxRepairAttempts:0,__civweaveSkipResponseRouter:true,__civweaveWeaveDraftPipelineV1:true,__civweaveLocalStructuredPlan:true};
}
function installRuntime(){
  const runtime=globalThis.CivweaveModelRuntime,current=runtime?.generate;
  if(!runtime||typeof current!=='function')return false;
  if(current.__civweaveWeaveDraftPipelineV1===VERSION){runtimeTarget=runtime;return true}
  const structuredVersion=current.__civweaveStructuredTaskAuthorityV1||'';
  const base=structuredVersion&&typeof current.__prior==='function'?current.__prior:current;
  const prior=current;
  const generate=async request=>{
    if(targeted(request))return base.call(runtime,await prepareRequest(request||{}));
    return prior.call(runtime,request);
  };
  for(const key of Object.keys(current))try{generate[key]=current[key]}catch{}
  generate.__civweaveWeaveDraftPipelineV1=VERSION;
  generate.__civweaveStructuredTaskAuthorityV1=structuredVersion;
  generate.__prior=structuredVersion&&typeof current.__prior==='function'?current.__prior:current;
  generate.__weavePrior=prior;
  try{runtime.generate=generate;if(runtime.generate===generate){runtimeTarget=runtime;dispatch({phase:'install',state:'ready',label:'Weave Draft runtime authority'});return true}}catch{}
  try{globalThis.CivweaveModelRuntime={...runtime,generate};runtimeTarget=globalThis.CivweaveModelRuntime;return Boolean(runtimeTarget?.generate===generate)}catch{return false}
}
function install(){const ok=installRuntime();if(ok)dispatch({phase:'install',state:'ready',label:'Weave Draft → JSON compiler'});return ok}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;install()})}
for(const name of ['civweave:local-model-runtime-ready','civweave:assistant-runtime-ready','civweave:structured-task-authority-ready','civweave:gemma4-litert-first-request-ready','civweave:guide-loader-reset','pageshow'])addEventListener?.(name,schedule);
for(const delay of [0,80,300,900,2200,5000,10000])setTimeout(schedule,delay);

globalThis.CivweaveGemma4WeaveDraftPipelineV1=Object.freeze({
  version:VERSION,deepModel:DEEP_MODEL,learningPurpose:LEARNING_PURPOSE,questPurpose:QUEST_PURPOSE,
  targeted,kindFor,firstBalancedJson,parseJsonLoose,companions,canonicalize,validateSchema,validateCompiled,draftSystem,compilerSystem,repairSystem,weaveTransport,prepareRequest,installRuntime,install,schedule,readArtifact,lastArtifact:()=>lastArtifact,
  architecture:'E2B intake -> E4B free Weave Draft -> E4B JSON compile -> deterministic validation -> one E4B targeted repair if needed',
  constrainedToolRequired:false,
  privateChainOfThoughtExposed:false,
  resourceManifestRequired:true,
  specialistWorkRequired:true,
  anarchadiaVotingGatesMandatory:true
});
schedule();
})();