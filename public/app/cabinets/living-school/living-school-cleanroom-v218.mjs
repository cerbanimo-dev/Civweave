import{copy,state,persist,VERSION,clean}from'./living-school-cleanroom-core-v218.mjs';
import{render}from'./living-school-cleanroom-render-v218.mjs?v=model-authority-v323';
import{actions,generateCurriculumFromData,stripLegacyFallbackQuestions}from'../../living-school-cleanroom-actions-v243.mjs?v=model-authority-v323';
import{installLivingSchoolGenerationGuard}from'../../living-school-generation-guard-v262.mjs?v=source-prompt-quiz-delta-v262';
import{installLivingSchoolQuizContractGuardV263}from'../../living-school-quiz-contract-guard-v263.mjs?v=short-answer-rubric-v263';
import{installLivingSchoolVideoGenerationGuardV1}from'../../living-school-video-generation-guard-v1.mjs?v=video-atlas-v1';
import{ensureLivingSchool,renderLivingSchoolEmbed,FALLBACK_VIDEO_URL}from'../../video-learning-contract-v1.mjs?v=video-atlas-v1';
import safeMode from'../../safe-mode-v1.mjs?v=safe-mode-v1';

safeMode.install();
document.documentElement.dataset.livingSchoolAiGuards='lazy';

let busy=false,dispatchCount=0,videoContractBusy=false,aiGuardsPromise=null;
const LEVELS=new Set(['beginner','intermediate','advanced']);
const MODES=new Set(['guided','just-in-time','browse']);
const AI_ACTIONS=new Set(['research-sources','generate-curriculum']);
const AI_GUARD_TIMEOUT_MS=45000;

