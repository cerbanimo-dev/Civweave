const enc = new TextEncoder();
const dec = new TextDecoder();

export const HUB_ACCOUNT_SCHEMA = 'civweave.hub-account.v1';
export const HUB_ACCOUNT_RECOVERY_SCHEMA = 'civweave.hub-account-recovery.v1';
export const HUB_ACCOUNT_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const HUB_ACCOUNT_RECOVERY_TTL_MS = 20 * 60 * 1000;
export const HUB_ACCOUNT_RECOVERY_COOLDOWN_MS = 60 * 1000;

const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const nowIso = now => new Date(now).toISOString();
const ACCOUNT_CORS = Object.freeze({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-civweave-node-id',
  'access-control-max-age': '86400',
});
const responseHeaders = () => ({ 'cache-control': 'no-store', ...ACCOUNT_CORS });

function b64url(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
function fromB64url(value) {
  const normalized = String(value).replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function randomToken(bytes = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function tokenHash(token) {
  const value = clean(token, 400);
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(value)) throw Object.assign(new TypeError('Recovery code is invalid.'), { status: 400 });
  return sha256Hex(`civweave.hub-account-challenge.v1\n${value}`);
}
async function emailHash(email) {
  return sha256Hex(`civweave.hub-account-email.v1\n${normalizeEmail(email)}`);
}

export function normalizeEmail(value) {
  const email = clean(value, 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw Object.assign(new TypeError('A valid recovery email is required.'), { status: 400 });
  }
  return email;
}
export function normalizeResidentId(value) {
  const userId = clean(value, 180);
  if (!/^[A-Za-z0-9:_-]{12,180}$/.test(userId)) {
    throw Object.assign(new TypeError('A valid Hub resident id is required.'), { status: 400 });
  }
  return userId;
}
export function normalizePassportId(value) {
  const passportId = clean(value, 180);
  if (!passportId) return '';
  if (!/^[A-Za-z0-9:._-]{6,180}$/.test(passportId)) {
    throw Object.assign(new TypeError('Passport id is invalid.'), { status: 400 });
  }
  return passportId;
}
export function normalizeDeviceCredential(value) {
  const credential = clean(value, 400);
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(credential)) {
    throw Object.assign(new TypeError('A valid device login credential is required.'), { status: 400 });
  }
  return credential;
}
export function maskedEmail(value) {
  const email = normalizeEmail(value);
  const [local, domain] = email.split('@');
  const lead = local.slice(0, Math.min(2, local.length));
  return `${lead}${'*'.repeat(Math.max(2, Math.min(8, local.length - lead.length)))}@${domain}`;
}

async function vaultKey(secret) {
  const source = clean(secret, 20000);
  if (source.length < 20) throw Object.assign(new Error('Hub recovery vault identity is unavailable.'), { status: 503 });
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`civweave.hub-account-vault.v1\n${source}`));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function encryptCredential(credential, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await vaultKey(secret), enc.encode(normalizeDeviceCredential(credential)));
  return Object.freeze({ algorithm: 'AES-GCM', iv: b64url(iv), ciphertext: b64url(ciphertext) });
}
async function decryptCredential(record, secret) {
  if (record?.algorithm !== 'AES-GCM' || !record.iv || !record.ciphertext) throw Object.assign(new Error('Hub recovery vault record is invalid.'), { status: 500 });
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(record.iv) }, await vaultKey(secret), fromB64url(record.ciphertext));
    return normalizeDeviceCredential(dec.decode(plaintext));
  } catch {
    throw Object.assign(new Error('Hub recovery vault could not unlock this account.'), { status: 503 });
  }
}

function accountKey(accountId) { return `hub-account:${clean(accountId, 180)}`; }
function residentKey(userId) { return `hub-resident:${normalizeResidentId(userId)}`; }
function emailKey(hash) { return `hub-email:${clean(hash, 128)}`; }
function challengeKey(hash) { return `hub-challenge:${clean(hash, 128)}`; }

