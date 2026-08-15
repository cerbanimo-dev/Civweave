const enc = new TextEncoder();
const dec = new TextDecoder();

export const PASSPORT_ACCOUNT_SCHEMA = 'civweave.passport-account.v1';
export const PASSKEY_SCHEMA = 'civweave.passport-passkey.v1';
export const PASSKEY_CHALLENGE_TTL_MS = 10 * 60 * 1000;

const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const nowIso = now => new Date(now).toISOString();

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
async function sha256Bytes(value) { return new Uint8Array(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? enc.encode(value) : value)); }
async function sha256Hex(value) { return [...await sha256Bytes(value)].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
function normalizeResidentId(value) {
  const userId = clean(value, 180);
  if (!/^[A-Za-z0-9:_-]{12,180}$/.test(userId)) throw Object.assign(new TypeError('A valid Guild resident id is required.'), { status: 400 });
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
function normalizeRecoveryEmail(value) {
  const email = clean(value, 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw Object.assign(new TypeError('Enter a valid recovery email.'), { status: 400 });
  return email;
}
function maskEmail(email) {
  if (!email) return '';
  const [local, domain] = normalizeRecoveryEmail(email).split('@');
  return `${local.slice(0, Math.min(2, local.length))}${'•'.repeat(Math.max(2, Math.min(8, local.length - 2)))}@${domain}`;
}
function normalizeAccountName(value) {
  const name = clean(value, 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(name)) throw Object.assign(new TypeError('Account name is invalid.'), { status: 400 });
  return name;
}
function normalizeRpId(value) {
  const rpId = clean(value, 253).toLowerCase();
  if (!/^(?:localhost|[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?)$/.test(rpId) || rpId.includes('..')) throw Object.assign(new TypeError('Passkey RP id is invalid.'), { status: 400 });
  return rpId;
}
function normalizeOrigin(value, rpId) {
  let url;
  try { url = new URL(clean(value, 1000)); } catch { throw Object.assign(new TypeError('Passkey origin is invalid.'), { status: 400 }); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Object.assign(new TypeError('Passkey origin is invalid.'), { status: 400 });
  if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') throw Object.assign(new TypeError('Passkeys require a secure origin.'), { status: 400 });
  if (url.hostname !== rpId && !url.hostname.endsWith(`.${rpId}`)) throw Object.assign(new TypeError('Passkey RP id does not match this origin.'), { status: 400 });
  return url.origin;
}
function accountKey(accountId) { return `hub-account:${clean(accountId, 180)}`; }
function residentKey(userId) { return `hub-resident:${normalizeResidentId(userId)}`; }
function accountNameKey(name) { return `hub-account-name:${normalizeAccountName(name)}`; }
function passkeyKey(hash) { return `hub-passkey:${clean(hash, 128)}`; }
function challengeKey(hash) { return `hub-passkey-challenge:${clean(hash, 128)}`; }

async function vaultKey(secret) {
  const source = clean(secret, 20000);
  if (source.length < 20) throw Object.assign(new Error('Guild account vault identity is unavailable.'), { status: 503 });
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`civweave.hub-account-vault.v1\n${source}`));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function encryptCredential(credential, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await vaultKey(secret), enc.encode(normalizeCredential(credential)));
  return Object.freeze({ algorithm: 'AES-GCM', iv: b64url(iv), ciphertext: b64url(ciphertext) });
}
async function decryptCredential(record, secret) {
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(record.iv) }, await vaultKey(secret), fromB64url(record.ciphertext));
    return normalizeCredential(dec.decode(plain));
  } catch { throw Object.assign(new Error('Guild account vault could not unlock this account.'), { status: 503 }); }
}
function generatedAccountName() {
  const token = randomToken(7).toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(9, 'x').slice(0, 9);
  return `weave-${token}`;
}
function generatedMailbox() { return `u_${randomToken(18).toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(24, 'x').slice(0, 24)}@relay.cerbanimo.cc`; }
async function credentialHash(credentialId) {
  const id = clean(credentialId, 2000);
  if (!/^[A-Za-z0-9_-]{16,2000}$/.test(id)) throw Object.assign(new TypeError('Passkey credential id is invalid.'), { status: 400 });
  return sha256Hex(`civweave.passkey-id.v1\n${id}`);
}
async function challengeHash(token) {
  const value = clean(token, 400);
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(value)) throw Object.assign(new TypeError('Passkey challenge token is invalid.'), { status: 400 });
  return sha256Hex(`civweave.passkey-challenge.v1\n${value}`);
}
function parseClientData(value) {
  try { return JSON.parse(dec.decode(fromB64url(value))); } catch { throw Object.assign(new TypeError('Passkey client data is invalid.'), { status: 400 }); }
}
function uint32be(bytes, offset) { return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0; }
function cborLength(bytes, offset, ai) {
  if (ai < 24) return { value: ai, offset };
  if (ai === 24) return { value: bytes[offset], offset: offset + 1 };
  if (ai === 25) return { value: (bytes[offset] << 8) | bytes[offset + 1], offset: offset + 2 };
  if (ai === 26) return { value: uint32be(bytes, offset), offset: offset + 4 };
  throw Object.assign(new TypeError('Passkey attestation uses an unsupported CBOR length.'), { status: 400 });
}
function readCbor(bytes, start = 0) {
  const head = bytes[start];
  if (head == null) throw Object.assign(new TypeError('Passkey attestation CBOR is truncated.'), { status: 400 });
  const major = head >> 5, ai = head & 31;
  let cursor = start + 1;
  const length = cborLength(bytes, cursor, ai), n = length.value; cursor = length.offset;
  if (major === 0) return { value: n, offset: cursor };
  if (major === 1) return { value: -1 - n, offset: cursor };
  if (major === 2 || major === 3) {
    const end = cursor + n;
    if (end > bytes.length) throw Object.assign(new TypeError('Passkey attestation CBOR is truncated.'), { status: 400 });
    const value = bytes.slice(cursor, end);
    return { value: major === 2 ? value : dec.decode(value), offset: end };
  }
  if (major === 4) {
    const value = [];
    for (let i = 0; i < n; i += 1) { const item = readCbor(bytes, cursor); value.push(item.value); cursor = item.offset; }
    return { value, offset: cursor };
  }
  if (major === 5) {
    const value = new Map();
    for (let i = 0; i < n; i += 1) { const key = readCbor(bytes, cursor); cursor = key.offset; const item = readCbor(bytes, cursor); cursor = item.offset; value.set(key.value, item.value); }
    return { value, offset: cursor };
  }
  if (major === 7 && ai === 20) return { value: false, offset: cursor };
  if (major === 7 && ai === 21) return { value: true, offset: cursor };
  if (major === 7 && ai === 22) return { value: null, offset: cursor };
  throw Object.assign(new TypeError('Passkey attestation CBOR type is unsupported.'), { status: 400 });
}
async function verifiedAttestationSpki(attestationObject, credentialId, rpId) {
  const top = readCbor(fromB64url(attestationObject)).value;
  const authData = top instanceof Map ? top.get('authData') : null;
  if (!(authData instanceof Uint8Array) || authData.length < 55) throw Object.assign(new Error('Passkey attestation data is invalid.'), { status: 400 });
  const expectedRpHash = await sha256Bytes(rpId);
  for (let i = 0; i < 32; i += 1) if (authData[i] !== expectedRpHash[i]) throw Object.assign(new Error('Passkey registration RP verification failed.'), { status: 400 });
  const flags = authData[32];
  if (!(flags & 0x01) || !(flags & 0x04) || !(flags & 0x40)) throw Object.assign(new Error('Passkey registration requires user verification and attested credential data.'), { status: 403 });
  let cursor = 53;
  const credentialLength = (authData[cursor] << 8) | authData[cursor + 1]; cursor += 2;
  const attestedId = authData.slice(cursor, cursor + credentialLength); cursor += credentialLength;
  const suppliedId = fromB64url(credentialId);
  if (attestedId.length !== suppliedId.length || attestedId.some((byte, index) => byte !== suppliedId[index])) throw Object.assign(new Error('Passkey credential id did not match its attestation.'), { status: 400 });
  const cose = readCbor(authData, cursor).value;
  if (!(cose instanceof Map) || cose.get(1) !== 2 || cose.get(3) !== -7 || cose.get(-1) !== 1) throw Object.assign(new Error('Only ES256 P-256 passkeys are supported.'), { status: 400 });
  const x = cose.get(-2), y = cose.get(-3);
  if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array) || x.length !== 32 || y.length !== 32) throw Object.assign(new Error('Passkey public key is invalid.'), { status: 400 });
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64url(x), y: b64url(y), ext: true, key_ops: ['verify'] }, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
  return new Uint8Array(await crypto.subtle.exportKey('spki', key));
}
function derToRaw(signature) {
  const bytes = fromB64url(signature);
  if (bytes[0] !== 0x30) throw Object.assign(new TypeError('Passkey signature is invalid.'), { status: 400 });
  let i = 2;
  if (bytes[1] & 0x80) i = 2 + (bytes[1] & 0x7f);
  if (bytes[i++] !== 0x02) throw Object.assign(new TypeError('Passkey signature is invalid.'), { status: 400 });
  const rlen = bytes[i++], r = bytes.slice(i, i += rlen);
  if (bytes[i++] !== 0x02) throw Object.assign(new TypeError('Passkey signature is invalid.'), { status: 400 });
  const slen = bytes[i++], s = bytes.slice(i, i + slen), out = new Uint8Array(64);
  const rr = r[0] === 0 ? r.slice(1) : r, ss = s[0] === 0 ? s.slice(1) : s;
  if (rr.length > 32 || ss.length > 32) throw Object.assign(new TypeError('Passkey signature is invalid.'), { status: 400 });
  out.set(rr, 32 - rr.length); out.set(ss, 64 - ss.length); return out;
}
function publicAccount(account, passkeyCount = 0) {
  return Object.freeze({ schema: PASSPORT_ACCOUNT_SCHEMA, accountId: account.accountId, accountName: account.accountName, nodeId: account.nodeId, userId: account.userId, passportIds: [...(account.passportIds || [])], passkeyCount, mailboxManaged: Boolean(account.hiddenMailbox), recoveryEmailSet: Boolean(account.recoveryEmail), recoveryEmail: account.recoveryEmail ? maskEmail(account.recoveryEmail) : '', recoveryEmailVerified: Boolean(account.recoveryEmailVerifiedAt), createdAt: account.createdAt, updatedAt: account.updatedAt });
}

