import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CivweaveHumanValidationCapacityAccount, HUMAN_VALIDATION_NEURON_POLICY } from '../cloudflare/node-cloud/src/capacity-human-validation-v1.mjs';

class StorageMock {
  constructor(){this.map=new Map()}
  async get(key){return this.map.get(String(key))}
  async put(key,value){this.map.set(String(key),structuredClone(value));return value}
  async delete(key){this.map.delete(String(key))}
  async list({prefix=''}={}){return new Map([...this.map.entries()].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>[key,structuredClone(value)]))}
}

async function account(){
  const storage=new StorageMock(),state={storage},env={CIVWEAVE_WORKERS_PLAN:'free'},capacity=new CivweaveHumanValidationCapacityAccount(state,env);
  await capacity.registerNode('guild-one');
  for(const userId of ['lud-user-0001','validator-user-0002','validator-user-0003'])await capacity.admitMember({nodeId:'guild-one',userId,seatClass:'community',billingStatus:'free'});
  return{capacity,storage}
}

test('policy is 30 neurons split exactly across two or three validators with no earned-bonus rollover',()=>{
  assert.equal(HUMAN_VALIDATION_NEURON_POLICY.requestNeurons,30);
  assert.deepEqual([...HUMAN_VALIDATION_NEURON_POLICY.allowedValidatorCounts],[2,3]);
  assert.equal(HUMAN_VALIDATION_NEURON_POLICY.earnedBonusRollsOver,false);
  assert.equal(HUMAN_VALIDATION_NEURON_POLICY.earnedBonusExpiry,'daily-reset');
  assert.equal(30/2,15);
  assert.equal(30/3,10);
});

test('900 included daily neurons fund at most 30 Lud human-validation requests and do not become provider usage',async()=>{
  const{capacity}=await account();
  let first;
  for(let index=1;index<=30;index++){
    const result=await capacity.openHumanValidationRequest({nodeId:'guild-one',requesterUserId:'lud-user-0001',requestId:`request-${index}`,packetId:`packet-${index}`,projectId:'project-one',validatorCount:index===1?2:3,operatingMode:'lud'});
    if(index===1)first=result.request;
  }
  assert.equal(first.totalNeurons,30);
  assert.equal(first.perValidatorNeurons,15);
  await assert.rejects(()=>capacity.openHumanValidationRequest({nodeId:'guild-one',requesterUserId:'lud-user-0001',requestId:'request-31',packetId:'packet-31',projectId:'project-one',validatorCount:3,operatingMode:'lud'}),/allowance is exhausted/i);
  const status=await capacity.humanValidationStatus({nodeId:'guild-one',userId:'lud-user-0001'});
  assert.equal(status.source.dailyBudgetNeurons,900);
  assert.equal(status.source.remainingNeurons,0);
  assert.equal(status.source.requestsRemainingAtThirtyNeurons,0);
  assert.ok(Date.parse(status.source.resetsAt)>Date.now());
  const snapshot=await capacity.snapshot('guild-one');
  assert.equal(snapshot.dailyUsedNeurons,0,'human review must not be misreported as Workers AI provider usage');
  const member=await capacity.memberStatus({nodeId:'guild-one',userId:'lud-user-0001'});
  assert.equal(member.quota.includedRemainingNeurons,0,'the 30 requests spend the resident daily included allowance');
});

