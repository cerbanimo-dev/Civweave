import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL(`../public/${file}`,import.meta.url),'utf8');
const keys={intentions:'civweave.intentions.v127',campus:'civweave.working-campus.v1',inbox:'civweave.realm-inbox.v1',native:'cerbanimo.quest-engine.v144'};
const plan=(id,lineId,state='review')=>({schema:'civweave.intention-weave.v1',id,title:'The same useful outcome',wish:'Create a useful local checklist',state,createdAt:'2026-10-28T00:00:00Z',updatedAt:'2026-10-28T00:00:00Z',authoring:{aiGenerated:true,mode:'model-structured-json',provider:'ollama',model:'qwen3.5:4b'},...(lineId?{collective:{id:'starling',lineId,scope:'guild:fixture'}}:{}),paths:[{id:`path-${id}`,realm:'cerbanimo',steps:['Write the checklist'],progress:[],status:'ready'}]});
function fixture(){
  const storage=new Map(),events=[];
  const context=vm.createContext({console,structuredClone,Date,Math,JSON,Object,Array,String,Number,Boolean,Set,Map,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
    document:{readyState:'loading',hidden:false,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},
    MutationObserver:class{observe(){}disconnect(){}},addEventListener(){},dispatchEvent:event=>{events.push(event);return true},CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail}}
  });
  vm.runInContext(read('app/intention-planner-v141.js'),context);
  vm.runInContext(read('extensions/civweave-proof-progress-v158.js'),context);
  return{context,storage,events,planner:context.CivweaveIntentionPlanner,proof:context.CivweaveProofProgressV158,save:(key,value)=>storage.set(key,JSON.stringify(value)),read:key=>JSON.parse(storage.get(key)||'null')};
}
function acceptNative(app,current){app.save(keys.native,{quests:[{id:`endeavor-${current.id}`,sourceActionId:`${current.id}:${current.paths[0].id}`,status:'completed',review:{state:'accepted',validator:'ai'},tasks:[{id:'task-1',status:'completed',proofs:[{value:'Fixture inspectable checklist'}],review:{state:'accepted',validator:'ai'}}]}]})}

test('independent Starling lines and personal Quests never collapse merely because their title and wish match',()=>{
  const app=fixture();app.planner.persist(plan('quest-a','line-a'));app.planner.persist(plan('quest-b','line-b'));app.planner.persist(plan('quest-personal'));
  assert.deepEqual(app.read(keys.intentions).map(row=>row.id),['quest-personal','quest-b','quest-a']);
  assert.equal(app.read(keys.intentions).find(row=>row.id==='quest-a').plan.collective.lineId,'line-a');
});

for(const state of ['active','completed','abandoned'])test(`re-saving an occupied Starling line retains its ${state} Quest and native path identities`,()=>{
  const app=fixture(),current=plan('quest-a','line-a',state);current.paths[0].progress=[0];current.paths[0].status='completed';
  app.save(keys.intentions,[{id:current.id,kind:'weave-plan',state,done:state==='completed',plan:current}]);
  const before=app.storage.get(keys.intentions),saved=app.planner.persist(plan('replacement-model-id','line-a'));
  assert.equal(saved.id,'quest-a');assert.equal(saved.plan.state,state);assert.equal(saved.plan.paths[0].id,'path-quest-a');assert.equal(app.storage.get(keys.intentions),before);
});

test('a review revision reuses its Starling line Quest ID and cannot claim a different line by reusing a Quest ID',()=>{
  const app=fixture();app.planner.persist(plan('quest-a','line-a'));
  const revised=plan('new-model-id','line-a');revised.outcome='A more precise checklist';const saved=app.planner.persist(revised);
  assert.equal(saved.id,'quest-a');assert.equal(saved.plan.outcome,revised.outcome);assert.equal(app.read(keys.intentions).length,1);
  assert.throws(()=>app.planner.persist(plan('quest-a','line-b')),error=>error.code==='QUEST_COLLECTIVE_LINE_CONFLICT');
  assert.throws(()=>app.planner.persist(plan('quest-a')),error=>error.code==='QUEST_COLLECTIVE_LINE_CONFLICT');
});

