import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {normalizeProjectReceipt,receiptUnlocksFinalTest} from '../public/app/services/living-school/modules/cerbanimo-bridge.mjs';

const engineSource=fs.readFileSync(new URL('../public/app/cerbanimo-quest-engine-v144.js',import.meta.url),'utf8');
const contractsSource=fs.readFileSync(new URL('../public/app/guide-contracts-v141.js',import.meta.url),'utf8');
const validatorSource=fs.readFileSync(new URL('../public/app/cerbanimo-ai-validator-v159.js',import.meta.url),'utf8');
function harness(source){
  const storage=new Map();
  const context=vm.createContext({console,structuredClone,URLSearchParams,queueMicrotask,setTimeout,clearTimeout,AbortController,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))},
    dispatchEvent(){},addEventListener(){},CustomEvent:class{}});
  vm.runInContext(source,context);
  return{context,storage,engine:context.CivweaveCerbanimoQuestV144,contracts:context.CivweaveGuideContractsV141};
}
function fixture(engine){
  const quest=engine.createQuestFromInput({title:'QA tiny report',objective:'Write alpha beta gamma.',steps:['Write alpha','Add beta','Add gamma'],proofRequirements:['alpha','alpha beta','alpha beta gamma']});
  quest.authoring={mode:'model-json-application-validated',provider:'ollama',model:'gemma4:latest',aiGenerated:true};
  engine.addQuest(quest);
  return quest;
}
function complete(engine,quest){
  quest.tasks.forEach((task,index)=>{
    assert.equal(engine.applyTaskTransition(quest.id,task.id,'in-progress').ok,true);
    assert.equal(engine.applyTaskTransition(quest.id,task.id,'review').ok,false,'proof is required');
    engine.addProof(quest.id,task.id,{kind:'test',value:['alpha','alpha beta','alpha beta gamma'][index]});
    assert.equal(engine.applyTaskTransition(quest.id,task.id,'review').ok,true);
    assert.equal(engine.applyTaskTransition(quest.id,task.id,'completed','Fixture acceptance').ok,true);
  });
  assert.equal(engine.submitQuest(quest.id).ok,true);
  assert.equal(engine.reviewQuest(quest.id,'accept','Fixture final acceptance').ok,true);
}

test('reopening accepted Endeavor work invalidates task and final acceptance',()=>{
  const {engine}=harness(engineSource),quest=fixture(engine);
  complete(engine,quest);
  assert.equal(engine.readState().quests[0].status,'completed');
  assert.equal(engine.applyTaskTransition(quest.id,quest.tasks[0].id,'ready').ok,true);
  const reopened=engine.readState().quests[0];
  assert.equal(reopened.status,'active');
  assert.equal(reopened.review.state,'none');
  assert.equal(reopened.tasks[0].review.state,'none');
  assert.equal(engine.submitQuest(quest.id).ok,false,'reopened work requires fresh completion');
  assert.equal(engine.reviewQuest(quest.id,'accept').ok,false,'stale final acceptance cannot be replayed');
});

test('independent AI review survives storage, supports revision, and permits final validation',async()=>{
  const {engine,context}=harness(engineSource),quest=fixture(engine),calls=[];
  let requestRevision=true;
  context.document={readyState:'loading',querySelector:()=>null};
  context.requestAnimationFrame=()=>0;
  context.CivweaveFamilyAILoaderV105={ensure:async()=>true};
  context.CivweaveModelRuntime={readSharedConfig:()=>({provider:'ollama',model:'gemma4:latest'}),generate:async request=>{
    calls.push(request.purpose);
    const revision=requestRevision&&request.purpose.includes('task-validation');requestRevision=false;
    return{status:'success',actual:{provider:'ollama',model:'gemma4:latest'},requestId:`qa-${calls.length}`,
      outputJson:{decision:revision?'revision':'pass',confidence:.99,summary:'Fixture evidence reviewed.',criteria:[{criterion:'Exact cumulative text',pass:!revision,reason:'Fixture comparison'}],concerns:[],repairInstructions:revision?['Attach corrected evidence.']:[],unmetCriteria:[]}};
  }};
  vm.runInContext(validatorSource,context);
  const validator=context.CerbanimoAIValidatorV159;
  for(const [index,task] of quest.tasks.entries()){
    engine.applyTaskTransition(quest.id,task.id,'in-progress');
    engine.addProof(quest.id,task.id,{kind:'test',value:['alpha','alpha beta','alpha beta gamma'][index]});
    engine.applyTaskTransition(quest.id,task.id,'review');
    await validator.validateTask(quest.id,task.id);
    if(index===0){
      assert.equal(engine.readState().quests[0].tasks[0].status,'revision');
      engine.addProof(quest.id,task.id,{kind:'test',value:'alpha'});
      engine.applyTaskTransition(quest.id,task.id,'review');
      await validator.validateTask(quest.id,task.id);
    }
  }
  const stored=engine.readState().quests[0];
  assert.equal(stored.authoring.model,'gemma4:latest');
  for(const task of stored.tasks){assert.equal(task.review.validator,'ai');assert.equal(task.review.provider,'ollama');assert.equal(task.review.decision,'pass');assert.ok(task.review.criteria.length)}
  engine.submitQuest(quest.id);
  await validator.validateQuest(quest.id);
  assert.equal(engine.readState().quests[0].status,'completed');
  assert.equal(calls.filter(purpose=>purpose.includes('final')||purpose.includes('quest-validation')).length,1);
});

