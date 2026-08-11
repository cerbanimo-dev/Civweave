export const HOST_CAPACITY_SCHEMA = 'civweave.host-capacity.v1';
export const HOST_ECONOMY_SCHEMA = 'civweave.host-economy.v1';

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
const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
const memberKey = (nodeId, userId) => `member:${clean(nodeId)}:${clean(userId)}`;
const walletKey = (nodeId, userId) => `credits:${clean(nodeId)}:${clean(userId)}`;
const usageKey = (day, nodeId, userId) => `usage:${day}:${clean(nodeId)}:${clean(userId)}`;
const reservationKey = id => `reservation:${clean(id, 240)}`;

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
  return Object.freeze({
    netCents: net,
    systemCents,
    hostCents,
    cerbanimoCents: net - systemCents - hostCents,
  });
}
export function splitMembershipNetCents(netCents, policy = HOST_ECONOMY_POLICY) {
  return splitNetCents(netCents, policy.membershipSplitBps);
}
export function splitTopupNetCents(netCents, policy = HOST_ECONOMY_POLICY) {
  return splitNetCents(netCents, policy.topupSplitBps);
}

export function deriveCapacity({
  workersPlan = 'free',
  memberCount = 0,
  communityMemberCount = 0,
  paidExpansionCount = 0,
  operatingReserveMicrocents = 0,
  communityEndowmentMicrocents = 0,
  creditReserveMicrocents = 0,
  dailyUsedNeurons = 0,
} = {}, policy = HOST_ECONOMY_POLICY) {
  const paidPlan = String(workersPlan).toLowerCase() === 'paid';
  const operatingDaily = paidPlan ? Math.floor(microcentsToNeurons(operatingReserveMicrocents, policy) / policy.operatingRunwayDays) : 0;
  const endowmentDaily = paidPlan ? Math.floor(microcentsToNeurons(communityEndowmentMicrocents, policy) / policy.endowmentRunwayDays) : 0;
  const creditDaily = paidPlan ? Math.floor(microcentsToNeurons(creditReserveMicrocents, policy) / policy.creditSpendRunwayDays) : 0;
  const dailyCeilingNeurons = policy.cloudflareFreeNeuronsPerDay + operatingDaily + endowmentDaily + creditDaily;
  const includedPool = Math.floor(dailyCeilingNeurons * (10_000 - policy.burstReserveBps) / 10_000);
  const includedDailyNeurons = memberCount > 0
    ? clamp(Math.floor(includedPool / memberCount), policy.survivalFloorNeuronsPerDay, policy.maxIncludedDailyNeurons)
    : policy.maxIncludedDailyNeurons;
  const starterCommunityLimit = policy.maxHostNodes * policy.starterCommunitySeatsPerNode;
  const extraPermanentSeats = paidPlan
    ? Math.floor(Number(communityEndowmentMicrocents || 0) / neuronsToMicrocents(policy.survivalFloorNeuronsPerDay * policy.endowmentRunwayDays, policy))
    : 0;
  const communitySeatLimit = starterCommunityLimit + extraPermanentSeats;
  const paidExpansionSeatLimit = paidPlan ? null : policy.starterPaidExpansionSeats;
  return Object.freeze({
    schema: HOST_CAPACITY_SCHEMA,
    workersPlan: paidPlan ? 'paid' : 'free',
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

export function admissionDecision({ seatClass, billingStatus = 'free', capacity, nodeCommunityCount = 0 } = {}, policy = HOST_ECONOMY_POLICY) {
  const seat = clean(seatClass).toLowerCase();
  const billing = clean(billingStatus).toLowerCase();
  if (!['community', 'paid-expansion'].includes(seat)) return Object.freeze({ allowed: false, reason: 'invalid-seat-class' });
  if (seat === 'community') {
    if (capacity.communityMemberCount >= capacity.communitySeatLimit) return Object.freeze({ allowed: false, reason: 'community-capacity-full' });
    if (capacity.workersPlan === 'free' && nodeCommunityCount >= policy.starterCommunitySeatsPerNode) return Object.freeze({ allowed: false, reason: 'starter-node-community-cap-full' });
    return Object.freeze({ allowed: true, reason: 'community-capacity-available' });
  }
  if (billing !== 'paid') return Object.freeze({ allowed: false, reason: 'paid-expansion-requires-active-membership' });
  if (capacity.paidExpansionSeatLimit != null && capacity.paidExpansionCount >= capacity.paidExpansionSeatLimit) return Object.freeze({ allowed: false, reason: 'starter-paid-expansion-full' });
  const nextCount = capacity.memberCount + 1;
  if (nextCount > 0 && Math.floor(capacity.dailyCeilingNeurons * (10_000 - policy.burstReserveBps) / 10_000 / nextCount) < policy.survivalFloorNeuronsPerDay) {
    return Object.freeze({ allowed: false, reason: 'funded-daily-floor-would-break' });
  }
  return Object.freeze({ allowed: true, reason: 'funded-paid-expansion-available' });
}

function initialConfig(workersPlan = 'free') {
  return {
    schema: HOST_CAPACITY_SCHEMA,
    workersPlan: String(workersPlan).toLowerCase() === 'paid' ? 'paid' : 'free',
    hostNodeIds: [],
    operatingReserveMicrocents: 0,
    communityEndowmentMicrocents: 0,
    creditReserveMicrocents: 0,
    updatedAt: new Date().toISOString(),
  };
}

export class CivweaveCapacityAccount {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async config() {
    return (await this.state.storage.get('config')) || initialConfig(this.env.CIVWEAVE_WORKERS_PLAN || 'free');
  }
  async putConfig(config) {
    const next = { ...config, updatedAt: new Date().toISOString() };
    await this.state.storage.put('config', next);
    return next;
  }
  async members() {
    const rows = await this.state.storage.list({ prefix: 'member:' });
    return [...rows.values()];
  }
  async dailyTotal(now = Date.now()) {
    return Number(await this.state.storage.get(`daily-total:${dayKey(now)}`) || 0);
  }
  async snapshot(nodeId = '') {
    const [config, members, dailyUsedNeurons] = await Promise.all([this.config(), this.members(), this.dailyTotal()]);
    const community = members.filter(item => item.seatClass === 'community');
    const expansion = members.filter(item => item.seatClass === 'paid-expansion');
    const capacity = deriveCapacity({
      workersPlan: config.workersPlan,
      memberCount: members.length,
      communityMemberCount: community.length,
      paidExpansionCount: expansion.length,
      operatingReserveMicrocents: config.operatingReserveMicrocents,
      communityEndowmentMicrocents: config.communityEndowmentMicrocents,
      creditReserveMicrocents: config.creditReserveMicrocents,
      dailyUsedNeurons,
    });
    const node = clean(nodeId);
    const nodeMembers = node ? members.filter(item => item.nodeId === node) : [];
    return Object.freeze({
      ...capacity,
      hostNodeIds: [...config.hostNodeIds],
      nodeId: node || null,
      nodeMembers: nodeMembers.length,
      nodeCommunityMembers: nodeMembers.filter(item => item.seatClass === 'community').length,
      activePaidMembers: members.filter(item => item.billingStatus === 'paid').length,
      reservesMicrocents: Object.freeze({
        operating: config.operatingReserveMicrocents,
        communityEndowment: config.communityEndowmentMicrocents,
        lifetimeCredits: config.creditReserveMicrocents,
      }),
    });
  }

  async registerNode(nodeId) {
    const id = clean(nodeId);
    if (!id) throw Object.assign(new TypeError('nodeId is required.'), { status: 400 });
    const config = await this.config();
    if (config.hostNodeIds.includes(id)) return this.snapshot(id);
    if (config.hostNodeIds.length >= HOST_ECONOMY_POLICY.maxHostNodes) throw Object.assign(new RangeError('This account already has its three host nodes.'), { status: 409 });
    config.hostNodeIds = [...config.hostNodeIds, id];
    await this.putConfig(config);
    return this.snapshot(id);
  }

  async admitMember(input) {
    const nodeId = clean(input.nodeId), userId = clean(input.userId);
    if (!nodeId || !userId) throw Object.assign(new TypeError('nodeId and userId are required.'), { status: 400 });
    const config = await this.config();
    if (!config.hostNodeIds.includes(nodeId)) throw Object.assign(new RangeError('Node is not registered to this capacity account.'), { status: 404 });
    const key = memberKey(nodeId, userId);
    const prior = await this.state.storage.get(key);
    if (prior) return { member: prior, capacity: await this.snapshot(nodeId), idempotent: true };
    const members = await this.members();
    const capacity = await this.snapshot(nodeId);
    const nodeCommunityCount = members.filter(item => item.nodeId === nodeId && item.seatClass === 'community').length;
    const decision = admissionDecision({ seatClass: input.seatClass, billingStatus: input.billingStatus, capacity, nodeCommunityCount });
    if (!decision.allowed) throw Object.assign(new RangeError(decision.reason), { status: 409 });
    const member = Object.freeze({
      schema: 'civweave.host-member.v1',
      nodeId,
      userId,
      seatClass: clean(input.seatClass).toLowerCase(),
      billingStatus: clean(input.billingStatus || 'free').toLowerCase() === 'paid' ? 'paid' : 'free',
      membershipTierId: clean(input.membershipTierId) || null,
      admittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await this.state.storage.put(key, member);
    return { member, capacity: await this.snapshot(nodeId), idempotent: false };
  }

  async setBilling(input) {
    const nodeId = clean(input.nodeId), userId = clean(input.userId);
    const key = memberKey(nodeId, userId);
    const prior = await this.state.storage.get(key);
    if (!prior) throw Object.assign(new RangeError('Member is not admitted to this node.'), { status: 404 });
    const billingStatus = clean(input.billingStatus).toLowerCase() === 'paid' ? 'paid' : 'free';
    if (prior.seatClass === 'paid-expansion' && billingStatus === 'free') {
      throw Object.assign(new RangeError('Paid expansion residency requires an active membership; move the member into an available community seat before cancelling.'), { status: 409 });
    }
    const next = Object.freeze({ ...prior, billingStatus, membershipTierId: billingStatus === 'paid' ? clean(input.membershipTierId) || prior.membershipTierId : null, updatedAt: new Date().toISOString() });
    await this.state.storage.put(key, next);
    return { member: next, capacity: await this.snapshot(nodeId) };
  }

  async settleMembership(input) {
    const nodeId = clean(input.nodeId), userId = clean(input.userId), tierId = clean(input.tierId).toLowerCase();
    const tier = DEFAULT_MEMBERSHIP_TIERS[tierId];
    if (!tier) throw Object.assign(new RangeError('Unknown membership tier.'), { status: 400 });
    const split = splitMembershipNetCents(whole(input.netServiceCents ?? tier.serviceAmountCents, 'netServiceCents', 1));
    const requestedCredits = whole(input.monthlyLifetimeCredits ?? tier.monthlyLifetimeCredits, 'monthlyLifetimeCredits');
    const creditBacking = neuronsToMicrocents(requestedCredits);
    const systemMicrocents = centsToMicrocents(split.systemCents);
    if (creditBacking > systemMicrocents) throw Object.assign(new RangeError('Membership lifetime-credit grant exceeds its system-cost backing.'), { status: 409 });
    const residual = systemMicrocents - creditBacking;
    const endowment = Math.floor(residual * HOST_ECONOMY_POLICY.endowmentResidualBps / 10_000);
    const operating = residual - endowment;
    const config = await this.config();
    config.creditReserveMicrocents += creditBacking;
    config.communityEndowmentMicrocents += endowment;
    config.operatingReserveMicrocents += operating;
    await this.putConfig(config);
    const walletKeyName = walletKey(nodeId, userId);
    const wallet = (await this.state.storage.get(walletKeyName)) || { balanceNeurons: 0, issuedNeurons: 0, spentNeurons: 0 };
    const nextWallet = { ...wallet, balanceNeurons: wallet.balanceNeurons + requestedCredits, issuedNeurons: wallet.issuedNeurons + requestedCredits, updatedAt: new Date().toISOString() };
    await this.state.storage.put(walletKeyName, nextWallet);
    await this.setBilling({ nodeId, userId, billingStatus: 'paid', membershipTierId: tierId });
    return { schema: HOST_ECONOMY_SCHEMA, kind: 'membership', split, lifetimeCreditsAdded: requestedCredits, reservesAddedMicrocents: { lifetimeCredits: creditBacking, operating, communityEndowment: endowment }, wallet: nextWallet, capacity: await this.snapshot(nodeId) };
  }

  async settleTopup(input) {
    const nodeId = clean(input.nodeId), userId = clean(input.userId);
    const split = splitTopupNetCents(whole(input.netServiceCents, 'netServiceCents', 1));
    const creditBacking = centsToMicrocents(split.systemCents);
    const credits = microcentsToNeurons(creditBacking);
    const config = await this.config();
    config.creditReserveMicrocents += creditBacking;
    await this.putConfig(config);
    const key = walletKey(nodeId, userId);
    const wallet = (await this.state.storage.get(key)) || { balanceNeurons: 0, issuedNeurons: 0, spentNeurons: 0 };
    const nextWallet = { ...wallet, balanceNeurons: wallet.balanceNeurons + credits, issuedNeurons: wallet.issuedNeurons + credits, updatedAt: new Date().toISOString() };
    await this.state.storage.put(key, nextWallet);
    return { schema: HOST_ECONOMY_SCHEMA, kind: 'topup', split, lifetimeCreditsAdded: credits, wallet: nextWallet, capacity: await this.snapshot(nodeId) };
  }

  async reserveUsage(input) {
    const nodeId = clean(input.nodeId), userId = clean(input.userId), requested = whole(input.requestedNeurons, 'requestedNeurons', 1);
    const member = await this.state.storage.get(memberKey(nodeId, userId));
    if (!member) throw Object.assign(new RangeError('Member is not admitted to this node.'), { status: 404 });
    const now = Date.now(), day = dayKey(now), capacity = await this.snapshot(nodeId);
    if (capacity.dailyUsedNeurons + requested > capacity.dailyCeilingNeurons) throw Object.assign(new RangeError('Account daily funded compute ceiling reached.'), { status: 429 });
    const userUsageStorageKey = usageKey(day, nodeId, userId);
    const userUsed = Number(await this.state.storage.get(userUsageStorageKey) || 0);
    const includedRemaining = Math.max(0, capacity.includedDailyNeurons - userUsed);
    const fromIncluded = Math.min(requested, includedRemaining);
    const fromLifetime = requested - fromIncluded;
    if (fromLifetime > 0 && input.allowLifetimeCredits !== true) throw Object.assign(new RangeError('Request exceeds today\'s included compute; explicit lifetime-credit permission is required.'), { status: 402 });
    const creditsKey = walletKey(nodeId, userId);
    const wallet = (await this.state.storage.get(creditsKey)) || { balanceNeurons: 0, issuedNeurons: 0, spentNeurons: 0 };
    if (fromLifetime > wallet.balanceNeurons) throw Object.assign(new RangeError('Insufficient lifetime compute credits.'), { status: 402 });
    const reservationId = `compute:${crypto.randomUUID()}`;
    await this.state.storage.put(userUsageStorageKey, userUsed + requested);
    await this.state.storage.put(`daily-total:${day}`, capacity.dailyUsedNeurons + requested);
    if (fromLifetime) await this.state.storage.put(creditsKey, { ...wallet, balanceNeurons: wallet.balanceNeurons - fromLifetime, spentNeurons: wallet.spentNeurons + fromLifetime, updatedAt: new Date().toISOString() });
    const reservation = Object.freeze({ schema: 'civweave.compute-reservation.v1', reservationId, nodeId, userId, day, requestedNeurons: requested, fromIncludedNeurons: fromIncluded, fromLifetimeNeurons: fromLifetime, createdAt: new Date().toISOString() });
    await this.state.storage.put(reservationKey(reservationId), reservation);
    return { reservation, capacity: await this.snapshot(nodeId) };
  }

  async settleUsage(input) {
    const id = clean(input.reservationId, 240), actual = whole(input.actualNeurons, 'actualNeurons');
    const key = reservationKey(id), reservation = await this.state.storage.get(key);
    if (!reservation) throw Object.assign(new RangeError('Unknown compute reservation.'), { status: 404 });
    if (actual > reservation.requestedNeurons) throw Object.assign(new RangeError('actualNeurons cannot exceed the reservation.'), { status: 409 });
    const refund = reservation.requestedNeurons - actual;
    const refundLifetime = Math.min(refund, reservation.fromLifetimeNeurons);
    const refundIncluded = refund - refundLifetime;
    const userUsageStorageKey = usageKey(reservation.day, reservation.nodeId, reservation.userId);
    const currentUserUsed = Number(await this.state.storage.get(userUsageStorageKey) || 0);
    const currentTotal = Number(await this.state.storage.get(`daily-total:${reservation.day}`) || 0);
    await this.state.storage.put(userUsageStorageKey, Math.max(0, currentUserUsed - refund));
    await this.state.storage.put(`daily-total:${reservation.day}`, Math.max(0, currentTotal - refund));
    if (refundLifetime) {
      const creditsKey = walletKey(reservation.nodeId, reservation.userId);
      const wallet = (await this.state.storage.get(creditsKey)) || { balanceNeurons: 0, issuedNeurons: 0, spentNeurons: 0 };
      await this.state.storage.put(creditsKey, { ...wallet, balanceNeurons: wallet.balanceNeurons + refundLifetime, spentNeurons: Math.max(0, wallet.spentNeurons - refundLifetime), updatedAt: new Date().toISOString() });
    }
    const paidActual = Math.max(0, actual - Math.max(0, HOST_ECONOMY_POLICY.cloudflareFreeNeuronsPerDay - Math.max(0, currentTotal - reservation.requestedNeurons)));
    if (paidActual > 0) {
      const config = await this.config();
      const lifetimeActual = Math.max(0, reservation.fromLifetimeNeurons - refundLifetime);
      const includedPaidActual = Math.max(0, paidActual - lifetimeActual);
      const creditCost = neuronsToMicrocents(Math.min(paidActual, lifetimeActual));
      const includedCost = neuronsToMicrocents(includedPaidActual);
      if (creditCost > config.creditReserveMicrocents) throw Object.assign(new RangeError('Lifetime-credit cash reserve is insufficient.'), { status: 503 });
      config.creditReserveMicrocents -= creditCost;
      let remainingIncludedCost = includedCost;
      const operatingDebit = Math.min(config.operatingReserveMicrocents, remainingIncludedCost);
      config.operatingReserveMicrocents -= operatingDebit;
      remainingIncludedCost -= operatingDebit;
      const endowmentDebit = Math.min(config.communityEndowmentMicrocents, remainingIncludedCost);
      config.communityEndowmentMicrocents -= endowmentDebit;
      remainingIncludedCost -= endowmentDebit;
      if (remainingIncludedCost > 0) throw Object.assign(new RangeError('Free-service reserve is insufficient for settled overage.'), { status: 503 });
      await this.putConfig(config);
    }
    await this.state.storage.delete(key);
    return { schema: 'civweave.compute-settlement.v1', reservationId: id, requestedNeurons: reservation.requestedNeurons, actualNeurons: actual, refundedNeurons: refund, refundedIncludedNeurons: refundIncluded, refundedLifetimeNeurons: refundLifetime, capacity: await this.snapshot(reservation.nodeId) };
  }

  async fetch(request) {
    const url = new URL(request.url);
    const input = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    try {
      if (request.method === 'GET' && url.pathname === '/snapshot') return Response.json(await this.snapshot(url.searchParams.get('nodeId') || ''));
      if (request.method === 'POST' && url.pathname === '/configure') {
        const config = await this.config();
        config.workersPlan = clean(input.workersPlan).toLowerCase() === 'paid' ? 'paid' : 'free';
        await this.putConfig(config);
        return Response.json(await this.snapshot(input.nodeId || ''));
      }
      if (request.method === 'POST' && url.pathname === '/nodes/register') return Response.json(await this.registerNode(input.nodeId));
      if (request.method === 'POST' && url.pathname === '/members/admit') return Response.json(await this.admitMember(input));
      if (request.method === 'POST' && url.pathname === '/members/billing') return Response.json(await this.setBilling(input));
      if (request.method === 'POST' && url.pathname === '/settlements/membership') return Response.json(await this.settleMembership(input));
      if (request.method === 'POST' && url.pathname === '/settlements/topup') return Response.json(await this.settleTopup(input));
      if (request.method === 'POST' && url.pathname === '/usage/reserve') return Response.json(await this.reserveUsage(input));
      if (request.method === 'POST' && url.pathname === '/usage/settle') return Response.json(await this.settleUsage(input));
      return Response.json({ ok: false, error: 'not-found' }, { status: 404 });
    } catch (error) {
      return Response.json({ ok: false, error: String(error?.message || error) }, { status: Number.isSafeInteger(error?.status) ? error.status : 500 });
    }
  }
}
