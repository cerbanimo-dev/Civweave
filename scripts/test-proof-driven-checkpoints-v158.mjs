import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const releaseVersion=(await read('VERSION')).trim();
const expectedWorkerImport=`importScripts('/service-worker-v203.js?v=${releaseVersion}-code-coherence-v288-lightweight-shell-v208-legacy-v156-bridge-v209-working-campus-return-v425')`;
const [source,boundary,legacyWorker,wrapper,core,installerState,integrity,offline,workingCampus,manifestText,css]=await Promise.all([
  read('public/extensions/civweave-proof-progress-v158.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/service-worker-v156.js'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-core-v208.js'),
  read('public/service-worker-installer-state-v280.js'),
  read('public/service-worker-shell-integrity-v281.js'),
  read('public/service-worker-offline-v211-override.js'),
  read('public/app/working-campus-v156.html'),
  read('public/app/offline-package-v208.json'),
  read('public/extensions/civweave-additions-v156.css')
]);
const offlineManifest=JSON.parse(manifestText);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
assert(/^\d+\.\d+\.\d+$/.test(releaseVersion),`Invalid canonical VERSION: ${releaseVersion}`);

for(const token of ['input.disabled=true','stopImmediatePropagation','MutationObserver',"dataset.proofDriven='true'",'civweave.working-campus.v1','civweave.living-school.cabinet.v151','cerbanimo.quest-engine.v144','fellowfare.mvp.state.v3','civweave.fellowfare.quest-work.v1','civweave.anarchadia.quest-work.v1','assessmentPassed','proofItems(task)','fulfilled','cerbanimoCompletion','fellowfareCompletion','anarchadiaCompletion','completedIndexes','syncProgress']){
  assert(source.includes(token),`Proof progress runtime is missing ${token}`);
}
assert(boundary.includes('/extensions/civweave-proof-progress-v158.js'),'Install boundary does not load proof progress.');
const lightweightMode=legacyWorker.includes('legacy-v156-bridge-v209');
if(lightweightMode){
  assert(legacyWorker.includes(expectedWorkerImport),`Legacy registrations do not reach the active ${releaseVersion} worker wrapper.`);
  assert(wrapper.includes("importScripts('/service-worker-living-school-cleanroom-v218.js")&&wrapper.includes("importScripts('/service-worker-code-coherence-v288.js")&&wrapper.includes("importScripts('/service-worker-core-v208.js")&&wrapper.includes("importScripts('/service-worker-installer-state-v280.js")&&wrapper.includes("importScripts('/service-worker-shell-integrity-v281.js")&&wrapper.includes("importScripts('/service-worker-offline-v211-override.js"),'Active worker wrapper is incomplete.');
  assert(wrapper.includes('offline-campus-current-graph-v280')&&wrapper.includes('policy=resumable-pause-v280'),'Active worker wrapper does not load the resumable current-graph repair.');
  assert(core.includes("const BUILD = 'lightweight-shell-v208"),'Retained worker core is not in the lightweight-shell-v208 family.');
  assert(core.includes('discoverReferences')&&core.includes('DOWNLOAD_OFFLINE_PACKAGE'),'Retained offline campus core lost discovery or hydration.');
  assert(installerState.includes("'/app/installer-storage-guard-v281.js'"),'Installer state layer no longer pins the storage preflight guard.');
  assert(integrity.includes("crypto.subtle.digest('SHA-256'")&&integrity.includes('lastKnownGoodCache'),'Shell integrity/last-known-good fallback is missing.');
  assert(offline.includes("const V211_REVISION = 'offline-campus-current-graph-v280'")&&offline.includes("const V211_POLICY = 'resumable-pause-v280'")&&offline.includes("const V211_REFERENCE_POLICY = 'current-manifest-only-v282'"),'Current-graph resumable retry and manifest-pruning policy is missing.');
  assert(offline.includes('downloadedAssets')&&offline.includes('pauseSupported: true')&&offline.includes('resumablePerFile: true'),'Per-file resumability contract is missing.');
  assert(String(offlineManifest.revision||'').startsWith('canonical-background-campus-v241-systems-mesh-v251'),'Offline campus manifest left the Systems Mesh canonical background-download contract family.');
  assert(Array.isArray(offlineManifest.seeds)&&offlineManifest.seeds.length>=11,'Offline campus manifest unexpectedly lost canonical seed roots.');
  assert(offlineManifest.seeds.includes('/app/working-campus-v156.html'),'Offline campus no longer seeds the working campus.');
  assert(offlineManifest.seeds.includes('/app/civweave-systems-mesh-v251.js'),'Offline campus no longer seeds the Civweave Systems Mesh runtime.');
  assert(offlineManifest.includePrefixes.includes('/extensions/'),'Offline campus excludes extension runtimes.');
  assert(workingCampus.includes('/app/install-boundary-v146.js'),'Working campus no longer loads proof progress through the install boundary.');
}else{
  assert(legacyWorker.includes('/extensions/civweave-proof-progress-v158.js'),'Offline extension package does not contain proof progress.');
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
  id:'weave-proof-test',
  state:'active',
  updatedAt:'2026-08-04T00:00:00.000Z',
  paths:[
    {id:'learn',realm:'living-school',title:'Learning path',steps:['a','b','c','d'],progress:[0,1],status:'active'},
    {id:'build',realm:'cerbanimo',title:'Build path',steps:['a','b','c','d'],progress:[0,1,2],status:'active'},
    {id:'materials',realm:'fellowfare',title:'Materials path',steps:['a','b','c'],progress:[0],status:'active'},
    {id:'govern',realm:'anarchadia',title:'Garden governance',steps:['Draft charter','Define roles','Record decision process','Create membership agreement'],completionCriteria:'A signed charter and role list are accepted by the initial participant group.',progress:[0,1],status:'active'}
  ]
};
localStorage.setItem('civweave.working-campus.v1',JSON.stringify({stage:'active',plan}));
localStorage.setItem('civweave.intentions.v127',JSON.stringify([{id:plan.id,plan:structuredClone(plan),state:'active',done:false}]));
localStorage.setItem('civweave.realm-inbox.v1',JSON.stringify(plan.paths.map(item=>({target:item.realm,status:'accepted',payload:{weaveId:plan.id,path:structuredClone(item)}}))));
localStorage.setItem('civweave.living-school.cabinet.v151',JSON.stringify({school:{id:'school-1',weaveId:plan.id,modules:[{id:'m1'},{id:'m2'}]},progress:{m1:{assessmentPassed:true},m2:{assessmentPassed:false}}}));
localStorage.setItem('cerbanimo.quest-engine.v144',JSON.stringify({quests:[{id:'q1',sourceActionId:`${plan.id}:build`,title:'Build path',tasks:[{id:'t1',status:'completed',proofs:[{kind:'image'}]},{id:'t2',status:'active',proofs:[]},{id:'t3',status:'ready',proofs:[]},{id:'t4',status:'ready',proofs:[]}]}]}));
localStorage.setItem('fellowfare.mvp.state.v3',JSON.stringify({requests:[]}));
localStorage.setItem('civweave.fellowfare.quest-work.v1',JSON.stringify({schema:'civweave.fellowfare.quest-work-store.v1',records:[{id:'fw1',weaveId:plan.id,pathId:'materials',title:'Materials path',status:'active',steps:[{index:0,status:'evidence-recorded',evidence:'Inventory recorded.'},{index:1,status:'open'},{index:2,status:'open'}]}]}));
localStorage.setItem('civweave.anarchadia.quest-work.v1',JSON.stringify({schema:'civweave.anarchadia.quest-work-store.v1',records:[{id:'aw1',weaveId:plan.id,pathId:'govern',title:'Garden governance',status:'active',humanApprovalRequired:true,humanApprovalComplete:false,steps:[{index:0,status:'evidence-recorded',evidence:'Charter draft exists.'},{index:1,status:'open'},{index:2,status:'open'},{index:3,status:'open'}]}]}));

const listeners=new Map();
const document={
  readyState:'loading',
  addEventListener:(type,handler)=>listeners.set(type,handler),
  querySelector:()=>null,
  querySelectorAll:()=>[],
  hidden:false
};
class MutationObserver{constructor(callback){this.callback=callback}observe(){}disconnect(){}}
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const sandbox={console,localStorage,document,MutationObserver,CustomEvent,structuredClone,Set,Map,Date,JSON,String,Number,Boolean,Array,Object,Math,addEventListener(){},dispatchEvent(){return true},globalThis:null};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'civweave-proof-progress-v158.js'});

