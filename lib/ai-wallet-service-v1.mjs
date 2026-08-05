import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  createWallet,
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

export class AiWalletService {
  constructor({ filePath, capabilitySecret }) {
    this.filePath = path.resolve(clean(filePath, 'filePath'));
    this.capabilitySecret = clean(capabilitySecret, 'capabilitySecret');
    this.state = { schema: SCHEMA, wallets: {}, sourceEvents: {}, updatedAt: new Date().toISOString() };
    this.writeQueue = Promise.resolve();
  }

  async load() {
    try {
      const saved = JSON.parse(await fsp.readFile(this.filePath, 'utf8'));
      if (saved?.schema !== SCHEMA || typeof saved.wallets !== 'object') throw new Error('Unsupported AI wallet ledger.');
      this.state = saved;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.persist();
    }
    return this;
  }

  async persist() {
    this.state.updatedAt = new Date().toISOString();
    const snapshot = JSON.stringify(this.state, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
      await fsp.writeFile(temporary, snapshot, { encoding: 'utf8', mode: 0o600 });
      await fsp.rename(temporary, this.filePath);
    });
    await this.writeQueue;
  }

  getWallet(userId) {
    const id = clean(userId, 'userId');
    const wallet = this.state.wallets[id];
    return wallet ? structuredClone(wallet) : null;
  }

  async ensureWallet({ userId, planId = 'local' }) {
    const id = clean(userId, 'userId');
    if (!this.state.wallets[id]) {
      this.state.wallets[id] = createWallet({ walletId: `wallet:${crypto.randomUUID()}`, userId: id, planId });
      await this.persist();
    }
    return this.getWallet(id);
  }

  async credit({ userId, amountCents, sourceId, planId }) {
    const id = clean(userId, 'userId');
    const source = clean(sourceId, 'sourceId');
    if (!Number.isSafeInteger(amountCents) || amountCents < 1) throw new TypeError('amountCents must be a positive integer.');
    if (this.state.sourceEvents[source]) return this.getWallet(id);
    let wallet = this.state.wallets[id] || createWallet({ walletId: `wallet:${crypto.randomUUID()}`, userId: id, planId: planId || 'local' });
    wallet = {
      ...wallet,
      planId: planId || wallet.planId,
      balanceCents: wallet.balanceCents + amountCents,
      walletVersion: crypto.randomUUID(),
      updatedAt: new Date().toISOString()
    };
    this.state.wallets[id] = wallet;
    this.state.sourceEvents[source] = { type: 'credit', userId: id, amountCents, at: wallet.updatedAt };
    await this.persist();
    return this.getWallet(id);
  }

  async reserve({ userId, reservationId, maxCostCents, model, metadata }) {
    const id = clean(userId, 'userId');
    const wallet = this.state.wallets[id];
    if (!wallet) throw new RangeError(`No hosted-AI wallet exists for ${id}.`);
    this.state.wallets[id] = {
      ...reserveWalletSpend(wallet, { reservationId, maxCostCents, model, metadata }),
      walletVersion: crypto.randomUUID()
    };
    await this.persist();
    return this.getWallet(id);
  }

  async settle({ userId, reservationId, actualCostCents }) {
    const id = clean(userId, 'userId');
    const wallet = this.state.wallets[id];
    if (!wallet) throw new RangeError(`No hosted-AI wallet exists for ${id}.`);
    this.state.wallets[id] = {
      ...settleWalletSpend(wallet, { reservationId, actualCostCents }),
      walletVersion: crypto.randomUUID()
    };
    await this.persist();
    return this.getWallet(id);
  }

  async cancel({ userId, reservationId }) {
    const id = clean(userId, 'userId');
    const wallet = this.state.wallets[id];
    if (!wallet) return null;
    this.state.wallets[id] = {
      ...cancelWalletReservation(wallet, reservationId),
      walletVersion: crypto.randomUUID()
    };
    await this.persist();
    return this.getWallet(id);
  }

  issueCapability({ userId, deviceId, models, maxRequestCents, ttlSeconds = 900 }) {
    const wallet = this.getWallet(userId);
    if (!wallet) throw new RangeError(`No hosted-AI wallet exists for ${userId}.`);
    const walletVersion = wallet.walletVersion || 'initial';
    return issueAiCapability({
      userId,
      deviceId,
      planId: wallet.planId,
      models,
      maxRequestCents,
      dailyLimitCents: Math.max(maxRequestCents, wallet.balanceCents),
      walletVersion,
      ttlSeconds
    }, { secret: this.capabilitySecret });
  }
}
