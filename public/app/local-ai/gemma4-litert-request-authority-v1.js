(()=>{
'use strict';

const VERSION='1.1.1-gemma4-litert-request-authority-v1-global-stream-tracker';
const LOCAL_CHAT_SRC='/app/local-chat-runtime-v295.js?v=1.0.130-v325-inference-core-first';
const LOCAL_CHAT_REVISION='v312-runtime-first-bootstrap';
const FAST_EXTENSION_VERSION='1.1.1-gemma4-litert-fast-extension-v1-browser-handoff-guard';
const FAST_EXTENSION_SRC='/app/local-ai/gemma4-litert-fast-extension-v1.js?v=1.1.1-browser-handoff-guard';
const FAST_RUNTIME_VERSION='1.4.0-litert-gemma4-fast-runtime-v1-formatted-output';
const FAST_RUNTIME_SRC='/app/local-ai/litert-gemma4-fast-runtime-v1.js?v=1.4.0-formatted-output';
const FAST_STRUCTURED_TOOL_ADAPTER_VERSION='1.0.0-litert-web-dual-tool-shape-json-fallback';
const TRACKER_VERSION='1.0.0-guide-generation-tracker-v1-live-pipeline-streams';
const TRACKER_SRC='/app/guide-generation-tracker-v1.js?v=1.0.0-live-pipeline-streams';
const WEAVE_PIPELINE_VERSION='1.0.0-gemma4-weave-draft-pipeline-v1-plan-compile-repair';
const WEAVE_PIPELINE_SRC='/app/local-ai/gemma4-weave-draft-pipeline-v1.js?v=1.0.0-plan-compile-repair';
const DEEP_MODEL='gemma4-e4b-it-litert-web';
const FAST_IDS=new Set(['gemma4-e2b-it-litert-web','gemma4-e4b-it-litert-web']);
const SELECTION_KEY='civweave.local-ai.selection.v266';
const COMPOSITION_KEYS=Object.freeze([
  '__civweaveLocalProviderAuthorityV1',
  '__civweaveLocalProviderAuthorityVersion',
  '__cwLocalGuideControlBypassV1',
  '__cwLocalGuideControlBypassVersion',
  '__cwWeavelingAIQuestRequiredV1',
  '__cwWeavelingStructuredQuestRouteV1',
  '__cwPlatformGuideGuardsV1',
  '__cwUnifiedChatSystemV1',
  '__weavelingPlanJsonV190',
  '__guideIdentityIntegrityV216',
  '__cwGuideCapabilityPassoverV1',
  '__deterministicModeV175',
  '__cwMossLearningGoalPlannerV1'
]);

if(globalThis.CivweaveGemma4LiteRTRequestAuthorityV1?.version===VERSION){
  globalThis.CivweaveGemma4LiteRTRequestAuthorityV1.schedule?.();
  return;
}

let ensureFlight=null;
let trackerFlight=null;
let assistantTarget=null;
let fastAdapterTarget=null;
let unifiedTarget=null;
let queued=false;
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
function selected(){
  try{
    const live=globalThis.CivweaveLocalModelDownloadV266?.selection?.();
    if(live?.active&&live.id)return live;
  }catch{}
  try{
    const saved=parse(localStorage.getItem(SELECTION_KEY),{});
    return saved?.active&&saved.id?saved:null;
  }catch{return null}
}
function selectedFast(){
  const pick=selected();
  return Boolean(pick?.active&&FAST_IDS.has(clean(pick.id,240)));
}
function emit(type,detail={}){
  try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}
}
function normalizedStructuredTool(value){
  if(!value||typeof value!=='object')return null;
  const source=value.type==='function'&&value.function?.name?value.function:value.name?value:null;
  const name=clean(source?.name||value.name,120);if(!name)return null;
  const description=clean(source?.description||value.description,600);
  const parameters=source?.parameters||value.parameters||{type:'object',properties:{}};
  return{type:'function',name,description,parameters,function:{name,description,parameters}};
}
function installFastStructuredToolAdapter(){
  const api=globalThis.CivweaveLiteRTGemma4FastRuntimeV1;
  if(!api?.runFast)return false;
  if(api.__civweaveStructuredToolAdapterV1===FAST_STRUCTURED_TOOL_ADAPTER_VERSION){fastAdapterTarget=api;return true}
  const prior=api.runFast.bind(api);
  const runFast=async(args={},forcedModelId='')=>{
    const tool=normalizedStructuredTool(args?.structuredTool);
    if(!tool)return prior(args,forcedModelId);
    const toolContract=`STRUCTURED TOOL CONTRACT: You MUST respond by calling the ${tool.name} tool exactly once. Put the complete structured result in that tool's arguments. Do not answer with prose or raw JSON outside the tool call.`;
    const systemPrompt=[clean(args.systemPrompt,12000),toolContract].filter(Boolean).join('\n\n');
    try{return await prior({...args,structuredTool:tool,systemPrompt},forcedModelId)}catch(error){
      if(error?.code!=='LITERT_FORMATTED_OUTPUT_MISSING')throw error;
      emit('civweave:litert-structured-tool-text-fallback',{model:forcedModelId||selected()?.id||'',tool:tool.name,reason:error.code});
      const fallbackPrompt=[clean(args.systemPrompt,12000),`The Web LiteRT tool-call parser did not surface ${tool.name}. Stay on the same model and return ONLY one JSON object matching the ${tool.name} parameter schema. No markdown, prose, code fences, or commentary.`].filter(Boolean).join('\n\n');
      const result=await prior({...args,structuredTool:null,systemPrompt:fallbackPrompt},forcedModelId);
      return{...result,formattedOutput:{used:false,constrainedDecoding:false,toolName:tool.name,fallback:'same-model-json-text'},structuredToolFallback:true,diagnostics:[...(Array.isArray(result?.diagnostics)?result.diagnostics:[]),{kind:'litert-web-tool-call-not-surfaced',tool:tool.name,sameModel:true}]};
    }
  };
  const next=Object.freeze({...api,runFast,__civweaveStructuredToolAdapterV1:FAST_STRUCTURED_TOOL_ADAPTER_VERSION,litertStructuredToolDualShape:true,litertStructuredJsonFallbackSameModel:true});
  try{globalThis.CivweaveLiteRTGemma4FastRuntimeV1=next}catch{return false}
  fastAdapterTarget=next;
  emit('civweave:litert-structured-tool-adapter-ready',{adapter:FAST_STRUCTURED_TOOL_ADAPTER_VERSION,dualShape:true,sameModelJsonFallback:true});
  return true;
}
function installLearningPlanMetadataAdapter(){
  const api=globalThis.CivweaveUnifiedChatSystemV1,current=api?.generateLivingSchoolPlan;
  if(!api||typeof current!=='function')return false;
  if(current.__civweaveE4BHandoffMetadataV1===VERSION){unifiedTarget=api;return true}
  const prior=current.bind(api);
  const generateLivingSchoolPlan=async(...args)=>{
    const result=await prior(...args),options=args[0]||{};
    if(options?.__civweaveE2BIntakeCompleted===true){
      return{...result,requestedProvider:'downloaded-local',provider:'downloaded-local',model:DEEP_MODEL,structuredGenerationModel:DEEP_MODEL,e2bIntakeModel:'gemma4-e2b-it-litert-web'};
    }
    return result;
  };
  generateLivingSchoolPlan.__civweaveE4BHandoffMetadataV1=VERSION;
  generateLivingSchoolPlan.__prior=current;
  const next=Object.freeze({...api,generateLivingSchoolPlan,e4bIntakeHandoffMetadata:true});
  try{globalThis.CivweaveUnifiedChatSystemV1=next}catch{return false}
  unifiedTarget=next;
  emit('civweave:e4b-learning-plan-metadata-ready',{model:DEEP_MODEL});
  return true;
}
function scriptFor(path){
  try{return [...(document.scripts||[])].find(node=>new URL(node.src,location.href).pathname===path)||null}catch{return null}
}
function loadScript(src,ready,label){
  if(ready())return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const target=new URL(src,location.href),path=target.pathname;
    const existing=scriptFor(path);
    if(existing&&!ready())try{existing.remove()}catch{}
    const script=document.createElement('script');
    let settled=false;
    const finish=(ok,error)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      ok?resolve(true):reject(error);
    };
    const timer=setTimeout(
      ()=>finish(false,Object.assign(new Error(`${label} did not become ready.`),{code:'LOCAL_GEMMA4_LITERT_STARTUP_TIMEOUT',component:label})),
      20000
    );
    script.src=`${src}${src.includes('?')?'&':'?'}cwGemmaFirst=${Date.now()}`;
    script.async=false;
    script.dataset.civweaveGemma4FirstRequest='v1';
    script.onload=()=>finish(
      ready(),
      Object.assign(new Error(`${label} loaded without satisfying its runtime contract.`),{code:'LOCAL_GEMMA4_LITERT_STARTUP_CONTRACT',component:label})
    );
    script.onerror=()=>finish(false,Object.assign(new Error(`${label} could not load.`),{code:'LOCAL_GEMMA4_LITERT_STARTUP_LOAD',component:label}));
    const head=document.head;
    if(!head?.isConnected){
      finish(false,Object.assign(new Error(`${label} could not mount because the document is leaving.`),{code:'LOCAL_GEMMA4_LITERT_STARTUP_LOAD',component:label}));
      return;
    }
    head.append(script);
  });
}
function localChatReady(){
  const runtime=globalThis.CivweaveLocalChatRuntimeV295;
  return Boolean(runtime?.generate&&runtime?.revision===LOCAL_CHAT_REVISION&&runtime?.inferenceCoreFirst===true);
}
async function ensureLocalChat(onProgress){
  if(!localChatReady())await loadScript(LOCAL_CHAT_SRC,localChatReady,'downloaded-local chat runtime');
  const runtime=globalThis.CivweaveLocalChatRuntimeV295;
  if(typeof runtime?.ready==='function')await runtime.ready(onProgress);
  if(!localChatReady())throw Object.assign(new Error('The downloaded-local chat runtime did not become inference-core ready.'),{code:'LOCAL_GEMMA4_LITERT_STARTUP_CONTRACT',component:'local-chat-runtime'});
  return runtime;
}
function fastExtensionReady(){return globalThis.CivweaveGemma4LiteRTFastExtensionV1?.version===FAST_EXTENSION_VERSION}
function fastRuntimeReady(){return globalThis.CivweaveLiteRTGemma4FastRuntimeV1?.version===FAST_RUNTIME_VERSION}
function fastWrapperReady(){return globalThis.CivweaveLocalChatRuntimeV295?.__civweaveLiteRTGemma4FastV1===FAST_RUNTIME_VERSION}
function trackerReady(){return globalThis.CivweaveGuideGenerationTrackerV1?.version===TRACKER_VERSION}
function weavePipelineReady(){return globalThis.CivweaveGemma4WeaveDraftPipelineV1?.version===WEAVE_PIPELINE_VERSION}
function ensureTracker(){
  if(trackerReady()){globalThis.CivweaveGuideGenerationTrackerV1?.install?.();return Promise.resolve(true)}
  if(trackerFlight)return trackerFlight;
  trackerFlight=loadScript(TRACKER_SRC,trackerReady,'live guide response tracker').then(()=>{globalThis.CivweaveGuideGenerationTrackerV1?.install?.();return true}).finally(()=>{trackerFlight=null});
  return trackerFlight;
}
async function ensureWeaveLayers(){
  await ensureTracker();
  if(!weavePipelineReady())await loadScript(WEAVE_PIPELINE_SRC,weavePipelineReady,'E4B Weave Draft compiler');
  globalThis.CivweaveGemma4WeaveDraftPipelineV1?.install?.();
  if(!trackerReady()||!weavePipelineReady())throw Object.assign(new Error('The Weave Draft generation layers did not become ready.'),{code:'LOCAL_GEMMA4_WEAVE_PIPELINE_NOT_READY'});
  return true;
}
async function ensure({onProgress,reason='local-request'}={}){
  if(!selectedFast())return globalThis.CivweaveLocalChatRuntimeV295||null;
  if(ensureFlight)return ensureFlight;
  ensureFlight=(async()=>{
    const pick=selected();
    emit('civweave:gemma4-litert-first-request-start',{reason,model:pick?.id||''});
    await ensureLocalChat(onProgress);
    if(!fastExtensionReady())await loadScript(FAST_EXTENSION_SRC,fastExtensionReady,'Gemma 4 LiteRT model extension');
    try{globalThis.CivweaveGemma4LiteRTFastExtensionV1?.watch?.()}catch{}
    try{globalThis.CivweaveGemma4CurrentRegistryAuthorityV1?.repairRegistry?.()}catch{}
    if(!fastRuntimeReady())await loadScript(FAST_RUNTIME_SRC,fastRuntimeReady,'Gemma 4 LiteRT inference runtime');
    globalThis.CivweaveLiteRTGemma4FastRuntimeV1?.install?.();
    if(!fastWrapperReady()){
      await Promise.resolve();
      globalThis.CivweaveLiteRTGemma4FastRuntimeV1?.install?.();
    }
    if(!fastWrapperReady()){
      throw Object.assign(new Error('Gemma 4 LiteRT loaded, but it did not take ownership of the selected local model before inference.'),{code:'LOCAL_GEMMA4_LITERT_OWNERSHIP_FAILED',component:'litert-fast-runtime'});
    }
    installFastStructuredToolAdapter();
    installLearningPlanMetadataAdapter();
    await ensureWeaveLayers();
    emit('civweave:gemma4-litert-first-request-ready',{reason,model:pick?.id||'',firstRequestOwned:true,structuredToolAdapter:true,weaveDraftPipeline:true,liveTracker:true});
    return globalThis.CivweaveLocalChatRuntimeV295;
  })().catch(error=>{
    emit('civweave:gemma4-litert-first-request-failed',{reason,model:selected()?.id||'',code:error?.code||'LOCAL_GEMMA4_LITERT_STARTUP_FAILED',message:String(error?.message||error)});
    throw error;
  }).finally(()=>{ensureFlight=null});
  return ensureFlight;
}
function copyCompositionMetadata(target,source){
  for(const key of COMPOSITION_KEYS){
    if(source?.[key]!==undefined)target[key]=source[key];
  }
  return target;
}
function installAssistant(){
  installFastStructuredToolAdapter();
  installLearningPlanMetadataAdapter();
  try{globalThis.CivweaveGuideGenerationTrackerV1?.install?.()}catch{}
  try{globalThis.CivweaveGemma4WeaveDraftPipelineV1?.install?.()}catch{}
  const api=globalThis.CivweaveAssistantV141;
  if(!api?.respond)return false;
  if(api.respond.__civweaveGemma4LiteRTFirstRequest===VERSION){assistantTarget=api;return true}
  const prior=api.respond;
  const respond=async args=>{
    if(selectedFast())await ensure({onProgress:args?.onProgress,reason:'guide-request'});
    installFastStructuredToolAdapter();
    installLearningPlanMetadataAdapter();
    globalThis.CivweaveGemma4WeaveDraftPipelineV1?.install?.();
    return prior.call(api,args);
  };
  copyCompositionMetadata(respond,prior);
  respond.__civweaveGemma4LiteRTFirstRequest=VERSION;
  respond.__civweaveGemma4LiteRTStableComposition=true;
  respond.__prior=prior;
  const next={...api,respond,gemma4LiteRTFirstRequestAuthority:VERSION,gemma4LiteRTStableComposition:true};
  try{globalThis.CivweaveAssistantV141=next}catch{return false}
  assistantTarget=next;
  emit('civweave:gemma4-litert-request-authority-installed',{compositionPreserved:true,selectedFast:selectedFast(),structuredToolAdapter:Boolean(fastAdapterTarget),weaveDraftPipeline:weavePipelineReady(),liveTracker:trackerReady()});
  return true;
}
function schedule(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{
    queued=false;
    void ensureTracker().catch(()=>{});
    installFastStructuredToolAdapter();installLearningPlanMetadataAdapter();
    try{globalThis.CivweaveGemma4WeaveDraftPipelineV1?.install?.()}catch{}
    installAssistant();
  });
}
function prewarm(){
  if(!selectedFast())return Promise.resolve(false);
  return ensure({reason:'explicit-prewarm'}).then(()=>true,()=>false);
}
for(const name of [
  'civweave:assistant-runtime-ready',
  'civweave:unified-chat-system-ready',
  'civweave:guide-chat-ready',
  'civweave:local-model-selection',
  'civweave:guide-loader-reset',
  'civweave:local-provider-authority-installed',
  'civweave:local-guide-control-bypass-ready',
  'civweave:guide-capability-passover-ready',
  'civweave:gemma4-litert-fast-runtime-ready',
  'civweave:structured-task-authority-ready',
  'pageshow'
])addEventListener(name,schedule);
for(const delay of [0,40,160,500,1200,2600,5200,9000,15000])setTimeout(schedule,delay);

