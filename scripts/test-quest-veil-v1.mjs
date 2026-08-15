import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const finale=fs.readFileSync(new URL('../public/app/quest-veil-v1.js',import.meta.url),'utf8');
const gate=fs.readFileSync(new URL('../public/app/quest-veil-ledger-gate-v1.js',import.meta.url),'utf8');
const mesh=fs.readFileSync(new URL('../public/app/quest-veil-mesh-v1.js',import.meta.url),'utf8');
const boundary=fs.readFileSync(new URL('../public/app/install-boundary-v146.js',import.meta.url),'utf8');
const coreRuntime=fs.readFileSync(new URL('../public/app/core-interface-runtime-v1.js',import.meta.url),'utf8');

assert.match(gate,/civweave\.chronicle-ledger\.v1\.1/,'Mandatory veil gate must project from the canonical chronicle ledger.');
assert.match(gate,/weaveling-task-veil-writer-v1/,'Mandatory veil gate must identify the dedicated Weaveling task writer prompt.');
assert.match(gate,/contextStripped:true/,'Task Veil State must explicitly mark itself context stripped.');
assert.match(gate,/sourceTextIncluded:false/,'Task Veil State must explicitly exclude source text.');
assert.match(gate,/sourceTitleIncluded:false/,'Task Veil State must explicitly exclude source titles.');
assert.match(gate,/evidenceContentIncluded:false/,'Task Veil State must explicitly exclude evidence content.');
assert.match(gate,/humanChronicle/,'Human ledger access must pass through the mandatory projection.');
assert.match(gate,/quest-veil-pending/,'Unveiled submissions must render only an opaque pending entry to humans.');
assert.match(gate,/queueMesh\(\[\{submissionId:submission\.id,sourceHash:sourceDigest,stateHash:veilDigest,veilState:state\}\]\)/,'Failed local veil generation must queue only hashes plus stripped state to the mesh.');
assert.match(mesh,/rawSourceIncluded:false/,'Mesh veil batches must exclude raw source content.');
assert.match(mesh,/sourceTitlesIncluded:false/,'Mesh veil batches must exclude source titles.');
assert.match(mesh,/evidenceContentIncluded:false/,'Mesh veil batches must exclude evidence content.');
assert.match(mesh,/currencyPolicy:'acorns-and-buttons-only'/,'Quest Veil work must not introduce a separate credit currency.');
const meshIndex=coreRuntime.indexOf("'/app/quest-veil-mesh-v1.js'");
const gateIndex=coreRuntime.indexOf("'/app/quest-veil-ledger-gate-v1.js'");
const finaleIndex=coreRuntime.indexOf("'/app/quest-veil-v1.js'");
assert.ok(meshIndex>=0,'Core interface runtime must assemble the Quest Veil mesh runtime.');
assert.ok(gateIndex>meshIndex,'Mandatory human-ledger veil gate must load after the Quest Veil mesh runtime.');
assert.ok(finaleIndex>gateIndex,'Quest Veil finale renderer must remain downstream of the mandatory gate.');
assert.match(boundary,/const CORE_INTERFACE_RUNTIME='\/app\/core-interface-runtime-v1\.js'/,'Canonical boundary must bootstrap the shared interface runtime.');
assert.doesNotMatch(boundary,/SYSTEM_EXPERIENCE_SCRIPTS|QUEST_VEIL_MESH='\/app\/quest-veil-mesh-v1\.js'/,'Install boundary must not retain a second Quest Veil loader manifest.');
assert.match(finale,/civweave\.chronicle-ledger\.v1\.1/,'Questline finale remains a derived canonical chronicle projection.');

