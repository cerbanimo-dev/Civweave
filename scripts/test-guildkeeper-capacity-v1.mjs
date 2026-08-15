import assert from 'node:assert/strict';
import { CivweaveCapacityAccount } from '../cloudflare/node-cloud/src/capacity-guildkeeper-v1.mjs';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  async get(key) { return this.data.get(key); }
  async put(key, value) { this.data.set(key, value); }
  async delete(key) { this.data.delete(key); }
  async list({ prefix = '' } = {}) {
    return new Map([...this.data.entries()].filter(([key]) => String(key).startsWith(prefix)));
  }
}

const storage = new MemoryStorage();
const account = new CivweaveCapacityAccount({ storage }, { CIVWEAVE_WORKERS_PLAN: 'free' });
const nodeId = 'guild-test-node';
await account.putConfig({
  ...(await account.config()),
  hostNodeIds: [nodeId],
  hostingPlan: 'hosted',
  hostingPaidThrough: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  hostingMonthlyCents: 500,
  hostingBillingBand: 'standard',
});

for (let index = 1; index <= 28; index += 1) {
  const admitted = await account.admitMember({
    nodeId,
    userId: `hero-${String(index).padStart(3, '0')}`,
    seatClass: 'community',
    billingStatus: 'free',
  });
  assert.equal(admitted.member.userId, `hero-${String(index).padStart(3, '0')}`);
}

let blocked = null;
try {
  await account.admitMember({ nodeId, userId: 'hero-029', seatClass: 'community', billingStatus: 'free' });
} catch (error) {
  blocked = error;
}
assert.ok(blocked, 'Member 29 must be blocked until a second Guildkeeper is appointed.');
assert.equal(blocked.status, 409);
assert.equal(blocked.code, 'GUILDKEEPER_EXPANSION_REQUIRED');

const before = await account.guildkeeperGovernance(nodeId);
assert.equal(before.memberCount, 28);
assert.equal(before.requiredGuildkeepers, 1);
assert.equal(before.availableGuildkeepers, 1);
assert.equal(before.nextAppointmentRequiredAt, 29);

const appointment = await account.appointGuildkeeper({ nodeId, userId: 'hero-002', label: 'Second Guildkeeper' });
assert.equal(appointment.idempotent, false);
assert.equal(appointment.governance.availableGuildkeepers, 2);

const twentyNinth = await account.admitMember({ nodeId, userId: 'hero-029', seatClass: 'community', billingStatus: 'free' });
assert.equal(twentyNinth.member.userId, 'hero-029');

for (let index = 30; index <= 56; index += 1) {
  await account.admitMember({
    nodeId,
    userId: `hero-${String(index).padStart(3, '0')}`,
    seatClass: 'community',
    billingStatus: 'free',
  });
}

blocked = null;
try {
  await account.admitMember({ nodeId, userId: 'hero-057', seatClass: 'community', billingStatus: 'free' });
} catch (error) {
  blocked = error;
}
assert.equal(blocked?.code, 'GUILDKEEPER_EXPANSION_REQUIRED');

const fiftySix = await account.guildkeeperGovernance(nodeId);
assert.equal(fiftySix.memberCount, 56);
assert.equal(fiftySix.availableGuildkeepers, 2);
assert.equal(fiftySix.nextAppointmentRequiredAt, 57);

await account.appointGuildkeeper({ nodeId, userId: 'hero-003', label: 'Third Guildkeeper' });
await account.admitMember({ nodeId, userId: 'hero-057', seatClass: 'community', billingStatus: 'free' });
const fiftySeven = await account.guildkeeperGovernance(nodeId);
assert.equal(fiftySeven.memberCount, 57);
assert.equal(fiftySeven.requiredGuildkeepers, 3);
assert.equal(fiftySeven.availableGuildkeepers, 3);

let removalBlocked = null;
try { await account.removeGuildkeeper({ nodeId, userId: 'hero-003' }); }
catch (error) { removalBlocked = error; }
assert.equal(removalBlocked?.status, 409, 'A required Guildkeeper cannot be removed while the Guild remains above the resulting ratio.');

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.guildkeeper-capacity.test.v1',
  nodeId,
  memberCount: fiftySeven.memberCount,
  requiredGuildkeepers: fiftySeven.requiredGuildkeepers,
  availableGuildkeepers: fiftySeven.availableGuildkeepers,
  blockedAt: [29, 57],
}, null, 2));
