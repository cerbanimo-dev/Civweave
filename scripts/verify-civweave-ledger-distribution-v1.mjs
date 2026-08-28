import fs from 'node:fs';
import assert from 'node:assert/strict';
const text=fs.readFileSync(new URL('../docs/architecture/civweave-ledger-distribution-v1.md',import.meta.url),'utf8');
for(const phrase of ['Personal devices','Home Guild','Other Guilds','recovery/cache','signed scoped records','never receives authority to spend'])assert.match(text,new RegExp(phrase,'i'));
console.log('Civweave ledger distribution v1 verified');
