import fs from 'node:fs';
import assert from 'node:assert/strict';
const text=fs.readFileSync(new URL('../docs/architecture/civweave-ledger-security-invariants-v1.md',import.meta.url),'utf8');
for(const phrase of ['never transferable','requester burn','separate fulfiller reward','Skill XP is not burnable','Cotokens live in the contribution ledger','issuer-local signed chains'])assert.match(text,new RegExp(phrase,'i'));
console.log('Civweave ledger security invariants v1 verified');
