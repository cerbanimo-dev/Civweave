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

const quest={id:'quest-1',title:'Build a garden',objective:'Grow tomatoes',status:'active',tasks:[{status:'ready'},{status:'ready'}]};
assert.equal(api.syncQuest(quest).currentBeatId,'muster');
quest.tasks[0].status='in-progress';
assert.equal(api.syncQuest(quest).currentBeatId,'threshold');
quest.tasks[0].status='revision';
let row=api.syncQuest(quest);
assert.equal(row.currentBeatId,'reforging');
assert(row.history.some(item=>item.beatId==='snare'&&item.outcome==='SETBACK'),'Revision must create a Snare setback.');
quest.tasks[0].status='in-progress';
row=api.syncQuest(quest);
assert.equal(row.currentBeatId,'threshold','Reforging must return to the interrupted work Beat.');
quest.tasks[0].status='completed';
assert.equal(api.syncQuest(quest).currentBeatId,'first-trial');
quest.status='review';
assert.equal(api.syncQuest(quest).currentBeatId,'reckoning');
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

const ludContext={...context,CivweaveLudModeV1:{isEnabled:()=>true}};
assert.match(api.versePrompt({publicQuestName:'Garden',beatId:'snare',outcome:'SETBACK'}),/exactly four short lines/i);
assert.equal(api.deterministicBeatText('snare','SETBACK'),'The Snare — Setback');

console.log('Quest Arc Chronicle progression, four-line fallback, and sealed-receipt privacy checks passed.');
