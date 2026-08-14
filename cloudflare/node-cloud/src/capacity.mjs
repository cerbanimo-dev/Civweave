export const HOST_CAPACITY_SCHEMA = 'civweave.host-capacity.v2';
export const HOST_ECONOMY_SCHEMA = 'civweave.host-economy.v2';

export const HOST_ECONOMY_POLICY = Object.freeze({
  maxHostNodes: 3,
  starterCommunitySeats: 10,
  maxCommunitySeats: 16,
  maxMembers: 28,
  membershipUnitCents: 500,
  freeSeatsPerMembershipUnit: 2,
  communityBonusNeuronsPerMembershipUnit: 200,
  cloudflareFreeNeuronsPerDay: 10_000,
  baseIncludedDailyNeurons: 900,
  survivalFloorNeuronsPerDay: 25,
  burstReserveBps: 1_000,
  operatingRunwayDays: 30,
  endowmentRunwayDays: 180,
  communityTopupRunwayDays: 30,
  creditSpendRunwayDays: 30,
  endowmentResidualBps: 2_000,
  topupMinSharedBps: 100,
  topupMaxSharedBps: 500,
  topupDefaultSharedBps: 100,
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
const settlementKey = (kind, sourceId) => `settlement:${clean(kind, 40)}:${clean(sourceId, 240)}`;
const emptyWallet = () => ({ balanceNeurons: 0, issuedNeurons: 0, spentNeurons: 0, debtNeurons: 0 });

const publicMember = member => {
  if (!member || typeof member !== 'object') return member;
  const { loginCredentialHash, ...safe } = member;
  return Object.freeze(safe);
};
const publicCapacity = capacity => {
  if (!capacity || typeof capacity !== 'object') return capacity;
  const { reservesMicrocents, ...safe } = capacity;
  return Object.freeze(safe);
};

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
export function membershipContributionUnits(tierId, policy = HOST_ECONOMY_POLICY) {
  const tier = DEFAULT_MEMBERSHIP_TIERS[clean(tierId, 80).toLowerCase()];
  if (!tier) return 0;
  return Math.max(1, Math.floor(tier.serviceAmountCents / policy.membershipUnitCents));
}
export function normalizeTopupSharing({ shareBps, shareMode } = {}, policy = HOST_ECONOMY_POLICY) {
  const mode = clean(shareMode, 40).toLowerCase() === 'node-equal' ? 'node-equal' : 'personal';
  if (mode === 'node-equal') return Object.freeze({ shareMode: mode, shareBps: 10_000 });
  const raw = shareBps == null || String(shareBps).trim() === '' ? policy.topupDefaultSharedBps : Number(shareBps);
  if (!Number.isSafeInteger(raw) || raw < policy.topupMinSharedBps || raw > policy.topupMaxSharedBps) {
    throw new RangeError(`shareBps must be between ${policy.topupMinSharedBps} and ${policy.topupMaxSharedBps}.`);
  }
  return Object.freeze({ shareMode: mode, shareBps: raw });
}

export function deriveCapacity({
  workersPlan = 'free',
  memberCount = 0,
  communityMemberCount = 0,
  paidExpansionCount = 0,
  activePaidUnits = 0,
  operatingReserveMicrocents = 0,
  communityEndowmentMicrocents = 0,
  communityTopupReserveMicrocents = 0,
  creditReserveMicrocents = 0,
  dailyUsedNeurons = 0,
} = {}, policy = HOST_ECONOMY_POLICY) {
  const paidPlan = String(workersPlan).toLowerCase() === 'paid';
  const paidUnits = Math.max(0, whole(activePaidUnits, 'activePaidUnits'));
  const operatingDaily = paidPlan ? Math.floor(microcentsToNeurons(operatingReserveMicrocents, policy) / policy.operatingRunwayDays) : 0;
  const endowmentDaily = paidPlan ? Math.floor(microcentsToNeurons(communityEndowmentMicrocents, policy) / policy.endowmentRunwayDays) : 0;
  const communityTopupDaily = paidPlan ? Math.floor(microcentsToNeurons(communityTopupReserveMicrocents, policy) / policy.communityTopupRunwayDays) : 0;
  const creditDaily = paidPlan ? Math.floor(microcentsToNeurons(creditReserveMicrocents, policy) / policy.creditSpendRunwayDays) : 0;

  const sharedDailyCeilingNeurons = policy.cloudflareFreeNeuronsPerDay + operatingDaily + endowmentDaily + communityTopupDaily;
  const dailyCeilingNeurons = sharedDailyCeilingNeurons + creditDaily;
  const includedPoolNeurons = Math.floor(sharedDailyCeilingNeurons * (10_000 - policy.burstReserveBps) / 10_000);
  const targetBonusNeuronsPerMember = paidUnits * policy.communityBonusNeuronsPerMembershipUnit;
  const targetIncludedDailyNeurons = policy.baseIncludedDailyNeurons + targetBonusNeuronsPerMember;
  const fundedPerMember = memberCount > 0 ? Math.floor(includedPoolNeurons / memberCount) : targetIncludedDailyNeurons;
  const includedDailyNeurons = memberCount > 0
    ? clamp(Math.min(targetIncludedDailyNeurons, fundedPerMember), policy.survivalFloorNeuronsPerDay, targetIncludedDailyNeurons)
    : policy.baseIncludedDailyNeurons;

  const communitySeatBoost = Math.min(
    policy.maxCommunitySeats - policy.starterCommunitySeats,
    paidUnits * policy.freeSeatsPerMembershipUnit,
  );
  const communitySeatLimit = policy.starterCommunitySeats + Math.max(0, communitySeatBoost);
  const communityOverCapacity = Math.max(0, communityMemberCount - communitySeatLimit);
  const memberOverCapacity = Math.max(0, memberCount - policy.maxMembers);
  const fundedBonusNeuronsPerMember = Math.max(0, includedDailyNeurons - policy.baseIncludedDailyNeurons);

  return Object.freeze({
    schema: HOST_CAPACITY_SCHEMA,
    workersPlan: paidPlan ? 'paid' : 'free',
    memberCount,
    communityMemberCount,
    paidExpansionCount,
    activePaidUnits: paidUnits,
    dailyCeilingNeurons,
    sharedDailyCeilingNeurons,
    dailyUsedNeurons,
    dailyRemainingNeurons: Math.max(0, dailyCeilingNeurons - Number(dailyUsedNeurons || 0)),
    includedPoolNeurons,
    includedDailyNeurons,
    targetIncludedDailyNeurons,
    burstReserveNeurons: Math.max(0, sharedDailyCeilingNeurons - includedDailyNeurons * memberCount),
    communitySeatLimit,
    starterCommunityLimit: policy.starterCommunitySeats,
    maxCommunitySeats: policy.maxCommunitySeats,
    maxMembers: policy.maxMembers,
    totalSeatsRemaining: Math.max(0, policy.maxMembers - memberCount),
    paidExpansionSeatLimit: policy.maxMembers,
    paidExpansionSeatsRemaining: Math.max(0, policy.maxMembers - memberCount),
    communityOverCapacity,
    memberOverCapacity,
    grandfatheredOverCapacity: communityOverCapacity > 0 || memberOverCapacity > 0,
    fundedOverageNeuronsPerDay: Math.max(0, dailyCeilingNeurons - policy.cloudflareFreeNeuronsPerDay),
    communityDividend: Object.freeze({
      contributionUnits: paidUnits,
      communitySeatBoost,
      targetBonusNeuronsPerMember,
      fundedBonusNeuronsPerMember,
      targetIncludedDailyNeurons,
      fundedIncludedDailyNeurons: includedDailyNeurons,
      cappedByFunding: includedDailyNeurons < targetIncludedDailyNeurons,
    }),
    reserves: Object.freeze({ operatingDailyNeurons: operatingDaily, endowmentDailyNeurons: endowmentDaily, communityTopupDailyNeurons: communityTopupDaily, creditDailyNeurons: creditDaily }),
  });
}

export function admissionDecision({ seatClass, billingStatus = 'free', capacity } = {}, policy = HOST_ECONOMY_POLICY) {
  const seat = clean(seatClass).toLowerCase();
  const billing = clean(billingStatus).toLowerCase();
  if (!['community', 'paid-expansion'].includes(seat)) return Object.freeze({ allowed: false, reason: 'invalid-seat-class' });
  if (capacity.memberCount >= policy.maxMembers) return Object.freeze({ allowed: false, reason: 'instance-capacity-full' });
  if (seat === 'community') {
    if (capacity.communityMemberCount >= capacity.communitySeatLimit) return Object.freeze({ allowed: false, reason: 'community-capacity-full' });
    return Object.freeze({ allowed: true, reason: 'community-capacity-available' });
  }
  if (billing !== 'paid') return Object.freeze({ allowed: false, reason: 'paid-expansion-requires-active-membership' });
  return Object.freeze({ allowed: true, reason: 'paid-expansion-capacity-available' });
}

function initialConfig(workersPlan = 'free') {
  return {
    schema: HOST_CAPACITY_SCHEMA,
    workersPlan: String(workersPlan).toLowerCase() === 'paid' ? 'paid' : 'free',
    hostNodeIds: [],
    operatingReserveMicrocents: 0,
    communityEndowmentMicrocents: 0,
    communityTopupReserveMicrocents: 0,
    creditReserveMicrocents: 0,
    updatedAt: new Date().toISOString(),
  };
}

export class CivweaveCapacityAccount {
  constructor(state, env) { this.state = state; this.env = env; }
  async config() {
    const stored = (await this.state.storage.get('config')) || initialConfig(this.env.CIVWEAVE_WORKERS_PLAN || 'free');
    return { ...initialConfig(stored.workersPlan), ...stored, communityTopupReserveMicrocents: Number(stored.communityTopupReserveMicrocents || 0) };
  }
  async putConfig(config) { const next = { ...config, schema: HOST_CAPACITY_SCHEMA, updatedAt: new Date().toISOString() }; await this.state.storage.put('config', next); return next; }
  async members() { const rows = await this.state.storage.list({ prefix: 'member:' }); return [...rows.values()]; }
  async dailyTotal(now = Date.now()) { return Number(await this.state.storage.get(`daily-total:${dayKey(now)}`) || 0); }
  async member(nodeId, userId) { return this.state.storage.get(memberKey(nodeId, userId)); }
  async wallet(nodeId, userId) { return { ...emptyWallet(), ...((await this.state.storage.get(walletKey(nodeId, userId))) || {}) }; }

  async memberStatus(input) {
    const nodeId = clean(input.nodeId), userId = clean(input.userId);
    if (!nodeId || !userId) throw Object.assign(new TypeError('nodeId and userId are required.'), { status: 400 });
    const member = await this.member(nodeId, userId);
    if (!member) throw Object.assign(new RangeError('Member is not admitted to this node.'), { status: 404 });
    const now = Date.now(), day = dayKey(now);
    const [capacity, wallet, usedNeuronsToday] = await Promise.all([
      this.snapshot(nodeId),
      this.wallet(nodeId, userId),
      this.state.storage.get(usageKey(day, nodeId, userId)).then(value => Number(value || 0)),
    ]);
    const includedUsedNeurons = Math.min(capacity.includedDailyNeurons, Math.max(0, usedNeuronsToday));
    const includedRemainingNeurons = Math.max(0, capacity.includedDailyNeurons - includedUsedNeurons);
    const lifetimeRemainingNeurons = wallet.debtNeurons > 0 ? 0 : Math.max(0, wallet.balanceNeurons);
    const reset = new Date(now); reset.setUTCHours(24, 0, 0, 0);
    return Object.freeze({
      schema: 'civweave.host-member-status.v2',
      member: publicMember(member),
      capacity: publicCapacity(capacity),
      quota: Object.freeze({
        usedNeuronsToday: Math.max(0, usedNeuronsToday),
        includedDailyNeurons: capacity.includedDailyNeurons,
        includedUsedNeurons,
        includedRemainingNeurons,
        targetIncludedDailyNeurons: capacity.targetIncludedDailyNeurons,
        communityBonusNeurons: capacity.communityDividend.fundedBonusNeuronsPerMember,
        targetCommunityBonusNeurons: capacity.communityDividend.targetBonusNeuronsPerMember,
        lifetimeRemainingNeurons,
        totalRemainingNeurons: includedRemainingNeurons + lifetimeRemainingNeurons,
        debtNeurons: Math.max(0, wallet.debtNeurons),
        resetsAt: reset.toISOString(),
      }),
    });
  }

  async snapshot(nodeId = '') {
    const [config, members, dailyUsedNeurons] = await Promise.all([this.config(), this.members(), this.dailyTotal()]);
    const community = members.filter(item => item.seatClass === 'community');
    const expansion = members.filter(item => item.seatClass === 'paid-expansion');
    const activePaidUnits = members
      .filter(item => item.billingStatus === 'paid')
      .reduce((sum, item) => sum + membershipContributionUnits(item.membershipTierId), 0);
    const capacity = deriveCapacity({
      workersPlan: config.workersPlan,
      memberCount: members.length,
      communityMemberCount: community.length,
      paidExpansionCount: expansion.length,
      activePaidUnits,
      operatingReserveMicrocents: config.operatingReserveMicrocents,
      communityEndowmentMicrocents: config.communityEndowmentMicrocents,
      communityTopupReserveMicrocents: config.communityTopupReserveMicrocents,
      creditReserveMicrocents: config.creditReserveMicrocents,
      dailyUsedNeurons,
    });
    const node = clean(nodeId), nodeMembers = node ? members.filter(item => item.nodeId === node) : [];
    return Object.freeze({
      ...capacity,
      hostNodeIds: [...config.hostNodeIds],
      nodeId: node || null,
      nodeMembers: nodeMembers.length,
      nodeCommunityMembers: nodeMembers.filter(item => item.seatClass === 'community').length,
      activePaidMembers: members.filter(item => item.billingStatus === 'paid').length,
      graceMembers: members.filter(item => item.billingStatus === 'grace').length,
      reservesMicrocents: Object.freeze({
        operating: config.operatingReserveMicrocents,
        communityEndowment: config.communityEndowmentMicrocents,
        communityTopup: config.communityTopupReserveMicrocents,
        lifetimeCredits: config.creditReserveMicrocents,
      }),
    });
  }

  async registerNode(nodeId) {
    const id = clean(nodeId); if (!id) throw Object.assign(new TypeError('nodeId is required.'), { status: 400 });
    const config = await this.config();
    if (config.hostNodeIds.includes(id)) return this.snapshot(id);
    if (config.hostNodeIds.length >= HOST_ECONOMY_POLICY.maxHostNodes) throw Object.assign(new RangeError('This account already has its three host nodes.'), { status: 409 });
    config.hostNodeIds = [...config.hostNodeIds, id]; await this.putConfig(config); return this.snapshot(id);
  }

  async admitMember(input) {
    const nodeId = clean(input.nodeId), userId = clean(input.userId); if (!nodeId || !userId) throw Object.assign(new TypeError('nodeId and userId are required.'), { status: 400 });
    const config = await this.config(); if (!config.hostNodeIds.includes(nodeId)) throw Object.assign(new RangeError('Node is not registered to this capacity account.'), { status: 404 });
    const key = memberKey(nodeId, userId), prior = await this.state.storage.get(key);
    if (prior) {
      const suppliedHash = clean(input.loginCredentialHash, 128);
      if (prior.loginCredentialHash && suppliedHash && suppliedHash !== prior.loginCredentialHash) throw Object.assign(new Error('Host login credential is invalid.'), { status: 401 });
      const next = !prior.loginCredentialHash && suppliedHash ? Object.freeze({ ...prior, loginCredentialHash: suppliedHash, updatedAt: new Date().toISOString() }) : prior;
      if (next !== prior) await this.state.storage.put(key, next);
      return { member: publicMember(next), capacity: await this.snapshot(nodeId), idempotent: true };
    }
    const capacity = await this.snapshot(nodeId);
    const decision = admissionDecision({ seatClass: input.seatClass, billingStatus: input.billingStatus, capacity });
    if (!decision.allowed) throw Object.assign(new RangeError(decision.reason), { status: 409 });
    const at = new Date().toISOString();
    const member = Object.freeze({
      schema: 'civweave.host-member.v2',
      nodeId,
      userId,
      seatClass: clean(input.seatClass).toLowerCase(),
      billingStatus: clean(input.billingStatus || 'free').toLowerCase() === 'paid' ? 'paid' : 'free',
      membershipTierId: clean(input.membershipTierId) || null,
      loginCredentialHash: clean(input.loginCredentialHash, 128) || null,
      admittedAt: at,
      updatedAt: at,
    });
    await this.state.storage.put(key, member); return { member: publicMember(member), capacity: await this.snapshot(nodeId), idempotent: false };
  }

  async setBilling(input) {
    const nodeId = clean(input.nodeId), userId = clean(input.userId), key = memberKey(nodeId, userId), prior = await this.state.storage.get(key);
    if (!prior) throw Object.assign(new RangeError('Member is not admitted to this node.'), { status: 404 });
    const requested = clean(input.billingStatus).toLowerCase();
    const billingStatus = requested === 'paid' ? 'paid' : requested === 'grace' ? 'grace' : 'free';
    const seatClass = billingStatus === 'paid' || billingStatus === 'grace' ? 'paid-expansion' : 'community';
    const next = Object.freeze({
      ...prior,
      seatClass,
      billingStatus,
      membershipTierId: billingStatus === 'paid' ? clean(input.membershipTierId) || prior.membershipTierId : null,
      updatedAt: new Date().toISOString(),
    });
    await this.state.storage.put(key, next);
    return { member: publicMember(next), capacity: await this.snapshot(nodeId) };
  }

  async settleMembership(input) {
    const nodeId = clean(input.nodeId), userId = clean(input.userId), tierId = clean(input.tierId).toLowerCase(), sourceId = clean(input.sourceId, 240);
    if (!await this.member(nodeId, userId)) throw Object.assign(new RangeError('Member is not admitted to this node.'), { status: 404 });
    if (sourceId) { const prior = await this.state.storage.get(settlementKey('membership', sourceId)); if (prior) return { ...prior, idempotent: true }; }
    const tier = DEFAULT_MEMBERSHIP_TIERS[tierId]; if (!tier) throw Object.assign(new RangeError('Unknown membership tier.'), { status: 400 });
    const split = splitMembershipNetCents(whole(input.netServiceCents ?? tier.serviceAmountCents, 'netServiceCents', 1));
    const requestedCredits = whole(input.monthlyLifetimeCredits ?? tier.monthlyLifetimeCredits, 'monthlyLifetimeCredits');
    const creditBacking = neuronsToMicrocents(requestedCredits), systemMicrocents = centsToMicrocents(split.systemCents);
    if (creditBacking > systemMicrocents) throw Object.assign(new RangeError('Membership lifetime-credit grant exceeds its system-cost backing.'), { status: 409 });
    const residual = systemMicrocents - creditBacking;
    const endowment = Math.floor(residual * HOST_ECONOMY_POLICY.endowmentResidualBps / 10_000), operating = residual - endowment;
    const config = await this.config();
    config.creditReserveMicrocents += creditBacking;
    config.communityEndowmentMicrocents += endowment;
    config.operatingReserveMicrocents += operating;
    await this.putConfig(config);
    const key = walletKey(nodeId, userId), wallet = await this.wallet(nodeId, userId), nextWallet = { ...wallet, balanceNeurons: wallet.balanceNeurons + requestedCredits, issuedNeurons: wallet.issuedNeurons + requestedCredits, updatedAt: new Date().toISOString() };
    await this.state.storage.put(key, nextWallet);
    await this.setBilling({ nodeId, userId, billingStatus: 'paid', membershipTierId: tierId });
    const result = {
      schema: HOST_ECONOMY_SCHEMA,
      kind: 'membership',
      sourceId: sourceId || null,
      split,
      contributionUnits: membershipContributionUnits(tierId),
      freeSeatsCreated: membershipContributionUnits(tierId) * HOST_ECONOMY_POLICY.freeSeatsPerMembershipUnit,
      targetCommunityBonusNeurons: membershipContributionUnits(tierId) * HOST_ECONOMY_POLICY.communityBonusNeuronsPerMembershipUnit,
      lifetimeCreditsAdded: requestedCredits,
      reservesAddedMicrocents: { lifetimeCredits: creditBacking, operating, communityEndowment: endowment },
      wallet: nextWallet,
      capacity: await this.snapshot(nodeId),
      idempotent: false,
    };
    if (sourceId) await this.state.storage.put(settlementKey('membership', sourceId), result); return result;
  }

  async settleTopup(input) {
    const nodeId = clean(input.nodeId), userId = clean(input.userId), sourceId = clean(input.sourceId, 240);
    if (!await this.member(nodeId, userId)) throw Object.assign(new RangeError('Member is not admitted to this node.'), { status: 404 });
    if (sourceId) { const prior = await this.state.storage.get(settlementKey('topup', sourceId)); if (prior) return { ...prior, idempotent: true }; }
    const netServiceCents = whole(input.netServiceCents, 'netServiceCents', 1);
    const split = splitTopupNetCents(netServiceCents);
    const sharing = normalizeTopupSharing({ shareBps: input.shareBps, shareMode: input.shareMode });
    const sharedCents = sharing.shareMode === 'node-equal'
      ? split.systemCents
      : Math.min(split.systemCents, Math.floor(netServiceCents * sharing.shareBps / 10_000));
    const personalCreditCents = Math.max(0, split.systemCents - sharedCents);
    const creditBacking = centsToMicrocents(personalCreditCents), communityBacking = centsToMicrocents(sharedCents);
    const credits = microcentsToNeurons(creditBacking);
    const config = await this.config();
    config.creditReserveMicrocents += creditBacking;
    config.communityTopupReserveMicrocents += communityBacking;
    await this.putConfig(config);
    const key = walletKey(nodeId, userId), wallet = await this.wallet(nodeId, userId), nextWallet = { ...wallet, balanceNeurons: wallet.balanceNeurons + credits, issuedNeurons: wallet.issuedNeurons + credits, updatedAt: new Date().toISOString() };
    await this.state.storage.put(key, nextWallet);
    const result = {
      schema: HOST_ECONOMY_SCHEMA,
      kind: 'topup',
      sourceId: sourceId || null,
      split,
      sharing: { ...sharing, communitySharedCents: sharedCents, personalCreditCents },
      lifetimeCreditsAdded: credits,
      wallet: nextWallet,
      capacity: await this.snapshot(nodeId),
      idempotent: false,
    };
    if (sourceId) await this.state.storage.put(settlementKey('topup', sourceId), result); return result;
  }

  async adjustTopup(input) {
    const nodeId = clean(input.nodeId), userId = clean(input.userId), sourceId = clean(input.sourceId, 240), kind = clean(input.kind || 'refund', 40);
    if (!sourceId) throw Object.assign(new TypeError('sourceId is required for a top-up adjustment.'), { status: 400 });
    const idempotency = settlementKey(`topup-${kind}`, sourceId), prior = await this.state.storage.get(idempotency); if (prior) return { ...prior, idempotent: true };
    const personalCreditCents = whole(input.personalCreditCents ?? input.userCreditCents ?? input.amountCents ?? 0, 'personalCreditCents');
    const communitySharedCents = whole(input.communitySharedCents ?? 0, 'communitySharedCents');
    if (personalCreditCents < 1 && communitySharedCents < 1) throw Object.assign(new RangeError('Top-up adjustment has no backed compute to reverse.'), { status: 400 });
    const debitNeurons = microcentsToNeurons(centsToMicrocents(personalCreditCents));
    const key = walletKey(nodeId, userId), wallet = await this.wallet(nodeId, userId), recoveredNeurons = Math.min(wallet.balanceNeurons, debitNeurons), debtAddedNeurons = debitNeurons - recoveredNeurons;
    const nextWallet = { ...wallet, balanceNeurons: wallet.balanceNeurons - recoveredNeurons, debtNeurons: wallet.debtNeurons + debtAddedNeurons, updatedAt: new Date().toISOString() };
    await this.state.storage.put(key, nextWallet);
    const config = await this.config();
    const personalBacking = centsToMicrocents(personalCreditCents), communityBacking = centsToMicrocents(communitySharedCents);
    const creditReserveRemoved = Math.min(config.creditReserveMicrocents, personalBacking);
    const communityReserveRemoved = Math.min(config.communityTopupReserveMicrocents, communityBacking);
    config.creditReserveMicrocents -= creditReserveRemoved;
    config.communityTopupReserveMicrocents -= communityReserveRemoved;
    await this.putConfig(config);
    const result = {
      schema: HOST_ECONOMY_SCHEMA,
      kind: `topup-${kind}`,
      sourceId,
      personalCreditCents,
      communitySharedCents,
      lifetimeCreditsRemoved: recoveredNeurons,
      debtAddedNeurons,
      unbackedAdjustmentMicrocents: Math.max(0, personalBacking - creditReserveRemoved) + Math.max(0, communityBacking - communityReserveRemoved),
      wallet: nextWallet,
      capacity: await this.snapshot(nodeId),
      idempotent: false,
    };
    await this.state.storage.put(idempotency, result); return result;
  }

  async reserveUsage(input) {
    const nodeId = clean(input.nodeId), userId = clean(input.userId), requested = whole(input.requestedNeurons, 'requestedNeurons', 1), member = await this.member(nodeId, userId);
    if (!member) throw Object.assign(new RangeError('Member is not admitted to this node.'), { status: 404 });
    const now = Date.now(), day = dayKey(now), capacity = await this.snapshot(nodeId);
    if (capacity.dailyUsedNeurons + requested > capacity.dailyCeilingNeurons) throw Object.assign(new RangeError('Account daily funded compute ceiling reached.'), { status: 429 });
    const userUsageStorageKey = usageKey(day, nodeId, userId), userUsed = Number(await this.state.storage.get(userUsageStorageKey) || 0), includedRemaining = Math.max(0, capacity.includedDailyNeurons - userUsed), fromIncluded = Math.min(requested, includedRemaining), fromLifetime = requested - fromIncluded;
    if (fromLifetime > 0 && input.allowLifetimeCredits !== true) throw Object.assign(new RangeError('Request exceeds today\'s included compute; explicit lifetime-credit permission is required.'), { status: 402 });
    const creditsKey = walletKey(nodeId, userId), wallet = await this.wallet(nodeId, userId);
    if (wallet.debtNeurons > 0) throw Object.assign(new RangeError('Lifetime compute wallet has an outstanding refunded/chargeback debt.'), { status: 402 });
    if (fromLifetime > wallet.balanceNeurons) throw Object.assign(new RangeError('Insufficient lifetime compute credits.'), { status: 402 });
    const reservationId = `compute:${crypto.randomUUID()}`;
    await this.state.storage.put(userUsageStorageKey, userUsed + requested);
    await this.state.storage.put(`daily-total:${day}`, capacity.dailyUsedNeurons + requested);
    if (fromLifetime) await this.state.storage.put(creditsKey, { ...wallet, balanceNeurons: wallet.balanceNeurons - fromLifetime, spentNeurons: wallet.spentNeurons + fromLifetime, updatedAt: new Date().toISOString() });
    const reservation = Object.freeze({ schema: 'civweave.compute-reservation.v2', reservationId, nodeId, userId, day, requestedNeurons: requested, fromIncludedNeurons: fromIncluded, fromLifetimeNeurons: fromLifetime, createdAt: new Date().toISOString() });
    await this.state.storage.put(reservationKey(reservationId), reservation); return { reservation, capacity: await this.snapshot(nodeId) };
  }

  async settleUsage(input) {
    const id = clean(input.reservationId, 240), actual = whole(input.actualNeurons, 'actualNeurons'), key = reservationKey(id), reservation = await this.state.storage.get(key);
    if (!reservation) throw Object.assign(new RangeError('Unknown compute reservation.'), { status: 404 });
    if (actual > reservation.requestedNeurons) throw Object.assign(new RangeError('actualNeurons cannot exceed the reservation.'), { status: 409 });
    const refund = reservation.requestedNeurons - actual, refundLifetime = Math.min(refund, reservation.fromLifetimeNeurons), refundIncluded = refund - refundLifetime;
    const userUsageStorageKey = usageKey(reservation.day, reservation.nodeId, reservation.userId), currentUserUsed = Number(await this.state.storage.get(userUsageStorageKey) || 0), currentTotal = Number(await this.state.storage.get(`daily-total:${reservation.day}`) || 0);
    await this.state.storage.put(userUsageStorageKey, Math.max(0, currentUserUsed - refund));
    await this.state.storage.put(`daily-total:${reservation.day}`, Math.max(0, currentTotal - refund));
    if (refundLifetime) {
      const creditsKey = walletKey(reservation.nodeId, reservation.userId), wallet = await this.wallet(reservation.nodeId, reservation.userId);
      await this.state.storage.put(creditsKey, { ...wallet, balanceNeurons: wallet.balanceNeurons + refundLifetime, spentNeurons: Math.max(0, wallet.spentNeurons - refundLifetime), updatedAt: new Date().toISOString() });
    }
    const priorSettled = Math.max(0, currentTotal - reservation.requestedNeurons);
    const freeRemainingAtStart = Math.max(0, HOST_ECONOMY_POLICY.cloudflareFreeNeuronsPerDay - priorSettled);
    const paidActual = Math.max(0, actual - freeRemainingAtStart);
    if (paidActual > 0) {
      const config = await this.config(), lifetimeActual = Math.max(0, reservation.fromLifetimeNeurons - refundLifetime), includedPaidActual = Math.max(0, paidActual - lifetimeActual), creditCost = neuronsToMicrocents(Math.min(paidActual, lifetimeActual)), includedCost = neuronsToMicrocents(includedPaidActual);
      if (creditCost > config.creditReserveMicrocents) throw Object.assign(new RangeError('Lifetime-credit cash reserve is insufficient.'), { status: 503 });
      config.creditReserveMicrocents -= creditCost;
      let remainingIncludedCost = includedCost;
      const operatingDebit = Math.min(config.operatingReserveMicrocents, remainingIncludedCost); config.operatingReserveMicrocents -= operatingDebit; remainingIncludedCost -= operatingDebit;
      const communityTopupDebit = Math.min(config.communityTopupReserveMicrocents, remainingIncludedCost); config.communityTopupReserveMicrocents -= communityTopupDebit; remainingIncludedCost -= communityTopupDebit;
      const endowmentDebit = Math.min(config.communityEndowmentMicrocents, remainingIncludedCost); config.communityEndowmentMicrocents -= endowmentDebit; remainingIncludedCost -= endowmentDebit;
      if (remainingIncludedCost > 0) throw Object.assign(new RangeError('Community compute reserve is insufficient for settled overage.'), { status: 503 });
      await this.putConfig(config);
    }
    await this.state.storage.delete(key);
    return { schema: 'civweave.compute-settlement.v2', reservationId: id, requestedNeurons: reservation.requestedNeurons, actualNeurons: actual, refundedNeurons: refund, refundedIncludedNeurons: refundIncluded, refundedLifetimeNeurons: refundLifetime, capacity: await this.snapshot(reservation.nodeId) };
  }

  async fetch(request) {
    const url = new URL(request.url), input = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    try {
      if (request.method === 'GET' && url.pathname === '/snapshot') return Response.json(await this.snapshot(url.searchParams.get('nodeId') || ''));
      if (request.method === 'POST' && url.pathname === '/configure') { const config = await this.config(); config.workersPlan = clean(input.workersPlan).toLowerCase() === 'paid' ? 'paid' : 'free'; await this.putConfig(config); return Response.json(await this.snapshot(input.nodeId || '')); }
      if (request.method === 'POST' && url.pathname === '/nodes/register') return Response.json(await this.registerNode(input.nodeId));
      if (request.method === 'POST' && url.pathname === '/members/admit') return Response.json(await this.admitMember(input));
      if (request.method === 'POST' && url.pathname === '/members/status') return Response.json(await this.memberStatus(input));
      if (request.method === 'POST' && url.pathname === '/members/billing') return Response.json(await this.setBilling(input));
      if (request.method === 'POST' && url.pathname === '/settlements/membership') return Response.json(await this.settleMembership(input));
      if (request.method === 'POST' && url.pathname === '/settlements/topup') return Response.json(await this.settleTopup(input));
      if (request.method === 'POST' && url.pathname === '/settlements/topup-adjustment') return Response.json(await this.adjustTopup(input));
      if (request.method === 'POST' && url.pathname === '/usage/reserve') return Response.json(await this.reserveUsage(input));
      if (request.method === 'POST' && url.pathname === '/usage/settle') return Response.json(await this.settleUsage(input));
      return Response.json({ ok: false, error: 'not-found' }, { status: 404 });
    } catch (error) { return Response.json({ ok: false, error: String(error?.message || error) }, { status: Number.isSafeInteger(error?.status) ? error.status : 500 }); }
  }
}
