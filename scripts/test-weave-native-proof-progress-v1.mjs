import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL(`../public/${path}`,import.meta.url),'utf8');
const keys={campus:'civweave.working-campus.v1',intentions:'civweave.intentions.v127',inbox:'civweave.realm-inbox.v1'};
function fixture(){
  const storage=new Map(),listeners=new Map(),writes=[];
  const path={id:'qa-digital-note',realm:'cerbanimo',title:'Create a digital note',purpose:'Write alpha beta gamma.',steps:['Write alpha','Add beta','Add gamma'],progress:[],status:'active'};
  const plan={id:'qa-ready-decision-v2',state:'active',paths:[path]};
  const save=(key,value)=>storage.set(key,JSON.stringify(value));
  save(keys.campus,{stage:'active',wish:'Preserve the original intention',plan});
  save(keys.intentions,[{id:plan.id,kind:'weave-plan',state:'active',done:false,plan}]);
  save(keys.inbox,[{id:'qa-handoff',target:'cerbanimo',status:'accepted',payload:{weaveId:plan.id,path}}]);
  const context=vm.createContext({console,URL,URLSearchParams,structuredClone,AbortController,Date,Math,JSON,Object,Array,String,Number,Boolean,Promise,Set,Map,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{storage.set(key,String(value));writes.push(key)}},
    document:{readyState:'loading',hidden:false,documentElement:{dataset:{}},querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},
    location:{search:'?system=cerbanimo',href:'https://civweave.test/app/realm-console-v140.html?system=cerbanimo'},
    MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>0,queueMicrotask,setTimeout,clearTimeout,
    addEventListener:(name,callback)=>listeners.set(name,[...(listeners.get(name)||[]),callback]),
    dispatchEvent:event=>{for(const callback of listeners.get(event.type)||[])callback(event);return true},
    CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail}},
    CivweaveFamilyAILoaderV105:{ensure:async()=>true},
    CivweaveModelRuntime:{readSharedConfig:()=>({provider:'ollama',model:'qa-fixture'}),generate:async()=>({status:'success',actual:{provider:'ollama',model:'qa-fixture'},requestId:'qa-fixture-review',outputJson:{decision:'pass',confidence:.99,summary:'Fixture evidence accepted.',criteria:[{criterion:'Cumulative QA text',pass:true,reason:'Fixture comparison'}],concerns:[],repairInstructions:[],unmetCriteria:[]}})}
  });
  for(const file of ['app/cerbanimo-quest-engine-v144.js','app/cerbanimo-quest-path-v266.js','app/cerbanimo-ai-validator-v159.js','extensions/civweave-proof-progress-v158.js'])vm.runInContext(read(file),context,{filename:file});
  context.dispatchEvent(new context.CustomEvent('DOMContentLoaded'));
  const engine=context.CivweaveCerbanimoQuestV144,validator=context.CerbanimoAIValidatorV159;
  const result=context.CivweaveCerbanimoQuestPathV266.materialize();assert.equal(result.ok,true);
  return{context,engine,validator,quest:result.quest,path,plan,storage,writes,read:key=>JSON.parse(storage.get(key))};
}
async function acceptTask(app,index){
  const task=app.quest.tasks[index];
  assert.equal(app.engine.applyTaskTransition(app.quest.id,task.id,'in-progress').ok,true);
  assert.equal(app.engine.addProof(app.quest.id,task.id,{kind:'test',value:['alpha','alpha beta','alpha beta gamma'][index]}).ok,true);
  assert.equal(app.engine.applyTaskTransition(app.quest.id,task.id,'review').ok,true);
  await app.validator.validateTask(app.quest.id,task.id);
}

