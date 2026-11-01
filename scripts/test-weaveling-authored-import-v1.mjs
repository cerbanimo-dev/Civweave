import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const text='Create a Quest to build a small reading shelf. Save for review. No governance.';
const empty=()=>({included:false,reason:'This subsystem is not required.',title:'',purpose:'',steps:[],completionCriteria:'',evidence:[]});
const draft=()=>({title:'Reading shelf',wish:text,outcome:'A usable small reading shelf is built and checked.',assumptions:['The materials and tools are already available.'],pathOrder:['cerbanimo'],subsystems:{'living-school':empty(),cerbanimo:{included:true,reason:'The requested shelf needs construction.',title:'Build and inspect the shelf',purpose:'Produce the requested shelf.',steps:['Assemble the shelf and inspect its joints.'],completionCriteria:'The shelf stands level with secure joints.',evidence:['Saved inspection notes and a photograph of the shelf.']},fellowfare:empty(),anarchadia:empty()},governance:{included:false,title:'',purpose:'',agreements:[],reviewQuestion:''}});
function harness(){
  const storage=new Map(),events=[],modelCalls=[];let failKey='';
  const context={Date,Math,console,URL,TextEncoder,crypto:webcrypto,AbortController,structuredClone,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},queueMicrotask:fn=>fn(),localStorage:{getItem:key=>storage.get(key)??null,setItem(key,value){if(key===failKey)throw new Error('Device storage is full.');storage.set(key,String(value))},removeItem:key=>storage.delete(key)},location:{pathname:'/app/worldweaver/index.html',origin:'https://civweave.test',search:''},document:{readyState:'loading',documentElement:{dataset:{}},getElementById:()=>null,querySelector:()=>null,head:{append(){}}},addEventListener(){},dispatchEvent:event=>events.push(event),CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}}};
  context.globalThis=context;vm.createContext(context);
  vm.runInContext(read('app/shared/civweave-model-runtime.js'),context);
  context.CivweaveModelRuntime={...context.CivweaveModelRuntime,generate:async request=>{modelCalls.push(request);throw new Error('Authored import must not invoke inference.')}};
  for(const path of ['app/intention-planner-v141.js','app/weaveling-plan-materialization-v265.js','extensions/civweave-weaveling-plan-json-v190.js'])vm.runInContext(read(path),context,{filename:path});
  context.CivweaveWeavelingPlanMaterializationV265.patchPlanner();
  return{context,storage,events,modelCalls,api:context.CivweaveWeavelingPlanJsonV190,planner:context.CivweaveIntentionPlanner,guard:context.CivweaveWeavelingPlanMaterializationV265,fail:key=>{failKey=key},import:options=>context.CivweaveWeavelingPlanJsonV190.importAuthoredPlan({text,outputJson:draft(),confirmed:true,authorship:{kind:'editor-agent',changeSummary:'Made the evidence and completion checks concrete.'},...options})};
}

test('authored import uses the real prompt/schema contract and performs zero inference',async()=>{
  const app=harness(),contract=await app.api.authoredPlanContract({text});
  assert.equal(JSON.stringify(contract.messages),JSON.stringify(app.api.prompt(app.api.memory([],text))));
  assert.equal(contract.schema.properties.paths,undefined);assert.ok(contract.schema.properties.subsystems);
  assert.equal(contract.stageContract.sourceModule,'/extensions/civweave-weaveling-plan-json-v190.js');
  assert.equal(contract.stageContract.revision,app.api.version);
  assert.equal(contract.stageContract.promptDigest,'sha256:'+createHash('sha256').update(JSON.stringify({messages:contract.messages,schema:contract.schema})).digest('hex'));
  const result=await app.import({idempotencyKey:'editor-shelf-v1'});
  assert.equal(result.ok,true,result.error);assert.equal(result.inferenceInvocations,0);assert.equal(app.modelCalls.length,0);
  assert.equal(result.plan.authoring.aiGenerated,false);assert.equal(result.plan.authoring.mode,'external-authored-json');assert.equal(result.plan.authoring.provider,undefined);
  assert.equal(result.plan.authoring.authorship.kind,'editor-agent');assert.equal(result.plan.state,'review');
  assert.equal(result.receipt.planId,result.plan.id);assert.equal(result.receipt.authorization.state,'pending');assert.equal(result.receipt.execution.state,'not-started');
  assert.equal(result.receipt.stageContract.promptDigest,contract.stageContract.promptDigest);
  const saved=JSON.parse(app.storage.get('civweave.intentions.v127'))[0];assert.equal(JSON.stringify(saved.plan.authoring.receipt),JSON.stringify(result.receipt));
  assert.equal(app.storage.has('civweave.realm-inbox.v1'),false);assert.equal(app.storage.has('civweave.reward-ledger.v2'),false);
  assert.match(app.planner.format(result.plan),/imported|authored/i);assert.doesNotMatch(app.planner.format(result.plan),/I generated/);
});

