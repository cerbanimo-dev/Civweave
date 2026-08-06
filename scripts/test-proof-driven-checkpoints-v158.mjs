import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=file=>readFile(path.join(root,file),'utf8');
const [source,boundary,legacyWorker,wrapper,core,offline,workingCampus,manifestText,css]=await Promise.all([
  read('public/extensions/commonweave-proof-progress-v158.js'),read('public/app/install-boundary-v146.js'),read('public/service-worker-v156.js'),read('public/service-worker-v203.js'),read('public/service-worker-core-v208.js'),read('public/service-worker-offline-v211-override.js'),read('public/app/working-campus-v156.html'),read('public/app/offline-package-v208.json'),read('public/extensions/commonweave-additions-v156.css')
]);
const offlineManifest=JSON.parse(manifestText),assert=(condition,message)=>{if(!condition)throw new Error(message)};
for(const token of ['input.disabled=true','stopImmediatePropagation','MutationObserver',"dataset.proofDriven='true'",'commonweave.working-campus.v1','commonweave.living-school.cabinet.v151','cerbanimo.quest-engine.v144','fellowfare.mvp.state.v3','assessmentPassed','proofItems(task)','fulfilled','syncProgress'])assert(source.includes(token),`Proof progress runtime is missing ${token}`);
assert(boundary.includes('/extensions/commonweave-proof-progress-v158.js'),'Install boundary does not load proof progress.');
const lightweightMode=legacyWorker.includes('legacy-v156-bridge-v209');
if(lightweightMode){
  assert(legacyWorker.includes("importScripts('/service-worker-v203.js?v=1.0.6-lightweight-shell-v208-legacy-v156-bridge-v209')"),'Legacy registrations do not reach the active worker wrapper.');
  assert(wrapper.includes("importScripts('/service-worker-living-school-cleanroom-v218.js")&&wrapper.includes("importScripts('/service-worker-core-v208.js")&&wrapper.includes("importScripts('/service-worker-offline-v211-override.js"),'Active worker wrapper is incomplete.');
  assert(core.includes("const BUILD = 'lightweight-shell-v208'"),'Retained worker core is not the lightweight shell.');
  assert(core.includes('discoverReferences')&&core.includes('DOWNLOAD_OFFLINE_PACKAGE'),'Retained offline campus core lost discovery or hydration.');
  assert(offline.includes("const V211_REVISION = 'offline-campus-seed-provenance-v211'"),'Offline retry provenance override is missing.');
  assert(offlineManifest.revision==='resumable-discovered-campus-v208','Resumable campus manifest revision changed unexpectedly.');
  assert(offlineManifest.seeds.includes('/app/working-campus-v156.html'),'Offline campus no longer seeds the working campus.');
  assert(offlineManifest.includePrefixes.includes('/extensions/'),'Offline campus excludes extension runtimes.');
  assert(workingCampus.includes('/app/install-boundary-v146.js'),'Working campus no longer loads proof progress through the install boundary.');
}else assert(legacyWorker.includes('/extensions/commonweave-proof-progress-v158.js'),'Offline extension package does not contain proof progress.');
assert(css.includes('.step[data-proof-state]')&&css.includes('pointer-events:none'),'Read-only checkpoint styling is missing.');

