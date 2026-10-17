(()=>{
'use strict';

const VERSION='1.3.5-weave-draft-pipeline-v1-context-packed';
const modelFor=(config={})=>globalThis.CivweaveLocalGenerationModelPolicyV1?.resolve?.('deep',{config})||globalThis.CivweaveGemma4LiteRTRequestAuthorityV1?.deepRoleModel?.()||config?.model||globalThis.CivweaveLocalModelDownloadV266?.selection?.()?.id||'';
const modelName=id=>globalThis.CivweaveLocalGenerationModelPolicyV1?.display?.(id)||id||'Local model';
const LEARNING_PURPOSE='living-school-learning-plan-review-v2';
const QUEST_PURPOSE='civweave-weaveling-intention-json-v190';
const PURPOSES=new Set([LEARNING_PURPOSE,QUEST_PURPOSE]);
const LOCAL_PROVIDERS=new Set(['downloaded-local','generative-local','local-ai','browser','smollm2','smollm3','qwen']);
const ARTIFACT_PREFIX='civweave.weave-draft-pipeline.v1';
const DRAFT_TOKENS=Object.freeze({learning:700,quest:1150});
const COMPILE_TOKENS=Object.freeze({learning:900,quest:1300});
const REPAIR_TOKENS=Object.freeze({learning:800,quest:1150});
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
  const payload={version:VERSION,at:now(),model:modelFor(),...detail};
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
  if(kind==='learning')return 'You are Moss, drafting a high-level Learning Journey for REVIEW only. Write a concise shareable plan, NOT JSON and NOT hidden reasoning. Include the topic, an observable learning goal, 3–5 short ordered modules (title, focus, demonstrable outcome), a final mastery demonstration, and any assumptions. Mention only necessary materials (such as a tarot deck); do not invent specialist or civic governance requirements. Do not write full lessons or quiz questions. Keep the draft under 250 words.';
  const subject=kind==='learning'?'high-level Learning Journey':'reviewable Quest';
  return `You are the local planning model working in Civweave Weave Draft mode. Create the strongest useful ${subject} you can from the supplied request and context. This is a planning artifact, not JSON, not a tool call, and not private chain-of-thought. Give conclusions, structure, dependencies, and useful planning detail without narrating hidden reasoning.\n\nYou may organize the draft however you think is clearest. Content requirements:\n- State the intended outcome or observable capability.\n- Lay out the stages/modules/Quest beats and important dependencies.\n- Include a complete resource manifest: information, references, tools, materials, software, places, people, services, money/access, or other resources genuinely needed. If a category is unnecessary, say so rather than inventing a need.\n- Identify any specialist, licensed, regulated, certified, or otherwise professionally restricted work. State why it is required and what it blocks. If none is required, say none.\n- Identify decision gates. For collective/civic decisions, state the decision, useful options, prerequisites, what later beat is blocked, and that the vote must occur in Anarchadia before the blocked beat proceeds. If no collective vote is required, say none.\n- Distinguish user-supplied facts from assumptions; do not invent missing facts.\n- State completion/evidence criteria.\n${kind==='learning'?'- Keep this at high-level learning-plan depth. Do not write full lessons, quizzes, readings, or teaching content yet.':'- Use Living School only for learning, Cerbanimo for skilled work, FellowFare for resources/exchange, and Anarchadia for governance/consent/voting when actually needed.'}`;
}
function compilerSystem(kind){
  if(kind==='learning')return 'You are Moss converting a short Learning Journey draft to ONE valid JSON object matching TARGET_SCHEMA. Include title, capability, level, mode, proof, assumptions, and 3–5 modules with title, focus, outcome. Also include resourceManifest, specialistWork, decisionGates as arrays; use empty arrays for genuinely unnecessary special requirements. No markdown, prose, private reasoning, lessons, or invented learner facts.';
  return `You are the local planning model working as Civweave's compiler. Convert a completed Weave Draft into exactly one valid JSON object matching TARGET_SCHEMA. Do not output markdown, prose, a tool call, or code fences. Preserve the substance of the draft rather than redesigning it. Fill required fields that are clearly implied; leave genuinely unknown details as assumptions rather than inventing user facts.\n\nIn addition to TARGET_SCHEMA fields, ALWAYS include these companion arrays at the top level (additional properties are allowed):\n- resourceManifest: resources from the draft, each as an object with a useful name/category plus why/when needed when known. Empty array only when the draft genuinely requires no additional resources.\n- specialistWork: specialist/licensed/regulated work, each as an object with role/work, why required, licensedOrRegulated when known, and blockingBeat when known.\n- decisionGates: decisions, each as an object with decision, why, options, prerequisites, blockingBeat, voteRequired.\n\n${kind==='quest'?'For every decisionGates item where voteRequired is true, the target Quest paths MUST also contain an Anarchadia path with type "civic-governance". Its steps must contain the mandatory vote as a blocking Quest beat before the dependent work proceeds. Preserve or create governance review material consistent with those gates.':'For a Learning Journey, keep modules at review-plan depth and do not compile lesson content.'}`;
}
function repairSystem(kind){
  return `You are the local planning model repairing a Civweave JSON compile. Return ONLY one corrected JSON object. Keep all valid content from the prior compile and Weave Draft. Correct every listed validation error, preserve resourceManifest, specialistWork, and decisionGates, and do not add unsupported user facts. ${kind==='quest'?'Any voteRequired decision gate must also be represented as a mandatory blocking Anarchadia civic-governance Quest beat.':''}`;
}
function modelMessages(messages=[]){return(Array.isArray(messages)?messages:[]).filter(row=>clean(row?.role,20).toLowerCase()!=='system').map(row=>({role:/assistant/i.test(clean(row?.role,20))?'assistant':'user',content:clean(row?.content??row?.text,12000)})).filter(row=>row.content).slice(-6)}

function stageInputBudget(systemPrompt,maxNewTokens){
  // Match the LiteRT admission formula with an additional 96-char margin.
  const id=modelFor(),profiles=globalThis.CivweaveLiteRTGemma4FastRuntimeV1?.profiles||{};
  const fallback=/gemma4-e4b/i.test(id)?{contextTokens:2048,maxOutputTokens:2800}:null;
  const profile=profiles[id]||fallback;
  if(!profile?.contextTokens)return Infinity;
  const output=Math.max(64,Math.min(Number(profile.maxOutputTokens)||2800,Number(maxNewTokens)||1024));
  const available=Math.max(1500,Math.min(5000,Math.floor((profile.contextTokens-output-128)*2.5)));
  const system=clean(systemPrompt,Math.min(1700,Math.floor(available*.35)));
  return Math.max(0,available-system.length-192);
}
function focusedLearningDraftMessage(messages,budget=Infinity){
  const latest=modelMessages(messages).at(-1)?.content||'';
  const start=latest.indexOf('{');
  if(start<0||!/Learning Journey plan/i.test(latest.slice(0,start)))return latest;
  let context=null;try{context=JSON.parse(latest.slice(start))}catch{return latest}
  if(context?.schema!=='civweave.learning-journey-plan-request.v2'||!isObject(context.request))return latest;
  // Routing constraints are already in draftSystem(). Recent chat and empty
  // wrapper fields should not displace the actual learner's request.
  const req=context.request;
  const core={sourceText:clean(req.sourceText,4000),title:clean(req.title,240),capability:clean(req.capability,2400),level:clean(req.level,40),mode:clean(req.mode,40),moduleCount:req.count||4};
  const extended={...core,proof:clean(req.proof,900),revision:clean(context.revision,1300),existingPlan:context.existingPlan?{title:clean(context.existingPlan.title,240),capability:clean(context.existingPlan.capability,600),modules:(context.existingPlan.modules||[]).map(item=>({title:clean(item.title,90),outcome:clean(item.outcome,150)})).slice(0,8)}:undefined};
  for(const item of [extended,{...core,revision:clean(context.revision,1300)},core,{sourceText:core.sourceText,capability:core.capability,moduleCount:core.moduleCount},{sourceText:core.sourceText}]){
    const candidate=JSON.stringify({learningRequest:item});
    if(candidate.length<=budget)return candidate;
  }
  throw Object.assign(new Error('The learner request exceeds the selected model context even after removing redundant routing metadata. Shorten the request or choose a model with more context.'),{code:'LOCAL_PROMPT_CONTEXT_OVERFLOW',inputCharacters:core.sourceText.length,maxInputCharacters:budget});
}
function minimumDeviceSchema(kind,schema){
  const required=Array.isArray(schema?.required)?schema.required:[];
  if(kind==='learning')return{type:'object',required,properties:{title:{type:'string'},capability:{type:'string'},level:{enum:['beginner','intermediate','advanced']},mode:{type:'string'},proof:{type:'string'},assumptions:{type:'array'},modules:{type:'array',minItems:3,items:{type:'object',required:['title','focus','outcome'],properties:{title:{type:'string'},focus:{type:'string'},outcome:{type:'string'}}}}}};
  return{type:'object',required,properties:{title:{type:'string'},wish:{type:'string'},outcome:{type:'string'},assumptions:{type:'array'},paths:{type:'array',items:{type:'object',required:['type','realm','title','purpose','steps','completionCriteria','evidence']}}}};
}
function contextFitError(kind,phase,budget){
  return Object.assign(new Error('The '+kind+' '+phase+' payload cannot fit the selected model input budget ('+budget+' characters). Choose a larger-context model or reduce the supplied material.'),{code:'LOCAL_PROMPT_CONTEXT_OVERFLOW',stage:phase,maxInputCharacters:budget});
}

async function runLocal({pipelineId,purpose,kind,phase,label,systemPrompt,messages,maxNewTokens}){
  const auth=authority();
  if(typeof auth?.requireDeepModel==='function')await auth.requireDeepModel();
  const run=typeof auth?.controlledFastRun==='function'?auth.controlledFastRun.bind(auth):null;
  const fast=globalThis.CivweaveLiteRTGemma4FastRuntimeV1;
  if(!run&&typeof fast?.runFast!=='function')throw Object.assign(new Error('The configured local planning runtime is unavailable.'),{code:'CIVWEAVE_E4B_WEAVE_RUNTIME_UNAVAILABLE'});
  const promptBudget=stageInputBudget(systemPrompt,maxNewTokens);
  if((messages.at(-1)?.content||'').length>promptBudget)throw contextFitError(kind,phase,promptBudget);
  let streamed='',index=0;
  dispatch({pipelineId,purpose,kind,phase,state:'running',label,model:modelFor(),promptBudget,promptCharacters:messages.reduce((n,row)=>n+String(row?.content||'').length,0)+systemPrompt.length});
  const args={__civweaveStage:label,systemPrompt,messages,maxNewTokens,structuredTool:null,onToken:event=>{
    const token=String(event?.text??'');if(!token)return;
    streamed=(streamed+token).slice(-48000);
    dispatch({pipelineId,purpose,kind,phase,state:'streaming',label,token,index:index++,streamLength:streamed.length});
  }};
  try{
    const result=run?await run(args,modelFor(),label,Number(auth?.taskTimeoutMs)||600000):await fast.runFast(args,modelFor());
    const output=String(result?.outputText??result?.text??streamed).slice(0,48000);
    const text=clean(output,48000);
    const prior=lastArtifact?.rawStages||{};
    saveArtifact({...lastArtifact,rawStages:{...prior,[phase]:output},lastExecutedModel:modelFor()});
    dispatch({pipelineId,purpose,kind,phase,state:'complete',label,text:output,streamLength:output.length,deltaCount:index});
    return text;
  }catch(error){
    // Preserve the exact partial stream even if the model aborts or emits
    // nothing. The user can inspect this without a subsequent successful plan.
    const output=String(error?.rejectedText??streamed).slice(0,48000);
    const prior=lastArtifact?.rawStages||{};
    saveArtifact({...lastArtifact,rawStages:{...prior,[phase]:output},lastExecutedModel:modelFor(),failedStage:phase,rawDiagnostics:error?.rawDiagnostics||null});
    dispatch({pipelineId,purpose,kind,phase,state:'failed',label,text:output,streamLength:output.length,deltaCount:index,code:error?.code||'Local_STAGE_FAILED',message:clean(error?.message||error,1200),rawDiagnostics:error?.rawDiagnostics||null});
    throw error;
  }
}
function compactSchema(value,depth=0){
  // A schema can exceed the entire local KV-cache before the model writes
  // a token. Retain enforceable shape, not redundant prose descriptions.
  if(!value||typeof value!=='object'||depth>5)return value;
  const keep=['type','required','enum','const','minItems','maxItems','additionalProperties','pattern'];
  const obj={};for(const key of keep)if(value[key]!==undefined)obj[key]=value[key];
  if(value.items)obj.items=compactSchema(value.items,depth+1);
  if(value.properties&&typeof value.properties==='object'){
    obj.properties={};for(const [name,spec] of Object.entries(value.properties))obj.properties[name]=compactSchema(spec,depth+1);
  }
  return obj;
}

function compactLearningPayload(schema,draft,budget=4100){
  const target=Math.min(4100,budget);
  for(const shape of [compactSchema(schema&&typeof schema==='object'?schema:{type:'object'}),minimumDeviceSchema('learning',schema)]){
    for(const cap of [1900,1500,1150,900,650,430,260]){
      const candidate={kind:'learning',targetSchema:shape,weaveDraft:clean(draft,cap)};
      if(JSON.stringify(candidate).length<=target)return candidate;
    }
  }
  throw contextFitError('learning','compile',target);
}
function compactQuestPayload(schema,draft,budget=2300){
  const target=Math.min(2300,budget),shape=compactSchema(schema&&typeof schema==='object'?schema:{type:'object'});
  const cut=cap=>{
    const txt=String(draft||'');
    return txt.length<=cap?txt:txt.slice(0,Math.floor(cap*.65))+'\n[...details omitted for device context...]\n'+txt.slice(-Math.floor(cap*.35));
  };
  for(const schemaShape of [shape,minimumDeviceSchema('quest',schema)]){
    for(const cap of [1500,1100,800,500,300,140]){
      const candidate={kind:'quest',targetSchema:schemaShape,weaveDraft:cut(cap)};
      if(JSON.stringify(candidate).length<=target)return candidate;
    }
  }
  throw contextFitError('quest','compile',target);
}
function repairPromptPayload(kind,schema,draft,errors,priorCompile,budget=2600){
  const target=Math.min(kind==='learning'?4300:2600,budget);
  const prior=typeof priorCompile==='string'?priorCompile:JSON.stringify(priorCompile??{});
  const shapes=[compactSchema(schema&&typeof schema==='object'?schema:{type:'object'}),minimumDeviceSchema(kind,schema),{type:'object',required:Array.isArray(schema?.required)?schema.required:[]}];
  for(const shape of shapes){
    for(const priorCap of [1800,1300,850,450,160,0]){
      for(const draftCap of [850,500,240,90,0]){
        const candidate={kind,targetSchema:shape,validationErrors:errors.slice(0,8),priorCompile:prior.slice(0,priorCap),weaveDraft:clean(draft,draftCap)};
        if(JSON.stringify(candidate).length<=target)return candidate;
      }
    }
  }
  throw contextFitError(kind,'repair',target);
}
async function weaveTransport(purpose,{config={},messages=[],schema=null,signal,emit:runtimeEmit}={}){
  const kind=kindFor(purpose),pipelineId=uid(),startedAt=now();
  if(signal?.aborted)throw Object.assign(new Error('Generation stopped.'),{code:'CIVWEAVE_GENERATION_STOPPED',cancelled:true});
  dispatch({pipelineId,purpose,kind,phase:'pipeline',state:'start',label:'Weave pipeline'});
  saveArtifact({pipelineId,purpose,kind,state:'running',startedAt,draft:'',compiled:null,resourceManifest:[],specialistWork:[],decisionGates:[],validationErrors:[],rawStages:{},lastExecutedModel:modelFor()});
  try{
    paint(`The local planning model is freely drafting the ${kind==='learning'?'Learning Journey':'Quest'}…`);
    try{runtimeEmit?.('connecting',{provider:'downloaded-local',model:modelFor(),mode:'weave-draft-pass'})}catch{}
    const draftMessages=kind==='learning'?[{role:'user',content:focusedLearningDraftMessage(messages,stageInputBudget(draftSystem(kind),DRAFT_TOKENS[kind]))}]:modelMessages(messages);
    const draft=await runLocal({pipelineId,purpose,kind,phase:'draft',label:'Local Weave Draft',systemPrompt:draftSystem(kind),messages:draftMessages,maxNewTokens:DRAFT_TOKENS[kind]});
    if(!draft)throw Object.assign(new Error('Local Weave Draft returned no planning content.'),{code:'CIVWEAVE_E4B_WEAVE_DRAFT_EMPTY'});
    saveArtifact({...lastArtifact,state:'drafted',draft});

    paint('The planning draft is ready. Compiling it into Civweave JSON…');
    const compileBudget=stageInputBudget(compilerSystem(kind),COMPILE_TOKENS[kind])-'Compile this payload:\n'.length;
    const compilePayload=kind==='learning'?compactLearningPayload(schema,draft,compileBudget):compactQuestPayload(schema,draft,compileBudget);
    const compiledText=await runLocal({pipelineId,purpose,kind,phase:'compile',label:'Local JSON Compile',systemPrompt:compilerSystem(kind),messages:[{role:'user',content:`Compile this payload:\n${JSON.stringify(compilePayload)}`}],maxNewTokens:COMPILE_TOKENS[kind]});
    let compiled=canonicalize(parseJsonLoose(compiledText),kind);

    paint('Validating the compiled Civweave structure…');
    let errors=validateCompiled(compiled,schema,kind);
    dispatch({pipelineId,purpose,kind,phase:'validate',state:errors.length?'needs-repair':'complete',label:'Deterministic validation',errors:[...errors],resourceCount:compiled?.resourceManifest?.length||0,specialistCount:compiled?.specialistWork?.length||0,decisionGateCount:compiled?.decisionGates?.length||0});

    if(errors.length){
      paint(`The compile needs ${errors.length} structural fix${errors.length===1?'':'es'}. The planning model is repairing those fields…`);
      const repairBudget=stageInputBudget(repairSystem(kind),REPAIR_TOKENS[kind])-'Repair this payload:\n'.length;
      const repairPayload=repairPromptPayload(kind,schema,draft,errors,compiled||parseJsonLoose(compiledText)||compiledText,repairBudget);
      const repairedText=await runLocal({pipelineId,purpose,kind,phase:'repair',label:'Local Targeted Repair',systemPrompt:repairSystem(kind),messages:[{role:'user',content:`Repair this payload:\n${JSON.stringify(repairPayload)}`}],maxNewTokens:REPAIR_TOKENS[kind]});
      compiled=canonicalize(parseJsonLoose(repairedText),kind);
      errors=validateCompiled(compiled,schema,kind);
      dispatch({pipelineId,purpose,kind,phase:'validate',state:errors.length?'failed':'complete',label:'Deterministic re-validation',errors:[...errors],resourceCount:compiled?.resourceManifest?.length||0,specialistCount:compiled?.specialistWork?.length||0,decisionGateCount:compiled?.decisionGates?.length||0});
    }

    if(errors.length){
      saveArtifact({...lastArtifact,state:'failed',draft,compiled,resourceManifest:compiled?.resourceManifest||[],specialistWork:compiled?.specialistWork||[],decisionGates:compiled?.decisionGates||[],validationErrors:errors});
      throw Object.assign(new Error(`Local compiled the Weave Draft, but ${errors.length} required structure ${errors.length===1?'issue remains':'issues remain'}: ${errors.slice(0,6).join(' ')}`),{code:'CIVWEAVE_E4B_WEAVE_COMPILE_INVALID',validationErrors:errors,pipelineId});
    }

    const resourceManifest=compiled.resourceManifest||[],specialistWork=compiled.specialistWork||[],decisionGates=compiled.decisionGates||[];
    const artifact=saveArtifact({...lastArtifact,state:'complete',completedAt:now(),draft,compiled,resourceManifest,specialistWork,decisionGates,validationErrors:[]});
    paint(`Weave compiled: ${resourceManifest.length} resource${resourceManifest.length===1?'':'s'} · ${specialistWork.length} specialist flag${specialistWork.length===1?'':'s'} · ${decisionGates.length} decision gate${decisionGates.length===1?'':'s'}…`);
    dispatch({pipelineId,purpose,kind,phase:'pipeline',state:'complete',label:'Saved',artifactKey:artifactKey(kind),resourceCount:resourceManifest.length,specialistCount:specialistWork.length,decisionGateCount:decisionGates.length});
    const text=JSON.stringify(compiled);
    return{text,payload:{text,weavePipeline:{pipelineId,artifactKey:artifactKey(kind)}},model:modelFor(),provider:'downloaded-local',streamed:true,diagnostics:[{kind:'local-weave-draft-two-pass',model:modelFor(),purpose,pipelineId,repairUsed:Boolean(lastArtifact?.validationErrors?.length)}]};
  }catch(error){
    dispatch({pipelineId,purpose,kind,phase:'pipeline',state:error?.code==='CIVWEAVE_GENERATION_STOPPED'?'stopped':'failed',label:'Pipeline stopped',code:error?.code||'CIVWEAVE_E4B_WEAVE_PIPELINE_FAILED',message:clean(error?.message||error,1800)});
    if(lastArtifact?.pipelineId===pipelineId&&lastArtifact.state!=='failed')saveArtifact({...lastArtifact,state:error?.code==='CIVWEAVE_GENERATION_STOPPED'?'stopped':'failed',error:{code:error?.code||'CIVWEAVE_E4B_WEAVE_PIPELINE_FAILED',message:clean(error?.message||error,1800)}});
    throw error;
  }
}
function deepConfig(config={},purpose=''){
  const kind=kindFor(purpose),current=Math.max(0,Number(config.maxTokens)||0);
  return{...config,provider:'downloaded-local',route:'downloaded-local',model:modelFor(config),timeoutMs:Number(authority()?.taskTimeoutMs)||240000,maxTokens:Math.max(current,kind==='learning'?1200:1800),stream:true};
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
  version:VERSION,get deepModel(){return modelFor()},learningPurpose:LEARNING_PURPOSE,questPurpose:QUEST_PURPOSE,
  targeted,kindFor,firstBalancedJson,parseJsonLoose,companions,canonicalize,validateSchema,validateCompiled,draftSystem,compilerSystem,repairSystem,weaveTransport,prepareRequest,installRuntime,install,schedule,readArtifact,lastArtifact:()=>lastArtifact,
  architecture:'Local intake -> Local free Weave Draft -> Local JSON compile -> deterministic validation -> one Local targeted repair if needed',
  constrainedToolRequired:false,
  privateChainOfThoughtExposed:false,
  resourceManifestRequired:true,
  specialistWorkRequired:true,
  anarchadiaVotingGatesMandatory:true
});
schedule();
})();