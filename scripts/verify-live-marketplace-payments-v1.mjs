import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const provider = await readFile(new URL('../cloudflare/core/src/stripe-connect.mjs', import.meta.url), 'utf8');
const money = await readFile(new URL('../cloudflare/core/src/money-edge.mjs', import.meta.url), 'utf8');
const moneyWithMemberships = await readFile(new URL('../cloudflare/core/src/money-edge-with-memberships.mjs', import.meta.url), 'utf8');
const browserCommerce = await readFile(new URL('../public/app/cerbanimo-commerce-distribution-v1.js', import.meta.url), 'utf8');
const serverCommerce = await readFile(new URL('../cloudflare/core/src/commerce-edge.mjs', import.meta.url), 'utf8');
const commerceMigration = await readFile(new URL('../cloudflare/core/migrations/0005_cerbanimo_commerce.sql', import.meta.url), 'utf8');
const entry = await readFile(new URL('../cloudflare/core/src/stripe-connect-v2-entry.mjs', import.meta.url), 'utf8');
const preflight = await readFile(new URL('./verify-stripe-live-readiness-preflight.mjs', import.meta.url), 'utf8');
const humanGate = await readFile(new URL('../docs/finance/live-money-human-gate.md', import.meta.url), 'utf8');
const launch = await readFile(new URL('../docs/finance/node-money-edge-launch-v1.md', import.meta.url), 'utf8');

