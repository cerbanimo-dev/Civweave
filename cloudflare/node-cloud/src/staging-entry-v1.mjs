import baseWorker, {
  CivweaveCloudNode,
  CivweaveCapacityAccount as ProductionCapacityAccount,
  CivweaveAccountDirectory,
} from './server-ai-entry-v6.mjs';

export { CivweaveCloudNode, CivweaveAccountDirectory };

const STAGING_COMMUNITY_SEATS = 4;
const STAGING_PAID_TEST_SEATS = 4;
const STAGING_MAX_MEMBERS = STAGING_COMMUNITY_SEATS + STAGING_PAID_TEST_SEATS;
const clean = (value, max = 180) => String(value ?? '').trim().slice(0, max);

/**
 * Isolated staging capacity authority.
 *
 * This class runs in the civweave-node-cloud-staging Worker, whose Durable
 * Objects are separate from production. It exposes four community seats plus
 * four test-only paid-expansion seats so Stripe sandbox membership checkout,
 * settlement, and Guildkeeper revenue-share transfers can be exercised without
 * touching the production member ledger or production payment authority.
 */
export class CivweaveCapacityAccount extends ProductionCapacityAccount {
  async snapshot(nodeId = '') {
    const base = await super.snapshot(nodeId);
    const memberCount = Math.max(0, Number(base.memberCount || 0));
    const communityMemberCount = Math.max(0, Number(base.communityMemberCount || 0));
    const nodeMembers = Math.max(0, Number(base.nodeMembers || 0));
    const nodeCommunityMembers = Math.max(0, Number(base.nodeCommunityMembers || 0));
    const paidMembers = Math.max(0, nodeMembers - nodeCommunityMembers);
    const communityRemaining = Math.max(0, STAGING_COMMUNITY_SEATS - nodeCommunityMembers);
    const paidRemaining = Math.max(0, STAGING_PAID_TEST_SEATS - paidMembers);
    return Object.freeze({
      ...base,
      environment: 'staging',
      stagingIsolatedGuildServer: true,
      stagingPaymentMode: 'stripe-sandbox-only',
      memberCount,
      communityMemberCount,
      nodeMembers,
      nodeCommunityMembers,
      communitySeatLimit: STAGING_COMMUNITY_SEATS,
      starterCommunityLimit: STAGING_COMMUNITY_SEATS,
      maxCommunitySeats: STAGING_COMMUNITY_SEATS,
      maxMembers: STAGING_MAX_MEMBERS,
      totalSeatsRemaining: Math.max(0, communityRemaining + paidRemaining),
      paidExpansionSeatLimit: STAGING_PAID_TEST_SEATS,
      paidExpansionSeatsRemaining: paidRemaining,
      communityOverCapacity: Math.max(0, communityMemberCount - STAGING_COMMUNITY_SEATS),
      memberOverCapacity: Math.max(0, memberCount - STAGING_MAX_MEMBERS),
      grandfatheredOverCapacity: memberCount > STAGING_MAX_MEMBERS,
      stagingSeatLimit: STAGING_COMMUNITY_SEATS,
      stagingPaidSeatLimit: STAGING_PAID_TEST_SEATS,
    });
  }

  async admitMember(input = {}) {
    const nodeId = clean(input.nodeId), userId = clean(input.userId);
    const seatClass = clean(input.seatClass || 'community', 40).toLowerCase();
    if (!['community', 'paid-expansion'].includes(seatClass)) {
      throw Object.assign(new RangeError('staging-invalid-seat-class'), { status: 409 });
    }
    if (nodeId && userId) {
      const prior = await this.member(nodeId, userId);
      if (!prior) {
        const capacity = await this.snapshot(nodeId);
        if (seatClass === 'community' && Number(capacity.nodeCommunityMembers || 0) >= STAGING_COMMUNITY_SEATS) {
          throw Object.assign(new RangeError('staging-community-capacity-full'), { status: 409 });
        }
        const paidMembers = Math.max(0, Number(capacity.nodeMembers || 0) - Number(capacity.nodeCommunityMembers || 0));
        if (seatClass === 'paid-expansion' && paidMembers >= STAGING_PAID_TEST_SEATS) {
          throw Object.assign(new RangeError('staging-paid-capacity-full'), { status: 409 });
        }
      }
    }
    if (seatClass === 'paid-expansion' && clean(input.billingStatus, 40).toLowerCase() !== 'paid') {
      throw Object.assign(new RangeError('staging-paid-expansion-requires-paid-membership'), { status: 409 });
    }
    return super.admitMember({ ...input, seatClass });
  }
}

export default {
  async fetch(request, env, ctx) {
    return baseWorker.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    if (typeof baseWorker.scheduled === 'function') return baseWorker.scheduled(controller, env, ctx);
  },
};
