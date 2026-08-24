(()=>{
'use strict';
const VERSION='2.1.0-living-school-generation-budget-v2-strong-origin';
const DESIGN_PURPOSE='living-school-research-grounded-curriculum-v218.1';
const STRUCTURE_PURPOSE='living-school-structure-single-v221';
const QUIZ_PURPOSE='living-school-quiz-delta-completion-v258';
const QUIZ_REPAIR_PURPOSE='living-school-quiz-question-contract-repair-v263';
const DEPTH_PURPOSE='living-school-module-depth-expansion-v262';
const EXPECTED_DESIGN_MODEL='gemini-3.7-flash';
const DESIGN_TIMEOUT_MS=120000;
const DESIGN_MAX_TOKENS=16384;
const MIN_LESSON_WORDS=120;
const stats={designCalls:0,duplicateDesignCallsBlocked:0,designTimeouts:0,wrongModelDesignsRejected:0,structureCompiles:0,quizCallsBlocked:0,repairCallsBlocked:0,depthCallsBlocked:0,filteredSourceNoise:0,installCount:0,installedAt:'',lastBlockedAt:''};
let installed=false,wrappedRuntime=null,designConsumed=false;
const clean=(value,max=64000)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value,240).toLowerCase();
const livingSchoolPurpose=purpose=>/^living-school-/.test(lower(purpose));
const designPurpose=purpose=>lower(purpose)===DESIGN_PURPOSE;
function publish(){
  try{
    const root=document.documentElement;
    root.dataset.livingSchoolGenerationBudget=VERSION;
    root.dataset.livingSchoolDesignCalls=String(stats.designCalls);
    root.dataset.livingSchoolDesignCallsMax='1';
    root.dataset.livingSchoolDuplicateDesignCallsBlocked=String(stats.duplicateDesignCallsBlocked);
    root.dataset.livingSchoolDesignTimeouts=String(stats.designTimeouts);
    root.dataset.livingSchoolWrongModelDesignsRejected=String(stats.wrongModelDesignsRejected);
    root.dataset.livingSchoolStructureCompiles=String(stats.structureCompiles);
    root.dataset.livingSchoolQuizCallsBlocked=String(stats.quizCallsBlocked);
    root.dataset.livingSchoolRepairCallsBlocked=String(stats.repairCallsBlocked);
    root.dataset.livingSchoolDepthCallsBlocked=String(stats.depthCallsBlocked);
    root.dataset.livingSchoolFilteredSourceNoise=String(stats.filteredSourceNoise);
    root.dataset.livingSchoolBudgetInstallCount=String(stats.installCount);
    root.dataset.livingSchoolBudgetOuter=globalThis.CivweaveModelRuntime===wrappedRuntime?'true':'false';
  }catch{}
}
function resetRunBudget(){designConsumed=false;try{document.documentElement.dataset.livingSchoolDesignCallConsumed='false'}catch{}}
function markDesignConsumed(){designConsumed=true;try{document.documentElement.dataset.livingSchoolDesignCallConsumed='true'}catch{}}
function blocked(request,kind,message,code='LIVING_SCHOOL_HIDDEN_PROVIDER_CALL_BLOCKED'){
  if(kind==='quiz')stats.quizCallsBlocked+=1;
  else if(kind==='depth')stats.depthCallsBlocked+=1;
  else if(kind==='design'){stats.duplicateDesignCallsBlocked+=1}
  else stats.repairCallsBlocked+=1;
  stats.lastBlockedAt=new Date().toISOString();publish();
  return{
    schema:'civweave-model-result-1.0',requestId:request?.requestId||`ls-budget-${Date.now().toString(36)}`,purpose:clean(request?.purpose,180),status:'error',outputText:'',outputJson:null,
    usage:{inputTokens:0,outputTokens:0,totalTokens:0,costCents:0,remainingCents:0},stream:{requested:false,used:false},
    actual:{provider:'civweave',model:'living-school-generation-budget-v2'},
    error:{code,message},diagnostics:[message],livingSchoolGenerationBudget:{version:VERSION,kind,blocked:true,at:stats.lastBlockedAt}
  };
}
function looksLikeIndexNoise(source){
  const text=clean(source?.notes||source?.content,6000);if(!text)return true;
  const words=text.match(/[A-Za-z]{3,}/g)||[],tiny=text.match(/(?:^|\s)[A-Za-z0-9]{1,2}(?=\s|$)/g)||[],odd=text.match(/[^\x20-\x7E\r\n\t]/g)||[],symbol=text.match(/[+%#{}\\|]/g)||[],indexTerms=text.match(/\b(?:identifier|ISBN|ISSN|JSTOR|Bibcode|Academic Press|Publishing|Journal|University Press)\b/gi)||[];
  return words.length<24||(tiny.length>=14&&(odd.length+symbol.length)>=12)||(indexTerms.length>=4&&tiny.length>=8);
}
function cleanDesignSources(request){
  if(!designPurpose(request?.purpose))return request;
  const context=request?.context&&typeof request.context==='object'?request.context:{},sources=Array.isArray(context.sources)?context.sources:[];
  if(!sources.length)return request;
  const kept=sources.filter(source=>!looksLikeIndexNoise(source)),removed=sources.length-kept.length;if(!removed)return request;
  stats.filteredSourceNoise+=removed;publish();
  return{...request,context:{...context,sources:kept,sourceNoiseFilter:{revision:VERSION,input:sources.length,kept:kept.length,removed}}};
}
function boundedRequest(request,tier='small'){
  const prepared=designPurpose(request?.purpose)?cleanDesignSources(request):request,config={...(prepared?.config||{})};
  if(tier==='complex'){
    config.maxTokens=Math.max(Number(config.maxTokens)||0,DESIGN_MAX_TOKENS);
    config.provider='gemini';config.route='gemini';config.model=EXPECTED_DESIGN_MODEL;
  }
  return{...prepared,config,maxRepairAttempts:0,taskTier:tier,executionProfile:'interactive',context:{...(prepared?.context||{}),automaticRepairBudget:0,generationBudgetRevision:VERSION,designProviderCallsMax:1,postDesignProviderCallsMax:0,expectedDesignModel:tier==='complex'?EXPECTED_DESIGN_MODEL:undefined,...(tier==='complex'?{designTimeoutMs:DESIGN_TIMEOUT_MS}: {})}};
}
function resultText(result){
  const direct=[result?.outputText,result?.text,result?.output,result?.content,result?.responseText].find(value=>typeof value==='string'&&value.trim());
  if(direct)return String(direct).trim();
  if(result?.outputJson&&typeof result.outputJson==='object')try{return JSON.stringify(result.outputJson)}catch{}
  return'';
}
function wordCount(value){return(String(value||'').match(/\b[\p{L}\p{N}][\p{L}\p{N}’'’-]*\b/gu)||[]).length}
function lessonBodies(body){
  const marker=/^\s*(?:[-*]?\s*)?(?:\*\*)?Lesson\s+Block\s+[\d.]+\s*:\s*[^\n]+/gim,matches=[];let match;
  while((match=marker.exec(body)))matches.push({start:match.index,bodyStart:marker.lastIndex,label:clean(match[0],220)});
  return matches.map((row,index)=>({label:row.label,body:String(body).slice(row.bodyStart,matches[index+1]?.start??body.length).replace(/^\s*(?:\*\*)?(?:Exercise|Practical Work|Practice|Assessment(?:\s+Intent)?|Remediation(?:\s+Focus)?|Video\s+Search\s+Topic)\s*:.*$/ims,'').trim()}));
}
function designPacketCheck(text,count){
  const source=String(text||''),sections=[],re=/^#{1,6}\s*Module\s+(\d+)\s*(?:[:·\-–—]\s*)?/gim;let match;
  while((match=re.exec(source)))sections.push({number:Number(match[1]),start:match.index,bodyStart:re.lastIndex});
  const byNumber=new Map();sections.forEach((section,index)=>byNumber.set(section.number,source.slice(section.bodyStart,sections[index+1]?.start??source.length)));
  const issues=[];
  for(let number=1;number<=count;number++){
    const body=byNumber.get(number);if(!body){issues.push(`Module ${number} missing`);continue}
    const blocks=lessonBodies(body);
    if(blocks.length<3)issues.push(`Module ${number} has ${blocks.length}/3 lesson blocks`);
    for(const [index,block] of blocks.slice(0,3).entries()){
      const words=wordCount(block.body);if(words<MIN_LESSON_WORDS)issues.push(`Module ${number} lesson block ${index+1} is ${words} words; ${MIN_LESSON_WORDS}+ required for long-form teaching`);
    }
    if(!/^\s*(?:\*\*)?(?:Estimated\s+Effort)\s*:/im.test(body))issues.push(`Module ${number} estimated effort hours missing`);
    if(!/^\s*(?:\*\*)?(?:Exercise|Practical Work|Practice)\s*:/im.test(body))issues.push(`Module ${number} practice missing`);
    if(!/^\s*(?:\*\*)?Assessment(?:\s+Intent)?\s*:/im.test(body))issues.push(`Module ${number} assessment missing`);
  }
  return{complete:issues.length===0,issues,moduleCount:byNumber.size};
}
function incompleteDesignResult(result,check){
  const message=`Living School stopped after its single design call because the packet was incomplete: ${check.issues.join('; ')}. No second Gemini 3.7 call was made.`;
  return{...result,status:'invalid-response',outputText:'',outputJson:null,error:{code:'LIVING_SCHOOL_SINGLE_DESIGN_PACKET_INCOMPLETE',message},diagnostics:[...(result?.diagnostics||[]),message],livingSchoolDesignCompleteness:{revision:VERSION,complete:false,issues:check.issues,retried:false,designProviderCalls:1}};
}
function designTimeoutResult(request){
  const message=`Living School stopped the single Gemini 3.7 design call after ${Math.round(DESIGN_TIMEOUT_MS/1000)} seconds. No retry was started.`;
  return{schema:'civweave-model-result-1.0',requestId:request?.requestId||`ls-design-timeout-${Date.now().toString(36)}`,purpose:DESIGN_PURPOSE,status:'error',outputText:'',outputJson:null,usage:{inputTokens:0,outputTokens:0,totalTokens:0,costCents:0,remainingCents:0},stream:{requested:false,used:false},actual:{provider:'civweave',model:'living-school-design-timeout'},error:{code:'LIVING_SCHOOL_DESIGN_TIMEOUT',message},diagnostics:[message],livingSchoolGenerationBudget:{version:VERSION,designTimeout:true,timeoutMs:DESIGN_TIMEOUT_MS,designProviderCalls:1}};
}
function actualDesignModel(result={}){return lower(result?.actual?.model||result?.model||result?.requested?.model||'')}
function wrongDesignModelResult(result){
  const actual=actualDesignModel(result)||'unknown model';stats.wrongModelDesignsRejected+=1;publish();
  const message=`Living School rejected the design result because the single strong design slot must be ${EXPECTED_DESIGN_MODEL}, but the runtime returned ${actual}. Automatic model fallback is not accepted for curriculum design.`;
  return{...result,status:'provider-error',outputText:'',outputJson:null,error:{code:'LIVING_SCHOOL_STRONG_DESIGN_MODEL_MISMATCH',message},diagnostics:[...(result?.diagnostics||[]),message],livingSchoolGenerationBudget:{...(result?.livingSchoolGenerationBudget||{}),version:VERSION,designProviderCalls:1,expectedModel:EXPECTED_DESIGN_MODEL,actualModel:actual,fallbackRejected:true}};
}
async function runOneDesignCall(original,request){
  if(designConsumed)return blocked(request,'design','Living School blocked a second Gemini 3.7 design request in the same curriculum action.','LIVING_SCHOOL_DUPLICATE_STRONG_DESIGN_BLOCKED');
  markDesignConsumed();stats.designCalls+=1;publish();
  const prepared=boundedRequest(request,'complex'),controller=new AbortController(),parent=prepared?.signal;let timer=0,timedOut=false;
  const forwardAbort=()=>{try{controller.abort(parent?.reason)}catch{}};try{parent?.addEventListener?.('abort',forwardAbort,{once:true})}catch{}
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>{timedOut=true;stats.designTimeouts+=1;publish();try{controller.abort(new DOMException('Living School design timeout','AbortError'))}catch{try{controller.abort()}catch{}}resolve(designTimeoutResult(prepared))},DESIGN_TIMEOUT_MS)});
  const call=Promise.resolve().then(()=>original({...prepared,signal:controller.signal})).catch(error=>{if(timedOut)return designTimeoutResult(prepared);throw error});
  let result;try{result=await Promise.race([call,timeout])}finally{clearTimeout(timer);try{parent?.removeEventListener?.('abort',forwardAbort)}catch{}}
  if(result?.status!=='success')return result;
  if(actualDesignModel(result)!==EXPECTED_DESIGN_MODEL||result?.fallback?.used===true)return wrongDesignModelResult(result);
  const count=Math.max(1,Math.min(8,Number(request?.context?.moduleCount||4)||4)),check=designPacketCheck(resultText(result),count);
  if(!check.complete)return incompleteDesignResult(result,check);
  return{...result,livingSchoolDesignCompleteness:{revision:VERSION,complete:true,retried:false,moduleCount:count,designProviderCalls:1,model:EXPECTED_DESIGN_MODEL},diagnostics:[...(result.diagnostics||[]),'Living School completed its single Gemini 3.7 design call with verified strong-model origin. No automatic strong-model retry or Lite substitution is permitted.']};
}
function compileStructure(request){
  const compiler=globalThis.CivweaveLivingSchoolGroundedCompilerV336,curator=globalThis.CivweaveLivingSchoolAssessmentCuratorV337;
  if(typeof compiler?.compile!=='function')return blocked(request,'repair','Living School stopped because the grounded compiler was not ready; it did not fall through to a provider.');
  try{
    const payload=compiler.compile(request),index=Number(payload?.moduleIndex)||1,module=payload?.module;
    if(module&&typeof curator?.curateQuiz==='function')module.quiz=curator.curateQuiz(module,index,module.objective,module?.practice?.prompt||module?.artifact||'');
    stats.structureCompiles+=1;publish();
    return{schema:'civweave-model-result-1.0',requestId:request?.requestId||`ls-compiled-${Date.now().toString(36)}`,purpose:STRUCTURE_PURPOSE,status:'success',outputText:JSON.stringify(payload),outputJson:payload,usage:{inputTokens:0,outputTokens:0,totalTokens:0,costCents:0,remainingCents:0},stream:{requested:false,used:false},structured:{requested:true,valid:true,repairAttempts:0},fallback:{used:false},requested:{provider:clean(request?.config?.provider||request?.config?.route,80)||'shared',model:clean(request?.config?.model,180),executionProfile:'interactive'},actual:{provider:'civweave',model:'grounded-design-compiler-v338+assessment-curator-v338'},diagnostics:[`Living School ${VERSION} compiled the validated design packet and curated its quiz locally. No post-design provider call was made.`],livingSchoolGenerationBudget:{version:VERSION,postDesignProviderCalls:0,structureCompiled:true}};
  }catch(error){return{schema:'civweave-model-result-1.0',requestId:request?.requestId||`ls-compile-failed-${Date.now().toString(36)}`,purpose:STRUCTURE_PURPOSE,status:'invalid-response',outputText:'',outputJson:null,usage:{},stream:{requested:false,used:false},structured:{requested:true,valid:false,repairAttempts:0},fallback:{used:false},actual:{provider:'civweave',model:'grounded-design-compiler-v338+assessment-curator-v338'},error:{code:clean(error?.code||'LIVING_SCHOOL_GROUNDED_COMPILE_FAILED',160),message:clean(error?.message||error,2400)},diagnostics:['Living School refused to call a provider to repair a grounded compile failure.']}}
}
function finalGuardsReady(){return Boolean(globalThis.CivweaveLivingSchoolGenerationGuardV262?.installed&&globalThis.CivweaveLivingSchoolQuizContractGuardV263?.installed&&globalThis.CivweaveLivingSchoolVideoGenerationGuardV1?.installed)}
function runtimeRouteReady(){const current=globalThis.CivweaveModelRuntime;return Boolean(current?.__livingSchoolRuntimeRouteV331||globalThis.CivweaveLivingSchoolRuntimeRouteV1?.bridge)}
function install(){
  if(installed){publish();return true}
  if(!finalGuardsReady()||!runtimeRouteReady())return false;
  const current=globalThis.CivweaveModelRuntime;if(!current?.generate)return false;
  const original=current.generate.bind(current);
  const generate=async request=>{
    const purpose=lower(request?.purpose);
    if(purpose===DESIGN_PURPOSE)return runOneDesignCall(original,request);
    if(purpose===STRUCTURE_PURPOSE)return compileStructure(boundedRequest(request,'small'));
    if(purpose===QUIZ_PURPOSE)return blocked(request,'quiz','Living School blocked a supplemental AI quiz pass because the local assessment curator owns quiz completion.');
    if(purpose===QUIZ_REPAIR_PURPOSE)return blocked(request,'repair','Living School blocked a hidden per-question quiz repair instead of calling a provider.');
    if(purpose===DEPTH_PURPOSE)return blocked(request,'depth','Living School blocked a hidden module-depth expansion call. Regenerate the single design packet explicitly if lesson material is inadequate.');
    if(livingSchoolPurpose(purpose))return original(boundedRequest(request,'small'));
    return original(request);
  };
  wrappedRuntime=Object.freeze({...current,generate,livingSchoolGenerationBudgetRevision:VERSION,__livingSchoolGenerationBudgetV2:true});
  try{Object.defineProperty(globalThis,'CivweaveModelRuntime',{configurable:true,enumerable:true,writable:true,value:wrappedRuntime})}catch{globalThis.CivweaveModelRuntime=wrappedRuntime}
  installed=true;stats.installCount=1;stats.installedAt=new Date().toISOString();publish();
  try{dispatchEvent(new CustomEvent('civweave:living-school-generation-budget-ready',{detail:{version:VERSION,designProviderCallsMax:1,designTimeoutMs:DESIGN_TIMEOUT_MS,designExecutionProfile:'interactive',expectedDesignModel:EXPECTED_DESIGN_MODEL,postDesignProviderCalls:0,structureCompiler:'grounded-design-compiler-v338',quizCompiler:'assessment-curator-v338',terminalOwner:true,installCount:1,at:stats.installedAt}}))}catch{}
  return true;
}
function tryInstall(){if(!installed)queueMicrotask(install)}
for(const event of ['civweave:living-school-runtime-route-ready','civweave:living-school-video-generation-guard-ready','civweave:assistant-runtime-ready','civweave:runtime-spine-ready'])addEventListener?.(event,tryInstall);
if(typeof document!=='undefined')document.addEventListener('click',event=>{const target=event.target?.closest?.('[data-ls-action]');if(!target)return;const action=clean(target.dataset.lsAction,100);if(action==='generate-curriculum'||action==='regenerate-ls-research')resetRunBudget()},true);
addEventListener?.('civweave:living-school-curriculum-stage',event=>{if(clean(event?.detail?.stage,80)==='researching')resetRunBudget()});
queueMicrotask(install);
const api=Object.freeze({version:VERSION,install,designPacketCheck,looksLikeIndexNoise,compileStructure,resetRunBudget,get installed(){return installed},get runtime(){return wrappedRuntime},stats:()=>({...stats}),designProviderCallsMax:1,postDesignProviderCallsMax:0,expectedDesignModel:EXPECTED_DESIGN_MODEL,minLessonWords:MIN_LESSON_WORDS});
globalThis.CivweaveLivingSchoolGenerationBudgetV2=api;
globalThis.CivweaveLivingSchoolGenerationBudgetV1=api;
})();