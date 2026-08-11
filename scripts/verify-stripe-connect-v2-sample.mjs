import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const [pkgText, sampleSource, entrySource, migrationSource, wranglerText, prepareSource, deployWorkflow] = await Promise.all([
  read('cloudflare/core/package.json'),
  read('cloudflare/core/src/stripe-connect-v2-sample.mjs'),
  read('cloudflare/core/src/stripe-connect-v2-entry.mjs'),
  read('cloudflare/core/migrations/0003_stripe_connect_v2_sample.sql'),
  read('cloudflare/core/wrangler.template.jsonc'),
  read('scripts/prepare-cloudflare-launch-kit-v1.mjs'),
  read('.github/workflows/deploy-cloudflare-money-edge-v1.yml')
]);
const pkg = JSON.parse(pkgText);
const parseJsonc = text => JSON.parse(text.split('\n').filter(line => !line.trim().startsWith('//')).join('\n'));
const wrangler = parseJsonc(wranglerText);

assert.equal(pkg.dependencies.stripe, '22.4.0');
assert.ok(sampleSource.includes("new Stripe(secretKey"));
assert.ok(sampleSource.includes('Stripe.createFetchHttpClient'));
assert.ok(!sampleSource.includes('apiVersion:'), 'SDK sample must use its pinned API version automatically');

// Accounts V2 creation contract. The source must use the requested V2 shape and
// must never fall back to legacy top-level account types.
for (const needle of [
  'stripeClient.v2.core.accounts.create',
  'display_name:',
  'contact_email:',
  "identity: { country: 'us' }",
  "dashboard: 'full'",
  "fees_collector: 'stripe'",
  "losses_collector: 'stripe'",
  'card_payments: { requested: true }'
]) assert.ok(sampleSource.includes(needle), `missing Accounts V2 contract: ${needle}`);
for (const forbidden of ["type: 'express'", "type: 'standard'", "type: 'custom'"]) assert.ok(!sampleSource.includes(forbidden));

// Onboarding status is fetched directly from Stripe, while D1 stores only the
// user-to-account mapping and thin-event idempotency receipts.
assert.ok(sampleSource.includes('stripeClient.v2.core.accounts.retrieve'));
assert.ok(sampleSource.includes("include: ['configuration.merchant', 'requirements']"));
assert.ok(sampleSource.includes('stripeClient.v2.core.accountLinks.create'));
assert.ok(sampleSource.includes("configurations: ['merchant', 'customer']"));
assert.ok(migrationSource.includes('CREATE TABLE IF NOT EXISTS stripe_connect_users'));
assert.ok(migrationSource.includes('CREATE TABLE IF NOT EXISTS stripe_connect_thin_events'));
assert.ok(!migrationSource.includes('requirements_json'));

// Products and Checkout must execute on the connected account using the SDK's
// stripeAccount request option (Stripe-Account header) and direct-charge fee.
for (const needle of [
  'stripeClient.products.create',
  'stripeClient.products.list',
  "expand: ['data.default_price']",
  'stripeClient.prices.retrieve',
  'stripeClient.checkout.sessions.create',
  'application_fee_amount',
  'stripeAccount:'
]) assert.ok(sampleSource.includes(needle), `missing connected-account request path: ${needle}`);

// Accounts V2 requirement changes use thin Event Notifications. stripe-node
// 22.4.0 exposes parseEventNotificationAsync rather than the older parser name.
for (const eventType of [
  'v2.core.account[requirements].updated',
  'v2.core.account[configuration.merchant].capability_status_updated',
  'v2.core.account[configuration.customer].capability_status_updated'
]) assert.ok(sampleSource.includes(eventType));
assert.ok(sampleSource.includes('parseEventNotificationAsync'));
assert.ok(sampleSource.includes('notification.fetchEvent()'));
assert.ok(sampleSource.includes('STRIPE_CONNECT_THIN_WEBHOOK_SECRET'));

// The sample is compiled into the core Worker but must remain disabled by default.
// This prevents the public workers.dev origin from becoming an unauthenticated
// Stripe operator console. Sandbox testing must opt in explicitly.
assert.equal(wrangler.vars.STRIPE_CONNECT_SAMPLE_ENABLED, 'false');
assert.ok(entrySource.includes('STRIPE_CONNECT_SAMPLE_ENABLED'));
assert.ok(entrySource.includes('if (enabled(env?.STRIPE_CONNECT_SAMPLE_ENABLED))'));
assert.ok(entrySource.includes('handleStripeConnectV2Sample'));
assert.ok(prepareSource.includes('../cloudflare/core/src/stripe-connect-v2-entry.mjs'));
assert.ok(deployWorkflow.includes('npm install --prefix cloudflare/core'));
assert.ok(deployWorkflow.includes('STRIPE_CONNECT_THIN_WEBHOOK_SECRET'));
assert.ok(!deployWorkflow.includes('probe "$CORE_URL/connect-demo"'), 'production deploy must not expect the disabled sample UI to be public');

for (const file of ['cloudflare/core/src/stripe-connect-v2-sample.mjs', 'cloudflare/core/src/stripe-connect-v2-entry.mjs']) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, `${file} syntax failed: ${result.stderr || result.stdout}`);
}

const sample = await import(new URL('cloudflare/core/src/stripe-connect-v2-sample.mjs', root));
assert.equal(sample.STRIPE_CONNECT_SAMPLE_SDK, 'stripe-node@22.4.0');
assert.throws(() => sample.createStripeClient({}), /STRIPE_SECRET_KEY is not configured/);

const fakeStripe = {
  v2: { core: { accounts: { retrieve: async () => ({
    id: 'acct_demo',
    configuration: { merchant: { capabilities: { card_payments: { status: 'active' } } } },
    requirements: { summary: { minimum_deadline: { status: 'pending' } } }
  }) } } }
};
const status = await sample.retrieveConnectStatus(fakeStripe, 'acct_demo');
assert.equal(status.readyToProcessPayments, true);
assert.equal(status.onboardingComplete, true);

// Test the sample handler directly. The composite production entry is what adds
// the opt-in gate, allowing this deterministic UI check without enabling it.
const ui = await sample.handleStripeConnectV2Sample(new Request('https://core.example/connect-demo'), {});
assert.equal(ui.status, 200);
assert.match(ui.headers.get('content-type'), /text\/html/);
assert.match(await ui.text(), /Onboard to collect payments/);

console.log(JSON.stringify({
  ok: true,
  sdk: sample.STRIPE_CONNECT_SAMPLE_SDK,
  apiVersionManagedBySdk: true,
  accountsV2: true,
  accountLinksV2: true,
  directStatusFetch: true,
  thinEvents: true,
  productsOnConnectedAccount: true,
  directCheckoutApplicationFee: true,
  userAccountMappingInD1: true,
  cleanHtmlSample: true,
  productionSampleDefault: 'disabled'
}, null, 2));
