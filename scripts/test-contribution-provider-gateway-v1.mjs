import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ProviderReceiptRegistry,
  normalizeProviderIntent,
  providerProofKey,
  validateProviderReceipt,
} from '../lib/contribution-provider-gateway-v1.mjs';

const intent = normalizeProviderIntent({
  intentId: 'gw:provider:1', sellerId: 'wallet:seller', buyerId: 'wallet:buyer', transferId: 'transfer:1',
  asset: 'BUTTON', amount: 8, providerId: 'licensed-provider', providerReference: 'order-42',
  externalCurrency: 'USD', externalAmount: 12.5, amountPolicy: 'exact', expiresAt: '2026-08-11T00:00:00.000Z',
});
const receipt = {
  providerId: 'licensed-provider', receiptId: 'receipt-abc', providerReference: 'order-42',
  currency: 'USD', amount: 12.5, status: 'settled', settledAt: '2026-08-10T03:00:00.000Z',
  authenticityEvidence: { webhookId: 'wh_1', signatureVersion: 'v1' },
};

test('provider receipt validates only through a server-supplied authenticity verifier', async () => {
  const missing = await validateProviderReceipt(intent, receipt);
  assert.equal(missing.ok, false);
  assert.match(missing.errors.join(' '), /authenticity verifier/);
  const valid = await validateProviderReceipt(intent, receipt, { verifyAuthenticity: async () => true });
  assert.equal(valid.ok, true);
  assert.equal(valid.proofKey, providerProofKey({ providerId: receipt.providerId, receiptId: receipt.receiptId }));
});

test('provider receipt is bound to provider, reference, currency, amount, and settled status', async () => {
  for (const patch of [
    { providerId: 'other' }, { providerReference: 'other-order' }, { currency: 'EUR' },
    { amount: 12.49 }, { status: 'pending' },
  ]) {
    const result = await validateProviderReceipt(intent, { ...receipt, ...patch }, { verifyAuthenticity: async () => true });
    assert.equal(result.ok, false, JSON.stringify(patch));
  }
});

test('authenticity rejection fails closed', async () => {
  const result = await validateProviderReceipt(intent, receipt, { verifyAuthenticity: async () => false });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /authenticity rejected/);
});

test('one provider receipt cannot settle two gateway intents', async () => {
  const valid = await validateProviderReceipt(intent, receipt, { verifyAuthenticity: async () => true });
  const registry = new ProviderReceiptRegistry();
  const first = registry.certify('sha256:intent-one', valid);
  assert.equal(first.supplyEffect, 0);
  assert.equal(first.mintEffect, 0);
  assert.throws(() => registry.certify('sha256:intent-two', valid), /already consumed/);
});
