import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const [server, entry, money, frontend, compat, cabinet, symbols] = await Promise.all([
  read('cloudflare/core/src/fellowfare-direct-commerce-v1.mjs'),
  read('cloudflare/core/src/stripe-connect-v2-entry.mjs'),
  read('cloudflare/core/src/money-edge-with-memberships.mjs'),
  read('public/app/services/fellowfare/fulfillment-economy-v2.js'),
  read('public/app/services/fellowfare/fulfillment-economy-v1.js'),
  read('public/app/services/fellowfare/cabinet.html'),
  read('public/app/services/fellowfare/marketplace-v2-symbols.js')
]);

assert.doesNotThrow(() => new Function(frontend), 'fulfillment-economy-v2.js must parse as classic JavaScript');
assert.doesNotThrow(() => new Function(symbols), 'marketplace-v2-symbols.js must parse as classic JavaScript');

// Stripe account ownership: service providers are independent connected merchants.
assert.match(server, /FELLOWFARE_DIRECT_COMMERCE_KINDS = Object\.freeze\(\['service', 'learning', 'tutoring'\]\)/);
assert.match(server, /dashboard: 'full'/);
assert.match(server, /fees_collector: 'stripe'/);
assert.match(server, /losses_collector: 'stripe'/);
assert.match(server, /merchant:\s*\{/);
assert.match(server, /card_payments: \{ requested: true \}/);
assert.match(server, /configuration\.merchant/);
assert.match(server, /card_payments\?\.status/);
assert.doesNotMatch(server, /type:\s*['"](?:standard|express|custom)['"]/);

// Direct charge: the connected account owns the charge and FellowFare gets only
// application_fee_amount. There must be no destination/separate seller transfer.
assert.match(server, /application_fee_amount/);
assert.match(server, /stripeAccount: accountId/);
assert.match(server, /chargePattern: 'direct-charge'/);
assert.match(server, /merchantOfRecord: 'connected-account'/);
assert.match(server, /platformCollectsGross: false/);
assert.match(server, /platformRoutesSellerProceeds: false/);
assert.match(server, /CIVWEAVE_FELLOWFARE_SERVICE_FEE_BPS/);
assert.match(server, /FELLOWFARE_DEFAULT_SERVICE_FEE_BPS = 100/);
assert.match(server, /integration_identifier: integrationIdentifier\(\)/);
assert.doesNotMatch(server, /payment_method_types/);
assert.doesNotMatch(server, /automatic_tax/);
assert.doesNotMatch(server, /\/v1\/transfers|transfer_data|destination:/);

// Price integrity: checkout retrieves the seller-owned Stripe Price and requires
// its FellowFare listing metadata to match instead of trusting a buyer-supplied amount.
assert.match(server, /stripe\.prices\.retrieve\(priceId, \{\}, \{ stripeAccount: accountId \}\)/);
assert.match(server, /fellowfare_listing_id/);
assert.match(server, /fellowfare_kind/);
assert.match(server, /The Stripe Price does not match this FellowFare listing/);

// The new direct rail is production-routed separately. The old platform-charge
// marketplace API remains intentionally dead.
assert.match(entry, /handleFellowFareDirectCommerce/);
assert.match(entry, /\/api\/fellowfare\/direct-commerce\//);
assert.match(entry, /\/api\/money-edge\/commerce\//);
assert.match(entry, /marketplace-checkout-disabled/);
assert.doesNotMatch(entry, /handleCommerceApiRequest/);
assert.match(money, /serviceLearningUsdMode: 'stripe-connect-direct-charge'/);
assert.match(money, /serviceLearningMerchantOfRecord: 'connected-provider'/);
assert.match(money, /serviceLearningPlatformFeeMode: 'application-fee'/);
assert.match(money, /platformCollectsGrossSellerPayment: false/);
assert.match(money, /platformRoutesSellerProceeds: false/);

// Fulfillment stays canonical beside cash commerce.
assert.match(frontend, /REWARD_PER_QUEST=5/);
assert.match(frontend, /MILESTONE_SIZE=100/);
assert.match(frontend, /MILESTONE_BONUS=10/);
assert.match(frontend, /operation:'fulfillment-burn'/);
assert.match(frontend, /nonTransferable:true/);
assert.match(frontend, /recipientCredited:false/);
assert.match(frontend, /TOKEN_KINDS=new Set\(\['service','learning','tutoring'\]\)/);
assert.match(frontend, /cashMode:cash\?'stripe-connect-direct-charge':'none'/);
assert.match(frontend, /Offer USD, Acorn\/Button fulfillment, or both/);
assert.match(frontend, /Pay \$\{money\(listing\.pricing\.usdMinor\)\} with Stripe/);
assert.match(frontend, /syncOwnCashListings/);
assert.match(frontend, /beginMerchantOnboarding/);
assert.match(frontend, /beginDirectCheckout/);

// Goods keep the hard boundary: no platform/token price and no direct-charge route.
assert.match(frontend, /GOODS_KINDS=new Set\(\['product','resource'\]\)/);
assert.match(frontend, /listing\.pricing=\{\.\.\.pricing,usdMinor:0,buttons:0,acorns:0\}/);
assert.match(frontend, /mode:'seller-direct'/);
assert.match(frontend, /platformCollectsPayment:false/);
assert.match(frontend, /platformRoutesPayment:false/);
assert.match(server, /Direct FellowFare checkout is only available for services, learning, and tutoring/);

// v2 must boot before v1 and install the compatibility alias so the retired v1
// policy cannot zero service USD pricing after v2 has established the new model.
assert.ok(cabinet.indexOf('fulfillment-economy-v2.js') < cabinet.indexOf('fulfillment-economy-v1.js'), 'v2 must load before the retained v1 compatibility file');
assert.match(frontend, /globalThis\.CivweaveFulfillmentEconomyV1=api/);
assert.match(compat, /if\(globalThis\.CivweaveFulfillmentEconomyV1\)return/);

// Shared listings must describe the two service rails and the separate goods rail.
assert.match(symbols, /provider Stripe direct checkout/);
assert.match(symbols, /FellowFare receives only its application fee/);
assert.match(symbols, /Acorns\/Buttons are fulfilled and burned/);
assert.match(symbols, /does not collect or route a goods payment/);

console.log(JSON.stringify({
  ok: true,
  revision: 'fellowfare-fulfillment-direct-commerce-v2',
  rules: {
    goods: 'seller-direct-outside-platform',
    serviceLearningTokens: 'fulfillment-burn',
    serviceLearningUsd: 'stripe-connect-direct-charge',
    merchantOfRecord: 'connected-provider',
    platformFee: 'application-fee',
    defaultPlatformFeeBps: 100,
    platformCollectsGross: false,
    platformRoutesSellerProceeds: false
  }
}, null, 2));
