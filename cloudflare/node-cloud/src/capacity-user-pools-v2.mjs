import {
  CivweaveCapacityAccount as BaseCapacityAccount,
  HOST_ECONOMY_POLICY,
  neuronsToMicrocents,
} from './capacity.mjs';

const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const whole = (value, label, min = 0) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min) throw new RangeError(`${label} must be an integer >= ${min}.`);
  return number;
};
const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
const walletKey = (nodeId, userId) => `credits:${clean(nodeId, 180)}:${clean(userId, 180)}`;
const legacyUsageKey = (day, nodeId, userId) => `usage:${day}:${clean(nodeId, 180)}:${clean(userId, 180)}`;
const includedUsageKey = (day, nodeId, userId) => `usage-v2:included:${day}:${clean(nodeId, 180)}:${clean(userId, 180)}`;
const totalUsageKey = (day, nodeId, userId) => `usage-v2:total:${day}:${clean(nodeId, 180)}:${clean(userId, 180)}`;
const workersFreeTotalKey = day => `usage-v2:workers-free-total:${day}`;
const reservationKey = id => `reservation:${clean(id, 240)}`;

function publicCapacity(capacity) {
  if (!capacity || typeof capacity !== 'object') return capacity;
  const { reservesMicrocents, ...safe } = capacity;
  return Object.freeze(safe);
}
function publicMember(member) {
  if (!member || typeof member !== 'object') return member;
  const { loginCredentialHash, ...safe } = member;
  return Object.freeze(safe);
}
async function storedNumber(storage, key, fallbackKey = '') {
  const value = await storage.get(key);
  if (value != null) return Math.max(0, Number(value || 0));
  if (!fallbackKey) return 0;
  return Math.max(0, Number(await storage.get(fallbackKey) || 0));
}

export class CivweaveUserPoolCapacityAccount extends BaseCapacityAccount {
  async dailyTotal(now = Date.now()) {
    const day = dayKey(now);
    return storedNumber(this.state.storage, workersFreeTotalKey(day), `daily-total:${day}`);
  }

  async memberStatus(input) {
    const nodeId = clean(input.nodeId, 180), userId = clean(input.userId, 180);
    if (!nodeId || !userId) throw Object.assign(new TypeError('nodeId and userId are required.'), { status: 400 });
    const member = await this.member(nodeId, userId);
    if (!member) throw Object.assign(new RangeError('Member is not admitted to this node.'), { status: 404 });
    const now = Date.now(), day = dayKey(now);
    const [capacity, wallet, includedUsedNeurons, totalUsedNeurons] = await Promise.all([
      this.snapshot(nodeId),
      this.wallet(nodeId, userId),
      storedNumber(this.state.storage, includedUsageKey(day, nodeId, userId), legacyUsageKey(day, nodeId, userId)),
      storedNumber(this.state.storage, totalUsageKey(day, nodeId, userId), legacyUsageKey(day, nodeId, userId)),
    ]);
    const includedUsed = Math.min(capacity.includedDailyNeurons, includedUsedNeurons);
    const includedRemainingNeurons = Math.max(0, capacity.includedDailyNeurons - includedUsed);
    const lifetimeRemainingNeurons = wallet.debtNeurons > 0 ? 0 : Math.max(0, wallet.balanceNeurons);
    const workersAiFreeRemainingNeurons = Math.max(0, HOST_ECONOMY_POLICY.cloudflareFreeNeuronsPerDay - Number(capacity.dailyUsedNeurons || 0));
    const reset = new Date(now); reset.setUTCHours(24, 0, 0, 0);
    return Object.freeze({
      schema: 'civweave.host-member-status.v2',
      member: publicMember(member),
      capacity: Object.freeze({ ...publicCapacity(capacity), workersAiFreeRemainingNeurons }),
      quota: Object.freeze({
        usedNeuronsToday: totalUsedNeurons,
        includedDailyNeurons: capacity.includedDailyNeurons,
        includedUsedNeurons: includedUsed,
        includedRemainingNeurons,
        lifetimeRemainingNeurons,
        totalRemainingNeurons: includedRemainingNeurons + lifetimeRemainingNeurons,
        debtNeurons: Math.max(0, wallet.debtNeurons),
        workersAiFreeRemainingNeurons,
        resetsAt: reset.toISOString(),
      }),
    });
  }

