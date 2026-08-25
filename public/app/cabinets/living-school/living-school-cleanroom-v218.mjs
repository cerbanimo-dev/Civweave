import{copy,state,persist,VERSION,clean,progressFor,escapeHtml as e,regenerateLivingSchoolResearch,regenerateLivingSchoolStructure,discardLivingSchoolFailedDrafts}from'./living-school-cleanroom-core-v218.mjs';
import{render}from'./living-school-cleanroom-render-v218.mjs?v=model-authority-v323';
import{actions,generateCurriculumFromData,stripLegacyFallbackQuestions}from'../../living-school-cleanroom-actions-v243.mjs?v=flash-recovery-v220';
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
const AI_ACTIONS=new Set(['research-sources','generate-curriculum','regenerate-ls-research','regenerate-ls-structure']);
const AI_GUARD_TIMEOUT_MS=45000;
const RECOVERY_PANEL_ID='lsc220-generation-recovery';

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
function toastMessage(message){
  const toast=document.getElementById('lsc218-toast');
  if(toast){toast.textContent=clean(message,1000);toast.hidden=false}
}
function reconcileProgressById(previous={}){
  const s=state();if(!s.school?.modules?.length)return;
  const current=s.progress||{};
  s.progress=Object.fromEntries(s.school.modules.map(module=>[module.id,copy(previous[module.id]||current[module.id]||progressFor(module.id))]));
  persist('living-school-generation-progress-reconciled',{schoolId:s.school.id,moduleIds:s.school.modules.map(module=>module.id),policy:'preserve-progress-by-exact-module-id'});
}
function recoveryModuleNumber(module,index){
  const explicit=Number(module?.generationIndex);if(Number.isInteger(explicit)&&explicit>=0)return explicit+1;
  const match=clean(module?.id,120).match(/^module-(\d+)$/i);return match?Number(match[1]):index+1;
}
function recoveryHistoryMarkup(report){
  const history=Array.isArray(report?.history)?report.history:[];
  if(!history.length)return'';
  return`<details><summary>Generation attempt history</summary><div class="lsc218-source-list">${history.map(row=>`<div class="lsc218-note"><b>${e(row.label||'structured pass')} ${Number(row.attempt||0)}</b><br>${Number(row.completedCount||0)}/${Number(row.requestedCount||report.requestedCount||0)} complete · ${Number(row.failedCount||0)} still missing${row.at?` · ${e(new Date(row.at).toLocaleString())}`:''}</div>`).join('')}</div></details>`;
}
function recoveryDraftMarkup(report){
  const failed=(Array.isArray(report?.modules)?report.modules:[]).filter(row=>row.status!=='complete');
  if(!failed.length)return'';
  return`<div class="lsc218-source-list">${failed.map(row=>`<article class="lsc218-source"><div><b>Module ${Number(row.index)+1} · ${e(row.status||'failed')}</b><br><small>${e((row.issues||[]).join(' · ')||'Structured output did not validate.')}</small>${row.raw?`<details><summary>Inspect quarantined draft</summary><pre class="lsc218-code">${e(row.raw)}</pre></details>`:row.discarded?'<small>Failed draft removed; the missing module slot remains available for regeneration.</small>':''}</div></article>`).join('')}</div>`;
}
function renderRecoveryPanel(){
  document.getElementById(RECOVERY_PANEL_ID)?.remove();
  const s=state(),report=s.generationRecovery;
  if(!report?.requestId)return;
  const curriculumButton=document.querySelector('[data-ls-action="generate-curriculum"]'),anchor=curriculumButton?.closest?.('.lsc218-panel');
  if(!anchor)return;
  const panel=document.createElement('section');panel.id=RECOVERY_PANEL_ID;panel.className='lsc218-panel';
  const complete=Number(report.completedCount||0),requested=Number(report.requestedCount||0),failed=Math.max(0,Number(report.failedCount??requested-complete)),activeCandidate=s.school?.generation?.requestId===report.requestId;
  const statusLabel=report.status==='complete'?'complete':report.status==='partial'?'partial generation':'needs recovery';
  const rawAvailable=(report.modules||[]).some(row=>row.status!=='complete'&&row.raw)||(report.batches||[]).some(row=>row.raw);
  const design=report.unstructured||{};
  panel.innerHTML=`<header><div><small>GENERATION REPORT</small><h2>${complete}/${requested} structured modules complete</h2></div><span>${e(statusLabel)}</span></header>
  <div class="lsc218-note"><b>Gemini 3.7 design → local compile</b><br>Research/design: ${e(design.model||design.provider||'source packet')} · local structured pass ${Number(report.structureAttempt||0)} · ${failed} module${failed===1?'':'s'} still need${failed===1?'s':''} attention.${activeCandidate&&failed?' Invalid drafts are quarantined and cannot unlock the final credential.':''}</div>
  ${design.content?`<details ${report.status==='failed'?'open':''}><summary>View unstructured research/design content</summary><pre class="lsc218-code">${e(design.content)}</pre>${design.error?`<div class="lsc218-note"><b>Research/design note</b><br>${e(design.error)}</div>`:''}</details>`:''}
  ${recoveryDraftMarkup(report)}
  ${recoveryHistoryMarkup(report)}
  ${report.status!=='complete'?`<div class="lsc218-actions"><button class="lsc218-button" type="button" data-ls-action="regenerate-ls-research">Regenerate research/design</button><button class="lsc218-button is-primary" type="button" data-ls-action="regenerate-ls-structure">Regenerate ${failed||'failed'} structured module${failed===1?'':'s'}</button>${rawAvailable?'<button class="lsc218-button is-danger" type="button" data-ls-action="discard-ls-failed-drafts">Remove failed drafts</button>':''}</div>`:'<div class="lsc218-note"><b>Structured generation complete.</b><br>All requested modules validated and retained their required video companions.</div>'}`;
  anchor.insertAdjacentElement('afterend',panel);
  if(activeCandidate){
    const modules=s.school?.modules||[],buttons=[...document.querySelectorAll('.lsc218-module')];
    buttons.forEach((button,index)=>{const module=modules.find(item=>item.id===button.dataset.moduleId)||modules[index],badge=button.querySelector('span');if(badge&&module)badge.textContent=String(recoveryModuleNumber(module,index))});
    if(report.status!=='complete'){
      for(const selector of ['[data-ls-action="evaluate-final"]','[data-ls-action="issue-credential"]']){
        const button=document.querySelector(selector);if(button){button.disabled=true;button.title='Complete the missing generated modules before the final credential gate.'}
      }
    }
  }
  document.documentElement.dataset.livingSchoolGenerationRecovery=report.status||'unknown';
}
function renderEnhanced(){render();renderRecoveryPanel();}

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

