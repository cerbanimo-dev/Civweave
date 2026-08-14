import {
  HubAccountRecoveryService,
  HUB_ACCOUNT_RECOVERY_COOLDOWN_MS,
  HUB_ACCOUNT_RECOVERY_TTL_MS,
  HUB_ACCOUNT_VERIFICATION_TTL_MS,
  normalizeEmail,
} from './hub-account-recovery-v1.mjs';

const enc = new TextEncoder();
const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const nowIso = now => new Date(now).toISOString();
const INBOUND_SCHEMA = 'civweave.hub-inbound-email-proof.v1';
const GENERIC_RECOVERY_MESSAGE = 'If that email is a verified recovery method for this Hub, follow the email-proof instructions to continue.';

function b64url(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
function randomToken(bytes = 32) { return b64url(crypto.getRandomValues(new Uint8Array(bytes))); }
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function inboundTokenHash(token) {
  const value = clean(token, 400);
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(value)) throw Object.assign(new TypeError('Email proof is invalid.'), { status: 400 });
  return sha256Hex(`civweave.hub-inbound-email-proof.v1\n${value}`);
}
async function normalizedEmailHash(email) {
  return sha256Hex(`civweave.hub-inbound-email-address.v1\n${normalizeEmail(email)}`);
}
function proofKey(hash) { return `hub-inbound-proof:${clean(hash, 128)}`; }
function validNodeId(value) {
  const nodeId = clean(value, 180).toLowerCase();
  if (!/^[a-z0-9-]{1,120}$/.test(nodeId)) throw Object.assign(new TypeError('Hub node id is invalid.'), { status: 400 });
  return nodeId;
}
function validPurpose(value) {
  const purpose = clean(value, 40);
  if (!['verify-email', 'recover-account'].includes(purpose)) throw Object.assign(new TypeError('Email proof purpose is invalid.'), { status: 400 });
  return purpose;
}
function hasOutbound(env) {
  return Boolean(clean(env?.HUB_RECOVERY_MAILER_URL, 2000) || env?.HUB_RECOVERY_EMAIL?.send);
}

export function parseInboundProofSubject(value) {
  const match = clean(value, 500).match(/^Civweave ([a-z0-9-]{1,120}) (verify-email|recover-account) ([A-Za-z0-9_-]{40,200})$/);
  return match ? Object.freeze({ nodeId: match[1], purpose: match[2], token: match[3] }) : null;
}

export class HubAccountRecoveryInboundService extends HubAccountRecoveryService {
  mailbox() {
    const value = clean(this.env?.HUB_RECOVERY_INBOUND_EMAIL, 320).toLowerCase();
    return value ? normalizeEmail(value) : '';
  }

  async issueInboundProof({ nodeId, purpose, email, userId = null } = {}) {
    const normalizedNodeId = validNodeId(nodeId);
    const normalizedPurpose = validPurpose(purpose);
    const normalizedEmail = normalizeEmail(email);
    const token = randomToken(32);
    const hash = await inboundTokenHash(token);
    const now = this.now();
    const ttl = normalizedPurpose === 'verify-email' ? HUB_ACCOUNT_VERIFICATION_TTL_MS : HUB_ACCOUNT_RECOVERY_TTL_MS;
    const proof = Object.freeze({
      schema: INBOUND_SCHEMA,
      nodeId: normalizedNodeId,
      purpose: normalizedPurpose,
      expectedEmailHash: await normalizedEmailHash(normalizedEmail),
      userId: clean(userId, 180) || null,
      createdAt: nowIso(now),
      expiresAt: nowIso(now + ttl),
      approvedAt: null,
      consumedAt: null,
    });
    await this.state.storage.put(proofKey(hash), proof);
    return { token, proof, delivery: this.inboundDelivery(normalizedNodeId, normalizedPurpose, token) };
  }

  inboundDelivery(nodeId, purpose, token) {
    const mailbox = this.mailbox();
    if (!mailbox) return Object.freeze({ sent: false, transport: 'unconfigured' });
    const subject = `Civweave ${validNodeId(nodeId)} ${validPurpose(purpose)} ${clean(token, 400)}`;
    return Object.freeze({
      sent: false,
      transport: 'inbound-email-proof',
      mailbox,
      subject,
      proofToken: clean(token, 400),
      mailto: `mailto:${mailbox}?subject=${encodeURIComponent(subject)}`,
      pollPath: purpose === 'verify-email' ? '/api/account/verify/poll' : '/api/account/recovery/poll',
    });
  }

  async signup(nodeId, input = {}) {
    const packet = await super.signup(nodeId, input);
    if (packet.account?.emailVerified || packet.delivery?.sent || !this.mailbox()) return packet;
    const account = await this.accountForResident(input.userId);
    const inbound = await this.issueInboundProof({
      nodeId,
      purpose: 'verify-email',
      email: input.email,
      userId: account?.userId || input.userId,
    });
    return Object.freeze({ ...packet, delivery: inbound.delivery });
  }