assert.match(provider, /STRIPE_CONNECT_ACCOUNT_MODEL = 'accounts-v2-marketplace-recipient'/);
assert.match(provider, /v2\.core\.accounts\.create/);
assert.match(provider, /dashboard: 'express'/);
assert.match(provider, /fees_collector: 'application'/);
assert.match(provider, /losses_collector: 'application'/);
assert.match(provider, /recipient:\s*\{/);
assert.match(provider, /stripe_transfers: \{ requested: true \}/);
assert.match(provider, /v2\.core\.accountLinks\.create/);
assert.match(provider, /configurations: \['recipient'\]/);
assert.match(provider, /platform-charge-separate-transfer/);
assert.match(provider, /source_transaction/);
assert.match(provider, /Compatibility only for sandbox\/legacy node registrations/);

assert.match(money, /TOPUP_ECONOMY = Object\.freeze\(\{ systemBps: 7000, hostBps: 2500, cerbanimoBps: 500 \}\)/);
assert.match(money, /fundsModel: 'platform-reserve-separate-transfer'/);
assert.match(money, /CIVWEAVE_MONEY_LIVE_ENABLED/);
assert.match(money, /CIVWEAVE_MONEY_COMPLIANCE_APPROVED/);
assert.match(money, /CIVWEAVE_MONEY_JURISDICTION_APPROVED/);
assert.match(money, /CIVWEAVE_MONEY_KYC_AML_READY/);
assert.match(money, /CIVWEAVE_MONEY_TAX_REPORTING_READY/);
assert.match(money, /CIVWEAVE_MONEY_TERMS_APPROVED/);

assert.match(browserCommerce, /DEFAULT_COMMERCE_SPLIT_FEE_BPS=100/);
assert.match(browserCommerce, /buyerChargeMinor=amountMinor\+splitFeeMinor/);
assert.match(browserCommerce, /reducesContributorPayout:false/);
assert.match(browserCommerce, /routesToAnnualPool:false/);
assert.match(browserCommerce, /weightSource:'vested-cerbanimo-co-credits'/);

for (const needle of [
  "CERBANIMO_COMMERCE_FEE_BPS = 100",
  "CERBANIMO_SERVICE_ORIGIN_ROYALTY_BPS = 1000",
  "saleType === 'service'",
  "buyerChargeCents = listedCents + splitFeeCents",
  "fees_collector: 'application'",
  "losses_collector: 'application'",
  "stripe_transfers: { requested: true }",
  "dashboard: 'express'",
  "readyToReceiveTransfers",
  "edge.verifyNodeRequest",
  "'/v1/checkout/sessions'",
  "'payment_intent_data[transfer_group]'",
  "Cerbanimo commerce split fee (1%)",
  "createHostTransfer",
  "sourceTransaction: charge.id",
  "reverseHostTransfer",
  "refundTopUp",
  "civweave_annual_pool: 'excluded'"
]) assert.ok(serverCommerce.includes(needle), `missing server commerce contract: ${needle}`);
assert.doesNotMatch(serverCommerce, /application_fee_amount/);
assert.match(serverCommerce, /money_edge_commerce_recipients/);
assert.match(serverCommerce, /money_edge_commerce_sales/);
assert.match(serverCommerce, /money_edge_commerce_payouts/);
assert.match(commerceMigration, /CREATE TABLE IF NOT EXISTS money_edge_commerce_recipients/);
assert.match(commerceMigration, /CREATE TABLE IF NOT EXISTS money_edge_commerce_sales/);
assert.match(commerceMigration, /CREATE TABLE IF NOT EXISTS money_edge_commerce_payouts/);
assert.match(entry, /\/api\/money-edge\/commerce\//);
assert.match(entry, /handleCommerceApiRequest/);
assert.match(moneyWithMemberships, /settleCommerceCheckout/);
assert.match(moneyWithMemberships, /handleCommerceRefund/);
assert.match(moneyWithMemberships, /handleCommerceDispute/);
assert.match(moneyWithMemberships, /restoreCommerceDisputeTransfers/);
assert.match(moneyWithMemberships, /charge\.dispute\.funds_reinstated/);

const commerceModule = await import(new URL('../cloudflare/core/src/commerce-edge.mjs', import.meta.url));
const service = commerceModule.buildCommerceDistribution({
  saleType: 'service',
  listedCents: 10_000,
  deliveryContributors: [
    { userId: 'worker-a', weight: 3 },
    { userId: 'worker-b', weight: 1 }
  ],
  originContributors: [{ userId: 'origin-a', weight: 1 }]
});
assert.equal(service.saleType, 'service');
assert.equal(service.splitFeeBps, 100);
assert.equal(service.splitFeeCents, 100);
assert.equal(service.buyerChargeCents, 10_100);
assert.equal(service.payouts.reduce((sum, row) => sum + row.amountCents, 0), 10_000);
assert.deepEqual(service.payouts.map(row => [row.userId, row.amountCents]), [
  ['origin-a', 1000],
  ['worker-a', 6750],
  ['worker-b', 2250]
]);
const product = commerceModule.buildCommerceDistribution({
  saleType: 'product',
  listedCents: 10_000,
  productContributors: [
    { userId: 'maker-a', weight: 2 },
    { userId: 'maker-b', weight: 1 }
  ],
  commerceSplitFeeBps: 9999
});
assert.equal(product.saleType, 'product');
assert.equal(product.splitFeeBps, 100, 'client input cannot alter the 1% commerce fee');
assert.equal(product.buyerChargeCents, 10_100);
assert.equal(product.payouts.reduce((sum, row) => sum + row.amountCents, 0), 10_000);
assert.deepEqual(product.payouts.map(row => [row.userId, row.amountCents]), [
  ['maker-a', 6667],
  ['maker-b', 3333]
]);

assert.match(preflight, /accounts-v2-marketplace-recipient/);
assert.match(preflight, /EXPECTED_COMMERCE_SPLIT_FEE_BPS = 100/);
assert.match(preflight, /mutationPerformed: false/);
assert.doesNotMatch(preflight, /\.create\(/, 'live preflight must remain read-only');
assert.doesNotMatch(preflight, /\.update\(/, 'live preflight must remain read-only');
assert.doesNotMatch(preflight, /\.del\(/, 'live preflight must remain read-only');

for (const gate of [
  'CIVWEAVE_MONEY_LIVE_ENABLED',
  'CIVWEAVE_MONEY_COMPLIANCE_APPROVED',
  'CIVWEAVE_MONEY_JURISDICTION_APPROVED',
  'CIVWEAVE_MONEY_KYC_AML_READY',
  'CIVWEAVE_MONEY_TAX_REPORTING_READY',
  'CIVWEAVE_MONEY_TERMS_APPROVED'
]) {
  assert.match(humanGate, new RegExp(`${gate}=false`), `${gate} must remain explicitly false before human launch approval`);
}
assert.match(humanGate, /stripe_transfers\.status = active/);
assert.match(humanGate, /listed commerce amount plus the 1% Cerbanimo split fee/);
assert.match(launch, /marketplace/);
assert.match(launch, /separate charges and transfers/);
assert.match(launch, /1% Cerbanimo split fee is added on top/);
assert.doesNotMatch(launch, /15% application fee/);
assert.doesNotMatch(humanGate, /15% application fee/);

console.log(JSON.stringify({
  ok: true,
  checks: [
    'accounts-v2-marketplace-recipient',
    'express-dashboard',
    'platform-pricing-and-loss-liability',
    'recipient-transfer-capability',
    'separate-charges-and-transfers',
    'commerce-one-percent-fee-on-top',
    'server-side-commerce-distribution',
    'signed-node-commerce-requests',
    'recipient-user-to-account-mapping',
    'paid-checkout-contributor-transfers',
    'refund-transfer-reversals',
    'dispute-transfer-reversal-and-restoration',
    'human-gates-fail-closed',
    'live-preflight-read-only',
    'stale-direct-charge-fee-language-removed'
  ]
}, null, 2));