function markDispatch(){
  dispatchCount+=1;
  document.documentElement.dataset.livingSchoolDispatchCount=String(dispatchCount);
}
function timeoutAfter(ms,label){
  return new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} did not become ready within ${Math.round(ms/1000)} seconds.`)),ms));
}
async function ensureAIGuards(reason='interaction'){
  if(globalThis.CivweaveLivingSchoolGenerationGuardV262?.installed&&globalThis.CivweaveLivingSchoolQuizContractGuardV263?.installed&&globalThis.CivweaveLivingSchoolVideoGenerationGuardV1?.installed){
    document.documentElement.dataset.livingSchoolAiGuards='ready';
    return true;
  }
  if(!aiGuardsPromise){
    document.documentElement.dataset.livingSchoolAiGuards='starting';
    aiGuardsPromise=(async()=>{
      await installLivingSchoolGenerationGuard();
      await installLivingSchoolQuizContractGuardV263();
      await installLivingSchoolVideoGenerationGuardV1();
      return true;
    })();
  }
  try{
    await Promise.race([aiGuardsPromise,timeoutAfter(AI_GUARD_TIMEOUT_MS,'The Living School AI generation layer')]);
    document.documentElement.dataset.livingSchoolAiGuards='ready';
    document.documentElement.dataset.livingSchoolAiGuardReason=reason;
    return true;
  }catch(error){
    aiGuardsPromise=null;
    document.documentElement.dataset.livingSchoolAiGuards='unavailable';
    document.documentElement.dataset.livingSchoolAiGuardReason=reason;
    const message=clean(error?.message||error,1200)||'The shared model runtime did not become ready.';
    throw new Error(`Living School is open, but its AI generation layer is not ready yet. ${message}`);
  }
}
function sanitizeSavedHybridQuiz(){
  const result=stripLegacyFallbackQuestions(state().school);
  if(result.removed){
    persist('living-school-hybrid-quiz-sanitized',{removed:result.removed,policy:'never-mix-deterministic-fillers-into-ai-curriculum'});
    document.documentElement.dataset.livingSchoolQuizIntegrity='legacy-fillers-removed';
  }else document.documentElement.dataset.livingSchoolQuizIntegrity='clean';
  return result.removed;
}

async function applyVideoContract(reason='render'){
  const school=state().school;
  if(videoContractBusy||!school?.modules?.length)return false;
  videoContractBusy=true;
  try{
    await ensureLivingSchool(school);
    persist('living-school-video-contract-applied',{reason,moduleCount:school.modules.length,requiredPerModule:1,fallbackUrl:FALLBACK_VIDEO_URL});
    queueMicrotask(()=>renderLivingSchoolEmbed(document,school,state().activeModuleId));
    document.documentElement.dataset.livingSchoolVideoContract='required-per-module';
    return true;
  }finally{videoContractBusy=false;}
}

async function handleLivingSchoolClick(event){
  const target=event.target?.closest?.('[data-ls-action]');
  if(!target)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(target.disabled||busy)return;
  const actionName=String(target.dataset.lsAction||'').trim();
  const action=actions[actionName];
  if(!action)return;
  busy=true;markDispatch();target.setAttribute('aria-busy','true');
  try{
    if(AI_ACTIONS.has(actionName))await ensureAIGuards(`action:${actionName}`);
    await action(target);
    await applyVideoContract(`action:${actionName}`);
  }catch(error){
    console.error('[Living School cleanroom]',error);
    const toast=document.getElementById('lsc218-toast');
    if(toast){toast.textContent=String(error?.message||error);toast.hidden=false}
  }
  finally{busy=false;target.removeAttribute('aria-busy');render();queueMicrotask(()=>renderLivingSchoolEmbed(document,state().school,state().activeModuleId))}
}

function chatCurriculumData(input={}){
  const s=state(),newPath=input?.intent==='new'||input?.newPath===true||input?.replaceExisting===true,rawLevel=clean(input.level,80).toLowerCase(),rawMode=clean(input.mode,80).toLowerCase();
  return{
    title:clean(input.title,240)||(newPath?'':clean(s.school?.title||s.pathContext?.title,240)),
    capability:clean(input.capability,2400)||(newPath?'':clean(s.school?.capability||s.pathContext?.capability,2400)),
    level:LEVELS.has(rawLevel)?rawLevel:newPath?'beginner':LEVELS.has(clean(s.school?.level,80).toLowerCase())?clean(s.school.level,80).toLowerCase():'beginner',
    count:Math.max(1,Math.min(8,Number(input.count||(newPath?4:s.school?.modules?.length||4))||4)),
    mode:MODES.has(rawMode)?rawMode:MODES.has(clean(s.settings?.mode,80).toLowerCase())?clean(s.settings.mode,80).toLowerCase():'guided',
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
  await ensureAIGuards('moss-shared-chat');
  const previous=data.newPath?prepareNewPath(data):null;
  busy=true;markDispatch();
  document.documentElement.dataset.livingSchoolChatAction='generating-curriculum';
  document.documentElement.dataset.livingSchoolPathIntent=data.intent;
  try{
    const school=await generateCurriculumFromData(data,{source:data.newPath?'moss-shared-chat-new-path':'moss-shared-chat',onStage:(stage,detail)=>{
      document.documentElement.dataset.livingSchoolChatStage=stage;
      try{dispatchEvent(new CustomEvent('civweave:living-school-curriculum-stage',{detail:{stage,...detail,title:data.title,capability:data.capability,intent:data.intent}}))}catch{}
    }});
    await ensureLivingSchool(school);
    persist('living-school-video-contract-applied',{reason:'chat-generation',moduleCount:school.modules?.length||0,requiredPerModule:1,fallbackUrl:FALLBACK_VIDEO_URL});
    if(data.newPath)persist('living-school-new-path-replacement-completed',{schoolId:school.id,title:school.title,capability:school.capability,moduleCount:school.modules?.length||0,source:'moss-shared-chat'});
    render();
    queueMicrotask(()=>renderLivingSchoolEmbed(document,school,state().activeModuleId));
    const result={school:copy(school),sourceCount:Number(state().sources?.length||0),research:copy(state().research||null),activeModuleId:state().activeModuleId,intent:data.intent};
    try{dispatchEvent(new CustomEvent('civweave:living-school-curriculum-generated',{detail:{schoolId:school.id,title:school.title,moduleCount:school.modules.length,capability:school.capability,source:data.newPath?'moss-shared-chat-new-path':'moss-shared-chat',intent:data.intent,videoContract:'required-per-module'}}))}catch{}
    return result;
  }catch(error){
    if(data.newPath){restoreLearningState(previous);persist('living-school-new-path-replacement-rolled-back',{title:data.title,capability:data.capability,error:clean(error?.message||error,1000),source:'moss-shared-chat'});}
    throw error;
  }finally{
    busy=false;
    document.documentElement.dataset.livingSchoolChatAction='idle';
    render();
    queueMicrotask(()=>renderLivingSchoolEmbed(document,state().school,state().activeModuleId));
  }
}

sanitizeSavedHybridQuiz();
document.addEventListener('click',handleLivingSchoolClick,true);
render();
document.documentElement.dataset.livingSchoolWorkbench='ready';
applyVideoContract('startup').catch(error=>console.warn('[Living School video contract]',error));
queueMicrotask(()=>renderLivingSchoolEmbed(document,state().school,state().activeModuleId));
globalThis.LivingSchoolCleanroomV218=Object.freeze({version:VERSION,controller:'single-delegated-click-handler',researchAdapter:'live-local-synthesis-source-links-v260',generationGuard:'lazy-source-prompt-v262+quiz-contract-v263+video-generation-guard-v1',quizIntegrity:'ai-only-v263-short-answer-contract',videoContract:'required-per-module',videoFallback:FALLBACK_VIDEO_URL,chatPathIntent:'new-vs-revise-v264',getState:()=>copy(state()),render,dispatchCount:()=>dispatchCount,ensureAIGuards,generateCurriculumFromChat,normalizeChatCurriculum:chatCurriculumData,legacyNavigation:false});
try{dispatchEvent(new CustomEvent('civweave:living-school-workbench-ready',{detail:{version:VERSION,chatCurriculumBridge:true,generationGuard:'lazy-source-prompt-v262+quiz-contract-v263+video-generation-guard-v1',quizIntegrity:'ai-only-v263-short-answer-contract',videoContract:'required-per-module',videoFallback:FALLBACK_VIDEO_URL,chatPathIntent:'new-vs-revise-v264',aiStartupPolicy:'lazy-nonblocking'}}))}catch{}
