import { CivweaveUserPoolCapacityAccount as BaseCapacityAccount } from './capacity-user-pools-v2.mjs';
import { HOST_ECONOMY_POLICY, neuronsToMicrocents } from './capacity.mjs';

export const HUMAN_VALIDATION_NEURON_POLICY = Object.freeze({
  schema: 'civweave.human-validation-neurons.v1',
  requestNeurons: 30,
  allowedValidatorCounts: Object.freeze([2, 3]),
  sourceMode: 'lud',
  validatorMode: 'standard',
});

const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const whole = (value, label, min = 0) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min) throw new RangeError(`${label} must be an integer >= ${min}.`);
  return number;
};
const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
const legacyUsageKey = (day, nodeId, userId) => `usage:${day}:${clean(nodeId, 180)}:${clean(userId, 180)}`;
const includedUsageKey = (day, nodeId, userId) => `usage-v2:included:${day}:${clean(nodeId, 180)}:${clean(userId, 180)}`;
const totalUsageKey = (day, nodeId, userId) => `usage-v2:total:${day}:${clean(nodeId, 180)}:${clean(userId, 180)}`;
const workersFreeTotalKey = day => `usage-v2:workers-free-total:${day}`;
const reservationKey = id => `reservation:${clean(id, 240)}`;
const earnedKey = (nodeId, userId) => `validation-earned:${clean(nodeId, 180)}:${clean(userId, 180)}`;
const requestKey = requestId => `human-validation-request:${clean(requestId, 240)}`;
const requestPrefix = 'human-validation-request:';
const emptyEarned = () => ({ schema: 'civweave.validation-earned-neurons.v1', balanceNeurons: 0, earnedNeurons: 0, spentNeurons: 0, updatedAt: null });

async function storedNumber(storage, key, fallbackKey = '') {
  const value = await storage.get(key);
  if (value != null) return Math.max(0, Number(value || 0));
  if (!fallbackKey) return 0;
  return Math.max(0, Number(await storage.get(fallbackKey) || 0));
}
function resetAt(now = Date.now()) {
  const reset = new Date(now);
  reset.setUTCHours(24, 0, 0, 0);
  return reset;
}
function publicEarned(wallet) {
  const row = { ...emptyEarned(), ...(wallet || {}) };
  return Object.freeze({
    schema: row.schema,
    balanceNeurons: Math.max(0, Number(row.balanceNeurons || 0)),
    earnedNeurons: Math.max(0, Number(row.earnedNeurons || 0)),
    spentNeurons: Math.max(0, Number(row.spentNeurons || 0)),
    updatedAt: row.updatedAt || null,
  });
}
function publicRequest(request, now = Date.now()) {
  if (!request) return null;
  const expired = Date.parse(request.expiresAt) <= now;
  return Object.freeze({ ...request, status: expired && request.status === 'open' ? 'expired' : request.status });
}

export class CivweaveHumanValidationCapacityAccount extends BaseCapacityAccount {
  async validationEarned(nodeId, userId) {
    return publicEarned(await this.state.storage.get(earnedKey(nodeId, userId)));
  }

  async memberStatus(input) {
    const base = await super.memberStatus(input);
    const earned = await this.validationEarned(input.nodeId, input.userId);
    return Object.freeze({
      ...base,
      quota: Object.freeze({
        ...base.quota,
        validationEarnedNeurons: earned.balanceNeurons,
        totalRemainingNeurons: Number(base.quota?.totalRemainingNeurons || 0) + earned.balanceNeurons,
      }),
    });
  }