const SECRET_TITLE='Project Nightjar private prototype for North Ridge Clinic';
const SECRET_PROOF='validator receipt says the private Nightjar prototype passed all checks';
const submission={
  id:'submission-private-nightjar',
  source:'cerbanimo',
  kind:'task',
  subjectTitle:SECRET_TITLE,
  contributorName:'Private Person',
  evidenceSummary:SECRET_PROOF,
  evidenceRefs:['receipt-secret-1'],
  evidenceArtifacts:[{name:'Nightjar screenshot',inlineText:SECRET_PROOF,sourceRef:'private://nightjar'}],
  skills:[{name:'Private workflow',rationale:'North Ridge Clinic intake'}],
  attempt:2,
  createdAt:'2026-08-12T00:00:00.000Z'
};
const validation={
  schema:'civweave.validation-ledger.v1.1',
  submissions:[submission],
  packets:[{submissionId:submission.id,status:'open',createdAt:'2026-08-12T00:01:00.000Z'}],
  thresholdReceipts:[]
};
const rawChronicle={
  schema:'civweave.chronicle-ledger.v1.1',
  entries:[{id:'chronicle:raw',submissionId:submission.id,title:SECRET_TITLE,story:SECRET_PROOF,kind:'verification',createdAt:'2026-08-12T00:02:00.000Z'}],
  updatedAt:'2026-08-12T00:02:00.000Z'
};
const store=new Map([
  ['civweave.validation-ledger.v1.1',JSON.stringify(validation)],
  ['civweave.chronicle-ledger.v1.1',JSON.stringify(rawChronicle)],
  ['civweave.working-campus.v1',JSON.stringify({})],
  ['civweave.intentions.v127',JSON.stringify([])]
]);
class CustomEventStub{constructor(type,init={}){this.type=type;this.detail=init.detail}}
const gateContext=vm.createContext({
  console,
  structuredClone:globalThis.structuredClone,
  TextEncoder,
  crypto:globalThis.crypto,
  CustomEvent:CustomEventStub,
  dispatchEvent:()=>true,
  addEventListener:()=>{},
  document:{readyState:'loading'},
  localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)}
});
vm.runInContext(gate,gateContext,{filename:'quest-veil-ledger-gate-v1.js'});
const gateApi=gateContext.CivweaveQuestVeilLedgerGateV1;
assert.ok(gateApi,'Mandatory Quest Veil ledger gate must install a public API.');
const state=gateApi.taskVeilState(submission,validation);
const stateText=JSON.stringify(state);
for(const secret of [SECRET_TITLE,SECRET_PROOF,'Nightjar','North Ridge Clinic','receipt-secret-1','Private Person'])assert.equal(stateText.includes(secret),false,`Task Veil State leaked private context: ${secret}`);
assert.equal(state.privacy.contextStripped,true);
assert.equal(state.privacy.sourceTextIncluded,false);
assert.equal(state.privacy.evidenceContentIncluded,false);
assert.equal(state.journey.stage,'labor','Cerbanimo task veils must classify as labor.');
assert.equal(gateApi.taskVeilState({...submission,id:'learning',source:'living',kind:'lesson'},validation).journey.stage,'learning');
assert.equal(gateApi.taskVeilState({...submission,id:'material',source:'fellowfare',kind:'material-request'},validation).journey.stage,'material');
assert.equal(gateApi.taskVeilState({...submission,id:'exchange',source:'fellowfare',kind:'exchange'},validation).journey.stage,'exchange');
const human=gateApi.humanChronicle();
const humanText=JSON.stringify(human);
for(const secret of [SECRET_TITLE,SECRET_PROOF,'Nightjar','North Ridge Clinic','receipt-secret-1'])assert.equal(humanText.includes(secret),false,`Human chronicle leaked an unveiled submission: ${secret}`);
assert.equal(human.entries[0].kind,'quest-veil-pending','Unveiled human-facing entries must collapse to the opaque pending form.');

const meshContext=vm.createContext({
  console,
  structuredClone:globalThis.structuredClone,
  CustomEvent:CustomEventStub,
  dispatchEvent:()=>true,
  addEventListener:()=>{},
  document:{readyState:'loading'}
});
vm.runInContext(mesh,meshContext,{filename:'quest-veil-mesh-v1.js'});
const meshApi=meshContext.CivweaveQuestVeilMeshV1;
assert.ok(meshApi,'Quest Veil mesh runtime must install a public API.');
for(const [stage,acorns,buttons] of [
  ['learning',1,0],
  ['labor',0,1],
  ['making',0,1],
  ['material',0,1],
  ['materials',0,1],
  ['exchange',0,1]
]){
  const row=meshApi.rewardForStage(stage);
  assert.equal(row.stage,stage);
  assert.equal(row.acorns,acorns,`${stage} veil Acorn payout mismatch.`);
  assert.equal(row.buttons,buttons,`${stage} veil Button payout mismatch.`);
}
const reward=meshApi.rewardSummary([
  {veilState:{journey:{stage:'learning'}}},
  {veilState:{journey:{stage:'labor'}}},
  {veilState:{journey:{stage:'material'}}},
  {veilState:{journey:{stage:'exchange'}}}
]);
assert.equal(reward.acorns,1,'One veiled learning item must pay one Acorn.');
assert.equal(reward.buttons,3,'Veiled labor, material, and exchange items must each pay one Button.');
assert.equal(reward.items,4);
assert.equal(reward.currencyPolicy,'acorns-and-buttons-only');

console.log('Quest Veil mandatory human gate, stripped mesh payload, stage classification, per-item Acorn/Button rewards, and core-interface assembly checks passed.');
