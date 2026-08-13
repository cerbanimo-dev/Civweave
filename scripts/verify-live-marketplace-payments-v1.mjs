import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const [fulfillment,cabinet,legacyShim,browserCommerce,symbols,moneyWithMemberships,entry,originEntry,serverCommerce,directCommerce] = await Promise.all([
  read('public/app/services/fellowfare/fulfillment-economy-v2.js'),
  read('public/app/services/fellowfare/cabinet.html'),
  read('public/app/services/fellowfare/app.js'),
  read('public/app/cerbanimo-commerce-distribution-v1.js'),
  read('public/app/services/fellowfare/marketplace-v2-symbols.js'),
  read('cloudflare/core/src/money-edge-with-memberships.mjs'),
  read('cloudflare/core/src/stripe-connect-v2-entry.mjs'),
  read('cloudflare/core/src/origin-entry.mjs'),
  read('cloudflare/core/src/commerce-edge.mjs'),
  read('cloudflare/core/src/fellowfare-direct-commerce-v1.mjs')
]);

for (const [name, source] of [
  ['fulfillment-economy-v2.js', fulfillment],
  ['marketplace-v2-symbols.js', symbols],
  ['cerbanimo-commerce-distribution-v1.js', browserCommerce]
]) assert.doesNotThrow(() => new Function(source), `${name} contains a JavaScript syntax error.`);

// Current cabinet boots v2 before the retained v1 compatibility layer. The old
// browser distribution API remains fail-closed so cached code cannot recreate the
// retired platform-charge/separate-transfer marketplace.
assert.match(cabinet, /fulfillment-economy-v2\.js/);
assert.match(cabinet, /fulfillment-economy-v1\.js/);
assert.ok(cabinet.indexOf('fulfillment-economy-v2.js') < cabinet.indexOf('fulfillment-economy-v1.js'));
assert.match(cabinet, /cerbanimo-commerce-distribution-v1\.js/);
assert.match(legacyShim, /fulfillment-economy-v2\.js/);
assert.doesNotMatch(legacyShim, /cerbanimo-commerce-distribution-v1\.js/);
assert.match(browserCommerce, /commerceEnabled:false/);
assert.match(browserCommerce, /marketplacePaymentMode:'disabled'/);
assert.match(browserCommerce, /buildDistribution:disabled/);
assert.match(browserCommerce, /stripeTransferInstructions:disabled/);
assert.match(browserCommerce, /recordSale:async\(\)=>disabled\(\)/);
assert.match(browserCommerce, /buildAnnualDistribution/);

