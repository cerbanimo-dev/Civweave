(()=>{
'use strict';
const VERSION='1.0.61-local-ai-bridge-v268-capability-routing';
if(globalThis.CivweaveLocalModelBridgeV266?.version===VERSION)return;
const priorBridge=globalThis.CivweaveLocalModelBridgeV266;
let original=priorBridge?.base?.()||null,patched=null;
const downloads=()=>globalThis.CivweaveLocalModelDownloadV266;
const local=()=>globalThis.CivweaveLocalModelRuntimeV266;
const broker=()=>globalThis.CivweaveAICapabilityBrokerV268;
function selected(){const value=downloads()?.selection?.();return Boolean(value?.active&&value?.id)}
function timeoutFor(spec,request){const explicit=Number(request.config?.timeoutMs||request.timeoutMs||0);if(explicit)return Math.max(180000,explicit);const bytes=Number(spec?.estimatedBytes||0);return bytes>=2_000_000_000?900000:bytes>=1_000_000_000?600000:360000}
function routeDecision(request,spec){
  const capabilityBroker=broker();
  if(capabilityBroker?.supportsLocalRequest){
    const localSupport=capabilityBroker.supportsLocalRequest(spec,request);
    return{useLocal:Boolean(localSupport?.ok),reason:localSupport?.reason||'capability broker rejected local route',requirements:localSupport?.requirements||null};
  }
  const profile=request.executionProfile||'interactive';
  return{useLocal:profile==='interactive',reason:profile==='interactive'?'legacy interactive local route':'agentic local routing requires the capability broker',requirements:{profile}};
}
function resultFrom(request,run,started,decision){
  const spec=local().activeSpec();
  const structuredRequested=Boolean(request.schema||request.responseFormat==='json'||request.responseFormat==='structured');
  return{
    schema:'civweave-model-result-1.0',
    requestId:`local-${Date.now().toString(36)}`,
    purpose:String(request?.purpose||'interactive'),
    status:'success',
    requested:{provider:'downloaded-local',model:spec?.id||'local-model',endpoint:'',executionProfile:request?.executionProfile||'interactive'},
    actual:{provider:'downloaded-local',model:spec?.id||'local-model'},
    outputText:run.text||'',outputJson:run.json||null,
    usage:{inputTokens:0,outputTokens:0,totalTokens:0,costCents:0,remainingCents:0},
    timing:{startedAt:new Date(Date.now()-(performance.now()-started)).toISOString(),completedAt:new Date().toISOString(),elapsedMs:run.elapsedMs||Math.round(performance.now()-started)},
    events:[],
    diagnostics:[
      {code:'LOCAL_MODEL',message:'Generated entirely on this device from the explicitly selected downloaded model.'},
      {code:'CAPABILITY_ROUTE',message:decision.reason,requirements:decision.requirements||null},
    ],
    stream:{requested:false,used:false},
    structured:{requested:structuredRequested,valid:!structuredRequested||Boolean(run.json),repairAttempts:0},
    capabilityRouting:{schema:'civweave.ai-capability-route.v1',route:'downloaded-local',reason:decision.reason,requirements:decision.requirements||null},
  };
}
async function generate(request={}){
  if(!selected())return original.generate(request);
  const spec=local()?.activeSpec?.();
  if(!spec)throw Object.assign(new Error('A downloaded local model is selected, but its runtime has not attached yet.'),{code:'LOCAL_MODEL_NOT_READY'});
  const decision=routeDecision(request,spec);
  if(!decision.useLocal){
    try{dispatchEvent(new CustomEvent('civweave:local-model-route-skipped',{detail:{model:spec.id,reason:decision.reason,requirements:decision.requirements}}))}catch{}
    return original.generate(request);
  }
  const started=performance.now();
  try{
    const run=await local().generate({
      messages:request.messages||[],
      maxNewTokens:request.config?.maxTokens||request.maxTokens||1024,
      temperature:request.config?.temperature??request.temperature??.2,
      timeoutMs:timeoutFor(spec,request),
      onProgress:progress=>{
        const detail={phase:'local-model-progress',provider:'downloaded-local',model:spec.id,executionProfile:request.executionProfile||'interactive',...progress};
        try{request.onEvent?.(detail)}catch{}
        try{dispatchEvent(new CustomEvent('civweave:local-model-inference-progress',{detail}))}catch{}
      }
    });
    const result=resultFrom(request,run,started,decision);
    if(result.structured.requested&&!result.structured.valid){
      throw Object.assign(new Error('The downloaded local model did not return valid structured output for this request.'),{code:'LOCAL_MODEL_STRUCTURED_OUTPUT_FAILED',localResult:result});
    }
    return result;
  }catch(error){
    const detail={message:String(error?.message||error),code:error?.code||'LOCAL_MODEL_FAILED',model:spec?.id||downloads()?.selection?.()?.id||'',executionProfile:request.executionProfile||'interactive'};
    try{dispatchEvent(new CustomEvent('civweave:local-model-error',{detail}))}catch{}
    throw error;
  }
}
function patch(){
  const current=globalThis.CivweaveModelRuntime;
  if(!current?.generate)return false;
  if(current===patched)return true;
  if(current.__civweaveLocalBridgeVersion===VERSION){patched=current;return true}
  if(!original){original=current.__civweaveLocalBridgeV266&&priorBridge?.base?.()?priorBridge.base():current}
  else if(current!==patched&&!current.__civweaveLocalBridgeV266)original=current;
  const base=original||current;
  patched=Object.freeze({
    ...current,
    __civweaveLocalBridgeV266:true,
    __civweaveLocalBridgeVersion:VERSION,
    baseVersion:base.version,
    version:`${base.version}+local-v268`,
    generate,
    generateInteractive:request=>generate({...request,executionProfile:'interactive'}),
    generateAgentic:request=>generate({...request,executionProfile:'agentic'}),
  });
  globalThis.CivweaveModelRuntime=patched;
  try{dispatchEvent(new CustomEvent('civweave:local-model-bridge-installed',{detail:{version:VERSION,baseVersion:base.version,selected:downloads()?.selection?.()||null,capabilityAware:Boolean(broker())}}))}catch{}
  return true;
}
addEventListener('civweave:model-runtime-ready',patch);
addEventListener('civweave:local-model-selection',patch);
addEventListener('civweave:cerbanimo-authority-boundary-ready',patch);
addEventListener('pageshow',()=>{if(selected())patch()});
const timer=setInterval(()=>{if(patch())clearInterval(timer)},250);setTimeout(()=>clearInterval(timer),20000);
const api=Object.freeze({version:VERSION,patch,selected,routeDecision,base:()=>original,patched:()=>patched});
globalThis.CivweaveLocalModelBridgeV266=api;
})();