  async openHumanValidationRequest(input = {}) {
    const nodeId = clean(input.nodeId, 180), requesterUserId = clean(input.requesterUserId || input.userId, 180);
    const requestId = clean(input.requestId, 240), packetId = clean(input.packetId, 240), projectId = clean(input.projectId, 240);
    if (!nodeId || !requesterUserId || !requestId || !packetId || !projectId) throw Object.assign(new TypeError('nodeId, requesterUserId, requestId, packetId, and projectId are required.'), { status: 400 });
    if (clean(input.operatingMode, 40).toLowerCase() !== HUMAN_VALIDATION_NEURON_POLICY.sourceMode) throw Object.assign(new RangeError('Human-validation neuron funding is reserved for Lud Mode requests.'), { status: 403 });
    const validatorCount = whole(input.validatorCount, 'validatorCount', 2);
    if (!HUMAN_VALIDATION_NEURON_POLICY.allowedValidatorCounts.includes(validatorCount)) throw Object.assign(new RangeError('A Lud validation request must use 2 or 3 validators.'), { status: 400 });
    const member = await this.member(nodeId, requesterUserId);
    if (!member) throw Object.assign(new RangeError('Requester is not admitted to this Guild.'), { status: 404 });

    const key = requestKey(requestId), prior = await this.state.storage.get(key);
    if (prior) {
      if (prior.nodeId !== nodeId || prior.requesterUserId !== requesterUserId || prior.packetId !== packetId || prior.validatorCount !== validatorCount) throw Object.assign(new RangeError('Human-validation request ID is already bound to different terms.'), { status: 409 });
      return { request: publicRequest(prior), idempotent: true, memberStatus: await this.memberStatus({ nodeId, userId: requesterUserId }) };
    }

    const now = Date.now(), day = dayKey(now), capacity = await this.snapshot(nodeId);
    const includedKey = includedUsageKey(day, nodeId, requesterUserId), totalKey = totalUsageKey(day, nodeId, requesterUserId), legacyKey = legacyUsageKey(day, nodeId, requesterUserId);
    const [includedUsed, totalUsed] = await Promise.all([
      storedNumber(this.state.storage, includedKey, legacyKey),
      storedNumber(this.state.storage, totalKey, legacyKey),
    ]);
    const dailyValidationBudget = Math.min(HOST_ECONOMY_POLICY.baseIncludedDailyNeurons, Number(capacity.includedDailyNeurons || 0));
    const validationBudgetRemaining = Math.max(0, dailyValidationBudget - includedUsed);
    if (validationBudgetRemaining < HUMAN_VALIDATION_NEURON_POLICY.requestNeurons) throw Object.assign(new RangeError('Today\'s Lud human-validation neuron allowance is exhausted.'), { status: 402 });

    const totalNeurons = HUMAN_VALIDATION_NEURON_POLICY.requestNeurons;
    const perValidatorNeurons = totalNeurons / validatorCount;
    const expiresAt = resetAt(now).toISOString();
    const request = Object.freeze({
      schema: HUMAN_VALIDATION_NEURON_POLICY.schema,
      requestId,
      nodeId,
      requesterUserId,
      packetId,
      projectId,
      sourceMode: 'lud',
      totalNeurons,
      validatorCount,
      perValidatorNeurons,
      claims: [],
      status: 'open',
      sourceDay: day,
      createdAt: new Date(now).toISOString(),
      expiresAt,
    });

    // This consumes the requester's ordinary included daily quota, but does not claim that
    // Workers AI ran. The provider/free-pool counter only changes when a validator later
    // spends earned neurons on actual inference.
    await this.state.storage.put(includedKey, includedUsed + totalNeurons);
    await this.state.storage.put(totalKey, totalUsed + totalNeurons);
    await this.state.storage.put(key, request);
    return { request, idempotent: false, memberStatus: await this.memberStatus({ nodeId, userId: requesterUserId }) };
  }