const originalGenerateCurriculumAction=actions['generate-curriculum'];
if(originalGenerateCurriculumAction)actions['generate-curriculum']=async target=>{
  const previous=copy(state().progress||{});await originalGenerateCurriculumAction(target);reconcileProgressById(previous);
};
actions['regenerate-ls-research']=async target=>{
  target.disabled=true;target.textContent='Regenerating research/design…';
  const report=await regenerateLivingSchoolResearch();
  toastMessage(`Research/design regenerated. ${report.completedCount}/${report.requestedCount} structured modules remain preserved.`);
};
actions['regenerate-ls-structure']=async target=>{
  const before=state().generationRecovery?.completedCount||0;target.disabled=true;target.textContent='Regenerating failed modules…';
  const school=await regenerateLivingSchoolStructure(),report=state().generationRecovery||{},after=Number(report.completedCount||0);
  toastMessage(after>before?`Structured regeneration made progress: ${after}/${report.requestedCount} modules complete.`:report.status==='complete'?`All ${after} modules are complete.`:`No new module completed this attempt. The report keeps the failed drafts visible for another retry.`);
  return school;
};
actions['discard-ls-failed-drafts']=async target=>{
  target.disabled=true;const removed=discardLivingSchoolFailedDrafts();toastMessage(removed?`Removed ${removed} failed draft${removed===1?'':'s'}; completed modules were untouched.`:'No failed draft content remained to remove.');
};

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
    toastMessage(String(error?.message||error));
  }
  finally{busy=false;target.removeAttribute('aria-busy');renderEnhanced();queueMicrotask(()=>renderLivingSchoolEmbed(document,state().school,state().activeModuleId))}
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
  return copy({school:s.school||null,progress:s.progress||{},activeModuleId:s.activeModuleId||'',pathContext:s.pathContext||null,research:s.research||null,sources:s.sources||[],visualInspection:s.visualInspection||null,generationRecovery:s.generationRecovery||null});
}
function restoreLearningState(snapshot){
  if(!snapshot)return;
  const s=state();
  s.school=copy(snapshot.school);s.progress=copy(snapshot.progress||{});s.activeModuleId=snapshot.activeModuleId||'';s.pathContext=copy(snapshot.pathContext);s.research=copy(snapshot.research);s.sources=copy(snapshot.sources||[]);s.visualInspection=copy(snapshot.visualInspection);s.generationRecovery=copy(snapshot.generationRecovery);
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
  s.generationRecovery=null;
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
    const priorProgress=copy(state().progress||{});
    const school=await generateCurriculumFromData(data,{source:data.newPath?'moss-shared-chat-new-path':'moss-shared-chat',onStage:(stage,detail)=>{
      document.documentElement.dataset.livingSchoolChatStage=stage;
      try{dispatchEvent(new CustomEvent('civweave:living-school-curriculum-stage',{detail:{stage,...detail,title:data.title,capability:data.capability,intent:data.intent}}))}catch{}
    }});
    reconcileProgressById(priorProgress);
    await ensureLivingSchool(school);
    persist('living-school-video-contract-applied',{reason:'chat-generation',moduleCount:school.modules?.length||0,requiredPerModule:1,fallbackUrl:FALLBACK_VIDEO_URL});
    if(data.newPath)persist('living-school-new-path-replacement-completed',{schoolId:school.id,title:school.title,capability:school.capability,moduleCount:school.modules?.length||0,source:'moss-shared-chat'});
    renderEnhanced();
    queueMicrotask(()=>renderLivingSchoolEmbed(document,school,state().activeModuleId));
    const result={school:copy(school),sourceCount:Number(state().sources?.length||0),research:copy(state().research||null),generationRecovery:copy(state().generationRecovery||null),activeModuleId:state().activeModuleId,intent:data.intent};
    try{dispatchEvent(new CustomEvent('civweave:living-school-curriculum-generated',{detail:{schoolId:school.id,title:school.title,moduleCount:school.modules.length,requestedModuleCount:school.requestedModuleCount||school.modules.length,capability:school.capability,source:data.newPath?'moss-shared-chat-new-path':'moss-shared-chat',intent:data.intent,videoContract:'required-per-module',generationStatus:state().generationRecovery?.status||'complete'}}))}catch{}
    return result;
  }catch(error){
    if(data.newPath){restoreLearningState(previous);persist('living-school-new-path-replacement-rolled-back',{title:data.title,capability:data.capability,error:clean(error?.message||error,1000),source:'moss-shared-chat'});}
    throw error;
  }finally{
    busy=false;
    document.documentElement.dataset.livingSchoolChatAction='idle';
    renderEnhanced();
    queueMicrotask(()=>renderLivingSchoolEmbed(document,state().school,state().activeModuleId));
  }
}