export class PassportAccountService {
  constructor(state, env, { vaultSecret, now = () => Date.now(), directoryOrigin = '' } = {}) {
    this.state = state; this.env = env || {}; this.vaultSecret = vaultSecret; this.now = now;
    this.directoryOrigin = clean(directoryOrigin || env?.CIVWEAVE_ACCOUNT_DIRECTORY_ORIGIN || 'https://civweave-node-cloud.cerbanimo.workers.dev', 1000).replace(/\/+$/, '');
  }
  async secret() { const value = typeof this.vaultSecret === 'function' ? await this.vaultSecret() : this.vaultSecret; return clean(value, 20000); }
  async accountForResident(userId) { const id = await this.state.storage.get(residentKey(userId)); return id ? this.state.storage.get(accountKey(id)) : null; }
  async accountForName(name) { const id = await this.state.storage.get(accountNameKey(name)); return id ? this.state.storage.get(accountKey(id)) : null; }
  async countPasskeys(account) { return Array.isArray(account?.passkeyHashes) ? account.passkeyHashes.length : 0; }
  async ensureAccount(nodeId, input = {}) {
    const userId = normalizeResidentId(input.userId), passportId = normalizePassportId(input.passportId), credential = normalizeCredential(input.credential), now = this.now();
    let account = await this.accountForResident(userId);
    if (!account) {
      let accountName;
      for (let i = 0; i < 8; i += 1) { const candidate = generatedAccountName(); if (!await this.state.storage.get(accountNameKey(candidate))) { accountName = candidate; break; } }
      if (!accountName) throw Object.assign(new Error('Could not allocate a unique account name.'), { status: 503 });
      const accountId = `hubacct:${crypto.randomUUID()}`;
      account = Object.freeze({ schema: PASSPORT_ACCOUNT_SCHEMA, accountId, accountName, nodeId: clean(nodeId, 180), userId, residentIds: Object.freeze([userId]), hiddenMailbox: generatedMailbox(), recoveryEmail: '', recoveryEmailVerifiedAt: null, passportIds: Object.freeze([passportId]), passkeyHashes: Object.freeze([]), credentialVault: await encryptCredential(credential, await this.secret()), createdAt: nowIso(now), updatedAt: nowIso(now) });
      await this.state.storage.put({ [accountKey(accountId)]: account, [residentKey(userId)]: accountId, [accountNameKey(accountName)]: accountId });
    } else {
      const passports = new Set(account.passportIds || []); passports.add(passportId);
      const residents = new Set(account.residentIds || [account.userId]); residents.add(userId);
      let accountName = account.accountName;
      if (!accountName) {
        for (let i = 0; i < 8; i += 1) { const candidate = generatedAccountName(); if (!await this.state.storage.get(accountNameKey(candidate))) { accountName = candidate; break; } }
        if (!accountName) throw Object.assign(new Error('Could not allocate a unique account name.'), { status: 503 });
      }
      account = Object.freeze({ ...account, schema: PASSPORT_ACCOUNT_SCHEMA, accountName, hiddenMailbox: account.hiddenMailbox || generatedMailbox(), recoveryEmail: account.recoveryEmail || account.email || '', recoveryEmailVerifiedAt: account.recoveryEmailVerifiedAt || account.emailVerifiedAt || null, residentIds: Object.freeze([...residents]), passportIds: Object.freeze([...passports]), passkeyHashes: Object.freeze([...(account.passkeyHashes || [])]), credentialVault: account.credentialVault || await encryptCredential(credential, await this.secret()), updatedAt: nowIso(now) });
      await this.state.storage.put({ [accountKey(account.accountId)]: account, [residentKey(userId)]: account.accountId, [accountNameKey(account.accountName)]: account.accountId });
    }
    return Object.freeze({ ok: true, account: publicAccount(account, await this.countPasskeys(account)), passportHasPasskey: await this.passportHasPasskey(account, passportId) });
  }
  async passportHasPasskey(account, passportId) {
    for (const hash of account.passkeyHashes || []) { const record = await this.state.storage.get(passkeyKey(hash)); if (record?.passportId === passportId) return true; }
    return false;
  }
  async beginRegistration(account, passportId, rpId, origin) {
    const challenge = randomToken(32), token = randomToken(32), normalizedRp = normalizeRpId(rpId), normalizedOrigin = normalizeOrigin(origin, normalizedRp);
    await this.state.storage.put(challengeKey(await challengeHash(token)), Object.freeze({ schema: PASSKEY_SCHEMA, purpose: 'register', accountId: account.accountId, passportId, challenge, rpId: normalizedRp, origin: normalizedOrigin, expiresAt: this.now() + PASSKEY_CHALLENGE_TTL_MS }));
    return Object.freeze({ token, publicKey: { challenge, rp: { id: normalizedRp, name: 'Civweave' }, user: { id: b64url(await sha256Bytes(account.accountId)), name: account.accountName, displayName: account.accountName }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }], timeout: 60000, attestation: 'none', authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' } } });
  }
  async beginPassportRegistration(input = {}) {
    const userId = normalizeResidentId(input.userId), passportId = normalizePassportId(input.passportId), account = await this.accountForResident(userId);
    if (!account) throw Object.assign(new Error('Create the Guild account first.'), { status: 404 });
    if (await this.passportHasPasskey(account, passportId)) return Object.freeze({ ok: true, alreadyRegistered: true, account: publicAccount(account, await this.countPasskeys(account)) });
    return Object.freeze({ ok: true, ...(await this.beginRegistration(account, passportId, input.rpId, input.origin)) });
  }
  async consumeChallenge(token, purpose) {
    const key = challengeKey(await challengeHash(token)), record = await this.state.storage.get(key);
    if (!record || record.purpose !== purpose || Number(record.expiresAt) <= this.now()) { if (record) await this.state.storage.delete(key); throw Object.assign(new Error('Passkey challenge expired or is invalid.'), { status: 400 }); }
    await this.state.storage.delete(key); return record;
  }
  async finishPassportRegistration(input = {}) {
    const record = await this.consumeChallenge(input.token, 'register'), client = parseClientData(input.clientDataJSON);
    if (client.type !== 'webauthn.create' || client.challenge !== record.challenge || client.origin !== record.origin) throw Object.assign(new Error('Passkey registration proof did not match the challenge.'), { status: 400 });
    const spki = await verifiedAttestationSpki(input.attestationObject, input.credentialId, record.rpId), hash = await credentialHash(input.credentialId);
    if (await this.state.storage.get(passkeyKey(hash))) throw Object.assign(new Error('That passkey is already registered.'), { status: 409 });
    let account = await this.state.storage.get(accountKey(record.accountId)); if (!account) throw Object.assign(new Error('Guild account is unavailable.'), { status: 404 });
    const passkey = Object.freeze({ schema: PASSKEY_SCHEMA, accountId: account.accountId, passportId: record.passportId, credentialId: clean(input.credentialId, 2000), publicKeySpki: b64url(spki), rpId: record.rpId, origin: record.origin, signCount: 0, transports: Array.isArray(input.transports) ? input.transports.map(v => clean(v, 40)).filter(Boolean).slice(0, 8) : [], createdAt: nowIso(this.now()), lastUsedAt: null });
    const hashes = new Set(account.passkeyHashes || []); hashes.add(hash); const passports = new Set(account.passportIds || []); passports.add(record.passportId);
    account = Object.freeze({ ...account, passkeyHashes: Object.freeze([...hashes]), passportIds: Object.freeze([...passports]), updatedAt: nowIso(this.now()) });
    await this.state.storage.put({ [passkeyKey(hash)]: passkey, [accountKey(account.accountId)]: account });
    return Object.freeze({ ok: true, account: publicAccount(account, hashes.size), passportHasPasskey: true });
  }
  async beginAuthentication(account, rpId, origin, purpose = 'login', extra = {}) {
    const keys = [];
    for (const hash of account.passkeyHashes || []) { const record = await this.state.storage.get(passkeyKey(hash)); if (record?.credentialId) keys.push(record); }
    if (!keys.length) throw Object.assign(new Error('This account has no passkey yet.'), { status: 409 });
    const normalizedRp = normalizeRpId(rpId), normalizedOrigin = normalizeOrigin(origin, normalizedRp), matching = keys.filter(key => key.rpId === normalizedRp && key.origin === normalizedOrigin);
    if (!matching.length) throw Object.assign(new Error('No passkey for this Civweave origin is registered on the account.'), { status: 409 });
    const challenge = randomToken(32), token = randomToken(32);
    await this.state.storage.put(challengeKey(await challengeHash(token)), Object.freeze({ schema: PASSKEY_SCHEMA, purpose, accountId: account.accountId, challenge, rpId: normalizedRp, origin: normalizedOrigin, expiresAt: this.now() + PASSKEY_CHALLENGE_TTL_MS, ...extra }));
    return Object.freeze({ token, publicKey: { challenge, rpId: normalizedRp, timeout: 60000, userVerification: 'required', allowCredentials: matching.map(key => ({ type: 'public-key', id: key.credentialId, transports: key.transports || [] })) } });
  }
  async verifyAssertion(input, purpose) {
    const challenge = await this.consumeChallenge(input.token, purpose), client = parseClientData(input.clientDataJSON);
    if (client.type !== 'webauthn.get' || client.challenge !== challenge.challenge || client.origin !== challenge.origin) throw Object.assign(new Error('Passkey assertion did not match the challenge.'), { status: 400 });
    const hash = await credentialHash(input.credentialId), passkey = await this.state.storage.get(passkeyKey(hash));
    if (!passkey || passkey.accountId !== challenge.accountId || passkey.rpId !== challenge.rpId || passkey.origin !== challenge.origin) throw Object.assign(new Error('Passkey is not registered to this account.'), { status: 403 });
    const authData = fromB64url(input.authenticatorData); if (authData.length < 37) throw Object.assign(new Error('Passkey authenticator data is invalid.'), { status: 400 });
    const expectedRpHash = await sha256Bytes(challenge.rpId); for (let i = 0; i < 32; i += 1) if (authData[i] !== expectedRpHash[i]) throw Object.assign(new Error('Passkey RP verification failed.'), { status: 400 });
    if (!(authData[32] & 0x01) || !(authData[32] & 0x04)) throw Object.assign(new Error('Passkey user verification is required.'), { status: 403 });
    const clientHash = await sha256Bytes(fromB64url(input.clientDataJSON)), signed = new Uint8Array(authData.length + clientHash.length); signed.set(authData); signed.set(clientHash, authData.length);
    const publicKey = await crypto.subtle.importKey('spki', fromB64url(passkey.publicKeySpki), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, derToRaw(input.signature), signed)) throw Object.assign(new Error('Passkey signature verification failed.'), { status: 403 });
    const count = uint32be(authData, 33); if (count && passkey.signCount && count <= passkey.signCount) throw Object.assign(new Error('Passkey counter moved backwards; credential may have been cloned.'), { status: 409 });
    await this.state.storage.put(passkeyKey(hash), Object.freeze({ ...passkey, signCount: Math.max(passkey.signCount || 0, count), lastUsedAt: nowIso(this.now()) }));
    const account = await this.state.storage.get(accountKey(passkey.accountId)); if (!account) throw Object.assign(new Error('Guild account is unavailable.'), { status: 404 });
    return { challenge, account, passkey };
  }
  async beginLogin(input = {}) {
    const account = await this.accountForName(input.accountName); if (!account) throw Object.assign(new Error('Account or passkey was not available.'), { status: 404 });
    return Object.freeze({ ok: true, ...(await this.beginAuthentication(account, input.rpId, input.origin, 'login')) });
  }
  async finishLogin(input = {}) {
    const { account } = await this.verifyAssertion(input, 'login');
    return Object.freeze({ ok: true, account: publicAccount(account, await this.countPasskeys(account)), userId: account.userId, credential: await decryptCredential(account.credentialVault, await this.secret()), passportIds: [...(account.passportIds || [])], recoveredAt: nowIso(this.now()), recoveryMethod: 'passkey' });
  }
  async directory(path, body) {
    const response = await fetch(`${this.directoryOrigin}/api/account-directory/${path}`, { method: 'POST', cache: 'no-store', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
    const packet = await response.json().catch(() => ({})); if (!response.ok || packet?.ok === false) throw Object.assign(new Error(packet?.error || `Account directory returned HTTP ${response.status}.`), { status: response.status }); return packet;
  }
  async beginRecoveryEmail(input = {}) {
    normalizeResidentId(input.userId); const email = normalizeRecoveryEmail(input.email), packet = await this.directory('begin', { email, purpose: 'account-link-or-recovery' });
    return Object.freeze({ ok: true, accepted: true, challengeToken: packet.challengeToken, message: 'Check that address for the next step.' });
  }
  async verifyRecoveryEmail(nodeId, input = {}) {
    const userId = normalizeResidentId(input.userId), account = await this.accountForResident(userId); if (!account) throw Object.assign(new Error('Guild account is unavailable.'), { status: 404 });
    const proof = await this.directory('verify', { challengeToken: clean(input.challengeToken, 400), code: clean(input.code, 40) });
    if (proof.existing && proof.locator && (proof.locator.nodeId !== nodeId || proof.locator.accountId !== account.accountId)) return Object.freeze({ ok: true, verified: true, linkRequired: true, proofToken: proof.proofToken, locator: proof.locator, message: 'Recovery address verified. Confirm an existing account passkey to add this Passport.' });
    const claim = await this.directory('claim', { proofToken: proof.proofToken, locator: { nodeId, accountId: account.accountId, accountName: account.accountName, origin: clean(input.hubOrigin, 1000) } });
    if (claim.existing && (claim.locator?.nodeId !== nodeId || claim.locator?.accountId !== account.accountId)) return Object.freeze({ ok: true, verified: true, linkRequired: true, proofToken: claim.proofToken || proof.proofToken, locator: claim.locator, message: 'Recovery address verified. Confirm an existing account passkey to add this Passport.' });
    const email = normalizeRecoveryEmail(claim.email || proof.email), next = Object.freeze({ ...account, recoveryEmail: email, recoveryEmailVerifiedAt: nowIso(this.now()), updatedAt: nowIso(this.now()) });
    await this.state.storage.put(accountKey(account.accountId), next); return Object.freeze({ ok: true, verified: true, linkRequired: false, account: publicAccount(next, await this.countPasskeys(next)) });
  }
  async beginPassportLink(nodeId, input = {}) {
    const proof = await this.directory('consume', { proofToken: clean(input.proofToken, 400) });
    if (!proof?.existing || proof.locator?.nodeId !== nodeId) throw Object.assign(new Error('This account-link proof belongs to another Guild.'), { status: 403 });
    const account = await this.state.storage.get(accountKey(proof.locator.accountId)); if (!account) throw Object.assign(new Error('Existing Guild account is unavailable.'), { status: 404 });
    return Object.freeze({ ok: true, ...(await this.beginAuthentication(account, input.rpId, input.origin, 'link-auth', { passportId: normalizePassportId(input.passportId) })) });
  }
  async authenticatePassportLink(input = {}) {
    const { challenge, account } = await this.verifyAssertion(input, 'link-auth'), registration = await this.beginRegistration(account, normalizePassportId(challenge.passportId), input.rpId, input.origin);
    return Object.freeze({ ok: true, accountName: account.accountName, ...registration });
  }
  async finishPassportLink(input = {}) {
    const packet = await this.finishPassportRegistration(input), account = await this.state.storage.get(accountKey(packet.account.accountId));
    return Object.freeze({ ...packet, linked: true, userId: account.userId, credential: await decryptCredential(account.credentialVault, await this.secret()), passportIds: [...(account.passportIds || [])], recoveredAt: nowIso(this.now()), recoveryMethod: 'email+existing-passkey' });
  }
}