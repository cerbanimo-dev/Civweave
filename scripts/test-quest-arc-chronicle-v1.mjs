import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const source=fs.readFileSync(new URL('../public/app/quest-arc-chronicle-v1.js',import.meta.url),'utf8');
const store=new Map();
const listeners=new Map();
class CustomEventStub{constructor(type,init={}){this.type=type;this.detail=init.detail}}
const context={
  console,Date,Math,JSON,TextEncoder,structuredClone,crypto:webcrypto,
  CustomEvent:CustomEventStub,
  localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value))},
  dispatchEvent:()=>true,
  addEventListener:(name,handler)=>listeners.set(name,handler),
  queueMicrotask:handler=>handler()
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'quest-arc-chronicle-v1.js'});
const api=context.CivweaveQuestArcChronicleV1;
assert.ok(api,'Quest Arc Chronicle API must install.');
assert.equal(api.BEATS.length,21,'The default Hero journey must contain 21 Quest Beats.');
assert.equal(api.beat('snare').label,'The Snare');
assert.equal(api.beat('gift').terminal,true);
assert.doesNotMatch(source,/CivweaveModelRuntime|CivweaveFamilyAILoaderV105|runtime\.generate/,'The Lud-packaged Quest Arc core must have no model runtime dependency.');

const quest={id:'quest-1',title:'Build a garden',objective:'Grow tomatoes',status:'active',tasks:[{status:'ready'},{status:'ready'}]};
let row=api.syncQuest(quest);
assert.equal(row.currentBeatId,'muster');
for(const id of ['call','stakes','counsel'])assert(row.history.some(item=>item.beatId===id),`${id} should be captured before The Muster.`);
quest.tasks[0].status='in-progress';
row=api.syncQuest(quest);
assert.equal(row.currentBeatId,'first-trial');
assert(row.history.some(item=>item.beatId==='threshold'),'Starting work must cross The Threshold.');
quest.tasks[0].status='revision';
row=api.syncQuest(quest);
assert.equal(row.currentBeatId,'reforging');
assert(row.history.some(item=>item.beatId==='snare'&&item.outcome==='SETBACK'),'Revision must create a Snare setback.');
quest.tasks[0].status='in-progress';
row=api.syncQuest(quest);
assert.equal(row.currentBeatId,'first-trial','Reforging must return to the interrupted work Beat.');
quest.tasks[0].status='completed';
row=api.syncQuest(quest);
assert.equal(row.currentBeatId,'road-of-trials');
quest.status='review';
row=api.syncQuest(quest);
assert.equal(row.currentBeatId,'reckoning');
for(const id of ['deepening','descent','ordeal','breakthrough','claim','homeward-road'])assert(row.history.some(item=>item.beatId===id),`${id} should be captured in the default arc.`);
quest.status='completed';
assert.equal(api.syncQuest(quest).currentBeatId,'gift');

assert.equal(api.validateVerse('One\nTwo\nThree\nFour').ok,true);
assert.equal(api.validateVerse('One\nTwo\nThree').ok,false);
assert.equal(api.validateVerse('- One\nTwo\nThree\nFour').ok,false);
const verse=await api.generateVerse({publicQuestName:'Garden',publicQuestBrief:'Grow tomatoes',beatId:'first-trial',outcome:'CLEARED'},{generate:async()=> 'Seeds meet the patient earth\nA first small trial is cleared\nThe path now bears a living mark\nThe journey carries onward'});
assert.equal(verse.kind,'VERSE');
assert.equal(verse.lines.length,4);
const fallback=await api.generateVerse({publicQuestName:'Garden',beatId:'first-trial',outcome:'CLEARED'},{generate:async()=> 'not four lines'});
assert.equal(fallback.kind,'BEAT');
assert.equal(fallback.text,'The First Trial — Cleared');
assert.equal(fallback.attempts,2);
const noGenerator=await api.generateVerse({beatId:'snare',outcome:'SETBACK'});
assert.equal(noGenerator.kind,'BEAT');
assert.equal(noGenerator.attempts,0);

const SECRET='private work summary must never enter the public projection';
const receipt={summary:SECRET,proof:['private-proof-ref'],validator:'private-validator'};
const commitment=await api.commitSealedReceipt(receipt,{salt:'00112233445566778899aabbccddeeff'});
assert.equal(commitment.algorithm,'SHA-256');
assert.equal(await api.verifySealedReceipt(receipt,commitment),true);
assert.equal(await api.verifySealedReceipt({...receipt,summary:'tampered'},commitment),false);
const projection=api.projectReceipt({questId:'quest-1',publicQuestName:'Garden',beatId:'first-trial',outcome:'CLEARED',mode:'BOTH',verse:verse.text,receiptCommitment:commitment});
const publicText=JSON.stringify(projection);
assert.equal(publicText.includes(SECRET),false,'Public projection must not contain the sealed work summary.');
assert.equal(publicText.includes('private-proof-ref'),false,'Public projection must not contain evidence refs.');
assert.equal(projection.privacy.sealedReceiptIncluded,false);
assert.equal(projection.privacy.workSummaryIncluded,false);

const VEIL_SECRET='Project Nightjar private prototype for North Ridge Clinic';
context.CivweaveQuestVeilLedgerGateV1={humanChronicle:()=>({entries:[
  {kind:'quest-veil-task',submissionId:'s1',sourceHash:'a'.repeat(64),title:VEIL_SECRET,story:VEIL_SECRET,public:{phase:'verified-pass'},createdAt:'2026-08-16T00:00:00.000Z'},
  {kind:'quest-veil-pending',submissionId:'s2',title:VEIL_SECRET,public:{phase:'pending'}}
]})};
const safe=api.safeVeilReceiptStandIns({questIdsBySubmission:{s1:'quest-1'},publicQuestNames:{'quest-1':'Garden'}});
assert.equal(safe.entries.length,1,'Only final verified Quest Veil entries should become receipt stand-ins.');
assert.equal(JSON.stringify(safe).includes(VEIL_SECRET),false,'Quest Beat receipts must derive from the safe projection without copying its story or title.');
assert.equal(safe.rawReceiptIncluded,false);
assert.equal(safe.entries[0].receiptCommitment.legacyUnsalted,true);
assert.equal(safe.entries[0].receiptCommitment.digest,'a'.repeat(64));
const history=api.historyProjections('quest-1',{limit:50});
assert(history.length>=10,'The automatic Hero arc should leave a visible Chronicle trail.');
assert(history.every(item=>item.privacy.workSummaryIncluded===false));

assert.match(api.versePrompt({publicQuestName:'Garden',beatId:'snare',outcome:'SETBACK'}),/exactly four short lines/i);
assert.equal(api.deterministicBeatText('snare','SETBACK'),'The Snare — Setback');
console.log('Quest Arc Chronicle progression, AI-free core, four-line fallback, and sealed-receipt privacy checks passed.');
