(()=>{
'use strict';
const VERSION='1.2.0-living-school-generation-budget-v1-outermost';
const STRUCTURE_PURPOSE='living-school-structure-single-v221';
const QUIZ_PURPOSE='living-school-quiz-delta-completion-v258';
const QUIZ_REPAIR_PURPOSE='living-school-quiz-question-contract-repair-v263';
const stats={structureCalls:0,quizCalls:0,blockedStructureRepairs:0,blockedQuizRounds:0,blockedQuizQuestionRepairs:0,outerRewraps:0,installedAt:'',lastBlockedAt:'',lastQuizBatchAt:''};
let wrappedRuntime=null,loaderPatched=false;
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const livingSchoolPurpose=purpose=>/^living-school-/.test(clean(purpose,220));
function publish(){
  try{
    const root=document.documentElement;
    root.dataset.livingSchoolGenerationBudget=VERSION;
    root.dataset.livingSchoolStructureCalls=String(stats.structureCalls);
    root.dataset.livingSchoolQuizCalls=String(stats.quizCalls);
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
function boundedRequest(request){
  return{...request,maxRepairAttempts:0,taskTier:livingSchoolPurpose(request?.purpose)?'small':request?.taskTier,executionProfile:livingSchoolPurpose(request?.purpose)?'interactive':request?.executionProfile,context:{...(request?.context||{}),automaticRepairBudget:0,generationBudgetRevision:VERSION}};
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
    const purpose=clean(request?.purpose,220);
    if(purpose===QUIZ_REPAIR_PURPOSE)return blocked(request,'quiz-question');
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
  try{dispatchEvent(new CustomEvent('civweave:living-school-generation-budget-ready',{detail:{version:VERSION,structureRepairAttempts:0,quizProviderCallsPerCompletion:1,quizQuestionRepairCalls:0,outermost:true,at:new Date().toISOString()}}))}catch{}
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
globalThis.CivweaveLivingSchoolGenerationBudgetV1={version:VERSION,install,patchLoader,get runtime(){return wrappedRuntime},get loaderPatched(){return loaderPatched},stats:()=>({...stats})};
})();