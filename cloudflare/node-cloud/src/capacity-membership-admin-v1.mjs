import { CivweaveCapacityAccount as BaseCapacityAccount } from './capacity-hosting-plan-v1.mjs';

const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const memberKey = (nodeId, userId) => `member:${clean(nodeId, 180)}:${clean(userId, 180)}`;
const removedKey = (nodeId, userId) => `removed-member:${clean(nodeId, 180)}:${clean(userId, 180)}`;
const blockKey = (nodeId, userId) => `blocked-member:${clean(nodeId, 180)}:${clean(userId, 180)}`;
const pendingKey = (nodeId, userId) => `pending-paid:${clean(nodeId, 180)}:${clean(userId, 180)}`;

function publicMember(member) {
  if (!member || typeof member !== 'object') return member;
  const { loginCredentialHash, ...safe } = member;
  return Object.freeze(safe);
}
function requiredIdentity(input = {}) {
  const nodeId = clean(input.nodeId, 180), userId = clean(input.userId, 180);
  if (!nodeId || !userId) throw Object.assign(new TypeError('nodeId and userId are required.'), { status: 400 });
  return { nodeId, userId };
}

export class CivweaveCapacityAccount extends BaseCapacityAccount {
  async isBlocked(nodeId, userId) {
    return Boolean(await this.state.storage.get(blockKey(nodeId, userId)));
  }
  async admitMember(input = {}) {
    const { nodeId, userId } = requiredIdentity(input);
    if (await this.isBlocked(nodeId, userId)) throw Object.assign(new Error('This account has been blocked from rejoining this Hub.'), { status: 403, code: 'hub-member-blocked' });
    return super.admitMember(input);
  }
  async annotateMember(input = {}) {
    const { nodeId, userId } = requiredIdentity(input), key = memberKey(nodeId, userId);
    const prior = await this.state.storage.get(key);
    if (!prior) throw Object.assign(new RangeError('Member is not admitted to this node.'), { status: 404 });
    const next = Object.freeze({
      ...prior,
      accountId: clean(input.accountId, 180) || prior.accountId || null,
      accountName: clean(input.accountName, 64) || prior.accountName || null,
      passportIds: Array.isArray(input.passportIds) ? Object.freeze(input.passportIds.map(value => clean(value, 180)).filter(Boolean).slice(0, 32)) : prior.passportIds || Object.freeze([]),
      updatedAt: new Date().toISOString(),
    });
    await this.state.storage.put(key, next);
    return Object.freeze({ member: publicMember(next), capacity: await this.snapshot(nodeId) });
  }
  async listMembers(input = {}) {
    const nodeId = clean(input.nodeId, 180);
    if (!nodeId) throw Object.assign(new TypeError('nodeId is required.'), { status: 400 });
    const rows = await this.state.storage.list({ prefix: `member:${nodeId}:` });
    const members = [...rows.values()].map(publicMember).sort((a, b) => String(a.accountName || a.userId).localeCompare(String(b.accountName || b.userId)));
    return Object.freeze({ ok: true, nodeId, members, capacity: await this.snapshot(nodeId) });
  }
  async removeMember(input = {}) {
    const { nodeId, userId } = requiredIdentity(input), key = memberKey(nodeId, userId), prior = await this.state.storage.get(key);
    if (!prior) return Object.freeze({ ok: true, removed: false, idempotent: true, capacity: await this.snapshot(nodeId) });
    const at = new Date().toISOString();
    const record = Object.freeze({
      schema: 'civweave.host-member-removal.v1',
      nodeId,
      userId,
      accountId: prior.accountId || null,
      accountName: prior.accountName || null,
      priorSeatClass: prior.seatClass || null,
      priorBillingStatus: prior.billingStatus || null,
      reason: clean(input.reason, 500) || 'removed-by-host-steward',
      blockRejoin: input.blockRejoin === true,
      removedAt: at,
    });
    await this.state.storage.put(removedKey(nodeId, userId), record);
    if (input.blockRejoin === true) await this.state.storage.put(blockKey(nodeId, userId), Object.freeze({ ...record, schema: 'civweave.host-member-block.v1', blockedAt: at }));
    await this.state.storage.delete(key);
    await this.state.storage.delete(pendingKey(nodeId, userId)).catch(() => {});
    return Object.freeze({
      ok: true,
      removed: true,
      blocked: input.blockRejoin === true,
      member: publicMember(prior),
      billingActionRequired: prior.billingStatus === 'paid' || prior.billingStatus === 'grace',
      walletPreserved: true,
      capacity: await this.snapshot(nodeId),
    });
  }
  async unblockMember(input = {}) {
    const { nodeId, userId } = requiredIdentity(input);
    const prior = await this.state.storage.get(blockKey(nodeId, userId));
    await this.state.storage.delete(blockKey(nodeId, userId));
    return Object.freeze({ ok: true, unblocked: Boolean(prior), nodeId, userId });
  }
  async fetch(request) {
    const url = new URL(request.url), input = request.method === 'POST' ? await request.clone().json().catch(() => ({})) : {};
    try {
      if (request.method === 'POST' && url.pathname === '/members/annotate-account') return Response.json(await this.annotateMember(input));
      if (request.method === 'POST' && url.pathname === '/members/list') return Response.json(await this.listMembers(input));
      if (request.method === 'POST' && url.pathname === '/members/remove') return Response.json(await this.removeMember(input));
      if (request.method === 'POST' && url.pathname === '/members/unblock') return Response.json(await this.unblockMember(input));
    } catch (error) {
      return Response.json({ ok: false, error: String(error?.message || error), ...(error?.code ? { code: error.code } : {}) }, { status: Number.isSafeInteger(error?.status) ? error.status : 500 });
    }
    return super.fetch(request);
  }
}