const api=sandbox.CivweaveProofProgressV158;
assert(api,'Proof progress API was not exposed.');
api.syncProgress();
let campus=JSON.parse(localStorage.getItem('civweave.working-campus.v1'));
const initial=Object.fromEntries(campus.plan.paths.map(item=>[item.realm,item]));
assert(initial['living-school'].progress.length===0,'Living School retained user-toggled progress without accepted curriculum proof.');
assert(JSON.stringify(initial.cerbanimo.progress)==='[0]','Cerbanimo did not preserve its one proof-backed work unit.');
assert(JSON.stringify(initial.fellowfare.progress)==='[0]','FellowFare did not preserve its one evidence-backed resource checkpoint.');
assert(JSON.stringify(initial.anarchadia.progress)==='[0]','Anarchadia did not preserve its one evidence-backed governance checkpoint.');
for(const item of campus.plan.paths)assert(item.status==='active',`${item.realm} completed before its proof contract was satisfied.`);
assert(campus.plan.state==='active','Plan completed without accepted proof.');

localStorage.setItem('civweave.living-school.cabinet.v151',JSON.stringify({school:{id:'school-1',weaveId:plan.id,modules:[{id:'m1'},{id:'m2'}]},progress:{m1:{assessmentPassed:true},m2:{assessmentPassed:true}}}));
localStorage.setItem('cerbanimo.quest-engine.v144',JSON.stringify({quests:[{id:'q1',sourceActionId:`${plan.id}:build`,title:'Build path',tasks:[0,1,2,3].map(index=>({id:`t${index+1}`,status:'completed',proofs:[{kind:'evidence'}]}))}]}));
localStorage.setItem('civweave.fellowfare.quest-work.v1',JSON.stringify({schema:'civweave.fellowfare.quest-work-store.v1',records:[{id:'fw1',weaveId:plan.id,pathId:'materials',title:'Materials path',status:'completed',steps:[0,1,2].map(index=>({index,status:'evidence-recorded',evidence:`Resource evidence ${index+1}`}))}]}));
localStorage.setItem('civweave.anarchadia.quest-work.v1',JSON.stringify({schema:'civweave.anarchadia.quest-work-store.v1',records:[{id:'aw1',weaveId:plan.id,pathId:'govern',title:'Garden governance',status:'active',humanApprovalRequired:true,humanApprovalComplete:false,steps:[0,1,2,3].map(index=>({index,status:'evidence-recorded',evidence:`Evidence ${index+1}`}))}]}));
api.syncProgress();
campus=JSON.parse(localStorage.getItem('civweave.working-campus.v1'));
const governance=campus.plan.paths.find(path=>path.realm==='anarchadia');
assert(governance.progress.length===governance.steps.length,'Anarchadia did not expose all evidence-backed checkpoints.');
assert(governance.status==='active','Anarchadia completed before explicit participant acceptance.');
assert(governance.proofProgress?.state==='required','Anarchadia acceptance gate was not preserved.');
assert(campus.plan.state==='active','Quest completed while Anarchadia still required human approval.');
for(const item of campus.plan.paths.filter(path=>path.realm!=='anarchadia'))assert(item.status==='completed',`${item.realm} did not complete from accepted proof.`);

