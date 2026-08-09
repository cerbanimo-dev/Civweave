import crypto from 'node:crypto';
import { createUsageReceipt, signNodeReceipt } from './node-ai-marketplace-v1.mjs';

function clean(value, label, max = 500) {
  const text = String(value ?? '').trim().slice(0, max);
  if (!text) throw new TypeError(`${label} is required.`);
  return text;
}
function positiveCents(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${label} must be a positive integer number of cents.`);
  return value;
}
function nonNegativeCents(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative integer number of cents.`);
  return value;
}

export class NodeAiInferenceGate {
  constructor({ ledger, manifest, serviceHandlers = {}, receiptPrivateKey = null, receiptKeyId = 'node-default' } = {}) {
    if (!ledger) throw new TypeError('ledger is required.');
    if (!manifest?.nodeId || !Array.isArray(manifest.services)) throw new TypeError('A node AI service manifest is required.');
    this.ledger = ledger;
    this.manifest = manifest;
    this.serviceHandlers = new Map(Object.entries(serviceHandlers));
    this.receiptPrivateKey = receiptPrivateKey;
    this.receiptKeyId = receiptKeyId;
  }

  register(serviceId, handler) {
    const id = clean(serviceId, 'serviceId', 120);
    if (!handler || typeof handler.quote !== 'function' || typeof handler.execute !== 'function') {
      throw new TypeError('A node AI service handler must expose quote() and execute().');
    }
    this.serviceHandlers.set(id, handler);
    return this;
  }

  service(serviceId) {
    const id = clean(serviceId, 'serviceId', 120);
    const service = this.manifest.services.find(item => item.id === id);
    if (!service) throw new RangeError(`Node does not advertise AI service ${id}.`);
    const handler = this.serviceHandlers.get(id);
    if (!handler || typeof handler.quote !== 'function' || typeof handler.execute !== 'function') throw new RangeError(`Node AI service ${id} has no implementation handler.`);
    return { id, service, handler };
  }

  async execute({ userId, serviceId, request, requestId = `node-ai:${crypto.randomUUID()}`, retailCeilingCents = null, metadata = {} } = {}) {
    const owner = clean(userId, 'userId', 180);
    const requestKey = clean(requestId, 'requestId', 180);
    const { id, service, handler } = this.service(serviceId);
    const durableReplay = typeof this.ledger.getInferenceSettlement === 'function' && typeof this.ledger.settleInference === 'function';
    if (durableReplay) {
      const prior = this.ledger.getInferenceSettlement({ userId: owner, requestId: requestKey, serviceId: id });
      if (prior) {
        return Object.freeze({
          output: null,
          wallet: this.ledger.getWallet(owner),
          retailCostCents: prior.retailCostCents,
          quote: null,
          receipt: prior.receipt,
          replayed: true,
          replayOutputAvailable: false
        });
      }
      if (typeof this.ledger.expireReservations === 'function') this.ledger.expireReservations();
    }

    const startedAt = new Date().toISOString();
    const quote = await handler.quote({ request, userId: owner, requestId: requestKey, service, manifest: this.manifest });
    const maxRetailCostCents = positiveCents(quote?.maxRetailCostCents, 'quote.maxRetailCostCents');
    if (retailCeilingCents != null) {
      const ceiling = positiveCents(retailCeilingCents, 'retailCeilingCents');
      if (maxRetailCostCents > ceiling) throw new RangeError('Quoted retail cost exceeds the authorized capability ceiling.');
    }
    if (service.billing?.maxRequestCents != null && maxRetailCostCents > service.billing.maxRequestCents) {
      throw new RangeError(`Quoted retail cost exceeds the advertised ${id} service limit.`);
    }
    const reservationId = `retail:${requestKey}`;
    const reserved = this.ledger.reserve({ userId: owner, reservationId, serviceId: id, maxRetailCostCents, metadata: { requestId: requestKey, ...metadata }, ttlSeconds: quote?.ttlSeconds || 900 });
    const ownsReservation = !reserved?.idempotent;
    if (durableReplay && !ownsReservation) {
      const prior = this.ledger.getInferenceSettlement({ userId: owner, requestId: requestKey, serviceId: id });
      if (prior) {
        return Object.freeze({
          output: null,
          wallet: this.ledger.getWallet(owner),
          retailCostCents: prior.retailCostCents,
          quote: null,
          receipt: prior.receipt,
          replayed: true,
          replayOutputAvailable: false
        });
      }
      const error = new Error('Node AI request is already in progress. Retry after the active reservation completes or expires.');
      error.code = 'NODE_AI_REQUEST_IN_PROGRESS';
      throw error;
    }

    try {
      const result = await handler.execute({ request, userId: owner, requestId: requestKey, service, manifest: this.manifest, quote });
      const retailCostCents = nonNegativeCents(result?.retailCostCents, 'result.retailCostCents');
      if (durableReplay) {
        const walletBefore = this.ledger.getWallet(owner);
        if (!walletBefore) throw new RangeError(`No node AI wallet exists for ${owner}.`);
        const receipt = createUsageReceipt({
          nodeId: this.manifest.nodeId,
          walletId: walletBefore.walletId,
          serviceId: id,
          requestId: requestKey,
          retailCostCents,
          startedAt,
          completedAt: new Date().toISOString(),
          usage: result?.usage || {},
          backend: result?.backend || service.backend || {},
          outcome: result?.outcome || 'completed',
          metadata: { ...metadata, operatorReceipt: result?.operatorReceipt || null }
        });
        const durableReceipt = this.receiptPrivateKey ? signNodeReceipt(receipt, { privateKey: this.receiptPrivateKey, keyId: this.receiptKeyId }) : receipt;
        const settled = this.ledger.settleInference({
          userId: owner,
          reservationId,
          requestId: requestKey,
          serviceId: id,
          actualRetailCostCents: retailCostCents,
          receipt: durableReceipt,
          metadata: { serviceId: id, ...metadata }
        });
        return Object.freeze({
          output: settled.idempotent ? null : result?.output,
          wallet: settled.wallet,
          retailCostCents: settled.retailCostCents,
          quote: settled.idempotent ? null : structuredClone(quote),
          receipt: settled.receipt,
          replayed: settled.idempotent,
          replayOutputAvailable: !settled.idempotent
        });
      }

      const settled = this.ledger.settle({ userId: owner, reservationId, actualRetailCostCents: retailCostCents, requestId: requestKey, metadata: { serviceId: id, ...metadata } });
      const receipt = createUsageReceipt({
        nodeId: this.manifest.nodeId,
        walletId: settled.wallet.walletId,
        serviceId: id,
        requestId: requestKey,
        retailCostCents,
        startedAt,
        completedAt: new Date().toISOString(),
        usage: result?.usage || {},
        backend: result?.backend || service.backend || {},
        outcome: result?.outcome || 'completed',
        metadata: { ...metadata, operatorReceipt: result?.operatorReceipt || null }
      });
      return Object.freeze({
        output: result?.output,
        wallet: settled.wallet,
        retailCostCents,
        quote: structuredClone(quote),
        receipt: this.receiptPrivateKey ? signNodeReceipt(receipt, { privateKey: this.receiptPrivateKey, keyId: this.receiptKeyId }) : receipt,
        replayed: false,
        replayOutputAvailable: true
      });
    } catch (error) {
      if (ownsReservation) this.ledger.cancel({ userId: owner, reservationId });
      throw error;
    }
  }
}
