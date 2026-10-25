import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read=path=>readFileSync(new URL(`../public/${path}`,import.meta.url),'utf8');
const request='Create a Quest titled QA READY Decision v2. Goal: record the personal, non-binding fictional QA decision READY. Exactly one Anarchadia path with one checkpoint: the saved evidence note reads READY. One Hero, zero budget, no other participants, no rights changes, no rewards, no external actions. Set governance included false. Save for review.';
const path=(realm='anarchadia',type='civic-governance')=>({realm,type,title:'Record the personal decision',purpose:'Keep the requested non-binding personal decision.',steps:['Save the READY decision note.'],completionCriteria:'The saved decision note reads READY.',evidence:['The local READY decision note']});
const result=()=>({title:'QA READY Decision v2',wish:request,outcome:'The personal fictional decision READY is recorded.',assumptions:['This is fictional local QA.'],paths:[path()],governance:{included:false}});
const realmTypes={'living-school':'learning',cerbanimo:'skilled-labor',fellowfare:'material-acquirement',anarchadia:'civic-governance'};
function slotResult(included=['anarchadia']){
  const raw=result();delete raw.paths;raw.pathOrder=[...included];raw.governance={included:false,title:'',purpose:'',agreements:[],reviewQuestion:''};raw.subsystems=Object.fromEntries(Object.entries(realmTypes).map(([realm,type])=>{
    const selected=included.includes(realm),content=selected?path(realm,type):{title:'',purpose:'',steps:[],completionCriteria:'',evidence:[]};delete content.realm;delete content.type;
    return[realm,{included:selected,reason:selected?`${realm} contributes the requested outcome.`:`No ${realm} need was requested.`,...content}];
  }));return raw;
}
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
  const slots=sent.schema.properties.subsystems;
  assert.equal(sent.schema.properties.paths,undefined,'Model authoring must consider each subsystem once rather than repeat array entries.');
  assert.deepEqual(Array.from(slots.required),Object.keys(realmTypes));
  for(const realm of Object.keys(realmTypes)){
    const slot=slots.properties[realm];
    assert.deepEqual(Array.from(slot.properties.included.enum),[realm==='anarchadia']);
    assert.equal(slot.properties.type,undefined);assert.equal(slot.properties.realm,undefined,'A slot already owns its canonical realm and type.');
    assert.ok(slot.required.includes('reason'));assert.equal(slot.required.includes('order'),false);assert.equal(slot.properties.order,undefined,'The sequence is authored once at the top level.');
    assert.equal(slot.properties.reason.minLength,1,'Every decision needs an explanation, including excluded subsystems.');
  }
  assert.equal(slots.properties.anarchadia.properties.steps.maxItems,1);
  assert.ok(sent.schema.required.includes('pathOrder'));assert.equal(sent.schema.properties.pathOrder.uniqueItems,true);
  assert.equal(sent.schema.properties.pathOrder.minItems,1);assert.equal(sent.schema.properties.pathOrder.maxItems,1);
  assert.deepEqual(Array.from(sent.schema.properties.pathOrder.items.enum),['anarchadia']);
  assert.deepEqual(Array.from(sent.schema.properties.governance.properties.included.enum),[false]);
  assert.match(prompt,/entire requested final outcome/i);
  assert.match(prompt,/review.only.*later.*work/is,'Saving for review must not reduce the planned outcome to its first approval gate.');
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
  const slots=model.calls[0].schema.properties.subsystems.properties;
  assert.deepEqual(Array.from(slots.fellowfare.properties.included.enum),[false]);
  assert.equal(slots['living-school'].properties.included.enum,undefined,'Unconstrained subsystem inclusion remains the model decision.');
  const scope=app.api.memory([],mixed).structuralConstraints;
  assert.equal(scope.pathCount,null);assert.equal(scope.allowedRealms,null);
  assert.deepEqual(Array.from(scope.excludedRealms),['fellowfare']);
});

test('legacy type-only paths still derive the canonical realm without changing semantic path choice',async()=>{
  const raw=result();raw.paths=[path('living-school','learning')];delete raw.paths[0].realm;
  const app=harness(raw),authored=await app.create('Create a Quest to understand and practise temperature conversions.');
  assert.equal(authored.plan.paths[0].type,'learning');assert.equal(authored.plan.paths[0].realm,'living-school');
  const schema=app.calls[0].schema.properties.subsystems.properties['living-school'];
  assert.equal(schema.properties.type,undefined);assert.equal(schema.properties.realm,undefined);
  assert.match(schema.description,/learning.*living-school/);
  assert.match(app.calls[0].messages[0].content,/skilled-labor.*cerbanimo/);
  assert.equal(app.calls[0].think,false,'Ollama artifact authoring uses its explicit non-thinking request mode.');
});