  async claimHumanValidation(input = {}) {
    const nodeId = clean(input.nodeId, 180), validatorUserId = clean(input.validatorUserId || input.userId, 180);
    const requestId = clean(input.requestId, 240), receiptId = clean(input.receiptId, 240), receiptHash = clean(input.receiptHash || input.evidenceHash, 240);
    if (!nodeId || !validatorUserId || !requestId || !receiptId || !receiptHash) throw Object.assign(new TypeError('nodeId, validatorUserId, requestId, receiptId, and receiptHash are required.'), { status: 400 });
    if (input.accepted !== true) throw Object.assign(new RangeError('Only an accepted human validation can receive neurons.'), { status: 409 });
    if (clean(input.validatorMode, 40).toLowerCase() !== HUMAN_VALIDATION_NEURON_POLICY.validatorMode) throw Object.assign(new RangeError('Neuron validator payment requires Standard mode with AI access enabled.'), { status: 403 });
    if (!await this.member(nodeId, validatorUserId)) throw Object.assign(new RangeError('Validator is not admitted to this Guild.'), { status: 404 });

    const key = requestKey(requestId), stored = await this.state.storage.get(key);
    if (!stored || stored.nodeId !== nodeId) throw Object.assign(new RangeError('Human-validation neuron request was not found.'), { status: 404 });
    const request = { ...stored, claims: Array.isArray(stored.claims) ? [...stored.claims] : [] };
    if (request.requesterUserId === validatorUserId) throw Object.assign(new RangeError('A Lud requester cannot pay themselves for validating their own work.'), { status: 409 });
    if (Date.parse(request.expiresAt) <= Date.now()) throw Object.assign(new RangeError('This Lud validation payment expired at the daily neuron reset.'), { status: 410 });
    const prior = request.claims.find(claim => claim.validatorUserId === validatorUserId || claim.receiptId === receiptId);
    if (prior) {
      if (prior.validatorUserId !== validatorUserId || prior.receiptId !== receiptId) throw Object.assign(new RangeError('Validator or receipt has already been used for this request.'), { status: 409 });
      return { claim: prior, request: publicRequest(request), earned: await this.validationEarned(nodeId, validatorUserId), idempotent: true };
    }
    if (request.claims.length >= request.validatorCount) throw Object.assign(new RangeError('All validator neuron shares have already been claimed.'), { status: 409 });

    const neurons = Number(request.perValidatorNeurons || 0);
    if (!Number.isSafeInteger(neurons) || neurons < 1) throw Object.assign(new RangeError('Human-validation request has an invalid neuron split.'), { status: 500 });
    const earnedStorageKey = earnedKey(nodeId, validatorUserId), wallet = await this.validationEarned(nodeId, validatorUserId), at = new Date().toISOString();
    const nextWallet = Object.freeze({
      ...wallet,
      balanceNeurons: wallet.balanceNeurons + neurons,
      earnedNeurons: wallet.earnedNeurons + neurons,
      updatedAt: at,
    });
    const claim = Object.freeze({
      schema: 'civweave.human-validation-neuron-claim.v1',
      requestId,
      validatorUserId,
      receiptId,
      receiptHash,
      neurons,
      createdAt: at,
    });
    request.claims.push(claim);
    request.status = request.claims.length >= request.validatorCount ? 'completed' : 'open';
    request.updatedAt = at;
    await this.state.storage.put(earnedStorageKey, nextWallet);
    await this.state.storage.put(key, Object.freeze(request));
    return { claim, request: publicRequest(request), earned: publicEarned(nextWallet), idempotent: false };
  }

  async humanValidationStatus(input = {}) {
    const nodeId = clean(input.nodeId, 180), userId = clean(input.userId, 180);
    if (!nodeId || !userId) throw Object.assign(new TypeError('nodeId and userId are required.'), { status: 400 });
    if (!await this.member(nodeId, userId)) throw Object.assign(new RangeError('Member is not admitted to this Guild.'), { status: 404 });
    const now = Date.now(), day = dayKey(now), capacity = await this.snapshot(nodeId);
    const includedUsed = await storedNumber(this.state.storage, includedUsageKey(day, nodeId, userId), legacyUsageKey(day, nodeId, userId));
    const dailyValidationBudget = Math.min(HOST_ECONOMY_POLICY.baseIncludedDailyNeurons, Number(capacity.includedDailyNeurons || 0));
    const sourceRemainingNeurons = Math.max(0, dailyValidationBudget - includedUsed);
    const listed = await this.state.storage.list({ prefix: requestPrefix });
    const requests = [...listed.values()].filter(row => row?.nodeId === nodeId && (row.requesterUserId === userId || row.claims?.some?.(claim => claim.validatorUserId === userId))).map(row => publicRequest(row, now));
    return Object.freeze({
      schema: 'civweave.human-validation-neuron-status.v1',
      nodeId,
      userId,
      policy: HUMAN_VALIDATION_NEURON_POLICY,
      earned: await this.validationEarned(nodeId, userId),
      source: Object.freeze({
        dailyBudgetNeurons: dailyValidationBudget,
        remainingNeurons: sourceRemainingNeurons,
        requestsRemainingAtThirtyNeurons: Math.floor(sourceRemainingNeurons / HUMAN_VALIDATION_NEURON_POLICY.requestNeurons),
        resetsAt: resetAt(now).toISOString(),
      }),
      requests,
    });
  }

