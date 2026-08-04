import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const source=fs.readFileSync(path.join(root,'public/app/merlinites-semantic-planner-v164.js'),'utf8');
const adapter=fs.readFileSync(path.join(root,'public/app/models/all-minilm-l6-v2/adapter.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'public/app/models/all-minilm-l6-v2/worker.js'),'utf8');
const serviceWorker=fs.readFileSync(path.join(root,'public/service-worker-v156.js'),'utf8');
const pwa=fs.readFileSync(path.join(root,'public/app/pwa-v130.js'),'utf8');
const entryPages=[
  'public/app/loom-v128.html',
  'public/app/lite-v129.html',
  'public/app/working-campus-v156.html',
  'public/app/realm-console-v140.html',
  'public/app/cabinets/living-school/index.html',
].map(relative=>[relative,fs.readFileSync(path.join(root,relative),'utf8')]);

class MemoryStorage{
  #rows=new Map();
  getItem(key){return this.#rows.has(key)?this.#rows.get(key):null}
  setItem(key,value){this.#rows.set(String(key),String(value))}
  removeItem(key){this.#rows.delete(String(key))}
  clear(){this.#rows.clear()}
}
const listeners=new Map();
const context={
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  structuredClone,
  localStorage:new MemoryStorage(),
  CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},
  addEventListener(type,handler){const rows=listeners.get(type)||[];rows.push(handler);listeners.set(type,rows)},
  dispatchEvent(event){for(const handler of listeners.get(event.type)||[])handler(event)},
  performance:{now:()=>Date.now()},
};
context.globalThis=context;
context.CommonweaveIntentionPlanner={
  schema:'commonweave.intention-weave.v1',
  buildPlan(){return samplePlan()},
  maybeCreate(){const plan=samplePlan(),item={id:plan.id,kind:'weave-plan',state:'review',plan};context.localStorage.setItem('commonweave.intentions.v127',JSON.stringify([item]));return{item,plan,response:{answer:'existing answer',approvalGate:{required:true}}}},
  restore(plan){return{id:plan.id,plan}},
};
vm.createContext(context);
vm.runInContext(source,context,{filename:'merlinites-semantic-planner-v164.js'});
const merlinites=context.CommonweaveMerlinitesV164;
assert.equal(merlinites.version,'1.0.4-merlinites-semantic-v164');
assert.equal(merlinites.authority,'advisory');

function samplePlan(){return{id:'plan-1',title:'Repair the offline planner',wish:'Make semantic planning useful locally',outcome:'A fast local planner produces reviewable next steps without breaking existing flows.',state:'review',updatedAt:'2026-08-04T12:00:00.000Z',paths:[{id:'path-learning',type:'learning',realm:'living-school',title:'Understand the semantic pipeline',purpose:'Learn its limits and contracts.',steps:['Map the current model boundary','Practice criterion matching'],completionCriteria:'The learner can explain and test the pipeline.',status:'draft'},{id:'path-work',type:'skilled-labor',realm:'cerbanimo',title:'Implement the additive engine',purpose:'Add bounded planning and validation.',steps:['Add a custom ranking API','Run regression checks'],completionCriteria:'Existing checks pass and merlinites is available.',status:'draft'}],assumptions:['No automatic consequential actions.']}}

const original=samplePlan();
const enhanced=merlinites.enhancePlan(original);
assert.equal(original.semanticPlan,undefined,'enhancement must not mutate the original plan');
assert.equal(enhanced.paths.length,original.paths.length,'existing path count must be preserved');
assert.equal(enhanced.assumptions[0],original.assumptions[0],'existing assumptions must be preserved');
assert.equal(enhanced.semanticPlan.schema,'commonweave.merlinites-semantic-plan.v1');
assert.equal(enhanced.semanticPlan.root.children.length,2);
assert.ok(enhanced.semanticPlan.root.children.every(path=>path.children.length===2));
assert.ok(enhanced.semanticPlan.root.children.flatMap(path=>path.children).every(step=>step.children.length>0));
assert.equal(enhanced.semanticPlan.maxDepth,3);
const next=merlinites.nextAction(enhanced);
assert.equal(next.depth,3,'the next action should resolve to an atomic bounded leaf');
assert.equal(next.children.length,0);
const expanded=merlinites.expandNode({id:'manual',realm:'cerbanimo',title:'Build a parser',depth:0,status:'proposed'},{maxDepth:2});
assert.ok(expanded.children.length>0,'manual nodes should be recursively expandable');
assert.ok(expanded.children.every(child=>child.depth===1&&child.children.every(grandchild=>grandchild.depth===2)));
assert.ok(expanded.children.flatMap(child=>child.children).every(grandchild=>grandchild.children.length===0));

const created=context.CommonweaveIntentionPlanner.maybeCreate({text:'Make the planner work'});
assert.equal(created.response.answer,'existing answer','merlinites must preserve the existing user-facing response');
assert.equal(created.response.approvalGate.required,true,'merlinites must preserve the approval gate');
assert.equal(created.plan.semanticPlan.schema,'commonweave.merlinites-semantic-plan.v1');
const persisted=JSON.parse(context.localStorage.getItem('commonweave.intentions.v127'));
assert.equal(persisted[0].plan.semanticPlan.schema,'commonweave.merlinites-semantic-plan.v1','the saved weave must receive the additive plan');

const learning=await merlinites.evaluateLearning({
  prompt:'Why separate state from presentation?',
  response:'Separating state reduces coupling, lets the same logic support multiple screens, and makes behavior easier to test with inspectable records.',
  criteria:[
    {id:'separation',label:'Separate responsibilities',description:'State and presentation have different responsibilities.',required:true},
    {id:'reuse',label:'Reuse state logic',description:'The same state logic can support multiple interfaces.',required:true},
    {id:'evidence',label:'Name evidence',description:'Name a test, record, or artifact that demonstrates the behavior.',required:true},
  ],
  deterministic:{ok:false,uncertain:true,score:55,authority:'deterministic-rubric-assisted'},
});
assert.equal(learning.promoted,false);
assert.equal(learning.mayPass,false,'semantic review must not promote a deterministic failure');
assert.equal(learning.preserveDeterministicAuthority,true);
assert.equal(learning.coverage.length,3);
assert.ok(learning.targetedFollowUp.length>20);

const task=await merlinites.evaluateTask({
  quest:{acceptanceCriteria:['Active intentions survive reloads.'],proofRequirements:['Automated tests cover save and restore.']},
  task:{title:'Add offline persistence',acceptanceCriteria:['Data remains available without a network connection.'],proofs:[{kind:'note',label:'Completion claim',value:'Done. Everything is completed successfully.'}]},
});
assert.equal(task.autoComplete,false);
assert.equal(task.verified,false);
assert.equal(task.requiresHumanOrDeterministicVerification,true);
assert.ok(['claim-only','partial'].includes(task.status));

assert.match(adapter,/export async function rank\(/,'adapter must expose custom semantic ranking');
assert.match(adapter,/export async function match\(/,'existing reflex matching must remain');
assert.match(adapter,/device-package-r38-merlinites/,'adapter must rotate the semantic worker revision');
assert.match(worker,/message\.type==='rank'/,'worker must handle custom ranking');
assert.match(worker,/message\.type==='match'/,'worker must preserve reflex matching');
assert.match(worker,/rankCache/,'worker should bound reusable candidate embeddings');
assert.match(worker,/cached\?\.signature===signature/,'candidate cache must be invalidated when criterion text changes');
const oldName=['S','ol'].join('');
const oldSlug=oldName.toLowerCase();
for(const [relative,html] of entryPages){
  assert.match(html,/merlinites-semantic-planner-v164\.js/,`${relative} must load merlinites`);
  assert.equal(html.toLowerCase().includes(`${oldSlug}-semantic-planner`),false,`${relative} still loads the retired semantic runtime name`);
}
for(const token of ['merlinites-semantic-planning-v164','/app/merlinites-semantic-planner-v164.js','/app/models/all-minilm-l6-v2/adapter.js','/app/models/all-minilm-l6-v2/worker.js'])assert.ok(serviceWorker.includes(token),`offline package is missing ${token}`);
assert.equal(serviceWorker.toLowerCase().includes(`${oldSlug}-semantic`),false,'offline package still contains the retired semantic name');
assert.match(pwa,/working-campus-additions-v168-two-agent-workflow-merlinites-semantic-planning/,'installed updater must advance to the combined two-agent, workflow-handoff, and merlinites package');
assert.equal(pwa.toLowerCase().includes(`${oldSlug}-semantic`),false,'installed updater still contains the retired semantic name');
const retired=[`Commonweave${oldName}V164`,`commonweave.${oldSlug}-`,`__${oldSlug}SemanticInstalled`,`${oldSlug}Feedback`,`commonweave:${oldSlug}-`];
for(const identifier of retired)assert.equal(source.includes(identifier),false,`runtime still contains retired identifier ${identifier}`);

console.log('merlinites semantic planning v164 verification passed.');
