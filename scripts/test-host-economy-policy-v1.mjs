import assert from 'node:assert/strict';
import {
  HOST_ECONOMY_POLICY,
  centsToMicrocents,
  deriveHostCapacity,
  hostAdmissionDecision,
  neuronsToMicrocents,
  splitMembershipNetCents,
} from '../lib/host-economy-policy-v1.mjs';

const starter = deriveHostCapacity({ workersPlan: 'free', hostNodeCount: 1 });
assert.equal(starter.communitySeatLimit, 6);
assert.equal(starter.paidExpansionSeatLimit, 9);
assert.equal(starter.dailyCeilingNeurons, HOST_ECONOMY_POLICY.cloudflareFreeNeuronsPerDay);

const paidCommunity = deriveHostCapacity({
  workersPlan: 'free',
  hostNodeCount: 1,
  memberCount: 1,
  communityMemberCount: 1,
  paidExpansionCount: 0,
});
assert.equal(paidCommunity.paidExpansionSeatsRemaining, 9, 'A paid community resident must not consume a paid-expansion seat.');

const split = splitMembershipNetCents(500);
assert.deepEqual(split, { netCents: 500, systemCents: 250, hostCents: 125, cerbanimoCents: 125 });

const onePermanentSeatBacking = neuronsToMicrocents(
  HOST_ECONOMY_POLICY.survivalFloorNeuronsPerDay * HOST_ECONOMY_POLICY.endowmentRunwayDays,
);
const funded = deriveHostCapacity({
  workersPlan: 'paid',
  hostNodeCount: 1,
  memberCount: 6,
  communityMemberCount: 6,
  communityEndowmentMicrocents: onePermanentSeatBacking * 3,
  operatingReserveMicrocents: centsToMicrocents(250),
});
assert.equal(funded.communitySeatLimit, 9, 'Endowment backing should create permanent community capacity.');
assert.equal(funded.paidExpansionSeatLimit, null, 'Paid Workers removes the fixed paid-expansion seat cap.');
assert.ok(funded.dailyCeilingNeurons > starter.dailyCeilingNeurons);

assert.deepEqual(
  hostAdmissionDecision({ seatClass: 'paid-expansion', billingStatus: 'free', capacity: funded }),
  { allowed: false, reason: 'paid-expansion-requires-active-membership' },
);
assert.equal(
  hostAdmissionDecision({ seatClass: 'paid-expansion', billingStatus: 'paid', capacity: funded }).allowed,
  true,
);

const starved = deriveHostCapacity({
  workersPlan: 'free',
  hostNodeCount: 1,
  memberCount: 359,
  communityMemberCount: 6,
  paidExpansionCount: 353,
});
assert.deepEqual(
  hostAdmissionDecision({ seatClass: 'paid-expansion', billingStatus: 'paid', capacity: starved }),
  { allowed: false, reason: 'starter-paid-expansion-full' },
);

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.host-economy-policy-test.v1',
  starter,
  funded,
}, null, 2));
