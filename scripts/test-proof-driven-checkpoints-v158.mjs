import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(path.join(root,'public/extensions/commonweave-proof-progress-v158.js'),'utf8');
const boundary=await readFile(path.join(root,'public/app/install-boundary-v146.js'),'utf8');
const worker=await readFile(path.join(root,'public/service-worker-v156.js'),'utf8');
const activeWorker=await readFile(path.join(root,'public/service-worker-v203.js'),'utf8');
const workingCampus=await readFile(path.join(root,'public/app/working-campus-v156.html'),'utf8');
const offlineManifest=JSON.parse(await readFile(path.join(root,'public/app/offline-package-v208.json'),'utf8'));
const css=await readFile(path.join(root,'public/extensions/commonweave-additions-v156.css'),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

for(const token of [
  "input.disabled=true","stopImmediatePropagation","MutationObserver","dataset.proofDriven='true'",
  "commonweave.working-campus.v1","commonweave.living-school.cabinet.v151","cerbanimo.quest-engine.v144",
  "fellowfare.mvp.state.v3","assessmentPassed","proofItems(task)","fulfilled","syncProgress"
])assert(source.includes(token),`Proof progress runtime is missing ${token}`);
assert(boundary.includes('/extensions/commonweave-proof-progress-v158.js'),'Install boundary does not load the proof progress runtime.');

const lightweightMode=worker.includes('legacy-v156-bridge-v209');
if(lightweightMode){
  assert(worker.includes("importScripts('/service-worker-v203.js?v=1.0.6-lightweight-shell-v208-legacy-v156-bridge-v209')"),'Legacy registrations do not reach the active lightweight worker.');
  assert(activeWorker.includes("const BUILD = 'lightweight-shell-v208'"),'The active worker is not the lightweight shell.');
  assert(activeWorker.includes('discoverReferences'),'The offline campus worker no longer discovers dependencies from seed pages.');
  assert(activeWorker.includes('DOWNLOAD_OFFLINE_PACKAGE'),'The offline campus worker no longer exposes resumable hydration.');
  assert(offlineManifest.revision==='resumable-discovered-campus-v208','The resumable campus manifest revision changed unexpectedly.');
  assert(offlineManifest.seeds.includes('/app/working-campus-v156.html'),'The offline campus no longer seeds the working campus.');
  assert(offlineManifest.includePrefixes.includes('/extensions/'),'The offline campus excludes extension runtimes from discovery.');
  assert(workingCampus.includes('/app/install-boundary-v146.js'),'The working campus no longer reaches the install boundary that loads proof progress.');
}else{
  assert(worker.includes('/extensions/commonweave-proof-progress-v158.js')&&worker.includes('working-campus-additions-v158-proof-progress'),'Offline extension package does not contain the proof progress runtime.');
}
assert(css.includes('.step[data-proof-state]')&&css.includes('pointer-events:none'),'Read-only checkpoint styling is missing.');

class MemoryStorage{
  constructor(){this.data=new Map()}
  getItem(key){return this.data.has(key)?this.data.get(key):null}
  setItem(key,value){this.data.set(String(key),String(value))}
  removeItem(key){this.data.delete(String(key))}
}
const localStorage=new MemoryStorage();
const plan={
  id:'weave-proof-test',state:'active',updatedAt:'2026-08-04T00:00:00.000Z',paths:[
    {id:'learn',realm:'living-school',title:'Learning path',steps:['a','b','c','d'],progress:[0,1],status:'active'},
    {id:'build',realm:'cerbanimo',title:'Build path',steps:['a','b','c','d'],progress:[0,1,2],status:'active'},
    {id:'materials',realm:'fellowfare',title:'Materials path',steps:['a','b','c'],progress:[0],status:'active'}
  ]
};
localStorage.setItem('commonweave.working-campus.v1',JSON.stringify({stage:'active',plan}));
localStorage.setItem('commonweave.intentions.v127',JSON.stringify([{id:plan.id,plan:structuredClone(plan),state:'active',done:false}]));
localStorage.setItem('commonweave.realm-inbox.v1',JSON.stringify(plan.paths.map(path=>({target:path.realm,status:'accepted',payload:{weaveId:plan.id,path:structuredClone(path)}}))));
localStorage.setItem('commonweave.living-school.cabinet.v151',JSON.stringify({school:{id:'school-1',weaveId:plan.id,modules:[{id:'m1'},{id:'m2'}]},progress:{m1:{assessmentPassed:true},m2:{assessmentPassed:false}}}));
localStorage.setItem('cerbanimo.quest-engine.v144',JSON.stringify({quests:[{id:'q1',weaveId:plan.id,title:'Build path',tasks:[{id:'t1',status:'completed',proofs:[{kind:'image'}]},{id:'t2',status:'active',proofs:[]}]}]}));
localStorage.setItem('fellowfare.mvp.state.v3',JSON.stringify({requests:[{id:'r1',weaveId:plan.id,title:'Materials path',status:'open'}]}));

const listeners=new Map();
const document={
  readyState:'loading',
  addEventListener(type,handler){listeners.set(type,handler)},
  querySelector(){return null},
  querySelectorAll(){return[]},
  hidden:false
};
class MutationObserver{constructor(callback){this.callback=callback}observe(){}disconnect(){}}
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const sandbox={
  console,localStorage,document,MutationObserver,CustomEvent,structuredClone,Set,Map,Date,JSON,String,Number,Boolean,Array,Object,Math,
  addEventListener(){},dispatchEvent(){return true},globalThis:null
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'commonweave-proof-progress-v158.js'});
const api=sandbox.CommonweaveProofProgressV158;
assert(api,'Proof progress API was not exposed.');

