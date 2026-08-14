#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  CIVWEAVE_HUB_HOSTING,
  CivweaveCapacityAccount,
  hostingBillingBand,
  hostingPlanActive
} from '../cloudflare/node-cloud/src/capacity-hosting-plan-v1.mjs';

class FakeStorage {
  constructor() { this.rows = new Map(); }
  async get(key) { return this.rows.get(key); }
  async put(key, value) {
    if (key && typeof key === 'object' && !Array.isArray(key)) {
      for (const [entryKey, entryValue] of Object.entries(key)) this.rows.set(entryKey, entryValue);
      return;
    }
    this.rows.set(key, value);
  }
  async delete(key) { this.rows.delete(key); }
  async list({ prefix = '' } = {}) {
    return new Map([...this.rows.entries()].filter(([key]) => String(key).startsWith(prefix)));
  }
}

const storage = new FakeStorage();
const account = new CivweaveCapacityAccount({ storage }, { CIVWEAVE_WORKERS_PLAN: 'free' });
await account.registerNode('garden');

const free = await account.snapshot('garden');
assert.equal(free.hosting.plan, 'free');
assert.equal(free.hosting.active, false);
assert.equal(free.maxMembers, 28);
assert.equal(free.totalSeatsRemaining, 28);
assert.equal(free.grandfatheredOverCapacity, false);
assert.equal(hostingPlanActive({}, Date.now()), false);
assert.equal(hostingBillingBand(199).monthlyCents, 500);
assert.equal(hostingBillingBand(200).monthlyCents, 1000);

const hosted = await account.settleHostingPlan({
  sourceId: 'in_hosting_1',
  nodeId: 'garden',
  paidThrough: '2999-09-14T00:00:00.000Z',
  monthlyCents: 500,
  billingBand: 'standard'
});
assert.equal(hosted.maxMembers, CIVWEAVE_HUB_HOSTING.hostedMaxMembers);
assert.equal(hosted.capacity.hosting.active, true);
assert.equal(hosted.capacity.maxMembers, 400);
assert.equal(hosted.capacity.hosting.currentMonthlyCents, 500);
assert.equal(hosted.capacity.hosting.nextBillingBand.id, 'standard');

for (let index = 0; index < 28; index += 1) {
  const userId = `free-user-${String(index).padStart(2, '0')}`;
  await storage.put(`member:garden:${userId}`, {
    schema: 'civweave.host-member.v2',
    nodeId: 'garden',
    userId,
    seatClass: 'community',
    billingStatus: 'free',
    admittedAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z'
  });
}

const twentyNinth = await account.admitMember({
  nodeId: 'garden',
  userId: 'hosted-user-29',
  seatClass: 'community',
  billingStatus: 'free',
  loginCredentialHash: 'hash-29'
});
assert.equal(twentyNinth.capacity.memberCount, 29);
assert.equal(twentyNinth.capacity.maxMembers, 400);
assert.equal(twentyNinth.capacity.totalSeatsRemaining, 371);

const config = await account.config();
config.hostingPaidThrough = '2000-01-01T00:00:00.000Z';
await account.putConfig(config);
const lapsed = await account.snapshot('garden');
assert.equal(lapsed.hosting.plan, 'free');
assert.equal(lapsed.maxMembers, 28);
assert.equal(lapsed.memberCount, 29);
assert.equal(lapsed.memberOverCapacity, 1);
assert.equal(lapsed.grandfatheredOverCapacity, true);
assert.equal(lapsed.totalSeatsRemaining, 0);
await assert.rejects(() => account.admitMember({
  nodeId: 'garden',
  userId: 'blocked-after-lapse',
  seatClass: 'community',
  billingStatus: 'free'
}), /instance-capacity-full/i);
assert.ok(await storage.get('member:garden:hosted-user-29'), 'existing resident was deleted when hosting lapsed');

const replay = await account.settleHostingPlan({
  sourceId: 'in_hosting_1',
  nodeId: 'garden',
  paidThrough: '2999-09-14T00:00:00.000Z',
  monthlyCents: 500
});
assert.equal(replay.idempotent, true);

console.log('Civweave hub-hosting capacity verification passed.');
