import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read=path=>readFileSync(new URL(`../public/${path}`,import.meta.url),'utf8');
const request='Create a Quest titled QA READY Decision v2. Goal: record the personal, non-binding fictional QA decision READY. Exactly one Anarchadia path with one checkpoint: the saved evidence note reads READY. One Hero, zero budget, no other participants, no rights changes, no rewards, no external actions. Set governance included false. Save for review.';
const path=(realm='anarchadia',type='civic-governance')=>({realm,type,title:'Record the personal decision',purpose:'Keep the requested non-binding personal decision.',steps:['Save the READY decision note.'],completionCriteria:'The saved decision note reads READY.',evidence:['The local READY decision note']});
const result=()=>({title:'QA READY Decision v2',wish:request,outcome:'The personal fictional decision READY is recorded.',assumptions:['This is fictional local QA.'],paths:[path()],governance:{included:false}});
function harness(output=result()){
  const old={id:'old-note',kind:'weave-plan',state:'review',plan:{id:'old-note',title:'Prior digital note',wish:'Create the prior digital note',outcome:'The prior digital note is saved.',paths:[path('cerbanimo','skilled-labor')],governance:{title:'Old rewards agreement'},sourceConversation:['Create the prior digital note']}};
  const storage=new Map([['civweave.intentions.v127',JSON.stringify([old])],['civweave.working-campus.v1',JSON.stringify({wish:'Learn and memorize the tarot',profile:{constraints:'Old project constraints'},plan:old.plan})],['civweave.realm-inbox.v1',JSON.stringify([{title:'Old rewards handoff',payload:{weaveId:'old-note'}}])]]),calls=[];
  const context={Date,Math,structuredClone,console,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},addEventListener(){},dispatchEvent(){},queueMicrotask:fn=>fn(),CustomEvent:class{},CivweaveModelRuntime:{readSharedConfig:()=>({provider:'ollama',model:'fixture'}),generate:async input=>{calls.push(input);return{status:'success',outputJson:structuredClone(output),actual:{provider:'ollama',model:'fixture'}}}}};
  context.globalThis=context;vm.createContext(context);vm.runInContext(read('app/intention-planner-v141.js'),context);vm.runInContext(read('extensions/civweave-weaveling-plan-json-v190.js'),context);
  return{context,storage,calls,api:context.CivweaveWeavelingPlanJsonV190,create:(text=request,history=[])=>context.CivweaveWeavelingPlanJsonV190.createModelPlan({text,history},{selectedConfig:()=>({provider:'ollama',model:'fixture'})})};
}

test('a new explicit Quest transmits only its own project context and exact structural scope',async()=>{
  const app=harness();await app.create(request,[{role:'user',text:'Create the prior digital note'},{role:'assistant',text:'Old rewards agreement'}]);
  const sent=app.calls[0],prompt=sent.messages.map(row=>row.content).join('\n');
  assert.doesNotMatch(prompt,/Prior digital note|prior digital note|tarot|Old rewards|Old project constraints/,'Unrelated saved projects and transcript turns must not become the new planning context.');
  assert.doesNotMatch(prompt,/Prefer 2-3 focused paths/,'The generator must not impose a subsystem quota.');
  assert.equal(sent.schema.properties.paths.minItems,1);assert.equal(sent.schema.properties.paths.maxItems,1);
  assert.deepEqual(Array.from(sent.schema.properties.paths.items.properties.realm.enum),['anarchadia']);
  assert.equal(sent.schema.properties.paths.items.properties.steps.maxItems,1);
  assert.deepEqual(Array.from(sent.schema.properties.governance.properties.included.enum),[false]);
});

for(const [label,change]of [
  ['unrequested extra subsystem',raw=>raw.paths.push(path('cerbanimo','skilled-labor'))],
  ['extra checkpoints',raw=>raw.paths[0].steps.push('Invent another checkpoint.')],
  ['excluded governance',raw=>raw.governance={included:true,title:'Determine rewards',purpose:'Add rewards.',agreements:[],reviewQuestion:'Which rewards?'}],
  ['wrong realm/type pairing',raw=>raw.paths[0].type='material-acquirement'],
])test(`invalid AI scope is rejected before persistence: ${label}`,async()=>{
  const raw=result();change(raw);const app=harness(raw);
  await assert.rejects(app.create(),/scope|path|checkpoint|governance|type/i);
  assert.equal(JSON.parse(app.storage.get('civweave.intentions.v127')).length,1);
  assert.equal(app.calls.length,1,'Scope rejection must not hide another generation call.');
});

test('an explicit Quest keeps canonical artifact ownership even when learning is part of its goal',()=>{
  const app=harness();let checked='';app.context.CivweaveGuideCapabilityPassoverV1={directCanonicalArtifact:text=>{checked=text;return'weave'}};
  assert.equal(app.api.learningJourneyIntent('Create a Quest to learn to convert Celsius and Fahrenheit.'),false);
  assert.match(checked,/create a quest/i);
  app.context.CivweaveGuideCapabilityPassoverV1.directCanonicalArtifact=()=> 'curriculum';
  assert.equal(app.api.learningJourneyIntent('Create a Learning Journey to learn to convert Celsius and Fahrenheit.'),true);
});

test('continuations keep the matching project while unrelated saved wishes remain outside the prompt',()=>{
  const app=harness(),memory=app.api.memory([{role:'user',text:'Create a Quest to study unrelated tarot.'},{role:'assistant',text:'Unrelated response.'},{role:'user',text:'Create the prior digital note'},{role:'assistant',text:'Ready to draft it.'}],'draft that');
  assert.equal(memory.currentWish,'Create the prior digital note');
  assert.equal(memory.currentPlan.id,'old-note');
  assert.equal(memory.savedWeaves.length,1);
  assert.doesNotMatch(JSON.stringify(memory),/tarot|Unrelated response/);
  assert.equal(app.api.memory([{role:'user',text:'Create the prior digital note'}],'try again').currentWish,'Create the prior digital note','An explicit retry keeps its own project scope.');
});

test('ordinary project needs remain a model decision while explicit exclusions are binding',async()=>{
  const app=harness(),mixed='Create a Quest to learn joinery and repair a chair using tools I own. No FellowFare path.';
  const raw=result();raw.paths=[path('living-school','learning'),path('cerbanimo','skilled-labor')];
  const model=harness(raw);await model.create(mixed);
  assert.equal(model.calls[0].schema.properties.paths.maxItems,4,'Ordinary needs must not be routed by a keyword-only realm list.');
  assert.deepEqual(Array.from(model.calls[0].schema.properties.paths.items.properties.realm.enum),['living-school','cerbanimo','anarchadia']);
  const scope=app.api.memory([],mixed).structuralConstraints;
  assert.equal(scope.pathCount,null);assert.equal(scope.allowedRealms,null);
  assert.deepEqual(Array.from(scope.excludedRealms),['fellowfare']);
});
