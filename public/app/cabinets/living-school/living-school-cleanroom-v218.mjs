import{copy,state,persist,VERSION,clean}from'./living-school-cleanroom-core-v218.mjs';
import{render}from'./living-school-cleanroom-render-v218.mjs?v=source-links-v260';
import{actions,generateCurriculumFromData,stripLegacyFallbackQuestions}from'../../living-school-cleanroom-actions-v243.mjs?v=new-path-v264';
import{installLivingSchoolGenerationGuard}from'../../living-school-generation-guard-v262.mjs?v=source-prompt-quiz-delta-v262';
import{installLivingSchoolQuizContractGuardV263}from'../../living-school-quiz-contract-guard-v263.mjs?v=short-answer-rubric-v263';

await installLivingSchoolGenerationGuard();
await installLivingSchoolQuizContractGuardV263();

let busy=false,dispatchCount=0;
const LEVELS=new Set(['beginner','intermediate','advanced']);
const MODES=new Set(['guided','just-in-time','browse']);

function markDispatch(){
  dispatchCount+=1;
  document.documentElement.dataset.livingSchoolDispatchCount=String(dispatchCount);
}
function sanitizeSavedHybridQuiz(){
  const result=stripLegacyFallbackQuestions(state().school);
  if(result.removed){
    persist('living-school-hybrid-quiz-sanitized',{removed:result.removed,policy:'never-mix-deterministic-fillers-into-ai-curriculum'});
    document.documentElement.dataset.livingSchoolQuizIntegrity='legacy-fillers-removed';
  }else document.documentElement.dataset.livingSchoolQuizIntegrity='clean';
  return result.removed;
}

async function handleLivingSchoolClick(event){
  const target=event.target?.closest?.('[data-ls-action]');
  if(!target)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(target.disabled||busy)return;
  const action=actions[String(target.dataset.lsAction||'').trim()];
  if(!action)return;
  busy=true;markDispatch();
  try{await action(target)}catch(error){console.error('[Living School cleanroom]',error);const toast=document.getElementById('lsc218-toast');if(toast){toast.textContent=String(error?.message||error);toast.hidden=false}}
  finally{busy=false;render()}
}

function chatCurriculumData(input={}){
  const s=state(),replaceExisting=Boolean(input.replaceExisting||clean(input.pathMode,40).toLowerCase()==='new'),rawLevel=clean(input.level,80).toLowerCase(),rawMode=clean(input.mode,80).toLowerCase();
  const currentSchool=replaceExisting?{}:(s.school||{}),currentPath=replaceExisting?{}:(s.pathContext||{});
  return{
    title:clean(input.title,240)||clean(currentSchool.title||currentPath.title,240),
    capability:clean(input.capability,2400)||clean(currentSchool.capability||currentPath.capability,2400),
    level:LEVELS.has(rawLevel)?rawLevel:LEVELS.has(clean(currentSchool.level,80).toLowerCase())?clean(currentSchool.level,80).toLowerCase():'beginner',
    count:Math.max(1,Math.min(8,Number(input.count||(replaceExisting?4:currentSchool.modules?.length)||4)||4)),
    mode:MODES.has(rawMode)?rawMode:MODES.has(clean(s.settings?.mode,80).toLowerCase())?clean(s.settings.mode,80).toLowerCase():'guided',
    modelRoute:clean(input.modelRoute,120)||clean(s.settings?.modelRoute,120)||'shared',
    proof:clean(input.proof,3000)||clean(currentSchool.proof||currentPath.proof,3000)||'A working artifact, explanation, and independent receipt.',
    replaceExisting,
    pathMode:replaceExisting?'new':'revise'
  };
}

async function generateCurriculumFromChat(input={}){
  if(busy)throw new Error('Living School is already processing another learning action.');
  const data=chatCurriculumData(input);
  if(!data.capability)throw new Error('Moss needs an observable capability before generating the curriculum.');
  busy=true;markDispatch();
  document.documentElement.dataset.livingSchoolChatAction='generating-curriculum';
  document.documentElement.dataset.livingSchoolPathMode=data.pathMode;
  try{
    const school=await generateCurriculumFromData(data,{source:'moss-shared-chat',replaceExisting:data.replaceExisting,onStage:(stage,detail)=>{
      document.documentElement.dataset.livingSchoolChatStage=stage;
      try{dispatchEvent(new CustomEvent('civweave:living-school-curriculum-stage',{detail:{stage,...detail,title:data.title,capability:data.capability,pathMode:data.pathMode}}))}catch{}
    }});
    render();
    const result={school:copy(school),sourceCount:Number(state().sources?.length||0),research:copy(state().research||null),activeModuleId:state().activeModuleId,pathMode:data.pathMode};
    try{dispatchEvent(new CustomEvent('civweave:living-school-curriculum-generated',{detail:{schoolId:school.id,title:school.title,moduleCount:school.modules.length,capability:school.capability,source:'moss-shared-chat',pathMode:data.pathMode,replacedExisting:data.replaceExisting}}))}catch{}
    return result;
  }finally{
    busy=false;
    document.documentElement.dataset.livingSchoolChatAction='idle';
    render();
  }
}

sanitizeSavedHybridQuiz();
document.addEventListener('click',handleLivingSchoolClick,true);
render();
globalThis.LivingSchoolCleanroomV218=Object.freeze({version:VERSION,controller:'single-delegated-click-handler',researchAdapter:'live-local-synthesis-source-links-v260',generationGuard:'source-prompt-v262+quiz-contract-v263',quizIntegrity:'ai-only-v263-short-answer-contract',pathHandoff:'new-vs-revise-v264',getState:()=>copy(state()),render,dispatchCount:()=>dispatchCount,generateCurriculumFromChat,normalizeChatCurriculum:chatCurriculumData,legacyNavigation:false});
try{dispatchEvent(new CustomEvent('civweave:living-school-workbench-ready',{detail:{version:VERSION,chatCurriculumBridge:true,generationGuard:'source-prompt-v262+quiz-contract-v263',quizIntegrity:'ai-only-v263-short-answer-contract',pathHandoff:'new-vs-revise-v264'}}))}catch{}
