import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync(new URL('../public/app/shared-review-surface-v234.js',import.meta.url),'utf8'),presenter=readFileSync(new URL('../public/app/shared/guide-outcome-scene-v1.js',import.meta.url),'utf8');
const mapSource=readFileSync(new URL('../public/app/shared/quest-pathway-map-v1.js',import.meta.url),'utf8');
const KEYS={intentions:'civweave.intentions.v127',working:'civweave.working-campus.v1',inbox:'civweave.realm-inbox.v1'};
function record(){return{id:'quest-review-1',kind:'weave-plan',state:'review',plan:{id:'quest-review-1',title:'Fictional repair plan',state:'review',paths:[{id:'learn',realm:'living-school',title:'Learn the joint',steps:['Inspect a fictional joint'],progress:[]},{id:'make',realm:'cerbanimo',title:'Build the joint',steps:['Check the repair'],progress:[]}]}}}
async function browser(t,{item=record(),working={unrelated:'preserved'},lud=false}={}){
  const dom=new JSDOM('<!doctype html><div id="weaveling-hub-v233"><div class="wh233-thread"></div></div><div id="cw-persistent-guide-chat-v215"><textarea aria-label="Weaveling message"></textarea></div>',{url:'https://civweave.test/app/persistent-system-shell-v1.html',runScripts:'outside-only'});t.after(()=>dom.window.close());
  const win=dom.window,writes=[],events=[];let failKey='',fetches=0;
  win.structuredClone=structuredClone;win.matchMedia=()=>({matches:false});win.CivweaveLudModeV1={isEnabled:()=>lud};
  for(const [key,value] of [[KEYS.intentions,[item]],[KEYS.working,working],[KEYS.inbox,[]]])win.localStorage.setItem(key,JSON.stringify(value));
  const save=win.Storage.prototype.setItem;win.Storage.prototype.setItem=function(key,value){if(key===failKey)throw new Error('Fixture disk full');writes.push(key);return save.call(this,key,value)};
  win.fetch=async()=>{fetches++;throw new Error('Unexpected inference or publication')};
  for(const name of ['civweave:intentions-changed','civweave:review-plan-activated','civweave:review-plan-revision-requested'])win.addEventListener(name,event=>events.push({name,detail:event.detail}));
  win.eval(presenter);win.eval(mapSource);win.eval(source);if(win.document.readyState==='loading')win.dispatchEvent(new win.Event('DOMContentLoaded'));
  win.CivweaveSharedReviewSurfaceV234.openPlan(item.id);await new Promise(resolve=>setImmediate(resolve));
  return{win,writes,events,api:win.CivweaveSharedReviewSurfaceV234,get fetches(){return fetches},fail:key=>{failKey=key},saved:()=>JSON.parse(win.localStorage.getItem(KEYS.intentions))[0],getWorking:()=>JSON.parse(win.localStorage.getItem(KEYS.working)),scene:()=>win.document.querySelector('[data-guide-outcome]'),button:name=>win.document.querySelector(`[data-review-command="${name}"]`)};
}

test('opening or mapping a newly generated review draft creates no review decision, scene, inference or writes',async t=>{
  const h=await browser(t);assert.equal(h.scene(),null);assert.equal(h.saved().plan.reviewDecision,undefined);assert.equal(h.writes.length,0);
  h.win.document.querySelector('[data-quest-map-action="inspect"]').click();assert.equal(h.writes.length,0);assert.equal(h.fetches,0);assert.equal(h.saved().state,'review');
  assert.ok(h.win.document.querySelector('[data-review-revision-form]'),'review needs a required-note request changes control');
});

test('explicit activation persists one plan-scoped decision and celebrates activation while execution stays incomplete',async t=>{
  const h=await browser(t);h.button('activate-plan').click();const saved=h.saved(),decision=saved.plan.reviewDecision;
  assert.ok(decision?.id);assert.equal(decision.decision,'accepted');assert.equal(decision.scope,'plan');assert.equal(decision.planId,saved.plan.id);assert.ok(Date.parse(decision.at));
  assert.equal(saved.state,'active');assert.equal(saved.done,false);assert.ok(saved.plan.paths.every(path=>path.progress.length===0));
  assert.equal(h.getWorking().plan.reviewDecision.id,decision.id);assert.equal(h.scene()?.dataset.receiptId,decision.id);assert.equal(h.scene()?.dataset.playing,'true');
  assert.match(h.scene().textContent,/Quest plan activated/);assert.match(h.scene().textContent,/execution and completion still need evidence/i);assert.doesNotMatch(h.scene().textContent,/Quest completed|reward earned|\+\d/);
  assert.equal(h.fetches,0);assert.deepEqual([...new Set(h.writes)].sort(),Object.values(KEYS).sort());
  const count=h.writes.length;h.api.activatePlan(saved.id);assert.equal(h.writes.length,count,'repeated activation must not mint another receipt');assert.equal(h.saved().plan.reviewDecision.id,decision.id);
});

test('closing and reopening an accepted review is static and replay or stop changes no saved work',async t=>{
  const h=await browser(t);h.button('activate-plan').click();assert.ok(h.scene());h.api.close();h.api.openPlan('quest-review-1');
  const scene=h.scene(),count=h.writes.length;assert.equal(scene.dataset.playing,'false');
  scene.querySelector('[data-guide-scene-action="replay"]').click();assert.equal(scene.dataset.playing,'true');scene.querySelector('[data-guide-scene-action="stop"]').click();assert.equal(scene.dataset.playing,'false');
  assert.equal(h.writes.length,count);assert.equal(h.saved().state,'active');assert.equal(h.saved().done,false);
});

