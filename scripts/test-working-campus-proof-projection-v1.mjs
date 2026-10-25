import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const read=path=>fs.readFileSync(new URL(`../public/${path}`,import.meta.url),'utf8');
const campusSource=[1,2,3,4,5].map(index=>read(`app/working-campus-v156.part${index}.txt`)).join('');
const campusKey='civweave.working-campus.v1',intentionsKey='civweave.intentions.v127';
const plan=(id='qa-current')=>({id,title:`Quest ${id}`,wish:'A fictional digital note',outcome:'Write alpha beta gamma.',state:'active',createdAt:'2026-10-24T00:00:00Z',paths:[{id:'qa-note',realm:'cerbanimo',title:'Create a digital note',purpose:'Write a cumulative note',steps:['Write alpha','Add beta','Add gamma'],progress:[],status:'active'}],governance:{title:'QA passport',purpose:'Local fictional QA',agreements:[]}});
function fixture(t,{stage='active'}={}){
  const dom=new JSDOM(read('app/working-campus-v440.html'),{url:'https://civweave.test/app/working-campus-v440.html',runScripts:'outside-only'}),{window}=dom;
  const observers=[],Observer=window.MutationObserver;
  window.MutationObserver=class extends Observer{constructor(callback){super(callback);observers.push(this)}};
  t.after(()=>{for(const observer of observers)observer.disconnect();window.close()});
  Object.defineProperty(window.document,'readyState',{value:'complete',configurable:true});
  window.structuredClone=structuredClone;window.requestAnimationFrame=()=>0;window.setTimeout=()=>0;window.clearTimeout=()=>{};
  window.CivweaveProgressiveDisclosureV1={};
  const current=plan();
  window.localStorage.setItem(campusKey,JSON.stringify({stage,view:'quest',mode:'guided',wish:'Preserve the draft governing intention',plan:current,conversation:[{role:'guide',text:'Existing local conversation'}]}));
  window.localStorage.setItem(intentionsKey,JSON.stringify([{id:current.id,kind:'weave-plan',state:'active',plan:current}]));
  window.eval(campusSource);
  window.eval(read('app/cerbanimo-quest-engine-v144.js'));
  window.eval(read('app/cerbanimo-quest-path-v266.js'));
  window.CivweaveFamilyAILoaderV105={ensure:async()=>true};
  window.CivweaveModelRuntime={readSharedConfig:()=>({provider:'ollama',model:'qa-fixture'}),generate:async()=>({status:'success',actual:{provider:'ollama',model:'qa-fixture'},requestId:'qa-review-fixture',outputJson:{decision:'pass',confidence:.99,summary:'Fixture accepted',criteria:[],concerns:[],repairInstructions:[],unmetCriteria:[]}})};
  window.eval(read('app/cerbanimo-ai-validator-v159.js'));
  window.eval(read('extensions/civweave-proof-progress-v158.js'));
  const materialized=window.CivweaveCerbanimoQuestPathV266.materialize();assert.equal(materialized.ok,true);
  return{window,current,quest:materialized.quest,engine:window.CivweaveCerbanimoQuestV144,validator:window.CerbanimoAIValidatorV159,read:()=>JSON.parse(window.localStorage.getItem(campusKey))};
}
async function acceptTask(app,task){
  app.engine.applyTaskTransition(app.quest.id,task.id,'in-progress');app.engine.addProof(app.quest.id,task.id,{kind:'test',value:'Cumulative QA note proof.'});app.engine.applyTaskTransition(app.quest.id,task.id,'review');await app.validator.validateTask(app.quest.id,task.id);
}
async function accept(app){
  for(const task of app.quest.tasks)await acceptTask(app,task);
  app.engine.submitQuest(app.quest.id);await app.validator.validateQuest(app.quest.id);
}

