import fs from 'node:fs';
import assert from 'node:assert/strict';
const text=fs.readFileSync(new URL('../docs/architecture/civweave-ledger-authority-summary-v1.md',import.meta.url),'utf8');
assert.match(text,/earn\/burn-only and never transferable/i);
assert.match(text,/Contribution Ledger owns Cotokens/i);
assert.match(text,/Guilds are scoped replicas/i);
console.log('Civweave ledger authority summary verified');