api.syncProgress();
let campus=JSON.parse(localStorage.getItem('commonweave.working-campus.v1'));
for(const pathState of campus.plan.paths){
  assert(pathState.progress.length===0,`${pathState.realm} retained user-toggled progress without accepted proof.`);
  assert(pathState.status==='active',`${pathState.realm} should remain active before proof completion.`);
}
assert(campus.plan.state==='active','Plan completed without accepted proof.');

localStorage.setItem('commonweave.living-school.cabinet.v151',JSON.stringify({school:{id:'school-1',weaveId:plan.id,modules:[{id:'m1'},{id:'m2'}]},progress:{m1:{assessmentPassed:true},m2:{assessmentPassed:true}}}));
localStorage.setItem('cerbanimo.quest-engine.v144',JSON.stringify({quests:[{id:'q1',weaveId:plan.id,title:'Build path',tasks:[{id:'t1',status:'completed',proofs:[{kind:'image'}]},{id:'t2',status:'completed',review:{state:'accepted',decision:'pass'}}]}]}));
localStorage.setItem('fellowfare.mvp.state.v3',JSON.stringify({requests:[{id:'r1',weaveId:plan.id,title:'Materials path',status:'fulfilled'}]}));
api.syncProgress();

campus=JSON.parse(localStorage.getItem('commonweave.working-campus.v1'));
for(const pathState of campus.plan.paths){
  assert(pathState.status==='completed',`${pathState.realm} did not complete from accepted proof.`);
  assert(pathState.progress.length===pathState.steps.length,`${pathState.realm} did not clear every read-only checkpoint.`);
  assert(pathState.proofProgress?.state==='accepted',`${pathState.realm} lacks accepted proof provenance.`);
}
assert(campus.plan.state==='completed','The weave did not complete after every realm supplied accepted proof.');
const intention=JSON.parse(localStorage.getItem('commonweave.intentions.v127'))[0];
assert(intention.done===true&&intention.state==='completed','Canonical intention was not updated.');
const inbox=JSON.parse(localStorage.getItem('commonweave.realm-inbox.v1'));
assert(inbox.every(row=>row.status==='completed'),'Realm handoffs were not updated from proof completion.');

console.log(JSON.stringify({
  ok:true,
  manualToggle:'blocked-and-scrubbed',
  completionAuthority:'accepted-realm-proof',
  realms:['living-school','cerbanimo','fellowfare'],
  planState:campus.plan.state,
  offlinePackageMode:lightweightMode?'resumable-discovered-campus-v208':'layered-extension-package-v158'
},null,2));