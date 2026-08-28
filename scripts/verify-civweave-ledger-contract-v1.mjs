import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ROOT=new URL('../',import.meta.url);
const contractPath=new URL('public/app/civweave-ledger-contract-v1.js',ROOT);
assert.ok(fs.existsSync(contractPath),'ledger contract runtime is missing');

const context={console,globalThis:null};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(contractPath,'utf8'),context,{filename:'civweave-ledger-contract-v1.js'});

const api=context.CivweaveLedgerContractV1;
assert.ok(api,'ledger contract did not boot');
assert.equal(api.TRANSFERABLE.button,false);
assert.equal(api.TRANSFERABLE.acorn,false);
assert.equal(api.BURNABLE.button,true);
assert.equal(api.BURNABLE.acorn,true);
assert.equal(api.BURNABLE['skill-xp'],false);

assert.deepEqual(JSON.parse(JSON.stringify(api.assertRewardMutation({assetType:'button',operation:'burn',amount:-5}))),{assetType:'button',operation:'burn',amount:5});
assert.deepEqual(JSON.parse(JSON.stringify(api.assertRewardMutation({assetType:'acorn',operation:'earn',amount:3}))),{assetType:'acorn',operation:'earn',amount:3});
assert.throws(()=>api.assertRewardMutation({assetType:'button',operation:'transfer',amount:5,toAccountId:'passport:b'}),/non-transferable|Reward Ledger/);
assert.throws(()=>api.assertRewardMutation({assetType:'skill-xp',operation:'burn',amount:5}),/not burnable/);
assert.throws(()=>api.assertRewardMutation({assetType:'cotoken',operation:'earn',amount:5}),/Reward Ledger only/);

const settlement=api.fulfillmentSettlement({
  fulfillmentId:'fulfillment-1',
  requesterId:'passport:a',
  fulfillerId:'passport:b',
  assetType:'button',
  burnAmount:5,
  rewardAmount:7,
  validationRef:'threshold-1',
});
assert.equal(settlement.burn.accountId,'passport:a');
assert.equal(settlement.burn.operation,'burn');
assert.equal(settlement.burn.amount,5);
assert.equal(settlement.reward.accountId,'passport:b');
assert.equal(settlement.reward.operation,'earn');
assert.equal(settlement.reward.amount,7);
assert.equal(settlement.validationRef,'threshold-1');
assert.notEqual(settlement.burn.sourceKey,settlement.reward.sourceKey);
assert.throws(()=>api.fulfillmentSettlement({fulfillmentId:'x',requesterId:'same',fulfillerId:'same',assetType:'acorn',burnAmount:1,rewardAmount:1,validationRef:'v'}),/distinct/);

const architecture=fs.readFileSync(new URL('docs/architecture/civweave-ledger-architecture-v1.md',ROOT),'utf8');
for(const required of ['Validation Ledger','Reward Ledger','Contribution Ledger','Fulfillment Ledger','never transferable','issuer/device-local signed chains'])assert.match(architecture,new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));

console.log('Civweave ledger contract v1 verified');