test('accepted native proof and reopening update campus checkboxes and state without reloading or stale overwrite',async t=>{
  const app=fixture(t),{window}=app;
  window.document.getElementById('weaveling-chat-input').value='Unsent chat draft';
  await accept(app);
  assert.equal(window.document.querySelectorAll('[data-step]:checked').length,3);
  assert.match(window.document.getElementById('workspace').textContent,/QUEST COMPLETE/);
  assert.equal(window.document.getElementById('state-label').textContent,'completed');
  assert.equal(app.read().wish,'Preserve the draft governing intention');
  assert.equal(window.document.getElementById('weaveling-chat-input').value,'Unsent chat draft');
  assert.equal(app.read().conversation[0].text,'Existing local conversation');
  const checkbox=window.document.querySelector('[data-step]');
  window.dispatchEvent(new window.CustomEvent('civweave:proof-progress-synced',{detail:{planId:app.current.id}}));
  assert.equal(window.document.querySelector('[data-step]'),checkbox,'An unchanged proof event must not redraw the campus.');
  window.document.querySelector('[data-quest-mode="roam"]').click();
  assert.equal(app.read().plan.state,'completed','Ordinary view rendering must not overwrite accepted proof with stale closure state.');
  app.engine.applyTaskTransition(app.quest.id,app.quest.tasks[0].id,'ready');
  assert.equal(window.document.querySelectorAll('[data-step]:checked').length,2);
  assert.equal(window.document.getElementById('state-label').textContent,'active');
  assert.match(window.document.getElementById('workspace').textContent,/2 OF 3 CHECKPOINTS/);
});

test('proof projection leaves an in-progress profile form and draft controls intact',async t=>{
  const app=fixture(t,{stage:'profile'}),{window}=app;
  const constraints=window.document.getElementById('constraints');constraints.value='Unsaved draft constraints';
  window.document.getElementById('skill-level').value='expert';
  await accept(app);
  assert.equal(window.document.getElementById('constraints'),constraints);
  assert.equal(constraints.value,'Unsaved draft constraints');
  assert.equal(window.document.getElementById('skill-level').value,'expert');
  assert.equal(app.read().stage,'profile');assert.equal(app.read().view,'quest');assert.equal(app.read().plan.state,'completed');
});

test('selecting a different saved Quest evaluates its existing accepted native proof',async t=>{
  const app=fixture(t),{window}=app;await accept(app);
  const other=plan('qa-other');
  window.localStorage.setItem(intentionsKey,JSON.stringify([{id:other.id,kind:'weave-plan',state:'active',plan:other},{id:app.current.id,kind:'weave-plan',state:'active',plan:{...app.current,paths:app.current.paths}}]));
  window.CivweaveWorkingCampusV156.openLibrary();
  window.document.querySelector('[data-load="qa-other"]').click();
  window.CivweaveWorkingCampusV156.openLibrary();
  window.document.querySelector('[data-load="qa-current"]').click();
  assert.equal(app.read().plan.id,app.current.id);assert.equal(app.read().plan.state,'completed');
  assert.equal(window.document.querySelectorAll('[data-step]:checked').length,3);
});

test('a storage proof projection applies only to the campus plan with the same identity',async t=>{
  const app=fixture(t),donor=fixture(t),{window}=app;
  await acceptTask(donor,donor.quest.tasks[0]);
  const saved=donor.read();
  window.localStorage.setItem('cerbanimo.quest-engine.v144',donor.window.localStorage.getItem('cerbanimo.quest-engine.v144'));
  window.localStorage.setItem(campusKey,JSON.stringify(saved));
  window.dispatchEvent(new window.StorageEvent('storage',{key:campusKey}));
  assert.equal(window.document.querySelectorAll('[data-step]:checked').length,1);
  const checkbox=window.document.querySelector('[data-step]');saved.plan=plan('unrelated-plan');window.localStorage.setItem(campusKey,JSON.stringify(saved));
  window.dispatchEvent(new window.CustomEvent('civweave:proof-progress-synced',{detail:{planId:'unrelated-plan'}}));
  assert.equal(window.document.querySelector('[data-step]'),checkbox);
  assert.match(window.document.getElementById('workspace').textContent,/Quest qa-current/);
});
