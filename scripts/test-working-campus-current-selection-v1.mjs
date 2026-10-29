import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {JSDOM} from 'jsdom';

const read=path=>readFileSync(new URL(`../public/${path}`,import.meta.url),'utf8');
const campusSource=[1,2,3,4,5].map(index=>read(`app/working-campus-v156.part${index}.txt`)).join('');
const campusKey='civweave.working-campus.v1',intentionsKey='civweave.intentions.v127';
const plan=(id,state='review',updatedAt='2026-10-24T00:00:00Z')=>({id,title:`Quest ${id}`,wish:`The ${id} intention`,outcome:`The ${id} outcome`,state,createdAt:updatedAt,updatedAt,authoring:{mode:'model-structured-json',aiGenerated:true,provider:'ollama',model:'fixture'},paths:[{id:`${id}-path`,realm:'cerbanimo',type:'skilled-labor',title:`${id} work`,purpose:`Complete ${id}`,steps:['First checkpoint','Second checkpoint'],progress:state==='active'?[0]:[],status:state==='active'?'active':'ready'}],governance:{title:'QA boundary',purpose:'Local QA boundary',agreements:[]}});

function fixture(t,options={}){
  const dom=new JSDOM(read('app/working-campus-v440.html'),{url:'https://civweave.test/app/working-campus-v440.html',runScripts:'outside-only'}),{window}=dom,observers=[],Observer=window.MutationObserver;
  window.MutationObserver=class extends Observer{constructor(callback){super(callback);observers.push(this)}};
  t.after(()=>{for(const observer of observers)observer.disconnect();window.close()});
  Object.defineProperty(window.document,'readyState',{value:'complete',configurable:true});
  window.structuredClone=structuredClone;window.requestAnimationFrame=()=>0;window.setTimeout=()=>0;window.setInterval=()=>0;window.clearTimeout=()=>{};window.clearInterval=()=>{};window.matchMedia=()=>({matches:false,addEventListener(){}});
  window.CivweaveProgressiveDisclosureV1={};window.CivweaveGuideWorkspaceV242={openWindow(){}};
  const newer=plan('newer-review','review','2026-10-24T03:00:00Z'),older=plan('older-active','active','2026-10-24T01:00:00Z'),otherReview=plan('older-review','review','2026-10-24T02:00:00Z');
  if(Object.hasOwn(options,'governance'))for(const value of [newer,older,otherReview]){if(options.governance===undefined)delete value.governance;else value.governance=options.governance}
  const rows=[newer,otherReview,older].map(plan=>({id:plan.id,kind:'weave-plan',state:plan.state,updatedAt:plan.updatedAt,plan}));
  window.localStorage.setItem(campusKey,JSON.stringify({stage:'review',view:'quest',mode:'guided',wish:newer.wish,plan:newer,reviewReady:{planId:newer.id,title:newer.title},conversation:[]}));
  window.localStorage.setItem(intentionsKey,JSON.stringify(rows));
  window.eval(read('app/intention-planner-v141.js'));window.eval(campusSource);window.eval(read('app/weaveling-hub-v233.js'));window.eval(read('app/shared-review-surface-v234.js'));window.eval(read('app/weaveling-plan-materialization-v265.js'));window.eval(read('app/platform-experience-v160.js'));
  const opened=[];window.CivweaveIntentionUI={open:id=>{opened.push(id);return true}};window.CivweaveSharedReviewSurfaceV234={...window.CivweaveSharedReviewSurfaceV234,openPlan:id=>{opened.push(id);return true}};window.CivweaveFamilyAILoaderV105={ensure:async()=>true};
  const open=id=>{window.CivweaveWorkingCampusV156.openLibrary();const button=window.document.querySelector(`[data-load="${id}"]`);assert.ok(button);button.click()};
  return{window,newer,older,otherReview,opened,open,read:key=>JSON.parse(window.localStorage.getItem(key)),thread:()=>window.document.querySelector('.wh233-thread'),banner:()=>window.document.getElementById('cw-weave-review-ready-v265')};
}