  async reserveUsage(input) {
    const nodeId = clean(input.nodeId, 180), userId = clean(input.userId, 180);
    const requested = whole(input.requestedNeurons, 'requestedNeurons', 1);
    const billingCeiling = whole(input.billingCeilingNeurons ?? requested, 'billingCeilingNeurons', 1);
    const member = await this.member(nodeId, userId);
    if (!member) throw Object.assign(new RangeError('Member is not admitted to this node.'), { status: 404 });

    const now = Date.now(), day = dayKey(now), capacity = await this.snapshot(nodeId);
    const includedKey = includedUsageKey(day, nodeId, userId), totalKey = totalUsageKey(day, nodeId, userId), legacyKey = legacyUsageKey(day, nodeId, userId);
    const includedUsed = await storedNumber(this.state.storage, includedKey, legacyKey);
    const totalUsed = await storedNumber(this.state.storage, totalKey, legacyKey);
    const includedRemaining = Math.max(0, capacity.includedDailyNeurons - includedUsed);
    const workersFreeRemaining = Math.max(0, HOST_ECONOMY_POLICY.cloudflareFreeNeuronsPerDay - Number(capacity.dailyUsedNeurons || 0));

    let billingRail = clean(input.billingRail, 80).toLowerCase();
    let fundingSource = clean(input.fundingSource, 40).toLowerCase();
    if (!billingRail || !fundingSource) {
      if (requested <= includedRemaining && requested <= workersFreeRemaining) {
        billingRail = 'workers-ai-free'; fundingSource = 'included';
      } else if (requested <= includedRemaining) {
        billingRail = capacity.workersPlan === 'paid' ? 'workers-ai-paid-overage' : 'ai-gateway-unified-billing'; fundingSource = 'included';
      } else {
        billingRail = 'ai-gateway-unified-billing'; fundingSource = 'lifetime';
      }
    }
    if (!['workers-ai-free', 'workers-ai-paid-overage', 'ai-gateway-unified-billing'].includes(billingRail)) throw Object.assign(new RangeError('Unknown Cloudflare billing rail.'), { status: 400 });
    if (!['included', 'lifetime'].includes(fundingSource)) throw Object.assign(new RangeError('Unknown compute funding source.'), { status: 400 });
    if (billingRail === 'workers-ai-paid-overage' && capacity.workersPlan !== 'paid') throw Object.assign(new RangeError('Workers AI paid overage requires Workers Paid.'), { status: 409 });
    if (billingRail === 'workers-ai-free' && fundingSource !== 'included') throw Object.assign(new RangeError('The shared Workers AI free pool may only fund included user allowance.'), { status: 409 });
    if (fundingSource === 'included' && requested > includedRemaining) throw Object.assign(new RangeError('Request exceeds this user\'s remaining included compute.'), { status: 402 });
    if (billingRail === 'workers-ai-free' && requested > workersFreeRemaining) throw Object.assign(new RangeError('Shared Workers AI free allocation cannot cover this reservation.'), { status: 429 });

    const wallet = await this.wallet(nodeId, userId);
    if (fundingSource === 'lifetime') {
      if (input.allowLifetimeCredits !== true) throw Object.assign(new RangeError('Request exceeds today\'s included compute; explicit lifetime-credit permission is required.'), { status: 402 });
      if (wallet.debtNeurons > 0) throw Object.assign(new RangeError('Lifetime compute wallet has an outstanding refunded/chargeback debt.'), { status: 402 });
      if (requested > wallet.balanceNeurons) throw Object.assign(new RangeError('Insufficient lifetime compute credits.'), { status: 402 });
    }

    if (billingRail !== 'workers-ai-free') {
      const config = await this.config(), requiredSpendableCredits = neuronsToMicrocents(billingCeiling);
      if (fundingSource === 'lifetime' && requiredSpendableCredits > config.creditReserveMicrocents) throw Object.assign(new RangeError('Lifetime-credit reserve cannot cover this paid inference.'), { status: 503 });
      if (fundingSource === 'included' && requiredSpendableCredits > config.operatingReserveMicrocents + config.communityEndowmentMicrocents) throw Object.assign(new RangeError('Included-service reserve cannot cover this paid inference.'), { status: 503 });
    }

    const reservationId = `compute:${crypto.randomUUID()}`;
    await this.state.storage.put(totalKey, totalUsed + requested);
    if (fundingSource === 'included') await this.state.storage.put(includedKey, includedUsed + requested);
    if (billingRail === 'workers-ai-free') await this.state.storage.put(workersFreeTotalKey(day), Number(capacity.dailyUsedNeurons || 0) + requested);
    if (fundingSource === 'lifetime') {
      await this.state.storage.put(walletKey(nodeId, userId), {
        ...wallet,
        balanceNeurons: wallet.balanceNeurons - requested,
        spentNeurons: wallet.spentNeurons + requested,
        updatedAt: new Date().toISOString(),
      });
    }
    const reservation = Object.freeze({
      schema: 'civweave.compute-reservation.v2', reservationId, nodeId, userId, day,
      requestedNeurons: requested,
      billingCeilingNeurons: billingCeiling,
      fromIncludedNeurons: fundingSource === 'included' ? requested : 0,
      fromLifetimeNeurons: fundingSource === 'lifetime' ? requested : 0,
      fundingSource, billingRail,
      billingModel: clean(input.billingModel, 180) || null,
      createdAt: new Date().toISOString(),
    });
    await this.state.storage.put(reservationKey(reservationId), reservation);
    return { reservation, capacity: await this.snapshot(nodeId) };
  }

