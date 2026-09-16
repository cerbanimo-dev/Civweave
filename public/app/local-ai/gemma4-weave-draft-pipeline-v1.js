(()=>{
'use strict';

const VERSION='1.1.0-gemma4-weave-draft-pipeline-v1-e2b-draft-e4b-compiler';
const DRAFT_MODEL='gemma4-e2b-it-litert-web';
const DEEP_MODEL='gemma4-e4b-it-litert-web';
const LEARNING_PURPOSE='living-school-learning-plan-review-v2';
const ARTIFACT_PREFIX='civweave.weave-draft-pipeline.v1';
const DRAFT_TOKENS=1500;
const COMPILE_TOKENS=1500;
const REPAIR_TOKENS=1200;
const TIMEOUT_MS=600000;
let lastArtifact=null;

const clean=(value,max=48000)=>String(value??'').trim().slice(0,max);
const isObject=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
const now=()=>new Date().toISOString();
const uid=()=>`weave-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const authority=()=>globalThis.CivweaveGemma4StructuredTaskAuthorityV1||null;

function dispatch(detail={}){
  const payload={version:VERSION,at:now(),draftModel:DRAFT_MODEL,compilerModel:DEEP_MODEL,...detail};
  try{globalThis.dispatchEvent?.(new CustomEvent('civweave:weave-pipeline',{detail:payload}))}catch{}
  return payload;
}
function paint(text){try{authority()?.paintPending?.(text)}catch{}}
function artifactKey(){return `${ARTIFACT_PREFIX}.learning`}
function saveArtifact(value={}){
  lastArtifact={schema:'civweave.weave-draft-pipeline-artifact.v1',version:VERSION,kind:'learning',...value,updatedAt:now()};
  try{localStorage.setItem(artifactKey(),JSON.stringify(lastArtifact));localStorage.setItem(`${ARTIFACT_PREFIX}.latest`,JSON.stringify(lastArtifact))}catch{}
  return lastArtifact;
}
function readArtifact(){try{return JSON.parse(localStorage.getItem(`${ARTIFACT_PREFIX}.latest`)||'null')}catch{return null}}
function stripThink(text){return clean(text).replace(/<(?:think|analysis|reasoning)>[\s\S]*?<\/(?:think|analysis|reasoning)>/gi,'').replace(/<(?:think|analysis|reasoning)>[\s\S]*$/gi,'').trim().replace(/^```(?:json|javascript|js)?\s*/i,'').replace(/\s*```$/,'').trim()}
function firstBalancedJson(text){
  const source=stripThink(text);
  for(let start=0;start<source.length;start+=1){
    const opener=source[start];if(opener!=='{'&&opener!=='[')continue;
    const closer=opener==='{'?'}':']';let depth=0,quoted=false,escaped=false;
    for(let i=start;i<source.length;i+=1){
      const char=source[i];
      if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue}
      if(char==='"'){quoted=true;continue}
      if(char===opener)depth+=1;
      else if(char===closer){depth-=1;if(depth===0)return source.slice(start,i+1)}
    }
  }
  return source;
}
function parseJsonLoose(text){try{return JSON.parse(firstBalancedJson(text))}catch{return null}}
function strings(value,maxItems=20,maxLength=1200){return Array.isArray(value)?value.map(item=>clean(item,maxLength)).filter(Boolean).slice(0,maxItems):[]}
function objectArray(value,maxItems=24){
  if(Array.isArray(value))return value.filter(Boolean).map(item=>isObject(item)?clone(item):{item:clean(item,900)}).slice(0,maxItems);
  if(isObject(value))return Object.entries(value).map(([name,item])=>isObject(item)?{name,...clone(item)}:{name,item:clean(item,900)}).slice(0,maxItems);
  return [];
}
function canonicalModule(item){
  if(!isObject(item))return null;
  const title=clean(item.title||item.name,220),focus=clean(item.focus||item.purpose||item.goal||item.objective,1200),outcome=clean(item.outcome||item.demonstrableOutcome||item.result||item.evidence,1200);
  return title&&focus&&outcome?{...item,title,focus,outcome}:null;
}
function canonicalize(raw){
  if(!isObject(raw))return raw;
  const level=clean(raw.level,80).toLowerCase(),mode=clean(raw.mode,80).toLowerCase();
  const modules=(Array.isArray(raw.modules)?raw.modules:Array.isArray(raw.milestones)?raw.milestones:Array.isArray(raw.stages)?raw.stages:[]).map(canonicalModule).filter(Boolean).slice(0,8);
  return{
    ...raw,
    title:clean(raw.title||raw.name,240),
    capability:clean(raw.capability||raw.goal||raw.objective,2400),
    level,
    ...(mode?{mode}:{}),
    proof:clean(raw.proof||raw.completionEvidence||raw.demonstration||raw.evidence,3000),
    modules,
    assumptions:strings(raw.assumptions,8,800),
    resourceManifest:objectArray(raw.resourceManifest??raw.resources??raw.resourceList??raw.materials,24),
    specialistWork:objectArray(raw.specialistWork??raw.specialists??raw.licensedWork??raw.regulatedWork,16),
    decisionGates:objectArray(raw.decisionGates??raw.governanceGates??raw.votes??raw.decisionPoints,16)
  };
}
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
  }else if(type==='string'){
    if(typeof value!=='string')errors.push(`${path} must be a string.`);
    else if(Number.isFinite(Number(schema.minLength))&&value.length<Number(schema.minLength))errors.push(`${path} must contain at least ${schema.minLength} characters.`);
  }else if(type==='number'&&(typeof value!=='number'||!Number.isFinite(value)))errors.push(`${path} must be a number.`);
  else if(type==='integer'&&!Number.isInteger(value))errors.push(`${path} must be an integer.`);
  else if(type==='boolean'&&typeof value!=='boolean')errors.push(`${path} must be a boolean.`);
  return errors;
}
function validateCompiled(value,schema){
  const errors=validateSchema(value,schema);
  if(!isObject(value))return errors;
  if(!Array.isArray(value.resourceManifest))errors.push('$.resourceManifest must be an array.');
  if(!Array.isArray(value.specialistWork))errors.push('$.specialistWork must be an array.');
  if(!Array.isArray(value.decisionGates))errors.push('$.decisionGates must be an array.');
  return errors.slice(0,30);
}
function modelMessages(messages=[]){return(Array.isArray(messages)?messages:[]).filter(row=>clean(row?.role,20).toLowerCase()!=='system').map(row=>({role:/assistant/i.test(clean(row?.role,20))?'assistant':'user',content:clean(row?.content??row?.text,12000)})).filter(row=>row.content).slice(-8)}
function draftSystem(){return `You are Gemma 4 E2B producing the working draft for a Civweave Learning Journey. Produce a useful high-level plan in clear prose. This is a shareable planning artifact, not JSON, not a tool call, and not private chain-of-thought. Do not try to satisfy a JSON schema.\n\nInclude: a concise title; the observable capability; suggested level and mode; 3-8 modules with a focus and demonstrable outcome; completion proof; useful assumptions; relevant resources; any specialist or regulated work; and any decision gates. Do not write full lessons yet. Do not invent user facts.`}
function compilerSystem(){return `You are Gemma 4 E4B acting only as Civweave's JSON compiler. Convert the supplied E2B working draft into exactly one valid JSON object matching TARGET_SCHEMA. Return JSON only: no markdown, prose, code fences, or private reasoning. Preserve the draft's substance instead of redesigning the plan. Fill required fields only when supported by the draft; represent genuinely unknown details as assumptions. Always include top-level resourceManifest, specialistWork, and decisionGates arrays, using [] when none are needed.`}
function repairSystem(){return `You are Gemma 4 E4B repairing a Civweave Learning Journey JSON compile. Return only one corrected JSON object. Preserve all valid content from the prior compile and E2B working draft. Correct every listed validation error and do not invent user facts.`}
async function requireModel(model){
  const auth=authority();
  if(model===DRAFT_MODEL&&typeof auth?.requireIntakeModel==='function')return auth.requireIntakeModel();
  if(model===DEEP_MODEL&&typeof auth?.requireDeepModel==='function')return auth.requireDeepModel();
  return model;
}
async function runModel({pipelineId,phase,label,model,systemPrompt,messages,maxNewTokens}){
  await requireModel(model);
  const auth=authority(),run=typeof auth?.controlledFastRun==='function'?auth.controlledFastRun.bind(auth):null,fast=globalThis.CivweaveLiteRTGemma4FastRuntimeV1;
  if(!run&&typeof fast?.runFast!=='function')throw Object.assign(new Error(`Gemma 4 local runtime is unavailable for ${label}.`),{code:'CIVWEAVE_WEAVE_RUNTIME_UNAVAILABLE',model});
  let streamed='',index=0;
  dispatch({pipelineId,purpose:LEARNING_PURPOSE,kind:'learning',phase,state:'running',label,model});
  const args={systemPrompt,messages,maxNewTokens,structuredTool:null,onToken:event=>{
    const token=clean(event?.text,4000);if(!token)return;streamed+=token;dispatch({pipelineId,purpose:LEARNING_PURPOSE,kind:'learning',phase,state:'streaming',label,model,token,index:index++,streamLength:streamed.length});
  }};
  const result=run?await run(args,model,label,Number(auth?.taskTimeoutMs)||TIMEOUT_MS):await fast.runFast(args,model);
  const text=clean(result?.outputText||result?.text||streamed,48000);
  dispatch({pipelineId,purpose:LEARNING_PURPOSE,kind:'learning',phase,state:'complete',label,model,text,streamLength:text.length});
  return text;
}
async function weaveTransport(purpose,{messages=[],schema=null,signal,emit:runtimeEmit}={}){
  if(purpose!==LEARNING_PURPOSE)throw Object.assign(new Error(`The Learning Journey pass-off pipeline does not own purpose '${clean(purpose,180)}'.`),{code:'CIVWEAVE_WEAVE_PURPOSE_NOT_OWNED'});
  const pipelineId=uid(),startedAt=now();
  if(signal?.aborted)throw Object.assign(new Error('Generation stopped.'),{code:'CIVWEAVE_GENERATION_STOPPED',cancelled:true});
  dispatch({pipelineId,purpose,kind:'learning',phase:'pipeline',state:'start',label:'E2B → E4B Learning Journey pass-off'});
  saveArtifact({pipelineId,purpose,state:'running',startedAt,draft:'',compiled:null,resourceManifest:[],specialistWork:[],decisionGates:[],validationErrors:[]});
  try{
    paint('E2B is drafting the Learning Journey…');
    try{runtimeEmit?.('connecting',{provider:'downloaded-local',model:DRAFT_MODEL,mode:'weave-draft-pass'})}catch{}
    const draft=await runModel({pipelineId,phase:'draft',label:'E2B Working Draft',model:DRAFT_MODEL,systemPrompt:draftSystem(),messages:modelMessages(messages),maxNewTokens:DRAFT_TOKENS});
    if(!draft)throw Object.assign(new Error('E2B returned no Learning Journey working draft.'),{code:'CIVWEAVE_E2B_WEAVE_DRAFT_EMPTY'});
    saveArtifact({...lastArtifact,state:'drafted',draft});

    paint('E2B draft complete. Passing it to E4B for JSON compilation…');
    try{runtimeEmit?.('connecting',{provider:'downloaded-local',model:DEEP_MODEL,mode:'weave-compile-pass'})}catch{}
    const compilePayload={targetSchema:isObject(schema)?schema:{type:'object'},workingDraft:clean(draft,14000)};
    const compiledText=await runModel({pipelineId,phase:'compile',label:'E4B JSON Compile',model:DEEP_MODEL,systemPrompt:compilerSystem(),messages:[{role:'user',content:`TARGET_SCHEMA and E2B working draft:\n${JSON.stringify(compilePayload)}`}],maxNewTokens:COMPILE_TOKENS});
    let compiled=canonicalize(parseJsonLoose(compiledText));
    let errors=validateCompiled(compiled,schema);
    dispatch({pipelineId,purpose,kind:'learning',phase:'validate',state:errors.length?'needs-repair':'complete',label:'Deterministic schema check',errors:[...errors],resourceCount:compiled?.resourceManifest?.length||0,specialistCount:compiled?.specialistWork?.length||0,decisionGateCount:compiled?.decisionGates?.length||0});

    if(errors.length){
      paint(`E4B compile needs ${errors.length} structural fix${errors.length===1?'':'es'}. Repairing only those fields…`);
      const repairPayload={targetSchema:isObject(schema)?schema:{type:'object'},validationErrors:errors,priorCompile:compiled||parseJsonLoose(compiledText)||compiledText,workingDraft:clean(draft,12000)};
      const repairedText=await runModel({pipelineId,phase:'repair',label:'E4B Targeted Repair',model:DEEP_MODEL,systemPrompt:repairSystem(),messages:[{role:'user',content:`Repair this compile:\n${JSON.stringify(repairPayload)}`}],maxNewTokens:REPAIR_TOKENS});
      compiled=canonicalize(parseJsonLoose(repairedText));
      errors=validateCompiled(compiled,schema);
      dispatch({pipelineId,purpose,kind:'learning',phase:'validate',state:errors.length?'failed':'complete',label:'Deterministic re-check',errors:[...errors],resourceCount:compiled?.resourceManifest?.length||0,specialistCount:compiled?.specialistWork?.length||0,decisionGateCount:compiled?.decisionGates?.length||0});
    }
    if(errors.length){
      saveArtifact({...lastArtifact,state:'failed',draft,compiled,validationErrors:errors});
      throw Object.assign(new Error(`E4B compiled the E2B draft, but ${errors.length} required structure ${errors.length===1?'issue remains':'issues remain'}: ${errors.slice(0,6).join(' ')}`),{code:'CIVWEAVE_E4B_WEAVE_COMPILE_INVALID',validationErrors:errors,pipelineId,rejectedText:JSON.stringify(compiled||{})});
    }

    const resourceManifest=compiled.resourceManifest||[],specialistWork=compiled.specialistWork||[],decisionGates=compiled.decisionGates||[];
    saveArtifact({...lastArtifact,state:'complete',completedAt:now(),draft,compiled,resourceManifest,specialistWork,decisionGates,validationErrors:[]});
    paint(`Learning Journey compiled: ${resourceManifest.length} resources · ${specialistWork.length} specialist flags · ${decisionGates.length} decision gates.`);
    dispatch({pipelineId,purpose,kind:'learning',phase:'pipeline',state:'complete',label:'Saved',resourceCount:resourceManifest.length,specialistCount:specialistWork.length,decisionGateCount:decisionGates.length});
    const text=JSON.stringify(compiled);
    return{text,payload:{text,weavePipeline:{pipelineId,artifactKey:artifactKey(),draftModel:DRAFT_MODEL,compilerModel:DEEP_MODEL}},model:DEEP_MODEL,provider:'downloaded-local',streamed:true,diagnostics:[{kind:'e2b-draft-e4b-compile',draftModel:DRAFT_MODEL,compilerModel:DEEP_MODEL,purpose,pipelineId}]};
  }catch(error){
    dispatch({pipelineId,purpose,kind:'learning',phase:'pipeline',state:error?.code==='CIVWEAVE_GENERATION_STOPPED'?'stopped':'failed',label:'Pipeline stopped',code:error?.code||'CIVWEAVE_WEAVE_PIPELINE_FAILED',message:clean(error?.message||error,1800)});
    if(lastArtifact?.pipelineId===pipelineId&&lastArtifact.state!=='failed')saveArtifact({...lastArtifact,state:error?.code==='CIVWEAVE_GENERATION_STOPPED'?'stopped':'failed',error:{code:error?.code||'CIVWEAVE_WEAVE_PIPELINE_FAILED',message:clean(error?.message||error,1800)}});
    throw error;
  }
}
function targeted(request={}){return clean(request.purpose,180)===LEARNING_PURPOSE}
function kindFor(){return 'learning'}
function prepareRequest(request={}){return Promise.resolve({...request,transport:args=>weaveTransport(LEARNING_PURPOSE,args),__civweaveWeaveDraftPipelineV1:true})}
function installRuntime(){return true}
function install(){dispatch({purpose:LEARNING_PURPOSE,kind:'learning',phase:'install',state:'ready',label:'E2B draft → E4B compiler'});return true}
function schedule(){queueMicrotask(install)}

globalThis.CivweaveGemma4WeaveDraftPipelineV1=Object.freeze({
  version:VERSION,draftModel:DRAFT_MODEL,deepModel:DEEP_MODEL,learningPurpose:LEARNING_PURPOSE,
  targeted,kindFor,firstBalancedJson,parseJsonLoose,canonicalize,validateSchema,validateCompiled,draftSystem,compilerSystem,repairSystem,weaveTransport,prepareRequest,installRuntime,install,schedule,readArtifact,lastArtifact:()=>lastArtifact,
  architecture:'E2B free working draft -> E4B JSON compile -> deterministic validation -> one E4B targeted repair if needed',
  constrainedToolRequired:false,privateChainOfThoughtExposed:false,resourceManifestRequired:true,specialistWorkRequired:true
});
install();
})();