function publicAccount(account) {
  return Object.freeze({
    schema: HUB_ACCOUNT_SCHEMA,
    accountId: account.accountId,
    nodeId: account.nodeId,
    userId: account.userId,
    recoveryEmail: maskedEmail(account.email),
    emailVerified: Boolean(account.emailVerifiedAt),
    emailVerifiedAt: account.emailVerifiedAt || null,
    passportIds: [...(account.passportIds || [])],
    fullyEstablished: Boolean(account.emailVerifiedAt),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  });
}

async function defaultDeliver(env, message) {
  const webhook = clean(env?.HUB_RECOVERY_MAILER_URL, 2000);
  const bearer = clean(env?.HUB_RECOVERY_MAILER_TOKEN, 4000);
  if (webhook) {
    const headers = { 'content-type': 'application/json', accept: 'application/json' };
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    const response = await fetch(webhook, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        schema: 'civweave.hub-recovery-email.v1',
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        nodeId: message.nodeId,
        purpose: message.purpose,
      }),
    });
    if (!response.ok) throw Object.assign(new Error(`Hub recovery mailer returned HTTP ${response.status}.`), { status: 502 });
    return Object.freeze({ sent: true, transport: 'webhook' });
  }

  if (env?.HUB_RECOVERY_EMAIL?.send) {
    const from = clean(env.HUB_RECOVERY_FROM_EMAIL, 320);
    if (!from) throw Object.assign(new Error('HUB_RECOVERY_FROM_EMAIL is required for the Cloudflare email binding.'), { status: 503 });
    await env.HUB_RECOVERY_EMAIL.send({
      to: [message.to],
      from: { email: from, name: 'Civweave Hub' },
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return Object.freeze({ sent: true, transport: 'cloudflare-email' });
  }

  return Object.freeze({ sent: false, transport: 'unconfigured' });
}

export class HubAccountRecoveryService {
  constructor(state, env, { vaultSecret, deliver = defaultDeliver, now = () => Date.now() } = {}) {
    this.state = state;
    this.env = env || {};
    this.vaultSecret = vaultSecret;
    this.deliver = deliver;
    this.now = now;
  }

  async secret() {
    const value = typeof this.vaultSecret === 'function' ? await this.vaultSecret() : this.vaultSecret;
    return clean(value, 20000);
  }

  async accountForResident(userId) {
    const accountId = await this.state.storage.get(residentKey(userId));
    return accountId ? this.state.storage.get(accountKey(accountId)) : null;
  }

  async accountForEmail(email) {
    const hash = await emailHash(email);
    const accountId = await this.state.storage.get(emailKey(hash));
    return accountId ? this.state.storage.get(accountKey(accountId)) : null;
  }

  async issueChallenge(account, purpose) {
    const token = randomToken(32);
    const hash = await tokenHash(token);
    const now = this.now();
    const ttl = purpose === 'verify-email' ? HUB_ACCOUNT_VERIFICATION_TTL_MS : HUB_ACCOUNT_RECOVERY_TTL_MS;
    const challenge = Object.freeze({
      schema: HUB_ACCOUNT_RECOVERY_SCHEMA,
      purpose,
      accountId: account.accountId,
      nodeId: account.nodeId,
      createdAt: nowIso(now),
      expiresAt: nowIso(now + ttl),
      consumedAt: null,
    });
    await this.state.storage.put(challengeKey(hash), challenge);
    return { token, challenge };
  }

  async deliverChallenge(account, purpose, token) {
    const verification = purpose === 'verify-email';
    const subject = verification ? 'Verify your Civweave Hub recovery email' : 'Recover your Civweave Hub account';
    const action = verification ? 'verification' : 'recovery';
    const text = [
      `Your Civweave Hub ${action} code is:`,
      '',
      token,
      '',
      verification
        ? 'Enter this code in Civweave to finish establishing email recovery for this Hub account.'
        : 'Enter this code in Civweave on the device where you want to recover access. This code can be used once and expires quickly.',
      '',
      `Hub: ${account.nodeId}`,
      'This message contains no Passport history, activity, purchases, or Stripe information.',
    ].join('\n');
    const html = `<p>Your Civweave Hub ${action} code is:</p><p><code style="font-size:18px;word-break:break-all">${token}</code></p><p>${verification ? 'Enter this code in Civweave to finish establishing email recovery for this Hub account.' : 'Enter this code in Civweave on the device where you want to recover access. This code can be used once and expires quickly.'}</p><p>Hub: ${account.nodeId}</p><p>This message contains no Passport history, activity, purchases, or Stripe information.</p>`;
    return this.deliver(this.env, { to: account.email, subject, text, html, nodeId: account.nodeId, purpose });
  }

  async signup(nodeId, input = {}) {
    const userId = normalizeResidentId(input.userId);
    const email = normalizeEmail(input.email);
    const passportId = normalizePassportId(input.passportId);
    const credential = normalizeDeviceCredential(input.credential);
    const now = this.now();
    let account = await this.accountForResident(userId);
    const emailOwner = await this.accountForEmail(email);

    if (emailOwner && emailOwner.userId !== userId) {
      throw Object.assign(new Error('That recovery email cannot be attached to this Hub account.'), { status: 409 });
    }
    if (account && account.email !== email) {
      throw Object.assign(new Error('Changing a Hub recovery email requires an authenticated account-recovery settings flow.'), { status: 409 });
    }

    if (!account) {
      const accountId = `hubacct:${crypto.randomUUID()}`;
      account = Object.freeze({
        schema: HUB_ACCOUNT_SCHEMA,
        accountId,
        nodeId: clean(nodeId, 180),
        userId,
        email,
        emailVerifiedAt: null,
        passportIds: passportId ? [passportId] : [],
        credentialVault: await encryptCredential(credential, await this.secret()),
        recoveryRequestedAt: null,
        createdAt: nowIso(now),
        updatedAt: nowIso(now),
      });
      await this.state.storage.put({
        [accountKey(accountId)]: account,
        [residentKey(userId)]: accountId,
        [emailKey(await emailHash(email))]: accountId,
      });
    } else {
      const passports = new Set(account.passportIds || []);
      if (passportId) passports.add(passportId);
      account = Object.freeze({
        ...account,
        passportIds: [...passports],
        credentialVault: await encryptCredential(credential, await this.secret()),
        updatedAt: nowIso(now),
      });
      await this.state.storage.put(accountKey(account.accountId), account);
    }

    let delivery = Object.freeze({ sent: false, transport: 'already-verified' });
    if (!account.emailVerifiedAt) {
      const { token } = await this.issueChallenge(account, 'verify-email');
      delivery = await this.deliverChallenge(account, 'verify-email', token);
    }
    return Object.freeze({
      ok: true,
      account: publicAccount(account),
      verificationPending: !account.emailVerifiedAt,
      delivery: Object.freeze({ sent: Boolean(delivery.sent), transport: clean(delivery.transport, 80) || 'unknown' }),
    });
  }

  async consumeChallenge(token, purpose) {
    const key = challengeKey(await tokenHash(token));
    const challenge = await this.state.storage.get(key);
    const now = this.now();
    if (!challenge || challenge.purpose !== purpose || challenge.consumedAt || Date.parse(challenge.expiresAt) <= now) {
      throw Object.assign(new Error('Recovery code is invalid, expired, or already used.'), { status: 400 });
    }
    const account = await this.state.storage.get(accountKey(challenge.accountId));
    if (!account) throw Object.assign(new Error('Hub account is unavailable.'), { status: 404 });
    await this.state.storage.put(key, Object.freeze({ ...challenge, consumedAt: nowIso(now) }));
    return { account, now };
  }

  async verifyEmail(token) {
    const { account, now } = await this.consumeChallenge(token, 'verify-email');
    const next = Object.freeze({ ...account, emailVerifiedAt: account.emailVerifiedAt || nowIso(now), updatedAt: nowIso(now) });
    await this.state.storage.put(accountKey(account.accountId), next);
    return Object.freeze({ ok: true, account: publicAccount(next) });
  }

  async requestRecovery(input = {}) {
    let account = null;
    try { account = await this.accountForEmail(normalizeEmail(input.email)); }
    catch { account = null; }
    const now = this.now();
    if (account?.emailVerifiedAt) {
      const prior = Date.parse(account.recoveryRequestedAt || 0);
      if (!Number.isFinite(prior) || now - prior >= HUB_ACCOUNT_RECOVERY_COOLDOWN_MS) {
        const next = Object.freeze({ ...account, recoveryRequestedAt: nowIso(now), updatedAt: nowIso(now) });
        await this.state.storage.put(accountKey(account.accountId), next);
        const { token } = await this.issueChallenge(next, 'recover-account');
        await this.deliverChallenge(next, 'recover-account', token);
      }
    }
    return Object.freeze({
      ok: true,
      accepted: true,
      message: 'If that email is a verified recovery method for this Hub, a one-time recovery code has been sent.',
    });
  }

  async completeRecovery(token) {
    const { account, now } = await this.consumeChallenge(token, 'recover-account');
    if (!account.emailVerifiedAt) throw Object.assign(new Error('This Hub account does not have a verified recovery email.'), { status: 409 });
    const credential = await decryptCredential(account.credentialVault, await this.secret());
    const next = Object.freeze({ ...account, recoveryRequestedAt: null, lastRecoveredAt: nowIso(now), updatedAt: nowIso(now) });
    await this.state.storage.put(accountKey(account.accountId), next);
    return Object.freeze({
      ok: true,
      schema: HUB_ACCOUNT_RECOVERY_SCHEMA,
      nodeId: next.nodeId,
      accountId: next.accountId,
      userId: next.userId,
      credential,
      passportIds: [...(next.passportIds || [])],
      recoveredAt: nowIso(now),
    });
  }

  async status(input = {}) {
    const userId = normalizeResidentId(input.userId);
    const credential = normalizeDeviceCredential(input.credential);
    const account = await this.accountForResident(userId);
    if (!account) throw Object.assign(new Error('Hub account is not enrolled for recovery.'), { status: 404 });
    const stored = await decryptCredential(account.credentialVault, await this.secret());
    if (stored !== credential) throw Object.assign(new Error('Hub account credential is invalid.'), { status: 401 });
    return Object.freeze({ ok: true, account: publicAccount(account) });
  }
}

export async function handleHubAccountRecovery(service, request, nodeId) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/account/')) return new Response(null, { status: 204, headers: ACCOUNT_CORS });
  const input = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  try {
    if (request.method === 'POST' && url.pathname === '/api/account/signup') return Response.json(await service.signup(nodeId, input), { status: 201, headers: responseHeaders() });
    if (request.method === 'POST' && url.pathname === '/api/account/verify') return Response.json(await service.verifyEmail(input.token), { headers: responseHeaders() });
    if (request.method === 'POST' && url.pathname === '/api/account/recovery/request') return Response.json(await service.requestRecovery(input), { status: 202, headers: responseHeaders() });
    if (request.method === 'POST' && url.pathname === '/api/account/recovery/complete') return Response.json(await service.completeRecovery(input.token), { headers: responseHeaders() });
    if (request.method === 'POST' && url.pathname === '/api/account/status') return Response.json(await service.status(input), { headers: responseHeaders() });
    return null;
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error) }, {
      status: Number.isSafeInteger(error?.status) ? error.status : 500,
      headers: responseHeaders(),
    });
  }
}