test('the canonical shared loader loads the existing proof owner for both campus and parent shell',()=>{
  for(const pathname of ['/app/working-campus-v440.html','/app/persistent-system-shell-v1.html']){
    const scripts=[],head={isConnected:true,append:script=>scripts.push(script)};
    const context=vm.createContext({URL,console,location:{href:`https://civweave.test${pathname}`,pathname},document:{documentElement:{isConnected:true,dataset:{}},head,scripts,styleSheets:[],createElement:()=>({dataset:{}})},addEventListener(){},queueMicrotask,setTimeout});
    vm.runInContext(read('app/shared-guide-surface-v236.js'),context);
    const proof=scripts.filter(script=>new URL(script.src||'/',context.location.href).pathname==='/extensions/civweave-proof-progress-v158.js');
    assert.equal(proof.length,1,`${pathname} must load the existing proof owner independently of compatibility additions.`);
  }
});

test('native task and final AI acceptance propagate once, and reopening revokes all three projections',async()=>{
  const app=fixture();
  for(let index=0;index<app.quest.tasks.length;index++)await acceptTask(app,index);
  let campus=app.read(keys.campus);
  assert.deepEqual(campus.plan.paths[0].progress,[0,1,2],'Task review events must update partial path progress in the same document.');
  assert.equal(campus.plan.paths[0].status,'active','All accepted tasks still require final Endeavor review.');
  assert.equal(app.engine.submitQuest(app.quest.id).ok,true);
  await app.validator.validateQuest(app.quest.id);
  campus=app.read(keys.campus);
  assert.equal(campus.wish,'Preserve the original intention');
  assert.equal(campus.plan.paths[0].status,'completed');assert.equal(campus.plan.state,'completed');
  assert.equal(app.read(keys.intentions)[0].done,true);assert.equal(app.read(keys.inbox)[0].status,'completed');
  const written=app.writes.length;app.context.CivweaveProofProgressV158.syncProgress();
  assert.equal(app.writes.length,written,'A settled proof projection must not keep writing state.');
  assert.equal(app.engine.applyTaskTransition(app.quest.id,app.quest.tasks[0].id,'ready').ok,true);
  campus=app.read(keys.campus);
  assert.deepEqual(campus.plan.paths[0].progress,[1,2]);assert.equal(campus.plan.paths[0].status,'active');assert.equal(campus.plan.state,'active');
  assert.equal(campus.plan.paths[0].proofProgress.state,'required');
  assert.equal(app.read(keys.intentions)[0].done,false);assert.equal(app.read(keys.intentions)[0].state,'active');
  assert.equal(app.read(keys.inbox)[0].status,'accepted','A reopened path must revoke the completed handoff projection.');
  await acceptTask(app,0);assert.equal(app.engine.submitQuest(app.quest.id).ok,true);await app.validator.validateQuest(app.quest.id);
  assert.equal(app.read(keys.campus).plan.state,'completed');assert.equal(app.read(keys.inbox)[0].status,'completed');
});

test('manual task acceptance and unrelated lookalike records cannot complete a native Weave path',()=>{
  const app=fixture();
  for(const task of app.quest.tasks){
    app.engine.applyTaskTransition(app.quest.id,task.id,'in-progress');app.engine.addProof(app.quest.id,task.id,{kind:'test',value:'Manual QA proof'});app.engine.applyTaskTransition(app.quest.id,task.id,'review');app.engine.applyTaskTransition(app.quest.id,task.id,'completed','Manual acceptance');
  }
  app.engine.submitQuest(app.quest.id);app.engine.reviewQuest(app.quest.id,'accept','Manual final acceptance');
  app.context.CivweaveProofProgressV158.syncProgress();
  let campus=app.read(keys.campus);assert.deepEqual(campus.plan.paths[0].progress,[]);assert.equal(campus.plan.state,'active');
  const state=app.engine.readState();state.quests[0].sourceActionId='another-weave:another-path';state.quests[0].review={state:'accepted',validator:'ai'};
  for(const task of state.quests[0].tasks)task.review={state:'accepted',validator:'ai'};
  app.engine.writeState(state);app.context.CivweaveProofProgressV158.syncProgress();
  campus=app.read(keys.campus);assert.deepEqual(campus.plan.paths[0].progress,[]);assert.equal(campus.plan.state,'active');
});

