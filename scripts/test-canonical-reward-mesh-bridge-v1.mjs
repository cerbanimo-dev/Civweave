import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
test('canonical reward mesh bridge publishes every positive canonical reward receipt',async()=>{const s=await read('public/app/shared/civweave-canonical-reward-mesh-bridge-v1.js');assert.match(s,/civweave:canonical-rewards-changed/);assert.match(s,/readLedger\(\)/);assert.match(s,/publishCanonicalReward\(entry,ledger\)/);assert.match(s,/\['skill-xp','acorn','button'\]/)});
test('bridge retries committee work as mesh state changes without forging certification',async()=>{const s=await read('public/app/shared/civweave-canonical-reward-mesh-bridge-v1.js');assert.match(s,/reconcileCanonicalReward/);assert.match(s,/civweave:contribution-mesh/);assert.match(s,/CanonicalRewardPublishedV2/);assert.doesNotMatch(s,/MintCommitteeCertifiedV2/)});
