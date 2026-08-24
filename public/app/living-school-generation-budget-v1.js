(()=>{
'use strict';
const VERSION='1.5.0-living-school-generation-budget-v1-interactive-timeout';
const DESIGN_PURPOSE='living-school-research-grounded-curriculum-v218.1';
const STRUCTURE_PURPOSE='living-school-structure-single-v221';
const QUIZ_PURPOSE='living-school-quiz-delta-completion-v258';
const QUIZ_REPAIR_PURPOSE='living-school-quiz-question-contract-repair-v263';
const DEPTH_PURPOSE='living-school-module-depth-expansion-v262';
const DESIGN_TIMEOUT_MS=90000;
const stats={designCalls:0,designCompletionRetries:0,designTimeouts:0,structureCompiles:0,quizCallsBlocked:0,repairCallsBlocked:0,depthCallsBlocked:0,filteredSourceNoise:0,outerRewraps:0,installedAt:'',lastBlockedAt:''};
let wrappedRuntime=null;
const clean=(value,max=64000)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value,240).toLowerCase();
const livingSchoolPurpose=purpose=>/^living-school-/.test(lower(purpose));
const designPurpose=purpose=>lower(purpose)===DESIGN_PURPOSE;
function publish(){
  try{
    const root=document.documentElement;
    root.dataset.livingSchoolGenerationBudget=VERSION;
    root.dataset.livingSchoolDesignCalls=String(stats.designCalls);
    root.dataset.livingSchoolDesignTimeouts=String(stats.designTimeouts);
    root.dataset.livingSchoolStructureCompiles=String(stats.structureCompiles);
    root.dataset.livingSchoolQuizCallsBlocked=String(stats.quizCallsBlocked);
    root.dataset.livingSchoolRepairCallsBlocked=String(stats.repairCallsBlocked);
    root.dataset.livingSchoolDepthCallsBlocked=String(stats.depthCallsBlocked);
    root.dataset.livingSchoolFilteredSourceNoise=String(stats.filteredSourceNoise);
    root.dataset.livingSchoolBudgetOuter=globalThis.CivweaveModelRuntime===wrappedRuntime?'true':'false';
  }catch{}
}
function blocked(request,kind,message){
  if(kind==='quiz')stats.quizCallsBlocked+=1;
  else if(kind==='depth')stats.depthCallsBlocked+=1;
  else stats.repairCallsBlocked+=1;
  stats.lastBlockedAt=new Date().toISOString();publish();
  return{
    schema:'civweave-model-result-1.0',requestId:request?.requestId||`ls-budget-${Date.now().toString(36)}`,purpose:clean(request?.purpose,180),status:'error',outputText:'',outputJson:null,
    usage:{inputTokens:0,outputTokens:0,totalTokens:0,costCents:0,remainingCents:0},stream:{requested:false,used:false},
    actual:{provider:'civweave',model:'living-school-generation-budget'},
    error:{code:'LIVING_SCHOOL_HIDDEN_PROVIDER_CALL_BLOCKED',message},
    diagnostics:[message],livingSchoolGenerationBudget:{version:VERSION,kind,blocked:true,at:stats.lastBlockedAt}
  };
}
function looksLikeIndexNoise(source){
  const text=clean(source?.notes||source?.content,6000);
  if(!text)return true;
  const words=text.match(/[A-Za-z]{3,}/g)||[],tiny=text.match(/(?:^|\s)[A-Za-z0-9]{1,2}(?=\s|$)/g)||[],odd=text.match(/[^\x20-\x7E\r\n\t]/g)||[],symbol=text.match(/[+%#{}\\|]/g)||[],indexTerms=text.match(/\b(?:identifier|ISBN|ISSN|JSTOR|Bibcode|Academic Press|Publishing|Journal|University Press)\b/gi)||[];
  return words.length<24||(tiny.length>=14&&(odd.length+symbol.length)>=12)||(indexTerms.length>=4&&tiny.length>=8);
}
function cleanDesignSources(request){
  if(!designPurpose(request?.purpose))return request;
  const context=request?.context&&typeof request.context==='object'?request.context:{},sources=Array.isArray(context.sources)?context.sources:[];
  if(!sources.length)return request;
  const kept=sources.filter(source=>!looksLikeIndexNoise(source)),removed=sources.length-kept.length;
  if(!removed)return request;
  stats.filteredSourceNoise+=removed;publish();
  return{...request,context:{...context,sources:kept,sourceNoiseFilter:{revision:VERSION,input:sources.length,kept:kept.length,removed}}};
}
function boundedRequest(request){
  const strong=designPurpose(request?.purpose),living=livingSchoolPurpose(request?.purpose),prepared=strong?cleanDesignSources(request):request;
  return{...prepared,maxRepairAttempts:0,taskTier:strong?'complex':living?'small':prepared?.taskTier,executionProfile:'interactive',context:{...(prepared?.context||{}),automaticRepairBudget:0,generationBudgetRevision:VERSION,designTimeoutMs:strong?DESIGN_TIMEOUT_MS:prepared?.context?.designTimeoutMs}};
}
function resultText(result){
  const direct=[result?.outputText,result?.text,result?.output,result?.content,result?.responseText].find(value=>typeof value==='string'&&value.trim());
  if(direct)return String(direct).trim();
  if(result?.outputJson&&typeof result.outputJson==='object')try{return JSON.stringify(result.outputJson)}catch{}
  return'';
}
function designTimeoutResult(request,attempt){
  const message=`Living School stopped the design pass after ${Math.round(DESIGN_TIMEOUT_MS/1000)} seconds instead of leaving regeneration stuck. Retry the design pass when the selected provider is responsive.`;
  return{
    schema:'civweave-model-result-1.0',requestId:request?.requestId||`ls-design-timeout-${Date.now().toString(36)}`,purpose:DESIGN_PURPOSE,status:'error',outputText:'',outputJson:null,
    usage:{inputTokens:0,outputTokens:0,totalTokens:0,costCents:0,remainingCents:0},stream:{requested:false,used:false},
    actual:{provider:'civweave',model:'living-school-design-timeout'},
    error:{code:'LIVING_SCHOOL_DESIGN_TIMEOUT',message},diagnostics:[message],livingSchoolGenerationBudget:{version:VERSION,designTimeout:true,attempt,timeoutMs:DESIGN_TIMEOUT_MS}
  };
}
async function runDesignCall(original,request,attempt){
  const controller=new AbortController(),parent=request?.signal;
  let timedOut=false,timer=0;
  const forwardAbort=()=>{try{controller.abort(parent?.reason)}catch{}};
  try{parent?.addEventListener?.('abort',forwardAbort,{once:true})}catch{}
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>{
    timedOut=true;stats.designTimeouts+=1;publish();
    try{controller.abort(new DOMException('Living School design timeout','AbortError'))}catch{try{controller.abort()}catch{}}
    resolve(designTimeoutResult(request,attempt));
  },DESIGN_TIMEOUT_MS)});
  const call=Promise.resolve().then(()=>original({...request,signal:controller.signal})).catch(error=>{
    if(timedOut)return designTimeoutResult(request,attempt);
    throw error;
  });
  try{return await Promise.race([call,timeout])}
  finally{clearTimeout(timer);try{parent?.removeEventListener?.('abort',forwardAbort)}catch{}}
}
function designPacketCheck(text,count){
  const source=String(text||''),sections=[],re=/^#{1,6}\s*Module\s+(\d+)\s*(?:[:·\-–—]\s*)?/gim;let match;
  while((match=re.exec(source)))sections.push({number:Number(match[1]),start:match.index,bodyStart:re.lastIndex});
  const byNumber=new Map();sections.forEach((section,index)=>byNumber.set(section.number,source.slice(section.bodyStart,sections[index+1]?.start??source.length)));
  const issues=[];
  for(let number=1;number<=count;number++){
    const body=byNumber.get(number);if(!body){issues.push(`Module ${number} missing`);continue}
    const blocks=(body.match(/^\s*(?:[-*]?\s*)?(?:\*\*)?Lesson\s+Block\s+[\d.]+\s*:/gim)||[]).length;
    if(blocks<3)issues.push(`Module ${number} has ${blocks}/3 lesson blocks`);
    if(!/^\s*(?:\*\*)?(?:Exercise|Practical Work|Practice)\s*:/im.test(body))issues.push(`Module ${number} practice missing`);
    if(!/^\s*(?:\*\*)?Assessment(?:\s+Intent)?\s*:/im.test(body))issues.push(`Module ${number} assessment missing`);
  }
  return{complete:issues.length===0,issues,moduleCount:byNumber.size};
}
function incompleteDesignResult(result,check){
  const message=`Living School rejected an incomplete research/design packet before module construction: ${check.issues.join('; ')}.`;
  return{...result,status:'invalid-response',error:{code:'LIVING_SCHOOL_DESIGN_PACKET_INCOMPLETE',message},diagnostics:[...(result?.diagnostics||[]),message],livingSchoolDesignCompleteness:{revision:VERSION,complete:false,issues:check.issues}};
}
async function boundedDesign(original,request){
  const firstRequest=boundedRequest(request);stats.designCalls+=1;publish();
  const first=await runDesignCall(original,firstRequest,1),count=Math.max(1,Math.min(8,Number(request?.context?.moduleCount||4)||4));
  if(first?.status!=='success')return first;
  const firstText=resultText(first),firstCheck=designPacketCheck(firstText,count);
  if(firstCheck.complete)return{...first,livingSchoolDesignCompleteness:{revision:VERSION,complete:true,retried:false,moduleCount:count}};
  stats.designCompletionRetries+=1;stats.designCalls+=1;publish();
  const messages=[...(Array.isArray(request?.messages)?request.messages.map(message=>({...message})):[]),{role:'assistant',content:clean(firstText,28000)},{role:'user',content:`The previous design packet was incomplete (${firstCheck.issues.join('; ')}). Return one COMPLETE replacement packet from Module 1 through Module ${count}. Every module must contain exactly three substantive Lesson Block sections plus Exercise, Practice Steps, Assessment Intent, Remediation Focus, and Video Search Topic. Keep the entire packet concise enough to finish. Replace the incomplete packet rather than continuing from its cutoff.`}];
  const retryRequest=boundedRequest({...request,messages,context:{...(request?.context||{}),designCompletionRetry:1,previousDesignIssues:firstCheck.issues}});
  const retry=await runDesignCall(original,retryRequest,2);if(retry?.status!=='success')return retry;
  const retryCheck=designPacketCheck(resultText(retry),count);if(!retryCheck.complete)return incompleteDesignResult(retry,retryCheck);
  return{...retry,diagnostics:[...(retry.diagnostics||[]),'Living School replaced one incomplete design packet with one bounded complete-design retry.'],livingSchoolDesignCompleteness:{revision:VERSION,complete:true,retried:true,moduleCount:count,firstIssues:firstCheck.issues}};
}
function compileStructure(request){
  const compiler=globalThis.CivweaveLivingSchoolGroundedCompilerV336,curator=globalThis.CivweaveLivingSchoolAssessmentCuratorV337;
  if(typeof compiler?.compile!=='function')return blocked(request,'repair','Living School stopped because the grounded compiler was not ready; it did not fall through to Flash-Lite. Reload and retry once the compiler is ready.');
  try{
    const payload=compiler.compile(request),index=Number(payload?.moduleIndex)||1,module=payload?.module;
    if(module&&typeof curator?.curateQuiz==='function')module.quiz=curator.curateQuiz(module,index,module.objective,module?.practice?.prompt||module?.artifact||'');
    stats.structureCompiles+=1;publish();
    return{
      schema:'civweave-model-result-1.0',requestId:request?.requestId||`ls-compiled-${Date.now().toString(36)}`,purpose:STRUCTURE_PURPOSE,status:'success',outputText:JSON.stringify(payload),outputJson:payload,
      usage:{inputTokens:0,outputTokens:0,totalTokens:0,costCents:0,remainingCents:0},stream:{requested:false,used:false},structured:{requested:true,valid:true,repairAttempts:0},fallback:{used:false},
      requested:{provider:clean(request?.config?.provider||request?.config?.route,80)||'shared',model:clean(request?.config?.model,180),executionProfile:'interactive'},
      actual:{provider:'civweave',model:'grounded-design-compiler-v338+assessment-curator-v338'},
      diagnostics:[`Living School ${VERSION} compiled the validated design packet and curated the mixed quiz locally. No post-design provider call was made.`],
      livingSchoolGenerationBudget:{version:VERSION,postDesignProviderCalls:0,structureCompiled:true}
    };
  }catch(error){
    return{schema:'civweave-model-result-1.0',requestId:request?.requestId||`ls-compile-failed-${Date.now().toString(36)}`,purpose:STRUCTURE_PURPOSE,status:'invalid-response',outputText:'',outputJson:null,usage:{},stream:{requested:false,used:false},structured:{requested:true,valid:false,repairAttempts:0},fallback:{used:false},actual:{provider:'civweave',model:'grounded-design-compiler-v338+assessment-curator-v338'},error:{code:clean(error?.code||'LIVING_SCHOOL_GROUNDED_COMPILE_FAILED',160),message:clean(error?.message||error,2400)},diagnostics:['Living School refused to call a provider to repair a grounded compile failure. The failed module remains visible for explicit recovery.']};
  }
}
function install(){
  const current=globalThis.CivweaveModelRuntime;if(!current?.generate)return false;
  if(current===wrappedRuntime&&current.livingSchoolGenerationBudgetRevision===VERSION){publish();return true}
  const original=current.generate.bind(current);
  const generate=async request=>{
    const purpose=lower(request?.purpose);
    if(purpose===DESIGN_PURPOSE)return boundedDesign(original,request);
    if(purpose===STRUCTURE_PURPOSE)return compileStructure(boundedRequest(request));
    if(purpose===QUIZ_PURPOSE)return blocked(request,'quiz','Living School blocked a supplemental AI quiz pass because the validated design compiler now curates the complete mixed quiz locally.');
    if(purpose===QUIZ_REPAIR_PURPOSE)return blocked(request,'repair','Living School blocked a hidden per-question quiz repair instead of calling Flash-Lite.');
    if(purpose===DEPTH_PURPOSE)return blocked(request,'depth','Living School blocked a hidden module-depth expansion call. Regenerate the bounded design packet if the lesson material is too thin.');
    if(livingSchoolPurpose(purpose))return original(boundedRequest(request));
    return original(request);
  };
  wrappedRuntime=Object.freeze({...current,generate,livingSchoolGenerationBudgetRevision:VERSION});
  try{Object.defineProperty(globalThis,'CivweaveModelRuntime',{configurable:true,enumerable:true,writable:true,value:wrappedRuntime})}catch{globalThis.CivweaveModelRuntime=wrappedRuntime}
  stats.outerRewraps+=1;if(!stats.installedAt)stats.installedAt=new Date().toISOString();publish();
  try{dispatchEvent(new CustomEvent('civweave:living-school-generation-budget-ready',{detail:{version:VERSION,designProviderCallsMax:2,designTimeoutMs:DESIGN_TIMEOUT_MS,designExecutionProfile:'interactive',postDesignProviderCalls:0,structureCompiler:'grounded-design-compiler-v338',quizCompiler:'assessment-curator-v338',outermost:true,at:new Date().toISOString()}}))}catch{}
  return true;
}
function schedule(){queueMicrotask(install);setTimeout(install,0);setTimeout(install,120)}
for(const event of ['civweave:model-runtime-ready','civweave:runtime-spine-ready','civweave:assistant-runtime-ready','civweave:living-school-runtime-route-ready','pageshow'])addEventListener?.(event,schedule);
for(const event of ['civweave:living-school-generation-guard-ready','civweave:living-school-quiz-contract-ready','civweave:living-school-video-generation-guard-ready','civweave:living-school-grounded-compiler-ready','civweave:living-school-assessment-curator-ready'])addEventListener?.(event,()=>{install();setTimeout(install,0)});
schedule();
globalThis.CivweaveLivingSchoolGenerationBudgetV1=Object.freeze({version:VERSION,install,designPacketCheck,looksLikeIndexNoise,compileStructure,stats:()=>({...stats})});
})();