test('four mandatory decisions preserve a single model-selected path and explain exclusions',async()=>{
  const raw=slotResult(['living-school']),app=harness(raw),authored=await app.create('Create a Quest to understand and practise temperature conversions.');
  assert.deepEqual(Array.from(authored.plan.paths,row=>[row.realm,row.type]),[['living-school','learning']]);
  assert.deepEqual(JSON.parse(JSON.stringify(authored.plan.subsystemDecisions)),Object.fromEntries(Object.entries(raw.subsystems).map(([realm,slot])=>[realm,{included:slot.included,reason:slot.reason,order:slot.included?raw.pathOrder.indexOf(realm)+1:0}])));
  const saved=JSON.parse(app.storage.get('civweave.intentions.v127')).find(row=>row.id===authored.plan.id);
  assert.deepEqual(saved.plan.subsystemDecisions,JSON.parse(JSON.stringify(authored.plan.subsystemDecisions)));
  assert.equal(app.calls.length,1);
});

test('the shared runtime preserves and validates the four-slot authoring schema without unions',async()=>{
  const app=harness(slotResult());await app.create();
  const runtimeContext=vm.createContext({Date,console});vm.runInContext(read('app/shared/civweave-model-runtime.js'),runtimeContext);
  const runtime=runtimeContext.CivweaveModelRuntime,schema=runtime.sanitizeSchema(app.calls[0].schema,{provider:'ollama'});
  assert.equal(runtime.validateSchema(slotResult(),schema).length,0);
  assert.equal(schema.properties.subsystems.properties.anarchadia.properties.steps.items.type,'string','Nested path fields must survive the runtime schema depth/node limits.');
  const invalid=slotResult();invalid.subsystems.cerbanimo.included=true;
  assert.match(runtime.validateSchema(invalid,schema).join('\n'),/cerbanimo.included/);
  assert.doesNotMatch(JSON.stringify(schema),/"(?:anyOf|oneOf)"/,'The shared runtime must not collapse alternative routing branches.');
});

test('included subsystem paths follow the model prerequisite order rather than fixed slot key order',async()=>{
  const sequence=['anarchadia','living-school','fellowfare','cerbanimo'],app=harness(slotResult(sequence));
  const authored=await app.create('Create a Quest with a shared agreement, learning, needed resource exchange and productive work. Save for review.');
  assert.deepEqual(Array.from(authored.plan.paths,row=>row.realm),sequence);
  assert.equal(authored.plan.state,'review');assert.equal(authored.plan.requiresExplicitActivation,true);
  assert.deepEqual(Array.from(app.calls[0].schema.properties.subsystems.required),Object.keys(realmTypes));
  assert.match(app.calls[0].messages[0].content,/agreements before.*acquisition.*construction/i);
  assert.match(app.calls[0].messages[0].content,/future.*purchase.*build.*steps/is,'An inert review plan must still describe the actual future work that its outcome requires.');
  assert.match(app.calls[0].messages[0].content,/already knowing.*does not remove.*production/i,'Existing skills must not erase the requested productive deliverable.');
});

test('one top-level sequence derives persisted order without relying on repeated numerical slot labels',async()=>{
  const sequence=['anarchadia','living-school','fellowfare','cerbanimo'],raw=slotResult(sequence);
  raw.subsystems.anarchadia.order=1;raw.subsystems['living-school'].order=1;
  const app=harness(raw),authored=await app.create('Create a Quest with the necessary shared, learning, resource and productive dependencies.');
  assert.deepEqual(Array.from(authored.plan.paths,row=>row.realm),sequence);
  assert.equal(authored.plan.subsystemDecisions['living-school'].order,2);
});

