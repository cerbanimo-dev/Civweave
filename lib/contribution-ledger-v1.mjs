import { createHash, timingSafeEqual } from 'node:crypto';

export const CONTRIBUTION_LEDGER_PROTOCOL = 'civweave.contribution-ledger.v1';
export const CONTRIBUTION_EVENT_PROTOCOL = 'civweave.contribution-event.v1';
export const EXCHANGE_PROTOCOL = 'civweave.exchange-intent.v1';

export const ASSETS = Object.freeze({ BUTTON: 'BUTTON', ACORN: 'ACORN', XP: 'XP' });
export const CONTRIBUTION_TYPES = Object.freeze({ LABOR: 'labor', LEARNING: 'learning', VALIDATION: 'validation' });

export const DEFAULT_POLICY = Object.freeze({
  mintConfidenceThreshold: 0.8,
  minEvidenceDiversity: 2,
  crossDeviceRequiredFor: Object.freeze(['BUTTON']),
  sourceWeights: Object.freeze({ deterministic: 1.2, human: 1.15, model: 1, peer: 0.95 }),
  minimumCalibration: 0.25,
  maximumValidationWeight: 1.5,
});

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function assertFiniteNonNegative(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`${label} must be a finite non-negative number`);
  return number;
}

function assertRatio(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new TypeError(`${label} must be between 0 and 1`);
  return number;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(stableValue(value));
}

