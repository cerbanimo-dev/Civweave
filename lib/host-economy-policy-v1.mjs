export const HOST_ECONOMY_POLICY = Object.freeze({
  maxHostNodes: 3,
  starterCommunitySeatsPerNode: 6,
  starterCommunitySeatFloorPerNode: 4,
  starterPaidExpansionSeats: 9,
  cloudflareFreeNeuronsPerDay: 10_000,
  survivalFloorNeuronsPerDay: 25,
  maxIncludedDailyNeurons: 900,
  burstReserveBps: 1_000,
  operatingRunwayDays: 30,
  endowmentRunwayDays: 180,
  creditSpendRunwayDays: 30,
  endowmentResidualBps: 2_000,
  neuronCostMicrocents: 1_100,
  membershipSplitBps: Object.freeze({ system: 5_000, host: 2_500, cerbanimo: 2_500 }),
  topupSplitBps: Object.freeze({ system: 7_000, host: 2_500, cerbanimo: 500 }),
});

export const DEFAULT_MEMBERSHIP_TIERS = Object.freeze({
  member: Object.freeze({ id: 'member', serviceAmountCents: 500, monthlyLifetimeCredits: 100_000 }),
  maker: Object.freeze({ id: 'maker', serviceAmountCents: 1_000, monthlyLifetimeCredits: 250_000 }),
  builder: Object.freeze({ id: 'builder', serviceAmountCents: 2_000, monthlyLifetimeCredits: 600_000 }),
  steward: Object.freeze({ id: 'steward', serviceAmountCents: 4_000, monthlyLifetimeCredits: 1_500_000 }),
});

const clean = (value, max = 180) => String(value ?? '').trim().slice(0, max);
const whole = (value, label, min = 0) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min) throw new RangeError(`${label} must be an integer >= ${min}.`);
  return number;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function microcentsToNeurons(microcents, policy = HOST_ECONOMY_POLICY) {
  return Math.max(0, Math.floor(Number(microcents || 0) / policy.neuronCostMicrocents));
}

export function neuronsToMicrocents(neurons, policy = HOST_ECONOMY_POLICY) {
  return Math.max(0, whole(neurons, 'neurons') * policy.neuronCostMicrocents);
}

export function centsToMicrocents(cents) {
  return whole(cents, 'cents') * 1_000_000;
}

function splitNetCents(netCents, split) {
  const net = whole(netCents, 'netCents', 1);
  const systemCents = Math.floor(net * split.system / 10_000);
  const hostCents = Math.floor(net * split.host / 10_000);
  return Object.freeze({ netCents: net, systemCents, hostCents, cerbanimoCents: net - systemCents - hostCents });
}

export function splitMembershipNetCents(netCents, policy = HOST_ECONOMY_POLICY) {
  return splitNetCents(netCents, policy.membershipSplitBps);
}

export function splitTopupNetCents(netCents, policy = HOST_ECONOMY_POLICY) {
  return splitNetCents(netCents, policy.topupSplitBps);
}

