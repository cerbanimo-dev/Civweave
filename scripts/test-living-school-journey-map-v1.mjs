import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {learningJourneySnapshot,PLAN_KEY} from '../public/app/cabinets/living-school/living-school-journey-index-v1.mjs';

const renderer=readFileSync(new URL('../public/app/cabinets/living-school/living-school-cleanroom-render-v218.mjs',import.meta.url),'utf8');
const controller=readFileSync(new URL('../public/app/cabinets/living-school/living-school-cleanroom-v218.mjs',import.meta.url),'utf8');
const scenePresenter=readFileSync(new URL('../public/app/shared/guide-outcome-scene-v1.js',import.meta.url),'utf8');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plan=()=>({schema:'civweave.learning-journey-plan.v2',id:'qa-plan',state:'approved',approvedAt:'2026-10-25T17:00:00Z',request:{title:'QA Temperature Conversions',capability:'Convert Celsius and Fahrenheit.',count:3},modules:[{title:'Formulas and units'},{title:'Worked conversions'},{title:'Error checking'}]});
const school=()=>({id:'school-1',title:'Temperature conversion',capability:'Convert Celsius and Fahrenheit.',requestedModuleCount:3,generation:{requestId:'build-1'},modules:[{id:'first',title:'Formulas and units'},{id:'second',title:'Worked conversions'},{id:'third',title:'Error checking'}]});
function fixture(t,changes={},stored={}){
  const dom=new JSDOM('<main id="living-school-root"></main>',{url:'https://civweave.test/app/cabinets/living-school/index.html'});
  t.after(()=>dom.window.close());
  const state={school:null,progress:{},sources:[],settings:{},passport:{displayName:'QA learner',xp:0},events:[],projectGate:{},...changes};
  const root=dom.window.document.querySelector('main'),sceneCalls=[];
  const gateReady=()=>Boolean(state.school?.modules?.length&&state.school.modules.every(item=>state.progress[item.id]?.assessmentPassed===true)&&state.projectGate.status==='accepted'&&state.projectGate.lastReceipt?.schoolId===state.school.id&&state.projectGate.lastReceipt.projectRef===state.practicum?.id&&state.projectGate.lastReceipt.requestId===state.projectGate.requestId);
  const context=vm.createContext({document:dom.window.document,URL,Date,console,Number,Math,Set,Map,JSON,
    root,state:()=>state,readJson:(key,otherwise)=>stored[key]??otherwise,learningJourneySnapshot,escapeHtml:escape,e:escape,
    availablePaths:()=>[],activeModule:()=>state.school?.modules?.find(item=>item.id===state.activeModuleId)||state.school?.modules?.[0]||null,
    progressFor:id=>state.progress[id]||{},completedModules:()=>state.school?.modules?.filter(item=>state.progress[item.id]?.assessmentPassed===true).length||0,
    progressPercent:()=>0,setProgress:()=>{},finalUnlocked:gateReady,quizQuestions:()=>[],hasCurrentResearch:()=>Boolean(state.research?.completedAt),
    CivweaveGuideOutcomeSceneV1:{render:spec=>{sceneCalls.push(spec);return `<section data-guide-outcome-scene="${escape(spec.receiptId)}">${escape(spec.label)} ${escape(spec.title)} ${escape(spec.progressText)} ${escape(spec.note)}</section>`},bind:()=>{},preserve:()=>{}}
  });
  vm.runInContext(renderer.replace(/^import[^\n]*\n/gm,'').replace(/export /g,'')+'\nglobalThis.__render=render;',context);
  const render=()=>context.__render();render();
  return{dom,document:dom.window.document,state,stored,root,context,render,sceneCalls,stage:name=>root.querySelector(`[data-learning-stage="${name}"]`)};
}

