import { HubAccountRecoveryInboundService } from './hub-account-recovery-inbound-v1.mjs';

export const HUB_OFFLINE_RECOVERY_SCHEMA = 'civweave.hub-offline-recovery.v1';
export const HUB_OFFLINE_RECOVERY_CODE_COUNT = 8;

const enc = new TextEncoder();
const dec = new TextDecoder();
const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const nowIso = now => new Date(now).toISOString();

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
function randomCode() { return b64url(crypto.getRandomValues(new Uint8Array(32))); }
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function normalizeOfflineCode(value) {
  const code = clean(value, 400);
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(code)) throw Object.assign(new TypeError('Recovery code is invalid.'), { status: 400 });
  return code;
}
async function offlineCodeHash(code) {
  return sha256Hex(`civweave.hub-offline-recovery-code.v1\n${normalizeOfflineCode(code)}`);
}
async function vaultKey(secret) {
  const source = clean(secret, 20000);
  if (source.length < 20) throw Object.assign(new Error('Guild recovery vault identity is unavailable.'), { status: 503 });
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`civweave.hub-account-vault.v1\n${source}`));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['decrypt']);
}
async function decryptCredential(record, secret) {
  if (record?.algorithm !== 'AES-GCM' || !record.iv || !record.ciphertext) throw Object.assign(new Error('Guild recovery vault record is invalid.'), { status: 500 });
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(record.iv) }, await vaultKey(secret), fromB64url(record.ciphertext));
    const credential = clean(dec.decode(plaintext), 400);
    if (!/^[A-Za-z0-9_-]{40,200}$/.test(credential)) throw new Error('invalid credential');
    return credential;
  } catch {
    throw Object.assign(new Error('Guild recovery vault could not unlock this account.'), { status: 503 });
  }
}
function accountKey(accountId) { return `hub-account:${clean(accountId, 180)}`; }
function codeKey(hash) { return `hub-offline-recovery:${clean(hash, 128)}`; }
function hashes(account) { return Array.isArray(account?.offlineRecoveryCodeHashes) ? account.offlineRecoveryCodeHashes.map(value => clean(value, 128)).filter(Boolean) : []; }
function withOfflineState(publicAccount, account) {
  const remaining = Math.max(0, Number(account?.offlineRecoveryRemaining || 0));
  return Object.freeze({
    ...(publicAccount || {}),
    offlineRecoveryReady: remaining > 0,
    offlineRecoveryRemaining: remaining,
    offlineRecoveryIssuedAt: account?.offlineRecoveryIssuedAt || null,
    offlineRecoveryAcknowledged: Boolean(account?.offlineRecoveryAcknowledgedAt),
    offlineRecoveryAcknowledgedAt: account?.offlineRecoveryAcknowledgedAt || null,
    fullyEstablished: Boolean(publicAccount?.emailVerified || (remaining > 0 && account?.offlineRecoveryAcknowledgedAt)),
  });
}

export class HubAccountRecoveryOfflineService extends HubAccountRecoveryInboundService {
  async invalidateOfflineRecoveryCodes(account) {
    for (const hash of hashes(account)) await this.state.storage.delete(codeKey(hash));
  }