test('restore also retains a previously imported Starling line instead of duplicating it under a new model ID',()=>{
  const app=fixture();app.planner.persist(plan('quest-a','line-a'));
  assert.equal(app.planner.restore(plan('new-model-id','line-a')).id,'quest-a');assert.equal(app.read(keys.intentions).length,1);
});

test('explicit exact-line abandonment stops only its saved Quest and selected projections while retaining native evidence',()=>{
  const app=fixture(),current=plan('quest-a','line-a','active');app.save(keys.intentions,[{id:current.id,kind:'weave-plan',state:'active',plan:current}]);app.save(keys.campus,{stage:'active',wish:'Keep the selected intention',plan:current});app.save(keys.inbox,[{status:'accepted',payload:{weaveId:current.id,path:current.paths[0]}}]);app.save(keys.native,{quests:[{sourceActionId:`${current.id}:${current.paths[0].id}`,status:'active',tasks:[{status:'in-progress',proofs:[{value:'Keep this partial evidence'}]}]}]});
  const nativeBefore=app.storage.get(keys.native);assert.equal(app.planner.abandon(current.id,{collectiveLineId:'other-line'}).ok,false);assert.equal(app.planner.abandon(current.id,{}).ok,false);
  const result=app.planner.abandon(current.id,{collectiveLineId:'line-a',reason:'A human selected a more useful direction.'});assert.equal(result.ok,true);assert.equal(app.read(keys.intentions)[0].state,'abandoned');assert.equal(app.read(keys.intentions)[0].done,false);assert.equal(app.read(keys.campus).plan.state,'abandoned');assert.equal(app.read(keys.inbox)[0].status,'abandoned');assert.equal(app.storage.get(keys.native),nativeBefore);assert.equal(app.proof.planCompletion(current.id).complete,false);app.proof.syncProgress();assert.equal(app.read(keys.campus).plan.state,'abandoned');
  assert.equal(app.planner.abandon(current.id,{collectiveLineId:'line-a'}).unchanged,true);
});

test('abandonment cannot rewrite completed work, including current accepted proof not yet projected as completed',()=>{
  const app=fixture(),current=plan('quest-a','line-a','completed');app.save(keys.intentions,[{id:current.id,kind:'weave-plan',state:'completed',plan:current}]);assert.equal(app.planner.abandon(current.id,{collectiveLineId:'line-a'}).ok,false);
  current.state='active';app.save(keys.intentions,[{id:current.id,kind:'weave-plan',state:'active',plan:current}]);acceptNative(app,current);assert.equal(app.planner.abandon(current.id,{collectiveLineId:'line-a'}).ok,false);assert.equal(app.read(keys.intentions)[0].state,'active');
});

test('proof observation corroborates an unselected saved Quest by exact native evidence and does not write or believe claimed completion',()=>{
  const app=fixture(),current=plan('quest-a','line-a','active'),other=plan('quest-b','line-b','active');
  app.save(keys.intentions,[{id:current.id,kind:'weave-plan',state:'active',plan:current},{id:other.id,kind:'weave-plan',state:'active',plan:other}]);app.save(keys.campus,{stage:'active',plan:other});
  acceptNative(app,current);const before=[...app.storage];const proof=app.proof.planCompletion(current.id);
  assert.equal(proof.complete,true);assert.equal(proof.planId,current.id);assert.equal(proof.paths[0].pathId,current.paths[0].id);assert.equal(proof.paths[0].source,'cerbanimo');assert.deepEqual([...app.storage],before);
  const native=app.read(keys.native);native.quests[0].sourceActionId=`wrong:${current.paths[0].id}`;app.save(keys.native,native);current.state='completed';app.save(keys.intentions,[{id:current.id,kind:'weave-plan',state:'completed',plan:current}]);
  assert.equal(app.proof.planCompletion(current.id).complete,false,'A stored completion flag without current exact proof is not corroboration.');assert.equal(app.proof.planCompletion('missing').complete,false);
});

