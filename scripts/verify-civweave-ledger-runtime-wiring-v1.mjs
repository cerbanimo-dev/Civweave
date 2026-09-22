import fs from 'node:fs';
import assert from 'node:assert/strict';

const ROOT=new URL('../',import.meta.url);
const boundary=fs.readFileSync(new URL('public/app/install-boundary-v146.js',ROOT),'utf8');
const offline=JSON.parse(fs.readFileSync(new URL('public/app/offline-package-v208.json',ROOT),'utf8'));
for(const file of ['civweave-ledger-contract-v1.js','cw-reward-ledger-v2.js','civweave-fulfillment-ledger-v1.js']){
  assert.match(boundary,new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`${file} is not loaded by install boundary`);
  assert.ok(JSON.stringify(offline).includes(file),`${file} is not present in offline package`);
}
const contractPos=boundary.indexOf('civweave-ledger-contract-v1.js');
const rewardPos=boundary.indexOf('cw-reward-ledger-v2.js');
const fulfillmentPos=boundary.indexOf('civweave-fulfillment-ledger-v1.js');
assert.ok(contractPos>=0&&rewardPos>contractPos&&fulfillmentPos>rewardPos,'ledger runtime load order must be contract -> rewards -> fulfillment');
console.log('Civweave ledger runtime wiring v1 verified');