class MemoryStorage{constructor(){this.data=new Map()}getItem(key){return this.data.has(key)?this.data.get(key):null}setItem(key,value){this.data.set(String(key),String(value))}removeItem(key){this.data.delete(String(key))}}
const localStorage=new MemoryStorage(),plan={id:'weave-proof-test',state:'active',updatedAt:'2026-08-04T00:00:00.000Z',paths:[{id:'learn',realm:'living-school',title:'Learning path',steps:['a','b','c','d'],progress:[0,1],status:'active'},{id:'build',realm:'cerbanimo',title:'Build path',steps:['a','b','c','d'],progress:[0,1,2],status:'active'},{id:'materials',realm:'fellowfare',title:'Materials path',steps:['a','b','c'],progress:[0],status:'active'}]};
localStorage.setItem('commonweave.working-campus.v1',JSON.stringify({stage:'active',plan}));
localStorage.setItem('commonweave.intentions.v127',JSON.stringify([{id:plan.id,plan:structuredClone(plan),state:'active',done:false}]));
localStorage.setItem('commonweave.realm-inbox.v1',JSON.stringify(plan.paths.map(item=>({target:item.realm,status:'accepted',payload:{weaveId:plan.id,path:structuredClone(item)}}))));
localStorage.setItem('commonweave.living-school.cabinet.v151',JSON.stringify({school:{id:'school-1',weaveId:plan.id,modules:[{id:'m1'},{id:'m2'}]},progress:{m1:{assessmentPassed:true},m2:{assessmentPassed:false}}}));
localStorage.setItem('cerbanimo.quest-engine.v144',JSON.stringify({quests:[{id:'q1',weaveId:plan.id,title:'Build path',tasks:[{id:'t1',status:'completed',proofs:[{kind:'image'}]},{id:'t2',status:'active',proofs:[]}]}]}));
localStorage.setItem('fellowfare.mvp.state.v3',JSON.stringify({requests:[{id:'r1',weaveId:plan.id,title:'Materials path',status:'open'}]}));
const listeners=new Map(),document={readyState:'loading',addEventListener:(type,handler)=>listeners.set(type,handler),querySelector:()=>null,querySelectorAll:()=>[],hidden:false};
class MutationObserver{constructor(callback){this.callback=callback}observe(){}disconnect(){}}class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const sandbox={console,localStorage,document,MutationObserver,CustomEvent,structuredClone,Set,Map,Date,JSON,String,Number,Boolean,Array,Object,Math,addEventListener(){},dispatchEvent(){return true},globalThis:null};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:'commonweave-proof-progress-v158.js'});
const api=sandbox.CommonweaveProofProgressV158;assert(api,'Proof progress API was not exposed.');api.syncProgress();
let campus=JSON.parse(localStorage.getItem('commonweave.working-campus.v1'));
for(const item of campus.plan.paths){assert(item.progress.length===0,`${item.realm} retained user-toggled progress without proof.`);assert(item.status==='active',`${item.realm} completed before accepted proof.`)}assert(campus.plan.state==='active','Plan completed without accepted proof.');
localStorage.setItem('commonweave.living-school.cabinet.v151',JSON.stringify({school:{id:'school-1',weaveId:plan.id,modules:[{id:'m1'},{id:'m2'}]},progress:{m1:{assessmentPassed:true},m2:{assessmentPassed:true}}}));
localStorage.setItem('cerbanimo.quest-engine.v144',JSON.stringify({quests:[{id:'q1',weaveId:plan.id,title:'Build path',tasks:[{id:'t1',status:'completed',proofs:[{kind:'image'}]},{id:'t2',status:'completed',review:{state:'accepted',decision:'pass'}}]}]}));
localStorage.setItem('fellowfare.mvp.state.v3',JSON.stringify({requests:[{id:'r1',weaveId:plan.id,title:'Materials path',status:'fulfilled'}]}));api.syncProgress();campus=JSON.parse(localStorage.getItem('commonweave.working-campus.v1'));
for(const item of campus.plan.paths){assert(item.status==='completed',`${item.realm} did not complete from accepted proof.`);assert(item.progress.length===item.steps.length,`${item.realm} did not clear all checkpoints.`);assert(item.proofProgress?.state==='accepted',`${item.realm} lacks accepted proof provenance.`)}
assert(campus.plan.state==='completed','Weave did not complete after all accepted proof.');assert(JSON.parse(localStorage.getItem('commonweave.intentions.v127'))[0].done===true,'Canonical intention was not completed.');assert(JSON.parse(localStorage.getItem('commonweave.realm-inbox.v1')).every(row=>row.status==='completed'),'Realm handoffs were not completed.');
console.log(JSON.stringify({ok:true,manualToggle:'blocked-and-scrubbed',completionAuthority:'accepted-realm-proof',realms:['living-school','cerbanimo','fellowfare'],planState:campus.plan.state,offlinePackageMode:lightweightMode?'v218-wrapper-resumable-campus':'layered-extension-package-v158'},null,2));