test('normal library selection updates current Quest projections while preserving the separate review queue',async t=>{
  const app=fixture(t),{window}=app;
  assert.match(app.thread().textContent,/Quest newer-review/);assert.equal(app.banner().dataset.planId,app.newer.id);
  app.open(app.older.id);await Promise.resolve();
  assert.equal(app.read(campusKey).plan.id,app.older.id);assert.equal(window.document.getElementById('state-label').textContent,'active');
  assert.match(window.document.getElementById('workspace').textContent,/Quest older-active/);assert.equal(window.document.querySelectorAll('[data-step]:checked').length,1);
  assert.match(app.thread().textContent,/Quest older-active/);assert.match(app.thread().textContent,/active/);assert.equal(app.banner(),null,'A selected active Quest cannot retain another Quest’s REVIEW banner.');
  const pending=window.CivweaveSharedReviewSurfaceV234.reviewWeaves();assert.equal(pending.length,2);assert.equal(pending.some(row=>row.id===app.newer.id),true);
  assert.equal(app.read(intentionsKey).find(row=>row.id===app.newer.id).state,'review','Selection must not activate, discard or replace the newer pending draft.');
  assert.equal(window.document.querySelector('[data-cw160-review-label]').textContent,'Review queue');assert.equal(window.document.querySelector('[data-cw160-review-count]').textContent,'2');
  assert.equal(window.document.querySelector('[data-cw160-review-title]').textContent,'2 items waiting');
});

test('a detached review banner cannot open its previous Quest after another Quest is selected',async t=>{
  const app=fixture(t),button=app.banner().querySelector('[data-review-weave]');
  app.open(app.older.id);button.click();await Promise.resolve();
  assert.deepEqual(app.opened,[],'The review action must consult current selected state rather than a stale plan closure.');
  app.window.document.querySelector('[data-cw160-review]').click();for(let turn=0;turn<4&&!app.opened.length;turn++)await Promise.resolve();
  assert.deepEqual(app.opened,[app.newer.id],'The explicitly labeled queue retains its independent latest-pending action.');
});

test('Revise Quest opens the canonical Weaveling composer when it lives outside the content document',t=>{
  const app=fixture(t),calls=[];app.window.CivweaveGuideChatSurfaceV350={canonicalOwner:true,openWindow:(system,options)=>{calls.push({system,options});return true},submitText:()=>assert.fail('Opening revision must not start inference.')};
  const before=app.window.localStorage.getItem(intentionsKey);
  app.banner().querySelector('[data-revise-weave]').click();
  assert.equal(calls.length,1);assert.equal(calls[0].system,'civweave');assert.equal(calls[0].options.focus,true);
  assert.equal(app.window.localStorage.getItem(intentionsKey),before);assert.equal(app.window.document.querySelector('#cw-persistent-guide-chat-v215'),null,'No second chat is created in the content document.');
});

test('the visible Review Quest banner uses the canonical mapped review even when a legacy view is loaded',t=>{
  const app=fixture(t),calls=[];app.window.CivweaveSharedReviewSurfaceV234={openPlan:id=>{calls.push(id);return true}};app.window.CivweaveIntentionUI={open:()=>assert.fail('The optional legacy list cannot replace the shared map review.')};
  app.banner().querySelector('[data-review-weave]').click();assert.deepEqual(calls,[app.newer.id]);
});

test('opening an older review Quest refreshes its own banner and review action without changing queue order',async t=>{
  const app=fixture(t);app.open(app.otherReview.id);await Promise.resolve();
  assert.match(app.thread().textContent,/Quest older-review/);assert.equal(app.banner().dataset.planId,app.otherReview.id);assert.match(app.banner().textContent,/Quest older-review/);
  app.banner().querySelector('[data-review-weave]').click();assert.deepEqual(app.opened,[app.otherReview.id]);
  assert.equal(app.window.CivweavePlatformExperienceV160.pending()[0].id,app.newer.id);
  const control=app.banner().querySelector('[data-review-weave]');app.window.dispatchEvent(new app.window.CustomEvent('civweave:intentions-changed'));
  assert.equal(app.banner().querySelector('[data-review-weave]'),control,'An unchanged selected review must keep its existing controls.');
});

test('current selection events remove review UI for completed Quests and leave settled projections stable',async t=>{
  const app=fixture(t),{window}=app,completed=plan('finished','completed');
  window.localStorage.setItem(intentionsKey,JSON.stringify([{id:completed.id,kind:'weave-plan',state:completed.state,plan:completed},...app.read(intentionsKey)]));
  app.open(completed.id);await Promise.resolve();
  assert.match(app.thread().textContent,/Quest finished/);assert.match(app.thread().textContent,/completed/);assert.equal(app.banner(),null);
  const before=window.localStorage.getItem(intentionsKey),thread=app.thread(),update=window.document.querySelector('#wh233-update-form textarea');update.value='Unsent report for the current Quest';window.dispatchEvent(new window.CustomEvent('civweave:intentions-changed'));
  assert.equal(window.localStorage.getItem(intentionsKey),before,'Refreshing selected presentation must not mutate the review queue.');
  assert.equal(app.thread(),thread);assert.equal(window.document.querySelector('#wh233-update-form textarea'),update);assert.equal(update.value,'Unsent report for the current Quest');
});

