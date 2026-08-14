import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';

export const LOCAL_HUB_ACCOUNT_SCHEMA = 'civweave.local-hub-account.v1';
export const LOCAL_HUB_ACCOUNT_POLICY = Object.freeze({ maxPairedDevices: 10, maxActiveDevices: 2, maxPassports: 32, recoveryCodeCount: 8, activeLeaseMs: 24 * 60 * 60 * 1000 });

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const at = now => new Date(now()).toISOString();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function error(message, status = 400, code = '') { const out = new Error(message); out.status = status; if (code) out.code = code; return out; }
function accountName(value) {
  const name = clean(value, 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(name)) throw error('Choose a username with 6-64 lowercase letters, numbers, or hyphens.');
  return name;
}
function recoveryEmail(value) {
  const email = clean(value, 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw error('Enter a valid recovery email.');
  return email;
}
function passportId(value) {
  const id = clean(value, 180);
  if (!/^[A-Za-z0-9:._-]{6,180}$/.test(id)) throw error('A valid Passport id is required.');
  return id;
}
function deviceId(value) {
  const id = clean(value, 180);
  if (!/^[A-Za-z0-9:._-]{12,180}$/.test(id)) throw error('A valid device id is required.');
  return id;
}
function deviceLabel(value) { return clean(value, 100).replace(/[\u0000-\u001f\u007f]/g, '') || 'Civweave device'; }
function credential(value) {
  const token = clean(value, 400);
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(token)) throw error('A valid account device credential is required.', 401);
  return token;
}
function recoveryCode(value) {
  const code = clean(value, 400);
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(code)) throw error('Recovery code is invalid.', 400);
  return code;
}
function totpCode(value) {
  const code = clean(value, 20).replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) throw error('Enter the 6-digit authenticator code.');
  return code;
}
function randomToken(bytes = 32) { return crypto.randomBytes(bytes).toString('base64url'); }
function hash(domain, value) { return crypto.createHash('sha256').update(`${domain}\n${value}`).digest('hex'); }
function base32(bytes) {
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}
function fromBase32(text) {
  let bits = 0, value = 0; const out = [];
  for (const char of clean(text, 200).toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '')) {
    const index = BASE32.indexOf(char); if (index < 0) throw error('Authenticator secret is invalid.');
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function totpAt(secret, timestamp) {
  const counter = Math.floor(timestamp / 30000), bytes = Buffer.alloc(8); bytes.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', fromBase32(secret)).update(bytes).digest(), offset = digest[digest.length - 1] & 15;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1_000_000).padStart(6, '0');
}
function verifyTotp(secret, code, now) {
  const supplied = totpCode(code);
  return [-1, 0, 1].some(window => crypto.timingSafeEqual(Buffer.from(totpAt(secret, now + window * 30000)), Buffer.from(supplied)));
}
async function atomicWrite(file, value) {
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fsp.writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  await fsp.rename(temporary, file); await fsp.chmod(file, 0o600).catch(() => {});
}
async function lock(lockFile) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const handle = await fsp.open(lockFile, 'wx', 0o600); await handle.writeFile(`${process.pid}\n${Date.now()}\n`);
      return async () => { await handle.close().catch(() => {}); await fsp.unlink(lockFile).catch(() => {}); };
    } catch (cause) {
      if (cause?.code !== 'EEXIST') throw cause;
      const stat = await fsp.stat(lockFile).catch(() => null); if (stat && Date.now() - stat.mtimeMs > 15000) { await fsp.unlink(lockFile).catch(() => {}); continue; }
      await sleep(Math.min(250, 20 + attempt * 4));
    }
  }
  throw error('Local Hub account state is busy. Try again.', 503);
}
async function loadVaultKey(file) {
  try { const data = await fsp.readFile(file); if (data.length === 32) return data; throw new Error('wrong length'); }
  catch (cause) {
    if (cause?.code !== 'ENOENT') throw new Error(`Local Hub account vault key is invalid: ${cause.message}`);
    const key = crypto.randomBytes(32); await fsp.writeFile(file, key, { mode: 0o600 }); await fsp.chmod(file, 0o600).catch(() => {}); return key;
  }
}
function encrypt(secret, key) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv), ciphertext = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  return { algorithm: 'AES-256-GCM', iv: iv.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') };
}
function decrypt(record, key) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'base64url')); decipher.setAuthTag(Buffer.from(record.tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64url')), decipher.final()]).toString('utf8');
  } catch { throw error('Local Hub account vault could not unlock this account.', 503); }
}
function cleanExpiredActive(account, now) {
  const rows = Array.isArray(account.devices) ? account.devices : [], byId = new Map(rows.map(row => [row.deviceId, row]));
  account.activeDeviceIds = (Array.isArray(account.activeDeviceIds) ? account.activeDeviceIds : []).filter(id => {
    const row = byId.get(id), seen = Date.parse(row?.lastSeenAt || ''); return row && Number.isFinite(seen) && now - seen < LOCAL_HUB_ACCOUNT_POLICY.activeLeaseMs;
  });
}
function publicAccount(account, now) {
  cleanExpiredActive(account, now); const active = new Set(account.activeDeviceIds || []), devices = (account.devices || []).map(row => ({ deviceId: row.deviceId, label: row.label, pairedAt: row.pairedAt, lastSeenAt: row.lastSeenAt, active: active.has(row.deviceId) }));
  return Object.freeze({ schema: LOCAL_HUB_ACCOUNT_SCHEMA, accountId: account.accountId, accountName: account.accountName, recoveryEmailSet: Boolean(account.recoveryEmail), recoveryEmailVerified: Boolean(account.recoveryEmailVerifiedAt), recoveryEmailVerificationPending: Boolean(account.recoveryEmail && !account.recoveryEmailVerifiedAt), recoveryKitAcknowledged: Boolean(account.recoveryKitAcknowledgedAt), recoveryCodesRemaining: (account.recoveryCodeHashes || []).length, totpEnabled: Boolean(account.totpVerifiedAt), secondFactorReady: Boolean(account.totpVerifiedAt), offlineMembershipReady: Boolean(account.recoveryEmail && account.recoveryKitAcknowledgedAt && account.totpVerifiedAt), passportIds: [...(account.passportIds || [])], devices, pairedDeviceCount: devices.length, activeDeviceCount: devices.filter(row => row.active).length, maxPairedDevices: LOCAL_HUB_ACCOUNT_POLICY.maxPairedDevices, maxActiveDevices: LOCAL_HUB_ACCOUNT_POLICY.maxActiveDevices, createdAt: account.createdAt, updatedAt: account.updatedAt });
}