test('existing proof events project all stored Quests while preserving the selected campus and stable settled storage',()=>{
  const app=fixture(),current=plan('quest-a','line-a','active'),other=plan('quest-b','line-b','active');
  app.save(keys.intentions,[{id:current.id,kind:'weave-plan',state:'active',plan:current},{id:other.id,kind:'weave-plan',state:'active',plan:other}]);app.save(keys.campus,{stage:'active',wish:'Keep my selected intention',plan:other});
  app.save(keys.inbox,[{status:'accepted',payload:{weaveId:current.id,path:current.paths[0]}}]);acceptNative(app,current);app.proof.syncProgress();
  const saved=app.read(keys.intentions).find(row=>row.id===current.id);assert.equal(saved.state,'completed');assert.equal(saved.done,true);assert.equal(app.read(keys.inbox)[0].status,'completed');assert.equal(app.read(keys.campus).plan.id,other.id);assert.equal(app.read(keys.campus).wish,'Keep my selected intention');
  const before=[...app.storage];app.proof.syncProgress();assert.deepEqual([...app.storage],before);assert.equal(app.events.some(event=>event.type==='civweave:proof-progress-synced'&&event.detail.planId===current.id),true);
});

for(const state of ['review','abandoned'])test(`${state} Starling Quests cannot report completion even when native proof exists`,()=>{
  const app=fixture(),current=plan('quest-a','line-a',state);app.save(keys.intentions,[{id:current.id,kind:'weave-plan',state,plan:current}]);app.save(keys.campus,{stage:state==='review'?'review':'active',plan:current});acceptNative(app,current);
  assert.equal(app.proof.planCompletion(current.id).complete,false);app.proof.syncProgress();assert.equal(app.read(keys.campus).plan.state,state);assert.equal(app.read(keys.intentions)[0].state,state);assert.equal(app.proof.planCompletion(current.id).complete,false);
});

test('a verified embedded content route delegates to its owning persistent shell instead of navigating into another shell',()=>{
  const calls=[],assigned=[],context=vm.createContext({console,URL,URLSearchParams,location:{origin:'https://civweave.test',href:'https://civweave.test/app/working-campus-v440.html?embed=1&persistentShell=1',search:'?embed=1&persistentShell=1',assign:url=>assigned.push(url)},sessionStorage:{setItem(){}},localStorage:{setItem(){}}});
  context.parent={location:{origin:'https://civweave.test'},document:{getElementById:()=>({contentWindow:context})},CivweavePersistentSystemShellV1:{navigate:(system,options)=>{calls.push({system,options});return true},shellUrl:()=>new URL('https://civweave.test/app/persistent-system-shell-v1.html?system=cerbanimo')}};
  // VM globals are contextified; the frame must identify the executing window.
  context.parent.document.getElementById=()=>({contentWindow:vm.runInContext('globalThis',context)});
  vm.runInContext(read('app/system-routes-v227.js'),context);context.CivweaveSystemRoutesV227.navigate('cerbanimo',{weave:'quest-a',path:'path-quest-a',source:'qa-next-rail'});
  assert.equal(calls.length,1);assert.equal(calls[0].system,'cerbanimo');assert.equal(calls[0].options.weave,'quest-a');assert.equal(calls[0].options.path,'path-quest-a');assert.deepEqual(assigned,[]);
  context.parent.document.getElementById=()=>({contentWindow:{}});context.CivweaveSystemRoutesV227.navigate('cerbanimo',{weave:'quest-a'});assert.equal(calls.length,1,'Unowned frames cannot control the shell.');assert.equal(assigned.length,1);
});
