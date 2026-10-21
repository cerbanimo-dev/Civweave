import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const [source,ledgerText]=await Promise.all([
  fs.readFile(new URL('../public/app/realm-console-v140.js',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/app/shared/civweave-parity-ledger.json',import.meta.url),'utf8'),
]);
const STORE='civweave.realm-console.v140';
const questSource=await fs.readFile(new URL('../public/app/cerbanimo-quest-engine-v144.js',import.meta.url),'utf8');
const videoSource=await fs.readFile(new URL('../public/app/cerbanimo-video-task-contract-v1.mjs',import.meta.url),'utf8');

function videoHarness(){
  const storage=new Map();
  let releaseVideo;
  const pendingVideo=new Promise(resolve=>{releaseVideo=resolve});
  const context=vm.createContext({structuredClone,URL,queueMicrotask,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))},
  });
  vm.runInContext(questSource,context);
  const engine=context.CivweaveCerbanimoQuestV144;
  const quest=engine.createQuestFromInput({title:'Video fixture',steps:['Build the fixture'],sequential:false});
  engine.addQuest(quest);
  Object.assign(context,{document:{documentElement:{dataset:{}},querySelector(){return null},querySelectorAll(){return[]},addEventListener(){}},
    addEventListener(){},MutationObserver:class{observe(){}},
    __loadVideoContract:()=>Promise.resolve({resolveRelevantVideo:()=>pendingVideo}),
  });
  vm.runInContext(videoSource.replace('import(CONTRACT)','__loadVideoContract()'),context);
  return{engine,quest,video:context.CerbanimoVideoTaskContractV1,
    release:()=>releaseVideo({url:'https://www.youtube.com/watch?v=abcDEF12345',title:'Fixture companion'})};
}

function populatedQuestHarness(count=1000){
  const context=vm.createContext({structuredClone});
  vm.runInContext(questSource.replace('root.CivweaveCerbanimoQuestV144={','root.CivweaveCerbanimoQuestV144={questWorkspace,'),context);
  const engine=context.CivweaveCerbanimoQuestV144;
  const quest=engine.normalizeQuest({id:'fixture-quest',tasks:Array.from({length:count},(_,index)=>({
    id:`task-${index}`,title:`Work unit ${index}`,status:index===0?'completed':'ready',dependencies:index?[`task-${index-1}`]:[],
  }))});
  let taskScans=0;
  quest.tasks.map=function(...args){taskScans++;return Array.prototype.map.apply(this,args)};
  return{engine,quest,scans:()=>taskScans};
}

async function consoleHarness(){
  const ledger=JSON.parse(ledgerText);
  ledger.index={systems:new Map(ledger.systems.map(row=>[row.id,row])),capabilities:new Map(ledger.capabilities.map(row=>[row.id,row]))};
  const listeners=new Map(),storage=new Map(),app={innerHTML:'',focus(){}},reads=new Map();
  const saved=title=>JSON.stringify({records:{'cerbanimo.manage-quests':[{id:'fixture-quest',data:{title}}]},receipts:[{detail:{notes:'x'.repeat(1000000)}}]});
  storage.set(STORE,saved('Saved fixture quest'));
  const window={};window.self=window;window.top={};
  const context=vm.createContext({URLSearchParams,window,history:{pushState(){},replaceState(){}},location:{search:'?system=cerbanimo&embed=1'},
    document:{documentElement:{dataset:{}},addEventListener(name,listener){listeners.set(name,listener)},querySelector(selector){return selector==='#rc-app'?app:null}},
    addEventListener(){},CivweaveParity:{load:async()=>ledger},
    localStorage:{getItem(key){reads.set(key,(reads.get(key)||0)+1);return storage.get(key)||null},setItem(key,value){storage.set(key,String(value))}},
  });
  vm.runInContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  return{app,reads,storage,saved,click:()=>listeners.get('click')({target:{closest:()=>({dataset:{},hasAttribute:name=>name==='data-home'})}})};
}

test('Cerbanimo first paint reads its saved record store once regardless of capability count',async()=>{
  const harness=await consoleHarness();
  assert.match(harness.app.innerHTML,/Saved fixture quest/);
  assert.equal(harness.reads.get(STORE),1,'render must share one snapshot instead of repeatedly parsing the complete local history');
});

test('a later Cerbanimo render reads a fresh snapshot after local state changes',async()=>{
  const harness=await consoleHarness();
  harness.storage.set(STORE,harness.saved('Updated fixture quest'));
  harness.click();
  assert.match(harness.app.innerHTML,/Updated fixture quest/);
  assert.equal(harness.reads.get(STORE),2,'the render snapshot must never outlive a render or hide later local changes');
});

test('a populated quest computes dependency status without rescanning all tasks for every task',()=>{
  const {engine,quest,scans}=populatedQuestHarness();
  const derived=engine.deriveQuest(quest);
  assert.equal(derived.completed,1);
  assert.equal(derived.available,1);
  assert.equal(derived.blocked,998);
  assert.equal(derived.next.id,'task-1');
  assert.ok(scans()<=1,`dependency derivation must build one shared lookup, observed ${scans()} complete scans`);
});

test('populated quest cards share dependency work and preserve actionable versus blocked states',()=>{
  const {engine,quest,scans}=populatedQuestHarness();
  const markup=engine.questWorkspace({quests:[quest],receipts:[]},quest,'tasks');
  assert.equal((markup.match(/class="cq144-task /g)||[]).length,1000);
  assert.equal((markup.match(/class="cq144-task is-blocked/g)||[]).length,998);
  assert.match(markup,/data-task-id="task-1"[\s\S]*?data-cq-action="start-task" >Start/);
  assert.ok(scans()<=2,`card rendering must share its lookup rather than rebuild it per card, observed ${scans()} complete scans`);
});

test('slow task video lookup preserves progress, proof, and receipts changed while it was pending',async()=>{
  const {engine,quest,video,release}=videoHarness(),taskId=quest.tasks[0].id;
  const hydration=video.ensureTaskVideo(taskId);
  assert.equal(engine.applyTaskTransition(quest.id,taskId,'in-progress').ok,true);
  assert.equal(engine.addProof(quest.id,taskId,{value:'Work completed while video lookup was pending.'}).ok,true);
  release();
  assert.equal(await hydration,true);
  const state=engine.readState(),task=state.quests[0].tasks[0];
  assert.equal(task.status,'proof-ready');
  assert.equal(task.proofs.length,1);
  assert.equal(state.receipts.length,3);
  assert.equal(task.video?.url,'https://www.youtube.com/watch?v=abcDEF12345');
  assert.equal(await video.ensureTaskVideo(taskId),false,'persisted video must not be looked up again on every click');
});

test('slow video lookup does not resurrect a quest removed while it was pending',async()=>{
  const {engine,quest,video,release}=videoHarness();
  const hydration=video.ensureTaskVideo(quest.tasks[0].id);
  const state=engine.readState();state.quests=[];engine.writeState(state);
  release();
  assert.equal(await hydration,false);
  assert.equal(engine.readState().quests.length,0);
});

test('batch task video lookup also preserves intervening task transitions',async()=>{
  const {engine,quest,video,release}=videoHarness();
  const hydration=video.ensureTaskVideos();
  engine.applyTaskTransition(quest.id,quest.tasks[0].id,'in-progress');
  release();
  assert.equal(await hydration,true);
  const state=engine.readState();
  assert.equal(state.quests[0].tasks[0].status,'in-progress');
  assert.equal(state.receipts.length,2);
  assert.equal(state.quests[0].tasks[0].video?.url,'https://www.youtube.com/watch?v=abcDEF12345');
});