test('the active quiz has one nearby receipt with its score, target, date and question feedback',t=>{
  const current=school();current.modules[1].quiz={passScore:85,remediation:'Revisit the worked conversion.'};
  const h=fixture(t,{school:current,activeModuleId:'second',progress:{first:{assessmentPassed:true,attempts:[{id:'unrelated-newer',passed:true,score:100,at:'2026-10-28T12:30:00Z'}]},second:{lessonComplete:true,assessmentPassed:false,attempts:[{id:'quiz-current',passed:false,score:60,feedback:'State units in the final line.',results:[{score:0,feedback:'Show the Celsius unit.'}],at:'2026-10-28T12:00:00Z'}]}}});
  const result=h.root.querySelector('.lsc218-assessment [data-ls-quiz-outcome]');assert.ok(result,'quiz feedback needs an inline visual receipt');
  assert.equal(result.dataset.lsQuizOutcome,'quiz-current');assert.match(result.textContent,/60%/);assert.match(result.textContent,/85%/);assert.match(result.textContent,/State units/);assert.match(result.textContent,/Show the Celsius unit/);assert.equal(result.querySelector('time').dateTime,'2026-10-28T12:00:00Z');
  assert.equal(h.root.querySelectorAll('[data-guide-outcome-scene="quiz-current"]').length,1,'the same receipt must not appear in map and quiz');assert.equal(h.root.querySelector('[data-guide-outcome-scene="unrelated-newer"]'),null,'another module cannot replace the active quiz result');
  assert.equal(result.querySelector('[data-ls-action]').dataset.lsStage,'module','revision points to the lesson without taking another quiz attempt');
  const spec=h.sceneCalls.find(item=>item.receiptId==='quiz-current');assert.equal(spec.outcome,'revision');assert.match(spec.progressText,/60%.*85%/);assert.match(spec.note,/State units/);
});

test('a passed quiz offers the actual next module through the existing selection control',t=>{
  const h=fixture(t,{school:school(),activeModuleId:'first',progress:{first:{assessmentPassed:true,attempts:[{id:'quiz-pass',passed:true,score:100,at:'2026-10-28T12:00:00Z'}]}}}),result=h.root.querySelector('[data-ls-quiz-outcome]'),next=result?.querySelector('[data-ls-action]');
  assert.ok(next);assert.equal(next.dataset.lsAction,'select-module');assert.equal(next.dataset.moduleId,'second');assert.equal(next.dataset.lsFocusAfter,'module');assert.equal(h.sceneCalls.at(-1).outcome,'accepted');
});

const completedJourney=()=>({school:school(),progress:Object.fromEntries(['first','second','third'].map((id,index)=>[id,{assessmentPassed:true,attempts:[{id:`quiz-${id}`,passed:true,score:100,at:`2026-10-27T0${index+7}:00:00Z`}]}])),practicum:{id:'practicum-1'},projectGate:{status:'accepted',projectRef:'practicum-1',requestId:'request-1',lastReceipt:{receiptId:'receipt-1',schoolId:'school-1',projectRef:'practicum-1',requestId:'request-1',status:'accepted',reviewId:'review-1',acceptedAt:'2026-10-27T11:00:00Z'}},final:{id:'final-1',passed:true,score:96,feedback:'Demonstrated the capability and its limits.',receiptId:'receipt-1',at:'2026-10-27T12:00:00Z'},credential:{credentialId:'credential-1',schoolId:'school-1',receiptId:'receipt-1',issuedAt:'2026-10-27T13:00:00Z'}});
test('a fully evidenced current journey receives a completion receipt with its credential identity',t=>{
  const h=fixture(t,completedJourney()),receipt=h.root.querySelector('[data-ls-journey-receipt]');assert.ok(receipt);assert.equal(receipt.dataset.lsJourneyReceipt,'credential-1');assert.match(receipt.textContent,/Learning Journey complete/);assert.match(receipt.textContent,/3\/3/);assert.match(receipt.textContent,/96%/);assert.match(receipt.textContent,/receipt-1/);assert.match(receipt.textContent,/credential-1/);assert.equal(receipt.querySelector('time').dateTime,'2026-10-27T13:00:00Z');
  assert.equal(h.root.querySelectorAll('[data-guide-outcome-scene="credential-1"]').length,1);assert.equal(receipt.querySelector('[data-ls-action]').dataset.lsStage,'credential');
});
test('incomplete builds, mismatched finals, duplicate module identities and demo practicum never get a completed journey receipt',t=>{
  for(const change of [s=>{s.school.requestedModuleCount=4},s=>{s.school.generation.fallback=true},s=>{s.progress.third.assessmentPassed=false},s=>{s.final.receiptId='old-receipt'},s=>{s.credential.schoolId='other-school'},s=>{s.school.modules[2].id='second'},s=>{s.projectGate.lastReceipt.demo=true},s=>{s.generationRecovery={requestId:'build-1',status:'partial',completedCount:2,requestedCount:3}}]){
    const state=completedJourney();change(state);const h=fixture(t,state);assert.equal(h.root.querySelector('[data-ls-journey-receipt]'),null,'all current completion gates must corroborate the receipt');
  }
});