sanitizeSavedHybridQuiz();
document.addEventListener('click',handleLivingSchoolClick,true);
renderEnhanced();
document.documentElement.dataset.livingSchoolWorkbench='ready';
applyVideoContract('startup').catch(error=>console.warn('[Living School video contract]',error));
queueMicrotask(()=>renderLivingSchoolEmbed(document,state().school,state().activeModuleId));
globalThis.LivingSchoolCleanroomV218=Object.freeze({version:VERSION,controller:'single-delegated-click-handler',researchAdapter:'single-3.7-design+local-compile-v1',generationGuard:'lazy-source-prompt-v262+quiz-contract-v263+video-generation-guard-v1',quizIntegrity:'ai-only-v263-short-answer-contract',videoContract:'required-per-module',videoFallback:FALLBACK_VIDEO_URL,generationRecovery:'visible-partial-report-v220',chatPathIntent:'new-vs-revise-v264',getState:()=>copy(state()),render:renderEnhanced,dispatchCount:()=>dispatchCount,ensureAIGuards,generateCurriculumFromChat,normalizeChatCurriculum:chatCurriculumData,legacyNavigation:false});
try{dispatchEvent(new CustomEvent('civweave:living-school-workbench-ready',{detail:{version:VERSION,chatCurriculumBridge:true,researchAdapter:'single-3.7-design+local-compile-v1',generationRecovery:'visible-partial-report-v220',generationGuard:'lazy-source-prompt-v262+quiz-contract-v263+video-generation-guard-v1',quizIntegrity:'ai-only-v263-short-answer-contract',videoContract:'required-per-module',videoFallback:FALLBACK_VIDEO_URL,chatPathIntent:'new-vs-revise-v264',aiStartupPolicy:'lazy-nonblocking'}}))}catch{}
