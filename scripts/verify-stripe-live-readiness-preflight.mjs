import { readFile } from 'node:fs/promises';
import Stripe from '../cloudflare/core/node_modules/stripe/esm/stripe.esm.node.js';

const CORE_ORIGIN = String(process.env.CIVWEAVE_LIVE_CORE_ORIGIN || 'https://civweave-core.cerbanimo.workers.dev').replace(/\/$/, '');
const LIVE_SNAPSHOT_URL = `${CORE_ORIGIN}/api/money-edge/webhooks/stripe`;
const EXPECTED_EVENTS = Object.freeze([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.funds_withdrawn',
  'charge.dispute.funds_reinstated',
  'invoice.paid',
  'customer.subscription.deleted'
]);
const EXPECTED_ACCOUNT_MODEL = 'accounts-v2-marketplace-recipient'; // Stripe SDK model name; used for eligible platform payout recipients, not FellowFare sellers.

const providerSource = await readFile(new URL('../cloudflare/core/src/stripe-connect.mjs', import.meta.url), 'utf8');
const browserCommerceSource = await readFile(new URL('../public/app/cerbanimo-commerce-distribution-v1.js', import.meta.url), 'utf8');
const providerEventSource = await readFile(new URL('../cloudflare/core/src/money-edge-with-memberships.mjs', import.meta.url), 'utf8');
const productionEntrySource = await readFile(new URL('../cloudflare/core/src/stripe-connect-v2-entry.mjs', import.meta.url), 'utf8');
const v2AccountCreationMarker = ['v2', 'core', 'accounts', 'create'].join('.');
const sourceContract = Object.freeze({
  accountsV2RecipientForPlatformPayouts: providerSource.includes(`STRIPE_CONNECT_ACCOUNT_MODEL = '${EXPECTED_ACCOUNT_MODEL}'`)
    && providerSource.includes(v2AccountCreationMarker)
    && providerSource.includes("dashboard: 'express'")
    && providerSource.includes("fees_collector: 'application'")
    && providerSource.includes("losses_collector: 'application'")
    && providerSource.includes('stripe_transfers: { requested: true }'),
  separateChargesAndTransfersForPlatformEarnings: providerSource.includes("operatorPayouts = 'platform-charge-separate-transfer'")
    && providerSource.includes("return this.request('/v1/transfers'")
    && providerSource.includes('source_transaction'),
  fellowFareMarketplaceCheckoutDisabled: productionEntrySource.includes('marketplacePaymentsDisabled')
    && productionEntrySource.includes('marketplace-checkout-disabled')
    && productionEntrySource.includes('status: 410')
    && !productionEntrySource.includes('handleCommerceApiRequest'),
  browserMarketplaceDistributionDisabled: browserCommerceSource.includes('commerceEnabled:false')
    && browserCommerceSource.includes("marketplacePaymentMode:'disabled'")
    && browserCommerceSource.includes('buildDistribution:disabled')
    && browserCommerceSource.includes('stripeTransferInstructions:disabled'),
  fulfillmentBoundaryAdvertised: providerEventSource.includes('marketplaceCheckoutEnabled: false')
    && providerEventSource.includes('marketplaceRecipientOnboardingEnabled: false')
    && providerEventSource.includes("goodsPaymentMode: 'seller-direct-outside-platform'")
    && providerEventSource.includes("serviceLearningMode: 'acorn-button-fulfillment-burn'")
    && providerEventSource.includes('platformCollectsSellerPayment: false')
    && providerEventSource.includes('platformRoutesSellerPayment: false'),
  legacyMarketplaceUnwindOnly: providerEventSource.includes('settleCommerceCheckout')
    && providerEventSource.includes('handleCommerceRefund')
    && providerEventSource.includes('handleCommerceDispute')
    && providerEventSource.includes('restoreCommerceDisputeTransfers')
    && providerEventSource.includes('Legacy only')
});
const failedSourceChecks = Object.entries(sourceContract).filter(([, ok]) => !ok).map(([name]) => name);
if (failedSourceChecks.length) {
  throw new Error(`Live readiness source contract is stale; failed checks: ${failedSourceChecks.join(', ')}. ${JSON.stringify(sourceContract)}`);
}