export function createLocalHubAccountStore({ dataDir = process.env.DATA_DIR || './data', nodeId = process.env.CIVWEAVE_FEDERATION_NODE_ID || 'local-federated-host', now = () => Date.now() } = {}) {
  const dir = path.resolve(dataDir), file = path.join(dir, 'local-hub-accounts-v1.json'), lockFile = `${file}.lock`, vaultFile = path.join(dir, 'local-hub-account-vault.key');
  let vaultPromise;
  const vault = () => vaultPromise ||= loadVaultKey(vaultFile);
  function empty() { return { schema: 'civweave.local-hub-account-registry.v1', nodeId: clean(nodeId, 180), accounts: {}, names: {}, createdAt: at(now()), updatedAt: at(now()) }; }
  async function read() { await fsp.mkdir(dir, { recursive: true }); try { const state = JSON.parse(await fsp.readFile(file, 'utf8')); if (state?.schema !== 'civweave.local-hub-account-registry.v1' || typeof state.accounts !== 'object' || typeof state.names !== 'object') throw new Error('invalid schema'); return state; } catch (cause) { if (cause?.code === 'ENOENT') return empty(); throw new Error(`Local Hub account registry is invalid: ${cause.message}`); } }
  async function mutate(worker) { const release = await lock(lockFile); try { const state = await read(), result = await worker(state); state.updatedAt = at(now()); await atomicWrite(file, state); return result; } finally { await release(); } }
  function byName(state, raw) { const name = accountName(raw), id = state.names[name], account = id ? state.accounts[id] : null; return { name, account }; }
  async function verifyCredential(state, rawName, rawCredential) { const { name, account } = byName(state, rawName); if (!account) throw error('Local Hub account was not found.', 404); const supplied = credential(rawCredential), suppliedHash = hash('civweave.local-hub-credential.v1', supplied); if (!account.credentialHash || !crypto.timingSafeEqual(Buffer.from(account.credentialHash), Buffer.from(suppliedHash))) throw error('Local Hub account credential is invalid.', 401); return { name, account, supplied }; }
  function issueRecoveryKit(account) { const codes = Array.from({ length: LOCAL_HUB_ACCOUNT_POLICY.recoveryCodeCount }, () => randomToken(24)); account.recoveryCodeHashes = codes.map(code => hash('civweave.local-hub-recovery.v1', code)); account.recoveryKitAcknowledgedAt = null; account.recoveryKitIssuedAt = at(now()); return Object.freeze({ schema: 'civweave.local-hub-recovery-kit.v1', codes: Object.freeze(codes), acknowledgementRequired: true }); }
  function pair(account, rawDeviceId, rawLabel) { const id = deviceId(rawDeviceId), label = deviceLabel(rawLabel), rows = account.devices ||= [], found = rows.find(row => row.deviceId === id), stamp = at(now()); if (!found) { if (rows.length >= LOCAL_HUB_ACCOUNT_POLICY.maxPairedDevices) throw error('This account already has 10 paired devices. Remove one before pairing another.', 409, 'paired-device-limit'); rows.push({ deviceId: id, label, pairedAt: stamp, lastSeenAt: stamp }); } else { found.label = label || found.label; found.lastSeenAt = stamp; } return id; }
  function activate(account, id, replaceDeviceId = '') { cleanExpiredActive(account, now()); const active = new Set(account.activeDeviceIds || []); if (!active.has(id) && active.size >= LOCAL_HUB_ACCOUNT_POLICY.maxActiveDevices) { const replace = clean(replaceDeviceId, 180); if (!replace || !active.has(replace) || replace === id) { const problem = error('Two devices are already active. Deactivate one to continue.', 409, 'active-device-limit'); problem.activeDevices = publicAccount(account, now()).devices.filter(row => row.active); throw problem; } active.delete(replace); } active.add(id); account.activeDeviceIds = [...active]; }
  async function create(input = {}) { return mutate(async state => { const name = accountName(input.accountName), email = recoveryEmail(input.recoveryEmail), pass = passportId(input.passportId); if (state.names[name]) throw error('That username already exists on this Hub. Sign in or recover it instead.', 409, 'account-exists'); const accountId = `localacct:${crypto.randomUUID()}`, rawCredential = randomToken(32), secret = base32(crypto.randomBytes(20)), stamp = at(now()), account = { schema: LOCAL_HUB_ACCOUNT_SCHEMA, accountId, accountName: name, recoveryEmail: email, recoveryEmailVerifiedAt: null, credentialHash: hash('civweave.local-hub-credential.v1', rawCredential), pendingTotpVault: encrypt(secret, await vault()), totpSecretVault: null, totpVerifiedAt: null, passportIds: [pass], devices: [], activeDeviceIds: [], createdAt: stamp, updatedAt: stamp }; pair(account, input.deviceId, input.deviceLabel); const recoveryKit = issueRecoveryKit(account); state.accounts[accountId] = account; state.names[name] = accountId; return Object.freeze({ ok: true, account: publicAccount(account, now()), credential: rawCredential, recoveryKit, totp: Object.freeze({ secret, otpauthUri: `otpauth://totp/${encodeURIComponent(`Civweave:${name}`)}?secret=${secret}&issuer=${encodeURIComponent('Civweave')}&algorithm=SHA1&digits=6&period=30` }) }); }); }
  async function verifyTotpSetup(input = {}) { return mutate(async state => { const { account } = await verifyCredential(state, input.accountName, input.credential); if (!account.pendingTotpVault) throw error('Start authenticator setup again.', 409); const secret = decrypt(account.pendingTotpVault, await vault()); if (!verifyTotp(secret, input.code, now())) throw error('Authenticator code did not match.', 403); account.totpSecretVault = encrypt(secret, await vault()); account.pendingTotpVault = null; account.totpVerifiedAt = at(now()); account.updatedAt = at(now()); return Object.freeze({ ok: true, account: publicAccount(account, now()) }); }); }
  async function acknowledgeRecoveryKit(input = {}) { return mutate(async state => { const { account } = await verifyCredential(state, input.accountName, input.credential); if (!(account.recoveryCodeHashes || []).length) throw error('No recovery kit is active.', 409); account.recoveryKitAcknowledgedAt ||= at(now()); account.updatedAt = at(now()); return Object.freeze({ ok: true, account: publicAccount(account, now()) }); }); }
  async function regenerateRecoveryKit(input = {}) { return mutate(async state => { const { account } = await verifyCredential(state, input.accountName, input.credential); const recoveryKit = issueRecoveryKit(account); account.updatedAt = at(now()); return Object.freeze({ ok: true, account: publicAccount(account, now()), recoveryKit }); }); }
  async function readiness(input = {}) { const state = await read(), { account } = await verifyCredential(state, input.accountName, input.credential); return Object.freeze({ ok: true, account: publicAccount(account, now()) }); }
  async function authorize(input = {}) { return mutate(async state => { const { account } = await verifyCredential(state, input.accountName, input.credential); if (!account.recoveryEmail || !account.recoveryKitAcknowledgedAt || !account.totpVerifiedAt) throw error('Offline Hub membership requires a recovery email, saved recovery kit, and authenticator 2FA.', 428, 'hub-account-security-required'); const secret = decrypt(account.totpSecretVault, await vault()); if (!verifyTotp(secret, input.totpCode, now())) throw error('Enter the current authenticator code to join this Hub.', 403, 'totp-required'); const id = pair(account, input.deviceId, input.deviceLabel); activate(account, id, input.replaceDeviceId); const pass = input.passportId ? passportId(input.passportId) : ''; if (pass && !account.passportIds.includes(pass)) { if (account.passportIds.length >= LOCAL_HUB_ACCOUNT_POLICY.maxPassports) throw error('This account has reached its Passport association limit.', 409); account.passportIds.push(pass); } account.updatedAt = at(now()); return Object.freeze({ ok: true, accountId: account.accountId, account: publicAccount(account, now()) }); }); }
  async function recover(input = {}) { return mutate(async state => { const { account } = byName(state, input.accountName); if (!account) throw error('Local Hub account was not found.', 404); const supplied = recoveryCode(input.recoveryCode), codeHash = hash('civweave.local-hub-recovery.v1', supplied), index = (account.recoveryCodeHashes || []).indexOf(codeHash); if (index < 0) throw error('Recovery code is invalid or already used.', 404); if (!account.totpVerifiedAt || !account.totpSecretVault) throw error('This account does not have verified authenticator 2FA.', 409); const secret = decrypt(account.totpSecretVault, await vault()); if (!verifyTotp(secret, input.totpCode, now())) throw error('Authenticator code did not match.', 403); account.recoveryCodeHashes.splice(index, 1); const rawCredential = randomToken(32); account.credentialHash = hash('civweave.local-hub-credential.v1', rawCredential); pair(account, input.deviceId, input.deviceLabel); account.updatedAt = at(now()); return Object.freeze({ ok: true, account: publicAccount(account, now()), credential: rawCredential, recoveryCodesRemaining: account.recoveryCodeHashes.length }); }); }
  async function deactivateDevice(input = {}) { return mutate(async state => { const { account } = await verifyCredential(state, input.accountName, input.credential), id = deviceId(input.deviceId); account.activeDeviceIds = (account.activeDeviceIds || []).filter(value => value !== id); account.updatedAt = at(now()); return Object.freeze({ ok: true, account: publicAccount(account, now()) }); }); }
  async function removeDevice(input = {}) { return mutate(async state => { const { account } = await verifyCredential(state, input.accountName, input.credential), id = deviceId(input.deviceId); account.devices = (account.devices || []).filter(row => row.deviceId !== id); account.activeDeviceIds = (account.activeDeviceIds || []).filter(value => value !== id); account.updatedAt = at(now()); return Object.freeze({ ok: true, account: publicAccount(account, now()) }); }); }
  async function listAccounts() { const state = await read(); return Object.freeze(Object.values(state.accounts).map(account => publicAccount(account, now())).sort((a, b) => a.accountName.localeCompare(b.accountName))); }
  return Object.freeze({ schema: LOCAL_HUB_ACCOUNT_SCHEMA, file, create, verifyTotpSetup, acknowledgeRecoveryKit, regenerateRecoveryKit, readiness, authorize, recover, deactivateDevice, removeDevice, listAccounts });
}