export function hashObject(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

export function verifyObjectHash(value, expectedHash) {
  const actual = Buffer.from(hashObject(value));
  const expected = Buffer.from(String(expectedHash || ''));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function normalizedEffect(effect) {
  const asset = String(effect?.asset || '').toUpperCase();
  if (!Object.values(ASSETS).includes(asset)) throw new TypeError(`unsupported contribution asset: ${asset || '(empty)'}`);
  const amount = assertFiniteNonNegative(effect?.amount, `${asset} amount`);
  if (amount === 0) throw new TypeError(`${asset} amount must be greater than zero`);
  return {
    asset,
    amount,
    skill: asset === ASSETS.XP ? String(effect?.skill || 'general-practice') : undefined,
    transferability: asset === ASSETS.XP ? 'non-transferable' : 'transferable',
  };
}

function normalizedPolicy(input = {}) {
  return {
    ...DEFAULT_POLICY,
    ...input,
    sourceWeights: { ...DEFAULT_POLICY.sourceWeights, ...(input.sourceWeights || {}) },
    crossDeviceRequiredFor: [...new Set((input.crossDeviceRequiredFor || DEFAULT_POLICY.crossDeviceRequiredFor).map((v) => String(v).toUpperCase()))],
  };
}

export function validationContribution(validation, policy = DEFAULT_POLICY) {
  const passThreshold = assertRatio(validation.passThreshold ?? 0.5, 'passThreshold');
  const rubricScore = assertRatio(validation.rubricScore, 'rubricScore');
  const expressedConfidence = assertRatio(validation.confidence, 'confidence');
  const calibration = Math.max(policy.minimumCalibration, assertRatio(validation.calibration ?? 0.75, 'calibration'));
  const sourceType = String(validation.sourceType || 'peer').toLowerCase();
  const sourceWeight = Number(policy.sourceWeights[sourceType] ?? 0.85);
  const passed = validation.decision ? String(validation.decision).toLowerCase() === 'pass' : rubricScore >= passThreshold;

  const span = passed ? Math.max(1e-9, 1 - passThreshold) : Math.max(1e-9, passThreshold);
  const normalizedDistance = Math.min(1, Math.abs(rubricScore - passThreshold) / span);
  const distanceMultiplier = 0.2 + (0.8 * normalizedDistance);
  const rawWeight = sourceWeight * expressedConfidence * calibration * distanceMultiplier;
  const weight = Math.min(policy.maximumValidationWeight, Math.max(0.01, rawWeight));
  return {
    passed,
    weight,
    signedWeight: passed ? weight : -weight,
    sourceType,
    expressedConfidence,
    calibration,
    normalizedDistance,
    rubricScore,
    passThreshold,
  };
}

export function aggregateValidations(validations, policyInput = {}) {
  const policy = normalizedPolicy(policyInput);
  const normalized = validations.map((validation) => ({
    ...validation,
    contribution: validationContribution(validation, policy),
  }));
  let positive = 0;
  let negative = 0;
  for (const validation of normalized) {
    if (validation.contribution.signedWeight >= 0) positive += validation.contribution.weight;
    else negative += validation.contribution.weight;
  }
  const total = positive + negative;
  const confidence = total === 0 ? 0 : positive / total;
  const evidenceKinds = new Set(normalized.filter((v) => v.contribution.passed).map((v) => String(v.evidenceClass || v.contribution.sourceType)));
  const devices = new Set(normalized.filter((v) => v.contribution.passed).map((v) => String(v.deviceId || '')).filter(Boolean));
  const validators = new Set(normalized.filter((v) => v.contribution.passed).map((v) => String(v.validatorId || '')).filter(Boolean));
  return {
    confidence,
    positiveWeight: positive,
    negativeWeight: negative,
    evidenceDiversity: evidenceKinds.size,
    passingDevices: devices.size,
    passingValidators: validators.size,
    evidenceKinds: [...evidenceKinds].sort(),
    normalized,
  };
}

export class ContributionLedger {
  constructor({ policy = {}, nodeId = 'local-node', now = () => new Date().toISOString() } = {}) {
    this.policy = normalizedPolicy(policy);
    this.nodeId = String(nodeId);
    this.now = now;
    this.events = [];
    this.eventHashes = new Set();
    this.claims = new Map();
    this.validations = new Map();
    this.mintsByClaim = new Map();
    this.mintsById = new Map();
    this.balances = new Map();
    this.xp = new Map();
    this.locked = new Map();
    this.exchangeIntents = new Map();
    this.challenges = new Map();
    this.liabilities = new Map();
  }

  appendEvent(type, payload, parents = []) {
    const event = {
      protocol: CONTRIBUTION_EVENT_PROTOCOL,
      type: String(type),
      payload: clone(payload),
      parents: [...new Set(parents.filter(Boolean))].sort(),
      nodeId: this.nodeId,
      createdAt: this.now(),
      sequence: this.events.length + 1,
    };
    const hash = hashObject(event);
    const record = Object.freeze({ ...event, hash });
    this.events.push(record);
    this.eventHashes.add(hash);
    return record;
  }

  createClaim(input) {
    const claimId = String(input?.claimId || '').trim();
    if (!claimId) throw new TypeError('claimId is required');
    if (this.claims.has(claimId)) throw new Error(`claim already exists: ${claimId}`);
    const type = String(input?.type || '').toLowerCase();
    if (!Object.values(CONTRIBUTION_TYPES).includes(type)) throw new TypeError(`unsupported contribution type: ${type}`);
    const subjectId = String(input?.subjectId || '').trim();
    if (!subjectId) throw new TypeError('subjectId is required');
    const effects = (input.effects || []).map(normalizedEffect);
    if (!effects.length) throw new TypeError('at least one requested ledger effect is required');
    const claim = {
      claimId,
      type,
      subjectId,
      effects,
      evidenceRoot: String(input.evidenceRoot || ''),
      rubricHash: String(input.rubricHash || ''),
      metadata: clone(input.metadata || {}),
    };
    const event = this.appendEvent('ClaimCreated', claim);
    this.claims.set(claimId, { ...claim, eventHash: event.hash, status: 'pending' });
    return clone(this.claims.get(claimId));
  }

  recordValidation(input) {
    const claimId = String(input?.claimId || '');
    if (!this.claims.has(claimId)) throw new Error(`unknown claim: ${claimId}`);
    const validatorId = String(input?.validatorId || '').trim();
    const deviceId = String(input?.deviceId || '').trim();
    if (!validatorId || !deviceId) throw new TypeError('validatorId and deviceId are required');
    const key = `${validatorId}\u0000${deviceId}`;
    const byClaim = this.validations.get(claimId) || new Map();
    if (byClaim.has(key)) throw new Error(`validator/device pair already submitted for ${claimId}`);
    const validation = {
      claimId,
      validatorId,
      deviceId,
      sourceType: String(input.sourceType || 'peer').toLowerCase(),
      evidenceClass: String(input.evidenceClass || input.sourceType || 'peer'),
      confidence: assertRatio(input.confidence, 'confidence'),
      calibration: assertRatio(input.calibration ?? 0.75, 'calibration'),
      rubricScore: assertRatio(input.rubricScore, 'rubricScore'),
      passThreshold: assertRatio(input.passThreshold ?? 0.5, 'passThreshold'),
      decision: input.decision ? String(input.decision).toLowerCase() : undefined,
      model: input.model ? String(input.model) : undefined,
      rubricId: input.rubricId ? String(input.rubricId) : undefined,
      evidenceRoot: input.evidenceRoot ? String(input.evidenceRoot) : undefined,
    };
    const event = this.appendEvent('ValidationSubmitted', validation, [this.claims.get(claimId).eventHash]);
    byClaim.set(key, { ...validation, eventHash: event.hash });
    this.validations.set(claimId, byClaim);
    return clone(byClaim.get(key));
  }

  claimStatus(claimId) {
    const claim = this.claims.get(String(claimId));
    if (!claim) throw new Error(`unknown claim: ${claimId}`);
    const validations = [...(this.validations.get(claim.claimId)?.values() || [])];
    const aggregate = aggregateValidations(validations, this.policy);
    const requiredCrossDeviceAssets = claim.effects.filter((effect) => this.policy.crossDeviceRequiredFor.includes(effect.asset));
    const crossDeviceSatisfied = requiredCrossDeviceAssets.length === 0 || aggregate.passingDevices >= 2;
    const confidenceSatisfied = aggregate.confidence >= this.policy.mintConfidenceThreshold && aggregate.positiveWeight > 0;
    const diversitySatisfied = aggregate.evidenceDiversity >= this.policy.minEvidenceDiversity;
    return {
      claimId: claim.claimId,
      status: claim.status,
      mintEligible: confidenceSatisfied && diversitySatisfied && crossDeviceSatisfied && !this.mintsByClaim.has(claim.claimId),
      confidenceSatisfied,
      diversitySatisfied,
      crossDeviceSatisfied,
      aggregate: { ...aggregate, normalized: aggregate.normalized.map((v) => ({ ...v, contribution: { ...v.contribution } })) },
      requiredCrossDeviceAssets: requiredCrossDeviceAssets.map((e) => e.asset),
    };
  }

  finalizeMint(claimId) {
    const claim = this.claims.get(String(claimId));
    if (!claim) throw new Error(`unknown claim: ${claimId}`);
    if (this.mintsByClaim.has(claim.claimId)) throw new Error(`claim already minted: ${claim.claimId}`);
    const status = this.claimStatus(claim.claimId);
    if (!status.mintEligible) {
      const reasons = [];
      if (!status.confidenceSatisfied) reasons.push('confidence threshold');
      if (!status.diversitySatisfied) reasons.push('evidence diversity');
      if (!status.crossDeviceSatisfied) reasons.push('cross-device validation');
      throw new Error(`claim is not mint eligible: ${reasons.join(', ')}`);
    }
    const mintId = `mint:${claim.claimId}`;
    const event = this.appendEvent('MintFinalized', {
      mintId,
      claimId: claim.claimId,
      subjectId: claim.subjectId,
      effects: claim.effects,
      aggregateConfidence: status.aggregate.confidence,
      evidenceDiversity: status.aggregate.evidenceDiversity,
      passingDevices: status.aggregate.passingDevices,
    }, [claim.eventHash, ...status.aggregate.normalized.map((v) => v.eventHash).filter(Boolean)]);
    const mint = { mintId, claimId: claim.claimId, subjectId: claim.subjectId, effects: clone(claim.effects), eventHash: event.hash, status: 'active' };
    this.mintsByClaim.set(claim.claimId, mint);
    this.mintsById.set(mintId, mint);
    claim.status = 'minted';
    for (const effect of claim.effects) this.#creditEffect(claim.subjectId, effect);
    return clone(mint);
  }

  #creditEffect(subjectId, effect) {
    if (effect.asset === ASSETS.XP) {
      const bySkill = this.xp.get(subjectId) || new Map();
      bySkill.set(effect.skill, (bySkill.get(effect.skill) || 0) + effect.amount);
      this.xp.set(subjectId, bySkill);
      return;
    }
    const wallet = this.balances.get(subjectId) || new Map();
    wallet.set(effect.asset, (wallet.get(effect.asset) || 0) + effect.amount);
    this.balances.set(subjectId, wallet);
  }

  #debitTransferable(subjectId, asset, amount) {
    if (asset === ASSETS.XP) throw new Error('XP is non-transferable');
    const wallet = this.balances.get(subjectId) || new Map();
    const current = wallet.get(asset) || 0;
    if (current < amount) throw new Error(`insufficient ${asset} balance`);
    wallet.set(asset, current - amount);
    this.balances.set(subjectId, wallet);
  }

  balance(subjectId, asset) {
    const normalizedAsset = String(asset).toUpperCase();
    if (normalizedAsset === ASSETS.XP) throw new Error('use xpBalance(subjectId, skill) for XP');
    return this.balances.get(String(subjectId))?.get(normalizedAsset) || 0;
  }

  xpBalance(subjectId, skill = 'general-practice') {
    return this.xp.get(String(subjectId))?.get(String(skill)) || 0;
  }

  lockedBalance(subjectId, asset) {
    return this.locked.get(String(subjectId))?.get(String(asset).toUpperCase()) || 0;
  }

  totalSupply(asset) {
    const normalizedAsset = String(asset).toUpperCase();
    if (normalizedAsset === ASSETS.XP) throw new Error('XP does not have transferable total supply');
    let total = 0;
    for (const wallet of this.balances.values()) total += wallet.get(normalizedAsset) || 0;
    for (const wallet of this.locked.values()) total += wallet.get(normalizedAsset) || 0;
    return total;
  }

  createExchangeIntent(input) {
    const ownerId = String(input?.ownerId || '').trim();
    const asset = String(input?.asset || '').toUpperCase();
    const amount = assertFiniteNonNegative(input?.amount, 'exchange amount');
    if (!ownerId || ![ASSETS.BUTTON, ASSETS.ACORN].includes(asset) || amount <= 0) throw new TypeError('valid ownerId, transferable asset, and positive amount are required');
    const intentId = String(input?.intentId || `exchange:${hashObject({ ownerId, asset, amount, targetAsset: input?.targetAsset, nonce: this.events.length + 1 })}`).slice(0, 180);
    if (this.exchangeIntents.has(intentId)) throw new Error(`exchange intent already exists: ${intentId}`);
    this.#debitTransferable(ownerId, asset, amount);
    const lockedWallet = this.locked.get(ownerId) || new Map();
    lockedWallet.set(asset, (lockedWallet.get(asset) || 0) + amount);
    this.locked.set(ownerId, lockedWallet);
    const intent = {
      protocol: EXCHANGE_PROTOCOL,
      intentId,
      ownerId,
      asset,
      amount,
      targetAsset: String(input.targetAsset || 'USDC').toUpperCase(),
      minReceive: input.minReceive == null ? undefined : assertFiniteNonNegative(input.minReceive, 'minReceive'),
      status: 'locked',
      expiresAt: input.expiresAt ? String(input.expiresAt) : undefined,
    };
    const event = this.appendEvent('ExchangeLocked', intent);
    this.exchangeIntents.set(intentId, { ...intent, eventHash: event.hash });
    return clone(this.exchangeIntents.get(intentId));
  }

  cancelExchangeIntent(intentId) {
    const intent = this.exchangeIntents.get(String(intentId));
    if (!intent) throw new Error(`unknown exchange intent: ${intentId}`);
    if (intent.status !== 'locked') throw new Error(`exchange intent is not cancellable: ${intent.status}`);
    const lockedWallet = this.locked.get(intent.ownerId);
    lockedWallet.set(intent.asset, (lockedWallet.get(intent.asset) || 0) - intent.amount);
    const wallet = this.balances.get(intent.ownerId) || new Map();
    wallet.set(intent.asset, (wallet.get(intent.asset) || 0) + intent.amount);
    this.balances.set(intent.ownerId, wallet);
    intent.status = 'cancelled';
    const event = this.appendEvent('ExchangeCancelled', { intentId: intent.intentId }, [intent.eventHash]);
    intent.eventHash = event.hash;
    return clone(intent);
  }

  settleExchange(input) {
    const intent = this.exchangeIntents.get(String(input?.intentId || ''));
    if (!intent) throw new Error(`unknown exchange intent: ${input?.intentId}`);
    if (intent.status !== 'locked') throw new Error(`exchange intent is not settleable: ${intent.status}`);
    const received = assertFiniteNonNegative(input.received, 'received');
    if (intent.minReceive != null && received < intent.minReceive) throw new Error('external settlement is below minReceive');
    const lockedWallet = this.locked.get(intent.ownerId);
    const lockedAmount = lockedWallet?.get(intent.asset) || 0;
    if (lockedAmount < intent.amount) throw new Error('locked balance invariant violated');
    lockedWallet.set(intent.asset, lockedAmount - intent.amount);
    const recipientId = input.recipientId ? String(input.recipientId) : null;
    if (recipientId) {
      const wallet = this.balances.get(recipientId) || new Map();
      wallet.set(intent.asset, (wallet.get(intent.asset) || 0) + intent.amount);
      this.balances.set(recipientId, wallet);
    }
    intent.status = 'settled';
    intent.received = received;
    intent.provider = String(input.provider || 'external-gateway');
    intent.externalTx = String(input.externalTx || '');
    intent.recipientId = recipientId || undefined;
    const event = this.appendEvent('ExchangeSettled', {
      intentId: intent.intentId,
      ownerId: intent.ownerId,
      soldAsset: intent.asset,
      soldAmount: intent.amount,
      targetAsset: intent.targetAsset,
      received,
      provider: intent.provider,
      externalTx: intent.externalTx,
      recipientId: recipientId || undefined,
      supplyEffect: 0,
    }, [intent.eventHash]);
    intent.eventHash = event.hash;
    return clone(intent);
  }

  openChallenge(input) {
    const mint = this.mintsById.get(String(input?.mintId || ''));
    if (!mint) throw new Error(`unknown mint: ${input?.mintId}`);
    const challengeId = String(input?.challengeId || `challenge:${hashObject({ mintId: mint.mintId, challengerId: input.challengerId, nonce: this.events.length + 1 })}`).slice(0, 180);
    if (this.challenges.has(challengeId)) throw new Error(`challenge already exists: ${challengeId}`);
    const challenge = {
      challengeId,
      mintId: mint.mintId,
      challengerId: String(input.challengerId || '').trim(),
      reason: String(input.reason || 'unspecified'),
      evidenceRoot: String(input.evidenceRoot || ''),
      status: 'open',
    };
    if (!challenge.challengerId) throw new TypeError('challengerId is required');
    const event = this.appendEvent('ChallengeOpened', challenge, [mint.eventHash]);
    this.challenges.set(challengeId, { ...challenge, eventHash: event.hash });
    return clone(this.challenges.get(challengeId));
  }

  resolveChallenge(input) {
    const challenge = this.challenges.get(String(input?.challengeId || ''));
    if (!challenge) throw new Error(`unknown challenge: ${input?.challengeId}`);
    if (challenge.status !== 'open') throw new Error(`challenge is already resolved: ${challenge.status}`);
    const outcome = String(input.outcome || '').toLowerCase();
    if (!['upheld', 'revoked'].includes(outcome)) throw new TypeError('outcome must be upheld or revoked');
    const mint = this.mintsById.get(challenge.mintId);
    if (outcome === 'revoked' && mint.status === 'active') {
      for (const effect of mint.effects) this.#revokeEffect(mint.subjectId, effect);
      mint.status = 'revoked';
      this.claims.get(mint.claimId).status = 'revoked';
    }
    challenge.status = outcome;
    challenge.resolution = String(input.resolution || '');
    const event = this.appendEvent('ChallengeResolved', {
      challengeId: challenge.challengeId,
      mintId: mint.mintId,
      outcome,
      resolution: challenge.resolution,
    }, [challenge.eventHash, mint.eventHash]);
    challenge.eventHash = event.hash;
    return clone(challenge);
  }

  #revokeEffect(subjectId, effect) {
    if (effect.asset === ASSETS.XP) {
      const bySkill = this.xp.get(subjectId) || new Map();
      const current = bySkill.get(effect.skill) || 0;
      bySkill.set(effect.skill, Math.max(0, current - effect.amount));
      const deficit = Math.max(0, effect.amount - current);
      if (deficit) this.#addLiability(subjectId, `${ASSETS.XP}:${effect.skill}`, deficit);
      this.xp.set(subjectId, bySkill);
      return;
    }
    const wallet = this.balances.get(subjectId) || new Map();
    const current = wallet.get(effect.asset) || 0;
    const deduction = Math.min(current, effect.amount);
    wallet.set(effect.asset, current - deduction);
    this.balances.set(subjectId, wallet);
    const remaining = effect.amount - deduction;
    if (remaining > 0) {
      const lockedWallet = this.locked.get(subjectId) || new Map();
      const lockedCurrent = lockedWallet.get(effect.asset) || 0;
      const lockedDeduction = Math.min(lockedCurrent, remaining);
      lockedWallet.set(effect.asset, lockedCurrent - lockedDeduction);
      this.locked.set(subjectId, lockedWallet);
      const deficit = remaining - lockedDeduction;
      if (deficit > 0) this.#addLiability(subjectId, effect.asset, deficit);
    }
  }

  #addLiability(subjectId, asset, amount) {
    const wallet = this.liabilities.get(subjectId) || new Map();
    wallet.set(asset, (wallet.get(asset) || 0) + amount);
    this.liabilities.set(subjectId, wallet);
  }

  liability(subjectId, asset) {
    return this.liabilities.get(String(subjectId))?.get(String(asset).toUpperCase()) || 0;
  }

  snapshot() {
    return {
      protocol: CONTRIBUTION_LEDGER_PROTOCOL,
      policy: clone(this.policy),
      eventTip: this.events.at(-1)?.hash || null,
      eventCount: this.events.length,
      claims: [...this.claims.values()].map(clone),
      mints: [...this.mintsById.values()].map(clone),
      exchangeIntents: [...this.exchangeIntents.values()].map(clone),
      challenges: [...this.challenges.values()].map(clone),
    };
  }
}