test('explicit import consent and exact stage revision are required before a draft is saved',async()=>{
  const app=harness();
  for(const options of [{confirmed:false},{expectedRevision:'stale-stage'}]){const result=await app.import(options);assert.equal(result.ok,false);assert.match(result.code,/CONSENT|REVISION/)}
  assert.equal(app.storage.size,0);assert.equal(app.modelCalls.length,0);
});

test('schema and scope failures cannot be turned into an authored flag bypass',async()=>{
  const app=harness();
  for(const change of [raw=>delete raw.subsystems.cerbanimo.completionCriteria,raw=>{raw.subsystems.cerbanimo.steps=[]},raw=>{raw.pathOrder.push('fellowfare')},raw=>{raw.subsystems.cerbanimo.steps=[123]},raw=>{raw.subsystems.cerbanimo.type='learning'}]){
    const raw=draft();change(raw);const result=await app.import({outputJson:raw});assert.equal(result.ok,false);assert.match(result.code,/VALIDATION/);assert.equal(app.storage.size,0);
  }
  const forged={id:'fake',schema:'civweave.intention-weave.v1',state:'review',authoring:{mode:'external-authored-json',aiGenerated:false,validated:true}};
  assert.equal(app.planner.authoredImportedPlan(forged),false);assert.throws(()=>app.planner.persist(forged),error=>error.code==='QUEST_AI_AUTHORING_REQUIRED');
  assert.equal(app.guard.materialize(forged),null);assert.equal(app.modelCalls.length,0);
});

test('imported review drafts survive quarantine and use the canonical review surface',async()=>{
  const app=harness(),result=await app.import();assert.equal(result.ok,true,result.error);
  assert.equal(app.planner.authoredImportedPlan(result.plan),true);assert.equal(app.guard.aiAuthoredPlan(result.plan),false);
  assert.equal(app.guard.quarantineUnverifiedReviewQuests().count,0);
  let opened='';app.context.CivweaveSharedReviewSurfaceV234={openPlan:id=>{opened=id;return true}};
  assert.equal(app.guard.openReview(result.plan),true);assert.equal(opened,result.plan.id);
  const ordinary=await app.api.createModelPlan({text},{selectedConfig:()=>({provider:'deterministic'})}).then(()=>null,error=>error);
  assert.match(ordinary.message,/AI model|deterministic/i);assert.equal(app.modelCalls.length,0);
});

test('idempotency returns the actual saved receipt and conflicting reuse fails without duplicate drafts',async()=>{
  const app=harness(),[a,b]=await Promise.all([app.import({idempotencyKey:'one-import'}),app.import({idempotencyKey:'one-import'})]);
  assert.equal(a.ok,true,a.error);assert.equal(b.ok,true,b.error);assert.equal(a.plan.id,b.plan.id);assert.equal(JSON.stringify(a.receipt),JSON.stringify(b.receipt));assert.equal(b.unchanged,true);
  const changed=draft();changed.title='Different shelf';const conflict=await app.import({outputJson:changed,idempotencyKey:'one-import'});assert.equal(conflict.ok,false);assert.equal(conflict.code,'QUEST_IMPORT_IDEMPOTENCY_CONFLICT');
  assert.equal(JSON.parse(app.storage.get('civweave.intentions.v127')).length,1);assert.equal(app.modelCalls.length,0);
});

