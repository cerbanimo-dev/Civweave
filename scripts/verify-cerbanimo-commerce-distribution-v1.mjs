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
assert.ok(api, 'commerce distribution API should load');
assert.equal(api.DEFAULT_COMMERCE_SPLIT_FEE_BPS, 100);
assert.equal(api.DEFAULT_ANNUAL_HOST_BPS, 1000);
assert.equal(api.DEFAULT_ANNUAL_CERBANIMO_BPS, 500);

const service = api.buildDistribution({
  saleId: 'service-sale-1', saleType: 'service', saleAmountMinor: 10000,
  deliveryContributors: [{ contributorId: 'worker-a', cotokens: 3 }, { contributorId: 'worker-b', cotokens: 1 }],
  originContributors: [{ contributorId: 'origin-a', cotokens: 1 }, { contributorId: 'origin-b', cotokens: 1 }],
  rewardBudget: { acorns: 4, buttons: 8 }
});
assert.equal(service.settlementTiming, 'immediate');
assert.equal(service.routesToAnnualPool, false);
assert.equal(service.annualPoolContributionMinor, 0);
assert.equal(service.cotokensConsumed, false);
assert.equal(service.saleAmountMinor, 10000);
assert.equal(service.commerceSplitFee.bps, 100);
assert.equal(service.commerceSplitFee.amountMinor, 100);
assert.equal(service.commerceSplitFee.onTop, true);
assert.equal(service.commerceSplitFee.reducesContributorPayout, false);
assert.equal(service.buyerChargeMinor, 10100);
assert.equal(service.payouts.reduce((sum, row) => sum + row.amountMinor, 0), 10000);
assert.equal(JSON.stringify(service.payouts.map(row => [row.contributorId, row.amountMinor])), JSON.stringify([
  ['origin-a', 500], ['origin-b', 500], ['worker-a', 6750], ['worker-b', 2250]
].sort((a,b)=>a[0].localeCompare(b[0]))));
assert.equal(service.rewards.acorns.reduce((sum, row) => sum + row.amount, 0), 4);
assert.equal(service.rewards.buttons.reduce((sum, row) => sum + row.amount, 0), 8);

const product = api.buildDistribution({
  saleId: 'product-sale-1', saleType: 'product', saleAmountMinor: 10100,
  productContributors: [{ contributorId: 'maker-a', coCredits: 2 }, { contributorId: 'maker-b', coCredits: 1 }]
});
assert.equal(JSON.stringify(product.payouts.map(row => [row.contributorId, row.amountMinor])), JSON.stringify([['maker-a', 6733], ['maker-b', 3367]]));
assert.equal(product.annualPoolEligible, false);
assert.equal(product.commerceSplitFee.amountMinor, 101);
assert.equal(product.buyerChargeMinor, 10201);

const transferInstructions = api.stripeTransferInstructions({
  ...product,
  payouts: product.payouts.map((row, index) => ({ ...row, stripeAccountId: `acct_${index}` }))
}, { sourceTransaction: 'ch_source' });
assert.equal(transferInstructions.length, 2);
assert.ok(transferInstructions.every(row => row.metadata.civweave_annual_pool === 'excluded'));
assert.ok(transferInstructions.every(row => row.metadata.civweave_split_fee_bps === '100'));

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
  policy: {
    serviceOriginRoyaltyBps: api.DEFAULT_SERVICE_ORIGIN_ROYALTY_BPS,
    commerceSplitFeeBps: api.DEFAULT_COMMERCE_SPLIT_FEE_BPS,
    annualReserveShareBps: api.DEFAULT_ANNUAL_RESERVE_SHARE_BPS,
    annualParticipantBps: 8500,
    annualHostBps: api.DEFAULT_ANNUAL_HOST_BPS,
    annualCerbanimoBps: api.DEFAULT_ANNUAL_CERBANIMO_BPS
  },
  checks: ['immediate-service-split','origin-stipend','product-contribution-split','acorn-button-weighting','one-percent-fee-on-top','annual-pool-exclusion','annual-50-percent-reserve','annual-85-10-5-split','exact-rounding','stripe-transfer-intents']
}, null, 2));