test('unrelated completed courses, exchanges, and same-title path records cannot advance the current Quest',()=>{
  const app=fixture(),campus=app.read(keys.campus);
  for(const realm of ['living-school','fellowfare','anarchadia'])campus.plan.paths.push({id:`qa-${realm}`,realm,title:'Same title',steps:['One linked step'],progress:[],status:'active'});
  app.storage.set(keys.campus,JSON.stringify(campus));
  app.storage.set('civweave.living-school.cabinet.v151',JSON.stringify({school:{id:'unrelated-school',modules:[{id:'done-module'}]},progress:{'done-module':{assessmentPassed:true}}}));
  app.storage.set('fellowfare.mvp.state.v3',JSON.stringify({orders:[{id:'unrelated-order',title:'Same title',status:'completed'}]}));
  app.storage.set('civweave.fellowfare.quest-work.v1',JSON.stringify({records:[{id:'wrong-path',weaveId:campus.plan.id,pathId:'some-other-path',title:'Same title',status:'completed',steps:[{index:0,status:'evidence-recorded'}]}]}));
  app.storage.set('civweave.anarchadia.quest-work.v1',JSON.stringify({records:[{id:'wrong-civic-path',weaveId:campus.plan.id,pathId:'some-other-path',title:'Same title',status:'completed',steps:[{index:0,status:'evidence-recorded'}]}]}));
  app.context.CivweaveProofProgressV158.syncProgress();
  for(const path of app.read(keys.campus).plan.paths)assert.deepEqual(path.progress,[],`${path.realm} requires an exact record identity.`);
});

test('existing exact realm linkage continues to admit recorded learning, resource, and civic proof',()=>{
  const app=fixture(),campus=app.read(keys.campus),weaveId=campus.plan.id;
  for(const realm of ['living-school','fellowfare','anarchadia'])campus.plan.paths.push({id:`qa-${realm}`,realm,title:'Linked QA path',steps:['One linked step'],progress:[],status:'active'});
  app.storage.set(keys.campus,JSON.stringify(campus));
  app.storage.set('civweave.living-school.cabinet.v151',JSON.stringify({school:{id:'linked-school',weaveId,pathId:'qa-living-school',modules:[{id:'done-module'}]},progress:{'done-module':{assessmentPassed:true}}}));
  for(const realm of ['fellowfare','anarchadia'])app.storage.set(`civweave.${realm}.quest-work.v1`,JSON.stringify({records:[{id:`linked-${realm}`,weaveId,pathId:`qa-${realm}`,status:'completed',steps:[{index:0,status:'evidence-recorded',evidence:'Recorded QA proof.'}]}]}));
  app.context.CivweaveProofProgressV158.syncProgress();
  for(const path of app.read(keys.campus).plan.paths.filter(path=>path.realm!=='cerbanimo')){assert.deepEqual(path.progress,[0]);assert.equal(path.status,'completed');}
  assert.equal(app.read(keys.campus).plan.state,'active','The incomplete native work path still gates the whole Quest.');
});

test('native path resolution prefers the current selected Quest over an old handoff and respects explicit exact IDs',()=>{
  const app=fixture(),selected=app.read(keys.campus).plan,old={...structuredClone(selected),id:'old-quest',state:'active'};
  app.storage.set('civweave.active-handoff.v1',JSON.stringify({weaveId:old.id,plan:old}));
  const owner=app.context.CivweaveCerbanimoQuestPathV266;
  assert.equal(owner.resolveContext().plan.id,selected.id,'An old active handoff cannot silently replace the selected Quest.');
  app.context.location.search='?weave=missing-quest';assert.equal(owner.resolveContext(),null);
  app.context.location.search=`?weave=${selected.id}&path=missing-path`;assert.equal(owner.resolveContext(),null,'An explicit invalid path cannot fall back to another path.');
  app.context.location.search=`?weave=${selected.id}&path=${selected.paths[0].id}`;assert.equal(owner.resolveContext().path.id,selected.paths[0].id);
  selected.state='abandoned';app.storage.set(keys.campus,JSON.stringify({stage:'active',plan:selected}));app.context.location.search='';assert.equal(owner.resolveContext(),null,'A stopped Quest cannot spawn new native work.');
});
