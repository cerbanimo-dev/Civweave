(()=>{
'use strict';
const VERSION='1.3.0-living-school-generation-budget-v1-design-completeness';
const DESIGN_PURPOSE='living-school-research-grounded-curriculum-v218.1';
const STRUCTURE_PURPOSE='living-school-structure-single-v221';
const QUIZ_PURPOSE='living-school-quiz-delta-completion-v258';
const QUIZ_REPAIR_PURPOSE='living-school-quiz-question-contract-repair-v263';
const stats={structureCalls:0,quizCalls:0,designCalls:0,designCompletionRetries:0,filteredSourceNoise:0,blockedStructureRepairs:0,blockedQuizRounds:0,blockedQuizQuestionRepairs:0,outerRewraps:0,installedAt:'',lastBlockedAt:'',lastQuizBatchAt:''};
let wrappedRuntime=null,loaderPatched=false;
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value,240).toLowerCase();
const livingSchoolPurpose=purpose=>/^living-school-/.test(lower(purpose));
const designPurpose=purpose=>lower(purpose)===DESIGN_PURPOSE;
function publish(){
  try{
    const root=document.documentElement;
    root.dataset.livingSchoolGenerationBudget=VERSION;
    root.dataset.livingSchoolStructureCalls=String(stats.structureCalls);
    root.dataset.livingSchoolQuizCalls=String(stats.quizCalls);
    root.dataset.livingSchoolDesignCalls=String(stats.designCalls);
    root.dataset.livingSchoolFilteredSourceNoise=String(stats.filteredSourceNoise);
    root.dataset.livingSchoolBlockedRepairs=String(stats.blockedStructureRepairs+stats.blockedQuizRounds+stats.blockedQuizQuestionRepairs);
    root.dataset.livingSchoolBudgetOuter=globalThis.CivweaveModelRuntime===wrappedRuntime?'true':'false';
  }catch{}
}
function blocked(request,kind){
  if(kind==='structure')stats.blockedStructureRepairs+=1;
  else if(kind==='quiz-question')stats.blockedQuizQuestionRepairs+=1;
  else stats.blockedQuizRounds+=1;
  stats.lastBlockedAt=new Date().toISOString();publish();
  const message=kind==='structure'
    ?'Living School stopped an automatic pedagogical re-generation. The module stays in recovery and can be retried explicitly.'
    :kind==='quiz-question'
      ?'Living School stopped a hidden per-question quiz repair. The current generation will surface the remaining quiz gap instead of repeatedly calling the provider.'
      :'Living School stopped an additional automatic quiz-repair round. The current pass will surface any remaining quiz gap instead of continuing hidden generation.';
  return{
    status:'error',outputText:'',outputJson:null,
    error:{code:'LIVING_SCHOOL_AUTOMATIC_REPAIR_BUDGET_EXHAUSTED',message},
    actual:{provider:'living-school-budget',model:''},
    diagnostics:[message],
    livingSchoolGenerationBudget:{version:VERSION,kind,purpose:clean(request?.purpose,180),blocked:true,at:stats.lastBlockedAt}
  };
}
function looksLikeIndexNoise(source){
  const text=clean(source?.notes||source?.content,6000);
  if(!text)return true;
  const words=text.match(/[A-Za-z]{3,}/g)||[];
  const tiny=text.match(/(?:^|\s)[A-Za-z0-9]{1,2}(?=\s|$)/g)||[];
  const odd=text.match(/[^\x20-\x7E\r\n\t]/g)||[];
  const symbol=text.match(/[+%#{}\\|]/g)||[];
  const indexTerms=text.match(/\b(?:identifier|ISBN|ISSN|JSTOR|Bibcode|Academic Press|Publishing|Journal|University Press)\b/gi)||[];
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
  const purpose=request?.purpose,strongDesign=designPurpose(purpose),living=livingSchoolPurpose(purpose),prepared=strongDesign?cleanDesignSources(request):request;
  return{...prepared,maxRepairAttempts:0,taskTier:strongDesign?'complex':living?'small':prepared?.taskTier,executionProfile:strongDesign?'agentic':living?'interactive':prepared?.executionProfile,context:{...(prepared?.context||{}),automaticRepairBudget:0,generationBudgetRevision:VERSION}};
}
function resultText(result){
  const direct=[result?.outputText,result?.text,result?.output,result?.content,result?.responseText].find(value=>typeof value==='string'&&value.trim());
  if(direct)return String(direct).trim();
  if(result?.outputJson&&typeof result.outputJson==='object')try{return JSON.stringify(result.outputJson)}catch{}
  return'';
}
function designPacketCheck(text,count){
  const source=String(text||''),sections=[];
  const re=/^#{1,6}\s*Module\s+(\d+)\s*(?:[:·\-–—]\s*)?/gim;let match;
  while((match=re.exec(source)))sections.push({number:Number(match[1]),start:match.index,bodyStart:re.lastIndex});
  const byNumber=new Map();
  sections.forEach((section,index)=>byNumber.set(section.number,source.slice(section.bodyStart,sections[index+1]?.start??source.length)));
  const issues=[];
  for(let number=1;number<=count;number++){
    const body=byNumber.get(number);
    if(!body){issues.push(`Module ${number} missing`);continue}
    const blocks=(body.match(/^\s*(?:[-*]?\s*)?(?:\*\*)?Lesson\s+Block\s+[\d.]+\s*:/gim)||[]).length;
    if(blocks<3)issues.push(`Module ${number} has ${blocks}/3 lesson blocks`);
    if(!/^\s*(?:\*\*)?(?:Exercise|Practical Work|Practice)\s*:/im.test(body))issues.push(`Module ${number} practice missing`);
    if(!/^\s*(?:\*\*)?Assessment(?:\s+Intent)?\s*:/im.test(body))issues.push(`Module ${number} assessment missing`);
  }
  return{complete:issues.length===0,issues,modules:byNumber.size};
}
function incompleteDesignResult(result,check){
  const message=`Living School rejected an incomplete research/design packet before module construction: ${check.issues.join('; ')}.`;
  return{...result,status:'invalid-response',outputText:resultText(result),error:{code:'LIVING_SCHOOL_DESIGN_PACKET_INCOMPLETE',message},diagnostics:[...(result?.diagnostics||[]),message],livingSchoolDesignCompleteness:{revision:VERSION,complete:false,issues:check.issues}};
}
async function boundedDesign(original,request){
  const firstRequest=boundedRequest(request);stats.designCalls+=1;publish();
  const first=await original(firstRequest),count=Math.max(1,Math.min(8,Number(request?.context?.moduleCount||4)||4));
  if(first?.status!=='success')return first;
  const firstText=resultText(first),firstCheck=designPacketCheck(firstText,count);
  if(firstCheck.complete)return{...first,livingSchoolDesignCompleteness:{revision:VERSION,complete:true,retried:false,moduleCount:count}};
  stats.designCompletionRetries+=1;stats.designCalls+=1;publish();
  const messages=[...(Array.isArray(request?.messages)?request.messages.map(message=>({...message})):[]),{role:'assistant',content:clean(firstText,28000)},{role:'user',content:`The previous design packet was incomplete (${firstCheck.issues.join('; ')}). Return one COMPLETE replacement packet from Module 1 through Module ${count}. Every module must use the required format and contain exactly three substantive Lesson Block sections, plus Exercise, Practice Steps, Assessment Intent, Remediation Focus, and Video Search Topic. Keep it concise enough to finish all ${count} modules. Do not continue from the cutoff; replace the entire packet.`}];
  const retryRequest=boundedRequest({...request,messages,context:{...(request?.context||{}),designCompletionRetry:1,previousDesignIssues:firstCheck.issues}});
  const retry=await original(retryRequest);
  if(retry?.status!=='success')return retry;
  const retryCheck=designPacketCheck(resultText(retry),count);
  if(!retryCheck.complete)return incompleteDesignResult(retry,retryCheck);
  return{...retry,diagnostics:[...(retry.diagnostics||[]),'Living School replaced one incomplete design packet with one bounded complete-design retry.'],livingSchoolDesignCompleteness:{revision:VERSION,complete:true,retried:true,moduleCount:count,firstIssues:firstCheck.issues}};
}
async function directQuizBatch(request){
  const spine=globalThis.CivweaveFastInteractiveV192?.proxy?.();
  if(!spine?.generate)return null;
  stats.quizCalls+=1;stats.lastQuizBatchAt=new Date().toISOString();publish();
  const next=boundedRequest({...request,context:{...(request?.context||{}),quizDeltaRound:1,quizBatchMode:'single-provider-call-all-modules'}});
  return spine.generate(next);
}
function install(){
  try{globalThis.CivweaveLivingSchoolRuntimeRouteV1?.install?.()}catch{}
  const current=globalThis.CivweaveModelRuntime;
  if(!current?.generate)return false;
  if(current===wrappedRuntime&&current.livingSchoolGenerationBudgetRevision===VERSION){publish();return true}
  const original=current.generate.bind(current);
  const generate=async request=>{
    const purpose=lower(request?.purpose);
    if(purpose===QUIZ_REPAIR_PURPOSE)return blocked(request,'quiz-question');
    if(purpose===DESIGN_PURPOSE)return boundedDesign(original,request);
    if(purpose===STRUCTURE_PURPOSE){
      if(request?.context?.pedagogyRepair)return blocked(request,'structure');
      stats.structureCalls+=1;publish();
      return original(boundedRequest(request));
    }
    if(purpose===QUIZ_PURPOSE){
      const round=Math.max(0,Number(request?.context?.quizDeltaRound||0)||0);
      if(round>1)return blocked(request,'quiz');
      const batch=await directQuizBatch(request);
      if(batch)return batch;
      stats.quizCalls+=1;publish();
      return original(boundedRequest(request));
    }
    if(livingSchoolPurpose(purpose))return original(boundedRequest(request));
    return original(request);
  };
  wrappedRuntime=Object.freeze({...current,generate,livingSchoolGenerationBudgetRevision:VERSION});
  try{Object.defineProperty(globalThis,'CivweaveModelRuntime',{configurable:true,enumerable:true,writable:true,value:wrappedRuntime})}catch{globalThis.CivweaveModelRuntime=wrappedRuntime}
  stats.outerRewraps+=1;if(!stats.installedAt)stats.installedAt=new Date().toISOString();publish();
  try{dispatchEvent(new CustomEvent('civweave:living-school-generation-budget-ready',{detail:{version:VERSION,designProviderCallsMax:2,structureRepairAttempts:0,quizProviderCallsPerCompletion:1,quizQuestionRepairCalls:0,outermost:true,sourceNoiseFilter:true,at:new Date().toISOString()}}))}catch{}
  return true;
}
function patchLoader(){
  const loader=globalThis.CivweaveFamilyAILoaderV105;
  if(!loader?.ensure)return false;
  if(loader.__livingSchoolGenerationBudgetV1===VERSION){loaderPatched=true;return true}
  const originalEnsure=loader.ensure.bind(loader);
  loader.ensure=async(...args)=>{
    const result=await originalEnsure(...args);
    try{globalThis.CivweaveLivingSchoolRuntimeRouteV1?.install?.()}catch{}
    install();
    return result;
  };
  loader.__livingSchoolGenerationBudgetV1=VERSION;
  loaderPatched=true;return true;
}
function schedule(){queueMicrotask(()=>{patchLoader();install()});setTimeout(()=>{patchLoader();install()},0);setTimeout(()=>{patchLoader();install()},120)}
for(const event of ['civweave:model-runtime-ready','civweave:runtime-spine-ready','civweave:assistant-runtime-ready','civweave:living-school-runtime-route-ready','civweave:living-school-generation-guard-ready','civweave:living-school-quiz-contract-ready','civweave:living-school-video-generation-guard-ready','pageshow'])addEventListener?.(event,schedule);
patchLoader();schedule();
globalThis.CivweaveLivingSchoolGenerationBudgetV1={version:VERSION,install,patchLoader,get runtime(){return wrappedRuntime},get loaderPatched(){return loaderPatched},designPacketCheck,looksLikeIndexNoise,stats:()=>({...stats})};
})();