test('materialization failure is visible and a retry resumes the saved draft without a new model call',async()=>{
  const app=harness();app.fail('civweave.working-campus.v1');
  const failed=await app.import({idempotencyKey:'storage-retry'});assert.equal(failed.ok,false);assert.equal(failed.saved,true);assert.match(failed.error,/storage|full/i);assert.ok(failed.receipt?.planId);
  app.fail('');const retried=await app.import({idempotencyKey:'storage-retry'});assert.equal(retried.ok,true,retried.error);assert.equal(retried.plan.id,failed.receipt.planId);assert.equal(app.modelCalls.length,0);assert.equal(JSON.parse(app.storage.get('civweave.intentions.v127')).length,1);
});

test('authored revisions use an exact saved revision guard and never reset active or completed work',async()=>{
  const app=harness(),first=await app.import();assert.equal(first.ok,true,first.error);
  const raw=draft();raw.outcome='A revised shelf is built and its measured level is recorded.';
  const conflict=await app.import({outputJson:raw,planId:first.plan.id,expectedPlanRevision:0});assert.equal(conflict.code,'QUEST_IMPORT_REVISION_CONFLICT');
  const edited=await app.import({outputJson:raw,planId:first.plan.id,expectedPlanRevision:1});assert.equal(edited.ok,true,edited.error);assert.equal(edited.plan.id,first.plan.id);assert.equal(edited.receipt.baseRevision,1);assert.equal(edited.receipt.artifactRevision,2);
  const rows=JSON.parse(app.storage.get('civweave.intentions.v127'));rows[0].state='active';rows[0].plan.state='active';rows[0].plan.paths[0].progress=[0];app.storage.set('civweave.intentions.v127',JSON.stringify(rows));
  const before=app.storage.get('civweave.intentions.v127'),blocked=await app.import({planId:first.plan.id,expectedPlanRevision:2});assert.equal(blocked.ok,false);assert.equal(blocked.code,'QUEST_IMPORT_REVISION_CONFLICT');assert.equal(app.storage.get('civweave.intentions.v127'),before);assert.equal(app.modelCalls.length,0);
});

test('native path imports use the actual compact stage prompt and do not invent prerequisite edges',async()=>{
  const app=harness(),raw=draft(),slot=raw.subsystems.cerbanimo;delete raw.subsystems;delete raw.pathOrder;raw.paths=[{type:'skilled-labor',realm:'cerbanimo',title:slot.title,purpose:slot.purpose,steps:slot.steps,completionCriteria:slot.completionCriteria,evidence:slot.evidence}];
  const contract=await app.api.authoredPlanContract({text,outputFormat:'native-paths'});assert.ok(contract.schema.properties.paths);assert.match(contract.messages[1].content,/CURRENT WISH/);
  const result=await app.import({outputJson:raw,outputFormat:'native-paths',expectedPromptDigest:contract.stageContract.promptDigest});assert.equal(result.ok,true,result.error);assert.equal(result.plan.dependencyOrder,undefined);assert.equal(result.receipt.stageContract.outputFormat,'native-paths');assert.equal(app.modelCalls.length,0);
  const rejected=await app.import({outputJson:raw,outputFormat:'native-paths',expectedPromptDigest:'sha256:'+'0'.repeat(64)});assert.equal(rejected.ok,false);assert.equal(rejected.code,'QUEST_IMPORT_REVISION_CONFLICT');
});

test('ledger write failures return no claimed saved receipt and no recursive generation',async()=>{
  const app=harness();app.fail('civweave.intentions.v127');const result=await app.import();assert.equal(result.ok,false);assert.equal(result.saved,false);assert.equal(result.receipt,undefined);assert.match(result.error,/storage|full/i);assert.equal(app.storage.size,0);assert.equal(app.modelCalls.length,0);
});

