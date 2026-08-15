import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=await readFile(new URL('../public/extensions/civweave-domain-bridge-v156.js',import.meta.url),'utf8');
class Storage{
  constructor(){this.map=new Map()}
  getItem(key){return this.map.has(String(key))?this.map.get(String(key)):null}
  setItem(key,value){this.map.set(String(key),String(value))}
  removeItem(key){this.map.delete(String(key))}
}
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const localStorage=new Storage(),sessionStorage=new Storage(),events=[];
const questState={schema:'cerbanimo.quest-engine.v144',version:1,quests:[{id:'quest-1',title:'Build the proof',skillTags:['javascript'],tasks:[{id:'task-1',title:'Implement the slice',status:'completed',skillTags:['javascript'],updatedAt:'2026-08-09T20:00:00.000Z',review:{state:'accepted',note:'AI validation passed',provider:'gemini',model:'gemini-3.5-flash-lite',requestId:'local-review-1',confidence:.94,score:.95,rubricThreshold:.6,at:'2026-08-09T20:00:00.000Z'}}]}]};
const reviewStore={schema:'cerbanimo.ai-review-store.v156',byTask:{'quest-1:task-1':{questId:'quest-1',taskId:'task-1',state:'accepted',validator:'ai',provider:'gemini',model:'gemini-3.5-flash-lite',requestId:'local-review-1',confidence:.94,score:.95,rubricThreshold:.6,at:'2026-08-09T20:00:00.000Z'}}};
localStorage.setItem('cerbanimo.quest-engine.v144',JSON.stringify(questState));
localStorage.setItem('cerbanimo.ai-reviews.v156',JSON.stringify(reviewStore));
const context={
  console,Storage,localStorage,sessionStorage,CustomEvent,
  dispatchEvent:event=>events.push(event),addEventListener:()=>{},
  document:{hidden:false},setInterval:()=>0,clearInterval:()=>{},
  queueMicrotask:fn=>fn(),setTimeout,clearTimeout,Date,Math,JSON,structuredClone,
  CivweaveLocalMeshV146:{deviceId:async()=> 'local-device'}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'civweave-domain-bridge-v156.js'});
const bridge=context.CivweaveDomainBridgeV156;
assert.ok(bridge,'domain bridge should export its API');
let balances=bridge.balances();
assert.equal(balances.buttons,0,'local validation alone must not mint Buttons');
assert.equal(balances.acorns,1,'qualified local evidence can still mint one Acorn');
assert.equal(balances.cotokens,0,'local validation must not mint a Cotoken');
assert.equal(balances.xp.javascript,25,'qualified local evidence should mint main skill XP');
const peerObject=(id,validatorId)=>({id,kind:'cerbanimo.validation.receipt.v156',origin:{nodeId:validatorId},payload:{projectId:'quest-1',taskId:'task-1',validatorId,validation:{pass:true,decision:'pass',provider:'gemini',model:'gemini-3.5-flash-lite',requestId:`request-${validatorId}`,confidence:.95,score:.96,rubricThreshold:.6,evidenceFamily:'peer-model',fallbackUsed:false}}});
let result=await bridge.recordPeerReview(peerObject('receipt-1','peer-one'));
assert.equal(result.accepted,true);
balances=bridge.balances();
assert.equal(balances.buttons,2,'a sufficiently strong independent device should unlock Button payout after weighted verification');
assert.equal(balances.cotokens,1,'weighted confidence plus cross-device evidence should unlock the bonus without a fixed peer count');
assert.equal(balances.xp.javascript,35,'weighted payout eligibility should add ten bonus XP');
result=await bridge.recordPeerReview(peerObject('receipt-1-replay','peer-one'));
assert.equal(result.accepted,false,'the same validator must not stack confidence twice');
const before=JSON.stringify(bridge.rewardLedger());
await bridge.recordPeerReview(peerObject('receipt-1-replay-2','peer-one'));
assert.equal(JSON.stringify(bridge.rewardLedger()),before,'replayed peer receipts must not mint again');
const validation=bridge.taskValidationStatus(questState.quests[0],questState.quests[0].tasks[0]);
assert.equal(validation.verifiedPass,true);
assert.equal(validation.crossDeviceSatisfied,true);
assert.equal(validation.diversity.satisfied,true);
console.log(JSON.stringify({ok:true,local:{buttons:0,acorns:1,mainXp:25,cotokens:0},weightedCrossDevice:{buttons:2,cotokens:1,bonusXp:10},idempotent:true},null,2));