const key = String(process.env.STRIPE_LIVE_SECRET_KEY || '').trim();
if (!key) {
  console.log(JSON.stringify({
    ok: false,
    readyForCredentialPreflight: false,
    reason: 'STRIPE_LIVE_SECRET_KEY is not staged',
    coreOrigin: CORE_ORIGIN,
    expectedAccountModel: EXPECTED_ACCOUNT_MODEL,
    fellowFareMarketplaceCheckout: 'disabled',
    sourceContract,
    mutationPerformed: false
  }, null, 2));
  process.exit(3);
}
if (!key.startsWith('sk_live_') && !key.startsWith('rk_live_')) {
  throw new Error('Live readiness preflight refuses credentials that are not a Stripe live-mode server key.');
}

const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
const account = await stripe.accounts.retrieve();
const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
const target = endpoints.data.filter(endpoint => endpoint.url === LIVE_SNAPSHOT_URL);
const exact = target.find(endpoint => {
  const enabled = new Set(endpoint.enabled_events || []);
  return endpoint.status === 'enabled'
    && endpoint.livemode === true
    && EXPECTED_EVENTS.every(type => enabled.has(type) || enabled.has('*'));
});

const connectedAccounts = await stripe.accounts.list({ limit: 100 });
const legacyLiabilityShape = (connectedAccounts.data || []).filter(item => (
  item?.controller?.fees?.payer === 'account'
  || item?.controller?.losses?.payments === 'stripe'
));

const coreResponse = await fetch(`${CORE_ORIGIN}/api/money-edge/status`, {
  headers: { accept: 'application/json' }
});
if (!coreResponse.ok) throw new Error(`Cloudflare money-edge status returned HTTP ${coreResponse.status}.`);
const core = await coreResponse.json();
const edge = core.moneyEdge || core;
if (edge.liveReady === true) throw new Error('Refusing preflight: Civweave live money is unexpectedly enabled.');

const report = {
  ok: Boolean(exact) && Object.values(sourceContract).every(Boolean),
  mutationPerformed: false,
  coreOrigin: CORE_ORIGIN,
  stripeLiveAuthentication: true,
  platformAccountPresent: Boolean(account?.id),
  platformChargesEnabled: Boolean(account?.charges_enabled),
  platformPayoutsEnabled: Boolean(account?.payouts_enabled),
  platformRecipients: {
    stripeAccountModelName: EXPECTED_ACCOUNT_MODEL,
    purpose: 'eligible Civweave platform earnings such as Host Steward payouts; not FellowFare goods sellers',
    chargePattern: 'platform-charge-separate-transfer where the platform lane requires it',
    connectedAccountDashboard: 'express',
    recipientCapability: 'configuration.recipient.capabilities.stripe_balance.stripe_transfers',
    currentConnectedAccountCount: connectedAccounts.data?.length || 0,
    legacyLiabilityShapeCount: legacyLiabilityShape.length
  },
  fellowFare: {
    marketplaceCheckoutEnabled: false,
    goodsPaymentMode: 'seller-direct-outside-platform',
    serviceLearningMode: 'acorn-button-fulfillment-burn',
    platformCollectsSellerPayment: false,
    platformRoutesSellerPayment: false,
    publicCommerceRouteExpectedStatus: 410,
    legacyPaymentLifecycle: 'unwind-only'
  },
  snapshotWebhook: {
    url: LIVE_SNAPSHOT_URL,
    targetCount: target.length,
    enabledExactMatch: Boolean(exact),
    expectedEventCount: EXPECTED_EVENTS.length,
    expectedEvents: EXPECTED_EVENTS,
    apiVersion: exact?.api_version || null
  },
  civweave: {
    authority: edge.authority || core.authority || null,
    providerMode: edge.providerMode || null,
    integrationDoorReady: edge.integrationDoorReady === true,
    liveReady: edge.liveReady === true,
    structuralBlockers: edge.structuralBlockers || [],
    operationalBlockers: edge.operationalBlockers || []
  },
  sourceContract,
  humanStillRequired: [
    'live Stripe platform activation and factual business verification',
    'live recipient requirement/capability event destination and signing secret staging for eligible platform payouts',
    'first live Host Steward/platform recipient onboarding and stripe_transfers capability verification',
    'compliance, jurisdiction, KYC/AML, tax, and provider-terms attestations for supported platform-money lanes',
    'explicit live-money enablement after all gates are satisfied',
    'independent confirmation that FellowFare marketplace checkout remains disabled after activation'
  ]
};

console.log(JSON.stringify(report, null, 2));
if (!exact) process.exit(4);