test('an approved plan and failed0/3 build show their actual stages without awarding progress or starting work',t=>{
  const saved=plan(),s={generationRecovery:{requestId:'build-qa',status:'failed',requestedCount:3,completedCount:0,request:saved.request,unstructured:{error:'TIMEOUT'}}};
  const h=fixture(t,s,{[PLAN_KEY]:saved}),before=JSON.stringify(h.state),map=h.root.querySelector('[data-ls-journey-map]');
  assert.ok(map,'Living School needs a visible learning journey map');
  assert.match(map.textContent,/0\/3.*structured modules/s);
  assert.match(map.textContent,/Approved.*not generated/s);
  assert.equal(h.stage('credential').dataset.state,'locked');
  assert.equal(h.stage('final').dataset.state,'locked');
  assert.equal(h.sceneCalls.length,0,'a plan or generation failure is not a successful assessment');
  h.render();assert.equal(JSON.stringify(h.state),before,'rendering may not rewrite saved learning progress');
});

test('module map separates a lesson note, a revision request and a passed assessment using current module IDs',t=>{
  const h=fixture(t,{school:school(),activeModuleId:'second',progress:{first:{lessonComplete:true},second:{lessonComplete:true,assessmentPassed:false,attempts:[{id:'attempt-revise',passed:false,score:60,feedback:'Check units.',at:'2026-10-27T10:00:00Z'}]},third:{lessonComplete:true,assessmentPassed:true,attempts:[{id:'attempt-pass',passed:true,score:100,at:'2026-10-27T09:00:00Z'}]},foreign:{assessmentPassed:true}}});
  const modules=[...h.root.querySelectorAll('[data-learning-module]')];
  assert.equal(modules.length,3);assert.equal(modules[0].dataset.state,'ready');assert.equal(modules[1].dataset.state,'revision');assert.equal(modules[2].dataset.state,'done');
  assert.match(h.stage('modules').textContent,/1\/3 assessed/);
  assert.equal(modules[1].querySelector('button').dataset.lsAction,'select-module');assert.equal(modules[1].querySelector('button').dataset.moduleId,'second');
  assert.equal(modules[1].querySelector('button').getAttribute('aria-current'),'true');
  assert.equal(h.sceneCalls.at(-1).receiptId,'attempt-revise');assert.equal(h.sceneCalls.at(-1).outcome,'revision');assert.equal(h.sceneCalls.at(-1).guide,'living-school');assert.equal(h.sceneCalls.at(-1).fresh,false);
  assert.equal(h.stage('credential').dataset.state,'locked');
});

