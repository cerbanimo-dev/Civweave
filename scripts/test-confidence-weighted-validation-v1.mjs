import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const confidenceSource=fs.readFileSync(resolve(repoRoot,'public/app/shared/civweave-validation-confidence-v1.js'),'utf8');
function confidenceRuntime(){const context={console,Math,Number,String,Array,Set,Map,Object,globalThis:null};context.globalThis=context;vm.createContext(context);vm.runInContext(confidenceSource,context);return context.CivweaveValidationConfidenceV1}
const api=confidenceRuntime();
const aggregate=(rows,options={contributorDeviceId:'device-local'})=>api.aggregate(rows,options);

const artifact={id:'artifact',family:'artifact-inspection',verdict:'pass',confidence:.94,score:1,threshold:.6,validatorId:'artifact-check',deviceId:'device-local'};
const localModel={id:'local',family:'model-rubric',verdict:'pass',confidence:.92,score:.9,threshold:.7,validatorId:'gemini-local',deviceId:'device-local'};
const peer={id:'peer',family:'peer-model',verdict:'pass',confidence:.92,score:.93,threshold:.7,validatorId:'peer-a',deviceId:'device-peer'};
let result=aggregate([artifact,localModel]);
assert.equal(result.verifiedPass,true,'strong diverse local evidence can verify a claim');
assert.equal(result.crossDeviceSatisfied,false,'same-device evidence does not unlock payout');
assert.equal(api.payoutEligibility(result).eligible,false);
result=aggregate([artifact,localModel,peer]);
assert.equal(result.verifiedPass,true);
assert.equal(result.crossDeviceSatisfied,true);
assert.equal(api.payoutEligibility(result).eligible,true,'independent device evidence unlocks payout after verification');

const spam=Array.from({length:8},(_,i)=>({id:`spam-${i}`,family:'semantic-model',verdict:'pass',confidence:.92,score:.9,threshold:.7,validatorId:`model-${i}`,deviceId:'same-device'}));
result=aggregate(spam);
assert.equal(result.verifiedPass,false,'same-family vote spam must not satisfy evidence diversity');
assert.equal(result.diversity.familyCount,1);

result=aggregate([artifact,localModel,{id:'fail',family:'peer-model',verdict:'fail',confidence:.95,score:.1,threshold:.7,validatorId:'peer-b',deviceId:'device-peer'}]);
assert.equal(result.verifiedPass,false,'strong contradictory evidence must reopen uncertainty');

result=aggregate([{id:'near-a',family:'deterministic-rubric',verdict:'pass',confidence:.95,score:.61,threshold:.6,validatorId:'rubric-a',deviceId:'device-local'},{id:'near-b',family:'model-rubric',verdict:'pass',confidence:.95,score:.61,threshold:.6,validatorId:'model-b',deviceId:'device-peer'}]);
assert.equal(result.verifiedPass,false,'barely crossing a rubric threshold should be weak evidence');

const calibrated=aggregate([{id:'det',family:'deterministic-test',verdict:'pass',confidence:.99,score:1,threshold:.5,validatorId:'det',deviceId:'device-local',calibrationWeight:1},{id:'weak-model',family:'model-rubric',verdict:'pass',confidence:.99,score:1,threshold:.6,validatorId:'weak-model',deviceId:'device-peer',calibrationWeight:.25}]);
const uncalibrated=aggregate([{id:'det',family:'deterministic-test',verdict:'pass',confidence:.99,score:1,threshold:.5,validatorId:'det',deviceId:'device-local',calibrationWeight:1},{id:'weak-model',family:'model-rubric',verdict:'pass',confidence:.99,score:1,threshold:.6,validatorId:'weak-model',deviceId:'device-peer',calibrationWeight:1}]);
assert.ok(calibrated.passConfidence<uncalibrated.passConfidence,'source calibration must change evidence weight');

const domainPath=resolve(repoRoot,'public/extensions/civweave-domain-bridge-v156.js');
const rewardPath=resolve(repoRoot,'public/app/shared/civweave-reward-weave.js');
const livingPath=resolve(repoRoot,'public/app/cabinets/living-school/living-school-cleanroom-actions-v218.mjs');
for(const path of [domainPath,rewardPath,livingPath])assert.ok(fs.readFileSync(path,'utf8').includes('confidence-weighted-validation-v1'),`${path} should be transformed`);
const rewardSource=fs.readFileSync(rewardPath,'utf8');
assert.ok(!rewardSource.includes('accepted.length < packet.threshold'),'fixed validation counts must be removed from settlement');
assert.ok(rewardSource.includes('verified-awaiting-cross-device'));
assert.ok(rewardSource.includes('payoutEligible'));
const livingSource=fs.readFileSync(livingPath,'utf8');
assert.ok(livingSource.includes('passed=!unanswered&&validation.verifiedPass'));
assert.ok(livingSource.includes('validationConfidence:validation'));

