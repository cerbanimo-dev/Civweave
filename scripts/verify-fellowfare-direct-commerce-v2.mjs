import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const [server, entry, money, feeSettlement, migration, frontend, compat, cabinet, symbols] = await Promise.all([
  read('cloudflare/core/src/fellowfare-direct-commerce-v1.mjs'),
  read('cloudflare/core/src/stripe-connect-v2-entry.mjs'),
  read('cloudflare/core/src/money-edge-with-memberships.mjs'),
  read('cloudflare/core/src/fellowfare-service-fee-v1.mjs'),
  read('cloudflare/core/migrations/0008_fellowfare_service_fees.sql'),
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
assert.match(server, /FELLOWFARE_DEFAULT_SERVICE_FEE_BPS = 500/);
assert.match(server, /FELLOWFARE_SERVICE_FEE_HOST_SHARE_BPS = 5000/);
assert.match(server, /FELLOWFARE_SERVICE_FEE_CERBANIMO_SHARE_BPS = 5000/);
assert.match(server, /integration_identifier: integrationIdentifier\(\)/);
assert.doesNotMatch(server, /payment_method_types/);
assert.doesNotMatch(server, /automatic_tax/);
assert.doesNotMatch(server, /\/v1\/transfers|transfer_data|destination:/);

// Price integrity and host attribution: checkout retrieves the seller-owned Stripe
// Price and reads the facilitating Hub from server-created metadata, not buyer input.
assert.match(server, /stripe\.prices\.retrieve\(priceId, \{\}, \{ stripeAccount: accountId \}\)/);
assert.match(server, /fellowfare_listing_id/);
assert.match(server, /fellowfare_kind/);
assert.match(server, /fellowfare_node_id/);
assert.match(server, /facilitatingNode\(env, input\?\.nodeId\)/);
assert.match(server, /required\(price\?\.metadata\?\.fellowfare_node_id/);
assert.match(server, /The Stripe Price does not match this FellowFare listing/);
assert.match(frontend, /CivweaveHostNodeSessionV1/);
assert.match(frontend, /selectedHostNodeId/);
assert.match(frontend, /nodeId,listingId:listing\.id/);
assert.match(frontend, /hostNodeId:price\.nodeId/);

// Application-fee proceeds are actually split and recorded. Cerbanimo keeps the
// remainder in the platform balance; the Host Steward receives a platform transfer.
assert.match(feeSettlement, /splitFellowFareServiceFee/);
assert.match(feeSettlement, /transfers\.create/);
assert.match(feeSettlement, /destination: node\.connected_account_id/);
assert.match(feeSettlement, /50-host-steward-50-cerbanimo/);
assert.match(feeSettlement, /reverseHostTransfer/);
assert.match(feeSettlement, /host_reversed_cents/);
assert.match(feeSettlement, /host_transferred_cents/);
assert.match(feeSettlement, /availableBalanceError/);
assert.match(feeSettlement, /status='pending-funds'/);
assert.match(feeSettlement, /retryPendingFellowFareServiceFees/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS money_edge_fellowfare_service_fees/);
assert.match(migration, /host_share_cents INTEGER NOT NULL/);
assert.match(migration, /cerbanimo_share_cents INTEGER NOT NULL/);
assert.match(migration, /host_transferred_cents INTEGER NOT NULL DEFAULT 0/);
assert.match(migration, /settlement_error TEXT/);
assert.match(migration, /WHERE status = 'pending-funds'/);
assert.match(money, /event\.type === 'application_fee\.created'/);
assert.match(money, /event\.type === 'application_fee\.refunded'/);
assert.match(money, /event\.type === 'balance\.available'/);
assert.match(money, /retryPendingFellowFareServiceFees\(this\)/);
assert.match(money, /serviceLearningDefaultPlatformFeeBps: FELLOWFARE_DEFAULT_SERVICE_FEE_BPS/);
assert.match(money, /serviceLearningApplicationFeeSplit: '50-host-steward-50-cerbanimo'/);
assert.match(money, /serviceLearningHostStewardShareBpsOfFee: FELLOWFARE_SERVICE_FEE_HOST_SHARE_BPS/);
assert.match(money, /serviceLearningCerbanimoShareBpsOfFee: FELLOWFARE_SERVICE_FEE_CERBANIMO_SHARE_BPS/);
assert.match(money, /serviceLearningHostSettlement: 'application-fee-event-plus-balance-available-retry'/);

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
assert.match(frontend, /5% service fee/);
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
    defaultPlatformFeeBps: 500,
    applicationFeeSplit: '50-host-steward-50-cerbanimo',
    hostStewardShareBpsOfFee: 5000,
    cerbanimoShareBpsOfFee: 5000,
    hostSettlement: 'application-fee-event-plus-balance-available-retry',
    platformCollectsGross: false,
    platformRoutesSellerProceeds: false
  }
}, null, 2));
