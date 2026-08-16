import baseWorker, {
  CivweaveCloudNode,
  CivweaveCapacityAccount as ProductionCapacityAccount,
  CivweaveAccountDirectory,
} from './server-ai-entry-v6.mjs';

export { CivweaveCloudNode, CivweaveAccountDirectory };

const STAGING_COMMUNITY_SEATS = 4;
const clean = (value, max = 180) => String(value ?? '').trim().slice(0, max);

/**
 * Isolated staging capacity authority.
 *
 * This class runs in the civweave-node-cloud-staging Worker, whose Durable
 * Objects are separate from production. It intentionally exposes only four
 * community seats and no paid-expansion seats so staging can exercise the real
 * Guild server + Workers AI path without touching the production member ledger.
 */
export class CivweaveCapacityAccount extends ProductionCapacityAccount {
  async snapshot(nodeId = '') {
    const base = await super.snapshot(nodeId);
    const memberCount = Math.max(0, Number(base.memberCount || 0));
    const communityMemberCount = Math.max(0, Number(base.communityMemberCount || 0));
    const nodeMembers = Math.max(0, Number(base.nodeMembers || 0));
    const nodeCommunityMembers = Math.max(0, Number(base.nodeCommunityMembers || 0));
    const remaining = Math.max(0, STAGING_COMMUNITY_SEATS - memberCount);
    return Object.freeze({
      ...base,
      environment: 'staging',
      stagingIsolatedGuildServer: true,
      memberCount,
      communityMemberCount,
      nodeMembers,
      nodeCommunityMembers,
      communitySeatLimit: STAGING_COMMUNITY_SEATS,
      starterCommunityLimit: STAGING_COMMUNITY_SEATS,
      maxCommunitySeats: STAGING_COMMUNITY_SEATS,
      maxMembers: STAGING_COMMUNITY_SEATS,
      totalSeatsRemaining: remaining,
      paidExpansionSeatLimit: 0,
      paidExpansionSeatsRemaining: 0,
      communityOverCapacity: Math.max(0, communityMemberCount - STAGING_COMMUNITY_SEATS),
      memberOverCapacity: Math.max(0, memberCount - STAGING_COMMUNITY_SEATS),
      grandfatheredOverCapacity: memberCount > STAGING_COMMUNITY_SEATS,
      stagingSeatLimit: STAGING_COMMUNITY_SEATS,
    });
  }

  async admitMember(input = {}) {
    const nodeId = clean(input.nodeId), userId = clean(input.userId);
    const seatClass = clean(input.seatClass || 'community', 40).toLowerCase();
    if (seatClass !== 'community') {
      throw Object.assign(new RangeError('staging-only-community-seats'), { status: 409 });
    }
    if (nodeId && userId) {
      const prior = await this.member(nodeId, userId);
      if (!prior) {
        const capacity = await this.snapshot(nodeId);
        if (Number(capacity.memberCount || 0) >= STAGING_COMMUNITY_SEATS) {
          throw Object.assign(new RangeError('staging-guild-capacity-full'), { status: 409 });
        }
      }
    }
    return super.admitMember({ ...input, seatClass: 'community', billingStatus: 'free' });
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