for(const governance of [null,undefined])test(`a Quest with ${governance===null?'null':'absent'} governance can be reviewed and activated without an invented boundary`,async t=>{
  const app=fixture(t,{governance}),{window}=app;
  const workspace=()=>window.document.getElementById('workspace');
  assert.match(workspace().textContent,/REVIEW QUEST/);assert.match(workspace().textContent,/Quest newer-review/);
  assert.doesNotMatch(workspace().textContent,/PASSPORT AND CONSENT|ANARCHADIA · PASSPORT|QA boundary/);assert.equal(workspace().querySelectorAll('article.path').length,1);
  window.document.getElementById('activate-plan').click();
  assert.equal(app.read(campusKey).plan.state,'active');assert.match(workspace().textContent,/ACTIVE QUEST/);assert.equal(window.document.getElementById('state-label').textContent,'active');
  assert.doesNotMatch(workspace().textContent,/PASSPORT AND CONSENT|ANARCHADIA · PASSPORT|QA boundary/);
  assert.equal(app.read(campusKey).plan.governance,governance);
  const packets=app.read('civweave.realm-inbox.v1');assert.equal(packets.filter(row=>row.kind==='intention-passport').length,0);assert.equal(packets.filter(row=>row.target==='cerbanimo').length,1);
});

test('an enabled governance boundary retains its actual content and activation handoff',async t=>{
  const governance={title:'Agreed local QA boundary',purpose:'Keep the requested consent inspectable.',agreements:['The participants consent before proceeding.']},app=fixture(t,{governance}),{window}=app;
  assert.match(window.document.getElementById('workspace').textContent,/Agreed local QA boundary/);assert.match(window.document.getElementById('workspace').textContent,/The participants consent before proceeding/);
  window.document.getElementById('activate-plan').click();
  const packets=app.read('civweave.realm-inbox.v1').filter(row=>row.kind==='intention-passport');assert.equal(packets.length,1);assert.deepEqual(packets[0].payload.governance,governance);
  assert.match(window.document.getElementById('workspace').textContent,/Agreed local QA boundary/);
});

test('an external parent selection and activation replaces stale campus memory before its next render or save',t=>{
  const app=fixture(t),{window}=app,activated=plan('parent-qwen','active','2026-10-28T12:00:00Z');activated.collective={id:'starling',lineId:'line-parent',scope:'guild'};
  window.localStorage.setItem(campusKey,JSON.stringify({...app.read(campusKey),plan:activated,wish:activated.wish,stage:'active',updatedAt:activated.updatedAt}));
  window.CivweaveWorkingCampusV156.openQuest();
  assert.equal(app.read(campusKey).plan.id,activated.id);assert.equal(app.read(campusKey).plan.state,'active');assert.equal(app.read(campusKey).plan.collective.lineId,'line-parent');
  assert.match(window.document.getElementById('workspace').textContent,/Quest parent-qwen/);assert.equal(window.document.getElementById('state-label').textContent,'active');
  window.document.querySelector('[data-quest-mode="roam"]').click();assert.equal(app.read(campusKey).plan.id,activated.id,'A normal child view control must not restore stale in-memory REVIEW state.');
});

test('a storage activation of the same Quest updates its current interface while preserving an unsent message',t=>{
  const app=fixture(t),{window}=app;window.document.getElementById('weaveling-chat-input').value='Keep this unsent message';
  const saved=app.read(campusKey);saved.plan.state='active';saved.plan.updatedAt='2026-10-28T12:00:00Z';saved.stage='active';saved.updatedAt=saved.plan.updatedAt;window.localStorage.setItem(campusKey,JSON.stringify(saved));
  window.dispatchEvent(new window.StorageEvent('storage',{key:campusKey}));
  assert.equal(window.document.getElementById('state-label').textContent,'active');assert.match(window.document.getElementById('workspace').textContent,/ACTIVE QUEST/);assert.equal(window.document.getElementById('weaveling-chat-input').value,'Keep this unsent message');assert.equal(app.read(campusKey).plan.state,'active');
});

test('a stopped selected Quest is visibly abandoned and offers no next execution rail',t=>{
  const app=fixture(t),{window}=app,saved=app.read(campusKey);saved.plan.state='abandoned';saved.stage='active';window.localStorage.setItem(campusKey,JSON.stringify(saved));window.dispatchEvent(new window.StorageEvent('storage',{key:campusKey}));
  const workspace=window.document.getElementById('workspace');assert.match(workspace.textContent,/QUEST ABANDONED/);assert.doesNotMatch(workspace.textContent,/ACTIVE QUEST/);assert.equal(workspace.querySelector('[data-open]'),null);assert.equal(window.document.getElementById('state-label').textContent,'abandoned');
});
