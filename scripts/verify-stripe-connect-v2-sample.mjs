import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const [pkgText, sampleSource, entrySource, providerSource, snapshotSource, migrationSource, retryMigrationSource, wranglerText, prepareSource, deployWorkflow] = await Promise.all([
  read('cloudflare/core/package.json'),
  read('cloudflare/core/src/stripe-connect-v2-sample.mjs'),
  read('cloudflare/core/src/stripe-connect-v2-entry.mjs'),
  read('cloudflare/core/src/stripe-connect.mjs'),
  read('cloudflare/core/src/stripe-snapshot-webhook.mjs'),
  read('cloudflare/core/migrations/0003_stripe_connect_v2_sample.sql'),
  read('cloudflare/core/migrations/0004_stripe_event_processing.sql'),
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

assert.ok(sampleSource.includes('stripeClient.v2.core.accounts.retrieve'));
assert.ok(sampleSource.includes("include: ['configuration.merchant', 'requirements']"));
assert.ok(sampleSource.includes('stripeClient.v2.core.accountLinks.create'));
assert.ok(sampleSource.includes("configurations: ['merchant', 'customer']"));
assert.ok(migrationSource.includes('CREATE TABLE IF NOT EXISTS stripe_connect_users'));
assert.ok(migrationSource.includes('CREATE TABLE IF NOT EXISTS stripe_connect_thin_events'));
assert.ok(!migrationSource.includes('requirements_json'));

for (const needle of [
  'stripeClient.products.create',
  'stripeClient.products.list',
  "expand: ['data.default_price']",
  'stripeClient.prices.retrieve',
  'stripeClient.checkout.sessions.create',
  'application_fee_amount',
  'stripeAccount:'
]) assert.ok(sampleSource.includes(needle), `missing connected-account request path: ${needle}`);

for (const eventType of [
  'v2.core.account[requirements].updated',
  'v2.core.account[configuration.merchant].capability_status_updated',
  'v2.core.account[configuration.customer].capability_status_updated'
]) assert.ok(sampleSource.includes(eventType));
assert.ok(sampleSource.includes('parseEventNotificationAsync'));
assert.ok(sampleSource.includes('notification.fetchEvent()'));
assert.ok(sampleSource.includes('STRIPE_CONNECT_THIN_WEBHOOK_SECRET'));

// Stripe supports both full secret keys (sk_*) and restricted server keys (rk_*).
// The money-edge status must classify either sandbox/live family correctly without
// exposing any credential material.
assert.ok(providerSource.includes("key.startsWith('rk_test_')"));
assert.ok(providerSource.includes("key.startsWith('rk_live_')"));

// Snapshot webhook receipts have an explicit processing lifecycle. A failed event
// must be claimable on Stripe retry; a completed event must remain idempotent; a
// fresh in-flight duplicate must not run concurrently.
for (const needle of [
  "processing_state='processing'",
  "processing_state='processed'",
  "processing_state='error'",
  'processing_attempts=processing_attempts+1',
  'staleBefore',
  'retryDeferred'
]) assert.ok(snapshotSource.includes(needle), `missing snapshot retry hardening: ${needle}`);
for (const needle of ['processing_state', 'processing_attempts', 'last_attempt_at', 'processed_at']) {
  assert.ok(retryMigrationSource.includes(needle), `missing Stripe receipt migration field: ${needle}`);
}

// Interactive sample/admin routes remain disabled by default, but both Stripe-
// signed webhooks must stay routable without opening the UI.
assert.equal(wrangler.vars.STRIPE_CONNECT_SAMPLE_ENABLED, 'false');
assert.ok(entrySource.includes("THIN_WEBHOOK_PATH = '/api/connect-demo/webhooks/stripe-thin'"));
assert.ok(entrySource.includes('STRIPE_SNAPSHOT_WEBHOOK_PATHS.has(url.pathname)'));
assert.ok(entrySource.includes('handleStripeSnapshotWebhook'));
assert.ok(entrySource.includes("request.method === 'POST' && url.pathname === THIN_WEBHOOK_PATH"));
assert.ok(entrySource.indexOf('STRIPE_SNAPSHOT_WEBHOOK_PATHS.has(url.pathname)') < entrySource.indexOf('if (enabled(env?.STRIPE_CONNECT_SAMPLE_ENABLED))'));
assert.ok(entrySource.indexOf("request.method === 'POST' && url.pathname === THIN_WEBHOOK_PATH") < entrySource.indexOf('if (enabled(env?.STRIPE_CONNECT_SAMPLE_ENABLED))'));
assert.ok(entrySource.includes('if (enabled(env?.STRIPE_CONNECT_SAMPLE_ENABLED))'));
assert.ok(entrySource.includes('handleStripeConnectV2Sample'));
assert.ok(prepareSource.includes('templateEntryMatch'));
assert.ok(prepareSource.includes('generatedEntry'));
assert.ok(prepareSource.includes('../cloudflare/core/'));
assert.ok(deployWorkflow.includes('npm install --prefix cloudflare/core'));
assert.ok(deployWorkflow.includes('STRIPE_CONNECT_THIN_WEBHOOK_SECRET'));
assert.ok(!deployWorkflow.includes('probe "$CORE_URL/connect-demo"'), 'production deploy must not expect the disabled sample UI to be public');

for (const file of [
  'cloudflare/core/src/stripe-connect.mjs',
  'cloudflare/core/src/stripe-connect-v2-sample.mjs',
  'cloudflare/core/src/stripe-snapshot-webhook.mjs',
  'cloudflare/core/src/stripe-connect-v2-entry.mjs'
]) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, `${file} syntax failed: ${result.stderr || result.stdout}`);
}

const hardening = spawnSync(process.execPath, ['scripts/verify-stripe-snapshot-webhook-hardening.mjs'], {
  cwd: new URL('../', import.meta.url),
  encoding: 'utf8'
});
assert.equal(hardening.status, 0, `snapshot webhook hardening verifier failed: ${hardening.stderr || hardening.stdout}`);

const provider = await import(new URL('cloudflare/core/src/stripe-connect.mjs', root));
assert.equal(provider.stripeCredentialMode(''), 'unconfigured');
assert.equal(provider.stripeCredentialMode('sk_test_demo'), 'sandbox');
assert.equal(provider.stripeCredentialMode('rk_test_demo'), 'sandbox');
assert.equal(provider.stripeCredentialMode('sk_live_demo'), 'live');
assert.equal(provider.stripeCredentialMode('rk_live_demo'), 'live');
assert.equal(provider.stripeCredentialMode('not-a-stripe-key'), 'unrecognized');

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
  signedThinWebhookPublic: true,
  snapshotWebhookRetrySafe: true,
  restrictedStripeKeysClassified: true,
  productsOnConnectedAccount: true,
  directCheckoutApplicationFee: true,
  userAccountMappingInD1: true,
  cleanHtmlSample: true,
  productionSampleDefault: 'disabled'
}, null, 2));
