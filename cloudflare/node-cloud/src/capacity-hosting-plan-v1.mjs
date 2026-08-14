import { CivweaveUserPoolCapacityAccount as BaseCapacityAccount } from './capacity-user-pools-v2.mjs';

export const CIVWEAVE_HUB_HOSTING = Object.freeze({
  schema: 'civweave.hub-hosting.v1',
  freeMaxMembers: 28,
  hostedMaxMembers: 400,
  standardMonthlyCents: 500,
  scaleMonthlyCents: 1000,
  scaleThresholdMembers: 200,
});

const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const memberKey = (nodeId, userId) => `member:${clean(nodeId, 180)}:${clean(userId, 180)}`;
const settlementKey = sourceId => `hosting-settlement:${clean(sourceId, 240)}`;
const publicMember = member => {
  if (!member || typeof member !== 'object') return member;
  const { loginCredentialHash, ...safe } = member;
  return Object.freeze(safe);
};

export function hostingPlanActive(config = {}, now = Date.now()) {
  const paidThrough = Date.parse(clean(config.hostingPaidThrough, 80));
  return clean(config.hostingPlan, 40).toLowerCase() === 'hosted' && Number.isFinite(paidThrough) && paidThrough > now;
}

export function hostingBillingBand(memberCount) {
  const count = Math.max(0, Number(memberCount || 0));
  return Object.freeze(count >= CIVWEAVE_HUB_HOSTING.scaleThresholdMembers
    ? { id: 'scale', monthlyCents: CIVWEAVE_HUB_HOSTING.scaleMonthlyCents, minMembers: 200, maxMembers: 400 }
    : { id: 'standard', monthlyCents: CIVWEAVE_HUB_HOSTING.standardMonthlyCents, minMembers: 0, maxMembers: 199 });
}

export class CivweaveCapacityAccount extends BaseCapacityAccount {
  async settleHostingPlan(input = {}) {
    const nodeId = clean(input.nodeId, 180), sourceId = clean(input.sourceId, 240);
    if (!nodeId || !sourceId) throw Object.assign(new TypeError('nodeId and sourceId are required.'), { status: 400 });
    const config = await this.config();
    if (!config.hostNodeIds.includes(nodeId)) throw Object.assign(new RangeError('Node is not registered to this capacity account.'), { status: 404 });
    const prior = await this.state.storage.get(settlementKey(sourceId));
    if (prior) return { ...prior, idempotent: true, capacity: await this.snapshot(nodeId) };
    const paidThroughMs = Date.parse(clean(input.paidThrough, 80));
    if (!Number.isFinite(paidThroughMs) || paidThroughMs <= Date.now()) throw Object.assign(new RangeError('Hosted capacity requires a future paidThrough date.'), { status: 409 });
    const monthlyCents = Number(input.monthlyCents);
    if (![CIVWEAVE_HUB_HOSTING.standardMonthlyCents, CIVWEAVE_HUB_HOSTING.scaleMonthlyCents].includes(monthlyCents)) {
      throw Object.assign(new RangeError('Hosted capacity billing must be $5 or $10 per month.'), { status: 409 });
    }
    const existingPaidThrough = Date.parse(clean(config.hostingPaidThrough, 80));
    const paidThrough = new Date(Math.max(Number.isFinite(existingPaidThrough) ? existingPaidThrough : 0, paidThroughMs)).toISOString();
    config.hostingPlan = 'hosted';
    config.hostingPaidThrough = paidThrough;
    config.hostingMonthlyCents = monthlyCents;
    config.hostingBillingBand = monthlyCents === CIVWEAVE_HUB_HOSTING.scaleMonthlyCents ? 'scale' : 'standard';
    await this.putConfig(config);
    const result = Object.freeze({
      schema: CIVWEAVE_HUB_HOSTING.schema,
      kind: 'hosting-plan-paid',
      sourceId,
      nodeId,
      paidThrough,
      monthlyCents,
      billingBand: config.hostingBillingBand,
      maxMembers: CIVWEAVE_HUB_HOSTING.hostedMaxMembers,
      idempotent: false,
    });
    await this.state.storage.put(settlementKey(sourceId), result);
    return { ...result, capacity: await this.snapshot(nodeId) };
  }

