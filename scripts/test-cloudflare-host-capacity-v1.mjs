import assert from 'node:assert/strict';
import {
  HOST_ECONOMY_POLICY,
  splitMembershipNetCents,
  splitTopupNetCents,
  membershipContributionUnits,
  normalizeTopupSharing,
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

assert.equal(membershipContributionUnits('member'), 1);
assert.equal(membershipContributionUnits('maker'), 2);
assert.equal(membershipContributionUnits('builder'), 4);
assert.equal(membershipContributionUnits('steward'), 8);
assert.deepEqual(normalizeTopupSharing({}), { shareMode: 'personal', shareBps: 100 });
assert.deepEqual(normalizeTopupSharing({ shareBps: 500 }), { shareMode: 'personal', shareBps: 500 });
assert.deepEqual(normalizeTopupSharing({ shareMode: 'node-equal' }), { shareMode: 'node-equal', shareBps: 10_000 });
assert.throws(() => normalizeTopupSharing({ shareBps: 99 }), /shareBps/);
assert.throws(() => normalizeTopupSharing({ shareBps: 501 }), /shareBps/);

const starter10 = deriveCapacity({
  workersPlan: 'free',
  memberCount: 10,
  communityMemberCount: 10,
  paidExpansionCount: 0,
});
assert.equal(starter10.dailyCeilingNeurons, 10_000);
assert.equal(starter10.includedDailyNeurons, 900);
assert.equal(starter10.communitySeatLimit, 10);
assert.equal(starter10.maxCommunitySeats, 16);
assert.equal(starter10.maxMembers, 28);
assert.equal(starter10.burstReserveNeurons, 1_000);
assert.equal(
  admissionDecision({ seatClass: 'community', capacity: starter10 }).allowed,
  false,
  'the eleventh free-only resident must wait for a paid membership to create free capacity',
);

const onePaidFundingCapped = deriveCapacity({
  workersPlan: 'paid',
  memberCount: 11,
  communityMemberCount: 10,
  paidExpansionCount: 1,
  activePaidUnits: 1,
  operatingReserveMicrocents: 33_000_000,
});
assert.equal(onePaidFundingCapped.communitySeatLimit, 12);
assert.equal(onePaidFundingCapped.targetIncludedDailyNeurons, 1_100);
assert.equal(onePaidFundingCapped.includedDailyNeurons, 900);
assert.equal(onePaidFundingCapped.communityDividend.cappedByFunding, true);

const onePaidFullyFunded = deriveCapacity({
  workersPlan: 'paid',
  memberCount: 11,
  communityMemberCount: 10,
  paidExpansionCount: 1,
  activePaidUnits: 1,
  operatingReserveMicrocents: 120_000_000,
});
assert.equal(onePaidFullyFunded.communitySeatLimit, 12);
assert.equal(onePaidFullyFunded.targetIncludedDailyNeurons, 1_100);
assert.equal(onePaidFullyFunded.includedDailyNeurons, 1_100);
assert.equal(onePaidFullyFunded.communityDividend.targetBonusNeuronsPerMember, 200);
assert.equal(onePaidFullyFunded.communityDividend.communitySeatBoost, 2);

const tenDollarEquivalent = deriveCapacity({
  workersPlan: 'paid',
  memberCount: 12,
  communityMemberCount: 10,
  paidExpansionCount: 2,
  activePaidUnits: 2,
  operatingReserveMicrocents: 220_000_000,
});
assert.equal(tenDollarEquivalent.communitySeatLimit, 14);
assert.equal(tenDollarEquivalent.targetIncludedDailyNeurons, 1_300);
assert.equal(tenDollarEquivalent.communityDividend.targetBonusNeuronsPerMember, 400);
assert.equal(tenDollarEquivalent.communityDividend.communitySeatBoost, 4);

const freeSeatCap = deriveCapacity({
  workersPlan: 'paid',
  memberCount: 16,
  communityMemberCount: 16,
  paidExpansionCount: 0,
  activePaidUnits: 3,
  operatingReserveMicrocents: 400_000_000,
});
assert.equal(freeSeatCap.communitySeatLimit, 16);

const manyPaidUnits = deriveCapacity({
  workersPlan: 'paid',
  memberCount: 20,
  communityMemberCount: 16,
  paidExpansionCount: 4,
  activePaidUnits: 12,
  operatingReserveMicrocents: 2_000_000_000,
});
assert.equal(manyPaidUnits.communitySeatLimit, 16, 'free seats must never exceed the free-instance cap');
assert.equal(manyPaidUnits.targetIncludedDailyNeurons, 3_300);

const fullInstance = deriveCapacity({
  workersPlan: 'paid',
  memberCount: 28,
  communityMemberCount: 16,
  paidExpansionCount: 12,
  activePaidUnits: 12,
  operatingReserveMicrocents: 5_000_000_000,
});
assert.equal(fullInstance.totalSeatsRemaining, 0);
assert.equal(
  admissionDecision({ seatClass: 'paid-expansion', billingStatus: 'paid', capacity: fullInstance }).allowed,
  false,
  'the free instance must hard-stop new admissions at 28 residents',
);

const grandfatheredDowngrade = deriveCapacity({
  workersPlan: 'paid',
  memberCount: 28,
  communityMemberCount: 17,
  paidExpansionCount: 11,
  activePaidUnits: 11,
  operatingReserveMicrocents: 5_000_000_000,
});
assert.equal(grandfatheredDowngrade.communitySeatLimit, 16);
assert.equal(grandfatheredDowngrade.communityOverCapacity, 1);
assert.equal(grandfatheredDowngrade.grandfatheredOverCapacity, true);
assert.equal(grandfatheredDowngrade.targetIncludedDailyNeurons, 3_100);
assert.equal(
  admissionDecision({ seatClass: 'community', capacity: grandfatheredDowngrade }).allowed,
  false,
  'a downgrade may grandfather an existing resident but must not open another free admission',
);

console.log(JSON.stringify({
  ok: true,
  policy: HOST_ECONOMY_POLICY,
  starter10,
  onePaidFundingCapped,
  onePaidFullyFunded,
  tenDollarEquivalent,
  freeSeatCap,
  manyPaidUnits,
  fullInstance,
  grandfatheredDowngrade,
}, null, 2));
