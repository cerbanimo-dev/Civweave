import { PassportAccountService as BasePassportAccountService, PASSPORT_ACCOUNT_SCHEMA } from './hub-passport-account-v1.mjs';

export const HUB_ACCOUNT_POLICY = Object.freeze({
  maxPairedDevices: 10,
  maxActiveDevices: 2,
  maxPassports: 32,
  recoveryCodeCount: 8,
});

const enc = new TextEncoder();
const dec = new TextDecoder();
const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const nowIso = now => new Date(now).toISOString();
const accountKey = accountId => `hub-account:${clean(accountId, 180)}`;
const residentKey = userId => `hub-resident:${normalizeResidentId(userId)}`;
const accountNameKey = name => `hub-account-name:${normalizeAccountName(name)}`;
const recoveryCodeKey = hash => `hub-passport-recovery-code:${clean(hash, 128)}`;

function normalizeAccountName(value) {
  const name = clean(value, 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(name)) {
    throw Object.assign(new TypeError('Choose a username with 6-64 lowercase letters, numbers, or hyphens.'), { status: 400 });
  }
  return name;
}
function normalizeResidentId(value) {
  const userId = clean(value, 180);
  if (!/^[A-Za-z0-9:_-]{12,180}$/.test(userId)) throw Object.assign(new TypeError('A valid Hub resident id is required.'), { status: 400 });
  return userId;
}
function normalizePassportId(value) {
  const passportId = clean(value, 180);
  if (!/^[A-Za-z0-9:._-]{6,180}$/.test(passportId)) throw Object.assign(new TypeError('A valid Passport id is required.'), { status: 400 });
  return passportId;
}
function normalizeCredential(value) {
  const credential = clean(value, 400);
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(credential)) throw Object.assign(new TypeError('A valid device login credential is required.'), { status: 400 });
  return credential;
}
function normalizeDeviceId(value) {
  const deviceId = clean(value, 180);
  if (!/^[A-Za-z0-9:._-]{12,180}$/.test(deviceId)) throw Object.assign(new TypeError('A valid device id is required.'), { status: 400 });
  return deviceId;
}
function normalizeDeviceLabel(value) {
  return clean(value, 100).replace(/[\u0000-\u001f\u007f]/g, '') || 'Civweave device';
}
function normalizeRecoveryCode(value) {
  const code = clean(value, 400);
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(code)) throw Object.assign(new TypeError('Recovery code is invalid.'), { status: 400 });
  return code;
}
function normalizeTotpCode(value) {
  const code = clean(value, 20).replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) throw Object.assign(new TypeError('Enter the 6-digit authenticator code.'), { status: 400 });
  return code;
}
function b64url(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
function fromB64url(value) {
  const normalized = String(value || '').replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function randomToken(bytes = 32) { return b64url(crypto.getRandomValues(new Uint8Array(bytes))); }
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function vaultKey(secret) {
  const source = clean(secret, 20000);
  if (source.length < 20) throw Object.assign(new Error('Hub account vault identity is unavailable.'), { status: 503 });
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`civweave.hub-account-vault.v1\n${source}`));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function encryptText(value, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await vaultKey(secret), enc.encode(String(value)));
  return Object.freeze({ algorithm: 'AES-GCM', iv: b64url(iv), ciphertext: b64url(ciphertext) });
}
async function decryptText(record, secret) {
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(record.iv) }, await vaultKey(secret), fromB64url(record.ciphertext));
    return dec.decode(plain);
  } catch {
    throw Object.assign(new Error('Hub account vault could not unlock this account.'), { status: 503 });
  }
}
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(bytes) {
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}
function base32Bytes(text) {
  const source = clean(text, 200).toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const char of source) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw Object.assign(new TypeError('Authenticator secret is invalid.'), { status: 400 });
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
async function totpAt(secret, timestamp) {
  const counter = Math.floor(timestamp / 30000);
  const bytes = new Uint8Array(8);
  let value = BigInt(counter);
  for (let i = 7; i >= 0; i -= 1) { bytes[i] = Number(value & 255n); value >>= 8n; }
  const key = await crypto.subtle.importKey('raw', base32Bytes(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, bytes));
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}
async function verifyTotpCode(secret, code, now) {
  const supplied = normalizeTotpCode(code);
  for (const window of [-1, 0, 1]) if (await totpAt(secret, now + window * 30000) === supplied) return true;
  return false;
}
function deviceRows(account) {
  return Array.isArray(account?.devices) ? account.devices.map(row => ({ ...row })) : [];
}
function activeIds(account) {
  return new Set(Array.isArray(account?.activeDeviceIds) ? account.activeDeviceIds.map(value => clean(value, 180)).filter(Boolean) : []);
}
function publicDevices(account) {
  const active = activeIds(account);
  return deviceRows(account).map(row => Object.freeze({
    deviceId: row.deviceId,
    label: row.label || 'Civweave device',
    pairedAt: row.pairedAt || null,
    lastSeenAt: row.lastSeenAt || null,
    active: active.has(row.deviceId),
  }));
}
function recoveryHashes(account) {
  return Array.isArray(account?.recoveryCodeHashes) ? account.recoveryCodeHashes.map(value => clean(value, 128)).filter(Boolean) : [];
}
function secondFactorReady(account) {
  return Boolean((Array.isArray(account?.passkeyHashes) && account.passkeyHashes.length) || account?.totpVerifiedAt);
}
function publicAccount(account, passkeyCount = 0) {
  if (!account) return null;
  const devices = publicDevices(account);
  const recoveryKitAcknowledged = Boolean(account.recoveryKitAcknowledgedAt);
  const recoveryEmailVerified = Boolean(account.recoveryEmailVerifiedAt);
  return Object.freeze({
    schema: PASSPORT_ACCOUNT_SCHEMA,
    accountId: account.accountId,
    accountName: account.accountName,
    nodeId: account.nodeId,
    userId: account.userId,
    passportIds: [...(account.passportIds || [])],
    passkeyCount,
    totpEnabled: Boolean(account.totpVerifiedAt),
    secondFactorReady: secondFactorReady(account),
    recoveryEmailSet: Boolean(account.recoveryEmail),
    recoveryEmailVerified,
    recoveryKitAcknowledged,
    recoveryCodesRemaining: recoveryHashes(account).length,
    pairedDeviceCount: devices.length,
    activeDeviceCount: devices.filter(row => row.active).length,
    maxPairedDevices: HUB_ACCOUNT_POLICY.maxPairedDevices,
    maxActiveDevices: HUB_ACCOUNT_POLICY.maxActiveDevices,
    devices,
    annualMemberRebateOptIn: Boolean(account.annualMemberRebateOptIn),
    onlineMembershipReady: recoveryEmailVerified && recoveryKitAcknowledged && secondFactorReady(account),
    offlineMembershipReady: recoveryKitAcknowledged && secondFactorReady(account),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  });
}

