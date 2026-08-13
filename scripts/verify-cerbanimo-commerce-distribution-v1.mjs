import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = await readFile(new URL('../public/app/cerbanimo-commerce-distribution-v1.js', import.meta.url), 'utf8');
const storage = new Map();
class CustomEvent { constructor(type, { detail } = {}) { this.type = type; this.detail = detail; } }
const context = {
  console, Date, Math, JSON, structuredClone, CustomEvent,
  dispatchEvent: () => {},
  localStorage: {
    getItem: key => storage.get(String(key)) || null,
    setItem: (key, value) => storage.set(String(key), String(value))
  }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'cerbanimo-commerce-distribution-v1.js' });
const api = context.CivweaveCerbanimoCommerceV1;
assert.ok(api, 'commerce compatibility API should load');
assert.equal(api.commerceEnabled, false, 'marketplace commerce must be disabled');
assert.equal(api.marketplacePaymentMode, 'disabled');
assert.equal(api.goodsPaymentMode, 'seller-direct');
assert.equal(api.serviceLearningMode, 'acorn-button-fulfillment-burn');
assert.throws(() => api.buildDistribution({ saleType: 'product', saleAmountMinor: 1000 }), /marketplace payment processing is disabled/i);
assert.throws(() => api.stripeTransferInstructions({}), /marketplace payment processing is disabled/i);
await assert.rejects(() => api.recordSale({ saleType: 'service', saleAmountMinor: 1000 }), /marketplace payment processing is disabled/i);

// The annual compute-reserve distribution is a separate platform-reserve rail and
// must remain available. Retiring marketplace checkout must not accidentally erase it.
assert.equal(api.DEFAULT_ANNUAL_HOST_BPS, 1000);
assert.equal(api.DEFAULT_ANNUAL_CERBANIMO_BPS, 500);
const annual = api.buildAnnualDistribution({
  annualId: 'annual-node-2026', nodeId: 'node-1', eligibleReserveMinor: 100000,
  contributors: [
    { contributorId: 'contributor-a', cotokens: 3, stripeAccountId: 'acct_a' },
    { contributorId: 'contributor-b', cotokens: 1, stripeAccountId: 'acct_b' }
  ],
  host: { contributorId: 'host-1', stripeAccountId: 'acct_host' },
  cerbanimo: { contributorId: 'cerbanimo', stripeAccountId: 'acct_cerbanimo' },
  eventDate: '2026-12-01'
});
assert.equal(annual.reserveShareBps, 5000, 'half the eligible reserve should enter the annual payout');
assert.equal(annual.annualPayoutMinor, 50000);
assert.equal(annual.retainedReserveMinor, 50000);
assert.equal(annual.policy.basis, 'annual-payout');
assert.equal(annual.policy.contributorBps, 8500);
assert.equal(annual.policy.hostBps, 1000);
assert.equal(annual.policy.cerbanimoBps, 500);
assert.equal(annual.cotokensConsumed, false);
assert.equal(annual.payouts.reduce((sum, row) => sum + row.amountMinor, 0), 50000);
const annualById = Object.fromEntries(annual.payouts.map(row => [row.contributorId, row.amountMinor]));
assert.equal(annualById['contributor-a'], 31875);
assert.equal(annualById['contributor-b'], 10625);
assert.equal(annualById['host-1'], 5000);
assert.equal(annualById.cerbanimo, 2500);
const annualTransfers = api.annualStripeTransferInstructions(annual);
assert.equal(annualTransfers.length, 4);
assert.ok(annualTransfers.every(row => row.fundingMode === 'platform-reserve'));

console.log(JSON.stringify({
  ok: true,
  marketplaceCommerce: 'disabled',
  goodsPayment: 'seller-direct',
  serviceLearning: 'fulfillment-burn',
  annualReserveDistribution: 'preserved',
  checks: [
    'marketplace-distribution-fails-closed',
    'marketplace-transfer-instructions-fail-closed',
    'marketplace-record-sale-fails-closed',
    'annual-50-percent-reserve',
    'annual-85-10-5-split',
    'annual-platform-reserve-transfer-intents'
  ]
}, null, 2));