globalThis.CivweaveGemma4LiteRTRequestAuthorityV1=Object.freeze({
  version:VERSION,
  fastRuntimeVersion:FAST_RUNTIME_VERSION,
  fastExtensionVersion:FAST_EXTENSION_VERSION,
  structuredToolAdapterVersion:FAST_STRUCTURED_TOOL_ADAPTER_VERSION,
  trackerVersion:TRACKER_VERSION,
  weavePipelineVersion:WEAVE_PIPELINE_VERSION,
  selected,selectedFast,ensure,prewarm,ensureTracker,ensureWeaveLayers,installAssistant,schedule,copyCompositionMetadata,normalizedStructuredTool,installFastStructuredToolAdapter,installLearningPlanMetadataAdapter,
  firstRequestOwnership:true,
  requestTriggeredOwnership:true,
  passivePrewarm:false,
  genericTransformersBypass:true,
  stableAssistantComposition:true,
  structuredToolDualShape:true,
  sameModelJsonFallback:true,
  e4bLearningPlanMetadata:true,
  weaveDraftPipeline:true,
  liveGenerationTracker:true,
  globalFinalResponseStreaming:true,
  compositionKeys:COMPOSITION_KEYS,
  state:()=>Object.freeze({
    selected:selected()?.id||'',selectedFast:selectedFast(),localChatReady:localChatReady(),fastExtensionReady:fastExtensionReady(),fastRuntimeReady:fastRuntimeReady(),fastWrapperReady:fastWrapperReady(),trackerReady:trackerReady(),weavePipelineReady:weavePipelineReady(),ensuring:Boolean(ensureFlight),assistantWrapped:Boolean(assistantTarget),fastStructuredAdapter:Boolean(fastAdapterTarget),learningPlanMetadataAdapter:Boolean(unifiedTarget),compositionPreserved:Boolean(globalThis.CivweaveAssistantV141?.respond?.__civweaveGemma4LiteRTStableComposition)
  })
});
schedule();
})();