test('a saved accepted receipt from another school cannot complete practicum, final or credential visuals',t=>{
  const h=fixture(t,{school:school(),practicum:{id:'practicum-1'},projectGate:{status:'accepted',projectRef:'practicum-1',requestId:'request-1',lastReceipt:{receiptId:'foreign-receipt',schoolId:'different-school',projectRef:'practicum-1',requestId:'request-1',status:'accepted',reviewId:'review-1'}},final:{id:'final-old',passed:true,receiptId:'foreign-receipt'},credential:{credentialId:'credential-old',schoolId:'different-school',receiptId:'foreign-receipt'}});
  assert.notEqual(h.stage('practicum').dataset.state,'done');assert.equal(h.stage('final').dataset.state,'locked');assert.equal(h.stage('credential').dataset.state,'locked');assert.equal(h.sceneCalls.length,0);
});

test('a matching accepted practicum stays separate from the final and issued credential',t=>{
  const h=fixture(t,{school:school(),progress:Object.fromEntries(['first','second','third'].map(id=>[id,{assessmentPassed:true}])),practicum:{id:'practicum-1'},projectGate:{status:'accepted',projectRef:'practicum-1',requestId:'request-1',lastReceipt:{receiptId:'receipt-1',schoolId:'school-1',projectRef:'practicum-1',requestId:'request-1',status:'accepted',reviewId:'review-1',acceptedAt:'2026-10-27T11:00:00Z'}}});
  assert.equal(h.stage('practicum').dataset.state,'done');assert.equal(h.stage('final').dataset.state,'ready');assert.notEqual(h.stage('credential').dataset.state,'done');
  h.state.final={id:'final-1',passed:true,receiptId:'receipt-1',at:'2026-10-27T12:00:00Z'};h.render();assert.equal(h.stage('final').dataset.state,'done');assert.equal(h.stage('credential').dataset.state,'ready');
  h.state.credential={credentialId:'credential-1',schoolId:'school-1',receiptId:'receipt-1',issuedAt:'2026-10-27T13:00:00Z'};h.render();assert.equal(h.stage('credential').dataset.state,'done');assert.equal(h.sceneCalls.at(-1).receiptId,'credential-1');
});

test('a different build report is labeled separately and never supplies current curriculum progress',t=>{
  const h=fixture(t,{school:school(),generationRecovery:{requestId:'unrelated-build',status:'complete',completedCount:8,requestedCount:8,request:{title:'Another topic'}}});
  assert.match(h.stage('modules').textContent,/0\/3 assessed/);assert.doesNotMatch(h.stage('modules').textContent,/8\/8/);assert.notEqual(h.stage('final').dataset.state,'done');
});

test('rendering retains a matching outcome scene through the shared presenter preservation contract',t=>{
  const h=fixture(t,{school:school(),progress:{first:{assessmentPassed:true,attempts:[{id:'attempt-1',passed:true,at:'2026-10-27T10:00:00Z'}]}}});
  const scene=h.root.querySelector('[data-guide-outcome-scene]');let preserved=0,bound=0;
  h.context.CivweaveGuideOutcomeSceneV1.preserve=(previous,next)=>{
    assert.equal(previous,h.root);const replacement=next.querySelector('[data-guide-outcome-scene="attempt-1"]');assert.ok(replacement);replacement.replaceWith(scene);preserved++;
  };
  h.context.CivweaveGuideOutcomeSceneV1.bind=host=>{assert.equal(host,h.root);bound++};
  h.render();assert.equal(h.root.querySelector('[data-guide-outcome-scene]'),scene);assert.equal(preserved,1);assert.equal(bound,1);
});

