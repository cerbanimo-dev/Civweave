import Stripe from '../cloudflare/core/node_modules/stripe/esm/stripe.esm.node.js';

const LIVE_SNAPSHOT_URL = 'https://civweave-core.glaedn.workers.dev/api/money-edge/webhooks/stripe';
const EXPECTED_EVENTS = Object.freeze([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.funds_withdrawn'
]);

const key = String(process.env.STRIPE_LIVE_SECRET_KEY || '').trim();
if (!key) {
  console.log(JSON.stringify({
    ok: false,
    readyForCredentialPreflight: false,
    reason: 'STRIPE_LIVE_SECRET_KEY is not staged',
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

const coreResponse = await fetch('https://civweave-core.glaedn.workers.dev/api/money-edge/status', {
  headers: { accept: 'application/json' }
});
if (!coreResponse.ok) throw new Error(`Cloudflare money-edge status returned HTTP ${coreResponse.status}.`);
const core = await coreResponse.json();
const edge = core.moneyEdge || core;
if (edge.liveReady === true) throw new Error('Refusing preflight: Civweave live money is unexpectedly enabled.');

const report = {
  ok: Boolean(exact),
  mutationPerformed: false,
  stripeLiveAuthentication: true,
  platformAccountPresent: Boolean(account?.id),
  platformChargesEnabled: Boolean(account?.charges_enabled),
  platformPayoutsEnabled: Boolean(account?.payouts_enabled),
  snapshotWebhook: {
    targetCount: target.length,
    enabledExactMatch: Boolean(exact),
    expectedEventCount: EXPECTED_EVENTS.length,
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
  humanStillRequired: [
    'live Stripe platform activation and factual business verification',
    'live Accounts V2 thin event destination and signing secret staging',
    'first live connected-account onboarding and identity/payout verification',
    'compliance, jurisdiction, KYC/AML, tax, and provider-terms attestations',
    'explicit live-money enablement after all gates are satisfied'
  ]
};

console.log(JSON.stringify(report, null, 2));
if (!exact) process.exit(4);
