import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
for(const file of ['public/app/civweave-ledger-contract-v1.js','public/app/cw-reward-ledger-v2.js','public/app/civweave-fulfillment-ledger-v1.js','docs/architecture/civweave-ledger-architecture-v1.md'])assert.ok(fs.existsSync(new URL(file,root)),`${file} missing`);
console.log('Civweave ledger required files verified');
