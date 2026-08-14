import {
  HubAccountRecoveryService,
  HUB_ACCOUNT_RECOVERY_TTL_MS,
  HUB_ACCOUNT_VERIFICATION_TTL_MS,
  normalizeEmail,
} from './hub-account-recovery-v1.mjs';

const enc = new TextEncoder();
const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const nowIso = now => new Date(now).toISOString();
const INBOUND_SCHEMA = 'civweave.hub-inbound-email-proof.v2';
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
  const match = clean(value, 500).match(/^Civweave Hub (verify-email|recover-account) ([A-Za-z0-9_-]{40,200})$/);
  return match ? Object.freeze({ purpose: match[1], token: match[2] }) : null;
}

export class HubAccountRecoveryInboundService extends HubAccountRecoveryService {
  mailbox() {
    const value = clean(this.env?.HUB_RECOVERY_INBOUND_EMAIL, 320).toLowerCase();
    return value ? normalizeEmail(value) : '';
  }

  relayUrl() {
    const raw = clean(this.env?.HUB_RECOVERY_RELAY_URL, 2000);
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid');
      return url.origin;
    } catch {
      throw Object.assign(new Error('Hub recovery proof relay is unavailable.'), { status: 503 });
    }
  }

  async relay(path, token) {
    const response = await fetch(`${this.relayUrl()}/api/recovery-proof/${path}`, {
      method: 'POST',
      cache: 'no-store',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ token: clean(token, 400) }),
    });
    const packet = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(packet.error || `Recovery proof relay returned HTTP ${response.status}.`), { status: response.status });
    return packet;
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
      consumedAt: null,
    });
    await this.state.storage.put(proofKey(hash), proof);
    return { token, proof, delivery: this.inboundDelivery(normalizedPurpose, token) };
  }

  inboundDelivery(purpose, token) {
    const mailbox = this.mailbox();
    if (!mailbox) return Object.freeze({ sent: false, transport: 'unconfigured' });
    const code = clean(token, 400);
    const subject = `Civweave Hub ${validPurpose(purpose)} ${code}`;
    const body = `Send this message from the recovery address you are proving.\n\nAfter sending, return to Civweave and paste this one-time code:\n\n${code}\n\nDo not forward this message or code.`;
    return Object.freeze({
      sent: true,
      transport: 'inbound-email-proof',
      mailbox,
      subject,
      proofToken: code,
      mailto: `mailto:${mailbox}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    });
  }

  async signup(nodeId, input = {}) {
    const packet = await super.signup(nodeId, input);
    if (packet.account?.emailVerified || packet.delivery?.sent || !this.mailbox()) return packet;
    const account = await this.accountForResident(input.userId);
    const inbound = await this.issueInboundProof({ nodeId, purpose: 'verify-email', email: input.email, userId: account?.userId || input.userId });
    return Object.freeze({ ...packet, delivery: inbound.delivery });
  }

  async requestRecoveryForNode(nodeId, input = {}) {
    if (hasOutbound(this.env)) return super.requestRecovery(input);
    const email = normalizeEmail(input.email);
    let account = null;
    try { account = await this.accountForEmail(email); } catch { account = null; }
    const inbound = this.mailbox()
      ? await this.issueInboundProof({ nodeId, purpose: 'recover-account', email, userId: account?.emailVerifiedAt ? account.userId : null })
      : null;
    return Object.freeze({
      ok: true,
      accepted: true,
      message: this.mailbox() ? GENERIC_RECOVERY_MESSAGE : 'If that email is a verified recovery method for this Hub, a one-time recovery code has been sent.',
      delivery: inbound?.delivery || Object.freeze({ sent: false, transport: 'unconfigured' }),
    });
  }

  async proof(token, nodeId, purpose) {
    const key = proofKey(await inboundTokenHash(token));
    const proof = await this.state.storage.get(key);
    if (!proof) return null;
    const now = this.now();
    if (proof.nodeId !== validNodeId(nodeId) || proof.purpose !== validPurpose(purpose) || proof.consumedAt || Date.parse(proof.expiresAt) <= now) {
      throw Object.assign(new Error('Email proof is invalid, expired, or already used.'), { status: 400 });
    }
    return { key, proof, now };
  }

  async authenticatedProof(found, token) {
    const relay = await this.relay('status', token);
    if (!relay?.approved) throw Object.assign(new Error('Send the prefilled recovery email before using this code.'), { status: 409 });
    if (relay.purpose !== found.proof.purpose || relay.emailHash !== found.proof.expectedEmailHash) {
      throw Object.assign(new Error('The authenticated email sender does not match this Hub recovery request.'), { status: 403 });
    }
    return relay;
  }

  async consume(found, token) {
    await this.state.storage.put(found.key, Object.freeze({ ...found.proof, consumedAt: nowIso(found.now) }));
    await this.relay('consume', token).catch(() => null);
  }

  async completeInboundVerification(nodeId, token) {
    const found = await this.proof(token, nodeId, 'verify-email');
    if (!found) return null;
    await this.authenticatedProof(found, token);
    if (!found.proof.userId) throw Object.assign(new Error('Hub recovery account is unavailable.'), { status: 404 });
    const account = await this.accountForResident(found.proof.userId);
    if (!account) throw Object.assign(new Error('Hub recovery account is unavailable.'), { status: 404 });
    if (!account.emailVerifiedAt) {
      const challenge = await this.issueChallenge(account, 'verify-email');
      await this.verifyEmail(challenge.token);
    }
    await this.consume(found, token);
    return Object.freeze({ ok: true, verified: true });
  }

  async completeInboundRecovery(nodeId, token) {
    const found = await this.proof(token, nodeId, 'recover-account');
    if (!found) return null;
    await this.authenticatedProof(found, token);
    if (!found.proof.userId) {
      await this.consume(found, token);
      throw Object.assign(new Error('No recoverable Hub account was confirmed for that address.'), { status: 404 });
    }
    const account = await this.accountForResident(found.proof.userId);
    if (!account?.emailVerifiedAt) throw Object.assign(new Error('This Hub account does not have a verified recovery email.'), { status: 409 });
    const challenge = await this.issueChallenge(account, 'recover-account');
    const recovered = await super.completeRecovery(challenge.token);
    await this.consume(found, token);
    return recovered;
  }

  async pollVerification(nodeId, token) {
    const found = await this.proof(token, nodeId, 'verify-email');
    if (!found) return Object.freeze({ ok: true, verified: false, complete: true });
    const relay = await this.relay('status', token).catch(() => ({ approved: false }));
    const verified = Boolean(relay.approved && relay.purpose === found.proof.purpose && relay.emailHash === found.proof.expectedEmailHash);
    return Object.freeze({ ok: true, verified, complete: verified });
  }

  async pollRecovery(nodeId, token) {
    const found = await this.proof(token, nodeId, 'recover-account');
    if (!found) return Object.freeze({ ok: true, ready: false, complete: true });
    const relay = await this.relay('status', token).catch(() => ({ approved: false }));
    const authenticated = Boolean(relay.approved && relay.purpose === found.proof.purpose && relay.emailHash === found.proof.expectedEmailHash);
    return Object.freeze({ ok: true, ready: authenticated && Boolean(found.proof.userId), complete: authenticated });
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
    if (request.method === 'POST' && url.pathname === '/api/account/recovery/request') return Response.json(await service.requestRecoveryForNode(nodeId, input), { status: 202, headers });
    if (request.method === 'POST' && url.pathname === '/api/account/verify') {
      const result = await service.completeInboundVerification(nodeId, input.token);
      if (result) return Response.json(result, { headers });
    }
    if (request.method === 'POST' && url.pathname === '/api/account/recovery/complete') {
      const result = await service.completeInboundRecovery(nodeId, input.token);
      if (result) return Response.json(result, { headers });
    }
    if (request.method === 'POST' && url.pathname === '/api/account/verify/poll') return Response.json(await service.pollVerification(nodeId, input.token), { headers });
    if (request.method === 'POST' && url.pathname === '/api/account/recovery/poll') return Response.json(await service.pollRecovery(nodeId, input.token), { headers });
    return fallbackHandler(service, request, nodeId);
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: Number.isSafeInteger(error?.status) ? error.status : 500, headers });
  }
}
