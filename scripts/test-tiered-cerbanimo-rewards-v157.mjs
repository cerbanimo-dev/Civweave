import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=await readFile(new URL('../public/extensions/commonweave-domain-bridge-v156.js',import.meta.url),'utf8');
class Storage{
  constructor(){this.map=new Map()}
  getItem(key){return this.map.has(String(key))?this.map.get(String(key)):null}
  setItem(key,value){this.map.set(String(key),String(value))}
  removeItem(key){this.map.delete(String(key))}
}
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const localStorage=new Storage(),sessionStorage=new Storage(),events=[];
const questState={schema:'cerbanimo.quest-engine.v144',version:1,quests:[{id:'quest-1',title:'Build the proof',skillTags:['javascript'],tasks:[{id:'task-1',title:'Implement the slice',status:'completed',skillTags:['javascript'],updatedAt:'2026-08-04T10:00:00.000Z',review:{state:'accepted',note:'AI validation passed',at:'2026-08-04T10:00:00.000Z'}}]}]};
const reviewStore={schema:'cerbanimo.ai-review-store.v156',byTask:{'quest-1:task-1':{questId:'quest-1',taskId:'task-1',state:'accepted',validator:'ai',provider:'gemini',model:'gemini-3.5-flash-lite',requestId:'local-review-1',confidence:.94,at:'2026-08-04T10:00:00.000Z'}}};
localStorage.setItem('cerbanimo.quest-engine.v144',JSON.stringify(questState));
localStorage.setItem('cerbanimo.ai-reviews.v156',JSON.stringify(reviewStore));
const context={
  console,Storage,localStorage,sessionStorage,CustomEvent,
  dispatchEvent:event=>events.push(event),addEventListener:()=>{},
  document:{hidden:false},setInterval:()=>0,clearInterval:()=>{},
  queueMicrotask:fn=>fn(),setTimeout,clearTimeout,Date,Math,JSON,structuredClone,
  CommonweaveLocalMeshV146:{deviceId:async()=> 'local-device'}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'commonweave-domain-bridge-v156.js'});
const bridge=context.CommonweaveDomainBridgeV156;
assert.ok(bridge,'domain bridge should export its API');
let balances=bridge.balances();
assert.equal(balances.buttons,2,'local independent AI pass should mint two Buttons');
assert.equal(balances.acorns,1,'local independent AI pass should mint one Acorn');
assert.equal(balances.cotokens,0,'local validation must not mint a Cotoken');
assert.equal(balances.xp.javascript,25,'local independent AI pass should mint main skill XP');
const peerObject=(id,validatorId)=>({id,kind:'cerbanimo.validation.receipt.v156',origin:{nodeId:validatorId},payload:{projectId:'quest-1',taskId:'task-1',validatorId,validation:{pass:true,decision:'pass',provider:'gemini',model:'gemini-3.5-flash-lite',requestId:`request-${validatorId}`,confidence:.9,fallbackUsed:false}}});
let result=await bridge.recordPeerReview(peerObject('receipt-1','peer-one'));
assert.equal(result.accepted,true);
balances=bridge.balances();
assert.equal(balances.cotokens,0,'one peer AI pass must not mint a Cotoken');
assert.equal(balances.xp.javascript,25,'one peer AI pass must not mint bonus XP');
result=await bridge.recordPeerReview(peerObject('receipt-1-replay','peer-one'));
assert.equal(result.accepted,false,'the same validator must not count twice');
result=await bridge.recordPeerReview(peerObject('receipt-2','peer-two'));
assert.equal(result.accepted,true);
balances=bridge.balances();
assert.equal(balances.cotokens,1,'two distinct peer AI passes should mint one Cotoken');
assert.equal(balances.xp.javascript,35,'two distinct peer AI passes should add ten bonus XP');
const before=JSON.stringify(bridge.rewardLedger());
await bridge.recordPeerReview(peerObject('receipt-2-replay','peer-two'));
assert.equal(JSON.stringify(bridge.rewardLedger()),before,'replayed peer receipts must not mint again');
assert.equal(bridge.peerReviewStatus('quest-1','task-1').passingCount,2);
console.log(JSON.stringify({ok:true,local:{buttons:2,acorns:1,mainXp:25,cotokens:0},twoDistinctPeers:{cotokens:1,bonusXp:10},idempotent:true},null,2));