// Physical-goods marketplace payment remains retired, including the old host-fee
// allocator. Service/learning direct commerce is routed on its own endpoint.
assert.match(entry, /handleFellowFareDirectCommerce/);
assert.match(entry, /\/api\/fellowfare\/direct-commerce\//);
assert.match(entry, /marketplacePaymentsDisabled/);
assert.match(entry, /marketplace-checkout-disabled/);
assert.match(entry, /\/api\/money-edge\/commerce\//);
assert.doesNotMatch(entry, /handleCommerceApiRequest/);
assert.match(originEntry, /commerce-host-fee-retired/);
assert.match(originEntry, /\/api\/commerce\/host-fee\/policy/);
assert.match(originEntry, /\/api\/commerce\/host-fee\/quote/);
assert.doesNotMatch(originEntry, /splitCommerceHostFee|COMMERCE_HOST_FEE_SCHEMA/);

// Direct cash commerce is provider-owned and limited to service/learning/tutoring.
assert.match(directCommerce, /\['service', 'learning', 'tutoring'\]/);
assert.match(directCommerce, /dashboard: 'full'/);
assert.match(directCommerce, /fees_collector: 'stripe'/);
assert.match(directCommerce, /losses_collector: 'stripe'/);
assert.match(directCommerce, /card_payments: \{ requested: true \}/);
assert.match(directCommerce, /application_fee_amount/);
assert.match(directCommerce, /stripeAccount: accountId/);
assert.match(directCommerce, /merchantOfRecord: 'connected-account'/);
assert.match(directCommerce, /platformCollectsGross: false/);
assert.match(directCommerce, /platformRoutesSellerProceeds: false/);
assert.match(directCommerce, /FELLOWFARE_DEFAULT_SERVICE_FEE_BPS = 100/);
assert.match(directCommerce, /CIVWEAVE_FELLOWFARE_SERVICE_FEE_BPS/);
assert.match(directCommerce, /integration_identifier: integrationIdentifier\(\)/);
assert.doesNotMatch(directCommerce, /payment_method_types/);
assert.doesNotMatch(directCommerce, /automatic_tax/);
assert.doesNotMatch(directCommerce, /\/v1\/transfers|transfer_data|destination:/);

assert.match(moneyWithMemberships, /goodsPaymentMode: 'seller-direct-outside-platform'/);
assert.match(moneyWithMemberships, /serviceLearningTokenMode: 'acorn-button-fulfillment-burn'/);
assert.match(moneyWithMemberships, /serviceLearningUsdMode: 'stripe-connect-direct-charge'/);
assert.match(moneyWithMemberships, /serviceLearningMerchantOfRecord: 'connected-provider'/);
assert.match(moneyWithMemberships, /serviceLearningPlatformFeeMode: 'application-fee'/);
assert.match(moneyWithMemberships, /platformCollectsGrossSellerPayment: false/);
assert.match(moneyWithMemberships, /platformRoutesSellerProceeds: false/);

// Legacy lifecycle code is still present only so previously-created payments can
// finish, refund, dispute, or reverse safely.
assert.match(serverCommerce, /settleCommerceCheckout/);
assert.match(serverCommerce, /handleCommerceRefund/);
assert.match(serverCommerce, /handleCommerceDispute/);
assert.match(serverCommerce, /restoreCommerceDisputeTransfers/);

// Fulfillment remains the token settlement contract beside optional USD checkout.
assert.match(fulfillment, /REWARD_PER_QUEST=5/);
assert.match(fulfillment, /MILESTONE_SIZE=100/);
assert.match(fulfillment, /MILESTONE_BONUS=10/);
for (const quest of ['finish-learning-module','fulfill-20-acorns','fulfill-20-buttons','post-need','post-offering']) assert.ok(fulfillment.includes(quest), `Missing quest ${quest}`);
assert.match(fulfillment, /nonTransferable:true/);
assert.match(fulfillment, /recipientCredited:false/);
assert.match(fulfillment, /operation:'fulfillment-burn'/);
assert.match(fulfillment, /GOODS_KINDS=new Set\(\['product','resource'\]\)/);
assert.match(fulfillment, /TOKEN_KINDS=new Set\(\['service','learning','tutoring'\]\)/);
assert.match(fulfillment, /listing\.pricing=\{\.\.\.pricing,usdMinor:0,buttons:0,acorns:0\}/);
assert.match(fulfillment, /cashMode:cash\?'stripe-connect-direct-charge':'none'/);
assert.match(fulfillment, /Offer USD, Acorn\/Button fulfillment, or both/);

assert.match(symbols, /does not collect or route a goods payment/);
assert.match(symbols, /provider Stripe direct checkout/);
assert.match(symbols, /FellowFare receives only its application fee/);
assert.match(symbols, /Acorns\/Buttons are fulfilled and burned/);

console.log(JSON.stringify({
  ok: true,
  revision: 'fellowfare-fulfillment-direct-commerce-v2',
  checks: [
    'goods-seller-direct',
    'legacy-platform-marketplace-checkout-retired',
    'commerce-host-fee-retired',
    'service-learning-provider-direct-charge',
    'connected-provider-merchant-of-record',
    'fellowfare-application-fee-only',
    'no-platform-gross-collection',
    'no-seller-proceeds-routing',
    'services-learning-fulfillment-burn',
    'no-recipient-token-transfer',
    'three-daily-quest-buckets',
    'fixed-daily-reward',
    'hundred-unit-milestone-bonus',
    'legacy-payment-unwind-preserved',
    'annual-reserve-payout-preserved'
  ]
}, null, 2));
