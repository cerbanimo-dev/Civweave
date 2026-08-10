import { createHash } from 'node:crypto';

export const PROVIDER_GATEWAY_PROTOCOL = 'civweave.provider-gateway.v1';

function clone(value) { return value == null ? value : structuredClone(value); }
function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, normalized(value[key])]));
  return value;
}
export function canonicalJson(value) { return JSON.stringify(normalized(value)); }
export function hashObject(value) { return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`; }

function clean(value, label, max = 180) {
  const text = String(value || '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text.slice(0, max);
}
function positive(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new TypeError(`${label} must be positive`);
  return number;
}

export function normalizeProviderIntent(input = {}) {
  const asset = String(input.asset || '').toUpperCase();
  if (!['BUTTON', 'ACORN'].includes(asset)) throw new TypeError('provider gateway can transfer only BUTTON or ACORN');
  const currency = clean(input.externalCurrency, 'externalCurrency', 16).toUpperCase();
  return Object.freeze({
    protocol: PROVIDER_GATEWAY_PROTOCOL,
    intentId: clean(input.intentId, 'intentId'),
    sellerId: clean(input.sellerId, 'sellerId'),
    buyerId: clean(input.buyerId, 'buyerId'),
    transferId: clean(input.transferId, 'transferId'),
    asset,
    amount: positive(input.amount, 'amount'),
    providerId: clean(input.providerId, 'providerId', 80),
    providerReference: clean(input.providerReference, 'providerReference', 180),
    externalCurrency: currency,
    externalAmount: positive(input.externalAmount, 'externalAmount'),
    amountPolicy: input.amountPolicy === 'exact' ? 'exact' : 'at-least',
    expiresAt: clean(input.expiresAt, 'expiresAt', 64),
  });
}

export function providerProofKey({ providerId, receiptId }) {
  return `provider:${clean(providerId, 'providerId', 80).toLowerCase()}:${clean(receiptId, 'receiptId', 180)}`;
}

export async function validateProviderReceipt(intentInput, receiptInput, { verifyAuthenticity } = {}) {
  const intent = normalizeProviderIntent(intentInput);
  const receipt = clone(receiptInput || {});
  const errors = [];
  const receiptId = String(receipt.receiptId || '').trim();
  const providerId = String(receipt.providerId || '').trim();
  const reference = String(receipt.providerReference || '').trim();
  const currency = String(receipt.currency || '').trim().toUpperCase();
  const amount = Number(receipt.amount);
  const settled = ['settled', 'paid', 'succeeded', 'completed'].includes(String(receipt.status || '').toLowerCase());
  if (!receiptId) errors.push('provider receipt id missing');
  if (providerId !== intent.providerId) errors.push('wrong provider');
  if (reference !== intent.providerReference) errors.push('provider reference does not match gateway intent');
  if (currency !== intent.externalCurrency) errors.push('wrong provider currency');
  if (!Number.isFinite(amount) || amount <= 0) errors.push('invalid provider amount');
  else if (intent.amountPolicy === 'exact' ? amount !== intent.externalAmount : amount < intent.externalAmount) errors.push('insufficient or mismatched provider amount');
  if (!settled) errors.push('provider payment is not settled');
  if (typeof verifyAuthenticity !== 'function') errors.push('provider authenticity verifier is required');
  else {
    try {
      const authentic = await verifyAuthenticity(clone(receipt));
      if (!authentic) errors.push('provider authenticity rejected');
    } catch {
      errors.push('provider authenticity verification failed');
    }
  }
  const ok = errors.length === 0;
  return Object.freeze({
    ok,
    errors,
    proofKey: ok ? providerProofKey({ providerId, receiptId }) : null,
    normalized: ok ? Object.freeze({
      providerId,
      receiptId,
      providerReference: reference,
      currency,
      amount,
      status: 'settled',
      settledAt: String(receipt.settledAt || ''),
      authenticityHash: hashObject(receipt.authenticityEvidence || receipt.signatureMetadata || { receiptId, providerId }),
    }) : null,
  });
}

export class ProviderReceiptRegistry {
  constructor() {
    this.byProof = new Map();
    this.byIntent = new Map();
  }
  certify(intentHash, validation) {
    if (!validation?.ok || !validation.proofKey) throw new Error('only verified provider receipts may be certified');
    const target = clean(intentHash, 'intentHash', 220);
    const existingOwner = this.byProof.get(validation.proofKey);
    if (existingOwner && existingOwner !== target) throw new Error('provider receipt proof is already consumed by another gateway intent');
    const existing = this.byIntent.get(target);
    if (existing && existing.proofKey !== validation.proofKey) throw new Error('gateway intent already has a different provider receipt');
    const record = Object.freeze({
      protocol: PROVIDER_GATEWAY_PROTOCOL,
      intentHash: target,
      proofKey: validation.proofKey,
      proof: clone(validation.normalized),
      supplyEffect: 0,
      mintEffect: 0,
    });
    this.byProof.set(record.proofKey, target);
    this.byIntent.set(target, record);
    return clone(record);
  }
}
