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

  async execute({ userId, serviceId, request, requestId = `node-ai:${crypto.randomUUID()}`, metadata = {} } = {}) {
    const owner = clean(userId, 'userId', 180);
    const { id, service, handler } = this.service(serviceId);
    const startedAt = new Date().toISOString();
    const quote = await handler.quote({ request, userId: owner, requestId, service, manifest: this.manifest });
    const maxRetailCostCents = positiveCents(quote?.maxRetailCostCents, 'quote.maxRetailCostCents');
    if (service.billing?.maxRequestCents != null && maxRetailCostCents > service.billing.maxRequestCents) {
      throw new RangeError(`Quoted retail cost exceeds the advertised ${id} service limit.`);
    }
    const reservationId = `retail:${requestId}`;
    this.ledger.reserve({ userId: owner, reservationId, serviceId: id, maxRetailCostCents, metadata: { requestId, ...metadata }, ttlSeconds: quote?.ttlSeconds || 900 });

    try {
      const result = await handler.execute({ request, userId: owner, requestId, service, manifest: this.manifest, quote });
      const retailCostCents = nonNegativeCents(result?.retailCostCents, 'result.retailCostCents');
      const settled = this.ledger.settle({ userId: owner, reservationId, actualRetailCostCents: retailCostCents, requestId, metadata: { serviceId: id, ...metadata } });
      const receipt = createUsageReceipt({
        nodeId: this.manifest.nodeId,
        walletId: settled.wallet.walletId,
        serviceId: id,
        requestId,
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
        receipt: this.receiptPrivateKey ? signNodeReceipt(receipt, { privateKey: this.receiptPrivateKey, keyId: this.receiptKeyId }) : receipt
      });
    } catch (error) {
      this.ledger.cancel({ userId: owner, reservationId });
      throw error;
    }
  }
}
