import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const runtimePath='public/app/civweave-systems-mesh-v251.js';
const interfaceRuntimePath='public/app/core-interface-runtime-v1.js';
const routesPath='public/app/system-routes-v227.js';
const boundaryPath='public/app/install-boundary-v146.js';
const offlinePath='public/app/offline-package-v208.json';
const runtime=fs.readFileSync(runtimePath,'utf8');
const interfaceRuntime=fs.readFileSync(interfaceRuntimePath,'utf8');
const routes=fs.readFileSync(routesPath,'utf8');
const boundary=fs.readFileSync(boundaryPath,'utf8');
const offline=JSON.parse(fs.readFileSync(offlinePath,'utf8'));

for(const forbidden of ['X-Civweave-System-Token','X-Civweave-Admin-Token','x-civweave-system-token','x-civweave-admin-token','127.0.0.1:8787','/system-bridge/','CivweaveCanonicalRewardsV2','appendEntry(','fetch(']){
  assert.equal(runtime.includes(forbidden),false,`browser contract must not contain privileged/network primitive: ${forbidden}`);
}
for(const id of ['civweave','living-school','cerbanimo','fellowfare','anarchadia'])assert.match(runtime,new RegExp(`['\"]${id.replace('-','\\-')}['\"]`));
for(const type of ['civweave.intention.created','living-school.learning.verified','living-school.validation.completed','cerbanimo.labor.completed','cerbanimo.task.available','fellowfare.exchange.completed','fellowfare.resource.available','anarchadia.policy.published','anarchadia.passport.updated'])assert.ok(runtime.includes(type),`missing ${type}`);
assert.match(routes,/civweave:Object\.freeze\(\{id:'civweave'/);
assert.match(interfaceRuntime,/['"]\/app\/civweave-systems-mesh-v251\.js['"]/,'Core interface runtime must assemble the systems mesh.');
assert.match(interfaceRuntime,/const SHARED_BOOT_SCRIPTS=Object\.freeze\(\[/);
assert.match(boundary,/const CORE_INTERFACE_RUNTIME='\/app\/core-interface-runtime-v1\.js'/);
assert.doesNotMatch(boundary,/SYSTEM_EXPERIENCE_SCRIPTS|SYSTEMS_MESH_RUNTIME='\/app\/civweave-systems-mesh-v251\.js'/,'Install boundary must not retain a second systems-mesh loader.');
assert.match(boundary,/systemsMeshRevision:'v251-five-system-non-privileged-event-contract'/);
assert.ok(offline.seeds.includes('/app/civweave-systems-mesh-v251.js'));

const storage=new Map();
const listeners=new Map();
const document={readyState:'complete',documentElement:{dataset:{civweaveSystem:'living-school'},setAttribute(){}},scripts:[]};
class CustomEvent { constructor(type,options={}){this.type=type;this.detail=options.detail} }
const context={
  console,TextEncoder,structuredClone,crypto:webcrypto,CustomEvent,document,
  location:{pathname:'/app/cabinets/living-school/index.html'},
  localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v))},
  addEventListener:(name,fn)=>{const rows=listeners.get(name)||[];rows.push(fn);listeners.set(name,rows)},
  dispatchEvent:event=>{for(const fn of listeners.get(event.type)||[])fn(event);return true},
  queueMicrotask:fn=>fn(),
  BroadcastChannel:undefined,
  URL,
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(runtime,context,{filename:runtimePath});
const api=context.CivweaveSystemsMeshV251;
assert.ok(api);
assert.deepEqual(Array.from(api.systems),['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
assert.equal(api.identifySystem(),'living-school');
assert.equal(api.status().privileged,false);
assert.equal(api.status().signing,false);
assert.equal(api.status().transport,false);
const draft=api.publish('living-school.learning.verified',{learnerSubjectId:'learner-1',skillCode:'carpentry',skillXp:40,acorns:1},{targetSystems:['anarchadia'],subjectId:'learner-1'});
assert.equal(draft.schema,'civweave.system-event-draft/v1');
assert.equal('signature' in draft,false);
assert.equal('issuer' in draft,false);
assert.equal(api.outbox().length,1);
const draftBundle=api.exportOutboxBundle();
assert.equal(draftBundle.schema,'civweave.system-draft-bundle/v1');
assert.equal(draftBundle.sourceSystem,'living-school');
assert.equal(draftBundle.drafts.length,1);
assert.equal('signature' in draftBundle.drafts[0],false);
assert.throws(()=>api.publish('cerbanimo.labor.completed',{taskId:'t1'}),/belongs to cerbanimo|cannot publish as cerbanimo/i);

context.location.pathname='/app/anarchadia-console-v139.html';
document.documentElement.dataset.civweaveSystem='anarchadia';
const projection={schema:'civweave.system-projection/v1',projectionId:'proj-1',sourceEventId:'evt-1',sourceSystem:'living-school',targetSystem:'anarchadia',projectionType:'passport.skill_xp_candidate',policy:'passport-ledger-must-accept',status:'candidate',createdAt:new Date().toISOString(),payload:{skillCode:'carpentry',skillXp:40}};
const imported=api.importProjectionBundle({schema:'civweave.system-projection-bundle/v1',targetSystem:'anarchadia',projections:[projection]});
assert.equal(imported.added,1);
assert.equal(api.importProjectionBundle({schema:'civweave.system-projection-bundle/v1',targetSystem:'anarchadia',projections:[projection]}).duplicates,1);
const decision=api.decideProjection('proj-1','deferred',{reason:'awaiting canonical passport validator'});
assert.equal(decision.decision,'deferred');
assert.equal(api.projectionInbox('anarchadia').length,0);
assert.equal(api.decisions().length,1);

console.log('Civweave Systems Mesh v251 verification: PASS');