test('Rook recognizes canonical Manifests, keeps drafts private, and revises concrete fields',()=>{
  const {contracts,storage}=harness(contractsSource);
  const action=contracts.compose('Create a Manifest: two notebooks and one pencil; quantity: 2 notebooks; area: Albany, NY; timing: today; free gift.','fellowfare',{});
  assert.ok(action,'Manifest is a canonical Rook artifact');
  assert.equal(action.state,'review');
  assert.equal(action.fields.area,'Albany, NY');
  assert.equal(action.fields.quantity,'2 notebooks');
  assert.equal(action.fields.exchangeMethod,'Gift');
  assert.equal(storage.has('civweave.fellowfare.pending-threads.v1'),false,'review is private');
  const revised=contracts.compose('Revise the Manifest: quantity: 3 notebooks; area: Troy, NY; timing: tomorrow.','fellowfare',{});
  assert.equal(revised.id,action.id);
  assert.equal(revised.fields.area,'Troy, NY');
  assert.equal(revised.fields.quantity,'3 notebooks');
  assert.equal(revised.fields.timing,'tomorrow');
  assert.equal(revised.fields.exchangeMethod,'Gift','revision preserves previously agreed terms');
  assert.equal(contracts.approve(action.id).ok,true);
  const published=JSON.parse(storage.get('civweave.fellowfare.pending-threads.v1'));
  assert.equal(published.length,1);
  assert.equal(published[0].area,'Troy, NY');
});

test('Rook uses an explicit initial location and retains missing-detail approval gates',()=>{
  const {contracts,storage}=harness(contractsSource);
  const action=contracts.compose('I need a pencil, free gift in Albany, NY.','fellowfare',{});
  assert.equal(action.fields.area,'Albany, NY');
  const missing=contracts.compose('Create a Manifest for a spare notebook.','fellowfare',{});
  assert.equal(missing.state,'clarifying');
  assert.equal(contracts.approve(missing.id).ok,false);
  assert.equal(storage.has('civweave.fellowfare.pending-threads.v1'),false);
});

test('Merlin feature requests and approved implementation handoffs preserve the actual request',()=>{
  const {contracts}=harness(contractsSource);
  const request='Create a feature request to export saved chats as a local JSON file.';
  const action=contracts.compose(request,'anarchadia',{});
  assert.equal(action.kind,'feature-request');
  assert.match(action.title,/export saved chats/i);
  assert.match(action.fields.proposedChange,/export saved chats/i);
  assert.doesNotMatch(JSON.stringify(action),/dark.mode|Appearance setting/i);
  assert.equal(action.state,'review');
  assert.equal(contracts.approve(action.id).ok,true);
  const approved=contracts.get(action.id),linked=contracts.get(approved.linkedActionIds[0]);
  assert.ok(linked,'approved handoff remains in the canonical action store');
  assert.match(linked.fields.objective,/export saved chats/i);
  assert.match(linked.fields.smallestVisibleResult,/export saved chats/i);
  assert.equal(contracts.approve(action.id).ok,true);
  assert.equal(contracts.items().filter(item=>item.fields.sourceRequestId===action.id).length,1,'repeated approval is idempotent');
});