test('refreshing the same recorded decision preserves its playing scene node instead of restarting it',async t=>{
  const h=await browser(t);h.button('activate-plan').click();const scene=h.scene(),count=h.writes.length;h.api.openPlan('quest-review-1');
  assert.equal(h.scene(),scene);assert.equal(scene.dataset.playing,'true');assert.equal(h.writes.length,count);
});

test('requesting changes needs a note, saves the same selected Quest in review, and starts no model',async t=>{
  const selected=record(),h=await browser(t,{working:{plan:selected.plan,stage:'review',view:'quest',unrelated:'preserved'}}),form=h.win.document.querySelector('[data-review-revision-form]');assert.ok(form);
  const input=form.querySelector('textarea'),button=form.querySelector('[data-review-command="request-plan-changes"]');assert.equal(input.required,true);
  input.value='   ';button.click();assert.equal(h.writes.length,0);assert.equal(h.scene(),null);
  input.value='Add a safe inspection step before assembly.';button.click();
  const saved=h.saved(),decision=saved.plan.reviewDecision;assert.equal(saved.state,'review');assert.equal(saved.plan.state,'review');assert.equal(decision.decision,'revision');assert.equal(decision.note,input.value);assert.equal(decision.planId,saved.plan.id);
  assert.equal(h.getWorking().stage,'review');assert.equal(h.getWorking().plan.reviewDecision.id,decision.id);assert.equal(h.getWorking().unrelated,'preserved');
  assert.equal(h.scene()?.dataset.guideOutcome,'revision');assert.equal(h.scene()?.dataset.playing,'true');assert.match(h.scene().textContent,/Add a safe inspection step/);assert.doesNotMatch(h.scene().textContent,/activated|completed|reward earned/i);
  assert.equal(h.fetches,0);assert.ok(h.events.some(event=>event.name==='civweave:review-plan-revision-requested'));
  const count=h.writes.length;h.api.requestPlanChanges(saved.id,decision.note);assert.equal(h.writes.length,count,'repeating the same note does not mint a second revision receipt');
});

test('requesting changes on another saved Quest preserves the currently selected working plan',async t=>{
  const working={plan:{id:'other-plan',title:'Keep the current plan'},stage:'active',unrelated:1},h=await browser(t,{working});
  assert.equal(typeof h.api.requestPlanChanges,'function');const result=h.api.requestPlanChanges('quest-review-1','Reduce the material list.');assert.equal(result.ok,true);assert.deepEqual(h.getWorking(),working);assert.deepEqual(h.writes,[KEYS.intentions]);
});

test('revision of an active plan keeps its execution evidence and does not erase other saved plans',async t=>{
  const item=record();item.state=item.plan.state='active';item.done=false;item.plan.paths[0].progress=[0];
  const h=await browser(t,{item,working:{plan:item.plan,stage:'active'}}),others=Array.from({length:110},(_,index)=>({id:'other-'+index,kind:'weave-plan',state:'review',plan:{id:'other-'+index,state:'review'}}));
  h.win.localStorage.setItem(KEYS.intentions,JSON.stringify([...others,item]));h.writes.length=0;
  const result=h.api.requestPlanChanges(item.id,'Reconsider the optional second path.');assert.equal(result.ok,true);
  const saved=JSON.parse(h.win.localStorage.getItem(KEYS.intentions));assert.equal(saved.length,111);assert.deepEqual(saved.find(row=>row.id===item.id).plan.paths[0].progress,[0]);assert.equal(h.getWorking().stage,'review');
  assert.deepEqual(saved.slice(0,110),others);assert.equal(h.fetches,0);
});

test('an incomplete commit rolls back activation and emits no accepted outcome or success event',async t=>{
  for(const key of Object.values(KEYS)){
    const h=await browser(t);const before=[...Object.values(KEYS)].map(key=>h.win.localStorage.getItem(key));h.fail(key);
    const result=h.api.activatePlan('quest-review-1');assert.equal(result.ok,false,key);assert.match(result.error,/save|saved|persist/i);
    assert.deepEqual(Object.values(KEYS).map(key=>h.win.localStorage.getItem(key)),before);assert.equal(h.saved().plan.reviewDecision,undefined);assert.equal(h.scene(),null);assert.equal(h.events.length,0);assert.equal(h.fetches,0);
  }
});

test('failed revision persistence stays reviewable without recording or animating an unsaved decision',async t=>{
  const selected=record(),h=await browser(t,{working:{plan:selected.plan,stage:'review'}});h.fail(KEYS.working);
  assert.equal(typeof h.api.requestPlanChanges,'function');const result=h.api.requestPlanChanges(selected.id,'Show the missing check.');assert.equal(result.ok,false);assert.equal(h.saved().plan.reviewDecision,undefined);assert.equal(h.getWorking().plan.reviewDecision,undefined);assert.equal(h.scene(),null);assert.equal(h.events.length,0);
});

test('only a corroborated decision belonging to this Quest and current plan state is displayed; Lud keeps text',async t=>{
  const item=record();item.state=item.plan.state='active';item.plan.reviewDecision={id:'copied-decision',decision:'accepted',scope:'plan',planId:'different-quest',at:'2026-10-27T15:00:00Z'};
  const foreign=await browser(t,{item});assert.equal(foreign.scene(),null);
  item.state=item.plan.state='review';item.plan.reviewDecision.planId=item.plan.id;const stale=await browser(t,{item});assert.equal(stale.scene(),null);
  item.state=item.plan.state='active';const lud=await browser(t,{item,lud:true});assert.equal(lud.scene()?.dataset.art,'false');assert.equal(lud.scene()?.querySelector('[data-guide-sprite]'),null);assert.match(lud.scene().textContent,/Quest plan activated/);assert.equal(lud.writes.length,0);
});
