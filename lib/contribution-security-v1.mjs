import { createHash, randomBytes, createCipheriv, createDecipheriv, webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;
const encoder = new TextEncoder();

export const CONTRIBUTION_SECURITY_PROTOCOL = 'civweave.contribution-security.v1';
export const POLICY_ANCHOR_PROTOCOL = 'civweave.security-policy-anchor.v1';
export const RECOVERY_BUNDLE_PROTOCOL = 'civweave.wallet-recovery.v1';
export const SECURITY_EVENT_TYPES = Object.freeze({
  POLICY: 'SecurityPolicyAnchored',
  VALIDATOR_REGISTERED: 'ValidatorRegistered',
  VALIDATOR_ATTESTED: 'ValidatorAttested',
  MINT_WITNESSED: 'MintSecurityWitnessed',
  MINT_CERTIFIED: 'MintSecurityCertified',
  TRANSFER_INTENT: 'TransferSecurityIntent',
  TRANSFER_CERTIFIED: 'TransferSecurityCertified',
  EMERGENCY_HALT: 'SecurityEmergencyHalt',
});

export const DEFAULT_SHIP_SECURITY_POLICY = Object.freeze({
  policyVersion: 1,
  mode: 'contribution-beta',
  minValidatorRoots: 3,
  committeeSize: 5,
  minAttestations: 2,
  minValidatorAgeMs: 24 * 60 * 60 * 1000,
  minContributionEvents: 3,
  minBondButtons: 5,
  validatorInactiveAfterMs: 30 * 24 * 60 * 60 * 1000,
  transferTtlMs: 24 * 60 * 60 * 1000,
  maxClockSkewMs: 5 * 60 * 1000,
  maxEnvelopeBytes: 128 * 1024,
  maxBundleEnvelopes: 500,
  maxMeshEvents: 50000,
  maxPendingTransfersPerHour: 20,
  maxWitnessesPerHour: 120,
  recoveryRequiredAbove: Object.freeze({ BUTTON: 5, ACORN: 1 }),
  maxOfflineAmount: Object.freeze({ BUTTON: 25, ACORN: 5 }),
  maxTransferAmount: Object.freeze({ BUTTON: 500, ACORN: 100 }),
  externalOfframpsEnabled: false,
  emergencyHalt: false,
});

function clone(value) { return value == null ? value : structuredClone(value); }
function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, normalized(value[key])]));
  }
  return value;
}
export function canonicalJson(value) { return JSON.stringify(normalized(value)); }
export function hashObject(value) { return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`; }
function base64url(bytes) { return Buffer.from(bytes).toString('base64url'); }
function fromBase64url(value) { return Buffer.from(String(value || ''), 'base64url'); }

function publicJwkFromPrivate(privateJwk) {
  if (!privateJwk?.kty || !privateJwk?.crv || !privateJwk?.x || !privateJwk?.y) throw new TypeError('private JWK is missing its public coordinates');
  const key = { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y };
  if (privateJwk.alg) key.alg = privateJwk.alg;
  if (privateJwk.ext !== undefined) key.ext = privateJwk.ext;
  if (privateJwk.key_ops) key.key_ops = ['verify'];
  return key;
}

export function walletIdForPublicKey(publicKey) {
  return `wallet:${hashObject(publicKey).slice('sha256:'.length, 'sha256:'.length + 24)}`;
}

function policyWithDefaults(input = {}) {
  const policy = {
    ...DEFAULT_SHIP_SECURITY_POLICY,
    ...clone(input),
    recoveryRequiredAbove: { ...DEFAULT_SHIP_SECURITY_POLICY.recoveryRequiredAbove, ...(input.recoveryRequiredAbove || {}) },
    maxOfflineAmount: { ...DEFAULT_SHIP_SECURITY_POLICY.maxOfflineAmount, ...(input.maxOfflineAmount || {}) },
    maxTransferAmount: { ...DEFAULT_SHIP_SECURITY_POLICY.maxTransferAmount, ...(input.maxTransferAmount || {}) },
  };
  policy.minValidatorRoots = Math.max(3, Number(policy.minValidatorRoots) || 3);
  policy.committeeSize = Math.max(policy.minValidatorRoots, Number(policy.committeeSize) || 5);
  policy.minAttestations = Math.max(0, Number(policy.minAttestations) || 0);
  return Object.freeze(policy);
}

function anchorBody(anchor) {
  const body = clone(anchor || {});
  delete body.signatures;
  delete body.hash;
  return body;
}

async function importPrivateJwk(jwk) {
  return subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}
async function importPublicJwk(jwk) {
  return subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}

export function createPolicyAnchorDraft({ federationId, genesisValidators, epochSeed = base64url(randomBytes(32)), policy = {}, issuedAt = new Date().toISOString(), expiresAt = null } = {}) {
  const roots = (genesisValidators || []).map((row) => ({ rootId: String(row.rootId || ''), publicKey: clone(row.publicKey) }));
  if (roots.length < 3) throw new Error('a security policy anchor requires at least three genesis validator roots');
  const ids = new Set();
  for (const root of roots) {
    if (!root.rootId || walletIdForPublicKey(root.publicKey) !== root.rootId) throw new Error('genesis validator root does not match its public key');
    if (ids.has(root.rootId)) throw new Error('genesis validator roots must be unique');
    ids.add(root.rootId);
  }
  const threshold = Math.floor((roots.length * 2) / 3) + 1;
  const body = {
    schema: POLICY_ANCHOR_PROTOCOL,
    federationId: String(federationId || 'civweave-local-federation'),
    epochSeed: String(epochSeed),
    issuedAt: String(issuedAt),
    expiresAt: expiresAt ? String(expiresAt) : null,
    threshold,
    genesisValidators: roots.sort((a, b) => a.rootId.localeCompare(b.rootId)),
    policy: policyWithDefaults(policy),
  };
  return Object.freeze({ ...body, hash: hashObject(body), signatures: [] });
}

export async function signPolicyAnchor(anchor, walletIdentity) {
  if (anchor?.schema !== POLICY_ANCHOR_PROTOCOL || !anchor?.hash) throw new Error('invalid policy anchor draft');
  if (!walletIdentity?.walletId || walletIdForPublicKey(walletIdentity.publicKey) !== walletIdentity.walletId) throw new Error('wallet identity is invalid');
  const listed = (anchor.genesisValidators || []).find((row) => row.rootId === walletIdentity.walletId);
  if (!listed || canonicalJson(listed.publicKey) !== canonicalJson(walletIdentity.publicKey)) throw new Error('wallet is not a genesis validator for this anchor');
  if (hashObject(anchorBody(anchor)) !== anchor.hash) throw new Error('policy anchor hash mismatch');
  const key = await importPrivateJwk(walletIdentity.privateKey);
  const signature = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(anchor.hash));
  return Object.freeze({ rootId: walletIdentity.walletId, signature: base64url(signature) });
}

export async function verifyPolicyAnchor(anchor, { now = Date.now() } = {}) {
  try {
    if (anchor?.schema !== POLICY_ANCHOR_PROTOCOL) return { ok: false, error: 'unsupported policy anchor schema' };
    const body = anchorBody(anchor);
    if (hashObject(body) !== anchor.hash) return { ok: false, error: 'policy anchor hash mismatch' };
    if ((anchor.genesisValidators || []).length < 3) return { ok: false, error: 'insufficient genesis validators' };
    if (anchor.expiresAt && Date.parse(anchor.expiresAt) <= now) return { ok: false, error: 'policy anchor expired' };
    const roots = new Map();
    for (const row of anchor.genesisValidators || []) {
      if (walletIdForPublicKey(row.publicKey) !== row.rootId || roots.has(row.rootId)) return { ok: false, error: 'invalid genesis validator root' };
      roots.set(row.rootId, row.publicKey);
    }
    const accepted = new Set();
    for (const signature of anchor.signatures || []) {
      if (accepted.has(signature.rootId) || !roots.has(signature.rootId)) continue;
      const key = await importPublicJwk(roots.get(signature.rootId));
      if (await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromBase64url(signature.signature), encoder.encode(anchor.hash))) accepted.add(signature.rootId);
    }
    const threshold = Math.max(1, Number(anchor.threshold || 0));
    if (accepted.size < threshold) return { ok: false, error: `policy anchor requires ${threshold} genesis signatures`, signatures: accepted.size };
    return { ok: true, signatures: accepted.size, threshold, policy: policyWithDefaults(anchor.policy), anchorHash: anchor.hash };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

export function finalizePolicyAnchor(anchor, signatures) {
  const unique = new Map();
  for (const signature of signatures || []) if (signature?.rootId && signature?.signature) unique.set(String(signature.rootId), clone(signature));
  return Object.freeze({ ...clone(anchor), signatures: [...unique.values()].sort((a, b) => a.rootId.localeCompare(b.rootId)) });
}

function gfMul(a, b) {
  let x = a & 255, y = b & 255, out = 0;
  while (y) {
    if (y & 1) out ^= x;
    x = ((x << 1) ^ (x & 0x80 ? 0x1b : 0)) & 255;
    y >>>= 1;
  }
  return out;
}
function gfPow(a, power) { let out = 1, x = a & 255, p = power; while (p > 0) { if (p & 1) out = gfMul(out, x); x = gfMul(x, x); p >>>= 1; } return out; }
function gfInv(a) { if (!a) throw new Error('cannot invert zero in GF(256)'); return gfPow(a, 254); }

export function splitSecret(secretInput, { threshold = 2, shares = 3, random = randomBytes } = {}) {
  const secret = Buffer.from(secretInput);
  if (!secret.length) throw new Error('secret must not be empty');
  if (!Number.isInteger(threshold) || !Number.isInteger(shares) || threshold < 2 || shares < threshold || shares > 255) throw new Error('invalid secret sharing threshold');
  const outputs = Array.from({ length: shares }, (_, index) => Buffer.alloc(secret.length + 1, index + 1));
  for (let byteIndex = 0; byteIndex < secret.length; byteIndex += 1) {
    const coefficients = [secret[byteIndex], ...random(threshold - 1)];
    for (let shareIndex = 0; shareIndex < shares; shareIndex += 1) {
      const x = shareIndex + 1;
      let y = coefficients[0], xPower = 1;
      for (let degree = 1; degree < coefficients.length; degree += 1) {
        xPower = gfMul(xPower, x);
        y ^= gfMul(coefficients[degree], xPower);
      }
      outputs[shareIndex][byteIndex + 1] = y;
    }
  }
  return outputs;
}

export function combineSecret(sharesInput, threshold = sharesInput?.length || 0) {
  const shares = (sharesInput || []).map((value) => Buffer.from(value));
  if (shares.length < threshold || threshold < 2) throw new Error('insufficient recovery shares');
  const chosen = shares.slice(0, threshold);
  const size = chosen[0].length;
  if (size < 2 || chosen.some((share) => share.length !== size)) throw new Error('recovery shares have inconsistent lengths');
  const xs = chosen.map((share) => share[0]);
  if (new Set(xs).size !== xs.length || xs.some((x) => !x)) throw new Error('recovery shares must have distinct non-zero indexes');
  const secret = Buffer.alloc(size - 1);
  for (let byteIndex = 1; byteIndex < size; byteIndex += 1) {
    let value = 0;
    for (let i = 0; i < chosen.length; i += 1) {
      let numerator = 1, denominator = 1;
      for (let j = 0; j < chosen.length; j += 1) {
        if (i === j) continue;
        numerator = gfMul(numerator, xs[j]);
        denominator = gfMul(denominator, xs[i] ^ xs[j]);
      }
      value ^= gfMul(chosen[i][byteIndex], gfMul(numerator, gfInv(denominator)));
    }
    secret[byteIndex - 1] = value;
  }
  return secret;
}

export function createRecoveryKit({ walletId, walletPrivateJwk, guardianIds, threshold = 2, random = randomBytes, createdAt = new Date().toISOString() } = {}) {
  const guardians = [...new Set((guardianIds || []).map(String).filter(Boolean))];
  if (guardians.length < 3) throw new Error('recovery requires at least three guardians');
  if (threshold < 2 || threshold > guardians.length) throw new Error('invalid guardian threshold');
  const publicKey = publicJwkFromPrivate(walletPrivateJwk);
  if (walletIdForPublicKey(publicKey) !== walletId) throw new Error('recovery wallet id does not match private key');
  const recoveryKey = random(32);
  const iv = random(12);
  const metadata = { schema: RECOVERY_BUNDLE_PROTOCOL, walletId, guardianIds: guardians, threshold, createdAt };
  const cipher = createCipheriv('aes-256-gcm', recoveryKey, iv);
  cipher.setAAD(Buffer.from(canonicalJson(metadata)));
  const plaintext = Buffer.from(JSON.stringify(walletPrivateJwk));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const rawShares = splitSecret(recoveryKey, { threshold, shares: guardians.length, random });
  recoveryKey.fill(0);
  const guardianShares = rawShares.map((share, index) => ({
    schema: 'civweave.wallet-recovery-share.v1',
    walletId,
    guardianId: guardians[index],
    share: base64url(share),
    commitment: hashObject({ walletId, guardianId: guardians[index], share: base64url(share) }),
  }));
  const bundle = {
    ...metadata,
    publicKey,
    iv: base64url(iv),
    ciphertext: base64url(ciphertext),
    tag: base64url(tag),
    shareCommitments: Object.fromEntries(guardianShares.map((row) => [row.guardianId, row.commitment])),
  };
  return { bundle: Object.freeze({ ...bundle, hash: hashObject(bundle) }), guardianShares: guardianShares.map(Object.freeze) };
}

export function recoverWallet({ bundle, shares } = {}) {
  if (bundle?.schema !== RECOVERY_BUNDLE_PROTOCOL) throw new Error('unsupported recovery bundle');
  const body = clone(bundle); delete body.hash;
  if (hashObject(body) !== bundle.hash) throw new Error('recovery bundle hash mismatch');
  const accepted = new Map();
  for (const row of shares || []) {
    if (row?.walletId !== bundle.walletId || !bundle.shareCommitments?.[row.guardianId]) continue;
    const commitment = hashObject({ walletId: row.walletId, guardianId: row.guardianId, share: row.share });
    if (commitment !== bundle.shareCommitments[row.guardianId]) continue;
    accepted.set(row.guardianId, fromBase64url(row.share));
  }
  if (accepted.size < bundle.threshold) throw new Error('insufficient valid guardian shares');
  const recoveryKey = combineSecret([...accepted.values()], bundle.threshold);
  try {
    const decipher = createDecipheriv('aes-256-gcm', recoveryKey, fromBase64url(bundle.iv));
    decipher.setAAD(Buffer.from(canonicalJson({ schema: bundle.schema, walletId: bundle.walletId, guardianIds: bundle.guardianIds, threshold: bundle.threshold, createdAt: bundle.createdAt })));
    decipher.setAuthTag(fromBase64url(bundle.tag));
    const plaintext = Buffer.concat([decipher.update(fromBase64url(bundle.ciphertext)), decipher.final()]);
    const privateKey = JSON.parse(plaintext.toString('utf8'));
    if (walletIdForPublicKey(publicJwkFromPrivate(privateKey)) !== bundle.walletId) throw new Error('recovered wallet fingerprint mismatch');
    return { walletId: bundle.walletId, publicKey: clone(bundle.publicKey), privateKey };
  } finally {
    recoveryKey.fill(0);
  }
}

export class ValidatorRegistry {
  constructor({ policy = {}, anchor = null, now = () => Date.now() } = {}) {
    this.policy = policyWithDefaults(policy);
    this.anchor = anchor;
    this.now = now;
    this.registrations = new Map();
    this.attestations = [];
    this.slashed = new Map();
  }
  register(record) {
    const rootId = String(record?.rootId || '');
    const deviceId = String(record?.deviceId || '');
    if (!rootId || !deviceId || !record?.publicKey || walletIdForPublicKey(record.publicKey) !== rootId) throw new Error('validator registration identity is invalid');
    const next = {
      rootId, deviceId, publicKey: clone(record.publicKey), joinedAt: String(record.joinedAt || new Date(this.now()).toISOString()),
      lastSeenAt: String(record.lastSeenAt || record.joinedAt || new Date(this.now()).toISOString()),
      recoveryReady: Boolean(record.recoveryReady), contributionEvents: Math.max(0, Number(record.contributionEvents || 0)),
      bondButtons: Math.max(0, Number(record.bondButtons || 0)), active: record.active !== false,
    };
    this.registrations.set(rootId, next);
    return clone(next);
  }
  attest({ attestorRootId, targetRootId, pairingReceiptId, at = new Date(this.now()).toISOString() }) {
    const attestor = String(attestorRootId || ''), target = String(targetRootId || '');
    if (!attestor || !target || attestor === target || !this.registrations.has(attestor) || !this.registrations.has(target)) throw new Error('validator attestation roots are invalid');
    const key = `${attestor}\u0000${target}`;
    const prior = this.attestations.find((row) => row.key === key);
    if (prior) return clone(prior);
    const row = { key, attestorRootId: attestor, targetRootId: target, pairingReceiptId: String(pairingReceiptId || ''), at: String(at) };
    this.attestations.push(row);
    return clone(row);
  }
  slash(rootId, { reason = 'objective protocol fault', until = Number.POSITIVE_INFINITY } = {}) {
    this.slashed.set(String(rootId), { reason: String(reason), until });
  }
  genesisRoots() { return new Set((this.anchor?.genesisValidators || []).map((row) => row.rootId)); }
  eligible({ at = this.now(), policy = this.policy } = {}) {
    const p = policyWithDefaults(policy), genesis = this.genesisRoots(), rows = [];
    for (const record of this.registrations.values()) {
      const slash = this.slashed.get(record.rootId);
      const age = at - Date.parse(record.joinedAt);
      const inactive = at - Date.parse(record.lastSeenAt);
      const attestors = new Set(this.attestations.filter((row) => row.targetRootId === record.rootId && !this.slashed.has(row.attestorRootId)).map((row) => row.attestorRootId));
      const isGenesis = genesis.has(record.rootId);
      const reasons = [];
      if (!record.active) reasons.push('inactive');
      if (slash && slash.until > at) reasons.push('slashed');
      if (!record.recoveryReady) reasons.push('recovery-not-ready');
      if (!isGenesis && age < p.minValidatorAgeMs) reasons.push('validator-too-new');
      if (!isGenesis && inactive > p.validatorInactiveAfterMs) reasons.push('validator-stale');
      if (!isGenesis && record.contributionEvents < p.minContributionEvents) reasons.push('insufficient-contribution-history');
      if (!isGenesis && record.bondButtons < p.minBondButtons) reasons.push('insufficient-validator-bond');
      if (!isGenesis && attestors.size < p.minAttestations) reasons.push('insufficient-independent-attestations');
      rows.push({ ...clone(record), genesis: isGenesis, attestationCount: attestors.size, eligible: reasons.length === 0, reasons });
    }
    return rows.sort((a, b) => a.rootId.localeCompare(b.rootId));
  }
  snapshot({ at = this.now(), policy = this.policy } = {}) {
    const eligible = this.eligible({ at, policy }).filter((row) => row.eligible);
    const canonical = eligible.map(({ rootId, deviceId, publicKey, joinedAt, recoveryReady, contributionEvents, bondButtons, genesis }) => ({ rootId, deviceId, publicKey, joinedAt, recoveryReady, contributionEvents, bondButtons, genesis }));
    return { at, eligible, registryHash: hashObject(canonical) };
  }
  committeeFor(subjectHash, { at = this.now(), policy = this.policy, excludeRootIds = [] } = {}) {
    const p = policyWithDefaults(policy), snapshot = this.snapshot({ at, policy: p }), excluded = new Set(excludeRootIds.map(String));
    const candidates = snapshot.eligible.filter((row) => !excluded.has(row.rootId)).map((row) => ({ ...row, score: hashObject({ epochSeed: this.anchor?.epochSeed || '', subjectHash: String(subjectHash), rootId: row.rootId }) })).sort((a, b) => a.score.localeCompare(b.score) || a.rootId.localeCompare(b.rootId));
    const roots = candidates.slice(0, p.committeeSize);
    const quorum = Math.floor((roots.length * 2) / 3) + 1;
    const safe = roots.length >= p.minValidatorRoots && quorum >= 2;
    const committee = roots.map((row) => ({ rootId: row.rootId, deviceId: row.deviceId, publicKey: clone(row.publicKey) }));
    return { safe, quorum, committee, committeeHash: hashObject({ registryHash: snapshot.registryHash, subjectHash: String(subjectHash), roots: committee.map((row) => row.rootId) }), registryHash: snapshot.registryHash };
  }
}

export function assessTransferRisk({ asset, amount, availableBalance, networkOnline = true, partitioned = false, recoveryReady = false, policyAnchored = false, eligibleValidatorRoots = 0, createdAt = Date.now(), expiresAt = null, now = Date.now(), policy = {} } = {}) {
  const p = policyWithDefaults(policy), target = String(asset || '').toUpperCase(), value = Number(amount), balance = Number(availableBalance);
  const reasons = [];
  if (!['BUTTON', 'ACORN'].includes(target)) reasons.push('unsupported-asset');
  if (!Number.isFinite(value) || value <= 0) reasons.push('invalid-amount');
  if (!Number.isFinite(balance) || balance < value) reasons.push('insufficient-secure-balance');
  if (p.emergencyHalt) reasons.push('emergency-halt');
  if (value > Number(p.maxTransferAmount[target] || 0)) reasons.push('transfer-over-ship-limit');
  if ((!networkOnline || partitioned) && value > Number(p.maxOfflineAmount[target] || 0)) reasons.push('offline-value-limit');
  if (value > Number(p.recoveryRequiredAbove[target] || 0) && !recoveryReady) reasons.push('recovery-required');
  const expiry = expiresAt ? Date.parse(expiresAt) : createdAt + p.transferTtlMs;
  if (now > expiry) reasons.push('transfer-expired');
  const createBlocking = reasons.filter((reason) => ['unsupported-asset','invalid-amount','insufficient-secure-balance','emergency-halt','transfer-over-ship-limit','offline-value-limit','recovery-required'].includes(reason));
  const finalityReasons = [...reasons];
  if (!policyAnchored) finalityReasons.push('policy-anchor-required');
  if (eligibleValidatorRoots < p.minValidatorRoots) finalityReasons.push('insufficient-validator-roots');
  return {
    allowedToCreate: createBlocking.length === 0,
    allowedToWitness: finalityReasons.length === 0,
    allowedToFinalize: finalityReasons.length === 0,
    pendingOnly: createBlocking.length === 0 && finalityReasons.length > 0,
    reasons: [...new Set(finalityReasons)],
    expiresAt: new Date(expiry).toISOString(),
    offline: !networkOnline || partitioned,
  };
}

export class SlidingWindowRateLimiter {
  constructor({ now = () => Date.now() } = {}) { this.now = now; this.rows = new Map(); }
  allow(key, { limit, windowMs = 60 * 60 * 1000 } = {}) {
    const now = this.now(), id = String(key), prior = (this.rows.get(id) || []).filter((at) => now - at < windowMs);
    if (prior.length >= limit) { this.rows.set(id, prior); return false; }
    prior.push(now); this.rows.set(id, prior); return true;
  }
}

export function preflightEnvelope(envelope, { now = Date.now(), policy = {}, historicalSync = false } = {}) {
  const p = policyWithDefaults(policy);
  const bytes = Buffer.byteLength(JSON.stringify(envelope || {}));
  if (bytes > p.maxEnvelopeBytes) return { ok: false, error: 'envelope exceeds security size limit', bytes };
  const created = Date.parse(envelope?.event?.createdAt || '');
  if (!Number.isFinite(created)) return { ok: false, error: 'event timestamp is invalid', bytes };
  if (!historicalSync && created - now > p.maxClockSkewMs) return { ok: false, error: 'event timestamp is too far in the future', bytes };
  return { ok: true, bytes };
}

export function detectWitnessEquivocation(rows = []) {
  const pendingByHash = new Map();
  for (const row of rows) {
    const event = row?.envelope?.event || row?.event;
    if (event?.type === 'TransferPending') pendingByHash.set(event.hash, event.payload || {});
  }
  const seen = new Map(), faults = [];
  for (const row of rows) {
    const event = row?.envelope?.event || row?.event;
    const signer = row?.envelope?.signer?.deviceId || row?.signerDeviceId || event?.payload?.witnessDeviceId;
    if (event?.type !== 'TransferWitnessed' || !signer) continue;
    const transferHash = String(event.payload?.transferHash || ''), pending = pendingByHash.get(transferHash);
    if (!pending) continue;
    const spendKey = `${pending.fromId}\u0000${pending.asset}\u0000${pending.spendNonce}`;
    const key = `${signer}\u0000${spendKey}`;
    const prior = seen.get(key);
    if (prior && prior !== transferHash) faults.push({ deviceId: signer, spendKey, firstTransferHash: prior, conflictingTransferHash: transferHash, reason: 'witness-equivocation' });
    else seen.set(key, transferHash);
  }
  return faults;
}

export function launchSecurityStatus({ anchorVerification, eligibleValidatorRoots = 0, recoveryReady = false, secureWalletReady = false, externalOfframpsEnabled = false, policy = {} } = {}) {
  const p = policyWithDefaults(policy), blockers = [];
  if (!secureWalletReady) blockers.push('secure-wallet-not-ready');
  if (!recoveryReady) blockers.push('recovery-not-distributed');
  if (!anchorVerification?.ok) blockers.push('policy-anchor-not-verified');
  if (eligibleValidatorRoots < p.minValidatorRoots) blockers.push('validator-quorum-not-ready');
  if (externalOfframpsEnabled || p.externalOfframpsEnabled) blockers.push('external-offramps-must-remain-disabled-until-provider-review');
  return {
    readyForContributionValue: blockers.length === 0,
    blockers,
    transferMode: blockers.length ? 'pending-only' : 'committee-finality',
    externalOfframpsEnabled: false,
    policy: p,
  };
}