  async settleUsage(input) {
    const id = clean(input.reservationId, 240), key = reservationKey(id), reservation = await this.state.storage.get(key);
    if (!reservation) throw Object.assign(new RangeError('Unknown compute reservation.'), { status: 404 });
    const actual = whole(input.actualNeurons, 'actualNeurons');
    const actualBilling = whole(input.actualBillingNeurons ?? actual, 'actualBillingNeurons');
    if (actual > reservation.requestedNeurons) throw Object.assign(new RangeError('actualNeurons cannot exceed the reservation.'), { status: 409 });
    if (actualBilling > reservation.billingCeilingNeurons) throw Object.assign(new RangeError('actualBillingNeurons cannot exceed the billing reservation.'), { status: 409 });

    const refund = reservation.requestedNeurons - actual;
    const includedKey = includedUsageKey(reservation.day, reservation.nodeId, reservation.userId), totalKey = totalUsageKey(reservation.day, reservation.nodeId, reservation.userId);
    const currentTotal = await storedNumber(this.state.storage, totalKey);
    await this.state.storage.put(totalKey, Math.max(0, currentTotal - refund));
    if (reservation.fundingSource === 'included') {
      const currentIncluded = await storedNumber(this.state.storage, includedKey);
      await this.state.storage.put(includedKey, Math.max(0, currentIncluded - refund));
    } else if (refund > 0) {
      const wallet = await this.wallet(reservation.nodeId, reservation.userId);
      await this.state.storage.put(walletKey(reservation.nodeId, reservation.userId), {
        ...wallet,
        balanceNeurons: wallet.balanceNeurons + refund,
        spentNeurons: Math.max(0, wallet.spentNeurons - refund),
        updatedAt: new Date().toISOString(),
      });
    }

    if (reservation.billingRail === 'workers-ai-free') {
      const freeKey = workersFreeTotalKey(reservation.day), currentFree = await storedNumber(this.state.storage, freeKey);
      await this.state.storage.put(freeKey, Math.max(0, currentFree - refund));
    }

    let chargedSpendableMicrocents = 0;
    if (reservation.billingRail !== 'workers-ai-free' && actualBilling > 0) {
      chargedSpendableMicrocents = neuronsToMicrocents(actualBilling);
      const config = await this.config();
      if (reservation.fundingSource === 'lifetime') {
        if (chargedSpendableMicrocents > config.creditReserveMicrocents) throw Object.assign(new RangeError('Lifetime-credit reserve is insufficient for settlement.'), { status: 503 });
        config.creditReserveMicrocents -= chargedSpendableMicrocents;
      } else {
        let remaining = chargedSpendableMicrocents;
        const operatingDebit = Math.min(config.operatingReserveMicrocents, remaining); config.operatingReserveMicrocents -= operatingDebit; remaining -= operatingDebit;
        const endowmentDebit = Math.min(config.communityEndowmentMicrocents, remaining); config.communityEndowmentMicrocents -= endowmentDebit; remaining -= endowmentDebit;
        if (remaining > 0) throw Object.assign(new RangeError('Included-service reserve is insufficient for settlement.'), { status: 503 });
      }
      await this.putConfig(config);
    }

    await this.state.storage.delete(key);
    return Object.freeze({
      schema: 'civweave.compute-settlement.v2', reservationId: id,
      billingRail: reservation.billingRail, billingModel: reservation.billingModel, fundingSource: reservation.fundingSource,
      requestedNeurons: reservation.requestedNeurons, actualNeurons: actual, actualBillingNeurons: actualBilling,
      chargedSpendableMicrocents, refundedNeurons: refund,
      refundedIncludedNeurons: reservation.fundingSource === 'included' ? refund : 0,
      refundedLifetimeNeurons: reservation.fundingSource === 'lifetime' ? refund : 0,
      capacity: await this.snapshot(reservation.nodeId),
    });
  }
}
