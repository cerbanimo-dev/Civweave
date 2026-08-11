import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const parseJsonc = text => JSON.parse(text.split('\n').filter(line => !line.trim().startsWith('//')).join('\n'));
const LIVE_MONEY_EDGE = 'https://civweave-core.glaedn.workers.dev';

const [topologyText, transportsText, coreWranglerText, nodeWranglerText, coreSource, moneySource, stripeSource, nodeSource, migration1, migration2, bootstrapSource, envExample, guide] = await Promise.all([
  read('config/launch-topology-v1.json'),
  read('config/host-node-transports-v1.json'),
  read('cloudflare/core/wrangler.template.jsonc'),
  read('cloudflare/node-cloud/wrangler.jsonc'),
  read('cloudflare/core/src/index.mjs'),
  read('cloudflare/core/src/money-edge.mjs'),
  read('cloudflare/core/src/stripe-connect.mjs'),
  read('cloudflare/node-cloud/src/index.mjs'),
  read('cloudflare/core/migrations/0001_core.sql'),
  read('cloudflare/core/migrations/0002_money_edge.sql'),
  read('lib/node-ai-bootstrap-v1.mjs'),
  read('.env.ai-wallet.example'),
  read('docs/operations/launch-kit-cloudflare-node-fabric-v1.md')
]);
const topology = JSON.parse(topologyText), transports = JSON.parse(transportsText);
const core = parseJsonc(coreWranglerText), node = parseJsonc(nodeWranglerText);

assert.equal(topology.platformFeeBps, 1500);
assert.equal(topology.backbone.moneyEdgeAuthority, true);
assert.equal(topology.backbone.publicApiOrigin, LIVE_MONEY_EDGE);
assert.equal(topology.transition.cloudflareMoneyEdgeAuthority, true);
assert.equal(topology.transition.renderIsAuthority, false);
assert.equal(topology.transition.renderMoneyEdgeEnabled, false);
assert.equal(topology.physicalNodeFabric.moneyEdgeUrl, LIVE_MONEY_EDGE);
assert.equal(transports.moneyEdgeAuthority, LIVE_MONEY_EDGE);
assert.equal(core.name, 'civweave-core');
assert.equal(core.vars.CIVWEAVE_PLATFORM_FEE_BPS, '1500');
assert.equal(core.vars.CIVWEAVE_MONEY_LIVE_ENABLED, 'false');
assert.ok(core.d1_databases.some(x => x.binding === 'DB' && x.database_name === 'civweave-core'));
assert.ok(core.r2_buckets.some(x => x.binding === 'PACKAGES' && x.bucket_name === 'civweave-distribution'));
assert.ok(core.durable_objects.bindings.some(x => x.name === 'IDENTITY' && x.class_name === 'CivweaveCoreIdentity'));
assert.ok(core.triggers.crons.includes('*/5 * * * *'));
assert.ok(node.routes.some(x => x.pattern === '*.nodes.commonweave.earth/*'));
assert.ok(node.durable_objects.bindings.some(x => x.name === 'NODES' && x.class_name === 'CivweaveCloudNode'));
assert.ok(node.services.some(x => x.binding === 'CORE' && x.service === 'civweave-core'));
for (const forbidden of ['STRIPE_SECRET_KEY', 'STRIPE_CONNECT_WEBHOOK_SECRET', 'CIVWEAVE_MONEY_EDGE_PRIVATE_KEY']) assert.ok(!JSON.stringify(node).includes(forbidden));
assert.ok(migration1.includes('CREATE TABLE IF NOT EXISTS stripe_events'));
assert.ok(migration2.includes('CREATE TABLE IF NOT EXISTS money_edge_topups'));
assert.ok(migration2.includes('CREATE TABLE IF NOT EXISTS money_edge_deliveries'));
assert.ok(coreSource.includes('/api/money-edge/webhooks/stripe'));
assert.ok(coreSource.includes('CivweaveCoreIdentity'));
assert.ok(moneySource.includes("feeAuthority: 'cerbanimo-money-edge'"));
assert.ok(moneySource.includes("infrastructureAuthority: 'cloudflare-core'"));
assert.ok(moneySource.includes('proof-of-key-short-lived-grant'));
assert.ok(nodeSource.includes('/api/ai/node/live/challenge'));
assert.ok(nodeSource.includes('/api/ai/node/manifest'));
assert.ok(nodeSource.includes('privateJwk'));
assert.ok(bootstrapSource.includes(`DEFAULT_CIVWEAVE_MONEY_EDGE_URL = '${LIVE_MONEY_EDGE}'`));
assert.ok(envExample.includes(`CIVWEAVE_MONEY_EDGE_URL=${LIVE_MONEY_EDGE}`));
assert.ok(guide.includes('Render is no longer a money-edge authority'));

