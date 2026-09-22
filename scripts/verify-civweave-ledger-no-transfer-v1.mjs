import fs from 'node:fs';
import assert from 'node:assert/strict';

const ROOT=new URL('../',import.meta.url);
const contract=fs.readFileSync(new URL('public/app/civweave-ledger-contract-v1.js',ROOT),'utf8');
assert.match(contract,/non-transferable/);
assert.match(contract,/operation==='transfer'/);
assert.match(contract,/BURNABLE/);
assert.match(contract,/button:true/);
assert.match(contract,/acorn:true/);
console.log('Civweave reward no-transfer contract verified');