  async issueOfflineRecoveryKit(account) {
    if (account?.offlineRecoveryAcknowledgedAt) return { account, kit: null };
    await this.invalidateOfflineRecoveryCodes(account);
    const now = this.now();
    const codes = Array.from({ length: HUB_OFFLINE_RECOVERY_CODE_COUNT }, () => randomCode());
    const codeHashes = [];
    const records = {};
    for (const code of codes) {
      const hash = await offlineCodeHash(code);
      codeHashes.push(hash);
      records[codeKey(hash)] = Object.freeze({
        schema: HUB_OFFLINE_RECOVERY_SCHEMA,
        accountId: account.accountId,
        createdAt: nowIso(now),
      });
    }
    const next = Object.freeze({
      ...account,
      offlineRecoveryIssuedAt: nowIso(now),
      offlineRecoveryAcknowledgedAt: null,
      offlineRecoveryRemaining: codes.length,
      offlineRecoveryCodeHashes: Object.freeze([...codeHashes]),
      updatedAt: nowIso(now),
    });
    records[accountKey(account.accountId)] = next;
    await this.state.storage.put(records);
    return {
      account: next,
      kit: Object.freeze({
        schema: HUB_OFFLINE_RECOVERY_SCHEMA,
        codes: Object.freeze([...codes]),
        issuedAt: next.offlineRecoveryIssuedAt,
        acknowledgementRequired: true,
        instruction: 'Save these codes somewhere separate from this device, then confirm that you saved them. Each code can recover this Guild account once.',
      }),
    };
  }

  async signup(nodeId, input = {}) {
    const packet = await super.signup(nodeId, input);
    let account = await this.accountForResident(input.userId);
    if (!account) return packet;
    let kit = null;
    if (!account.offlineRecoveryAcknowledgedAt) ({ account, kit } = await this.issueOfflineRecoveryKit(account));
    return Object.freeze({
      ...packet,
      account: withOfflineState(packet.account, account),
      recoveryKit: kit,
    });
  }

  async acknowledgeOfflineRecovery(userId) {
    const account = await this.accountForResident(userId);
    if (!account) throw Object.assign(new Error('Guild account is unavailable.'), { status: 404 });
    if (!hashes(account).length || Number(account.offlineRecoveryRemaining || 0) < 1) {
      throw Object.assign(new Error('This Guild account does not have an active recovery kit to acknowledge.'), { status: 409 });
    }
    const now = this.now();
    const next = Object.freeze({ ...account, offlineRecoveryAcknowledgedAt: account.offlineRecoveryAcknowledgedAt || nowIso(now), updatedAt: nowIso(now) });
    await this.state.storage.put(accountKey(account.accountId), next);
    return Object.freeze({
      ok: true,
      schema: HUB_OFFLINE_RECOVERY_SCHEMA,
      acknowledged: true,
      account: withOfflineState({}, next),
    });
  }

  async status(input = {}) {
    const packet = await super.status(input);
    const account = await this.accountForResident(input.userId);
    return Object.freeze({ ...packet, account: withOfflineState(packet.account, account) });
  }

  async completeOfflineRecovery(token) {
    const code = normalizeOfflineCode(token);
    const hash = await offlineCodeHash(code);
    const key = codeKey(hash);
    const record = await this.state.storage.get(key);
    if (!record?.accountId) return null;
    const account = await this.state.storage.get(accountKey(record.accountId));
    if (!account) {
      await this.state.storage.delete(key);
      throw Object.assign(new Error('Guild account is unavailable.'), { status: 404 });
    }
    const now = this.now();
    const credential = await decryptCredential(account.credentialVault, await this.secret());
    await this.state.storage.delete(key);
    const nextHashes = hashes(account).filter(value => value !== hash);
    const next = Object.freeze({
      ...account,
      offlineRecoveryRemaining: nextHashes.length,
      offlineRecoveryCodeHashes: Object.freeze(nextHashes),
      recoveryRequestedAt: null,
      lastRecoveredAt: nowIso(now),
      updatedAt: nowIso(now),
    });
    await this.state.storage.put(accountKey(account.accountId), next);
    return Object.freeze({
      ok: true,
      schema: HUB_OFFLINE_RECOVERY_SCHEMA,
      recoveryMethod: 'offline-code',
      nodeId: next.nodeId,
      accountId: next.accountId,
      userId: next.userId,
      credential,
      passportIds: [...(next.passportIds || [])],
      offlineRecoveryRemaining: next.offlineRecoveryRemaining,
      recoveredAt: nowIso(now),
    });
  }

  async completeRecovery(token) {
    const offline = await this.completeOfflineRecovery(token);
    return offline || super.completeRecovery(token);
  }
}