export function deriveHostCapacity({
  workersPlan = 'free',
  hostNodeCount = 1,
  memberCount = 0,
  communityMemberCount = 0,
  paidExpansionCount = 0,
  operatingReserveMicrocents = 0,
  communityEndowmentMicrocents = 0,
  creditReserveMicrocents = 0,
  dailyUsedNeurons = 0,
} = {}, policy = HOST_ECONOMY_POLICY) {
  const paidPlan = clean(workersPlan, 40).toLowerCase() === 'paid';
  const nodes = clamp(whole(hostNodeCount, 'hostNodeCount', 1), 1, policy.maxHostNodes);
  const operatingDaily = paidPlan ? Math.floor(microcentsToNeurons(operatingReserveMicrocents, policy) / policy.operatingRunwayDays) : 0;
  const endowmentDaily = paidPlan ? Math.floor(microcentsToNeurons(communityEndowmentMicrocents, policy) / policy.endowmentRunwayDays) : 0;
  const creditDaily = paidPlan ? Math.floor(microcentsToNeurons(creditReserveMicrocents, policy) / policy.creditSpendRunwayDays) : 0;
  const dailyCeilingNeurons = policy.cloudflareFreeNeuronsPerDay + operatingDaily + endowmentDaily + creditDaily;
  const includedPool = Math.floor(dailyCeilingNeurons * (10_000 - policy.burstReserveBps) / 10_000);
  const includedDailyNeurons = memberCount > 0
    ? clamp(Math.floor(includedPool / memberCount), policy.survivalFloorNeuronsPerDay, policy.maxIncludedDailyNeurons)
    : policy.maxIncludedDailyNeurons;
  const starterCommunityLimit = nodes * policy.starterCommunitySeatsPerNode;
  const permanentSeatBacking = neuronsToMicrocents(policy.survivalFloorNeuronsPerDay * policy.endowmentRunwayDays, policy);
  const extraPermanentSeats = paidPlan && permanentSeatBacking > 0
    ? Math.floor(Number(communityEndowmentMicrocents || 0) / permanentSeatBacking)
    : 0;
  const communitySeatLimit = starterCommunityLimit + extraPermanentSeats;
  const paidExpansionSeatLimit = paidPlan ? null : policy.starterPaidExpansionSeats;
  return Object.freeze({
    workersPlan: paidPlan ? 'paid' : 'free',
    hostNodeCount: nodes,
    memberCount,
    communityMemberCount,
    paidExpansionCount,
    dailyCeilingNeurons,
    dailyUsedNeurons,
    dailyRemainingNeurons: Math.max(0, dailyCeilingNeurons - Number(dailyUsedNeurons || 0)),
    includedDailyNeurons,
    burstReserveNeurons: Math.max(0, dailyCeilingNeurons - includedDailyNeurons * memberCount),
    communitySeatLimit,
    paidExpansionSeatLimit,
    paidExpansionSeatsRemaining: paidExpansionSeatLimit == null ? null : Math.max(0, paidExpansionSeatLimit - paidExpansionCount),
    starterCommunityLimit,
    fundedOverageNeuronsPerDay: Math.max(0, dailyCeilingNeurons - policy.cloudflareFreeNeuronsPerDay),
    reserves: Object.freeze({ operatingDailyNeurons: operatingDaily, endowmentDailyNeurons: endowmentDaily, creditDailyNeurons: creditDaily }),
  });
}

export function hostAdmissionDecision({ seatClass, billingStatus = 'free', capacity, nodeCommunityCount = 0 } = {}, policy = HOST_ECONOMY_POLICY) {
  const seat = clean(seatClass, 40).toLowerCase();
  const billing = clean(billingStatus, 40).toLowerCase();
  if (!['community', 'paid-expansion'].includes(seat)) return Object.freeze({ allowed: false, reason: 'invalid-seat-class' });
  if (!capacity) return Object.freeze({ allowed: false, reason: 'capacity-unavailable' });
  if (seat === 'community') {
    if (capacity.communityMemberCount >= capacity.communitySeatLimit) return Object.freeze({ allowed: false, reason: 'community-capacity-full' });
    if (capacity.workersPlan === 'free' && nodeCommunityCount >= policy.starterCommunitySeatsPerNode) return Object.freeze({ allowed: false, reason: 'starter-node-community-cap-full' });
    return Object.freeze({ allowed: true, reason: 'community-capacity-available' });
  }
  if (billing !== 'paid') return Object.freeze({ allowed: false, reason: 'paid-expansion-requires-active-membership' });
  if (capacity.paidExpansionSeatLimit != null && capacity.paidExpansionCount >= capacity.paidExpansionSeatLimit) return Object.freeze({ allowed: false, reason: 'starter-paid-expansion-full' });
  const nextCount = capacity.memberCount + 1;
  const usablePool = Math.floor(capacity.dailyCeilingNeurons * (10_000 - policy.burstReserveBps) / 10_000);
  if (nextCount > 0 && Math.floor(usablePool / nextCount) < policy.survivalFloorNeuronsPerDay) {
    return Object.freeze({ allowed: false, reason: 'funded-daily-floor-would-break' });
  }
  return Object.freeze({ allowed: true, reason: 'funded-paid-expansion-available' });
}
