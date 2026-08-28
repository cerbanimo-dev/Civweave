import fs from 'node:fs';
import assert from 'node:assert/strict';
const text=fs.readFileSync(new URL('../docs/architecture/civweave-ledger-architecture-v1.md',import.meta.url),'utf8');
for(const phrase of ['Validation Ledger','Reward Ledger','Contribution Ledger','Fulfillment Ledger','never transferable','Guild is a replica'])assert.match(text,new RegExp(phrase,'i'));
console.log('Civweave ledger architecture v1 verified');