class Storage{constructor(){this.map=new Map()}getItem(key){return this.map.has(String(key))?this.map.get(String(key)):null}setItem(key,value){this.map.set(String(key),String(value))}removeItem(key){this.map.delete(String(key))}}
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const localStorage=new Storage(),sessionStorage=new Storage(),events=[];
const questState={schema:'cerbanimo.quest-engine.v144',version:1,quests:[{id:'quest-1',title:'Build the proof',skillTags:['javascript'],tasks:[{id:'task-1',title:'Implement the slice',status:'completed',skillTags:['javascript'],updatedAt:'2026-08-09T20:00:00.000Z',review:{state:'accepted',validator:'ai',provider:'gemini',model:'gemini-3.5-flash-lite',requestId:'local-review-1',confidence:.94,score:.95,rubricThreshold:.6,at:'2026-08-09T20:00:00.000Z'}}]}]};
const reviewStore={schema:'cerbanimo.ai-review-store.v156',byTask:{'quest-1:task-1':{questId:'quest-1',taskId:'task-1',state:'accepted',validator:'ai',provider:'gemini',model:'gemini-3.5-flash-lite',requestId:'local-review-1',confidence:.94,score:.95,rubricThreshold:.6,at:'2026-08-09T20:00:00.000Z'}}};
localStorage.setItem('cerbanimo.quest-engine.v144',JSON.stringify(questState));
localStorage.setItem('cerbanimo.ai-reviews.v156',JSON.stringify(reviewStore));
const context={console,Storage,localStorage,sessionStorage,CustomEvent,dispatchEvent:event=>events.push(event),addEventListener:()=>{},document:{hidden:false},setInterval:()=>0,clearInterval:()=>{},queueMicrotask:fn=>fn(),setTimeout,clearTimeout,Date,Math,JSON,structuredClone,CivweaveLocalMeshV146:{deviceId:async()=> 'local-device'}};
context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync(domainPath,'utf8'),context,{filename:'civweave-domain-bridge-v156.js'});
const bridge=context.CivweaveDomainBridgeV156;
let balances=bridge.balances();
assert.equal(balances.buttons,0,'local validation must not pay Buttons');
assert.equal(balances.acorns,1,'local qualified evidence can still award the non-payout progress reward');
assert.equal(balances.xp.javascript,25,'main XP remains available after local qualified evidence');
assert.equal(balances.cotokens,0);
const peerObject={id:'receipt-peer-a',kind:'cerbanimo.validation.receipt.v156',origin:{nodeId:'peer-device-a'},payload:{projectId:'quest-1',taskId:'task-1',validatorId:'peer-device-a',validation:{pass:true,decision:'pass',provider:'gemini',model:'gemini-3.5-flash-lite',requestId:'peer-request-a',confidence:.95,score:.96,rubricThreshold:.6,fallbackUsed:false,evidenceFamily:'peer-model'}}};
const accepted=await bridge.recordPeerReview(peerObject);
assert.equal(accepted.accepted,true);
balances=bridge.balances();
assert.equal(balances.buttons,2,'one sufficiently strong independent device can unlock Button payout once total confidence and diversity are satisfied');
assert.equal(balances.cotokens,1,'bonus payout is gated by weighted verification plus cross-device evidence, not a fixed peer count');
assert.equal(balances.xp.javascript,35,'bonus XP unlocks with the same payout gate');
const replay=await bridge.recordPeerReview({...peerObject,id:'receipt-peer-a-replay'});
assert.equal(replay.accepted,false,'the same validator principal cannot stack confidence by replaying');
const status=bridge.taskValidationStatus(questState.quests[0],questState.quests[0].tasks[0]);
assert.equal(status.verifiedPass,true);
assert.equal(status.crossDeviceSatisfied,true);
assert.equal(status.diversity.satisfied,true);

console.log(JSON.stringify({ok:true,algorithm:{passThreshold:api.POLICY.passThreshold,minEvidenceFamilies:api.POLICY.minEvidenceFamilies},cerbanimo:{buttons:balances.buttons,cotokens:balances.cotokens,xp:balances.xp.javascript},antiSpam:true,nearThresholdWeak:true,calibration:true,crossDeviceGate:true},null,2));
