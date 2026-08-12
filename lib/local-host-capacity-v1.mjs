import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';

export const LOCAL_HOST_CAPACITY_SCHEMA = 'civweave.local-host-capacity.v1';
export const LOCAL_HOST_MEMBER_SCHEMA = 'civweave.local-host-member.v1';

const DEFAULT_COMMUNITY_SEAT_LIMIT = 6;
const DEFAULT_PAID_EXPANSION_SEAT_LIMIT = 9;
const LOCK_STALE_MS = 15_000;
const LOCK_ATTEMPTS = 80;

const clean = (value, max = 180) => String(value ?? '').trim().slice(0, max);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function configuredWhole(value, fallback, max = 100_000) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 && number <= max ? number : fallback;
}

function validResidentId(value) {
  const id = clean(value, 180);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,179}$/.test(id)) {
    throw Object.assign(new TypeError('residentId must be a stable Civweave identifier.'), { status: 400 });
  }
  return id;
}

function billingStatus(value) {
  const normalized = clean(value, 40).toLowerCase();
  return normalized === 'paid' ? 'paid' : normalized === 'grace' ? 'grace' : normalized === 'ended' ? 'ended' : 'free';
}

function seatClass(value) {
  const normalized = clean(value, 40).toLowerCase();
  if (!['community', 'paid-expansion'].includes(normalized)) {
    throw Object.assign(new RangeError('seatClass must be community or paid-expansion.'), { status: 400 });
  }
  return normalized;
}

function memberCounts(state) {
  const residents = Object.values(state.residents || {}).filter(row => row && row.billingStatus !== 'ended');
  const community = residents.filter(row => row.seatClass === 'community');
  const expansion = residents.filter(row => row.seatClass === 'paid-expansion');
  return {
    residents,
    community,
    expansion,
    activePaid: residents.filter(row => row.billingStatus === 'paid'),
    grace: residents.filter(row => row.billingStatus === 'grace'),
  };
}

async function atomicWrite(file, value) {
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fsp.writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  await fsp.rename(temporary, file);
  await fsp.chmod(file, 0o600).catch(() => {});
}

async function acquireLock(lockFile) {
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
    try {
      const handle = await fsp.open(lockFile, 'wx', 0o600);
      await handle.writeFile(`${process.pid}\n${Date.now()}\n`);
      return async () => {
        await handle.close().catch(() => {});
        await fsp.unlink(lockFile).catch(() => {});
      };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const stat = await fsp.stat(lockFile).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
        await fsp.unlink(lockFile).catch(() => {});
        continue;
      }
      await sleep(Math.min(250, 20 + attempt * 4));
    }
  }
  throw Object.assign(new Error('Local Host Node capacity state is busy. Try again.'), { status: 503 });
}

