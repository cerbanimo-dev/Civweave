import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {CHECK_POLICY,nodeLiveness,locationVerdict,rewardAllowed,proofFresh} from '../cloudflare/mobile-guild-edge/src/guild-community-proof-v1.mjs';

const source=p=>readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'..',p),'utf8');
const T=Date.parse('2026-10-30T15:00:00Z');
const pin={latitude:43.9748,longitude:-75.9108};
const near={latitude:43.9748,longitude:-75.9108,accuracyMeters:40,capturedAt:new Date(T).toISOString()};
test('local verified pings earn at most one token/member/day, with a Guild-wide reward cap',()=>{
  assert.deepEqual(locationVerdict(pin,near,T).kind,'near');
  assert.equal(locationVerdict(pin,{...near,latitude:44.3},T).kind,'away');
  assert.equal(locationVerdict(pin,{...near,accuracyMeters:10000},T).kind,'unverifiable');
  assert.equal(locationVerdict(pin,{...near,capturedAt:new Date(T-900000).toISOString()},T).kind,'unverifiable');
  assert.equal(rewardAllowed({memberClaimsToday:0,guildClaimsToday:0}),true);
  assert.equal(rewardAllowed({memberClaimsToday:1,guildClaimsToday:0}),false);
  assert.equal(rewardAllowed({memberClaimsToday:0,guildClaimsToday:CHECK_POLICY.maxGuildRewardsPerDay}),false);
  assert.equal(proofFresh(T-30000,T),true);
  assert.equal(proofFresh(T-180000,T),false);
});
test('no volunteer pings is not evidence of an outage; stale heartbeat enters down then removal after 72h',()=>{
  const online={nodeTokenHash:'hash',lastSeenAt:new Date(T).toISOString()};
  assert.equal(nodeLiveness(online,T+60000).state,'online');
  assert.equal(nodeLiveness(online,T+CHECK_POLICY.heartbeatGraceMs+1).state,'down');
  assert.equal(nodeLiveness(online,T+CHECK_POLICY.heartbeatGraceMs+CHECK_POLICY.removeAfterMs+1).state,'removed');
  assert.equal(nodeLiveness({nodeTokenHash:'hash',lastSeenAt:new Date(T).toISOString(),lastVerifiedAt:null},T+1000).state,'online');
});
test('single location discrepancy flags; two independent recent resident checks mark down; old evidence expires',()=>{
  const base={nodeTokenHash:'hash',lastSeenAt:new Date(T).toISOString()};
  assert.equal(nodeLiveness({...base,disputes:[{userId:'one',at:T-6000}]},T).state,'flagged');
  assert.equal(nodeLiveness({...base,disputes:[{userId:'one',at:T-6000},{userId:'two',at:T-4000}]},T).state,'down');
  assert.equal(nodeLiveness({...base,disputes:[{userId:'one',at:T-36*3600000},{userId:'two',at:T-35*3600000}]},T).state,'online');
  assert.equal(nodeLiveness({...base,disputes:[{userId:'one',at:T-6000},{userId:'one',at:T-4000}]},T).state,'flagged');
});
test('node removal is scoped to a physical server, resident membership is not erased and stage two uses community proof',()=>{
  const capacity=source('cloudflare/mobile-guild-edge/src/creator-provenance-entry.mjs');
  const routes=source('cloudflare/mobile-guild-edge/src/creator-provenance-entry.mjs');
  const agent=source('scripts/guild-physical-node-agent-v1.mjs');
  const ui=source('public/app/guild-node-community-check-v1.js');
  const dashboard=source('public/app/guild-owner-management-v1.js');
  assert.match(routes,/\/api\/guild\/physical\/check-in/);
  assert.match(routes,/sessionForHash/);
  assert.match(capacity,/recordCommunityProof/);
  assert.match(capacity,/async alarm\(\)/);
  assert.match(capacity,/nodeLiveness/);
  assert.doesNotMatch(capacity,/action==='verify-location'/);
  assert.match(agent,/communityProofHash/);
  assert.match(ui,/Earn 1 Guild verification token/);
  assert.match(dashboard,/Community location checks/);
  assert.match(capacity,/DELETE FROM resident_members WHERE user_id=/); // Member removal remains separate, not part of node retirement.
});
