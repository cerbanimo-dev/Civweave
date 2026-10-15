(()=>{
'use strict';

const VERSION='1.2.3-first-request-intake-bridge-v1-context-safe';
const PIPELINE_VERSION='1.3.2-weave-draft-pipeline-v1-context-safe';
const modelFor=()=>globalThis.CivweaveLocalGenerationModelPolicyV1?.resolve?.('deep')||globalThis.CivweaveGemma4LiteRTRequestAuthorityV1?.deepRoleModel?.()||globalThis.CivweaveLocalModelDownloadV266?.selection?.()?.id||'';
const supported=()=>Boolean(globalThis.CivweaveLocalGenerationModelPolicyV1?.supportsSelected?.());

if(globalThis.CivweaveGemma4FirstRequestIntakeBridgeV1?.version===VERSION){
  globalThis.CivweaveGemma4FirstRequestIntakeBridgeV1.install?.();
  return;
}

let installedTarget=null;
let scheduled=false;
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
function emit(phase,detail={}){try{dispatchEvent(new CustomEvent('civweave:first-request-intake-bridge',{detail:{version:VERSION,phase,at:new Date().toISOString(),...detail}}))}catch{}}
function systemFor(args={}){return clean(args.systemId||args?.context?.guide?.system||'civweave',80).toLowerCase()||'civweave'}
function selectedGemma(){
  try{if(globalThis.CivweaveGemma4LiteRTRequestAuthorityV1?.selectedFast?.())return true}catch{}
  try{const pick=globalThis.CivweaveLocalModelDownloadV266?.selection?.();return Boolean(pick?.active&&supported())}catch{return false}
}
function hasLayer(fn,flag,value=''){
  let current=fn,depth=0;
  while(typeof current==='function'&&depth<24){
    if(value?current?.[flag]===value:Boolean(current?.[flag]))return true;
    current=current.__prior;depth+=1;
  }
  return false;
}
function isLivingSchoolLearning(args={}){
  if(systemFor(args)!=='living-school')return false;
  try{return Boolean(globalThis.CivweaveUnifiedChatSystemV1?.learningJourneyIntent?.(clean(args.text,12000),Array.isArray(args.history)?args.history:[]))}catch{return false}
}
function intakeArgs(args={}){
  if(systemFor(args)!=='living-school')return args;
  return{
    ...args,
    sourceSystemId:args.sourceSystemId||'living-school',
    sourceGuide:args.sourceGuide||'Moss',
    systemId:'civweave',
    context:{...(args.context||{}),guide:{...(args.context?.guide||{}),system:'civweave',name:'Weaveling'}}
  };
}
function eligible(args={}){
  if(!selectedGemma())return false;
  const system=systemFor(args);
  if(system!=='civweave'&&!(system==='living-school'&&isLivingSchoolLearning(args)))return false;
  const authority=globalThis.CivweaveGemma4StructuredTaskAuthorityV1;
  try{return Boolean(authority?.intakeFirst===true&&authority?.intakeEligible?.(intakeArgs(args)))}catch{return false}
}
async function ensureWeaveAuthority(args={}){
  const first=globalThis.CivweaveGemma4LiteRTRequestAuthorityV1;
  if(typeof first?.ensure==='function')await first.ensure({onProgress:args?.onProgress,reason:'first-request-intake-bridge'});
  try{first?.installFamilyLoaderWeaveRebind?.()}catch{}
  try{globalThis.CivweaveGuideGenerationTrackerV1?.install?.()}catch{}
  const pipeline=globalThis.CivweaveGemma4WeaveDraftPipelineV1;
  if(pipeline?.version!==PIPELINE_VERSION)throw Object.assign(new Error('The configured Weave Draft pipeline did not become ready before intake handoff.'),{code:'CIVWEAVE_WEAVE_PIPELINE_NOT_READY'});
  try{pipeline.install?.()}catch{}
  let generate=globalThis.CivweaveModelRuntime?.generate;
  if(!hasLayer(generate,'__civweaveWeaveDraftPipelineV1',PIPELINE_VERSION)){
    try{pipeline.installRuntime?.()}catch{}
    generate=globalThis.CivweaveModelRuntime?.generate;
  }
  if(!hasLayer(generate,'__civweaveWeaveDraftPipelineV1',PIPELINE_VERSION))throw Object.assign(new Error('The configured Weave Draft pipeline is loaded but is not authoritative in the model runtime chain.'),{code:'CIVWEAVE_WEAVE_PIPELINE_NOT_ACTIVE'});
  return pipeline;
}
function failurePacket(error){
  const code=clean(error?.code||'CIVWEAVE_FIRST_REQUEST_INTAKE_BRIDGE_FAILED',180),stage=clean(error?.stage,220),message=clean(error?.message||error,1400);
  const intakeFailure=/INTAKE/i.test(`${code} ${stage}`),model=clean(error?.executionModel||modelFor(),240);
  return{response:{answer:`Weaveling could not complete the ${intakeFailure?'model intake':'Weave generation'} path. Nothing was generated or queued.\n\nGeneration detail: ${message}`,choice:{mode:'Plan',system:'civweave',room:'civweave.quad',nextAction:'Check the installed planning model and Weave pipeline; no model substitution was made.'},assumptions:[],requiresConsent:false,confidence:1},requestedProvider:'downloaded-local',provider:'weaveling-first-request-bridge-failed',model,fallbackFrom:null,bridge:{failed:true,code,stage,model}};
}
async function directIntake(args={}){
  await ensureWeaveAuthority(args);
  const authority=globalThis.CivweaveGemma4StructuredTaskAuthorityV1,normalized=intakeArgs(args);
  if(!authority?.intakeFirst||typeof authority?.intakeRespond!=='function'||!authority?.intakeEligible?.(normalized))return{handled:false,result:null};
  emit('intake-start',{model:modelFor(),textLength:clean(args.text,12000).length,sourceSystem:systemFor(args)});
  try{
    authority.syncStopButton?.();
    const result=await authority.intakeRespond(normalized);
    if(result==null)return{handled:false,result:null};
    emit('intake-complete',{model:result?.model||'',provider:result?.provider||'',generationStage:result?.generationStage||'',sourceSystem:systemFor(args)});
    return{handled:true,result};
  }catch(error){
    emit('intake-failed',{code:error?.code||'',message:clean(error?.message||error,800),sourceSystem:systemFor(args)});
    return{handled:true,result:failurePacket(error)};
  }finally{try{authority.syncStopButton?.()}catch{}}
}
function install(){
  const api=globalThis.CivweaveAssistantV141,current=api?.respond;
  if(!api||typeof current!=='function')return false;
  if(current.__civweaveFirstRequestIntakeBridgeV1===VERSION){installedTarget=current;return true}
  const prior=current.bind(api);
  const respond=async args=>{
    if(!eligible(args))return prior(args);
    const direct=await directIntake(args||{});
    if(direct.handled)return direct.result;
    return prior(args);
  };
  for(const key of Object.keys(current))try{respond[key]=current[key]}catch{}
  respond.__civweaveFirstRequestIntakeBridgeV1=VERSION;
  respond.__civweaveE4BIntakeFirstV1=true;
  respond.__civweaveLivingSchoolIntakeFirstV1=true;
  respond.__civweaveWeavePipelineRequiredV1=true;
  respond.__prior=current;
  try{api.respond=respond;if(api.respond!==respond)throw new Error('assistant assignment did not stick')}catch{
    try{globalThis.CivweaveAssistantV141={...api,respond}}catch{return false}
  }
  installedTarget=globalThis.CivweaveAssistantV141?.respond||respond;
  emit('installed',{weaveRequired:true,selectedGemma:selectedGemma(),livingSchoolLearningIntake:true});
  return true;
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;install()})}
for(const name of ['civweave:assistant-runtime-ready','civweave:local-provider-authority-installed','civweave:local-guide-control-bypass-ready','civweave:structured-task-authority-ready','civweave:gemma4-litert-first-request-ready','civweave:guide-loader-reset','civweave:unified-chat-system-ready','pageshow'])addEventListener?.(name,schedule);
for(const delay of [0,50,180,500,1200,2800,6000,12000,20000])setTimeout(schedule,delay);

globalThis.CivweaveGemma4FirstRequestIntakeBridgeV1=Object.freeze({version:VERSION,pipelineVersion:PIPELINE_VERSION,eligible,isLivingSchoolLearning,intakeArgs,selectedGemma,hasLayer,ensureWeaveAuthority,directIntake,install,schedule,weaveRequired:true,livingSchoolLearningIntake:true,get intakeModel(){return modelFor()},get deepModel(){return modelFor()},state:()=>Object.freeze({installed:Boolean(installedTarget),selectedGemma:selectedGemma(),pipelineActive:hasLayer(globalThis.CivweaveModelRuntime?.generate,'__civweaveWeaveDraftPipelineV1',PIPELINE_VERSION)})});
schedule();
})();
