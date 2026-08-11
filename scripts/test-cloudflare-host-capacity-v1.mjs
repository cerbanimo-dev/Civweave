import assert from 'node:assert/strict';
import {
  HOST_ECONOMY_POLICY,
  splitMembershipNetCents,
  splitTopupNetCents,
  deriveCapacity,
  admissionDecision,
} from '../cloudflare/node-cloud/src/capacity.mjs';

assert.deepEqual(splitMembershipNetCents(500), {
  netCents: 500,
  systemCents: 250,
  hostCents: 125,
  cerbanimoCents: 125,
});
assert.deepEqual(splitTopupNetCents(1000), {
  netCents: 1000,
  systemCents: 700,
  hostCents: 250,
  cerbanimoCents: 50,
});

const starter18 = deriveCapacity({
  workersPlan: 'free',
  memberCount: 18,
  communityMemberCount: 18,
  paidExpansionCount: 0,
});
assert.equal(starter18.dailyCeilingNeurons, 10_000);
assert.equal(starter18.includedDailyNeurons, 500);
assert.equal(starter18.communitySeatLimit, 18);
assert.equal(starter18.paidExpansionSeatLimit, 9);

const starter12 = deriveCapacity({
  workersPlan: 'free',
  memberCount: 12,
  communityMemberCount: 12,
  paidExpansionCount: 0,
});
assert.equal(starter12.includedDailyNeurons, 750);

const paidEmpty = deriveCapacity({
  workersPlan: 'paid',
  memberCount: 18,
  communityMemberCount: 18,
  paidExpansionCount: 0,
});
assert.equal(
  paidEmpty.dailyCeilingNeurons,
  10_000,
  'Workers Paid without funding must not exceed the free AI allocation',
);
assert.equal(
  paidEmpty.communitySeatLimit,
  18,
  'Workers Paid without an endowment must not create permanent free seats',
);

const paidFunded = deriveCapacity({
  workersPlan: 'paid',
  memberCount: 18,
  communityMemberCount: 18,
  paidExpansionCount: 0,
  operatingReserveMicrocents: 30_000_000,
  communityEndowmentMicrocents: 30_000_000,
  creditReserveMicrocents: 30_000_000,
});
assert.ok(paidFunded.dailyCeilingNeurons > 10_000);
assert.ok(paidFunded.communitySeatLimit > 18);
assert.equal(paidFunded.paidExpansionSeatLimit, null);

assert.equal(
  admissionDecision({
    seatClass: 'community',
    capacity: starter18,
    nodeCommunityCount: 6,
  }).allowed,
  false,
);
assert.equal(
  admissionDecision({
    seatClass: 'paid-expansion',
    billingStatus: 'free',
    capacity: starter18,
  }).allowed,
  false,
);
assert.equal(
  admissionDecision({
    seatClass: 'paid-expansion',
    billingStatus: 'paid',
    capacity: starter18,
  }).allowed,
  true,
);

const twentySeven = deriveCapacity({
  workersPlan: 'free',
  memberCount: 27,
  communityMemberCount: 18,
  paidExpansionCount: 9,
});
assert.equal(twentySeven.dailyCeilingNeurons, 10_000);
assert.equal(twentySeven.includedDailyNeurons, 333);
assert.equal(
  admissionDecision({
    seatClass: 'paid-expansion',
    billingStatus: 'paid',
    capacity: twentySeven,
  }).allowed,
  false,
);

console.log(JSON.stringify({
  ok: true,
  policy: HOST_ECONOMY_POLICY,
  starter18,
  starter12,
  paidEmpty,
  paidFunded,
  twentySeven,
}, null, 2));