for(const [label,change,pattern]of [
  ['missing subsystem decision',raw=>delete raw.subsystems.cerbanimo,/subsystem.*cerbanimo/i],
  ['missing reason',raw=>raw.subsystems.cerbanimo.reason='',/reason/i],
  ['missing path sequence',raw=>delete raw.pathOrder,/path order/i],
  ['duplicate sequence entry',raw=>raw.pathOrder.push('anarchadia'),/path order/i],
  ['missing included subsystem in sequence',raw=>{raw.subsystems.cerbanimo={...raw.subsystems.anarchadia}},/path order/i],
  ['excluded subsystem in sequence',raw=>raw.pathOrder.push('cerbanimo'),/path order/i],
  ['unknown subsystem in sequence',raw=>raw.pathOrder.push('unknown-system'),/path order/i],
  ['contradictory slot ownership',raw=>raw.subsystems.anarchadia.type='learning',/type|realm/i],
  ['all subsystems excluded',raw=>{raw.subsystems.anarchadia={...slotResult([]).subsystems.anarchadia};raw.pathOrder=[]},/incomplete|path order/i],
  ['mixed authoring shapes',raw=>raw.paths=[path()],/authoring|shape/i],
])test(`invalid subsystem decision is rejected before persistence: ${label}`,async()=>{
  const raw=slotResult();change(raw);const app=harness(raw);
  await assert.rejects(app.create('Create a Quest to record a personal decision.'),pattern);
  assert.equal(JSON.parse(app.storage.get('civweave.intentions.v127')).length,1);assert.equal(app.calls.length,1,'No hidden model retry or fabricated path can replace invalid decisions.');
});

test('the real runtime rejects a missing governance field before normalization and admits an explicit empty excluded layer',async()=>{
  const app=harness(slotResult());await app.create('Create a Quest with an explicitly requested shared consent agreement.');
  const runtimeContext=vm.createContext({Date,console,URL,AbortController,setTimeout,clearTimeout});vm.runInContext(read('app/shared/civweave-model-runtime.js'),runtimeContext);
  const runtime=runtimeContext.CivweaveModelRuntime,raw=slotResult(),sourceRequest=app.calls[0];let calls=0;
  raw.governance={included:true,title:'Requested shared agreement',purpose:'Record the requested consent.',agreements:['Agree on the actual requested boundary.']};
  const execute=()=>runtime.generate({...sourceRequest,config:{provider:'ollama',model:'fixture',timeoutMs:5000},maxRepairAttempts:0,transport:async()=>{calls++;return{text:JSON.stringify(raw),provider:'ollama',model:'fixture'}}});
  const invalid=await execute();assert.equal(invalid.status,'invalid-response');assert.match(invalid.structured.errors.join('\n'),/governance.reviewQuestion/);assert.equal(calls,1);
  raw.governance.reviewQuestion='Do the participants consent to the requested boundary?';
  const valid=await execute();assert.equal(valid.status,'success');assert.equal(app.api.normalizePlan(valid.outputJson,{text:'Create a Quest with the requested shared consent.'}).governance.reviewQuestion,raw.governance.reviewQuestion);
  raw.governance=slotResult().governance;const excluded=await execute();assert.equal(excluded.status,'success');assert.equal(app.api.normalizePlan(excluded.outputJson,{text:'Create a Quest with no governance.'}).governance,null);
});

test('slot authoring retains explicit exclusions, counts and checkpoint validation',async()=>{
  const cases=[
    [slotResult(['anarchadia','cerbanimo']),request,/scope|paths/i],
    [slotResult(['fellowfare']),'Create a Quest to record a personal decision. No FellowFare path.',/scope/i],
    [slotResult(['anarchadia']),request,/checkpoint/i],
  ];cases[2][0].subsystems.anarchadia.steps.push('An extra checkpoint.');
  for(const[raw,text,pattern]of cases){const app=harness(raw);await assert.rejects(app.create(text),pattern);assert.equal(app.calls.length,1);assert.equal(JSON.parse(app.storage.get('civweave.intentions.v127')).length,1)}
});

test('legacy path arrays keep their authored sequence and existing validation',async()=>{
  const raw=result();raw.paths=[path('fellowfare','material-acquirement'),path('living-school','learning')];
  const app=harness(raw),authored=await app.create('Create a Quest with the requested resource exchange followed by learning.');
  assert.deepEqual(Array.from(authored.plan.paths,row=>row.realm),['fellowfare','living-school']);
  assert.equal(authored.plan.subsystemDecisions,undefined);
});

test('repeated paths for one subsystem cannot turn workflow stages into a false multi-system weave',async()=>{
  const raw=result();raw.paths.push(path());const app=harness(raw);
  await assert.rejects(app.create('Create a Quest to record the requested personal decision.'),/repeats.*civic-governance/);
  assert.equal(JSON.parse(app.storage.get('civweave.intentions.v127')).length,1);
});
