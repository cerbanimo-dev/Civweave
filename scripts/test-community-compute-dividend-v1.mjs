import assert from 'node:assert/strict';
import { CivweaveCapacityAccount } from '../cloudflare/node-cloud/src/capacity-community-extension-v1.mjs';

class MemoryStorage {
  constructor(){this.values=new Map();}
  async get(key){return this.values.get(key);}
  async put(key,value){this.values.set(key,value);}
  async delete(key){this.values.delete(key);}
  async list({prefix=''}={}){return new Map([...this.values].filter(([key])=>key.startsWith(prefix)));}
}

const state={storage:new MemoryStorage()};
const account=new CivweaveCapacityAccount(state,{CIVWEAVE_WORKERS_PLAN:'paid'});
for(const nodeId of ['node-a','node-b','node-c'])await account.registerNode(nodeId);

for(let index=0;index<10;index+=1){
  await account.admitMember({nodeId:'node-a',userId:`free-${index}`,seatClass:'community',billingStatus:'free'});
}
await assert.rejects(
  ()=>account.admitMember({nodeId:'node-a',userId:'free-10',seatClass:'community',billingStatus:'free'}),
  /community-capacity-full/,
);

await account.admitMember({nodeId:'node-b',userId:'paid-5',seatClass:'paid-expansion',billingStatus:'paid',membershipTierId:'member'});
await account.settleMembership({nodeId:'node-b',userId:'paid-5',tierId:'member',sourceId:'membership-5',netServiceCents:500,monthlyLifetimeCredits:100_000});
let capacity=await account.snapshot();
assert.equal(capacity.communitySeatLimit,12);
assert.equal(capacity.communityDividend.contributionUnits,1);
assert.equal(capacity.communityDividend.targetBonusNeuronsPerMember,200);
await account.admitMember({nodeId:'node-a',userId:'free-10',seatClass:'community',billingStatus:'free'});
await account.admitMember({nodeId:'node-a',userId:'free-11',seatClass:'community',billingStatus:'free'});

await account.admitMember({nodeId:'node-b',userId:'paid-10',seatClass:'paid-expansion',billingStatus:'paid',membershipTierId:'maker'});
await account.settleMembership({nodeId:'node-b',userId:'paid-10',tierId:'maker',sourceId:'membership-10',netServiceCents:1000,monthlyLifetimeCredits:250_000});
capacity=await account.snapshot();
assert.equal(capacity.communitySeatLimit,16,'$10 membership contributes four free-seat units on top of the $5 member contribution, capped at 16 total free seats');
assert.equal(capacity.communityDividend.contributionUnits,3);
assert.equal(capacity.communityDividend.targetBonusNeuronsPerMember,600);

await account.setTopupSharing({topupId:'topup-five-percent',nodeId:'node-a',userId:'free-0',shareBps:500});
const topup=await account.settleTopup({sourceId:'topup-paid-event',topupId:'topup-five-percent',nodeId:'node-a',userId:'free-0',netServiceCents:1000});
assert.equal(topup.sharing.shareBps,500);
assert.equal(topup.sharing.communitySharedCents,50);
assert.equal(topup.sharing.personalCreditCents,650);

const adjustment=await account.adjustTopup({sourceId:'topup-refund-event',topupId:'topup-five-percent',nodeId:'node-a',userId:'free-0',kind:'refund',systemCreditCents:350});
assert.equal(adjustment.personalCreditCents+adjustment.communitySharedCents,350);
assert.equal(adjustment.communitySharedCents,25,'refunds must reverse the shared pool proportionally rather than charging the personal wallet for community credits');

await account.setTopupSharing({topupId:'topup-node-equal',nodeId:'node-a',userId:'free-1',shareMode:'node-equal'});
const nodeTopup=await account.settleTopup({sourceId:'node-topup-paid-event',topupId:'topup-node-equal',nodeId:'node-a',userId:'free-1',netServiceCents:1000});
assert.equal(nodeTopup.sharing.shareMode,'node-equal');
assert.equal(nodeTopup.sharing.communitySharedCents,700);
assert.equal(nodeTopup.sharing.personalCreditCents,0);

await account.setBilling({nodeId:'node-b',userId:'paid-5',billingStatus:'free'});
capacity=await account.snapshot();
assert.equal(capacity.communityMemberCount,13);
assert.equal(capacity.communitySeatLimit,14,'the remaining $10 membership keeps four extra free seats alive');
assert.equal(capacity.grandfatheredOverCapacity,false);
assert.equal(capacity.communityDividend.contributionUnits,2);
assert.equal(capacity.communityDividend.targetBonusNeuronsPerMember,400);

console.log(JSON.stringify({ok:true,capacity,topup:topup.sharing,nodeTopup:nodeTopup.sharing,refundSharedCents:adjustment.communitySharedCents},null,2));
