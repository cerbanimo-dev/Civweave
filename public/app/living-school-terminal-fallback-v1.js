(()=>{
'use strict';
const VERSION='1.0.1-living-school-terminal-fallback-v1-any-3.7-error';
const DESIGN_PURPOSE='living-school-research-grounded-curriculum-v218.1';
const PRIMARY_MODEL='gemini-3.7-flash';
const FALLBACK_MODEL='gemini-3.5-flash';
const FALLBACK_REASON='primary-3.7-error';
const FINALIZER_ID='living-school-terminal-fallback-finalizer-v1';
const HANDLER_ID='living-school-terminal-fallback-handler-v1';
let installed=false,priorRuntime=null,wrappedRuntime=null,fallbackGenerate=null;
const clean=(value,max=64000)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value,260).toLowerCase();
const designRequest=request=>lower(request?.purpose)===DESIGN_PURPOSE;
function providerStatus(value){
  const source=value?.error&&typeof value.error==='object'?value.error:value;
  const status=Number(source?.status??source?.statusCode??source?.httpStatus??source?.http_status??value?.statusCode??value?.httpStatus);
  return Number.isFinite(status)?status:0;
}
function explicitAbort(error,request={}){return Boolean(request?.signal?.aborted||error?.name==='AbortError');}
function primaryFailed(result){return !result||lower(result?.status||'error')!=='success';}
function resultText(result){
  const direct=[result?.outputText,result?.text,result?.output,result?.content,result?.responseText].find(value=>typeof value==='string'&&value.trim());
  if(direct)return String(direct).trim();
  if(result?.outputJson&&typeof result.outputJson==='object')try{return JSON.stringify(result.outputJson)}catch{}
  return'';
}
function errorResult(error,request,model){
  return{schema:'civweave-model-result-1.0',requestId:request?.requestId||`ls-fallback-${Date.now().toString(36)}`,purpose:DESIGN_PURPOSE,status:'provider-error',outputText:'',outputJson:null,requested:{provider:'gemini',model,executionProfile:'interactive'},actual:{provider:'gemini',model},error:{code:clean(error?.code||'GEMINI_PROVIDER_ERROR',160),message:clean(error?.message||error,2400),status:providerStatus(error)||undefined}};
}
function fallbackRequest(request={}){
  return{...request,taskTier:'complex',executionProfile:'interactive',config:{...(request.config||{}),provider:'gemini',route:'gemini',model:FALLBACK_MODEL},context:{...(request.context||{}),livingSchoolTerminalFallback:true,livingSchoolFallbackFrom:PRIMARY_MODEL,livingSchoolFallbackTo:FALLBACK_MODEL,livingSchoolFallbackReason:FALLBACK_REASON}};
}
function finalizeFallbackRequest(request={}){
  if(request?.context?.livingSchoolTerminalFallback!==true)return request;
  const routing=request?.__civweaveGeminiRouting&&typeof request.__civweaveGeminiRouting==='object'?request.__civweaveGeminiRouting:null;
  return{...request,taskTier:'complex',executionProfile:'interactive',config:{...(request.config||{}),provider:'gemini',route:'gemini',model:FALLBACK_MODEL},__civweaveGeminiRouting:routing?{...routing,model:FALLBACK_MODEL,reason:'Living School 3.7 error fallback',fallbackUsed:true,fallbackModel:FALLBACK_MODEL,fallbackReason:FALLBACK_REASON}:routing,context:{...(request.context||{}),livingSchoolTerminalFallback:true,livingSchoolSingleStrongDesign:true}};
}
async function handleFallback(request,ctx){
  if(request?.context?.livingSchoolTerminalFallback!==true)return{handled:false};
  const base=ctx?.baseRuntime;
  if(!base?.generate)return{handled:false};
  const prepared=finalizeFallbackRequest(request);
  try{return{handled:true,result:await base.generate(prepared)}}
  catch(error){if(explicitAbort(error,prepared))throw error;return{handled:true,result:errorResult(error,prepared,FALLBACK_MODEL)}}
}
function primaryFailureDetail(primary){return{status:clean(primary?.status,80)||'error',errorCode:clean(primary?.error?.code,160),httpStatus:providerStatus(primary)||undefined,message:clean(primary?.error?.message,800)};}
function decorate(primary,fallback,request){
  const budget=globalThis.CivweaveLivingSchoolGenerationBudgetV2,count=Math.max(1,Math.min(8,Number(request?.context?.moduleCount||4)||4)),failure=primaryFailureDetail(primary);
  let result={...fallback,requested:primary?.requested||{provider:'gemini',model:PRIMARY_MODEL},actual:{...(fallback?.actual||{}),provider:'gemini',model:clean(fallback?.actual?.model,240)||FALLBACK_MODEL},fallback:{...(fallback?.fallback||{}),used:true,provider:'gemini',fromModel:PRIMARY_MODEL,toModel:FALLBACK_MODEL,reason:FALLBACK_REASON,primaryStatus:failure.status,primaryErrorCode:failure.errorCode,primaryHttpStatus:failure.httpStatus},diagnostics:[...(primary?.diagnostics||[]),...(fallback?.diagnostics||[]),`Gemini 3.7 Flash design failed (${failure.errorCode||failure.status}${failure.httpStatus?` / HTTP ${failure.httpStatus}`:''}); Living School retried the prepared curriculum design once with Gemini 3.5 Flash.`],livingSchoolTerminalFallback:{version:VERSION,primaryModel:PRIMARY_MODEL,fallbackModel:FALLBACK_MODEL,reason:FALLBACK_REASON,primaryFailure:failure,providerCalls:2}};
  if(result?.status==='success'&&typeof budget?.designPacketCheck==='function'){
    const check=budget.designPacketCheck(resultText(result),count);
    if(!check.complete){
      const message=`Living School stopped after the Gemini 3.5 fallback because the design packet was incomplete: ${check.issues.join('; ')}.`;
      result={...result,status:'invalid-response',outputText:'',outputJson:null,error:{code:'LIVING_SCHOOL_FALLBACK_DESIGN_PACKET_INCOMPLETE',message},diagnostics:[...(result.diagnostics||[]),message],livingSchoolDesignCompleteness:{revision:VERSION,complete:false,issues:check.issues,retried:true,designProviderCalls:2,model:FALLBACK_MODEL,fallbackReason:FALLBACK_REASON}};
    }else{
      result={...result,livingSchoolDesignCompleteness:{revision:VERSION,complete:true,retried:true,moduleCount:count,designProviderCalls:2,model:FALLBACK_MODEL,fallbackReason:FALLBACK_REASON}};
    }
  }
  try{dispatchEvent(new CustomEvent('civweave:living-school-gemini-fallback',{detail:{schema:'civweave.living-school.gemini-fallback.v3',version:VERSION,fromModel:PRIMARY_MODEL,toModel:FALLBACK_MODEL,reason:FALLBACK_REASON,primaryFailure:failure,status:clean(result?.status,80)||'unknown',providerCalls:2,at:new Date().toISOString()}}))}catch{}
  return result;
}
async function generate(request={}){
  if(!designRequest(request))return priorRuntime.generate(request);
  let primary;
  try{primary=await priorRuntime.generate(request)}catch(error){if(explicitAbort(error,request))throw error;primary=errorResult(error,{...request,config:{...(request.config||{}),model:PRIMARY_MODEL}},PRIMARY_MODEL)}
  if(!primaryFailed(primary))return primary;
  if(typeof fallbackGenerate!=='function')return primary;
  const fallback=await fallbackGenerate(fallbackRequest(request));
  return decorate(primary,fallback,request);
}
function registerMiddleware(){
  const spine=globalThis.CivweaveFastInteractiveV192;if(!spine?.register)return false;
  spine.unregister?.(FINALIZER_ID);spine.unregister?.(HANDLER_ID);
  spine.register(FINALIZER_ID,{before:finalizeFallbackRequest},-100);
  spine.register(HANDLER_ID,{handle:handleFallback},1000);
  return true;
}
function install(){
  registerMiddleware();
  const budget=globalThis.CivweaveLivingSchoolGenerationBudgetV2,current=globalThis.CivweaveModelRuntime,spine=globalThis.CivweaveFastInteractiveV192?.proxy?.();
  if(!budget?.installed||!current?.generate||!spine?.generate||current?.__livingSchoolTerminalFallbackV1===VERSION)return Boolean(current?.__livingSchoolTerminalFallbackV1===VERSION);
  if(!current?.__livingSchoolGenerationBudgetV2)return false;
  priorRuntime=current;
  fallbackGenerate=spine.generate.bind(spine);
  wrappedRuntime=Object.freeze({...current,generate,__livingSchoolTerminalFallbackV1:VERSION,livingSchoolTerminalFallbackVersion:VERSION});
  try{Object.defineProperty(globalThis,'CivweaveModelRuntime',{configurable:true,enumerable:true,writable:true,value:wrappedRuntime})}catch{globalThis.CivweaveModelRuntime=wrappedRuntime}
  installed=globalThis.CivweaveModelRuntime===wrappedRuntime;
  if(installed)try{document.documentElement.dataset.livingSchoolTerminalFallback=VERSION}catch{}
  if(installed)try{dispatchEvent(new CustomEvent('civweave:living-school-terminal-fallback-ready',{detail:{version:VERSION,primaryModel:PRIMARY_MODEL,fallbackModel:FALLBACK_MODEL,reason:FALLBACK_REASON,anyPrimaryError:true,terminalOwner:true,pinnedSpineGenerator:true,at:new Date().toISOString()}}))}catch{}
  return installed;
}
function schedule(){queueMicrotask(install);setTimeout(install,0);setTimeout(install,120)}
for(const event of ['civweave:living-school-generation-budget-ready','civweave:runtime-spine-ready','civweave:assistant-runtime-ready','pageshow'])addEventListener?.(event,schedule);
registerMiddleware();schedule();
globalThis.CivweaveLivingSchoolTerminalFallbackV1=Object.freeze({version:VERSION,install,registerMiddleware,primaryFailed,fallbackRequest,finalizeFallbackRequest,get installed(){return installed},get runtime(){return wrappedRuntime},primaryModel:PRIMARY_MODEL,fallbackModel:FALLBACK_MODEL,reason:FALLBACK_REASON,anyPrimaryError:true,pinnedSpineGenerator:true});
})();