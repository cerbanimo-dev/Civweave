import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const coreSource=fs.readFileSync(new URL('../public/app/quest-arc-chronicle-v1.js',import.meta.url),'utf8');
const bridgeSource=fs.readFileSync(new URL('../public/app/quest-chronicle-receipts-v1.js',import.meta.url),'utf8');
const store=new Map(),meshObjects=new Map(),generatorCalls=[];
class CustomEventStub{constructor(type,init={}){this.type=type;this.detail=init.detail}}
const context={
  console,Date,Math,JSON,TextEncoder,structuredClone,crypto:webcrypto,CustomEvent:CustomEventStub,
  localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value))},
  dispatchEvent:()=>true,addEventListener:()=>{},queueMicrotask:handler=>handler()
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(coreSource,context,{filename:'quest-arc-chronicle-v1.js'});
const arc=context.CivweaveQuestArcChronicleV1;

const SECRET_NOTE='Private review note: prototype failed on the hidden customer dataset.';
const SECRET_PROOF='private://evidence/customer-dataset-output';
const quest={
  id:'quest-private-1',title:'Repair the bridge',objective:'Restore safe passage before winter',description:'Public Quest context only',status:'active',
  tasks:[
    {id:'task-1',title:'Inspect the span',status:'completed',owner:'Hero',proofs:[{id:'proof-1',value:SECRET_PROOF}],review:{state:'accepted',note:SECRET_NOTE,at:'2026-08-16T12:00:00.000Z'}},
    {id:'task-2',title:'Repair the supports',status:'ready',owner:'',proofs:[],review:{state:'none',note:'',at:''}}
  ]
};
arc.syncQuest(quest);
const engineState={quests:[quest],preferences:{activeQuestId:quest.id},receipts:[{id:'r1',kind:'task-transition',at:new Date().toISOString(),detail:{questId:quest.id,taskId:'task-1',status:'completed',note:SECRET_NOTE}}]};
context.CivweaveCerbanimoQuestV144={
  readState:()=>structuredClone(engineState),
  deriveQuest:()=>({progress:50,completed:1,total:2,blocked:0,nextAction:'Start: Repair the supports'})
};
context.CivweaveLocalMeshV146={
  createObject:async input=>{assert.equal(input.consent,'private');assert.equal(input.publish,false);assert.equal(input.hopLimit,0);const object={...structuredClone(input),schema:'civweave.community-object.v1'};meshObjects.set(object.id,object);return object},
  getObject:async id=>structuredClone(meshObjects.get(id)||null)
};
context.CivweaveQuestVerseGeneratorV1={
  createProjection:async input=>{generatorCalls.push(structuredClone(input));return arc.projectReceipt({...input,verse:'The old road meets its trial\nA measured crossing now stands clear\nThe waymark settles into place\nThe Hero carries onward',mode:'BOTH'})}
};
vm.runInContext(bridgeSource,context,{filename:'quest-chronicle-receipts-v1.js'});
const bridge=context.CivweaveQuestChronicleReceiptsV1;
assert.ok(bridge,'Quest Chronicle receipt bridge must install.');

const created=await bridge.processQuest(quest,engineState);
assert.ok(created.length>=1,'Existing Quest Beat history should backfill public stand-ins.');
assert.equal(generatorCalls.length,1,'Backfill should spend generation only on the newest missing Beat.');
const generatorPayload=JSON.stringify(generatorCalls[0]);
assert.equal(generatorPayload.includes(SECRET_NOTE),false,'Verse generation must not receive private review notes.');
assert.equal(generatorPayload.includes(SECRET_PROOF),false,'Verse generation must not receive proof contents.');
assert.equal(generatorCalls[0].publicQuestName,'Repair the bridge');
assert.equal(generatorCalls[0].publicQuestBrief,'Restore safe passage before winter');
assert.ok(generatorCalls[0].receiptCommitment?.digest,'Verse input should carry only the receipt commitment, not the receipt.');

assert.ok(meshObjects.size>=created.length,'Every Chronicle receipt should have a private local sealed record.');
for(const object of meshObjects.values()){
  assert.equal(object.consent,'private');
  assert.equal(object.publish,false);
  assert.equal(object.hopLimit,0);
}
const privatePayload=JSON.stringify([...meshObjects.values()].map(row=>row.payload));
assert.match(privatePayload,/Private review note/,'Private mesh receipt should retain the protected work summary.');
assert.doesNotMatch(JSON.stringify(bridge.publicChronicle(quest.id)),/Private review note|customer-dataset-output/,'Public Chronicle must contain neither private work summary nor proof contents.');

const newestHistory=arc.questState(quest.id).history.at(-1);
const privateReceipt=await bridge.privateReceipt(newestHistory.id);
assert.ok(privateReceipt,'Authorized local reveal should recover the private receipt.');
assert.equal(privateReceipt.schema,'civweave.sealed-work-receipt.v1');
assert.match(JSON.stringify(privateReceipt),/Private review note/);
assert.equal(privateReceipt.privacy.meshConsent,'private');
assert.equal(privateReceipt.privacy.proofValuesIncluded,false);

await bridge.processQuest(quest,engineState);
assert.equal(generatorCalls.length,1,'Already projected Beats must not regenerate Verses on rerender.');
assert.doesNotMatch(bridgeSource,/proof\.value|task\.proofs\.map/,'Bridge must not copy proof contents into its private summary; canonical proof stays in the Quest engine.');
console.log('Quest Chronicle receipt bridge keeps work summaries private, generates from public metadata only, and avoids duplicate Verse spend.');
