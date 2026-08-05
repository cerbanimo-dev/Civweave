import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  availableCents,
  createWallet,
  getAiPlan,
  reserveWalletSpend,
  settleWalletSpend,
  cancelWalletReservation
} from './ai-wallet-policy-v1.mjs';
import { issueAiCapability } from './ai-capability-token-v1.mjs';

const SCHEMA = 'commonweave.ai-wallet-ledger.v1';

function clean(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required.`);
  return text;
}
function positiveCents(value, label = 'amountCents') {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${label} must be a positive integer.`);
  return value;
}
function normalizeWallet(wallet) {
  if (!wallet || typeof wallet !== 'object') return null;
  return {
    ...wallet,
    debtCents: Number.isSafeInteger(wallet?.debtCents) && wallet.debtCents >= 0 ? wallet.debtCents : 0,
    walletVersion: clean(wallet?.walletVersion || 'initial', 'walletVersion'),
    reservations: wallet?.reservations && typeof wallet.reservations === 'object' ? wallet.reservations : {},
    reservedCents: Number.isSafeInteger(wallet?.reservedCents) && wallet.reservedCents >= 0 ? wallet.reservedCents : 0
  };
}

export class AiWalletService {
  constructor({ filePath, capabilitySecret }) {
    this.filePath = path.resolve(clean(filePath, 'filePath'));
    this.capabilitySecret = clean(capabilitySecret, 'capabilitySecret');
    this.state = { schema: SCHEMA, wallets: {}, sourceEvents: {}, updatedAt: new Date().toISOString() };
    this.mutationQueue = Promise.resolve();
  }

  async load() {
    try {
      const saved = JSON.parse(await fsp.readFile(this.filePath, 'utf8'));
      if (saved?.schema !== SCHEMA || typeof saved.wallets !== 'object' || typeof saved.sourceEvents !== 'object') throw new Error('Unsupported AI wallet ledger.');
      saved.wallets = Object.fromEntries(Object.entries(saved.wallets).map(([userId, wallet]) => [userId, normalizeWallet(wallet)]));
      this.state = saved;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.persist();
    }
    return this;
  }

  async persist() {
    await this.#writeSnapshot();
  }

  async flush() {
    await this.mutationQueue;
  }