test('the actual shared Moss scene plays only a fresh receipt, stops, and survives an unrelated map redraw',t=>{
  const h=fixture(t,{school:school(),progress:{first:{assessmentPassed:true,attempts:[{id:'attempt-actual',passed:true,at:'2026-10-27T10:00:00Z'}]}}});
  delete h.context.CivweaveGuideOutcomeSceneV1;vm.runInContext(scenePresenter,h.context);
  h.context.CivweaveGuideOutcomeSceneV1.markFresh('attempt-actual');h.render();
  const scene=h.root.querySelector('[data-guide-outcome]');assert.equal(scene.dataset.guide,'living-school');assert.equal(scene.dataset.receiptId,'attempt-actual');assert.equal(scene.dataset.playing,'true');
  assert.match(scene.innerHTML,/moss-review-sprites-v1\.png/);assert.match(scene.innerHTML,/lari-review-sprites-v1\.png/);
  h.render();assert.equal(h.root.querySelector('[data-guide-outcome]'),scene);assert.equal(scene.dataset.playing,'true');
  scene.querySelector('[data-guide-scene-action="stop"]').click();assert.equal(scene.dataset.playing,'false');
  h.render();assert.equal(scene.dataset.playing,'false','ordinary rerender must not replay a stopped scene');
  h.context.CivweaveLudModeV1={isEnabled:()=>true};h.render();
  const textOnly=h.root.querySelector('[data-guide-outcome]');assert.equal(textOnly.dataset.art,'false');assert.equal(textOnly.querySelector('[data-guide-sprite]'),null);assert.match(textOnly.textContent,/Module demonstrated/);
});

test('map controls have local focus destinations and escaped labels instead of executing their learning action',t=>{
  const h=fixture(t,{school:{...school(),title:'<img src=x onerror=alert(1)>'}});
  const map=h.root.querySelector('[data-ls-journey-map]');assert.ok(map);assert.equal(map.querySelector('img'),null);
  for(const button of map.querySelectorAll('[data-ls-action="focus-learning-stage"]')){
    assert.equal(button.type,'button');assert.ok(h.document.getElementById('lsc218-'+button.dataset.lsStage),button.dataset.lsStage);
  }
  const start=controller.indexOf('function focusLearningStage('),end=controller.indexOf('\nfunction chatCurriculumData(',start);
  assert.ok(start>=0&&end>start,'local map focus belongs in the existing delegated controller');
  let scrolled=0;const destination=h.document.getElementById('lsc218-sources');destination.scrollIntoView=()=>scrolled++;
  Object.assign(h.context,{busy:true,retryStarting:false,clean:String,markDispatch:()=>{throw new Error('focus must not dispatch an AI action')},actions:{},renderEnhanced:()=>{},toastMessage:()=>{}});
  vm.runInContext(controller.slice(start,end)+'\nglobalThis.__click=handleLivingSchoolClick;',h.context);
  const button=map.querySelector('[data-ls-stage="sources"]');
  return h.context.__click({target:button,preventDefault(){},stopImmediatePropagation(){}}).then(()=>{assert.equal(scrolled,1);assert.equal(h.document.activeElement,destination)});
});

test('only a newly persisted review outcome from its explicit learning action is marked fresh',async t=>{
  const h=fixture(t,{school:school()}),start=controller.indexOf('function focusLearningStage('),end=controller.indexOf('\nfunction chatCurriculumData(',start),fresh=[];
  Object.assign(h.context,{busy:false,retryStarting:false,clean:String,markDispatch:()=>{},renderEnhanced:h.render,toastMessage:()=>{},
    AI_ACTIONS:new Set(),applyVideoContract:async()=>{},renderLivingSchoolEmbed:()=>{},queueMicrotask:()=>{},
    STATE_KEY:'civweave.living-school.cabinet.v151',copy:value=>JSON.parse(JSON.stringify(value)),
    actions:{'evaluate-assessment':async()=>{h.state.progress.first={assessmentPassed:true,attempts:[{id:'new-attempt',passed:true,at:'2026-10-27T14:00:00Z'}]};h.stored['civweave.living-school.cabinet.v151']=JSON.parse(JSON.stringify(h.state))}}});
  h.context.CivweaveGuideOutcomeSceneV1.markFresh=id=>fresh.push(id);
  vm.runInContext(controller.slice(start,end)+'\nglobalThis.__click=handleLivingSchoolClick;',h.context);
  const target=h.document.createElement('button');target.dataset.lsAction='evaluate-assessment';
  const event={target,preventDefault(){},stopImmediatePropagation(){}};
  await h.context.__click(event);assert.deepEqual(fresh,['new-attempt']);
  await h.context.__click(event);assert.deepEqual(fresh,['new-attempt'],'opening or repeating the same persisted receipt must not celebrate again');
});