for (const file of ['cloudflare/core/src/index.mjs','cloudflare/core/src/money-edge.mjs','cloudflare/core/src/stripe-connect.mjs','cloudflare/node-cloud/src/index.mjs','lib/node-ai-bootstrap-v1.mjs']) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, `${file} syntax failed: ${result.stderr || result.stdout}`);
}

const { StripeConnectWorkerProvider } = await import(new URL('cloudflare/core/src/stripe-connect.mjs', root));
const calls = [];
const fakeFetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  if (String(url).endsWith('/v1/accounts')) return new Response(JSON.stringify({ id: 'acct_test' }), { status: 200, headers: {'content-type':'application/json'} });
  if (String(url).endsWith('/v1/account_links')) return new Response(JSON.stringify({ url: 'https://connect.stripe.test/onboard', expires_at: 2000000000 }), { status: 200, headers: {'content-type':'application/json'} });
  if (String(url).endsWith('/v1/checkout/sessions')) return new Response(JSON.stringify({ id: 'cs_test', url: 'https://checkout.stripe.test/cs_test' }), { status: 200, headers: {'content-type':'application/json'} });
  if (String(url).endsWith('/v1/refunds')) return new Response(JSON.stringify({ id: 're_test', status: 'succeeded' }), { status: 200, headers: {'content-type':'application/json'} });
  throw new Error(`unexpected fake Stripe URL ${url}`);
};
const provider = new StripeConnectWorkerProvider({ secretKey: 'sk_test_placeholder_not_a_real_secret', webhookSecret: 'whsec_placeholder', fetchImpl: fakeFetch });
await provider.createConnectedAccount({ nodeId: 'seed-east', operatorId: 'operator-seed-east' });
let body = new URLSearchParams(calls.at(-1).init.body);
assert.equal(body.has('type'), false, 'legacy Connect type must not be sent');
assert.equal(body.get('controller[fees][payer]'), 'account');
assert.equal(body.get('controller[losses][payments]'), 'stripe');
assert.equal(body.get('controller[requirement_collection]'), 'stripe');
assert.equal(body.get('controller[stripe_dashboard][type]'), 'full');
await provider.createTopUpCheckout({ accountId:'acct_test', nodeId:'seed-east', userId:'u1', topupId:'t1', grossCents:1000, applicationFeeCents:150, successUrl:'https://seed-east.nodes.commonweave.earth/success', cancelUrl:'https://seed-east.nodes.commonweave.earth/cancel', idempotencyKey:'idem1' });
const checkout = calls.at(-1); body = new URLSearchParams(checkout.init.body);
assert.equal(checkout.init.headers.get('stripe-account'), 'acct_test');
assert.equal(body.get('payment_intent_data[application_fee_amount]'), '150');
assert.equal(body.get('line_items[0][price_data][unit_amount]'), '1000');
await provider.refundTopUp({ accountId:'acct_test', chargeId:'ch_test', amountCents:500, idempotencyKey:'refund1' });
body = new URLSearchParams(calls.at(-1).init.body);
assert.equal(body.get('refund_application_fee'), 'true');

const coreModule = await import(new URL('cloudflare/core/src/index.mjs', root));
const nodeModule = await import(new URL('cloudflare/node-cloud/src/index.mjs', root));
const normalized = coreModule.normalizeNodeRecord({ nodeId:'Seed East', publicOrigin:'https://seed-east.nodes.commonweave.earth', capabilities:['relay','relay','discovery'] });
assert.equal(normalized.nodeId, 'seed-east');
assert.deepEqual(normalized.capabilities, ['relay','discovery']);
const manifest = nodeModule.buildCloudNodeManifest('seed-east', { publicKey:'PUBLIC-TEST', keyId:'node-test' });
assert.equal(manifest.runtime, 'cloudflare-durable-object-v2');
assert.equal(manifest.security.stripePlatformSecretPresent, false);
assert.equal(manifest.security.cerbanimoSigningPrivateKeyPresent, false);

console.log(JSON.stringify({ ok:true, authority:'cloudflare-core', platformFeeBps:1500, canonicalMoneyEdge:LIVE_MONEY_EDGE, d1:true, r2:true, durableIdentity:true, wildcardNodes:true, directCharge:true, refundApplicationFee:true, hostNodeSecretsDistributed:false, liveMoneyDefault:false }, null, 2));
