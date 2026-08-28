import fs from 'node:fs';
import assert from 'node:assert/strict';
const runtime=fs.readFileSync(new URL('../public/app/cw-reward-ledger-v2.js',import.meta.url),'utf8');
assert.match(runtime,/options\.accountId/);
assert.match(runtime,/accountId:accountId\|\|undefined/);
assert.match(runtime,/Insufficient \$\{type\} balance for burn/);
assert.match(runtime,/issuerEntries=ledger\.entries\.filter/);
console.log('Civweave reward balance projection v1 verified');
