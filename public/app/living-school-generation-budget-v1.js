(()=>{
'use strict';
const VERSION='1.0.0-living-school-generation-budget-v1';
const STRUCTURE_PURPOSE='living-school-structure-single-v221';
const QUIZ_PURPOSE='living-school-quiz-delta-completion-v258';
const stats={structureCalls:0,quizCalls:0,blockedStructureRepairs:0,blockedQuizRounds:0,installedAt:'',lastBlockedAt:''};
let wrappedRuntime=null,loaderPatched=false;
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
function publish(){
  try{
    const root=document.documentElement;
    root.dataset.livingSchoolGenerationBudget=VERSION;
    root.dataset.livingSchoolStructureCalls=String(stats.structureCalls);
    root.dataset.livingSchoolQuizCalls=String(stats.quizCalls);
    root.dataset.livingSchoolBlockedRepairs=String(stats.blockedStructureRepairs+stats.blockedQuizRounds);
  }catch{}
}
function blocked(request,kind){
  const structure=kind==='structure';
  if(structure)stats.blockedStructureRepairs+=1;else stats.blockedQuizRounds+=1;
  stats.lastBlockedAt=new Date().toISOString();publish();
  const message=structure
    ?'Living School stopped an automatic pedagogical re-generation. The module stays in recovery and can be retried explicitly.'
    :'Living School stopped an additional automatic quiz-repair round. The current pass will surface any remaining quiz gap instead of continuing hidden generation.';
  return{
    status:'error',outputText:'',outputJson:null,
    error:{code:'LIVING_SCHOOL_AUTOMATIC_REPAIR_BUDGET_EXHAUSTED',message},
    actual:{provider:'living-school-budget',model:''},
    diagnostics:[message],
    livingSchoolGenerationBudget:{version:VERSION,kind,purpose:clean(request?.purpose,180),blocked:true,at:stats.lastBlockedAt}
  };
}
function install(){
  try{globalThis.CivweaveLivingSchoolRuntimeRouteV1?.install?.()}catch{}
  const current=globalThis.CivweaveModelRuntime;
  if(!current?.generate)return false;
  if(current.livingSchoolGenerationBudgetRevision===VERSION){wrappedRuntime=current;publish();return true}
  const original=current.generate.bind(current);
  const generate=async request=>{
    const purpose=clean(request?.purpose,220);
    if(purpose===STRUCTURE_PURPOSE){
      if(request?.context?.pedagogyRepair)return blocked(request,'structure');
      stats.structureCalls+=1;publish();
      return original({...request,maxRepairAttempts:0,context:{...(request?.context||{}),automaticRepairBudget:0,generationBudgetRevision:VERSION}});
    }
    if(purpose===QUIZ_PURPOSE){
      const round=Math.max(0,Number(request?.context?.quizDeltaRound||0)||0);
      if(round>1)return blocked(request,'quiz');
      stats.quizCalls+=1;publish();
      return original({...request,maxRepairAttempts:0,context:{...(request?.context||{}),automaticRepairBudget:0,generationBudgetRevision:VERSION}});
    }
    return original(request);
  };
  wrappedRuntime=Object.freeze({...current,generate,livingSchoolGenerationBudgetRevision:VERSION});
  try{Object.defineProperty(globalThis,'CivweaveModelRuntime',{configurable:true,enumerable:true,writable:true,value:wrappedRuntime})}catch{globalThis.CivweaveModelRuntime=wrappedRuntime}
  stats.installedAt=new Date().toISOString();publish();
  try{dispatchEvent(new CustomEvent('civweave:living-school-generation-budget-ready',{detail:{version:VERSION,structureRepairAttempts:0,quizRoundsPerModule:1,at:stats.installedAt}}))}catch{}
  return true;
}
function patchLoader(){
  const loader=globalThis.CivweaveFamilyAILoaderV105;
  if(!loader?.ensure||loader.__livingSchoolGenerationBudgetV1===VERSION)return Boolean(loader?.__livingSchoolGenerationBudgetV1===VERSION);
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
for(const event of ['civweave:model-runtime-ready','civweave:runtime-spine-ready','civweave:assistant-runtime-ready','civweave:living-school-runtime-route-ready','pageshow'])addEventListener?.(event,schedule);
patchLoader();schedule();
globalThis.CivweaveLivingSchoolGenerationBudgetV1={version:VERSION,install,patchLoader,get runtime(){return wrappedRuntime},get loaderPatched(){return loaderPatched},stats:()=>({...stats})};
})();