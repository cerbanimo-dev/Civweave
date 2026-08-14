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

// The annual compute-reserve distribution remains a separate platform-reserve rail.
// The former 5% Cerbanimo annual bucket is now subdivided 50/50 between Cerbanimo
// Global and the applicable Territory Stewardship office. No contributor or host
// percentage changes.
assert.equal(api.DEFAULT_ANNUAL_HOST_BPS, 1000);
assert.equal(api.DEFAULT_ANNUAL_CERBANIMO_BPS, 500);
assert.equal(api.CERBANIMO_GLOBAL_SHARE_BPS_OF_CERBANIMO, 5000);
assert.equal(api.TERRITORY_SHARE_BPS_OF_CERBANIMO, 5000);

const annual = api.buildAnnualDistribution({
  annualId: 'annual-node-2026', nodeId: 'node-1', eligibleReserveMinor: 100000,
  territoryId: 'us-mo-kc',
  contributors: [
    { contributorId: 'contributor-a', cotokens: 3, stripeAccountId: 'acct_a' },
    { contributorId: 'contributor-b', cotokens: 1, stripeAccountId: 'acct_b' }
  ],
  host: { contributorId: 'host-1', stripeAccountId: 'acct_host' },
  cerbanimo: { contributorId: 'cerbanimo-global', stripeAccountId: 'acct_cerbanimo' },
  eventDate: '2026-12-01'
});
assert.equal(annual.reserveShareBps, 5000, 'half the eligible reserve should enter the annual payout');
assert.equal(annual.annualPayoutMinor, 50000);
assert.equal(annual.retainedReserveMinor, 50000);
assert.equal(annual.policy.basis, 'annual-payout');
assert.equal(annual.policy.contributorBps, 8500);
assert.equal(annual.policy.hostBps, 1000);
assert.equal(annual.policy.existingCerbanimoBps, 500);
assert.equal(annual.policy.cerbanimoGlobalBps, 250);
assert.equal(annual.policy.territoryStewardshipBps, 250);
assert.equal(annual.policy.hostShareChanged, false);
assert.equal(annual.cotokensConsumed, false);
assert.equal(annual.payouts.reduce((sum, row) => sum + row.amountMinor, 0), 50000);
const annualById = Object.fromEntries(annual.payouts.map(row => [row.contributorId, row.amountMinor]));
assert.equal(annualById['contributor-a'], 31875);
assert.equal(annualById['contributor-b'], 10625);
assert.equal(annualById['host-1'], 5000);
assert.equal(annualById['cerbanimo-global'], 1250);
assert.equal(annualById['territory-reserve:us-mo-kc'], 1250);
assert.equal(annual.heldTerritoryPayoutMinor, 1250);
const annualTransfers = api.annualStripeTransferInstructions(annual);
assert.equal(annualTransfers.length, 4, 'held territory reserve should not create a personal Stripe transfer');
assert.ok(annualTransfers.every(row => row.fundingMode === 'platform-reserve'));
assert.ok(!annualTransfers.some(row => row.recipientId === 'territory-reserve:us-mo-kc'));

const annualWithSteward = api.buildAnnualDistribution({
  annualId: 'annual-node-2026-ready', nodeId: 'node-1', eligibleReserveMinor: 100000,
  territoryId: 'us-mo-kc',
  contributors: [
    { contributorId: 'contributor-a', cotokens: 3, stripeAccountId: 'acct_a' },
    { contributorId: 'contributor-b', cotokens: 1, stripeAccountId: 'acct_b' }
  ],
  host: { contributorId: 'host-1', stripeAccountId: 'acct_host' },
  cerbanimo: { contributorId: 'cerbanimo-global', stripeAccountId: 'acct_cerbanimo' },
  territorySteward: { contributorId: 'steward-us-mo-kc-anthony-20260814', publicName: 'Anthony Stematz-Breitling', stripeAccountId: 'acct_territory' },
  eventDate: '2026-12-01'
});
assert.equal(annualWithSteward.heldTerritoryPayoutMinor, 0);
const readyById = Object.fromEntries(annualWithSteward.payouts.map(row => [row.contributorId, row.amountMinor]));
assert.equal(readyById['steward-us-mo-kc-anthony-20260814'], 1250);
assert.equal(api.annualStripeTransferInstructions(annualWithSteward).length, 5);

console.log(JSON.stringify({
  ok: true,
  marketplaceCommerce: 'disabled',
  goodsPayment: 'seller-direct',
  serviceLearning: 'fulfillment-burn',
  annualReserveDistribution: 'preserved-with-territory-second-stage',
  checks: [
    'marketplace-distribution-fails-closed',
    'marketplace-transfer-instructions-fail-closed',
    'marketplace-record-sale-fails-closed',
    'annual-50-percent-reserve',
    'annual-85-10-2.5-2.5-split',
    'host-share-preserved',
    'vacant-territory-held',
    'ready-territory-transfer-intent'
  ]
}, null, 2));
