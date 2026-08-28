import fs from 'node:fs';
import assert from 'node:assert/strict';
const boundary=fs.readFileSync(new URL('../public/app/install-boundary-v146.js',import.meta.url),'utf8');
for(const name of ['civweave-ledger-contract-v1.js','cw-reward-ledger-v2.js','civweave-fulfillment-ledger-v1.js'])assert.match(boundary,new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`${name} is dormant: not loaded by install boundary`);
console.log('Civweave ledger runtimes are not dormant');