  async snapshot(nodeId = '') {
    const base = await super.snapshot(nodeId);
    const config = await this.config();
    const hosted = hostingPlanActive(config);
    const maxMembers = hosted ? CIVWEAVE_HUB_HOSTING.hostedMaxMembers : CIVWEAVE_HUB_HOSTING.freeMaxMembers;
    const communitySeatLimit = hosted ? maxMembers : base.communitySeatLimit;
    const memberOverCapacity = Math.max(0, Number(base.memberCount || 0) - maxMembers);
    const communityOverCapacity = Math.max(0, Number(base.communityMemberCount || 0) - communitySeatLimit);
    return Object.freeze({
      ...base,
      hosting: Object.freeze({
        schema: CIVWEAVE_HUB_HOSTING.schema,
        plan: hosted ? 'hosted' : 'free',
        active: hosted,
        paidThrough: config.hostingPaidThrough || null,
        currentMonthlyCents: hosted ? Number(config.hostingMonthlyCents || 0) || null : 0,
        currentBillingBand: hosted ? clean(config.hostingBillingBand, 40) || null : 'free',
        nextBillingBand: hosted ? hostingBillingBand(base.memberCount) : null,
        freeMaxMembers: CIVWEAVE_HUB_HOSTING.freeMaxMembers,
        hostedMaxMembers: CIVWEAVE_HUB_HOSTING.hostedMaxMembers,
        scaleThresholdMembers: CIVWEAVE_HUB_HOSTING.scaleThresholdMembers,
      }),
      maxMembers,
      maxCommunitySeats: hosted ? maxMembers : base.maxCommunitySeats,
      communitySeatLimit,
      totalSeatsRemaining: Math.max(0, maxMembers - Number(base.memberCount || 0)),
      paidExpansionSeatLimit: maxMembers,
      paidExpansionSeatsRemaining: Math.max(0, maxMembers - Number(base.memberCount || 0)),
      memberOverCapacity,
      communityOverCapacity,
      grandfatheredOverCapacity: memberOverCapacity > 0 || communityOverCapacity > 0,
    });
  }

  async admitMember(input = {}) {
    const capacity = await this.snapshot(input.nodeId || '');
    if (!capacity.hosting?.active) return super.admitMember(input);
    const nodeId = clean(input.nodeId, 180), userId = clean(input.userId, 180);
    if (!nodeId || !userId) throw Object.assign(new TypeError('nodeId and userId are required.'), { status: 400 });
    const config = await this.config();
    if (!config.hostNodeIds.includes(nodeId)) throw Object.assign(new RangeError('Node is not registered to this capacity account.'), { status: 404 });
    const key = memberKey(nodeId, userId), prior = await this.state.storage.get(key);
    if (prior) {
      const suppliedHash = clean(input.loginCredentialHash, 128);
      if (prior.loginCredentialHash && suppliedHash && suppliedHash !== prior.loginCredentialHash) throw Object.assign(new Error('Host login credential is invalid.'), { status: 401 });
      const next = !prior.loginCredentialHash && suppliedHash ? Object.freeze({ ...prior, loginCredentialHash: suppliedHash, updatedAt: new Date().toISOString() }) : prior;
      if (next !== prior) await this.state.storage.put(key, next);
      return { member: publicMember(next), capacity: await this.snapshot(nodeId), idempotent: true };
    }
    const seatClass = clean(input.seatClass, 40).toLowerCase();
    if (!['community', 'paid-expansion'].includes(seatClass)) throw Object.assign(new RangeError('invalid-seat-class'), { status: 409 });
    const pendingPaidReservations = seatClass === 'community' && typeof this.activePendingPaidCount === 'function' ? await this.activePendingPaidCount() : 0;
    if (capacity.memberCount + pendingPaidReservations >= capacity.maxMembers) throw Object.assign(new RangeError('instance-capacity-full'), { status: 409 });
    const at = new Date().toISOString();
    const member = Object.freeze({
      schema: 'civweave.host-member.v2',
      nodeId,
      userId,
      seatClass,
      billingStatus: clean(input.billingStatus || 'free', 40).toLowerCase() === 'paid' ? 'paid' : 'free',
      membershipTierId: clean(input.membershipTierId, 80) || null,
      loginCredentialHash: clean(input.loginCredentialHash, 128) || null,
      admittedAt: at,
      updatedAt: at,
    });
    await this.state.storage.put(key, member);
    return { member: publicMember(member), capacity: await this.snapshot(nodeId), idempotent: false };
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/settlements/hosting') {
      try { return Response.json(await this.settleHostingPlan(await request.json().catch(() => ({})))); }
      catch (error) { return Response.json({ ok: false, error: String(error?.message || error) }, { status: Number.isSafeInteger(error?.status) ? error.status : 500 }); }
    }
    return super.fetch(request);
  }
}
