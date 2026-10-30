import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {INITIAL_GUILD_SLOTS,MAX_GUILD_SLOTS,capacityForStage,progressForStage,nearPinnedLocation} from '../cloudflare/mobile-guild-edge/src/guild-capacity-progression-v1.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=path=>readFileSync(resolve(root,path),'utf8');

test('Guild slots unlock one per verified fifth without exceeding ten',()=>{
  assert.equal(INITIAL_GUILD_SLOTS,5);assert.equal(MAX_GUILD_SLOTS,10);
  assert.deepEqual(Array.from({length:6},(_,n)=>capacityForStage(n)),[5,6,7,8,9,10]);
  assert.equal(capacityForStage(-10),5);assert.equal(capacityForStage(99),10);
  assert.equal(progressForStage(2),40);
});
test('proximity requires fresh, sufficiently accurate owner position near pinned Guild location',()=>{
  const now=Date.parse('2026-10-30T14:00:00Z');
  const pin={latitude:43.9748,longitude:-75.9108,precisionMeters:110};
  const here={latitude:43.975,longitude:-75.9105,accuracyMeters:25,capturedAt:new Date(now).toISOString()};
  assert.equal(nearPinnedLocation(pin,here,{now}).ok,true);
  assert.equal(nearPinnedLocation(pin,{...here,latitude:44.5},{now}).ok,false);
  assert.equal(nearPinnedLocation(pin,{...here,accuracyMeters:800},{now}).ok,false);
  assert.equal(nearPinnedLocation(pin,{...here,capturedAt:new Date(now-11*60*1000).toISOString()},{now}).ok,false);
});
test('founder key is distinct from synchronization key and milestone enforcement is on Cloudflare',()=>{
  const create=source('public/app/mobile-guild-create-v1.mjs');
  const base=source('cloudflare/mobile-guild-edge/src/index.mjs');
  const capacity=source('cloudflare/mobile-guild-edge/src/creator-provenance-entry.mjs');
  assert.match(create,/ownerKey:randomSecret\(\)/);
  assert.match(create,/ownerKey:state\.ownerKey/);
  assert.match(base,/authorizedOwner/);
  assert.match(capacity,/advanceOnboarding/);
  assert.match(capacity,/capacityForStage/);
  assert.match(capacity,/members>=seatLimit/);
});
test('owner management is reachable from the installed Guild navigation',()=>{
  const nav=source('public/app/guild-symbol-v1.js');
  const campus=source('public/app/working-campus-v440.html');
  const client=source('public/app/guild-owner-management-v1.js');
  assert.match(nav,/data-cw-guild-manage/);
  assert.match(campus,/guild-owner-management-v1\.js/);
  assert.match(client,/setAttribute\('aria-label','Guild management'\)/);
  assert.match(client,/data-guild-reward-slot/);
});
