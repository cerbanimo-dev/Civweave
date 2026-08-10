import { createHash } from 'node:crypto';

export const VALIDATOR_COMMITTEE_PROTOCOL = 'civweave.validator-committee.v2';
export const DEFAULT_COMMITTEE_POLICY = Object.freeze({
  minValidatorRoots: 3,
  committeeSize: 5,
  minIndependentAttestations: 2,
  minCertifiedContributions: 3,
  minContributionKinds: 2,
  minBondButtons: 5,
  minValidatorAgeMs: 24 * 60 * 60 * 1000,
  validatorInactiveAfterMs: 30 * 24 * 60 * 60 * 1000,
  quorumNumerator: 2,
  quorumDenominator: 3,
});

function clone(v) { return v == null ? v : structuredClone(v); }
function normalized(v) {
  if (Array.isArray(v)) return v.map(normalized);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, normalized(v[k])]));
  return v;
}
export function canonicalJson(v) { return JSON.stringify(normalized(v)); }
export function hashObject(v) { return `sha256:${createHash('sha256').update(canonicalJson(v)).digest('hex')}`; }
export function policyWithDefaults(input = {}) {
  const p = { ...DEFAULT_COMMITTEE_POLICY, ...clone(input) };
  p.minValidatorRoots = Math.max(3, Number(p.minValidatorRoots) || 3);
  p.committeeSize = Math.max(p.minValidatorRoots, Number(p.committeeSize) || 5);
  p.minIndependentAttestations = Math.max(0, Number(p.minIndependentAttestations) || 0);
  p.minCertifiedContributions = Math.max(0, Number(p.minCertifiedContributions) || 0);
  p.minContributionKinds = Math.max(1, Number(p.minContributionKinds) || 1);
  p.minBondButtons = Math.max(0, Number(p.minBondButtons) || 0);
  return Object.freeze(p);
}

export function deriveValidatorMetrics({ rootId, deviceId, events = [], at = Date.now() } = {}) {
  const root = String(rootId || '');
  const device = String(deviceId || '');
  const certified = new Map();
  const kinds = new Set();
  let lockedBondButtons = 0;
  let lastActivityAt = 0;
  let equivocated = false;
  const pendingByHash = new Map();
  const witnessedSpend = new Map();

  for (const row of events) {
    const envelope = row?.envelope || row;
    const event = envelope?.event || row?.event || row;
    const signer = envelope?.signer?.deviceId || row?.signerDeviceId || '';
    if (!event || Date.parse(event.createdAt || 0) > at) continue;
    if (signer === device) lastActivityAt = Math.max(lastActivityAt, Date.parse(event.createdAt || 0) || 0);
    if (event.type === 'TransferPending') pendingByHash.set(event.hash, event.payload || {});
    if (event.type === 'TransferWitnessed' && signer === device) {
      const transferHash = String(event.payload?.transferHash || '');
      const pending = pendingByHash.get(transferHash);
      if (pending) {
        const spendKey = `${pending.fromId}\u0000${pending.asset}\u0000${pending.spendNonce}`;
        const prior = witnessedSpend.get(spendKey);
        if (prior && prior !== transferHash) equivocated = true;
        witnessedSpend.set(spendKey, transferHash);
      }
    }
    if (event.type === 'MintCommitteeCertifiedV2') {
      const p = event.payload || {};
      if (p.subjectId !== root || !p.canonicalRewardHash) continue;
      certified.set(String(p.canonicalRewardHash), p);
      kinds.add(String(p.sourceKind || p.sourceSystem || 'unknown'));
    }
    if (event.type === 'MintSecurityCertified') {
      const p = event.payload || {};
      if (p.subjectId !== root || !p.mintHash) continue;
      certified.set(`v1:${p.mintHash}`, p);
      kinds.add(String(p.sourceKind || 'legacy-certified'));
    }
    if (event.type === 'ValidatorBondLockedV2') {
      const p = event.payload || {};
      if (p.rootId === root && p.deviceId === device && Number(p.amount) > 0) lockedBondButtons += Number(p.amount);
    }
  }

  return Object.freeze({
    rootId: root,
    deviceId: device,
    certifiedContributions: certified.size,
    contributionKinds: [...kinds].sort(),
    contributionDiversity: kinds.size,
    lockedBondButtons: Number(lockedBondButtons.toFixed(8)),
    lastActivityAt,
    equivocated,
  });
}