  async reserveValidationEarnedUsage(input = {}) {
    const nodeId = clean(input.nodeId, 180), userId = clean(input.userId, 180), requested = whole(input.requestedNeurons, 'requestedNeurons', 1);
    const billingCeiling = whole(input.billingCeilingNeurons ?? requested, 'billingCeilingNeurons', 1);
    if (!await this.member(nodeId, userId)) throw Object.assign(new RangeError('Member is not admitted to this Guild.'), { status: 404 });
    const earned = await this.validationEarned(nodeId, userId);
    if (requested > earned.balanceNeurons) throw Object.assign(new RangeError('Insufficient earned human-validation neurons.'), { status: 402 });
    const billingRail = clean(input.billingRail, 80).toLowerCase() || 'ai-gateway-unified-billing';
    if (!['workers-ai-free', 'workers-ai-paid-overage', 'ai-gateway-unified-billing'].includes(billingRail)) throw Object.assign(new RangeError('Unknown Cloudflare billing rail.'), { status: 400 });
    const capacity = await this.snapshot(nodeId), now = Date.now(), day = dayKey(now);
    if (billingRail === 'workers-ai-paid-overage' && capacity.workersPlan !== 'paid') throw Object.assign(new RangeError('Workers AI paid overage requires Workers Paid.'), { status: 409 });
    if (billingRail === 'workers-ai-free') {
      const workersFreeRemaining = Math.max(0, HOST_ECONOMY_POLICY.cloudflareFreeNeuronsPerDay - Number(capacity.dailyUsedNeurons || 0));
      if (requested > workersFreeRemaining) throw Object.assign(new RangeError('Shared Workers AI free allocation cannot cover this reservation.'), { status: 429 });
    } else {
      const config = await this.config(), required = neuronsToMicrocents(billingCeiling);
      if (required > Number(config.operatingReserveMicrocents || 0) + Number(config.communityTopupReserveMicrocents || 0) + Number(config.communityEndowmentMicrocents || 0)) throw Object.assign(new RangeError('Community compute reserve cannot cover earned validator inference.'), { status: 503 });
    }

    const totalKey = totalUsageKey(day, nodeId, userId), totalUsed = await storedNumber(this.state.storage, totalKey, legacyUsageKey(day, nodeId, userId));
    const reservationId = `compute:${crypto.randomUUID()}`, at = new Date().toISOString();
    await this.state.storage.put(totalKey, totalUsed + requested);
    if (billingRail === 'workers-ai-free') await this.state.storage.put(workersFreeTotalKey(day), Number(capacity.dailyUsedNeurons || 0) + requested);
    await this.state.storage.put(earnedKey(nodeId, userId), { ...earned, balanceNeurons: earned.balanceNeurons - requested, spentNeurons: earned.spentNeurons + requested, updatedAt: at });
    const reservation = Object.freeze({
      schema: 'civweave.compute-reservation.v2', reservationId, nodeId, userId, day,
      requestedNeurons: requested,
      billingCeilingNeurons: billingCeiling,
      fromIncludedNeurons: 0,
      fromLifetimeNeurons: 0,
      fromValidationEarnedNeurons: requested,
      fundingSource: 'validation-earned',
      billingRail,
      billingModel: clean(input.billingModel, 180) || null,
      createdAt: at,
    });
    await this.state.storage.put(reservationKey(reservationId), reservation);
    return { reservation, capacity: await this.snapshot(nodeId) };
  }

  async reserveUsage(input = {}) {
    const requested = whole(input.requestedNeurons, 'requestedNeurons', 1);
    if (clean(input.fundingSource, 40).toLowerCase() === 'validation-earned') return this.reserveValidationEarnedUsage(input);
    if (clean(input.fundingSource, 40).toLowerCase() === 'lifetime') {
      const earned = await this.validationEarned(input.nodeId, input.userId);
      if (earned.balanceNeurons >= requested) return this.reserveValidationEarnedUsage({ ...input, fundingSource: 'validation-earned' });
    }
    return super.reserveUsage(input);
  }