test('active generated and authored Quest loaders agree on the new canonical owner revisions',()=>{
  const expected={
    'app/local-guide-control-bypass-v1.js':['1.3.0-weaveling-plan-json-v190-authored-import','civweave-weaveling-plan-json-v190.js?v=1.3.0-authored-import'],
    'app/local-ai/native-server-guide-fastpath-v1.js':['1.3.0-weaveling-plan-json-v190-authored-import','civweave-weaveling-plan-json-v190.js?v=1.3.0-authored-import','intention-planner-v141.js?v=1.2.0-authored-import','weaveling-plan-materialization-v265.js?v=1.2.0-authored-import'],
    'app/shared-guide-surface-v236.js':['1.3.0-weaveling-plan-json-v190-authored-import','civweave-weaveling-plan-json-v190.js?v=1.3.0-authored-import','intention-planner-v141.js?v=1.2.0-authored-import','weaveling-plan-materialization-v265.js?v=1.2.0-authored-import'],
    'app/family-ai-loader-v105.js':['intention-planner-v141.js?v=1.2.0-authored-import'],
    'app/working-campus-v156.part5.txt':['1.3.0-weaveling-plan-json-v190-authored-import','civweave-weaveling-plan-json-v190.js?v=1.3.0-authored-import'],
    'app/lite-v129.html':['intention-planner-v141.js?v=1.2.0-authored-import'],
    'app/weaveling-plan-materialization-v265.js':['${PLANNER_PATH}?v=1.2.0-authored-import']
  };
  for(const[path,tokens]of Object.entries(expected))for(const token of tokens)assert.ok(read(path).includes(token),`${path} must select ${token}`);
});

test('retrying an older import key after a later editorial revision cannot overwrite the newer authored content',async()=>{
  const app=harness(),first=await app.import({idempotencyKey:'original-editor-pass'});assert.equal(first.ok,true,first.error);
  const revised=draft();revised.outcome='A shelf is assembled and its measured level is recorded.';
  const second=await app.import({outputJson:revised,idempotencyKey:'revised-editor-pass',planId:first.plan.id,expectedPlanRevision:1});assert.equal(second.ok,true,second.error);
  const before=app.storage.get('civweave.intentions.v127'),retry=await app.import({idempotencyKey:'original-editor-pass'});
  assert.equal(retry.ok,true,retry.error);assert.equal(retry.unchanged,true);assert.equal(retry.receipt.id,first.receipt.id);assert.equal(retry.plan.outcome,second.plan.outcome);assert.equal(app.storage.get('civweave.intentions.v127'),before);assert.equal(app.modelCalls.length,0);
  const saved=JSON.parse(before)[0].plan;assert.ok(saved.authoring.importHistory.some(entry=>entry.receipt.id===first.receipt.id),'the original receipt and authored snapshot must remain available');
});

test('authored history remains bounded and immutable across model revisions and exhaustion fails before writes',async()=>{
  const app=harness(),first=await app.import({idempotencyKey:'preserve-original'});assert.equal(first.ok,true,first.error);
  const modelRevision=structuredClone(first.plan);modelRevision.outcome='Model-edited shelf outcome';modelRevision.authoring={mode:'model-structured-json',aiGenerated:true,provider:'ollama',model:'fixture'};modelRevision.signals={aiGenerated:true};app.planner.persist(modelRevision);
  const historical=await app.import({idempotencyKey:'preserve-original'});assert.equal(historical.historical,true);assert.equal(historical.plan.outcome,'Model-edited shelf outcome');assert.equal(historical.receipt.id,first.receipt.id);
  for(let revision=2;revision<=8;revision++){const raw=draft();raw.outcome=`Editorial shelf outcome ${revision}`;const result=await app.import({outputJson:raw,idempotencyKey:`bounded-revision-${revision}`});assert.equal(result.ok,true,result.error)}
  const before=app.storage.get('civweave.intentions.v127'),raw=draft();raw.outcome='This revision would exceed the retained history limit';const limited=await app.import({outputJson:raw,idempotencyKey:'history-limit'});assert.equal(limited.ok,false);assert.equal(limited.code,'QUEST_IMPORT_HISTORY_LIMIT');assert.equal(app.storage.get('civweave.intentions.v127'),before);
  const current=JSON.parse(before)[0].plan;assert.equal(current.authoring.importHistory.length,8);assert.ok(current.authoring.importHistory.every(entry=>entry.plan.authoring.importHistory===undefined));assert.equal(app.modelCalls.length,0);
});