  async #writeSnapshot() {
    this.state.updatedAt = new Date().toISOString();
    const snapshot = JSON.stringify(this.state, null, 2);
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fsp.writeFile(temporary, snapshot, { encoding: 'utf8', mode: 0o600 });
    await fsp.rename(temporary, this.filePath);
  }

  async #mutate(operation) {
    const run = this.mutationQueue.then(async () => {
      const result = await operation();
      await this.#writeSnapshot();
      return structuredClone(result);
    });
    this.mutationQueue = run.catch(() => {});
    return run;
  }

  getWallet(userId) {
    const id = clean(userId, 'userId');
    const wallet = this.state.wallets[id];
    return wallet ? structuredClone(normalizeWallet(wallet)) : null;
  }

  getSourceEvent(sourceId) {
    const source = clean(sourceId, 'sourceId');
    const event = this.state.sourceEvents[source];
    return event ? structuredClone(event) : null;
  }

  async ensureWallet({ userId, planId = 'local' }) {
    const id = clean(userId, 'userId');
    getAiPlan(planId);
    if (this.state.wallets[id]) return this.getWallet(id);
    return this.#mutate(() => {
      if (!this.state.wallets[id]) {
        this.state.wallets[id] = normalizeWallet(createWallet({ walletId: `wallet:${crypto.randomUUID()}`, userId: id, planId }));
      }
      return this.state.wallets[id];
    });
  }

  async credit({ userId, amountCents, sourceId, planId }) {
    const id = clean(userId, 'userId');
    const source = clean(sourceId, 'sourceId');
    const amount = positiveCents(amountCents);
    if (planId) getAiPlan(planId);
    return this.#mutate(() => {
      const prior = this.state.sourceEvents[source];
      if (prior) {
        if (prior.userId !== id) throw new Error('Payment source ID is already bound to a different user.');
        return this.state.wallets[id];
      }
      let wallet = normalizeWallet(this.state.wallets[id] || createWallet({ walletId: `wallet:${crypto.randomUUID()}`, userId: id, planId: planId || 'local' }));
      const appliedToDebtCents = Math.min(wallet.debtCents, amount);
      const creditedToBalanceCents = amount - appliedToDebtCents;
      wallet = {
        ...wallet,
        planId: planId || wallet.planId,
        debtCents: wallet.debtCents - appliedToDebtCents,
        balanceCents: wallet.balanceCents + creditedToBalanceCents,
        walletVersion: crypto.randomUUID(),
        updatedAt: new Date().toISOString()
      };
      this.state.wallets[id] = wallet;
      this.state.sourceEvents[source] = { type: 'credit', userId: id, amountCents: amount, appliedToDebtCents, creditedToBalanceCents, planId: wallet.planId, at: wallet.updatedAt };
      return wallet;
    });
  }

  async debit({ userId, amountCents, sourceId, planId }) {
    const id = clean(userId, 'userId');
    const source = clean(sourceId, 'sourceId');
    const amount = positiveCents(amountCents);
    if (planId) getAiPlan(planId);
    return this.#mutate(() => {
      const prior = this.state.sourceEvents[source];
      if (prior) {
        if (prior.userId !== id) throw new Error('Payment source ID is already bound to a different user.');
        return this.state.wallets[id];
      }
      const wallet = normalizeWallet(this.state.wallets[id]);
      if (!wallet) throw new RangeError(`No hosted-AI wallet exists for ${id}.`);
      const recoverableCents = Math.min(availableCents(wallet), amount);
      const debtAddedCents = amount - recoverableCents;
      const next = {
        ...wallet,
        planId: planId || wallet.planId,
        balanceCents: wallet.balanceCents - recoverableCents,
        debtCents: wallet.debtCents + debtAddedCents,
        walletVersion: crypto.randomUUID(),
        updatedAt: new Date().toISOString()
      };
      this.state.wallets[id] = next;
      this.state.sourceEvents[source] = { type: 'debit', userId: id, amountCents: amount, recoveredCents: recoverableCents, debtAddedCents, planId: next.planId, at: next.updatedAt };
      return next;
    });
  }

  async reserve({ userId, reservationId, maxCostCents, model, metadata, ttlSeconds = 900 }) {
    const id = clean(userId, 'userId');
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 900) throw new RangeError('Reservation lifetime must be between 30 and 900 seconds.');
    return this.#mutate(() => {
      const wallet = normalizeWallet(this.state.wallets[id]);
      if (!wallet) throw new RangeError(`No hosted-AI wallet exists for ${id}.`);
      if (wallet.debtCents > 0) throw new RangeError('Hosted-AI wallet has an unpaid refund or chargeback balance.');
      const at = new Date().toISOString();
      const reserved = reserveWalletSpend(wallet, { reservationId, maxCostCents, model, metadata, at });
      reserved.reservations[clean(reservationId, 'reservationId')].expiresAt = new Date(Date.parse(at) + ttlSeconds * 1000).toISOString();
      this.state.wallets[id] = {
        ...reserved,
        debtCents: wallet.debtCents,
        walletVersion: crypto.randomUUID()
      };
      return this.state.wallets[id];
    });
  }

  async expireReservations({ userId, at = new Date().toISOString() }) {
    const id = clean(userId, 'userId');
    const cutoff = Date.parse(at);
    if (!Number.isFinite(cutoff)) throw new TypeError('at must be a valid date.');
    const snapshot = this.getWallet(id);
    if (!snapshot) return null;
    const hasExpired = Object.values(snapshot.reservations || {}).some(item => item.expiresAt && Date.parse(item.expiresAt) <= cutoff);
    if (!hasExpired) return snapshot;
    return this.#mutate(() => {
      let wallet = normalizeWallet(this.state.wallets[id]);
      if (!wallet) return null;
      const expired = Object.values(wallet.reservations || {}).filter(item => item.expiresAt && Date.parse(item.expiresAt) <= cutoff);
      if (!expired.length) return wallet;
      for (const item of expired) wallet = cancelWalletReservation(wallet, item.reservationId, at);
      this.state.wallets[id] = { ...wallet, debtCents: wallet.debtCents, walletVersion: crypto.randomUUID() };
      return this.state.wallets[id];
    });
  }

  async settle({ userId, reservationId, actualCostCents }) {
    const id = clean(userId, 'userId');
    return this.#mutate(() => {
      const wallet = normalizeWallet(this.state.wallets[id]);
      if (!wallet) throw new RangeError(`No hosted-AI wallet exists for ${id}.`);
      this.state.wallets[id] = {
        ...settleWalletSpend(wallet, { reservationId, actualCostCents }),
        debtCents: wallet.debtCents,
        walletVersion: crypto.randomUUID()
      };
      return this.state.wallets[id];
    });
  }

  async cancel({ userId, reservationId }) {
    const id = clean(userId, 'userId');
    return this.#mutate(() => {
      const wallet = normalizeWallet(this.state.wallets[id]);
      if (!wallet) return null;
      this.state.wallets[id] = {
        ...cancelWalletReservation(wallet, reservationId),
        debtCents: wallet.debtCents,
        walletVersion: crypto.randomUUID()
      };
      return this.state.wallets[id];
    });
  }

  issueCapability({ userId, deviceId, models, maxRequestCents, ttlSeconds = 900 }) {
    const wallet = normalizeWallet(this.getWallet(userId));
    if (!wallet) throw new RangeError(`No hosted-AI wallet exists for ${userId}.`);
    if (wallet.debtCents > 0) throw new RangeError('Hosted-AI wallet has an unpaid refund or chargeback balance.');
    const plan = getAiPlan(wallet.planId);
    const allowedModels = Array.isArray(models) && models.length ? [...new Set(models)] : [...plan.allowedHostedModels];
    if (!allowedModels.length || allowedModels.some(model => !plan.allowedHostedModels.includes(model))) throw new RangeError(`Requested model set exceeds the ${plan.id} plan.`);
    if (!Number.isSafeInteger(maxRequestCents) || maxRequestCents < 1 || maxRequestCents > plan.maxRequestCents) throw new RangeError(`Capability exceeds the ${plan.id} per-request limit.`);
    if (availableCents(wallet) < maxRequestCents) throw new RangeError('Insufficient hosted-AI balance for this capability ceiling.');
    return issueAiCapability({
      userId,
      deviceId,
      planId: wallet.planId,
      models: allowedModels,
      maxRequestCents,
      dailyLimitCents: plan.dailyHostedLimitCents,
      walletVersion: wallet.walletVersion,
      ttlSeconds
    }, { secret: this.capabilitySecret });
  }
}
