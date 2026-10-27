import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const source=fs.readFileSync(new URL('../public/app/cerbanimo-quest-engine-v144.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/app/cerbanimo-quest-engine-v144.css',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function app(saved={},lud=false){
  const dom=new JSDOM('<!doctype html><html data-system="cerbanimo"><body><div id="rc-app"><div class="rc-shell"><section class="rc-active"><h2></h2><p></p></section></div></div></body></html>',{url:'https://civweave.example/app/realm-console-v140.html?system=cerbanimo',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;w.structuredClone=structuredClone;w.requestAnimationFrame=callback=>{queueMicrotask(callback);return 1};
  w.CivweaveLudModeV1={isEnabled:()=>lud};
  for(const [key,value] of Object.entries(saved))w.localStorage.setItem(key,value);
  w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await tick();
  return{dom,w,engine:w.CivweaveCerbanimoQuestV144,document:w.document,close:()=>w.close()};
}
function fixture(engine){const quest=engine.createQuestFromInput({title:'A real local result',steps:['Prepare the result','Check the result'],proofRequirements:['Inspectable preparation','Inspectable check']});engine.addQuest(quest);return quest}
function submit(engine,quest,task=quest.tasks[0]){engine.applyTaskTransition(quest.id,task.id,'in-progress');engine.addProof(quest.id,task.id,{value:'Fixture evidence for this work unit.'});assert.equal(engine.applyTaskTransition(quest.id,task.id,'review').ok,true)}

test('review feedback starts from a stored review outcome, never draft, proof, or pending review',async t=>{
  const a=await app();t.after(a.close);const quest=fixture(a.engine);await tick();
  assert.equal(a.document.querySelector('[data-cq-outcome]'),null);
  submit(a.engine,quest);await tick();assert.equal(a.document.querySelector('[data-cq-outcome]'),null);
  assert.equal(a.engine.applyTaskTransition(quest.id,quest.tasks[0].id,'completed','Evidence meets the recorded criterion.').ok,true);
  await tick();const scene=a.document.querySelector('[data-cq-outcome]');assert.ok(scene);assert.equal(scene.dataset.cqOutcome,'accepted');assert.equal(scene.dataset.playing,'true');
  const receipt=a.engine.readState().receipts.find(row=>row.id===scene.dataset.receiptId);assert.equal(receipt.detail.status,'completed');assert.match(scene.textContent,/Work unit accepted/);assert.match(scene.textContent,/Evidence meets/);
  assert.match(scene.textContent,/1 of 2 work units accepted/);assert.equal(a.engine.readState().quests[0].status,'active','A task acceptance is not final Endeavor acceptance.');
  assert.equal(a.w.localStorage.getItem('civweave.reward-ledger.v2'),null,'Presentation never mints rewards.');
});

test('revision is a constructive rematch with actual review notes and no defeat or invented reward',async t=>{
  const a=await app();t.after(a.close);const quest=fixture(a.engine);submit(a.engine,quest);
  a.engine.applyTaskTransition(quest.id,quest.tasks[0].id,'revision','Add the missing check, then resubmit.');await tick();
  const scene=a.document.querySelector('[data-cq-outcome]');assert.equal(scene.dataset.cqOutcome,'revision');assert.match(scene.textContent,/Lari/);assert.match(scene.textContent,/Add the missing check/);assert.match(scene.textContent,/Ready for another pass/);assert.doesNotMatch(scene.textContent,/defeat|game over|\+\d+ XP/i);
  assert.equal(a.engine.readState().quests[0].tasks[0].status,'revision');
  a.engine.applyTaskTransition(quest.id,quest.tasks[0].id,'in-progress');await tick();assert.equal(a.document.querySelector('[data-cq-outcome]'),null,'An old revision scene does not masquerade as the current task state.');
});

test('the same receipt does not replay on redraw or reopen; Replay is an explicit presentation action',async t=>{
  const a=await app();t.after(a.close);const quest=fixture(a.engine);submit(a.engine,quest);a.engine.applyTaskTransition(quest.id,quest.tasks[0].id,'completed','Accepted.');await tick();
  const original=a.document.querySelector('[data-cq-outcome]');a.engine.mount();assert.equal(a.document.querySelector('[data-cq-outcome]'),original,'An unrelated redraw retains the finite animation node.');
  a.engine.addTask(quest.id,{title:'One more real work unit'});await tick();assert.equal(a.document.querySelector('[data-cq-outcome]'),original);assert.match(original.textContent,/1 of 3 work units accepted/,'Retaining the scene must still refresh the actual count.');
  const saved={[a.engine.STORE_KEY]:a.w.localStorage.getItem(a.engine.STORE_KEY)};const reopened=await app(saved);t.after(reopened.close);
  const scene=reopened.document.querySelector('[data-cq-outcome]');assert.equal(scene.dataset.playing,'false');const before=reopened.w.localStorage.getItem(reopened.engine.STORE_KEY);
  scene.querySelector('[data-cq-action="replay-feedback"]').click();assert.equal(scene.dataset.playing,'true');assert.equal(reopened.w.localStorage.getItem(reopened.engine.STORE_KEY),before,'Replay neither mutates acceptance nor creates a second receipt.');
  scene.querySelector('[data-cq-action="stop-feedback"]').click();assert.equal(scene.dataset.playing,'false');
});

test('reopening work removes a stale acceptance; final receipt is distinct from work-unit success',async t=>{
  const a=await app();t.after(a.close);const quest=fixture(a.engine);
  for(const task of quest.tasks){submit(a.engine,quest,task);a.engine.applyTaskTransition(quest.id,task.id,'completed','Accepted fixture.');}
  a.engine.submitQuest(quest.id);a.engine.reviewQuest(quest.id,'accept','Final acceptance recorded.');await tick();
  let scene=a.document.querySelector('[data-cq-outcome]');assert.equal(scene.dataset.scope,'endeavor');assert.match(scene.textContent,/Endeavor accepted/);
  a.engine.applyTaskTransition(quest.id,quest.tasks[0].id,'ready');await tick();scene=a.document.querySelector('[data-cq-outcome]');assert.equal(scene?.dataset.scope,'task','Only the other still accepted task may be summarized.');assert.doesNotMatch(scene?.textContent||'',/Endeavor accepted/);
});

test('a work-unit map uses real dependency edges and accepted counts, with actionable accessible nodes',async t=>{
  const a=await app();t.after(a.close);const quest=fixture(a.engine);await tick();
  const map=a.document.querySelector('[data-cq-work-map]');assert.ok(map);assert.equal(map.querySelectorAll('[data-cq-map-task]').length,2);assert.match(map.textContent,/0 of 2 accepted/);assert.match(map.textContent,/Waiting for Prepare the result/);assert.equal(map.querySelectorAll('[data-cq-dependency-edge]').length,1);
  const before=a.w.localStorage.getItem(a.engine.STORE_KEY);map.querySelector('[data-cq-map-task]').click();assert.equal(a.document.activeElement.dataset.taskId,quest.tasks[0].id);assert.equal(a.w.localStorage.getItem(a.engine.STORE_KEY),before);
  submit(a.engine,quest);await tick();assert.match(a.document.querySelector('[data-cq-work-map]').textContent,/0 of 2 accepted/,'Review-ready weighted progress is never presented as accepted completion.');
});

test('reduced motion and Lud mode retain the outcome without loading generated guide or scene artwork',async t=>{
  assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)/);assert.match(css,/animation:\s*none\s*!important/);assert.doesNotMatch(css,/animation:[^;}]*infinite/);
  const a=await app({},true);t.after(a.close);const quest=fixture(a.engine);submit(a.engine,quest);a.engine.applyTaskTransition(quest.id,quest.tasks[0].id,'completed','Human acceptance.');await tick();
  const scene=a.document.querySelector('[data-cq-outcome]');assert.ok(scene);assert.match(scene.textContent,/Work unit accepted/);assert.equal(scene.querySelector('svg,img,[data-cq-guide-sprite],[data-cq-lari-sprite]'),null);assert.doesNotMatch(scene.outerHTML,/lari-review-sprites|background-image|--cq-guide-sheet/);assert.equal(scene.querySelector('[data-cq-action="replay-feedback"]'),null);
});

test('map layout stays bounded for large, missing, and cyclic dependencies while preserving every workboard card',async t=>{
  const a=await app();t.after(a.close);const quest=a.engine.createQuestFromInput({title:'Bounded graph',steps:Array.from({length:70},(_,index)=>`Work ${index+1}`)});
  quest.tasks[0].dependencies=[quest.tasks[1].id];quest.tasks[1].dependencies=[quest.tasks[0].id];quest.tasks[2].dependencies=['missing-proof-gate'];a.engine.addQuest(quest);await tick();
  const map=a.document.querySelector('[data-cq-work-map]');assert.equal(map.querySelectorAll('[data-cq-map-task]').length,48);assert.equal(a.document.querySelectorAll('.cq144-task[data-task-id]').length,70);assert.match(map.textContent,/Showing the first 48 of 70/);assert.match(map.textContent,/missing-proof-gate/);assert.equal(map.querySelector(`[data-cq-map-task="${quest.tasks[0].id}"]`).dataset.mapState,'blocked');
});

test('review notes and work titles remain text, and all guide identities reuse their existing expression sheets',async t=>{
  const a=await app();t.after(a.close);const quest=a.engine.createQuestFromInput({title:'Safe text',steps:['<img src=x onerror=alert(1)>'],sequential:false});a.engine.addQuest(quest);submit(a.engine,quest);a.engine.applyTaskTransition(quest.id,quest.tasks[0].id,'revision','<script>window.evil=true</script>');await tick();
  assert.equal(a.document.querySelector('[data-cq-outcome] script,[data-cq-work-map] img'),null);assert.match(a.document.querySelector('[data-cq-outcome]').textContent,/<script>/);assert.equal(a.w.evil,undefined);
  const lari=a.document.querySelector('[data-cq-lari-sprite]');assert.ok(lari,'Lari uses the real four-pose sprite atlas');assert.equal(lari.tagName,'SPAN');assert.equal(a.document.querySelector('.cq144-review-scene svg'),null,'The interim SVG is retired.');
  const atlas=fs.readFileSync(new URL('../public/app/assets/ai/lari-review-sprites-v1.png',import.meta.url));const width=atlas.readUInt32BE(16),height=atlas.readUInt32BE(20);assert.ok(width>=1024&&width%2===0);assert.equal(width,height,'Four equal cells need a square atlas.');assert.equal(atlas[25],6,'The sheet retains its transparent RGBA background.');
  assert.match(css,/lari-review-sprites-v1\.png/);assert.match(css,/background-size:200% 200%/);assert.match(css,/cq144-lari-poses 2\.8s steps\(1,end\) both/);assert.match(css,/@keyframes cq144-lari-poses\{[\s\S]*?background-position:0% 0%[\s\S]*?background-position:100% 0%[\s\S]*?background-position:var\(--cq-lari-result\)/);assert.match(css,/--cq-lari-result:0% 100%/);assert.match(css,/--cq-lari-result:100% 100%/);
  for(const [system,name] of Object.entries({civweave:'Weaveling','living-school':'Moss',cerbanimo:'Kamiya',fellowfare:'Rook',anarchadia:'Merlin'})){const guide=a.engine.feedbackGuide(system);assert.equal(guide.name,name);assert.match(guide.sheet,/^\/[A-Za-z-]+-sprites\.png$/);assert.ok(fs.existsSync(new URL(`../public${guide.sheet}`,import.meta.url)))}
});