test('accepted Standard validators claim their split once, while self and Lud claims are rejected',async()=>{
  const{capacity}=await account();
  const opened=await capacity.openHumanValidationRequest({nodeId:'guild-one',requesterUserId:'lud-user-0001',requestId:'split-two',packetId:'packet-two',projectId:'project-two',validatorCount:2,operatingMode:'lud'});
  assert.equal(opened.request.perValidatorNeurons,15);
  await assert.rejects(()=>capacity.claimHumanValidation({nodeId:'guild-one',validatorUserId:'lud-user-0001',requestId:'split-two',receiptId:'self-receipt',receiptHash:'hash-self',accepted:true,validatorMode:'standard'}),/cannot pay themselves/i);
  await assert.rejects(()=>capacity.claimHumanValidation({nodeId:'guild-one',validatorUserId:'validator-user-0002',requestId:'split-two',receiptId:'lud-receipt',receiptHash:'hash-lud',accepted:true,validatorMode:'lud'}),/Standard mode/i);
  const first=await capacity.claimHumanValidation({nodeId:'guild-one',validatorUserId:'validator-user-0002',requestId:'split-two',receiptId:'receipt-a',receiptHash:'hash-a',accepted:true,validatorMode:'standard'});
  const duplicate=await capacity.claimHumanValidation({nodeId:'guild-one',validatorUserId:'validator-user-0002',requestId:'split-two',receiptId:'receipt-a',receiptHash:'hash-a',accepted:true,validatorMode:'standard'});
  const second=await capacity.claimHumanValidation({nodeId:'guild-one',validatorUserId:'validator-user-0003',requestId:'split-two',receiptId:'receipt-b',receiptHash:'hash-b',accepted:true,validatorMode:'standard'});
  assert.equal(first.claim.neurons,15);
  assert.equal(duplicate.idempotent,true);
  assert.equal(second.request.status,'completed');
  assert.equal((await capacity.validationEarned('guild-one','validator-user-0002')).balanceNeurons,15);
  assert.equal((await capacity.validationEarned('guild-one','validator-user-0003')).balanceNeurons,15);
});

test('validator neurons are a same-day bonus, not persistent or lifetime credits',async()=>{
  const realNow=Date.now,base=Date.UTC(2026,7,16,12,0,0);
  Date.now=()=>base;
  try{
    const{capacity}=await account();
    await capacity.openHumanValidationRequest({nodeId:'guild-one',requesterUserId:'lud-user-0001',requestId:'earned-spend',packetId:'packet-earned',projectId:'project-earned',validatorCount:2,operatingMode:'lud'});
    await capacity.claimHumanValidation({nodeId:'guild-one',validatorUserId:'validator-user-0002',requestId:'earned-spend',receiptId:'receipt-earned',receiptHash:'hash-earned',accepted:true,validatorMode:'standard'});
    assert.equal((await capacity.wallet('guild-one','validator-user-0002')).balanceNeurons,0,'cash-backed lifetime wallet must remain untouched');
    const earnedToday=await capacity.validationEarned('guild-one','validator-user-0002');
    assert.equal(earnedToday.balanceNeurons,15);
    assert.equal(earnedToday.sourceDay,'2026-08-16');
    assert.equal(earnedToday.expiresAt,'2026-08-17T00:00:00.000Z');
    const reservation=await capacity.reserveUsage({nodeId:'guild-one',userId:'validator-user-0002',requestedNeurons:10,billingCeilingNeurons:10,billingRail:'workers-ai-free',fundingSource:'lifetime'});
    assert.equal(reservation.reservation.fundingSource,'validation-earned');
    assert.equal(reservation.reservation.fromValidationEarnedNeurons,10);
    const settlement=await capacity.settleUsage({reservationId:reservation.reservation.reservationId,actualNeurons:8,actualBillingNeurons:8});
    assert.equal(settlement.refundedValidationEarnedNeurons,2);
    assert.equal(settlement.expiredValidationBonusNeurons,0);
    assert.equal((await capacity.validationEarned('guild-one','validator-user-0002')).balanceNeurons,7);
    assert.equal((await capacity.wallet('guild-one','validator-user-0002')).balanceNeurons,0);

    Date.now=()=>base+24*60*60*1000;
    const tomorrow=await capacity.validationEarned('guild-one','validator-user-0002');
    assert.equal(tomorrow.balanceNeurons,0,'unused validator bonus must disappear at the daily reset');
    assert.equal(tomorrow.earnedNeurons,0,'prior-day earnings must not reappear as a new-day wallet');
    const memberTomorrow=await capacity.memberStatus({nodeId:'guild-one',userId:'validator-user-0002'});
    assert.equal(memberTomorrow.quota.validationBonusNeurons,0);
    assert.equal((await capacity.wallet('guild-one','validator-user-0002')).balanceNeurons,0);
  }finally{Date.now=realNow}
});