  async requestRecoveryForNode(nodeId, input = {}) {
    if (hasOutbound(this.env)) return super.requestRecovery(input);
    const email = normalizeEmail(input.email);
    const now = this.now();
    let account = null;
    try { account = await this.accountForEmail(email); } catch { account = null; }
    let userId = null;
    if (account?.emailVerifiedAt) {
      const prior = Date.parse(account.recoveryRequestedAt || 0);
      if (!Number.isFinite(prior) || now - prior >= HUB_ACCOUNT_RECOVERY_COOLDOWN_MS) userId = account.userId;
    }
    const inbound = this.mailbox()
      ? await this.issueInboundProof({ nodeId, purpose: 'recover-account', email, userId })
      : null;
    return Object.freeze({
      ok: true,
      accepted: true,
      message: this.mailbox() ? GENERIC_RECOVERY_MESSAGE : 'If that email is a verified recovery method for this Hub, a one-time recovery code has been sent.',
      delivery: inbound?.delivery || Object.freeze({ sent: false, transport: 'unconfigured' }),
    });
  }

  async approveInboundProof(input = {}) {
    const token = clean(input.token, 400);
    const purpose = validPurpose(input.purpose);
    const nodeId = validNodeId(input.nodeId);
    const from = normalizeEmail(input.from);
    const key = proofKey(await inboundTokenHash(token));
    const proof = await this.state.storage.get(key);
    const now = this.now();
    if (!proof || proof.nodeId !== nodeId || proof.purpose !== purpose || proof.consumedAt || Date.parse(proof.expiresAt) <= now) {
      throw Object.assign(new Error('Email proof is invalid, expired, or already used.'), { status: 400 });
    }
    if (proof.expectedEmailHash !== await normalizedEmailHash(from)) {
      throw Object.assign(new Error('Email proof sender does not match the requested recovery address.'), { status: 403 });
    }
    if (purpose === 'verify-email' && proof.userId) {
      const account = await this.accountForResident(proof.userId);
      if (account && account.email === from && !account.emailVerifiedAt) {
        const challenge = await this.issueChallenge(account, 'verify-email');
        await this.verifyEmail(challenge.token);
      }
    }
    const next = Object.freeze({ ...proof, approvedAt: proof.approvedAt || nowIso(now) });
    await this.state.storage.put(key, next);
    return Object.freeze({ ok: true, accepted: true });
  }

  async pollVerification(nodeId, token) {
    const key = proofKey(await inboundTokenHash(token));
    const proof = await this.state.storage.get(key);
    const now = this.now();
    if (!proof || proof.nodeId !== validNodeId(nodeId) || proof.purpose !== 'verify-email' || Date.parse(proof.expiresAt) <= now || proof.consumedAt) {
      return Object.freeze({ ok: true, verified: false, complete: true });
    }
    if (!proof.approvedAt) return Object.freeze({ ok: true, verified: false, complete: false });
    await this.state.storage.put(key, Object.freeze({ ...proof, consumedAt: nowIso(now) }));
    return Object.freeze({ ok: true, verified: true, complete: true });
  }

  async pollRecovery(nodeId, token) {
    const key = proofKey(await inboundTokenHash(token));
    const proof = await this.state.storage.get(key);
    const now = this.now();
    if (!proof || proof.nodeId !== validNodeId(nodeId) || proof.purpose !== 'recover-account' || Date.parse(proof.expiresAt) <= now || proof.consumedAt) {
      return Object.freeze({ ok: true, ready: false, complete: true });
    }
    if (!proof.approvedAt) return Object.freeze({ ok: true, ready: false, complete: false });
    if (!proof.userId) {
      await this.state.storage.put(key, Object.freeze({ ...proof, consumedAt: nowIso(now) }));
      return Object.freeze({ ok: true, ready: false, complete: true });
    }
    const account = await this.accountForResident(proof.userId);
    if (!account?.emailVerifiedAt) {
      await this.state.storage.put(key, Object.freeze({ ...proof, consumedAt: nowIso(now) }));
      return Object.freeze({ ok: true, ready: false, complete: true });
    }
    const challenge = await this.issueChallenge(account, 'recover-account');
    const recovered = await super.completeRecovery(challenge.token);
    await this.state.storage.put(key, Object.freeze({ ...proof, consumedAt: nowIso(now) }));
    return Object.freeze({ ...recovered, ready: true, complete: true });
  }
}

export async function handleHubAccountRecoveryInbound(service, request, nodeId, fallbackHandler) {
  const url = new URL(request.url);
  const input = request.method === 'POST' ? await request.clone().json().catch(() => ({})) : {};
  const headers = {
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-civweave-node-id',
    'access-control-max-age': '86400',
  };
  try {
    if (request.method === 'POST' && url.pathname === '/api/account/recovery/request') {
      return Response.json(await service.requestRecoveryForNode(nodeId, input), { status: 202, headers });
    }
    if (request.method === 'POST' && url.pathname === '/api/account/verify/poll') {
      return Response.json(await service.pollVerification(nodeId, input.token), { headers });
    }
    if (request.method === 'POST' && url.pathname === '/api/account/recovery/poll') {
      return Response.json(await service.pollRecovery(nodeId, input.token), { headers });
    }
    return fallbackHandler(service, request, nodeId);
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error) }, {
      status: Number.isSafeInteger(error?.status) ? error.status : 500,
      headers,
    });
  }
}
