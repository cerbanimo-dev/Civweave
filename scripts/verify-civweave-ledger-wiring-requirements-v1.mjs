import fs from 'node:fs';
import assert from 'node:assert/strict';
const text=fs.readFileSync(new URL('../docs/architecture/civweave-ledger-wiring-requirements-v1.md',import.meta.url),'utf8');
const names=['civweave-ledger-contract-v1.js','cw-reward-ledger-v2.js','civweave-fulfillment-ledger-v1.js'];
let last=-1;for(const name of names){const pos=text.indexOf(name);assert.ok(pos>last,`${name} missing or out of order`);last=pos}
console.log('Civweave ledger wiring requirements verified');
