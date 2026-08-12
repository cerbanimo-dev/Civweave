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

const service = api.buildDistribution({
  saleId: 'service-sale-1', saleType: 'service', netAmountMinor: 10000,
  deliveryContributors: [{ contributorId: 'worker-a', cotokens: 3 }, { contributorId: 'worker-b', cotokens: 1 }],
  originContributors: [{ contributorId: 'origin-a', cotokens: 1 }, { contributorId: 'origin-b', cotokens: 1 }],
  rewardBudget: { acorns: 4, buttons: 8 }
});
assert.equal(service.settlementTiming, 'immediate');
assert.equal(service.routesToAnnualPool, false);
assert.equal(service.annualPoolContributionMinor, 0);
assert.equal(service.cotokensConsumed, false);
assert.equal(service.payouts.reduce((sum, row) => sum + row.amountMinor, 0), 10000);
assert.equal(JSON.stringify(service.payouts.map(row => [row.contributorId, row.amountMinor])), JSON.stringify([
  ['origin-a', 500], ['origin-b', 500], ['worker-a', 6750], ['worker-b', 2250]
].sort((a,b)=>a[0].localeCompare(b[0]))));
assert.equal(service.rewards.acorns.reduce((sum, row) => sum + row.amount, 0), 4);
assert.equal(service.rewards.buttons.reduce((sum, row) => sum + row.amount, 0), 8);

const product = api.buildDistribution({
  saleId: 'product-sale-1', saleType: 'product', netAmountMinor: 10100,
  productContributors: [{ contributorId: 'maker-a', coCredits: 2 }, { contributorId: 'maker-b', coCredits: 1 }]
});
assert.equal(JSON.stringify(product.payouts.map(row => [row.contributorId, row.amountMinor])), JSON.stringify([['maker-a', 6733], ['maker-b', 3367]]));
assert.equal(product.annualPoolEligible, false);

const transferInstructions = api.stripeTransferInstructions({
  ...product,
  payouts: product.payouts.map((row, index) => ({ ...row, stripeAccountId: `acct_${index}` }))
}, { sourceTransaction: 'ch_source' });
assert.equal(transferInstructions.length, 2);
assert.ok(transferInstructions.every(row => row.metadata.civweave_annual_pool === 'excluded'));

console.log(JSON.stringify({
  ok: true,
  policy: { serviceOriginRoyaltyBps: api.DEFAULT_SERVICE_ORIGIN_ROYALTY_BPS },
  checks: ['immediate-service-split','origin-stipend','product-contribution-split','acorn-button-weighting','annual-pool-exclusion','exact-rounding','stripe-transfer-intents']
}, null, 2));