export function validatorEligibility({ registration, metrics, attestorRootIds = [], genesis = false, slashed = false, at = Date.now(), policy = {} } = {}) {
  const p = policyWithDefaults(policy);
  const reasons = [];
  const joined = Date.parse(registration?.joinedAt || 0);
  const last = Number(metrics?.lastActivityAt || joined || 0);
  const attestors = new Set((attestorRootIds || []).map(String).filter(Boolean));
  if (!registration?.rootId || !registration?.deviceId) reasons.push('registration-missing');
  if (!registration?.recoveryReady) reasons.push('recovery-not-ready');
  if (slashed || metrics?.equivocated) reasons.push('objective-protocol-fault');
  if (!genesis && at - joined < p.minValidatorAgeMs) reasons.push('validator-too-new');
  if (!genesis && last && at - last > p.validatorInactiveAfterMs) reasons.push('validator-stale');
  if (!genesis && Number(metrics?.certifiedContributions || 0) < p.minCertifiedContributions) reasons.push('insufficient-certified-contribution-history');
  if (!genesis && Number(metrics?.contributionDiversity || 0) < p.minContributionKinds) reasons.push('insufficient-contribution-diversity');
  if (!genesis && Number(metrics?.lockedBondButtons || 0) < p.minBondButtons) reasons.push('insufficient-locked-bond');
  if (!genesis && attestors.size < p.minIndependentAttestations) reasons.push('insufficient-independent-attestations');
  return Object.freeze({ eligible: reasons.length === 0, reasons, attestationCount: attestors.size, policy: p });
}

export function deterministicCommittee({ subjectHash, epochSeed = '', eligibleValidators = [], excludeRootIds = [], policy = {} } = {}) {
  const p = policyWithDefaults(policy);
  const excluded = new Set((excludeRootIds || []).map(String));
  const byRoot = new Map();
  const usedDevices = new Set();
  for (const row of eligibleValidators || []) {
    if (!row?.rootId || !row?.deviceId || excluded.has(String(row.rootId))) continue;
    if (byRoot.has(String(row.rootId)) || usedDevices.has(String(row.deviceId))) continue;
    byRoot.set(String(row.rootId), clone(row));
    usedDevices.add(String(row.deviceId));
  }
  const ranked = [...byRoot.values()].map(row => ({
    ...row,
    selectionHash: hashObject({ protocol: VALIDATOR_COMMITTEE_PROTOCOL, epochSeed: String(epochSeed), subjectHash: String(subjectHash), rootId: String(row.rootId), deviceId: String(row.deviceId) }),
  })).sort((a, b) => a.selectionHash.localeCompare(b.selectionHash) || String(a.rootId).localeCompare(String(b.rootId)));
  const committee = ranked.slice(0, p.committeeSize).map(({ rootId, deviceId, publicKey, registrationHash, genesis, selectionHash }) => ({ rootId, deviceId, publicKey: clone(publicKey), registrationHash, genesis: Boolean(genesis), selectionHash }));
  const quorum = Math.floor((committee.length * p.quorumNumerator) / p.quorumDenominator) + 1;
  const safe = committee.length >= p.minValidatorRoots && quorum >= 2;
  const registryHash = hashObject([...byRoot.values()].map(row => ({ rootId: row.rootId, deviceId: row.deviceId, registrationHash: row.registrationHash, genesis: Boolean(row.genesis) })).sort((a,b)=>String(a.rootId).localeCompare(String(b.rootId))));
  const committeeHash = hashObject({ protocol: VALIDATOR_COMMITTEE_PROTOCOL, registryHash, subjectHash: String(subjectHash), roots: committee.map(row => row.rootId) });
  return Object.freeze({ safe, quorum, registryHash, committeeHash, committee });
}