test('a quiz persistence error restores the saved result and never marks the failed attempt fresh',async t=>{
  const h=fixture(t,{school:school()}),key='civweave.living-school.cabinet.v151',before=JSON.parse(JSON.stringify(h.state)),fresh=[],messages=[],start=controller.indexOf('function focusLearningStage('),end=controller.indexOf('\nfunction chatCurriculumData(',start);
  h.stored[key]=before;
  Object.assign(h.context,{busy:false,retryStarting:false,clean:String,markDispatch:()=>{},renderEnhanced:h.render,toastMessage:value=>messages.push(value),STATE_KEY:key,copy:value=>JSON.parse(JSON.stringify(value)),replaceState:value=>{for(const key of Object.keys(h.state))delete h.state[key];Object.assign(h.state,JSON.parse(JSON.stringify(value)))},
    console:{...console,error:()=>{}},AI_ACTIONS:new Set(),applyVideoContract:async()=>{},renderLivingSchoolEmbed:()=>{},queueMicrotask:()=>{},actions:{'evaluate-assessment':async()=>{h.state.progress.first={assessmentPassed:true,attempts:[{id:'not-saved',passed:true,score:100,at:'2026-10-28T14:00:00Z'}]};throw new Error('QuotaExceededError: local record could not be saved')}}});
  h.context.CivweaveGuideOutcomeSceneV1.markFresh=id=>fresh.push(id);vm.runInContext(controller.slice(start,end)+'\nglobalThis.__click=handleLivingSchoolClick;',h.context);
  const target=h.document.createElement('button');target.dataset.lsAction='evaluate-assessment';await h.context.__click({target,preventDefault(){},stopImmediatePropagation(){}});
  assert.deepEqual(fresh,[]);assert.equal(h.state.progress.first,undefined);assert.equal(h.root.querySelector('[data-ls-quiz-outcome="not-saved"]'),null);assert.match(messages[0],/could not be saved/);
});

test('a resolved action without its persisted receipt restores the saved record and cannot celebrate',async t=>{
  const h=fixture(t,{school:school()}),fresh=[],start=controller.indexOf('function focusLearningStage('),end=controller.indexOf('\nfunction chatCurriculumData(',start);
  Object.assign(h.context,{busy:false,retryStarting:false,clean:String,markDispatch:()=>{},renderEnhanced:h.render,toastMessage:()=>{},STATE_KEY:'civweave.living-school.cabinet.v151',copy:value=>JSON.parse(JSON.stringify(value)),replaceState:value=>{for(const key of Object.keys(h.state))delete h.state[key];Object.assign(h.state,JSON.parse(JSON.stringify(value)))},console:{...console,error:()=>{}},AI_ACTIONS:new Set(),applyVideoContract:async()=>{},renderLivingSchoolEmbed:()=>{},queueMicrotask:()=>{},actions:{'evaluate-assessment':async()=>{h.state.progress.first={assessmentPassed:true,attempts:[{id:'memory-only',passed:true,at:'2026-10-28T14:00:00Z'}]}}}});
  h.context.CivweaveGuideOutcomeSceneV1.markFresh=id=>fresh.push(id);vm.runInContext(controller.slice(start,end)+'\nglobalThis.__click=handleLivingSchoolClick;',h.context);
  const target=h.document.createElement('button');target.dataset.lsAction='evaluate-assessment';await h.context.__click({target,preventDefault(){},stopImmediatePropagation(){}});assert.deepEqual(fresh,[]);assert.equal(h.state.progress.first,undefined);assert.equal(h.root.querySelector('[data-ls-quiz-outcome="memory-only"]'),null);
});