test('the active Cerbanimo route loads the one stable independent validator',()=>{
  const html=fs.readFileSync(new URL('../public/app/realm-console-v140.html',import.meta.url),'utf8');
  assert.equal((html.match(/src="\/app\/cerbanimo-ai-validator-v159\.js/g)||[]).length,1);
  assert.doesNotMatch(html,/src="\/app\/cerbanimo-ai-validator-v156\.js/);
});

test('mounted Cerbanimo refreshes when the parent chat writes its canonical store',()=>{
  const listeners=new Map(),frames=[];
  const context=vm.createContext({console,structuredClone,URLSearchParams,location:{search:'?system=cerbanimo'},
    document:{readyState:'loading',hidden:false,documentElement:{},querySelector:()=>null},
    localStorage:{getItem:()=>null,setItem(){}},MutationObserver:class{observe(){}},
    addEventListener:(name,fn)=>listeners.set(name,fn),requestAnimationFrame:fn=>frames.push(fn)});
  vm.runInContext(engineSource.replace('root.CivweaveCerbanimoQuestV144={','root.CivweaveCerbanimoQuestV144={observe,'),context);
  context.CivweaveCerbanimoQuestV144.observe();
  frames.shift()();
  assert.equal(typeof listeners.get('storage'),'function');
  listeners.get('storage')({key:context.CivweaveCerbanimoQuestV144.STORE_KEY});
  assert.equal(frames.length,1,'an external canonical store write schedules the owning renderer');
});

test('embedded Cerbanimo validation uses the parent shared runtime on explicit review',async()=>{
  const {engine,context}=harness(engineSource),quest=fixture(engine),task=quest.tasks[0];
  engine.applyTaskTransition(quest.id,task.id,'in-progress');engine.addProof(quest.id,task.id,{value:'alpha'});engine.applyTaskTransition(quest.id,task.id,'review');
  let ensured=0,generated=0;
  context.document={readyState:'loading',querySelector:()=>null};context.requestAnimationFrame=()=>0;context.location={origin:'https://civweave-staging.pages.dev'};
  context.parent={location:{origin:context.location.origin},CivweaveFamilyAILoaderV105:{ensure:async()=>{ensured++}},CivweaveModelRuntime:{readSharedConfig:()=>({provider:'ollama',model:'gemma4:latest'}),generate:async()=>{generated++;return{status:'success',actual:{provider:'ollama',model:'gemma4:latest'},outputJson:{decision:'pass',confidence:.99,summary:'Fixture reviewed.',criteria:[],concerns:[],repairInstructions:[]}}}}};
  vm.runInContext(validatorSource,context);
  assert.equal(ensured,0,'loading validation UI does not start the model runtime');
  await context.CerbanimoAIValidatorV159.validateTask(quest.id,task.id);
  assert.equal(ensured,1);assert.equal(generated,1);
  assert.equal(engine.readState().quests[0].tasks[0].review.provider,'ollama');
});

test('Moss practicum outbox imports once as a gated Endeavor and receipts require real independent acceptance',async()=>{
  const {engine,context,storage}=harness(engineSource);
  const packet={type:'civweave:project-handoff-requested',contractVersion:'civweave.cerbanimo-project.v1',sourceApplication:'living-school',requestId:'request-qa-practicum',schoolId:'school-qa-learning',projectRef:'practicum-qa-report',moduleId:'final-project',learnerId:'local-learner',title:'QA report practicum',creativeIntention:'Write alpha beta gamma.',project:{id:'practicum-qa-report',title:'QA report practicum',artifact:'alpha beta gamma',proof:'The three words appear in order.',capability:'Write a tiny report.'}};
  storage.set('civweave.cerbanimo.project-handoff.outbox.v1',JSON.stringify([packet]));
  engine.migrate();engine.migrate();
  const quest=engine.readState().quests[0];
  assert.ok(quest,'the active canonical engine consumes the outbox');
  assert.equal(engine.readState().quests.length,1,'retry must not duplicate the Endeavor');
  assert.equal(quest.status,'draft');
  assert.equal(engine.applyTaskTransition(quest.id,quest.tasks[0].id,'in-progress').ok,false,'ratification precedes work');
  let receipt=normalizeProjectReceipt(engine.projectReceipt(quest.id));
  assert.equal(receipt.projectRef,packet.projectRef);
  assert.equal(receipt.status,'submitted');
  assert.equal(receiptUnlocksFinalTest(receipt),false);
  assert.equal(engine.activateQuest(quest.id).ok,true);
  context.document={readyState:'loading',querySelector:()=>null};context.requestAnimationFrame=()=>0;
  context.CivweaveFamilyAILoaderV105={ensure:async()=>true};
  context.CivweaveModelRuntime={readSharedConfig:()=>({provider:'ollama',model:'gemma4:latest'}),generate:async()=>({status:'success',actual:{provider:'ollama',model:'gemma4:latest'},requestId:'qa-independent-review',outputJson:{decision:'pass',confidence:.99,summary:'Fixture independent review.',criteria:[],concerns:[],repairInstructions:[],unmetCriteria:[]}})};
  vm.runInContext(validatorSource,context);
  const validator=context.CerbanimoAIValidatorV159;
  for(const task of quest.tasks){engine.applyTaskTransition(quest.id,task.id,'in-progress');engine.addProof(quest.id,task.id,{value:packet.project.artifact});engine.applyTaskTransition(quest.id,task.id,'review');await validator.validateTask(quest.id,task.id)}
  engine.submitQuest(quest.id);
  assert.equal(receiptUnlocksFinalTest(normalizeProjectReceipt(engine.projectReceipt(quest.id))),false,'task acceptance alone does not imply final acceptance');
  await validator.validateQuest(quest.id);
  receipt=normalizeProjectReceipt(engine.projectReceipt(quest.id));
  assert.equal(receiptUnlocksFinalTest(receipt),true);
  assert.equal(receipt.demo,false);
  assert.equal(receipt.reviewId,'qa-independent-review');
  assert.ok(JSON.parse(storage.get('civweave.cerbanimo.project-receipts.v1')).some(item=>item.receiptId===receipt.receiptId));
  engine.applyTaskTransition(quest.id,quest.tasks[0].id,'ready');
  const reopened=normalizeProjectReceipt(engine.projectReceipt(quest.id));
  assert.equal(receiptUnlocksFinalTest(reopened),false);
  assert.ok(reopened.statusRevision>receipt.statusRevision);
});