test('unused reservation refund also expires if settlement crosses the daily reset',async()=>{
  const realNow=Date.now,base=Date.UTC(2026,7,16,23,50,0);
  Date.now=()=>base;
  try{
    const{capacity}=await account();
    await capacity.openHumanValidationRequest({nodeId:'guild-one',requesterUserId:'lud-user-0001',requestId:'cross-reset',packetId:'packet-cross',projectId:'project-cross',validatorCount:2,operatingMode:'lud'});
    await capacity.claimHumanValidation({nodeId:'guild-one',validatorUserId:'validator-user-0002',requestId:'cross-reset',receiptId:'receipt-cross',receiptHash:'hash-cross',accepted:true,validatorMode:'standard'});
    const reservation=await capacity.reserveUsage({nodeId:'guild-one',userId:'validator-user-0002',requestedNeurons:10,billingCeilingNeurons:10,billingRail:'workers-ai-free',fundingSource:'validation-earned'});
    Date.now=()=>base+20*60*1000;
    const settlement=await capacity.settleUsage({reservationId:reservation.reservation.reservationId,actualNeurons:8,actualBillingNeurons:8});
    assert.equal(settlement.refundedValidationEarnedNeurons,0);
    assert.equal(settlement.expiredValidationBonusNeurons,2);
    assert.equal((await capacity.validationEarned('guild-one','validator-user-0002')).balanceNeurons,0);
  }finally{Date.now=realNow}
});

test('unclaimed request shares expire with the Lud daily reset instead of rolling over',async()=>{
  const{capacity,storage}=await account();
  await capacity.openHumanValidationRequest({nodeId:'guild-one',requesterUserId:'lud-user-0001',requestId:'expires-today',packetId:'packet-expire',projectId:'project-expire',validatorCount:3,operatingMode:'lud'});
  const key='human-validation-request:expires-today',request=await storage.get(key);await storage.put(key,{...request,expiresAt:new Date(Date.now()-1000).toISOString()});
  await assert.rejects(()=>capacity.claimHumanValidation({nodeId:'guild-one',validatorUserId:'validator-user-0002',requestId:'expires-today',receiptId:'late-receipt',receiptHash:'late-hash',accepted:true,validatorMode:'standard'}),/expired at the daily neuron reset/i);
  assert.equal((await capacity.validationEarned('guild-one','validator-user-0002')).balanceNeurons,0);
});

test('browser client and Lud human tools use canonical owners without model generation',async()=>{
  const [client,tools,manual,manifest]=await Promise.all([
    readFile(new URL('../public/app/human-validation-neuron-client-v1.js',import.meta.url),'utf8'),
    readFile(new URL('../public/app/lud-human-tools-v1.js',import.meta.url),'utf8'),
    readFile(new URL('../public/app/lud-manual-authoring-v1.js',import.meta.url),'utf8'),
    readFile(new URL('../public/app/lud-package-v1.json',import.meta.url),'utf8').then(JSON.parse),
  ]);
  assert.match(client,/\/api\/node\/human-validation\/request/);
  assert.match(client,/\/api\/node\/human-validation\/claim/);
  assert.match(client,/civweave:validation-labor-awarded/);
  assert.match(tools,/CivweaveCerbanimoQuestV144/);
  assert.match(tools,/CivweaveProposalVotingGateV2/);
  assert.match(tools,/proposeCurriculumModule/);
  assert.match(manual,/tools\.createQuest/);
  assert.match(manual,/tools\.proposeTask/);
  assert.match(manual,/tools\.proposeLearningModule/);
  for(const source of [client,tools,manual])assert.doesNotMatch(source,/\.generate\s*\(/);
  for(const asset of ['/app/human-validation-neuron-client-v1.js','/app/lud-human-tools-v1.js','/app/cerbanimo-quest-engine-v144.js','/app/local-object-mesh-v146.js','/app/proposal-voting-gate-v2.js'])assert.ok(manifest.assets.includes(asset),`${asset} must be in the Lud allowlist`);
});