localStorage.setItem('civweave.anarchadia.quest-work.v1',JSON.stringify({schema:'civweave.anarchadia.quest-work-store.v1',records:[{id:'aw1',weaveId:plan.id,pathId:'govern',title:'Garden governance',status:'accepted',humanApprovalRequired:true,humanApprovalComplete:true,steps:[0,1,2,3].map(index=>({index,status:'evidence-recorded',evidence:`Evidence ${index+1}`}))}]}));
api.syncProgress();
campus=JSON.parse(localStorage.getItem('civweave.working-campus.v1'));
for(const item of campus.plan.paths){
  assert(item.status==='completed',`${item.realm} did not complete from accepted proof.`);
  assert(item.progress.length===item.steps.length,`${item.realm} did not clear all checkpoints.`);
  assert(item.proofProgress?.state==='accepted',`${item.realm} lacks accepted proof provenance.`);
}
assert(campus.plan.state==='completed','Quest did not complete after all accepted proof.');
assert(JSON.parse(localStorage.getItem('civweave.intentions.v127'))[0].done===true,'Canonical intention was not completed.');
assert(JSON.parse(localStorage.getItem('civweave.realm-inbox.v1')).every(row=>row.status==='completed'),'Realm handoffs were not completed.');
console.log(JSON.stringify({
  ok:true,
  releaseVersion,
  manualToggle:'blocked-and-scrubbed',
  completionAuthority:'accepted-realm-proof',
  realms:['living-school','cerbanimo','fellowfare','anarchadia'],
  partialProgress:['cerbanimo','fellowfare','anarchadia'],
  anarchadia:'human-approval-gated',
  planState:campus.plan.state,
  offlinePackageMode:lightweightMode?'v218-wrapper-v288-code-coherence-v281-integrity-v280-resumable-campus-v251-systems-mesh':'layered-extension-package-v158'
},null,2));