export function createLocalHostCapacityStore({
  dataDir = process.env.DATA_DIR || './data',
  nodeId = process.env.CIVWEAVE_FEDERATION_NODE_ID || '',
  communitySeatLimit = process.env.CIVWEAVE_COMMUNITY_SEAT_LIMIT,
  paidExpansionSeatLimit = process.env.CIVWEAVE_PAID_EXPANSION_SEAT_LIMIT,
  now = () => Date.now(),
} = {}) {
  const resolvedDir = path.resolve(dataDir);
  const file = path.join(resolvedDir, 'host-capacity-v1.json');
  const lockFile = `${file}.lock`;
  const configuredCommunity = configuredWhole(communitySeatLimit, DEFAULT_COMMUNITY_SEAT_LIMIT);
  const configuredPaid = configuredWhole(paidExpansionSeatLimit, DEFAULT_PAID_EXPANSION_SEAT_LIMIT);
  const canonicalNodeId = clean(nodeId, 180) || 'local-federated-host';

  function emptyState() {
    return {
      schema: LOCAL_HOST_CAPACITY_SCHEMA,
      nodeId: canonicalNodeId,
      communitySeatLimit: configuredCommunity,
      paidExpansionSeatLimit: configuredPaid,
      residents: {},
      createdAt: new Date(now()).toISOString(),
      updatedAt: new Date(now()).toISOString(),
    };
  }

  function normalizeState(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Local Host Node capacity state is invalid.');
    if (input.schema !== LOCAL_HOST_CAPACITY_SCHEMA) throw new Error(`Unsupported local Host Node capacity schema: ${input.schema || 'missing'}.`);
    if (!input.residents || typeof input.residents !== 'object' || Array.isArray(input.residents)) throw new Error('Local Host Node resident registry is invalid.');
    return {
      ...input,
      nodeId: canonicalNodeId,
      communitySeatLimit: configuredCommunity,
      paidExpansionSeatLimit: configuredPaid,
      residents: { ...input.residents },
    };
  }

  async function readState() {
    await fsp.mkdir(resolvedDir, { recursive: true });
    try {
      return normalizeState(JSON.parse(await fsp.readFile(file, 'utf8')));
    } catch (error) {
      if (error?.code === 'ENOENT') return emptyState();
      throw error;
    }
  }

  function publicSnapshot(state) {
    const counts = memberCounts(state);
    const freeSlots = Math.max(0, state.communitySeatLimit - counts.community.length);
    const paidSlots = Math.max(0, state.paidExpansionSeatLimit - counts.expansion.length);
    return Object.freeze({
      schema: LOCAL_HOST_CAPACITY_SCHEMA,
      nodeId: state.nodeId,
      capacityAvailable: true,
      limits: Object.freeze({ community: state.communitySeatLimit, paidExpansion: state.paidExpansionSeatLimit }),
      counts: Object.freeze({
        members: counts.residents.length,
        communityMembers: counts.community.length,
        paidExpansionMembers: counts.expansion.length,
        activePaidMembers: counts.activePaid.length,
        graceMembers: counts.grace.length,
        overCapacityPaidExpansion: Math.max(0, counts.expansion.length - state.paidExpansionSeatLimit),
      }),
      slots: Object.freeze({ free: freeSlots, paid: paidSlots }),
      updatedAt: state.updatedAt,
    });
  }

  async function mutate(worker) {
    const release = await acquireLock(lockFile);
    try {
      const state = await readState();
      const result = await worker(state);
      state.communitySeatLimit = configuredCommunity;
      state.paidExpansionSeatLimit = configuredPaid;
      state.nodeId = canonicalNodeId;
      state.updatedAt = new Date(now()).toISOString();
      await atomicWrite(file, state);
      return { ...result, capacity: publicSnapshot(state) };
    } finally {
      await release();
    }
  }

  async function snapshot() {
    return publicSnapshot(await readState());
  }

  async function admit(input = {}) {
    const residentId = validResidentId(input.residentId);
    const requestedSeat = seatClass(input.seatClass || 'community');
    const requestedBilling = billingStatus(input.billingStatus || 'free');
    const userId = clean(input.userId, 180) || null;
    if (requestedSeat === 'paid-expansion' && requestedBilling !== 'paid') {
      throw Object.assign(new RangeError('Paid-expansion admission requires active paid billing.'), { status: 409 });
    }
    return mutate(state => {
      const existingById = state.residents[residentId];
      if (existingById && existingById.billingStatus !== 'ended') {
        if (userId && !existingById.userId) existingById.userId = userId;
        existingById.lastSeenAt = new Date(now()).toISOString();
        existingById.updatedAt = existingById.lastSeenAt;
        return { member: Object.freeze({ ...existingById }), idempotent: true };
      }
      if (userId) {
        const existingByUser = Object.values(state.residents).find(row => row?.userId === userId && row.billingStatus !== 'ended');
        if (existingByUser) {
          existingByUser.lastSeenAt = new Date(now()).toISOString();
          existingByUser.updatedAt = existingByUser.lastSeenAt;
          return { member: Object.freeze({ ...existingByUser }), idempotent: true, matchedByUser: true };
        }
      }
      const counts = memberCounts(state);
      if (requestedSeat === 'community' && counts.community.length >= state.communitySeatLimit) {
        throw Object.assign(new RangeError('community-capacity-full'), { status: 409 });
      }
      if (requestedSeat === 'paid-expansion' && counts.expansion.length >= state.paidExpansionSeatLimit) {
        throw Object.assign(new RangeError('paid-expansion-capacity-full'), { status: 409 });
      }
      const at = new Date(now()).toISOString();
      const member = {
        schema: LOCAL_HOST_MEMBER_SCHEMA,
        residentId,
        userId,
        nodeId: canonicalNodeId,
        seatClass: requestedSeat,
        billingStatus: requestedBilling,
        membershipTierId: requestedBilling === 'paid' ? clean(input.membershipTierId, 80) || null : null,
        admittedAt: at,
        lastSeenAt: at,
        updatedAt: at,
      };
      state.residents[residentId] = member;
      return { member: Object.freeze({ ...member }), idempotent: false };
    });
  }

  async function setBilling(input = {}) {
    const residentId = input.residentId ? validResidentId(input.residentId) : '';
    const userId = clean(input.userId, 180);
    const requested = billingStatus(input.billingStatus);
    return mutate(state => {
      const member = residentId ? state.residents[residentId] : Object.values(state.residents).find(row => row?.userId === userId && row.billingStatus !== 'ended');
      if (!member) throw Object.assign(new RangeError('Host resident was not found.'), { status: 404 });
      member.billingStatus = member.seatClass === 'paid-expansion' && requested === 'free' ? 'grace' : requested;
      member.membershipTierId = member.billingStatus === 'paid' ? clean(input.membershipTierId, 80) || member.membershipTierId || null : null;
      member.updatedAt = new Date(now()).toISOString();
      return { member: Object.freeze({ ...member }) };
    });
  }

  async function applyPaymentEvent(event = {}) {
    const type = clean(event.type, 80);
    if (!['membership.paid', 'membership.ended'].includes(type)) return { skipped: true, reason: 'not-membership-capacity-event', capacity: await snapshot() };
    const userId = clean(event.userId, 180);
    if (!userId) throw Object.assign(new TypeError('Membership payment event userId is required.'), { status: 400 });
    return mutate(state => {
      let member = Object.values(state.residents).find(row => row?.userId === userId && row.billingStatus !== 'ended');
      if (type === 'membership.ended') {
        if (!member) return { skipped: true, reason: 'member-not-admitted' };
        member.billingStatus = member.seatClass === 'paid-expansion' ? 'grace' : 'free';
        member.membershipTierId = null;
        member.lastPaymentEventId = clean(event.id, 240) || null;
        member.updatedAt = new Date(now()).toISOString();
        return { member: Object.freeze({ ...member }), applied: true };
      }
      if (!member) {
        const digest = crypto.createHash('sha256').update(userId).digest('hex').slice(0, 32);
        const residentId = `money:${digest}`;
        const at = new Date(now()).toISOString();
        const counts = memberCounts(state);
        member = {
          schema: LOCAL_HOST_MEMBER_SCHEMA,
          residentId,
          userId,
          nodeId: canonicalNodeId,
          seatClass: 'paid-expansion',
          billingStatus: 'paid',
          membershipTierId: clean(event.tierId, 80) || null,
          admittedAt: at,
          lastSeenAt: at,
          updatedAt: at,
          overCapacity: counts.expansion.length >= state.paidExpansionSeatLimit,
        };
        state.residents[residentId] = member;
      } else {
        member.billingStatus = 'paid';
        member.membershipTierId = clean(event.tierId, 80) || member.membershipTierId || null;
        member.updatedAt = new Date(now()).toISOString();
      }
      member.lastPaymentEventId = clean(event.id, 240) || null;
      return { member: Object.freeze({ ...member }), applied: true };
    });
  }

  return Object.freeze({
    schema: LOCAL_HOST_CAPACITY_SCHEMA,
    file,
    snapshot,
    admit,
    setBilling,
    applyPaymentEvent,
  });
}
