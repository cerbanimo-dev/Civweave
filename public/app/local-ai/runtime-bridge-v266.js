(()=>{
'use strict';
const VERSION='1.0.73-local-ai-bridge-v275-backend-fallback';
if(globalThis.CivweaveLocalModelBridgeV266?.version===VERSION)return;
const MIDDLEWARE_ID='downloaded-local-v275';
const priorBridge=globalThis.CivweaveLocalModelBridgeV266;
let original=priorBridge?.base?.()||null,patched=null,registered=false;
const downloads=()=>globalThis.CivweaveLocalModelDownloadV266;
const local=()=>globalThis.CivweaveLocalModelRuntimeV266;
const broker=()=>globalThis.CivweaveAICapabilityBrokerV268;
const spine=()=>globalThis.CivweaveFastInteractiveV192;
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
function wantsStream(request={}){return Boolean(request.config?.stream??request.stream)}
function resultFrom(request,run,started,decision,requestId,events){
  const spec=local().activeSpec();
  const structuredRequested=Boolean(request.schema||request.responseFormat==='json'||request.responseFormat==='structured');
  const backend=run.backend||'unknown',fallbackUsed=Boolean(run.fallbackUsed);
  return{
    schema:'civweave-model-result-1.0',requestId,purpose:String(request?.purpose||'interactive'),status:'success',
    requested:{provider:'downloaded-local',model:spec?.id||'local-model',endpoint:'',executionProfile:request?.executionProfile||'interactive'},actual:{provider:'downloaded-local',model:run.executionId||spec?.id||'local-model',backend},
    outputText:run.text||'',outputJson:run.json||null,usage:{inputTokens:0,outputTokens:0,totalTokens:0,costCents:0,remainingCents:0},
    timing:{startedAt:new Date(Date.now()-(performance.now()-started)).toISOString(),completedAt:new Date().toISOString(),elapsedMs:run.elapsedMs||Math.round(performance.now()-started)},events:events.slice(-120),
    diagnostics:[{code:'LOCAL_MODEL',message:'Generated entirely on this device from downloaded model artifacts.'},{code:'CAPABILITY_ROUTE',message:decision.reason,requirements:decision.requirements||null},{code:'LOCAL_BACKEND',message:fallbackUsed?`WebGPU was unavailable; Civweave used ${run.executionLabel||run.executionId||'the compatibility model'} through ${backend}.`:`Downloaded-local inference used ${backend}.`},{code:'LOCAL_STREAMING',message:run.streamed?'Downloaded-local text was streamed incrementally from the local inference worker.':'Downloaded-local generation returned as one completed result.'}],
    stream:{requested:wantsStream(request),used:Boolean(run.streamed)},structured:{requested:structuredRequested,valid:!structuredRequested||Boolean(run.json),repairAttempts:0},
    capabilityRouting:{schema:'civweave.ai-capability-route.v1',route:'downloaded-local',reason:decision.reason,requirements:decision.requirements||null},
  };
}
async function runLocal(request,spec,decision){
  const started=performance.now(),requestId=`local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,events=[];let accumulated='';
  const emit=(phase,detail={})=>{const event={schema:'civweave-model-event-1.0',requestId,phase,provider:'downloaded-local',model:spec.id,purpose:String(request?.purpose||'interactive'),executionProfile:request.executionProfile||'interactive',at:new Date().toISOString(),...detail};events.push(event);try{request.onEvent?.(event)}catch{}try{dispatchEvent(new CustomEvent('civweave:model-event',{detail:event}))}catch{}return event};
  try{
    const run=await local().generate({messages:request.messages||[],maxNewTokens:request.config?.maxTokens||request.maxTokens||1024,temperature:request.config?.temperature??request.temperature??.2,timeoutMs:timeoutFor(spec,request),stream:wantsStream(request),executionProfile:request.executionProfile||'interactive',onToken:token=>{const text=String(token?.text||'');if(!text)return;accumulated+=text;const event=emit('partial',{text,accumulatedText:accumulated,index:Number(token?.index)||0});try{dispatchEvent(new CustomEvent('civweave:local-model-token',{detail:event}))}catch{}},onProgress:progress=>{const detail={phase:'local-model-progress',provider:'downloaded-local',model:spec.id,executionProfile:request.executionProfile||'interactive',...progress};try{request.onProgress?.(detail)}catch{}try{dispatchEvent(new CustomEvent('civweave:local-model-inference-progress',{detail}))}catch{}}});
    const result=resultFrom(request,run,started,decision,requestId,events);
    if(result.structured.requested&&!result.structured.valid)throw Object.assign(new Error('The downloaded local model did not return valid structured output for this request.'),{code:'LOCAL_MODEL_STRUCTURED_OUTPUT_FAILED',localResult:result});
    return result;
  }catch(error){const detail={message:String(error?.message||error),code:error?.code||'LOCAL_MODEL_FAILED',model:spec?.id||downloads()?.selection?.()?.id||'',executionProfile:request.executionProfile||'interactive'};try{dispatchEvent(new CustomEvent('civweave:local-model-error',{detail}))}catch{}throw error;}
}
function middleware(){return{async handle(request){
  if(!selected())return null;
  const spec=local()?.activeSpec?.();
  if(!spec)throw Object.assign(new Error('A downloaded local model is selected, but its runtime has not attached yet.'),{code:'LOCAL_MODEL_NOT_READY'});
  const decision=routeDecision(request,spec);
  if(!decision.useLocal){try{dispatchEvent(new CustomEvent('civweave:local-model-route-skipped',{detail:{model:spec.id,reason:decision.reason,requirements:decision.requirements}}))}catch{}return null;}
  try{return{handled:true,result:await runLocal(request,spec,decision)}}catch(error){if(error?.code==='LOCAL_BACKEND_CAPABILITY_UNAVAILABLE'){try{dispatchEvent(new CustomEvent('civweave:local-model-route-skipped',{detail:{model:spec.id,reason:String(error.message||error),requirements:decision.requirements,backendUnavailable:true}}))}catch{}return null}throw error;}
}};}
function register(){
  const runtimeSpine=spine();
  if(!runtimeSpine?.register)return false;
  runtimeSpine.register(MIDDLEWARE_ID,middleware(),100);
  registered=true;patched=runtimeSpine.proxy?.()||globalThis.CivweaveModelRuntime;original=runtimeSpine.base?.()||original;
  try{dispatchEvent(new CustomEvent('civweave:local-model-bridge-installed',{detail:{version:VERSION,mode:'runtime-spine',middleware:MIDDLEWARE_ID,selected:downloads()?.selection?.()||null,capabilityAware:Boolean(broker()),streaming:true,backendFallback:true}}))}catch{}
  return true;
}
async function legacyGenerate(request={}){
  if(!selected())return original.generate(request);
  const spec=local()?.activeSpec?.();if(!spec)throw Object.assign(new Error('A downloaded local model is selected, but its runtime has not attached yet.'),{code:'LOCAL_MODEL_NOT_READY'});
  const decision=routeDecision(request,spec);if(!decision.useLocal)return original.generate(request);try{return await runLocal(request,spec,decision)}catch(error){if(error?.code==='LOCAL_BACKEND_CAPABILITY_UNAVAILABLE')return original.generate(request);throw error;}
}
function patchLegacy(){
  if(register())return true;
  const current=globalThis.CivweaveModelRuntime;if(!current?.generate)return false;if(current===patched)return true;
  if(!original)original=current;
  const base=original||current;
  patched=Object.freeze({...current,__civweaveLocalBridgeV266:true,__civweaveLocalBridgeVersion:VERSION,baseVersion:base.version,version:`${base.version}+local-v275`,generate:legacyGenerate,generateInteractive:request=>legacyGenerate({...request,executionProfile:'interactive'}),generateAgentic:request=>legacyGenerate({...request,executionProfile:'agentic'})});
  globalThis.CivweaveModelRuntime=patched;
  try{dispatchEvent(new CustomEvent('civweave:local-model-bridge-installed',{detail:{version:VERSION,mode:'legacy-wrapper-fallback',baseVersion:base.version,selected:downloads()?.selection?.()||null,capabilityAware:Boolean(broker()),streaming:true,backendFallback:true}}))}catch{}
  return true;
}
function patch(){return register()||patchLegacy();}
addEventListener('civweave:runtime-spine-ready',register);
addEventListener('civweave:model-runtime-ready',patch);
addEventListener('civweave:local-model-selection',patch);
addEventListener('civweave:cerbanimo-authority-boundary-ready',patch);
addEventListener('pageshow',patch);
patch();
const api=Object.freeze({version:VERSION,patch,register,selected,routeDecision,middlewareId:MIDDLEWARE_ID,base:()=>original,patched:()=>patched,get registered(){return registered;},streaming:true,backendFallback:true});
globalThis.CivweaveLocalModelBridgeV266=api;
})();
