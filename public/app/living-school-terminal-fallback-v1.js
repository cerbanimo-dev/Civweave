(()=>{
'use strict';
const VERSION='1.1.0-living-school-terminal-fallback-v1-single-owner';
const DESIGN_PURPOSE='living-school-research-grounded-curriculum-v218.1';
const PRIMARY_MODEL='gemini-3.7-flash';
const FALLBACK_MODEL='gemini-3.5-flash';
const FALLBACK_REASON='primary-3.7-error';
let installed=false,priorRuntime=null,wrappedRuntime=null,fallbackGenerate=null,sequence=0;
const clean=(value,max=64000)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value,260).toLowerCase();
const designRequest=request=>lower(request?.purpose)===DESIGN_PURPOSE;
function providerStatus(value){
  const source=value?.error&&typeof value.error==='object'?value.error:value;
  const status=Number(source?.status??source?.statusCode??source?.httpStatus??source?.http_status??value?.statusCode??value?.httpStatus);
  return Number.isFinite(status)?status:0;
}
function explicitAbort(error,request={}){return Boolean(request?.signal?.aborted||error?.name==='AbortError'||lower(error?.code)==='cancelled');}
function primaryFailed(result){return !result||!['success','fallback'].includes(lower(result?.status||'error'));}
function actualModel(result={}){return lower(result?.actual?.model||result?.model||result?.requested?.model||'')}
function alreadyCompleted35Fallback(result={}){return result?.fallback?.used===true&&actualModel(result)===FALLBACK_MODEL;}
function resultText(result){
  const direct=[result?.outputText,result?.text,result?.output,result?.content,result?.responseText].find(value=>typeof value==='string'&&value.trim());
  if(direct)return String(direct).trim();
  if(result?.outputJson&&typeof result.outputJson==='object')try{return JSON.stringify(result.outputJson)}catch{}
  return'';
}
function errorResult(error,request,model){
  return{schema:'civweave-model-result-1.0',requestId:request?.requestId||`ls-fallback-${Date.now().toString(36)}`,purpose:DESIGN_PURPOSE,status:'provider-error',outputText:'',outputJson:null,requested:{provider:'gemini',model,executionProfile:'interactive'},actual:{provider:'gemini',model},error:{code:clean(error?.code||'GEMINI_PROVIDER_ERROR',160),message:clean(error?.message||error,2400),status:providerStatus(error)||undefined}};
}
function primaryRequest(request={}){
  return{...request,taskTier:'complex',context:{...(request.context||{}),livingSchoolSingleStrongDesign:false,livingSchoolTerminalPrimary:true,livingSchoolTerminalFallbackOwner:VERSION}};
}
function fallbackRequest(request={}){
  return{...request,taskTier:'complex',executionProfile:'interactive',config:{...(request.config||{}),provider:'gemini',route:'gemini',model:FALLBACK_MODEL},context:{...(request.context||{}),livingSchoolTerminalFallback:true,livingSchoolFallbackFrom:PRIMARY_MODEL,livingSchoolFallbackTo:FALLBACK_MODEL,livingSchoolFallbackReason:FALLBACK_REASON,livingSchoolTerminalFallbackOwner:VERSION}};
}
function prepareFallbackForBase(request={}){
  let prepared=fallbackRequest(request);
  const routeLock=globalThis.CivweaveLivingSchoolRouteLockV1;
  const runtimeRoute=globalThis.CivweaveLivingSchoolRuntimeRouteV2||globalThis.CivweaveLivingSchoolRuntimeRouteV1;
  try{if(typeof routeLock?.route==='function')prepared=routeLock.route(prepared)||prepared}catch{}
  try{if(typeof runtimeRoute?.prepare==='function')prepared=runtimeRoute.prepare(prepared)||prepared}catch{}
  try{if(typeof routeLock?.postRouter==='function')prepared=routeLock.postRouter(prepared)||prepared}catch{}
  const routing=prepared?.__civweaveGeminiRouting&&typeof prepared.__civweaveGeminiRouting==='object'?prepared.__civweaveGeminiRouting:null;
  return{...prepared,taskTier:'complex',executionProfile:'interactive',config:{...(prepared.config||{}),provider:'gemini',route:'gemini',model:FALLBACK_MODEL},__civweaveGeminiRouting:routing?{...routing,model:FALLBACK_MODEL,reason:'Living School terminal 3.5 fallback',fallbackUsed:true,fallbackModel:FALLBACK_MODEL,fallbackReason:FALLBACK_REASON}:routing,context:{...(prepared.context||{}),livingSchoolTerminalFallback:true,livingSchoolSingleStrongDesign:false,livingSchoolFallbackDirectBase:true,livingSchoolFallbackModelLocked:FALLBACK_MODEL,livingSchoolTerminalFallbackOwner:VERSION}};
}
function fallbackCallMeta(request={}){
  const callId=`ls-gemini-35-fallback-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
  return{schema:'civweave.gemini-task-routing.v3',version:VERSION,callId,tier:'fallback',reason:'Gemini 3.7 design failed; direct Gemini 3.5 fallback',model:FALLBACK_MODEL,smallModel:'gemini-3.1-flash-lite',researchFallbackModel:FALLBACK_MODEL,complexModel:PRIMARY_MODEL,purpose:DESIGN_PURPOSE,startedAtMs:Date.now(),at:new Date().toISOString(),fallbackFromModel:PRIMARY_MODEL,fallbackReason:FALLBACK_REASON};
}
function emitSelected(meta){try{dispatchEvent(new CustomEvent('civweave:gemini-task-tier-selected',{detail:meta}))}catch{}}
function emitCompleted(meta,result){try{dispatchEvent(new CustomEvent('civweave:gemini-task-tier-completed',{detail:{...meta,status:clean(result?.status,80)||'unknown',completedAtMs:Date.now(),completedAt:new Date().toISOString(),errorCode:clean(result?.error?.code,160)}}))}catch{}}
function primaryFailureDetail(primary){return{status:clean(primary?.status,80)||'error',errorCode:clean(primary?.error?.code,160),httpStatus:providerStatus(primary)||undefined,message:clean(primary?.error?.message,800)};}
function decorate(primary,fallback,request){
  const budget=globalThis.CivweaveLivingSchoolGenerationBudgetV2,count=Math.max(1,Math.min(8,Number(request?.context?.moduleCount||4)||4)),failure=primaryFailureDetail(primary);
  let result={...fallback,requested:primary?.requested||{provider:'gemini',model:PRIMARY_MODEL},actual:{...(fallback?.actual||{}),provider:'gemini',model:clean(fallback?.actual?.model,240)||FALLBACK_MODEL},fallback:{...(fallback?.fallback||{}),used:true,provider:'gemini',fromModel:PRIMARY_MODEL,toModel:FALLBACK_MODEL,reason:FALLBACK_REASON,primaryStatus:failure.status,primaryErrorCode:failure.errorCode,primaryHttpStatus:failure.httpStatus},diagnostics:[...(primary?.diagnostics||[]),...(fallback?.diagnostics||[]),`Gemini 3.7 Flash design failed (${failure.errorCode||failure.status}${failure.httpStatus?` / HTTP ${failure.httpStatus}`:''}); Living School made one direct Gemini 3.5 Flash fallback call without re-entering the shared model router.`],livingSchoolTerminalFallback:{version:VERSION,primaryModel:PRIMARY_MODEL,fallbackModel:FALLBACK_MODEL,reason:FALLBACK_REASON,primaryFailure:failure,providerCalls:2,directBase:true,singleOwner:true}};
  if(result?.status==='success'&&typeof budget?.designPacketCheck==='function'){
    const check=budget.designPacketCheck(resultText(result),count);
    if(!check.complete){
      const message=`Living School stopped after the Gemini 3.5 fallback because the design packet was incomplete: ${check.issues.join('; ')}.`;
      result={...result,status:'invalid-response',outputText:'',outputJson:null,error:{code:'LIVING_SCHOOL_FALLBACK_DESIGN_PACKET_INCOMPLETE',message},diagnostics:[...(result.diagnostics||[]),message],livingSchoolDesignCompleteness:{revision:VERSION,complete:false,issues:check.issues,retried:true,designProviderCalls:2,model:FALLBACK_MODEL,fallbackReason:FALLBACK_REASON}};
    }else{
      result={...result,livingSchoolDesignCompleteness:{revision:VERSION,complete:true,retried:true,moduleCount:count,designProviderCalls:2,model:FALLBACK_MODEL,fallbackReason:FALLBACK_REASON}};
    }
  }
  try{dispatchEvent(new CustomEvent('civweave:living-school-gemini-fallback',{detail:{schema:'civweave.living-school.gemini-fallback.v5',version:VERSION,fromModel:PRIMARY_MODEL,toModel:FALLBACK_MODEL,reason:FALLBACK_REASON,primaryFailure:failure,status:clean(result?.status,80)||'unknown',providerCalls:2,directBase:true,singleOwner:true,at:new Date().toISOString()}}))}catch{}
  return result;
}
async function generate(request={}){
  if(!designRequest(request))return priorRuntime.generate(request);
  let primary;
  const preparedPrimary=primaryRequest(request);
  try{primary=await priorRuntime.generate(preparedPrimary)}catch(error){if(explicitAbort(error,preparedPrimary))throw error;primary=errorResult(error,{...preparedPrimary,config:{...(preparedPrimary.config||{}),model:PRIMARY_MODEL}},PRIMARY_MODEL)}
  if(!primaryFailed(primary))return primary;
  if(explicitAbort(primary?.error||{},preparedPrimary))return primary;
  if(alreadyCompleted35Fallback(primary))return primary;
  if(typeof fallbackGenerate!=='function')return primary;
  const prepared=prepareFallbackForBase(request),meta=fallbackCallMeta(prepared);
  emitSelected(meta);
  let fallback;
  try{fallback=await fallbackGenerate(prepared)}catch(error){if(explicitAbort(error,prepared))throw error;fallback=errorResult(error,prepared,FALLBACK_MODEL)}
  emitCompleted(meta,fallback);
  return decorate(primary,fallback,request);
}
function install(){
  const budget=globalThis.CivweaveLivingSchoolGenerationBudgetV2,current=globalThis.CivweaveModelRuntime,base=globalThis.CivweaveFastInteractiveV192?.base?.();
  if(!budget?.installed||!current?.generate||!base?.generate||current?.__livingSchoolTerminalFallbackV1===VERSION)return Boolean(current?.__livingSchoolTerminalFallbackV1===VERSION);
  if(!current?.__livingSchoolGenerationBudgetV2)return false;
  priorRuntime=current;
  fallbackGenerate=base.generate.bind(base);
  wrappedRuntime=Object.freeze({...current,generate,__livingSchoolTerminalFallbackV1:VERSION,livingSchoolTerminalFallbackVersion:VERSION});
  try{Object.defineProperty(globalThis,'CivweaveModelRuntime',{configurable:true,enumerable:true,writable:true,value:wrappedRuntime})}catch{globalThis.CivweaveModelRuntime=wrappedRuntime}
  installed=globalThis.CivweaveModelRuntime===wrappedRuntime;
  if(installed)try{document.documentElement.dataset.livingSchoolTerminalFallback=VERSION}catch{}
  if(installed)try{dispatchEvent(new CustomEvent('civweave:living-school-terminal-fallback-ready',{detail:{version:VERSION,primaryModel:PRIMARY_MODEL,fallbackModel:FALLBACK_MODEL,reason:FALLBACK_REASON,anyPrimaryError:true,terminalOwner:true,directBase:true,singleOwner:true,at:new Date().toISOString()}}))}catch{}
  return installed;
}
function schedule(){queueMicrotask(install);setTimeout(install,0);setTimeout(install,120)}
for(const event of ['civweave:living-school-generation-budget-ready','civweave:runtime-spine-ready','civweave:assistant-runtime-ready','pageshow'])addEventListener?.(event,schedule);
schedule();
globalThis.CivweaveLivingSchoolTerminalFallbackV1=Object.freeze({version:VERSION,install,primaryFailed,primaryRequest,fallbackRequest,prepareFallbackForBase,get installed(){return installed},get runtime(){return wrappedRuntime},primaryModel:PRIMARY_MODEL,fallbackModel:FALLBACK_MODEL,reason:FALLBACK_REASON,anyPrimaryError:true,directBase:true,singleOwner:true});
})();