export class PassportAccountService extends BasePassportAccountService {
  async accountByResident(userId) {
    const id = await this.state.storage.get(residentKey(userId));
    return id ? this.state.storage.get(accountKey(id)) : null;
  }
  async assertCredential(input = {}) {
    const userId = normalizeResidentId(input.userId), supplied = normalizeCredential(input.credential);
    const account = await this.accountByResident(userId);
    if (!account) throw Object.assign(new Error('Hub account is unavailable.'), { status: 404 });
    const canonical = normalizeCredential(await decryptText(account.credentialVault, await this.secret()));
    if (canonical !== supplied) throw Object.assign(new Error('Hub account device credential is invalid.'), { status: 401 });
    return account;
  }
  async renameAccount(account, requestedName) {
    const requested = normalizeAccountName(requestedName);
    if (requested === account.accountName) return account;
    const occupied = await this.state.storage.get(accountNameKey(requested));
    if (occupied && occupied !== account.accountId) throw Object.assign(new Error('That username is already in use.'), { status: 409 });
    const priorName = clean(account.accountName, 64);
    const next = Object.freeze({ ...account, accountName: requested, updatedAt: nowIso(this.now()) });
    await this.state.storage.put({ [accountKey(account.accountId)]: next, [accountNameKey(requested)]: account.accountId });
    if (priorName && priorName !== requested) await this.state.storage.delete(`hub-account-name:${priorName}`);
    return next;
  }
  async issueRecoveryKit(account) {
    if (recoveryHashes(account).length && !account.recoveryKitRegenerateRequestedAt) return { account, recoveryKit: null };
    for (const hash of recoveryHashes(account)) await this.state.storage.delete(recoveryCodeKey(hash));
    const codes = Array.from({ length: HUB_ACCOUNT_POLICY.recoveryCodeCount }, () => randomToken(24));
    const hashes = [], records = {};
    for (const code of codes) {
      const hash = await sha256Hex(`civweave.passport-recovery-code.v1\n${normalizeRecoveryCode(code)}`);
      hashes.push(hash);
      records[recoveryCodeKey(hash)] = Object.freeze({ accountId: account.accountId, createdAt: nowIso(this.now()) });
    }
    const next = Object.freeze({
      ...account,
      recoveryCodeHashes: Object.freeze(hashes),
      recoveryKitIssuedAt: nowIso(this.now()),
      recoveryKitAcknowledgedAt: null,
      recoveryKitRegenerateRequestedAt: null,
      updatedAt: nowIso(this.now()),
    });
    records[accountKey(account.accountId)] = next;
    await this.state.storage.put(records);
    return { account: next, recoveryKit: Object.freeze({ schema: 'civweave.passport-recovery-kit.v1', codes: Object.freeze(codes), acknowledgementRequired: true, instruction: 'Save these codes somewhere separate from this device. Each code is one-use recovery material.' }) };
  }
  async pairDevice(account, input = {}, { activate = false } = {}) {
    const deviceId = normalizeDeviceId(input.deviceId), label = normalizeDeviceLabel(input.deviceLabel);
    const rows = deviceRows(account), index = rows.findIndex(row => row.deviceId === deviceId);
    if (index < 0 && rows.length >= HUB_ACCOUNT_POLICY.maxPairedDevices) {
      const error = new RangeError('This account already has 10 paired devices. Remove one before pairing another.');
      error.status = 409; error.code = 'paired-device-limit'; throw error;
    }
    const at = nowIso(this.now());
    if (index < 0) rows.push({ deviceId, label, pairedAt: at, lastSeenAt: at });
    else rows[index] = { ...rows[index], label: label || rows[index].label, lastSeenAt: at };
    const active = activeIds(account);
    if (activate && !active.has(deviceId)) {
      if (active.size >= HUB_ACCOUNT_POLICY.maxActiveDevices) {
        const replace = clean(input.replaceDeviceId, 180);
        if (!replace || !active.has(replace) || replace === deviceId) {
          const error = new RangeError('Two devices are already active. Deactivate one to continue on this device.');
          error.status = 409; error.code = 'active-device-limit';
          error.activeDevices = publicDevices({ ...account, devices: rows, activeDeviceIds: [...active] }).filter(row => row.active);
          throw error;
        }
        active.delete(replace);
      }
      active.add(deviceId);
    }
    const next = Object.freeze({ ...account, devices: Object.freeze(rows.map(Object.freeze)), activeDeviceIds: Object.freeze([...active]), updatedAt: at });
    await this.state.storage.put(accountKey(account.accountId), next);
    return next;
  }
  async ensureAccount(nodeId, input = {}) {
    const accountName = normalizeAccountName(input.accountName), passportId = normalizePassportId(input.passportId);
    const packet = await super.ensureAccount(nodeId, input);
    let account = await this.state.storage.get(accountKey(packet.account.accountId));
    account = await this.renameAccount(account, accountName);
    const passports = new Set(account.passportIds || []); passports.add(passportId);
    if (passports.size > HUB_ACCOUNT_POLICY.maxPassports) throw Object.assign(new RangeError('This account has reached its Passport association limit.'), { status: 409 });
    account = Object.freeze({ ...account, passportIds: Object.freeze([...passports]), updatedAt: nowIso(this.now()) });
    await this.state.storage.put(accountKey(account.accountId), account);
    account = await this.pairDevice(account, input, { activate: false });
    let recoveryKit = null;
    if (!recoveryHashes(account).length) ({ account, recoveryKit } = await this.issueRecoveryKit(account));
    return Object.freeze({ ok: true, account: publicAccount(account, await this.countPasskeys(account)), passportHasPasskey: await this.passportHasPasskey(account, passportId), recoveryKit });
  }
  async beginPassportRegistration(input = {}) { await this.assertCredential(input); return super.beginPassportRegistration(input); }
  async finishPassportRegistration(input = {}) {
    const packet = await super.finishPassportRegistration(input), account = await this.state.storage.get(accountKey(packet.account.accountId));
    return Object.freeze({ ...packet, account: publicAccount(account, await this.countPasskeys(account)) });
  }
  async beginRecoveryEmail(input = {}) { await this.assertCredential(input); return super.beginRecoveryEmail(input); }
  async verifyRecoveryEmail(nodeId, input = {}) {
    await this.assertCredential(input);
    const packet = await super.verifyRecoveryEmail(nodeId, input);
    if (!packet?.account?.accountId) return packet;
    const account = await this.state.storage.get(accountKey(packet.account.accountId));
    return Object.freeze({ ...packet, account: publicAccount(account, await this.countPasskeys(account)) });
  }
  async beginTotp(input = {}) {
    const account = await this.assertCredential(input);
    const secret = base32(crypto.getRandomValues(new Uint8Array(20)));
    const next = Object.freeze({ ...account, pendingTotpVault: await encryptText(secret, await this.secret()), pendingTotpCreatedAt: nowIso(this.now()), updatedAt: nowIso(this.now()) });
    await this.state.storage.put(accountKey(account.accountId), next);
    const label = encodeURIComponent(`Civweave:${account.accountName}`), issuer = encodeURIComponent('Civweave');
    return Object.freeze({ ok: true, secret, otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30` });
  }
  async verifyTotp(input = {}) {
    const account = await this.assertCredential(input);
    if (!account.pendingTotpVault) throw Object.assign(new Error('Start authenticator setup first.'), { status: 409 });
    const secret = await decryptText(account.pendingTotpVault, await this.secret());
    if (!await verifyTotpCode(secret, input.code, this.now())) throw Object.assign(new Error('Authenticator code did not match.'), { status: 403 });
    const next = Object.freeze({ ...account, totpSecretVault: await encryptText(secret, await this.secret()), totpVerifiedAt: nowIso(this.now()), pendingTotpVault: null, pendingTotpCreatedAt: null, updatedAt: nowIso(this.now()) });
    await this.state.storage.put(accountKey(account.accountId), next);
    return Object.freeze({ ok: true, account: publicAccount(next, await this.countPasskeys(next)) });
  }
  async verifyExistingTotp(account, code) {
    if (!account?.totpSecretVault) return false;
    const secret = await decryptText(account.totpSecretVault, await this.secret());
    return verifyTotpCode(secret, code, this.now());
  }
  async acknowledgeRecoveryKit(input = {}) {
    const account = await this.assertCredential(input);
    if (!recoveryHashes(account).length) throw Object.assign(new Error('No active recovery kit is available to acknowledge.'), { status: 409 });
    const next = Object.freeze({ ...account, recoveryKitAcknowledgedAt: account.recoveryKitAcknowledgedAt || nowIso(this.now()), updatedAt: nowIso(this.now()) });
    await this.state.storage.put(accountKey(account.accountId), next);
    return Object.freeze({ ok: true, account: publicAccount(next, await this.countPasskeys(next)) });
  }
  async consumeRecoveryCode(input = {}) {
    const code = normalizeRecoveryCode(input.code), hash = await sha256Hex(`civweave.passport-recovery-code.v1\n${code}`), key = recoveryCodeKey(hash);
    const record = await this.state.storage.get(key);
    if (!record?.accountId) throw Object.assign(new Error('Recovery code is invalid or already used.'), { status: 404 });
    const account = await this.state.storage.get(accountKey(record.accountId));
    if (!account) throw Object.assign(new Error('Hub account is unavailable.'), { status: 404 });
    await this.state.storage.delete(key);
    const hashes = recoveryHashes(account).filter(value => value !== hash);
    const next = Object.freeze({ ...account, recoveryCodeHashes: Object.freeze(hashes), lastRecoveredAt: nowIso(this.now()), updatedAt: nowIso(this.now()) });
    await this.state.storage.put(accountKey(account.accountId), next);
    return Object.freeze({ ok: true, account: publicAccount(next, await this.countPasskeys(next)), userId: next.userId, credential: normalizeCredential(await decryptText(next.credentialVault, await this.secret())), passportIds: [...(next.passportIds || [])], recoveryMethod: 'recovery-code', recoveredAt: nowIso(this.now()) });
  }
  async finishLogin(input = {}) {
    const packet = await super.finishLogin(input);
    let account = await this.state.storage.get(accountKey(packet.account.accountId));
    account = await this.pairDevice(account, input, { activate: false });
    return Object.freeze({ ...packet, account: publicAccount(account, await this.countPasskeys(account)) });
  }
  async finishPassportLink(input = {}) {
    const packet = await super.finishPassportLink(input);
    let account = await this.state.storage.get(accountKey(packet.account.accountId));
    account = await this.pairDevice(account, input, { activate: false });
    return Object.freeze({ ...packet, account: publicAccount(account, await this.countPasskeys(account)) });
  }
  async membershipReadiness(input = {}) {
    const account = await this.assertCredential(input);
    return Object.freeze({ ok: true, account: publicAccount(account, await this.countPasskeys(account)) });
  }
  async authorizeSession(input = {}, { allowOffline = false } = {}) {
    let account = await this.assertCredential(input);
    const factors = await this.countPasskeys(account);
    const onlineReady = Boolean(account.recoveryEmailVerifiedAt && account.recoveryKitAcknowledgedAt && (factors > 0 || account.totpVerifiedAt));
    const offlineReady = Boolean(account.recoveryKitAcknowledgedAt && (factors > 0 || account.totpVerifiedAt));
    if (!(allowOffline ? offlineReady : onlineReady)) {
      const error = new Error(allowOffline
        ? 'Offline Hub membership requires an acknowledged recovery kit and 2FA.'
        : 'Hub membership requires a verified recovery email, acknowledged recovery kit, and 2FA.');
      error.status = 428; error.code = 'hub-account-security-required'; error.account = publicAccount(account, factors); throw error;
    }
    if (account.totpVerifiedAt && factors < 1) {
      if (!await this.verifyExistingTotp(account, input.totpCode)) throw Object.assign(new Error('Enter the current authenticator code to activate this device.'), { status: 403, code: 'totp-required' });
    }
    account = await this.pairDevice(account, input, { activate: true });
    return Object.freeze({ ok: true, account: publicAccount(account, factors), userId: account.userId, credential: normalizeCredential(await decryptText(account.credentialVault, await this.secret())), deviceId: normalizeDeviceId(input.deviceId) });
  }
  async listDevices(input = {}) {
    const account = await this.assertCredential(input);
    return Object.freeze({ ok: true, devices: publicDevices(account), maxPairedDevices: HUB_ACCOUNT_POLICY.maxPairedDevices, maxActiveDevices: HUB_ACCOUNT_POLICY.maxActiveDevices });
  }
  async deactivateDevice(input = {}) {
    const account = await this.assertCredential(input), deviceId = normalizeDeviceId(input.deviceId), active = activeIds(account); active.delete(deviceId);
    const next = Object.freeze({ ...account, activeDeviceIds: Object.freeze([...active]), updatedAt: nowIso(this.now()) });
    await this.state.storage.put(accountKey(account.accountId), next);
    return Object.freeze({ ok: true, account: publicAccount(next, await this.countPasskeys(next)) });
  }
  async removeDevice(input = {}) {
    const account = await this.assertCredential(input), deviceId = normalizeDeviceId(input.deviceId);
    const rows = deviceRows(account).filter(row => row.deviceId !== deviceId), active = activeIds(account); active.delete(deviceId);
    const next = Object.freeze({ ...account, devices: Object.freeze(rows.map(Object.freeze)), activeDeviceIds: Object.freeze([...active]), updatedAt: nowIso(this.now()) });
    await this.state.storage.put(accountKey(account.accountId), next);
    return Object.freeze({ ok: true, account: publicAccount(next, await this.countPasskeys(next)) });
  }
  async detachPassport(input = {}) {
    const account = await this.assertCredential(input), passportId = normalizePassportId(input.passportId);
    const passports = (account.passportIds || []).filter(value => value !== passportId);
    if (!passports.length) throw Object.assign(new Error('Keep at least one Passport on the account. Remove the Hub membership instead if you want to free its seat.'), { status: 409 });
    const next = Object.freeze({ ...account, passportIds: Object.freeze(passports), updatedAt: nowIso(this.now()) });
    await this.state.storage.put(accountKey(account.accountId), next);
    return Object.freeze({ ok: true, account: publicAccount(next, await this.countPasskeys(next)) });
  }
  async setAnnualMemberRebateOptIn(input = {}) {
    const account = await this.assertCredential(input);
    const next = Object.freeze({ ...account, annualMemberRebateOptIn: input.optIn === true, annualMemberRebateOptInAt: input.optIn === true ? nowIso(this.now()) : null, updatedAt: nowIso(this.now()) });
    await this.state.storage.put(accountKey(account.accountId), next);
    return Object.freeze({ ok: true, account: publicAccount(next, await this.countPasskeys(next)) });
  }
}