  async settleUsage(input = {}) {
    const id = clean(input.reservationId, 240), key = reservationKey(id), reservation = await this.state.storage.get(key);
    if (!reservation || reservation.fundingSource !== 'validation-earned') return super.settleUsage(input);
    const actual = whole(input.actualNeurons, 'actualNeurons'), actualBilling = whole(input.actualBillingNeurons ?? actual, 'actualBillingNeurons');
    if (actual > reservation.requestedNeurons) throw Object.assign(new RangeError('actualNeurons cannot exceed the reservation.'), { status: 409 });
    if (actualBilling > reservation.billingCeilingNeurons) throw Object.assign(new RangeError('actualBillingNeurons cannot exceed the billing reservation.'), { status: 409 });
    const refund = reservation.requestedNeurons - actual;
    const totalKey = totalUsageKey(reservation.day, reservation.nodeId, reservation.userId), currentTotal = await storedNumber(this.state.storage, totalKey);
    await this.state.storage.put(totalKey, Math.max(0, currentTotal - refund));
    if (refund > 0) {
      const earned = await this.validationEarned(reservation.nodeId, reservation.userId);
      await this.state.storage.put(earnedKey(reservation.nodeId, reservation.userId), { ...earned, balanceNeurons: earned.balanceNeurons + refund, spentNeurons: Math.max(0, earned.spentNeurons - refund), updatedAt: new Date().toISOString() });
    }
    if (reservation.billingRail === 'workers-ai-free') {
      const freeKey = workersFreeTotalKey(reservation.day), currentFree = await storedNumber(this.state.storage, freeKey);
      await this.state.storage.put(freeKey, Math.max(0, currentFree - refund));
    }
    let chargedSpendableMicrocents = 0;
    if (reservation.billingRail !== 'workers-ai-free' && actualBilling > 0) {
      chargedSpendableMicrocents = neuronsToMicrocents(actualBilling);
      const config = await this.config();
      let remaining = chargedSpendableMicrocents;
      const operatingDebit = Math.min(Number(config.operatingReserveMicrocents || 0), remaining); config.operatingReserveMicrocents -= operatingDebit; remaining -= operatingDebit;
      const communityTopupDebit = Math.min(Number(config.communityTopupReserveMicrocents || 0), remaining); config.communityTopupReserveMicrocents -= communityTopupDebit; remaining -= communityTopupDebit;
      const endowmentDebit = Math.min(Number(config.communityEndowmentMicrocents || 0), remaining); config.communityEndowmentMicrocents -= endowmentDebit; remaining -= endowmentDebit;
      if (remaining > 0) throw Object.assign(new RangeError('Community compute reserve is insufficient for earned validator settlement.'), { status: 503 });
      await this.putConfig(config);
    }
    await this.state.storage.delete(key);
    return Object.freeze({
      schema: 'civweave.compute-settlement.v2', reservationId: id,
      billingRail: reservation.billingRail, billingModel: reservation.billingModel, fundingSource: 'validation-earned',
      requestedNeurons: reservation.requestedNeurons, actualNeurons: actual, actualBillingNeurons: actualBilling,
      chargedSpendableMicrocents, refundedNeurons: refund,
      refundedIncludedNeurons: 0,
      refundedLifetimeNeurons: 0,
      refundedValidationEarnedNeurons: refund,
      capacity: await this.snapshot(reservation.nodeId),
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/human-validation/requests/open') {
      try { return Response.json(await this.openHumanValidationRequest(await request.json().catch(() => ({})))); }
      catch (error) { return Response.json({ ok: false, error: String(error?.message || error) }, { status: Number.isSafeInteger(error?.status) ? error.status : 500 }); }
    }
    if (request.method === 'POST' && url.pathname === '/human-validation/claims') {
      try { return Response.json(await this.claimHumanValidation(await request.json().catch(() => ({})))); }
      catch (error) { return Response.json({ ok: false, error: String(error?.message || error) }, { status: Number.isSafeInteger(error?.status) ? error.status : 500 }); }
    }
    if (request.method === 'POST' && url.pathname === '/human-validation/status') {
      try { return Response.json(await this.humanValidationStatus(await request.json().catch(() => ({})))); }
      catch (error) { return Response.json({ ok: false, error: String(error?.message || error) }, { status: Number.isSafeInteger(error?.status) ? error.status : 500 }); }
    }
    return super.fetch(request);
  }
}
