import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const budget=read('public/app/living-school-generation-budget-v3.js');
const library=read('public/app/working-campus-v156.part3.txt');
const runtime=read('public/app/shared/civweave-model-runtime.js');

const deadline=Number(budget.match(/const DESIGN_TIMEOUT_MS=(\d+);/)?.[1]);
assert.ok(deadline>=540000&&deadline<600000,'Local curriculum deadline must exceed the old 6-minute abort and remain within shared runtime ceiling.');
assert.match(runtime,/clamp\(input\.timeoutMs[^\n]*600000/,'Shared runtime must allow this design deadline.');
assert.match(budget,/controller\.abort\(new DOMException\('Living School design timeout'/,'Timeouts must explicitly abort the provider request.');
assert.match(budget,/if\(result\?\.status!=='success'\)return result/,'Failed generation must never be accepted as a completed curriculum.');

const start=library.indexOf('function savedLearningJourneys(){');
const end=library.indexOf('function campusView(){',start);
assert.ok(start>=0&&end>start,'Quest Library must have a dedicated canonical Learning Journey reader.');
const rows=new Map();
const localStorage={
  getItem:key=>rows.has(key)?rows.get(key):null,
  setItem:(key,value)=>rows.set(key,String(value))
};
const parse=(raw,fallback)=>{try{return JSON.parse(raw)??fallback}catch{return fallback}};
const esc=text=>String(text??'').replace(/[&<>"']/g,ch=>({'&':'&amp','<':'&lt','>':'&gt','"':'&quot',"'":'&#39'}[ch]));
const sandbox={localStorage,parse,esc,Array,Set,Date,Number,String,I:'civweave.intentions.v127'};
sandbox.globalThis=sandbox;
vm.runInNewContext(library.slice(start,end),sandbox,{filename:'working-campus-quest-library.js'});
const html=()=>vm.runInNewContext('libraryView()',sandbox);
const save=(key,value)=>rows.set(key,JSON.stringify(value));

assert.match(html(),/No saved Quests or Learning Journeys yet/);
save('civweave.intentions.v127',[{kind:'weave-plan',id:'weave-1',plan:{title:'Repair a community garden',outcome:'Garden ready'}}]);
assert.match(html(),/Repair a community garden/);
assert.match(html(),/data-load="weave-1"/);

const review={schema:'civweave.learning-journey-plan.v2',id:'plan-tarot',state:'review',request:{title:'Tarot Foundations',capability:'Read the tarot'},updatedAt:'2026-10-24T18:00:00Z'};
save('civweave.chat.capability.pending.living-school.plan.v1',review);
assert.match(html(),/Tarot Foundations/);
assert.match(html(),/REVIEW REQUIRED/);
assert.match(html(),/data-open="living-school"/);
assert.equal(html().match(/data-load=/g)?.length,1,'Moss must not create an unauthorized Weaveling Quest');

review.state='approved';save('civweave.chat.capability.pending.living-school.plan.v1',review);
assert.match(html(),/GENERATION INCOMPLETE/);
save('civweave.chat.capability.pending.living-school.curriculum.v1',{autoRun:true,approvedPlanId:'plan-tarot',title:'Tarot Foundations',capability:'Read the tarot',queuedAt:'2026-10-24T18:05:00Z'});
assert.match(html(),/QUEUED FOR GENERATION/);
assert.equal(html().match(/Tarot Foundations<\/h3>/g)?.length,1,'Queued and approved records should deduplicate by plan ID');

rows.delete('civweave.chat.capability.pending.living-school.plan.v1');
rows.delete('civweave.chat.capability.pending.living-school.curriculum.v1');
save('civweave.living-school.cabinet.v151',{
  school:{id:'school-ready',title:'Tarot Foundations',capability:'Read the tarot',requestedModuleCount:4,modules:[{id:'a'},{id:'b'},{id:'c'},{id:'d'}],updatedAt:'2026-10-24T18:15:00Z'},
  learningHistory:[{school:{id:'old-school',title:'Herbalism',capability:'Identify herbs',modules:[{id:'one'}]},archivedAt:'2026-10-23T18:00:00Z'}],
  generationRecovery:{requestId:'failed-run',status:'failed',request:{title:'Repair a pipe',capability:'Fix a pipe'},updatedAt:'2026-10-24T18:20:00Z'}
});
assert.match(html(),/CURRICULUM READY/);
assert.match(html(),/ARCHIVED CURRICULUM/);
assert.match(html(),/GENERATION FAILED · RETRY AVAILABLE/);
assert.match(html(),/Repair a pipe/);
assert.match(html(),/MOSS · LEARNING JOURNEY/);
assert.doesNotMatch(html(),/data-load="school-ready"/,'Learning Journeys must open Moss instead of the Quest loader');
console.log('Living School deadline and Quest Library records passed.');
