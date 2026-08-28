import fs from 'node:fs';
import assert from 'node:assert/strict';
const runtime=fs.readFileSync(new URL('../public/app/civweave-fulfillment-ledger-v1.js',import.meta.url),'utf8');
for(const phrase of ['processedFulfillmentIds','operation:\'burn\'','operation:\'earn\'','validationRef','requesterId','fulfillerId'])assert.match(runtime,new RegExp(phrase));
assert.doesNotMatch(runtime,/toAccountId\s*:/);
console.log('Civweave fulfillment settlement invariants verified');
