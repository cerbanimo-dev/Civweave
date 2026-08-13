import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const [fulfillment,cabinet,legacyShim,browserCommerce,symbols,moneyWithMemberships,entry,originEntry,serverCommerce] = await Promise.all([
  read('public/app/services/fellowfare/fulfillment-economy-v1.js'),
  read('public/app/services/fellowfare/cabinet.html'),
  read('public/app/services/fellowfare/app.js'),
  read('public/app/cerbanimo-commerce-distribution-v1.js'),
  read('public/app/services/fellowfare/marketplace-v2-symbols.js'),
  read('cloudflare/core/src/money-edge-with-memberships.mjs'),
  read('cloudflare/core/src/stripe-connect-v2-entry.mjs'),
  read('cloudflare/core/src/origin-entry.mjs'),
  read('cloudflare/core/src/commerce-edge.mjs')
]);

for (const [name, source] of [
  ['fulfillment-economy-v1.js', fulfillment],
  ['marketplace-v2-symbols.js', symbols],
  ['cerbanimo-commerce-distribution-v1.js', browserCommerce]
]) assert.doesNotThrow(() => new Function(source), `${name} contains a JavaScript syntax error.`);

// The compatibility script is deliberately still carried for cached callers, but its
// marketplace methods must fail closed. The fulfillment runtime owns current semantics.
assert.match(cabinet, /fulfillment-economy-v1\.js/);
assert.match(cabinet, /cerbanimo-commerce-distribution-v1\.js/);
assert.match(legacyShim, /fulfillment-economy-v1\.js/);
assert.doesNotMatch(legacyShim, /cerbanimo-commerce-distribution-v1\.js/);

assert.match(entry, /marketplacePaymentsDisabled/);
assert.match(entry, /marketplace-checkout-disabled/);
assert.match(entry, /status:\s*410/);
assert.doesNotMatch(entry, /handleCommerceApiRequest/);
assert.match(originEntry, /commerce-host-fee-retired/);
assert.match(originEntry, /\/api\/commerce\/host-fee\/policy/);
assert.match(originEntry, /\/api\/commerce\/host-fee\/quote/);
assert.match(originEntry, /410/);
assert.doesNotMatch(originEntry, /splitCommerceHostFee|COMMERCE_HOST_FEE_SCHEMA/);
assert.match(moneyWithMemberships, /marketplaceCheckoutEnabled:\s*false/);
assert.match(moneyWithMemberships, /marketplaceRecipientOnboardingEnabled:\s*false/);
assert.match(moneyWithMemberships, /platformCollectsSellerPayment:\s*false/);
assert.match(moneyWithMemberships, /platformRoutesSellerPayment:\s*false/);
assert.match(moneyWithMemberships, /goodsPaymentMode:\s*'seller-direct-outside-platform'/);
assert.match(moneyWithMemberships, /serviceLearningMode:\s*'acorn-button-fulfillment-burn'/);

// Legacy lifecycle code remains only to safely finish/refund/dispute old payments.
assert.match(serverCommerce, /settleCommerceCheckout/);
assert.match(serverCommerce, /handleCommerceRefund/);
assert.match(serverCommerce, /handleCommerceDispute/);
assert.match(serverCommerce, /restoreCommerceDisputeTransfers/);
assert.doesNotMatch(entry, /export \* from '\.\/commerce-edge\.mjs'/);

// Browser compatibility layer cannot originate or distribute a marketplace sale.
assert.match(browserCommerce, /commerceEnabled:false/);
assert.match(browserCommerce, /marketplacePaymentMode:'disabled'/);
assert.match(browserCommerce, /goodsPaymentMode:'seller-direct'/);
assert.match(browserCommerce, /serviceLearningMode:'acorn-button-fulfillment-burn'/);
assert.match(browserCommerce, /FELLOWFARE_MARKETPLACE_CHECKOUT_DISABLED/);
assert.match(browserCommerce, /buildDistribution:disabled/);
assert.match(browserCommerce, /stripeTransferInstructions:disabled/);
assert.match(browserCommerce, /recordSale:async\(\)=>disabled\(\)/);
assert.match(browserCommerce, /buildAnnualDistribution/);
assert.match(browserCommerce, /annualStripeTransferInstructions/);

// Fulfillment economy: fixed daily quests, non-transferable burn, same-asset milestones.
assert.match(fulfillment, /REWARD_PER_QUEST=5/);
assert.match(fulfillment, /MILESTONE_SIZE=100/);
assert.match(fulfillment, /MILESTONE_BONUS=10/);
for(const quest of ['finish-learning-module','fulfill-20-acorns','fulfill-20-buttons','post-need','post-offering']) assert.ok(fulfillment.includes(quest),`Missing quest ${quest}`);
assert.match(fulfillment, /nonTransferable:true/);
assert.match(fulfillment, /recipientCredited:false/);
assert.match(fulfillment, /operation:'fulfillment-burn'/);
assert.match(fulfillment, /platformIssuedRewards:true/);
assert.match(fulfillment, /GOODS_KINDS=new Set\(\['product','resource'\]\)/);
assert.match(fulfillment, /TOKEN_KINDS=new Set\(\['service','learning','tutoring'\]\)/);
assert.match(fulfillment, /platformCollectsPayment:false/);
assert.match(fulfillment, /platformRoutesPayment:false/);
assert.match(fulfillment, /seller-direct/);
assert.match(fulfillment, /Fulfill 20 🌰 Acorns/);
assert.match(fulfillment, /Fulfill 20 🔘 Buttons/);

assert.match(symbols, /Payment is arranged directly with the seller/);
assert.match(symbols, /Acorns\/Buttons are fulfilled and burned/);
assert.doesNotMatch(symbols, /Commerce receipts:/);

console.log(JSON.stringify({
  ok: true,
  revision: 'fellowfare-fulfillment-economy-v1',
  checks: [
    'goods-seller-direct',
    'marketplace-checkout-route-gone',
    'commerce-host-fee-routes-retired',
    'fail-closed-compatibility-carried',
    'marketplace-connected-recipient-onboarding-gone',
    'browser-marketplace-distribution-fails-closed',
    'services-learning-fulfillment-burn',
    'no-recipient-token-transfer',
    'three-daily-quest-buckets',
    'fixed-daily-reward',
    'hundred-unit-milestone-bonus',
    'legacy-payment-unwind-preserved',
    'annual-reserve-payout-preserved'
  ]
}, null, 2));
