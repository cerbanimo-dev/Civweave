(()=>{
'use strict';

const VERSION='1.0.0-gemma4-learning-plan-entry-authority-v1-explicit-weave';
const PURPOSE='living-school-learning-plan-review-v2';
const E2B='gemma4-e2b-it-litert-web';
const E4B='gemma4-e4b-it-litert-web';
const LOCAL_PROVIDERS=new Set(['downloaded-local','generative-local','local-ai','browser','smollm2','smollm3','qwen']);
let scheduled=false;
let unifiedTarget=null;
let loaderTarget=null;
let runtimeTarget=null;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
function emit(phase,detail={}){try{dispatchEvent(new CustomEvent('civweave:gemma4-learning-plan-entry',{detail:{version:VERSION,phase,at:new Date().toISOString(),...detail}}))}catch{}}
function bridge(){return globalThis.CivweaveGemma4FirstRequestIntakeBridgeV1||null}
function selectedGemma(){try{return Boolean(bridge()?.selectedGemma?.())}catch{return false}}
function localRequest(request={}){return request?.purpose===PURPOSE&&LOCAL_PROVIDERS.has(clean(request?.config?.provider||request?.config?.route,120).toLowerCase())}
function pipeline(){return globalThis.CivweaveGemma4WeaveDraftPipelineV1||null}
function directRuntimeResult(request,transport){
  const text=clean(transport?.text||transport?.payload?.text,48000),api=pipeline();
  const outputJson=api?.parseJsonLoose?.(text)||null;
  return{
    schema:'civweave-model-result-1.0',status:'success',outputText:text,outputJson,
    requested:{provider:clean(request?.config?.provider||request?.config?.route,120)||'downloaded-local',model:clean(request?.config?.model,240)||E4B},
    actual:{provider:'downloaded-local',model:E4B},provider:'downloaded-local',model:E4B,
    usage:{},stream:{requested:false,used:true},structured:{requested:true,valid:true,repairAttempts:0},fallback:{used:false},diagnostics:[...(Array.isArray(transport?.diagnostics)?transport.diagnostics:[]),{kind:'learning-plan-explicit-weave-entry',model:E4B,purpose:PURPOSE}]
  };
}
function installRuntimeGate(){
  const runtime=globalThis.CivweaveModelRuntime,current=runtime?.generate;
  if(!runtime||typeof current!=='function')return false;
  if(current.__civweaveLearningPlanEntryAuthorityV1===VERSION){runtimeTarget=runtime;return true}
  const prior=current;
  const generate=async request=>{
    if(selectedGemma()&&localRequest(request)){
      const api=pipeline();
      if(typeof api?.weaveTransport!=='function')throw Object.assign(new Error('The E4B Weave pipeline is unavailable at the Learning Journey generation boundary.'),{code:'CIVWEAVE_LEARNING_WEAVE_PIPELINE_UNAVAILABLE'});
      emit('direct-weave-start',{selected:E4B});
      const transport=await api.weaveTransport(PURPOSE,{config:{...(request?.config||{}),provider:'downloaded-local',route:'downloaded-local',model:E4B,timeoutMs:600000},messages:request?.messages||[],schema:request?.schema||null,signal:request?.signal,emit:request?.onEvent});
      const result=directRuntimeResult(request,transport);
      emit('direct-weave-complete',{selected:E4B,outputLength:result.outputText.length});
      return result;
    }
    return prior.call(runtime,request);
  };
  for(const key of Object.keys(current))try{generate[key]=current[key]}catch{}
  generate.__civweaveLearningPlanEntryAuthorityV1=VERSION;
  generate.__prior=current;
  try{runtime.generate=generate;if(runtime.generate===generate){runtimeTarget=runtime;return true}}catch{}
  try{globalThis.CivweaveModelRuntime={...runtime,generate};runtimeTarget=globalThis.CivweaveModelRuntime;return globalThis.CivweaveModelRuntime?.generate===generate}catch{return false}
}
function installLoaderGuard(){
  const loader=globalThis.CivweaveFamilyAILoaderV105,current=loader?.ensure;
  if(!loader||typeof current!=='function')return false;
  if(current.__civweaveLearningPlanEntryLoaderV1===VERSION){loaderTarget=loader;return true}
  const prior=current.bind(loader);
  const ensure=async(...args)=>{
    const result=await prior(...args);
    try{pipeline()?.install?.()}catch{}
    if(selectedGemma()&&!installRuntimeGate())throw Object.assign(new Error('Family AI loading completed without restoring the explicit Learning Journey Weave boundary.'),{code:'CIVWEAVE_LEARNING_WEAVE_REBIND_FAILED'});
    installUnified();
    return result;
  };
  ensure.__civweaveLearningPlanEntryLoaderV1=VERSION;
  ensure.__prior=current;
  try{loader.ensure=ensure;if(loader.ensure===ensure){loaderTarget=loader;return true}}catch{}
  try{globalThis.CivweaveFamilyAILoaderV105={...loader,ensure};loaderTarget=globalThis.CivweaveFamilyAILoaderV105;return loaderTarget?.ensure===ensure}catch{return false}
}
function normalizedIntakeArgs(options={}){
  return{...options,systemId:'civweave',sourceSystemId:options.sourceSystemId||options.systemId||'living-school',sourceGuide:options.sourceGuide||'Moss',context:{...(options.context||{}),guide:{...(options.context?.guide||{}),system:'civweave',name:'Weaveling'}}};
}
function installUnified(){
  const api=globalThis.CivweaveUnifiedChatSystemV1,current=api?.generateLivingSchoolPlan;
  if(!api||typeof current!=='function')return false;
  if(current.__civweaveLearningPlanEntryAuthorityV1===VERSION){unifiedTarget=api;return true}
  const prior=current.bind(api);
  const generateLivingSchoolPlan=async(options={},...rest)=>{
    if(!selectedGemma())return prior(options,...rest);
    if(options?.__civweaveE2BIntakeCompleted!==true){
      const intake=bridge();
      if(typeof intake?.directIntake!=='function')throw Object.assign(new Error('Local Gemma Learning Journey generation reached Moss before the mandatory E2B intake bridge was ready.'),{code:'CIVWEAVE_LEARNING_E2B_INTAKE_REQUIRED'});
      emit('intake-required',{sourceSystem:clean(options?.systemId,80)||'living-school',model:E2B});
      const routed=await intake.directIntake(normalizedIntakeArgs(options));
      if(routed?.handled)return routed.result;
      throw Object.assign(new Error('The mandatory E2B intake stage did not handle this Learning Journey request. Legacy direct generation is blocked.'),{code:'CIVWEAVE_LEARNING_E2B_INTAKE_NOT_HANDLED'});
    }
    try{await globalThis.CivweaveGemma4LiteRTRequestAuthorityV1?.ensure?.({onProgress:options?.onProgress,reason:'learning-plan-explicit-weave'})}catch(error){throw error}
    try{pipeline()?.install?.()}catch{}
    installLoaderGuard();
    if(!installRuntimeGate())throw Object.assign(new Error('The E4B Weave pipeline could not take ownership at the Learning Journey generation boundary.'),{code:'CIVWEAVE_LEARNING_WEAVE_GATE_NOT_ACTIVE'});
    emit('handoff-to-weave',{model:E4B});
    return prior({...options,__civweaveE2BIntakeCompleted:true},...rest);
  };
  for(const key of Object.keys(current))try{generateLivingSchoolPlan[key]=current[key]}catch{}
  generateLivingSchoolPlan.__civweaveLearningPlanEntryAuthorityV1=VERSION;
  generateLivingSchoolPlan.__prior=current;
  const next=Object.freeze({...api,generateLivingSchoolPlan,learningPlanEntryAuthority:VERSION,explicitWeaveEntry:true,mandatoryE2BIntake:true});
  try{globalThis.CivweaveUnifiedChatSystemV1=next;unifiedTarget=next;emit('unified-installed',{mandatoryE2B:true,explicitWeave:true});return true}catch{return false}
}
function install(){
  try{pipeline()?.install?.()}catch{}
  installLoaderGuard();
  installRuntimeGate();
  installUnified();
  return Boolean(unifiedTarget||globalThis.CivweaveUnifiedChatSystemV1?.generateLivingSchoolPlan?.__civweaveLearningPlanEntryAuthorityV1===VERSION)
}
function schedule(reason='event'){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;install();emit('repair',{reason,selectedGemma:selectedGemma()})})}
for(const name of ['civweave:unified-chat-system-ready','civweave:assistant-runtime-ready','civweave:gemma4-litert-first-request-ready','civweave:structured-task-authority-ready','civweave:guide-loader-reset','pageshow'])addEventListener?.(name,()=>schedule(name));
for(const delay of [0,80,260,800,1800,4200,9000,16000])setTimeout(()=>schedule(`timer-${delay}`),delay);

globalThis.CivweaveGemma4LearningPlanEntryAuthorityV1=Object.freeze({version:VERSION,purpose:PURPOSE,intakeModel:E2B,deepModel:E4B,selectedGemma,localRequest,installRuntimeGate,installLoaderGuard,installUnified,install,schedule,mandatoryE2BIntake:true,explicitWeaveEntry:true});
schedule('startup');
})();
