import{copy,state,persist,VERSION,clean}from'./living-school-cleanroom-core-v218.mjs';
import{render}from'./living-school-cleanroom-render-v218.mjs?v=source-links-v260';
import{actions,generateCurriculumFromData,stripLegacyFallbackQuestions}from'../../living-school-cleanroom-actions-v243.mjs?v=quiz-integrity-v261';
import{installLivingSchoolGenerationGuard}from'../../living-school-generation-guard-v262.mjs?v=source-prompt-quiz-delta-v262';
import{installLivingSchoolQuizContractGuardV263}from'../../living-school-quiz-contract-guard-v263.mjs?v=bounded-short-answer-v266';
import{installLivingSchoolDeadlineGuardV266}from'../../living-school-deadline-guard-v266.mjs?v=provider-deadlines-v266';

await installLivingSchoolGenerationGuard();
await installLivingSchoolQuizContractGuardV263();
await installLivingSchoolDeadlineGuardV266();

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
  const s=state(),newPath=input?.intent==='new'||input?.newPath===true||input?.replaceExisting===true,rawLevel=clean(input.level,80).toLowerCase(),rawMode=clean(input.mode,80).toLowerCase();
  return{
    title:clean(input.title,240)||(newPath?'':clean(s.school?.title||s.pathContext?.title,240)),
    capability:clean(input.capability,2400)||(newPath?'':clean(s.school?.capability||s.pathContext?.capability,2400)),
    level:LEVELS.has(rawLevel)?rawLevel:newPath?'beginner':LEVELS.has(clean(s.school?.level,80).toLowerCase())?clean(s.school.level,80).toLowerCase():'beginner',
    count:Math.max(1,Math.min(8,Number(input.count||(newPath?4:s.school?.modules?.length||4))||4)),
    mode:MODES.has(rawMode)?rawMode:MODES.has(clean(s.settings?.mode,80).toLowerCase())?clean(s.settings.mode,80).toLowerCase():'guided',
    modelRoute:clean(input.modelRoute,120)||clean(s.settings?.modelRoute,120)||'shared',
    proof:clean(input.proof,3000)||(newPath?'A working artifact, explanation, and independent receipt.':clean(s.school?.proof||s.pathContext?.proof,3000)||'A working artifact, explanation, and independent receipt.'),
    intent:newPath?'new':'revise',
    newPath,
    replaceExisting:newPath
  };
}

function snapshotLearningState(){
  const s=state();
  return copy({school:s.school||null,progress:s.progress||{},activeModuleId:s.activeModuleId||'',pathContext:s.pathContext||null,research:s.research||null,sources:s.sources||[],visualInspection:s.visualInspection||null});
}
function restoreLearningState(snapshot){
  if(!snapshot)return;
  const s=state();
  s.school=copy(snapshot.school);s.progress=copy(snapshot.progress||{});s.activeModuleId=snapshot.activeModuleId||'';s.pathContext=copy(snapshot.pathContext);s.research=copy(snapshot.research);s.sources=copy(snapshot.sources||[]);s.visualInspection=copy(snapshot.visualInspection);
}
function prepareNewPath(data){
  const s=state(),snapshot=snapshotLearningState();
  s.school=null;
  s.progress={};
  s.activeModuleId='';
  s.pathContext={title:data.title,capability:data.capability,proof:data.proof,source:'moss-shared-chat-new-path'};
  s.research=null;
  s.sources=[];
  s.visualInspection=null;
  persist('living-school-new-path-replacement-started',{title:data.title,capability:data.capability,level:data.level,count:data.count,source:'moss-shared-chat'});
  return snapshot;
}

async function generateCurriculumFromChat(input={}){
  if(busy)throw new Error('Living School is already processing another learning action.');
  const data=chatCurriculumData(input);
  if(!data.capability)throw new Error('Moss needs an observable capability before generating the curriculum.');
  const previous=data.newPath?prepareNewPath(data):null;
  busy=true;markDispatch();
  document.documentElement.dataset.livingSchoolChatAction='generating-curriculum';
  document.documentElement.dataset.livingSchoolPathIntent=data.intent;
  try{
    const school=await generateCurriculumFromData(data,{source:data.newPath?'moss-shared-chat-new-path':'moss-shared-chat',onStage:(stage,detail)=>{
      document.documentElement.dataset.livingSchoolChatStage=stage;
      try{dispatchEvent(new CustomEvent('civweave:living-school-curriculum-stage',{detail:{stage,...detail,title:data.title,capability:data.capability,intent:data.intent}}))}catch{}
    }});
    if(data.newPath)persist('living-school-new-path-replacement-completed',{schoolId:school.id,title:school.title,capability:school.capability,moduleCount:school.modules?.length||0,source:'moss-shared-chat'});
    render();
    const result={school:copy(school),sourceCount:Number(state().sources?.length||0),research:copy(state().research||null),activeModuleId:state().activeModuleId,intent:data.intent};
    try{dispatchEvent(new CustomEvent('civweave:living-school-curriculum-generated',{detail:{schoolId:school.id,title:school.title,moduleCount:school.modules.length,capability:school.capability,source:data.newPath?'moss-shared-chat-new-path':'moss-shared-chat',intent:data.intent}}))}catch{}
    return result;
  }catch(error){
    if(data.newPath){restoreLearningState(previous);persist('living-school-new-path-replacement-rolled-back',{title:data.title,capability:data.capability,error:clean(error?.message||error,1000),source:'moss-shared-chat'});}
    throw error;
  }finally{
    busy=false;
    document.documentElement.dataset.livingSchoolChatAction='idle';
    render();
  }
}

sanitizeSavedHybridQuiz();
document.addEventListener('click',handleLivingSchoolClick,true);
render();
globalThis.LivingSchoolCleanroomV218=Object.freeze({version:VERSION,controller:'single-delegated-click-handler',researchAdapter:'live-local-synthesis-source-links-v260',generationGuard:'source-prompt-v262+bounded-quiz-v266+deadlines-v266',quizIntegrity:'ai-only-v266-bounded-short-answer-contract',chatPathIntent:'new-vs-revise-v264',getState:()=>copy(state()),render,dispatchCount:()=>dispatchCount,generateCurriculumFromChat,normalizeChatCurriculum:chatCurriculumData,legacyNavigation:false});
try{dispatchEvent(new CustomEvent('civweave:living-school-workbench-ready',{detail:{version:VERSION,chatCurriculumBridge:true,generationGuard:'source-prompt-v262+bounded-quiz-v266+deadlines-v266',quizIntegrity:'ai-only-v266-bounded-short-answer-contract',chatPathIntent:'new-vs-revise-v264',providerDeadlines:true}}))}catch{}
