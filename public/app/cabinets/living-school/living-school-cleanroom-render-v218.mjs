import{state,root,escapeHtml as e,readJson,availablePaths,activeModule,progressFor,completedModules,progressPercent,setProgress,finalUnlocked,quizQuestions,hasCurrentResearch}from'./living-school-cleanroom-core-v218.mjs';
import{learningJourneySnapshot}from'./living-school-journey-index-v1.mjs?v=multi-plan-library-v2';

const list=items=>`<ul>${(items||[]).map(item=>`<li>${e(item)}</li>`).join('')}</ul>`;
const sourceFor=(s,id)=>s.sources.find(source=>source.id===id);
const hrefFor=value=>{try{const url=new URL(String(value||''));return['http:','https:'].includes(url.protocol)?url.href:''}catch{return''}};
function sourceChip(source){
  const href=hrefFor(source?.url),classes=`lsc218-chip ${source?.verified?'':'is-warn'}`,label=`${source?.title||'Source'} · ${source?.verified?'verified source':source?.provenanceFlag||'unverified'}`;
  return href?`<a class="${classes}" href="${e(href)}" target="_blank" rel="noopener noreferrer" title="Open referenced article">${e(label)} ↗</a>`:`<span class="${classes}" title="No canonical article URL is stored for this source">${e(label)}</span>`;
}
function provenanceMarkup(s,block){
  const sources=(block.sourceIds||[]).map(id=>sourceFor(s,id)).filter(Boolean);
  if(sources.length)return`<div class="lsc218-provenance">${sources.map(sourceChip).join('')}</div>`;
  return`<div class="lsc218-provenance"><span class="lsc218-chip is-warn">${e(block.provenance||'generated-unverified')}</span></div>`;
}
function sourceCard(item){
  const href=hrefFor(item?.url),title=href?`<a href="${e(href)}" target="_blank" rel="noopener noreferrer" title="Open referenced article">${e(item.title)} ↗</a>`:e(item.title),detail=href?`<a href="${e(href)}" target="_blank" rel="noopener noreferrer">Open referenced article</a>`:e(item.notes||'No canonical article URL stored.');
  return`<article class="lsc218-source"><div><b>${title}</b><br><small>${detail}</small><br>${sourceChip(item)}</div><button class="lsc218-button is-danger" type="button" data-ls-action="remove-source" data-source-id="${e(item.id)}">Remove</button></article>`;
}
function visualMarkup(s,module){
  const visual=module.visualization||{},items=visual.items||[],selected=s.visualInspection?.moduleId===module.id?Number(s.visualInspection.index):0;
  const width=600,height=Math.max(150,items.length*54+36);
  const rows=items.map((item,index)=>{const y=28+index*54,active=index===selected;return`<g class="${active?'is-active':''}"><rect x="16" y="${y}" width="568" height="42" rx="12"></rect><text x="34" y="${y+26}">${e(item.label)}</text></g>`}).join('');
  const detail=items[selected]||items[0];
  return`<section class="lsc218-content-block"><h3>${e(visual.title||'Module visualization')}</h3><p>${e(visual.caption||'')}</p><svg class="lsc218-visual" viewBox="0 0 ${width} ${height}" role="img" aria-label="${e(visual.title||'Module visualization')}">${rows}</svg><div class="lsc218-visual-controls">${items.map((item,index)=>`<button type="button" class="lsc218-button ${index===selected?'is-primary':''}" data-ls-action="inspect-visual-item" data-visual-index="${index}">${e(item.label)}</button>`).join('')}</div>${detail?`<div class="lsc218-note"><b>${e(detail.label)}</b><br>${e(detail.detail||'')}</div>`:''}</section>`;
}
function questionMarkup(question,index){
  const prompt=`<div class="lsc218-question-head"><b>${index+1}. ${e(question.prompt)}</b><span>${e(question.type)}</span></div>`;
  if(question.type==='multiple-choice')return`<fieldset class="lsc218-question">${prompt}${(question.options||[]).map(option=>`<label><input type="radio" name="quiz-${index}" value="${e(option)}"> ${e(option)}</label>`).join('')}${question.explanation?'<small>Feedback appears after submission.</small>':''}</fieldset>`;
  if(question.type==='multi-select')return`<fieldset class="lsc218-question">${prompt}${(question.options||[]).map(option=>`<label><input type="checkbox" name="quiz-${index}" value="${e(option)}"> ${e(option)}</label>`).join('')}<small>Select every answer that applies.</small></fieldset>`;
  return`<fieldset class="lsc218-question">${prompt}<label>Answer<textarea name="quiz-${index}"></textarea></label><details><summary>Visible rubric</summary>${list((question.rubric||[]).map(row=>`${row.label} · ${row.points} points${row.required?' · required':''}`))}</details></fieldset>`;
}
const scoreLabel=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value))?`${Math.max(0,Math.min(100,Number(value)))}%`:'Score not stored';
function receiptTime(at,label='Recorded'){
  const date=new Date(at||'');return Number.isFinite(date.getTime())?`<span>${e(label)} <time datetime="${e(at)}">${e(date.toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}))}</time></span>`:'';
}
function learningScene(outcome,title=''){
  if(!outcome)return'';
  const art=globalThis.CivweaveLudModeV1?.isEnabled?.()!==true&&document.documentElement.dataset.civweaveOperatingMode!=='lud';
  return globalThis.CivweaveGuideOutcomeSceneV1?.render?.({guide:'living-school',...outcome,label:outcome.title,title:title||outcome.scope,art,fresh:false})||`<div class="lsc218-result ${outcome.outcome==='revision'?'is-revise':''}"><small>${e(outcome.scope)}</small><h3>${e(outcome.title)}</h3><p>${e(outcome.progressText)}</p><p>${e(outcome.note)}</p></div>`;
}
function quizNextControl(s,module,outcome){
  if(!outcome)return'';
  if(outcome.outcome==='revision')return'<button type="button" class="lsc218-button" data-ls-action="focus-learning-stage" data-ls-stage="module">Review this lesson</button>';
  const modules=s.school?.modules||[],next=modules[modules.findIndex(item=>item.id===module.id)+1];
  return next?.id?`<button type="button" class="lsc218-button" data-ls-action="select-module" data-module-id="${e(next.id)}" data-ls-focus-after="module">Continue: ${e(next.title)}</button>`:'<button type="button" class="lsc218-button" data-ls-action="focus-learning-stage" data-ls-stage="practicum">Open practicum controls</button>';
}
function assessmentMarkup(s,module,progress){
  const questions=quizQuestions(module,progress),attempt=progress?.attempts?.at?.(-1),outcome=moduleAssessmentOutcome(s,module.id),
    feedback=attempt?`<div class="${outcome?'lsc218-assessment-receipt':`lsc218-result ${attempt.passed?'':'is-revise'}`}" ${outcome?`data-ls-quiz-outcome="${e(outcome.receiptId)}"`:''}>${outcome?learningScene(outcome,module.title):`<p><b>${e(scoreLabel(attempt.score))} · ${attempt.passed?'passed':'targeted review'}</b> · Pass target ${e(scoreLabel(module.quiz?.passScore||80))}</p><p>${e(attempt.feedback||module.quiz?.remediation||'Review the saved question feedback before your next attempt.')}</p>`}${attempt.results?.length?`<details><summary>Question feedback · ${Math.min(attempt.results.length,12)} results</summary>${attempt.results.slice(0,12).map((result,index)=>`<p><b>${index+1}. ${e(scoreLabel(result.score))}</b> ${e(result.feedback||'No criterion feedback was stored.')}</p>`).join('')}</details>`:''}${outcome?`<small>Quiz receipt <code class="lsc218-code">${e(outcome.receiptId)}</code> · ${receiptTime(attempt.at)}</small><div class="lsc218-actions">${quizNextControl(s,module,outcome)}</div>`:''}</div>`:'';
  return`<form class="lsc218-form lsc218-assessment"><div class="lsc218-note"><b>Knowledge check</b><br>${questions.length} mixed questions from a bank of ${module.quiz?.bank?.length||questions.length}. Pass at ${module.quiz?.passScore||80}%. Each new attempt rotates the bank.</div>${questions.map(questionMarkup).join('')}<button class="lsc218-button is-primary" type="button" data-ls-action="evaluate-assessment" ${progress?.lessonComplete?'':'disabled'}>Evaluate module assessment</button>${feedback}</form>`;
}
function moduleMarkup(s,module,progress){
  const concepts=(module.concepts||[]).map(item=>typeof item==='string'?{term:item,definition:''}:item);
  return`<section class="lsc218-panel lsc218-lesson" id="lsc218-module" tabindex="-1"><header><div><small>ACTIVE MODULE</small><h2>${e(module.title)}</h2><p>${e(module.summary||module.objective)}</p></div><span>${progress?.assessmentPassed?'assessed':progress?.lessonComplete?'lesson complete':'learning'}</span></header>
  <div class="lsc218-contract-grid"><article><small>OBJECTIVE</small><p>${e(module.objective)}</p></article><article><small>WHY IT MATTERS</small><p>${e(module.relevance)}</p></article><article><small>ESTIMATED EFFORT</small><p>${e(module.estimatedEffort)}</p></article><article><small>REQUIRED ARTIFACT</small><p>${e(module.artifact)}</p></article></div>
  <section class="lsc218-content-block"><h3>Prerequisites</h3>${list(module.prerequisites)}<h3>Learning objectives</h3>${list(module.learningObjectives)}<h3>Completion criteria</h3>${list(module.completionCriteria)}</section>
  <section class="lsc218-content-block"><h3>Concepts and definitions</h3><dl class="lsc218-definitions">${concepts.map(item=>`<div><dt>${e(item.term)}</dt><dd>${e(item.definition||'')}</dd></div>`).join('')}</dl></section>
  ${(module.lessonBlocks||[]).map(block=>`<article class="lsc218-content-block"><h3>${e(block.heading)}</h3><p>${e(block.content)}</p>${provenanceMarkup(s,block)}</article>`).join('')}
  ${visualMarkup(s,module)}
  <section class="lsc218-content-block"><h3>Practice and artifact</h3><p>${e(module.practice?.prompt||module.exercise)}</p><ol>${(module.practice?.steps||[]).map(step=>`<li>${e(step)}</li>`).join('')}</ol><div class="lsc218-note"><b>Deliverable:</b> ${e(module.practice?.deliverable||module.artifact)}<br><b>Completion:</b> ${e(module.practice?.completionCriteria||'')}</div><h4>Practice rubric</h4>${list((module.practice?.rubric||[]).map(row=>`${row.criterion} · ${row.weight}%`))}</section>
  <section class="lsc218-content-block lsc218-reward-contract"><h3>Completion reward and handoff</h3><div class="lsc218-contract-grid"><article><small>BADGE</small><p><b>${e(module.badge?.title||'Module demonstrated')}</b><br>${e(module.badge?.description||'')}</p></article><article><small>SKILL XP</small><p>${e(module.xp?.domain||'learning')} · ${Number(module.xp?.amount||0)} XP</p></article><article><small>NAVIGATION</small><p>${e(module.navigation?.entry||'')}<br>Next: ${e(module.navigation?.next||'final synthesis')}</p></article><article><small>CERBANIMO QUEST</small><p><b>${e(module.cerbanimoQuest?.title||'Practice quest')}</b><br>${e(module.cerbanimoQuest?.brief||'')}</p></article></div><button class="lsc218-button" type="button" data-ls-action="prefill-practicum">Use this Cerbanimo practice quest</button></section>
  <form class="lsc218-form"><label>Working note<textarea name="lessonNote">${e(progress?.note||'')}</textarea></label><button class="lsc218-button" type="button" data-ls-action="save-lesson">Save lesson evidence</button></form>
  ${assessmentMarkup(s,module,progress)}</section>`;
}
function currentProjectReceipt(s){
  const gate=s.projectGate,receipt=gate?.lastReceipt;
  return s.school?.id&&s.practicum?.id&&gate?.requestId&&receipt?.receiptId&&
    receipt.schoolId===s.school.id&&receipt.projectRef===s.practicum.id&&
    gate.projectRef===s.practicum.id&&receipt.requestId===gate.requestId&&
    receipt.status===gate.status&&(receipt.reviewId||receipt.evidenceRef||receipt.acceptedAt||receipt.demo)?receipt:null;
}
export function moduleAssessmentOutcome(s,moduleId){
  const module=s.school?.modules?.find(item=>item.id===moduleId),progress=module&&s.progress?.[module.id],attempt=progress?.attempts?.at?.(-1);
  if(!module?.id||!attempt?.id||typeof attempt.passed!=='boolean'||(attempt.passed&&progress.assessmentPassed!==true))return null;
  const target=scoreLabel(module.quiz?.passScore||80);
  return{kind:'module-quiz',moduleId:module.id,receiptId:attempt.id,outcome:attempt.passed?'accepted':'revision',title:attempt.passed?'Module demonstrated':'A clearer answer is within reach',
    note:attempt.feedback||module.quiz?.remediation||'Review the saved question feedback.',scope:`Module quiz · ${module.title}`,
    progressText:`${scoreLabel(attempt.score)} · pass target ${target}. ${attempt.passed?'Assessment passed. Open the next module or prepare your practicum.':'Review the missed criteria, revise your answer, then try again.'}`,at:attempt.at};
}
function currentCurriculumAssessed(s){
  const modules=s.school?.modules||[],ids=modules.map(module=>module.id),expected=Number(s.school?.requestedModuleCount||modules.length),
    report=s.generationRecovery,matchingReport=report?.requestId&&report.requestId===s.school?.generation?.requestId;
  return Boolean(modules.length&&modules.length<=8&&modules.length===expected&&ids.every(Boolean)&&new Set(ids).size===ids.length&&
    !s.school?.generation?.fallback&&!s.school?.generation?.partial&&!(matchingReport&&report.status!=='complete')&&
    ids.every(id=>s.progress?.[id]?.assessmentPassed===true&&s.progress[id].attempts?.at?.(-1)?.passed!==false));
}
function completedLearningJourney(s,receipt,matchingFinal){
  const modules=s.school?.modules||[],credential=s.credential;
  if(!matchingFinal||s.final.passed!==true||receipt?.status!=='accepted'||receipt.demo||!currentCurriculumAssessed(s)||
    !credential?.credentialId||credential.schoolId!==s.school.id||credential.receiptId!==receipt.receiptId)return null;
  return{kind:'journey-complete',receiptId:credential.credentialId,outcome:'accepted',title:'Learning Journey complete',scope:'Completed Learning Journey',
    note:s.school.capability||credential.title||s.school.title,progressText:`${modules.length}/${modules.length} module assessments passed · practicum accepted · final competency ${scoreLabel(s.final.score)} · portable credential issued`,at:credential.issuedAt};
}
export function currentLearningOutcome(s,action=''){
  const candidates=[],receipt=currentProjectReceipt(s),unlocked=finalUnlocked();
  for(const module of (s.school?.modules||[]).slice(0,8)){
    const outcome=moduleAssessmentOutcome(s,module.id);if(outcome)candidates.push(outcome);
  }
  if(receipt&&['accepted','revision-requested','rejected'].includes(receipt.status))candidates.push({kind:'practicum',receiptId:receipt.receiptId,
    outcome:receipt.status==='accepted'?'accepted':'revision',title:receipt.status==='accepted'?'Practicum review accepted':'Practicum ready for another pass',
    note:receipt.detail||'The current Cerbanimo review receipt is saved with this practicum.',scope:receipt.demo?'Demo practicum':'Practicum review',
    progressText:receipt.status==='accepted'?'Practicum accepted · final assessment is a separate step':'Follow the review before resubmitting',at:receipt.lastEventAt||receipt.acceptedAt||receipt.acknowledgedAt});
  const final=s.final,matchingFinal=Boolean(unlocked&&currentCurriculumAssessed(s)&&receipt&&final?.id&&final.receiptId===receipt.receiptId);
  if(matchingFinal&&typeof final.passed==='boolean')candidates.push({kind:'final',receiptId:final.id,outcome:final.passed?'accepted':'revision',
    title:final.passed?'Final competency demonstrated':'Strengthen the final explanation',note:final.feedback||'',scope:receipt.demo?'Demo final competency':'Final competency',
    progressText:final.passed?'Final passed · issue the credential when ready':'Capability, evidence, uncertainty and revision',at:final.at});
  const complete=completedLearningJourney(s,receipt,matchingFinal);if(complete)candidates.push(complete);
  if(action==='evaluate-assessment')return moduleAssessmentOutcome(s,s.activeModuleId||s.school?.modules?.[0]?.id);
  const kind={'evaluate-final':'final','issue-credential':'journey-complete','import-receipt':'practicum','check-cerbanimo-receipt':'practicum'}[action];
  if(kind)return candidates.find(item=>item.kind===kind)||null;
  if(complete)return complete;
  return candidates.filter(item=>action!=='map'||item.kind!=='module-quiz').sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0))[0]||null;
}
function journeyCompletionMarkup(s,outcome){
  return`<section data-ls-journey-receipt="${e(outcome.receiptId)}" aria-label="Completed Learning Journey receipt">${learningScene(outcome,s.school.title)}<div class="lsc218-contract-grid"><article><small>DEMONSTRATED SKILL</small><p>${e(s.school.capability||s.school.title)}</p></article><article><small>FINAL COMPETENCY</small><p>${e(scoreLabel(s.final.score))} · passed<br>${e(s.final.feedback||'Final capability check passed.')}</p></article><article><small>PRACTICUM RECEIPT</small><p><code class="lsc218-code">${e(s.projectGate.lastReceipt.receiptId)}</code></p></article><article><small>PORTABLE CREDENTIAL</small><p><code class="lsc218-code">${e(outcome.receiptId)}</code><br>${receiptTime(outcome.at,'Completed')}</p></article></div><p>Your completed learning record is saved on this device. Open the credential to inspect it, or copy your record from Passport and recovery.</p><button type="button" class="lsc218-button" data-ls-action="focus-learning-stage" data-ls-stage="credential">View portable credential</button></section>`;
}
function learningJourneyMap(s,journeys,selectedPlan){
  const school=s.school,modules=(school?.modules||[]).slice(0,8),plan=selectedPlan?journeys.plans.find(item=>'plan:'+item.id===selectedPlan.id):journeys.plan,
    outlined=(plan?.modules||[]).slice(0,8),requested=Math.max(modules.length,Math.min(8,Number(school?.requestedModuleCount||(!school&&plan?.request?.count)||modules.length)||0)),
    assessed=modules.filter(item=>item.id&&s.progress?.[item.id]?.assessmentPassed===true).length,
    report=s.generationRecovery,matchingReport=Boolean(report?.requestId&&report.requestId===school?.generation?.requestId),
    receipt=currentProjectReceipt(s),practicumAccepted=receipt?.status==='accepted',unlocked=finalUnlocked(),
    finalPassed=Boolean(unlocked&&currentCurriculumAssessed(s)&&s.final?.passed===true&&s.final.receiptId===receipt?.receiptId),
    credentialIssued=Boolean(completedLearningJourney(s,receipt,finalPassed)),
    approved=Boolean(plan?.state==='approved'&&plan.approvedAt),researchReady=hasCurrentResearch(school?.capability||plan?.request?.capability||''),
    steps=[
      ['plan','Saved plan',approved?'done':school?'recorded':plan?'ready':'pending',approved?(school?'Approved plan saved':'Approved · not generated'):school?'Curriculum saved':plan?'Review required':'Choose a goal','journeys'],
      ['research','Research',researchReady?'recorded':'pending',researchReady?`${s.sources.length} source records`:s.sources.length?`${s.sources.length} attached · research pending`:'Sources needed','sources'],
      ['design','Curriculum',matchingReport&&report.status!=='complete'?'revision':modules.length?'recorded':'pending',modules.length?`${modules.length}/${requested} modules built`:'Not generated','curriculum'],
      ['modules','Learn & assess',assessed===requested&&requested>0?'done':modules.length?'ready':'locked',`${assessed}/${requested||outlined.length||0} assessed`,'modules'],
      ['practicum','Practicum',practicumAccepted?'done':receipt&&['revision-requested','rejected'].includes(receipt.status)?'revision':s.practicum?'ready':'pending',practicumAccepted?'Review accepted':receipt&&['revision-requested','rejected'].includes(receipt.status)?'Revision requested':s.projectGate?.requestId?'Awaiting review':s.practicum?'Artifact saved':'Apply your learning','practicum'],
      ['final','Final check',finalPassed?'done':unlocked?s.final?.passed===false?'revision':'ready':'locked',finalPassed?'Competency passed':unlocked?'Ready to assess':'Assessments + practicum required','final'],
      ['credential','Credential',credentialIssued?'done':finalPassed?'ready':'locked',credentialIssued?'Issued':finalPassed?'Ready to issue':'Final pass required','credential']
    ];
  const stageMarkup=steps.map(([id,title,status,detail,target],index)=>`<li data-learning-stage="${id}" data-state="${status}"><button type="button" data-ls-action="focus-learning-stage" data-ls-stage="${target}" aria-label="${e(title+' · '+detail+'. Open controls')}"><span class="lsc218-map-orb" aria-hidden="true">${status==='done'?'✓':status==='revision'?'↻':index+1}</span><strong>${e(title)}</strong><small>${e(detail)}</small></button></li>`).join('');
  const moduleMarkup=modules.map((module,index)=>{
    const progress=s.progress?.[module.id]||{},attempt=progress.attempts?.at?.(-1),status=progress.assessmentPassed===true?'done':attempt?.passed===false?'revision':progress.lessonComplete===true?'ready':'pending';
    return`<li data-learning-module="${e(module.id)}" data-state="${status}"><span class="lsc218-map-orb" aria-hidden="true">${status==='done'?'✓':index+1}</span><div><button type="button" data-ls-action="select-module" data-module-id="${e(module.id)}" data-ls-focus-after="module" aria-current="${module.id===activeModule()?.id}"><b>${e(module.title)}</b><small>${status==='done'?'Assessment passed':status==='revision'?'Revision requested':status==='ready'?'Evidence saved · assess next':'Open lesson'}</small></button><div class="lsc218-module-milestones" aria-label="Module milestones"><span data-complete="${progress.lessonComplete===true}">Lesson evidence</span><span data-complete="${progress.assessmentPassed===true}">Assessment</span></div></div></li>`;
  }).join('');
  const pendingMarkup=!modules.length&&outlined.length?`<ol class="lsc218-learning-modules">${outlined.map((module,index)=>`<li data-state="pending"><span class="lsc218-map-orb" aria-hidden="true">${index+1}</span><div><b>${e(module.title)}</b><small>Planned · lesson and assessment not generated</small></div></li>`).join('')}</ol>`:'';
  const outcome=currentLearningOutcome(s,'map'),scene=outcome?.kind==='journey-complete'?journeyCompletionMarkup(s,outcome):learningScene(outcome,school?.title||'');
  return`<section class="lsc218-panel lsc218-learning-map" data-ls-journey-map="v1" aria-labelledby="lsc218-map-title"><header><div><small>LEARNING JOURNEY MAP</small><h2 id="lsc218-map-title">From curiosity to demonstrated skill</h2></div><span>${assessed}/${requested||outlined.length||0} assessed</span></header><p>${school?`Current curriculum: <b>${e(school.title)}</b>. `:''}Each step opens its controls. Saved plans, built lessons and demonstrated skills have separate milestones.</p><ol class="lsc218-learning-stages" aria-label="Learning Journey stages">${stageMarkup}</ol>${report?.requestId?`<div class="lsc218-map-build" role="status"><b>Latest build · ${e(report.request?.title||report.request?.capability||'saved attempt')}</b><span>${Number(report.completedCount)||0}/${Number(report.requestedCount)||0} structured modules · ${e(report.status||'saved')}${matchingReport?'':' · separate build record'}</span><button class="lsc218-button" type="button" data-ls-action="focus-learning-stage" data-ls-stage="curriculum">View build controls</button></div>`:''}<details class="lsc218-map-detail" id="lsc218-modules" tabindex="-1" ${modules.length?'open':''}><summary>Module path · ${modules.length?`${assessed}/${requested} assessed`:outlined.length?`${outlined.length} planned`:'not generated'}</summary>${modules.length?`<ol class="lsc218-learning-modules">${moduleMarkup}</ol>`:pendingMarkup||'<p>No generated modules yet. Review a saved plan, then use its explicit Generate control.</p>'}</details>${scene||''}</section>`;
}
export function render(){
  const s=state(),journeys=learningJourneySnapshot(readJson,s),backgroundJob=readJson('civweave.termux-companion.curriculum-job.v1',null),
    selected=[...(Array.isArray(s.events)?s.events:[])].reverse()
      .find(event=>event?.type==='learning-path-selected'&&event.detail?.pathId===s.activePathId),
    planAt=Math.max(Date.parse(journeys.plan?.updatedAt||'')||0,
      Date.parse(journeys.queue?.queuedAt||'')||0,Date.parse(s.generationRecovery?.updatedAt||'')||0,
      Date.parse(s.school?.updatedAt||'')||0),
    routeWins=Boolean(selected&&s.activePathId&&s.pathContext?.id===s.activePathId&&
      (Date.parse(selected.at)||0)>planAt),
    selectedPlan=journeys.generatable.find(item=>item.id===s.settings?.selectedJourneyPlanId)||null,
    draft=selectedPlan?.request||(routeWins?s.pathContext:journeys.focus),
    percent=progressPercent(),paths=availablePaths(),module=activeModule(),
    progress=module?progressFor(module.id):null,
    researchReady=hasCurrentResearch(draft?.capability||s.school?.capability||s.pathContext?.capability||'');
  setProgress(percent);
  const next=document.createElement('div');
  next.innerHTML=`
<section class="lsc218-panel lsc218-hero"><div><span class="lsc218-kicker">ONE CONTINUOUS LEARNING SURFACE</span><h1>${e(draft?.title||s.school?.title||s.pathContext?.title||'What do you want to become capable of doing?')}</h1><p>${e(draft?.capability||s.school?.capability||s.pathContext?.capability||'Every control below is handled once by the same controller.')}</p></div><div class="lsc218-summary"><div class="lsc218-stat"><b>${completedModules()}</b><span>modules assessed</span></div><div class="lsc218-stat"><b>${s.sources.length}</b><span>sources</span></div><div class="lsc218-stat"><b>${s.passport.xp||0}</b><span>learning XP</span></div></div></section>
${learningJourneyMap(s,journeys,selectedPlan)}
<section class="lsc218-panel" id="lsc218-journeys" tabindex="-1" data-ls-journey-index="v1"><header><div><small>LEARNING JOURNEYS</small><h2>Saved plans and curricula</h2></div><span>${journeys.rows.length} saved</span></header>
<div class="lsc218-note">A routed intention can be ready before its curriculum exists. Reviewable plans, approved plans, older chat-recoverable outlines, failed builds and completed curricula are listed separately. Plans saved on a different site or browser are not accessible here.</div>
<div class="lsc218-source-list">
${journeys.rows.map(row=>`<article class="lsc218-source" data-journey-kind="${e(row.kind)}"><div><small>MOSS · ${e(row.status)}</small><br><b>${e(row.title)}</b><br><span>${e(row.capability)}</span>${row.details?`<p>${e(row.details)}</p>`:''}${journeys.plans.some(plan=>'plan:'+plan.id===row.id&&plan.modules?.length)?`<details><summary>Review plan outline</summary><ol>${journeys.plans.find(plan=>'plan:'+plan.id===row.id).modules.map(item=>`<li><b>${e(item.title)}</b> — ${e(item.focus||'')} (${e(item.outcome||'')})</li>`).join('')}</ol></details>`:''}${journeys.generatable.some(item=>item.id===row.id)?`<div class="lsc218-actions"><button class="lsc218-button" type="button" data-ls-action="select-approved-learning-journey" data-journey-id="${e(row.id)}">${selectedPlan?.id===row.id?'Selected plan':'Select this plan'}</button>${selectedPlan?.id===row.id?`<button class="lsc218-button is-primary" type="button" data-ls-action="retry-approved-learning-journey" data-journey-id="${e(row.id)}">Generate selected plan</button>`:''}</div>`:''}${['review','superseded','revision-requested'].includes(row.kind)?`<div class="lsc218-actions"><button class="lsc218-button" type="button" data-ls-action="select-journey-for-review" data-journey-id="${e(row.id)}">Choose for review in Moss</button></div>`:''}${row.kind==='recoverable'?`<div class="lsc218-actions"><button class="lsc218-button" type="button" data-ls-action="recover-chat-journey" data-journey-id="${e(row.id)}">Restore chat plan for review</button></div>`:''}</div></article>`).join('')||'<div class="lsc218-empty">No Learning Journeys saved on this device yet. Review a plan with Moss or generate a curriculum below.</div>'}
</div></section>
${backgroundJob?.capability?`<section class="lsc218-panel" data-companion-background-job><header><div><small>TERMUX · PHONE-OWNED INFERENCE</small><h2>Background curriculum generation</h2></div></header><p>${e(backgroundJob.capability)} · ${e(backgroundJob.state||"pending")} · ${Number(backgroundJob.characters||0).toLocaleString()} characters</p><p>This Qwen job continues in Termux when the browser sleeps. Resume retrieves the same job and compiles the curriculum without requesting another generation.</p><div class="lsc218-actions"><button class="lsc218-button is-primary" type="button" data-ls-action="resume-companion-generation">Resume background generation</button><button class="lsc218-button" type="button" data-ls-action="cancel-companion-generation">Request cancellation</button><button class="lsc218-button" type="button" data-ls-action="dismiss-companion-generation">Dismiss saved job</button></div></section>`:""}
<div class="lsc218-grid"><div class="lsc218-stack">
<section class="lsc218-panel"><header><div><small>INTENTION</small><h2>Choose or define the path</h2></div><span>${paths.length} routed</span></header>${paths.length?`<form class="lsc218-form"><label>Routed path<select name="pathId">${paths.map(item=>`<option value="${e(item.id)}" ${item.id===s.activePathId?'selected':''}>${e(item.title)} · ${e(item.state)}</option>`).join('')}</select></label><button class="lsc218-button" type="button" data-ls-action="apply-path">Use routed path</button></form>`:'<div class="lsc218-note">No routed learning path yet. You can still define one below.</div>'}</section>
<section class="lsc218-panel" id="lsc218-curriculum" tabindex="-1"><header><div><small>CURRICULUM</small><h2>Research, generate, or revise</h2></div><span>${e(s.school?.generation?.provider||'not generated')}</span></header><form class="lsc218-form"><label>Title<input name="title" value="${e(draft?.title||s.school?.title||s.pathContext?.title||'')}"></label><label>Observable capability<textarea name="capability" required>${e(draft?.capability||s.school?.capability||s.pathContext?.capability||'')}</textarea></label><div class="lsc218-row"><label>Level<select name="level"><option>beginner</option><option ${(draft?.level||s.school?.level)==='intermediate'?'selected':''}>intermediate</option><option ${(draft?.level||s.school?.level)==='advanced'?'selected':''}>advanced</option></select></label><label>Modules<input name="count" type="number" min="1" max="8" value="${draft?.count||s.school?.modules?.length||4}"></label></div><div class="lsc218-row"><label>Mode<select name="mode"><option>guided</option><option ${(draft?.mode||s.settings.mode)==='just-in-time'?'selected':''}>just-in-time</option><option ${(draft?.mode||s.settings.mode)==='browse'?'selected':''}>browse</option></select></label><div class="lsc218-note"><b>Generation model</b><br>Follows the model selected in Civweave Settings.</div></div><label>Proof contract<textarea name="proof">${e(draft?.proof||s.school?.proof||s.pathContext?.proof||'A working artifact, explanation, and independent receipt.')}</textarea></label>
<div class="lsc218-research-status ${researchReady?'is-ready':'is-missing'}"><b>${e(s.research?.flag||'RESEARCH REQUIRED')}</b><p>${e(s.research?.summary||'Moss will gather a source packet before generating curriculum. Live Antigravity research is preferred; downloaded Knowledge Schools are the next source layer; model memory is the visibly unverified fallback.')}</p>${s.research?.completedAt?`<small>${e(s.research.mode)} · ${e(s.research.provider||'none')} · ${s.research.sourceCount||0} research items</small>`:''}</div>
<div class="lsc218-actions"><button class="lsc218-button" type="button" data-ls-action="research-sources">Research sources</button><button class="lsc218-button is-primary" type="button" data-ls-action="generate-curriculum">${s.school?'Research & regenerate curriculum':'Research & generate curriculum'}</button></div></form></section>
${s.school?`<section class="lsc218-panel"><header><div><small>MODULES</small><h2>${e(s.school.title)}</h2></div><span>${completedModules()}/${s.school.modules.length}</span></header><div class="lsc218-note"><b>${e(s.school.generation?.formatContract||'living-school-module-contract')}</b><br>${s.school.generation?.sourceCount||0} source records · ${e(s.school.generation?.researchMode||'unknown research mode')}${s.school.generation?.fallback?' · local fallback':''}</div><div class="lsc218-module-rail">${s.school.modules.map((item,index)=>{const itemProgress=progressFor(item.id);return`<button class="lsc218-module" type="button" data-ls-action="select-module" data-module-id="${e(item.id)}" aria-current="${item.id===module?.id}"><span>${index+1}</span><b>${e(item.title)}</b><small>${itemProgress.assessmentPassed?'assessed':itemProgress.lessonComplete?'lesson complete':'not started'}</small></button>`}).join('')}</div></section>`:''}
${module?moduleMarkup(s,module,progress):''}
<section class="lsc218-panel" id="lsc218-practicum" tabindex="-1"><header><div><small>PRACTICUM</small><h2>Apply learning in the world</h2></div><span>${e(s.projectGate?.status||'not started')}</span></header><form class="lsc218-form"><label>Practicum title<input name="practicumTitle" value="${e(s.practicum?.title||'')}"></label><label>Artifact or work produced<textarea name="practicumArtifact">${e(s.practicum?.artifact||'')}</textarea></label><label>Proof and completion condition<textarea name="practicumProof">${e(s.practicum?.proof||'')}</textarea></label><button class="lsc218-button" type="button" data-ls-action="save-practicum">Save practicum</button><div class="lsc218-actions"><button class="lsc218-button" type="button" data-ls-action="create-handoff" ${s.practicum?'':'disabled'}>Send request to Cerbanimo</button><button class="lsc218-button" type="button" data-ls-action="open-cerbanimo">Open Cerbanimo</button><button class="lsc218-button" type="button" data-ls-action="check-cerbanimo-receipt" ${s.projectGate?.requestId?'':'disabled'}>Check Cerbanimo receipt</button></div><label>Import Cerbanimo receipt<textarea name="receiptJson"></textarea></label><button class="lsc218-button" type="button" data-ls-action="import-receipt">Apply receipt</button></form></section>
<section class="lsc218-panel" id="lsc218-final" tabindex="-1"><header><div><small>FINAL GATE</small><h2>Competency and credential</h2></div><span>${finalUnlocked()?'unlocked':'locked'}</span></header><form class="lsc218-form"><label>Explain capability, evidence, uncertainty, and revision<textarea name="finalAnswer">${e(s.final?.answer||'')}</textarea></label><button class="lsc218-button" type="button" data-ls-action="evaluate-final" ${finalUnlocked()?'':'disabled'}>Evaluate final competency</button>${s.final?`<div class="lsc218-result ${s.final.passed?'':'is-revise'}"><b>${Number(s.final.score||0)}% · ${s.final.passed?'passed':'revise'}</b><br>${e(s.final.feedback||'')}</div>`:''}<div id="lsc218-credential" tabindex="-1"><button class="lsc218-button is-primary" type="button" data-ls-action="issue-credential" ${s.final?.passed&&finalUnlocked()?'':'disabled'}>Issue portable credential</button>${s.credential?`<pre class="lsc218-code">${e(JSON.stringify(s.credential,null,2))}</pre>`:''}</div></form></section>
</div><aside class="lsc218-stack">
<section class="lsc218-panel" id="lsc218-sources" tabindex="-1"><header><div><small>SOURCES</small><h2>Evidence context</h2></div><span>${s.sources.length}</span></header>${s.research?`<div class="lsc218-research-status ${s.research.mode==='live-agentic'?'is-ready':'is-missing'}"><b>${e(s.research.flag)}</b><p>${e(s.research.summary)}</p><small>${e(s.research.mode)} · ${e(s.research.model||'')}</small>${s.research.reason?`<details><summary>Research diagnostic details</summary><pre class="lsc218-code">${e(s.research.reason)}</pre></details>`:''}</div>`:''}<form class="lsc218-form"><label>Source title<input name="sourceTitle"></label><label>URL<input name="sourceUrl" type="url"></label><label>Notes<textarea name="sourceNotes"></textarea></label><button class="lsc218-button" type="button" data-ls-action="add-source">Add source</button></form><div class="lsc218-source-list">${s.sources.map(sourceCard).join('')||'<div class="lsc218-empty">No sources attached. Use Research sources before curriculum generation.</div>'}</div></section>
<section class="lsc218-panel"><header><div><small>LOCAL RECORD</small><h2>Passport and recovery</h2></div><span>${s.passport.xp||0} XP</span></header><form class="lsc218-form"><label>Learner name<input name="displayName" value="${e(s.passport.displayName)}"></label><button class="lsc218-button" type="button" data-ls-action="save-profile">Save name</button><button class="lsc218-button" type="button" data-ls-action="copy-record">Copy record</button><label>Restore JSON<textarea name="restoreJson"></textarea></label><button class="lsc218-button" type="button" data-ls-action="restore-record">Restore record</button><button class="lsc218-button is-danger" type="button" data-ls-action="reset-record">Back up and reset</button></form></section>
</aside></div>`;
  globalThis.CivweaveGuideOutcomeSceneV1?.preserve?.(root,next);
  root.replaceChildren(...next.childNodes);
  globalThis.CivweaveGuideOutcomeSceneV1?.bind?.(root);
  document.documentElement.dataset.livingSchoolController='single-click-v218';
  document.documentElement.dataset.livingSchoolCurriculum='research-first-v218.1-source-linked';
}
