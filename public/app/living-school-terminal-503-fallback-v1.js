(()=>{
'use strict';
const VERSION='1.0.0-living-school-terminal-503-fallback-v1';
const DESIGN_PURPOSE='living-school-research-grounded-curriculum-v218.1';
const PRIMARY_MODEL='gemini-3.7-flash';
const FALLBACK_MODEL='gemini-3.5-flash';
const FINALIZER_ID='living-school-terminal-503-fallback-finalizer-v1';
const HANDLER_ID='living-school-terminal-503-fallback-handler-v1';
let installed=false,priorRuntime=null,wrappedRuntime=null;
const clean=(value,max=64000)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value,260).toLowerCase();
const designRequest=request=>lower(request?.purpose)===DESIGN_PURPOSE;
function providerStatus(value){
  const source=value?.error&&typeof value.error==='object'?value.error:value;
  const status=Number(source?.status??source?.statusCode??source?.httpStatus??source?.http_status??value?.statusCode??value?.httpStatus);
  return Number.isFinite(status)?status:0;
}
function highDemand503(value){
  const source=value?.error&&typeof value.error==='object'?value.error:value,status=providerStatus(value),text=lower([source?.code,source?.message,value?.message].filter(Boolean).join(' '));
  return status===503||/\bhttp\s*503\b/.test(text)||(/\b503\b/.test(text)&&/(?:high demand|unavailable|temporar)/.test(text))||(/\bunavailable\b/.test(text)&&/high demand/.test(text));
}
function resultText(result){
  const direct=[result?.outputText,result?.text,result?.output,result?.content,result?.responseText].find(value=>typeof value==='string'&&value.trim());
  if(direct)return String(direct).trim();
  if(result?.outputJson&&typeof result.outputJson==='object')try{return JSON.stringify(result.outputJson)}catch{}
  return'';
}
function providerError(error,request){
  return{schema:'civweave-model-result-1.0',requestId:request?.requestId||`ls-503-fallback-${Date.now().toString(36)}`,purpose:DESIGN_PURPOSE,status:'provider-error',outputText:'',outputJson:null,requested:{provider:'gemini',model:FALLBACK_MODEL,executionProfile:'interactive'},actual:{provider:'gemini',model:FALLBACK_MODEL},error:{code:clean(error?.code||'GEMINI_PROVIDER_ERROR',160),message:clean(error?.message||error,2400),status:providerStatus(error)||undefined}};
}
function fallbackRequest(request={}){
  return{...request,taskTier:'complex',executionProfile:'interactive',config:{...(request.config||{}),provider:'gemini',route:'gemini',model:FALLBACK_MODEL},context:{...(request.context||{}),livingSchoolTerminal503Fallback:true,livingSchool503FallbackFrom:PRIMARY_MODEL,livingSchool503FallbackTo:FALLBACK_MODEL,livingSchool503FallbackReason:'http-503-high-demand'}};
}
function finalizeFallbackRequest(request={}){
  if(request?.context?.livingSchoolTerminal503Fallback!==true)return request;
  const routing=request?.__civweaveGeminiRouting&&typeof request.__civweaveGeminiRouting==='object'?request.__civweaveGeminiRouting:null;
  return{...request,taskTier:'complex',executionProfile:'interactive',config:{...(request.config||{}),provider:'gemini',route:'gemini',model:FALLBACK_MODEL},__civweaveGeminiRouting:routing?{...routing,model:FALLBACK_MODEL,reason:'Living School HTTP 503 fallback',fallbackUsed:true,fallbackModel:FALLBACK_MODEL,fallbackReason:'http-503-high-demand'}:routing,context:{...(request.context||{}),livingSchoolTerminal503Fallback:true,livingSchoolSingleStrongDesign:true}};
}
async function handleFallback(request,ctx){
  if(request?.context?.livingSchoolTerminal503Fallback!==true)return{handled:false};
  const base=ctx?.baseRuntime;
  if(!base?.generate)return{handled:false};
  const prepared=finalizeFallbackRequest(request);
  try{return{handled:true,result:await base.generate(prepared)}}
  catch(error){return{handled:true,result:providerError(error,prepared)}}
}
function decorate(primary,fallback,request){
  const budget=globalThis.CivweaveLivingSchoolGenerationBudgetV2,count=Math.max(1,Math.min(8,Number(request?.context?.moduleCount||4)||4));
  let result={...fallback,requested:primary?.requested||{provider:'gemini',model:PRIMARY_MODEL},actual:{...(fallback?.actual||{}),provider:'gemini',model:clean(fallback?.actual?.model,240)||FALLBACK_MODEL},fallback:{...(fallback?.fallback||{}),used:true,provider:'gemini',fromModel:PRIMARY_MODEL,toModel:FALLBACK_MODEL,reason:'http-503-high-demand'},diagnostics:[...(primary?.diagnostics||[]),...(fallback?.diagnostics||[]),'Gemini 3.7 Flash returned HTTP 503/high demand; the terminal Living School runtime retried the prepared curriculum design once with Gemini 3.5 Flash.'],livingSchoolTerminalFallback:{version:VERSION,primaryModel:PRIMARY_MODEL,fallbackModel:FALLBACK_MODEL,reason:'http-503-high-demand',providerCalls:2}};
  if(result?.status==='success'&&typeof budget?.designPacketCheck==='function'){
    const check=budget.designPacketCheck(resultText(result),count);
    if(!check.complete){
      const message=`Living School stopped after the Gemini 3.5 fallback because the design packet was incomplete: ${check.issues.join('; ')}.`;
      result={...result,status:'invalid-response',outputText:'',outputJson:null,error:{code:'LIVING_SCHOOL_FALLBACK_DESIGN_PACKET_INCOMPLETE',message},diagnostics:[...(result.diagnostics||[]),message],livingSchoolDesignCompleteness:{revision:VERSION,complete:false,issues:check.issues,retried:true,designProviderCalls:2,model:FALLBACK_MODEL,fallbackReason:'http-503-high-demand'}};
    }else{
      result={...result,livingSchoolDesignCompleteness:{revision:VERSION,complete:true,retried:true,moduleCount:count,designProviderCalls:2,model:FALLBACK_MODEL,fallbackReason:'http-503-high-demand'}};
    }
  }
  try{dispatchEvent(new CustomEvent('civweave:living-school-gemini-fallback',{detail:{schema:'civweave.living-school.gemini-fallback.v2',version:VERSION,fromModel:PRIMARY_MODEL,toModel:FALLBACK_MODEL,reason:'http-503-high-demand',status:clean(result?.status,80)||'unknown',providerCalls:2,at:new Date().toISOString()}}))}catch{}
  return result;
}
async function generate(request={}){
  if(!designRequest(request))return priorRuntime.generate(request);
  const primary=await priorRuntime.generate(request);
  if(!highDemand503(primary))return primary;
  const spine=globalThis.CivweaveFastInteractiveV192?.proxy?.();
  if(!spine?.generate)return primary;
  const fallback=await spine.generate(fallbackRequest(request));
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
  const budget=globalThis.CivweaveLivingSchoolGenerationBudgetV2,current=globalThis.CivweaveModelRuntime;
  if(!budget?.installed||!current?.generate||current?.__livingSchoolTerminal503FallbackV1===VERSION)return Boolean(current?.__livingSchoolTerminal503FallbackV1===VERSION);
  if(!current?.__livingSchoolGenerationBudgetV2)return false;
  priorRuntime=current;
  wrappedRuntime=Object.freeze({...current,generate,__livingSchoolTerminal503FallbackV1:VERSION,livingSchoolTerminal503FallbackVersion:VERSION});
  try{Object.defineProperty(globalThis,'CivweaveModelRuntime',{configurable:true,enumerable:true,writable:true,value:wrappedRuntime})}catch{globalThis.CivweaveModelRuntime=wrappedRuntime}
  installed=globalThis.CivweaveModelRuntime===wrappedRuntime;
  if(installed)try{document.documentElement.dataset.livingSchoolTerminal503Fallback=VERSION}catch{}
  if(installed)try{dispatchEvent(new CustomEvent('civweave:living-school-terminal-503-fallback-ready',{detail:{version:VERSION,primaryModel:PRIMARY_MODEL,fallbackModel:FALLBACK_MODEL,reason:'http-503-high-demand',terminalOwner:true,at:new Date().toISOString()}}))}catch{}
  return installed;
}
function schedule(){queueMicrotask(install);setTimeout(install,0);setTimeout(install,120)}
for(const event of ['civweave:living-school-generation-budget-ready','civweave:runtime-spine-ready','civweave:assistant-runtime-ready','pageshow'])addEventListener?.(event,schedule);
registerMiddleware();schedule();
globalThis.CivweaveLivingSchoolTerminal503FallbackV1=Object.freeze({version:VERSION,install,registerMiddleware,highDemand503,fallbackRequest,finalizeFallbackRequest,get installed(){return installed},get runtime(){return wrappedRuntime},primaryModel:PRIMARY_MODEL,fallbackModel:FALLBACK_MODEL,reason:'http-503-high-demand'});
})();