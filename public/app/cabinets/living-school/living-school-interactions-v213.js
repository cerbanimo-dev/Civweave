(()=>{
'use strict';
const VERSION='living-school-interactions-v213-direct-surfaces';
if(globalThis.LivingSchoolInteractionsV213?.version===VERSION)return;
const KEY='commonweave.living-school.cabinet.v151';
const frame=globalThis.requestAnimationFrame||((callback)=>setTimeout(callback,16));
const clean=(value,max=6000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
let actionRunning=false;
function readState(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
function emitState(next,oldValue,text){
  try{const event=new Event('storage');Object.defineProperties(event,{key:{value:KEY},oldValue:{value:oldValue},newValue:{value:text},url:{value:location.href},storageArea:{value:localStorage}});dispatchEvent(event)}catch(error){console.warn('[Living School] interaction state event failed',error)}
  try{dispatchEvent(new CustomEvent('living-school:state-replaced',{detail:{key:KEY,state:next}}))}catch{}
}
function writeState(next){const oldValue=(()=>{try{return localStorage.getItem(KEY)||''}catch{return''}})(),text=JSON.stringify(next);localStorage.setItem(KEY,text);emitState(next,oldValue,text);return next}
function toast(message){const node=document.querySelector?.('#toast');if(!node)return;node.textContent=clean(message,1000);node.hidden=false;clearTimeout(node._lsi213);node._lsi213=setTimeout(()=>node.hidden=true,4200)}
function safeOpenDialog(dialog){if(dialog.open)return true;try{dialog.showModal();return true}catch{}try{dialog.show();return true}catch{}try{dialog.setAttribute('open','');return true}catch{return false}}
function closeOverlays(){const drawer=document.querySelector?.('#drawer');if(drawer)drawer.hidden=true}
function activeModule(state){return state?.school?.modules?.find(module=>module.id===state.activeModuleId)||state?.school?.modules?.[0]||null}
function progressFor(state,moduleId){return state?.progress?.[moduleId]||{lessonComplete:false,assessmentPassed:false,attempts:[],evidence:[]}}
function openPanel(title,markup){
  closeOverlays();
  const content=document.querySelector?.('#instrument-content'),dialog=document.querySelector?.('#instrument-dialog');
  if(!content||!dialog){toast(`${title} could not open.`);return false}
  content.innerHTML=`<h2 id="instrument-title">${esc(title)}</h2>${markup}`;
  if(!safeOpenDialog(dialog)){toast(`${title} could not open.`);return false}
  frame(()=>content.querySelector?.('textarea,input,select,button')?.focus?.());return true;
}
function openLesson(){
  const current=readState(),module=activeModule(current);if(!current?.school||!module){toast('Choose a generated curriculum module first.');return false}
  const progress=progressFor(current,module.id);
  return openPanel(module.title,`<div class="ls-callout"><strong>Objective:</strong> ${esc(module.objective||'')}</div><section class="lsi213-lesson-copy"><h3>Lesson</h3><p>${esc(module.lesson||'No lesson content was generated.')}</p><h3>Practice while learning</h3><p>${esc(module.exercise||'No practice activity was generated.')}</p></section><form class="ls-form" data-lsi213-lesson-form data-module-id="${esc(module.id)}"><label>Working note<textarea name="note" required>${esc(progress.note||'')}</textarea></label><button class="ls-primary" type="submit">${progress.lessonComplete?'Update lesson evidence':'Complete lesson'}</button></form>`);
}
function saveLesson(form){
  const current=readState(),moduleId=clean(form.dataset.moduleId,180),module=current?.school?.modules?.find(item=>item.id===moduleId);if(!current||!module)throw new Error('The active lesson is no longer available.');
  const note=clean(new FormData(form).get('note'),8000);if(!note)throw new Error('Add a working note before completing the lesson.');
  const previous=progressFor(current,moduleId),firstCompletion=!previous.lessonComplete;
  const evidence=[...(previous.evidence||[]),{id:uid('evidence'),type:'lesson-note',detail:{note},at:now()}].slice(-30);
  const progress={...current.progress,[moduleId]:{...previous,lessonComplete:true,note,evidence}};
  let passport=current.passport||{learnerId:uid('learner'),displayName:'Local learner',xp:0,ledger:[]};
  if(firstCompletion)passport={...passport,xp:Number(passport.xp||0)+5,ledger:[...(passport.ledger||[]),{id:uid('xp'),amount:5,reason:'Lesson evidence recorded',ref:moduleId,at:now()}].slice(-500)};
  const next={...current,activeModuleId:moduleId,progress,passport,events:[...(current.events||[]),{id:uid('evt'),type:'lesson-completed',detail:{moduleId},at:now()}].slice(-200)};
  writeState(next);try{document.querySelector?.('#instrument-dialog')?.close?.()}catch{}globalThis.LivingSchoolWorkbenchV158?.render?.();toast('Lesson evidence saved.');return true;
}
function openAssessment(){
  const current=readState(),module=activeModule(current);if(!current?.school||!module){toast('Choose a generated curriculum module first.');return false}
  const progress=progressFor(current,module.id),attempt=progress.attempts?.at?.(-1)||progress.attempts?.[progress.attempts.length-1];
  return openPanel('Assessment Studio',`<div class="ls-callout">Visible criteria: explain the principle, apply it, and name inspectable evidence.</div><form class="ls-form" data-lsi213-assessment-form data-module-id="${esc(module.id)}"><fieldset><legend>Which record is strongest evidence?</legend><label class="ls-checkbox"><input type="radio" name="mc" value="a" required> A confident claim without an artifact</label><label class="ls-checkbox"><input type="radio" name="mc" value="b"> A dated artifact, explanation, and reviewable receipt</label><label class="ls-checkbox"><input type="radio" name="mc" value="c"> A vocabulary list</label></fieldset><label>${esc(module.question||'Explain what you learned and the evidence that supports it.')}<textarea name="answer" required>${esc(attempt?.answer||'')}</textarea></label><button class="ls-primary" type="submit">Evaluate with retained rubric</button></form>${attempt?`<div class="ls-callout ${attempt.passed?'':'ls-warning'}">Score ${Number(attempt.score||0)}% · ${attempt.passed?'passed':'revise'}<br>${esc(attempt.feedback||'')}</div>`:''}`);
}
function saveAssessment(form){
  const current=readState(),moduleId=clean(form.dataset.moduleId,180),module=current?.school?.modules?.find(item=>item.id===moduleId);if(!current||!module)throw new Error('The active assessment is no longer available.');
  const data=Object.fromEntries(new FormData(form).entries()),answer=clean(data.answer,12000),rubric=globalThis.LivingSchoolCabinetV151?.modules?.rubric;
  if(!answer)throw new Error('Write an answer before evaluating it.');
  const evaluation=rubric?.evaluateShortAnswer?.({prompt:module.question,response:answer,lessonExcerpt:module.lesson,criteria:[{id:'principle',label:'Explain the principle',description:'Explain why this matters.',points:3,role:'principle',required:true},{id:'application',label:'Apply it',description:'Connect the idea to a concrete workflow.',points:3,role:'application',required:true},{id:'evidence',label:'Name evidence',description:'Identify a record, artifact, measure, or receipt.',points:4,role:'evidence',required:true}],minWords:18,maxWords:280})||{ok:answer.split(/\s+/).length>=18,uncertain:false,score:answer.split(/\s+/).length>=18?75:35,feedback:answer.split(/\s+/).length>=18?'Answer has enough detail for local review.':'Add more detail and inspectable evidence.'};
  const mc=data.mc==='b',passed=mc&&evaluation.ok&&!evaluation.uncertain,previous=progressFor(current,moduleId),wasPassed=previous.assessmentPassed;
  const attempt={id:uid('attempt'),answer,mc,score:Math.round(Number(evaluation.score||0)*.8+(mc?20:0)),passed,feedback:mc?evaluation.feedback:`Choose inspectable evidence. ${evaluation.feedback}`,evaluation,at:now()};
  const evidence=[...(previous.evidence||[]),{id:uid('evidence'),type:'assessment',detail:attempt,at:now()}].slice(-30);
  const progress={...current.progress,[moduleId]:{...previous,attempts:[...(previous.attempts||[]),attempt].slice(-12),assessmentPassed:passed,evidence}};
  let passport=current.passport||{learnerId:uid('learner'),displayName:'Local learner',xp:0,ledger:[]};
  if(passed&&!wasPassed)passport={...passport,xp:Number(passport.xp||0)+15,ledger:[...(passport.ledger||[]),{id:uid('xp'),amount:15,reason:'Module assessment passed',ref:moduleId,at:now()}].slice(-500)};
  const next={...current,activeModuleId:moduleId,progress,passport,events:[...(current.events||[]),{id:uid('evt'),type:'assessment-evaluated',detail:{moduleId,score:attempt.score,passed,authority:evaluation.authority||'retained-rubric'},at:now()}].slice(-200)};
  writeState(next);globalThis.LivingSchoolWorkbenchV158?.render?.();openAssessment();return true;
}
function selectModule(moduleId){
  const current=readState();if(!current?.school?.modules?.some(module=>module.id===moduleId))return false;
  writeState({...current,activeModuleId:moduleId});globalThis.LivingSchoolWorkbenchV158?.render?.();frame(()=>document.querySelector?.('.lsw-reader')?.scrollIntoView?.({behavior:'auto',block:'start'}));return true;
}
function hideUnfinishedMenu(){
  const button=document.querySelector?.('#actions');if(button){button.hidden=true;button.setAttribute('aria-hidden','true');button.tabIndex=-1}
  const drawer=document.querySelector?.('#drawer');if(drawer)drawer.hidden=true;
  document.documentElement.dataset.livingSchoolMenu='deferred';
}
function run(label,action){if(actionRunning)return;actionRunning=true;try{return action()}catch(error){console.error(`[Living School] ${label} failed`,error);toast(`${label} could not complete: ${clean(error.message,800)}`)}finally{(globalThis.queueMicrotask||((callback)=>Promise.resolve().then(callback)))(()=>{actionRunning=false})}}
function handleClick(event){
  const menu=event.target?.closest?.('#actions,[data-drawer]');if(menu){event.preventDefault();event.stopPropagation();hideUnfinishedMenu();toast('The room menu is not part of this console yet. Use the visible curriculum controls.');return}
  const close=event.target?.closest?.('#drawer-close');if(close){event.preventDefault();event.stopPropagation();closeOverlays();return}
  const module=event.target?.closest?.('[data-lsw-module]');if(module){event.preventDefault();event.stopPropagation();return run('Choose module',()=>selectModule(module.dataset.lswModule))}
  if(event.target?.closest?.('[data-lsw-settings]')){event.preventDefault();event.stopPropagation();return run('Open AI settings',()=>globalThis.CommonweaveFamilyAILoaderV105?.openSettings?.())}
  const action=event.target?.closest?.('[data-lsw-action]')?.dataset.lswAction;if(!action||action==='research')return;
  event.preventDefault();event.stopPropagation();
  if(action==='forge')return run('Generate curriculum',()=>globalThis.LivingSchoolPathsV160?.openGenerator?.());
  if(action==='map')return run('View curriculum',()=>globalThis.LivingSchoolPathsV160?.viewCurriculum?.());
  if(action==='lesson')return run('Open full lesson',openLesson);
  if(action==='assessment')return run('Open assessment',openAssessment);
}
function handleSubmit(event){
  const lesson=event.target?.closest?.('[data-lsi213-lesson-form]');if(lesson){event.preventDefault();event.stopPropagation();return run('Save lesson',()=>saveLesson(lesson))}
  const assessment=event.target?.closest?.('[data-lsi213-assessment-form]');if(assessment){event.preventDefault();event.stopPropagation();return run('Evaluate assessment',()=>saveAssessment(assessment))}
}
function boot(){hideUnfinishedMenu();document.addEventListener('click',handleClick,true);document.addEventListener('submit',handleSubmit,true)}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
globalThis.LivingSchoolInteractionsV213={version:VERSION,openLesson,openAssessment,selectModule,hideMenu:hideUnfinishedMenu};
})();
