import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const parseJsonc = text => JSON.parse(text.split('\n').filter(line => !line.trim().startsWith('//')).join('\n'));
const LIVE_MONEY_EDGE = 'https://civweave-core.glaedn.workers.dev';
const LIVE_NODE_FABRIC = 'https://civweave-node-cloud.glaedn.workers.dev';

const [topologyText, transportsText, coreWranglerText, nodeWranglerText, coreSource, liveCoreSource, moneySource, membershipSource, composedMoneySource, stripeSource, nodeSource, capacitySource, migration1, migration2, migration3, migration4, bootstrapSource, envExample, guide, validationOptIn] = await Promise.all([
  read('config/launch-topology-v1.json'),
  read('config/host-node-transports-v1.json'),
  read('cloudflare/core/wrangler.template.jsonc'),
  read('cloudflare/node-cloud/wrangler.jsonc'),
  read('cloudflare/core/src/index.mjs'),
  read('cloudflare/core/src/live-entry.mjs'),
  read('cloudflare/core/src/money-edge.mjs'),
  read('cloudflare/core/src/membership-edge.mjs'),
  read('cloudflare/core/src/money-edge-with-memberships.mjs'),
  read('cloudflare/core/src/stripe-connect.mjs'),
  read('cloudflare/node-cloud/src/index.mjs'),
  read('cloudflare/node-cloud/src/capacity.mjs'),
  read('cloudflare/core/migrations/0001_core.sql'),
  read('cloudflare/core/migrations/0002_money_edge.sql'),
  read('cloudflare/core/migrations/0003_host_compute_economy.sql'),
  read('cloudflare/core/migrations/0004_membership_economy.sql'),
  read('lib/node-ai-bootstrap-v1.mjs'),
  read('.env.ai-wallet.example'),
  read('docs/operations/launch-kit-cloudflare-node-fabric-v1.md'),
  read('public/app/validation-cloud-optin-v1.js')
]);
const topology = JSON.parse(topologyText), transports = JSON.parse(transportsText);
const core = parseJsonc(coreWranglerText), node = parseJsonc(nodeWranglerText);

assert.equal(topology.platformFeeBps, 500);
assert.deepEqual(topology.economy.topup, {
  basis: 'net-service-after-processing',
  systemBps: 7000,
  hostBps: 2500,
  cerbanimoBps: 500,
  systemFundsCustody: 'cloudflare-core-platform-reserve'
});
assert.equal(topology.economy.membership.systemBps, 5000);
assert.equal(topology.economy.membership.hostBps, 2500);
assert.equal(topology.economy.membership.cerbanimoBps, 2500);
assert.equal(topology.backbone.moneyEdgeAuthority, true);
assert.equal(topology.backbone.publicApiOrigin, LIVE_MONEY_EDGE);
assert.equal(topology.cloudNodeFabric.publicFabricOrigin, LIVE_NODE_FABRIC);
assert.equal(topology.cloudNodeFabric.maxStarterHostsPerAccount, 3);
assert.equal(topology.transition.cloudflareMoneyEdgeAuthority, true);
assert.equal(topology.transition.renderIsAuthority, false);
assert.equal(topology.transition.renderMoneyEdgeEnabled, false);
assert.equal(topology.physicalNodeFabric.moneyEdgeUrl, LIVE_MONEY_EDGE);
assert.equal(transports.moneyEdgeAuthority, LIVE_MONEY_EDGE);

assert.equal(core.name, 'civweave-core');
assert.equal(core.workers_dev, true);
assert.equal(core.preview_urls, false);
assert.equal(core.vars.CIVWEAVE_PLATFORM_FEE_BPS, '500');
assert.equal(core.vars.CIVWEAVE_MONEY_LIVE_ENABLED, 'false');
assert.ok(core.d1_databases.some(x => x.binding === 'DB' && x.database_name === 'civweave-core'));
assert.ok(core.r2_buckets.some(x => x.binding === 'PACKAGES' && x.bucket_name === 'civweave-distribution'));
assert.ok(core.durable_objects.bindings.some(x => x.name === 'IDENTITY' && x.class_name === 'CivweaveCoreIdentity'));
assert.ok(core.triggers.crons.includes('*/5 * * * *'));
assert.equal(node.workers_dev, true);
assert.equal(node.preview_urls, false);
assert.equal(node.vars.PUBLIC_FABRIC_ORIGIN, LIVE_NODE_FABRIC);
assert.equal(node.vars.CIVWEAVE_WORKERS_PLAN, 'free');
assert.ok(node.durable_objects.bindings.some(x => x.name === 'NODES' && x.class_name === 'CivweaveCloudNode'));
assert.ok(node.durable_objects.bindings.some(x => x.name === 'CAPACITY' && x.class_name === 'CivweaveCapacityAccount'));
assert.ok(node.migrations.some(x => x.new_sqlite_classes?.includes('CivweaveCapacityAccount')));
assert.ok(node.services.some(x => x.binding === 'CORE' && x.service === 'civweave-core'));
for (const forbidden of ['STRIPE_SECRET_KEY', 'STRIPE_CONNECT_WEBHOOK_SECRET', 'CIVWEAVE_MONEY_EDGE_PRIVATE_KEY']) assert.ok(!JSON.stringify(node).includes(forbidden));

assert.ok(migration1.includes('CREATE TABLE IF NOT EXISTS stripe_events'));
assert.ok(migration2.includes('CREATE TABLE IF NOT EXISTS money_edge_topups'));
assert.ok(migration2.includes('CREATE TABLE IF NOT EXISTS money_edge_deliveries'));
assert.ok(migration3.includes('system_reserve_cents'));
assert.ok(migration3.includes('host_share_cents'));
assert.ok(migration3.includes('cerbanimo_share_cents'));
assert.ok(migration3.includes('stripe_transfer_id'));
assert.ok(migration4.includes('CREATE TABLE IF NOT EXISTS money_edge_memberships'));
assert.ok(migration4.includes('CREATE TABLE IF NOT EXISTS money_edge_membership_cycles'));
assert.ok(migration4.includes('monthly_lifetime_credits'));
assert.ok(coreSource.includes('/api/money-edge/memberships'));
assert.ok(coreSource.includes('money-edge-with-memberships.mjs'));
assert.ok(coreSource.includes('CivweaveCoreIdentity'));
assert.ok(liveCoreSource.includes('verified-public-https-origin-with-proof-of-key'));
assert.ok(liveCoreSource.includes('/api/money-edge/enrollment/start'));
assert.ok(liveCoreSource.includes('/api/money-edge/nodes/register'));
assert.ok(moneySource.includes("fundsModel: 'platform-reserve-separate-transfer'"));
assert.ok(moneySource.includes("split: '70-system-25-host-5-cerbanimo'"));
assert.ok(membershipSource.includes("split: '50-system-25-host-25-cerbanimo'"));
assert.ok(membershipSource.includes('minimumMembershipCreditBackingCents'));
assert.ok(composedMoneySource.includes("event.type === 'invoice.paid'"));
assert.ok(composedMoneySource.includes("event.type === 'customer.subscription.deleted'"));
assert.ok(stripeSource.includes('platform-reserve-separate-transfer'));
assert.ok(stripeSource.includes("mode: 'subscription'"));
assert.ok(stripeSource.includes("this.request('/v1/invoice_payments'"));
assert.ok(stripeSource.includes("this.request('/v1/transfers'"));
assert.ok(nodeSource.includes('/settlements/topup-adjustment'));
assert.ok(nodeSource.includes("event.type === 'membership.paid'"));
assert.ok(nodeSource.includes("event.type === 'membership.ended'"));
assert.ok(nodeSource.includes('verifyMoneyEdgeEvent'));
assert.ok(nodeSource.includes('/api/ai/node/live/challenge'));
assert.ok(nodeSource.includes('/api/ai/node/manifest'));
assert.ok(capacitySource.includes('starterPaidExpansionSeats: 9'));
assert.ok(capacitySource.includes('cloudflareFreeNeuronsPerDay: 10_000'));
assert.ok(capacitySource.includes('membershipSplitBps'));
assert.ok(capacitySource.includes('topupSplitBps'));
assert.ok(capacitySource.includes("billingStatus === 'free') billingStatus = 'grace'"));
assert.ok(validationOptIn.includes('civweave:validation-cloud-approved'));
assert.ok(validationOptIn.includes("allowLifetimeCredits:false"));
assert.ok(bootstrapSource.includes(`DEFAULT_CIVWEAVE_MONEY_EDGE_URL = '${LIVE_MONEY_EDGE}'`));
assert.ok(envExample.includes(`CIVWEAVE_MONEY_EDGE_URL=${LIVE_MONEY_EDGE}`));
assert.ok(guide.includes('Render is no longer a money-edge authority'));

for (const file of [
  'cloudflare/core/src/index.mjs',
  'cloudflare/core/src/live-entry.mjs',
  'cloudflare/core/src/money-edge.mjs',
  'cloudflare/core/src/membership-edge.mjs',
  'cloudflare/core/src/money-edge-with-memberships.mjs',
  'cloudflare/core/src/stripe-connect.mjs',
  'cloudflare/core/src/stripe-snapshot-webhook.mjs',
  'cloudflare/node-cloud/src/index.mjs',
  'cloudflare/node-cloud/src/capacity.mjs',
  'lib/node-ai-bootstrap-v1.mjs',
  'public/app/validation-cloud-optin-v1.js'
]) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, `${file} syntax failed: ${result.stderr || result.stdout}`);
}

const { StripeConnectWorkerProvider } = await import(new URL('cloudflare/core/src/stripe-connect.mjs', root));
const calls = [];
const fakeFetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  const target = String(url);
  if (target.endsWith('/v1/accounts')) return new Response(JSON.stringify({ id: 'acct_test' }), { status: 200, headers: {'content-type':'application/json'} });
  if (target.endsWith('/v1/account_links')) return new Response(JSON.stringify({ url: 'https://connect.stripe.test/onboard', expires_at: 2000000000 }), { status: 200, headers: {'content-type':'application/json'} });
  if (target.endsWith('/v1/checkout/sessions')) return new Response(JSON.stringify({ id: 'cs_test', url: 'https://checkout.stripe.test/cs_test' }), { status: 200, headers: {'content-type':'application/json'} });
  if (target.includes('/v1/invoice_payments?')) return new Response(JSON.stringify({ data: [{ id:'inpay_test', status:'paid', amount_paid:500, payment:{ type:'payment_intent', payment_intent:'pi_member' } }] }), { status: 200, headers: {'content-type':'application/json'} });
  if (target.includes('/v1/payment_intents/pi_member')) return new Response(JSON.stringify({ id:'pi_member', status:'succeeded', latest_charge:{ id:'ch_member', status:'succeeded', currency:'usd', balance_transaction:{ id:'txn_member', fee:45, net:455 } } }), { status: 200, headers: {'content-type':'application/json'} });
  if (target.endsWith('/v1/transfers')) return new Response(JSON.stringify({ id: 'tr_test', amount: 242 }), { status: 200, headers: {'content-type':'application/json'} });
  if (target.includes('/v1/transfers/tr_test/reversals')) return new Response(JSON.stringify({ id: 'trr_test', amount: 121 }), { status: 200, headers: {'content-type':'application/json'} });
  if (target.endsWith('/v1/refunds')) return new Response(JSON.stringify({ id: 're_test', status: 'succeeded' }), { status: 200, headers: {'content-type':'application/json'} });
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

await provider.createTopUpCheckout({ accountId:'acct_test', nodeId:'seed-east', userId:'u1', topupId:'t1', grossCents:1000, successUrl:'https://seed-east.nodes.commonweave.earth/success', cancelUrl:'https://seed-east.nodes.commonweave.earth/cancel', idempotencyKey:'idem1' });
const checkout = calls.at(-1); body = new URLSearchParams(checkout.init.body);
assert.equal(checkout.init.headers.has('stripe-account'), false, 'top-up customer charge must stay on the platform');
assert.equal(body.has('payment_intent_data[application_fee_amount]'), false);
assert.equal(body.get('metadata[civweave_host_account_id]'), 'acct_test');
assert.equal(body.get('line_items[0][price_data][unit_amount]'), '1000');

await provider.createMembershipCheckout({ accountId:'acct_test', nodeId:'seed-east', userId:'u1', tierId:'member', grossCents:500, monthlyLifetimeCredits:100000, successUrl:'https://seed-east.nodes.commonweave.earth/member-success', cancelUrl:'https://seed-east.nodes.commonweave.earth/member-cancel', idempotencyKey:'member1' });
const memberCheckout = calls.at(-1); body = new URLSearchParams(memberCheckout.init.body);
assert.equal(memberCheckout.init.headers.has('stripe-account'), false, 'membership charge must stay on the platform');
assert.equal(body.get('mode'), 'subscription');
assert.equal(body.get('line_items[0][price_data][recurring][interval]'), 'month');
assert.equal(body.get('line_items[0][price_data][unit_amount]'), '500');
assert.equal(body.get('subscription_data[metadata][civweave_tier_id]'), 'member');
assert.equal(body.get('subscription_data[metadata][civweave_host_account_id]'), 'acct_test');
assert.equal(body.get('subscription_data[metadata][civweave_monthly_lifetime_credits]'), '100000');

const verifiedMembership = await provider.verifyMembershipInvoice({
  invoice:{
    id:'in_member',status:'paid',amount_paid:500,currency:'usd',customer:'cus_member',
    parent:{type:'subscription_details',subscription_details:{subscription:'sub_member',metadata:{
      civweave_schema:'civweave.node-membership.v1',civweave_node_id:'seed-east',civweave_user_id:'u1',civweave_tier_id:'member',civweave_host_account_id:'acct_test',civweave_monthly_lifetime_credits:'100000'
    }}}
  },
  accountId:'acct_test',nodeId:'seed-east',userId:'u1',tierId:'member',monthlyLifetimeCredits:100000
});
assert.equal(verifiedMembership.processorFeeCents,45);
assert.equal(verifiedMembership.netCents,455);
assert.equal(verifiedMembership.chargeId,'ch_member');

await provider.createHostTransfer({ accountId:'acct_test', amountCents:242, sourceTransaction:'ch_test', transferGroup:'civweave-topup:t1', idempotencyKey:'host1' });
const transfer = calls.at(-1); body = new URLSearchParams(transfer.init.body);
assert.equal(transfer.init.headers.has('stripe-account'), false);
assert.equal(body.get('destination'), 'acct_test');
assert.equal(body.get('source_transaction'), 'ch_test');
assert.equal(body.get('amount'), '242');

await provider.reverseHostTransfer({ transferId:'tr_test', amountCents:121, idempotencyKey:'reverse1' });
body = new URLSearchParams(calls.at(-1).init.body);
assert.equal(body.get('amount'), '121');
await provider.refundTopUp({ chargeId:'ch_test', amountCents:500, idempotencyKey:'refund1' });
body = new URLSearchParams(calls.at(-1).init.body);
assert.equal(body.get('charge'), 'ch_test');
assert.equal(body.has('refund_application_fee'), false);
assert.equal(calls.at(-1).init.headers.has('stripe-account'), false);

const coreModule = await import(new URL('cloudflare/core/src/index.mjs', root));
const liveCoreModule = await import(new URL('cloudflare/core/src/live-entry.mjs', root));
const moneyModule = await import(new URL('cloudflare/core/src/money-edge.mjs', root));
const membershipModule = await import(new URL('cloudflare/core/src/membership-edge.mjs', root));
const nodeModule = await import(new URL('cloudflare/node-cloud/src/index.mjs', root));
const capacityModule = await import(new URL('cloudflare/node-cloud/src/capacity.mjs', root));
const normalized = coreModule.normalizeNodeRecord({ nodeId:'Seed East', publicOrigin:'https://seed-east.nodes.commonweave.earth', capabilities:['relay','relay','discovery'] });
assert.equal(normalized.nodeId, 'seed-east');
assert.deepEqual(normalized.capabilities, ['relay','discovery']);
assert.equal(coreModule.launchTopology.platformFeeBps, 500);
assert.deepEqual(moneyModule.splitTopupServiceNet(970), { serviceNetCents:970, systemReserveCents:679, hostShareCents:242, cerbanimoShareCents:49 });
assert.deepEqual(membershipModule.splitMembershipServiceNet(455), { serviceNetCents:455, systemReserveCents:227, hostShareCents:113, cerbanimoShareCents:115 });
assert.equal(membershipModule.minimumMembershipCreditBackingCents(100000),110);
assert.deepEqual(capacityModule.splitMembershipNetCents(500), { netCents:500, systemCents:250, hostCents:125, cerbanimoCents:125 });
assert.deepEqual(capacityModule.splitTopupNetCents(970), { netCents:970, systemCents:679, hostCents:242, cerbanimoCents:49 });
assert.deepEqual(Object.fromEntries(Object.entries(membershipModule.MEMBERSHIP_TIERS).map(([id,tier])=>[id,tier.monthlyLifetimeCredits])),Object.fromEntries(Object.entries(capacityModule.DEFAULT_MEMBERSHIP_TIERS).map(([id,tier])=>[id,tier.monthlyLifetimeCredits])));
const paidEmpty = capacityModule.deriveCapacity({ workersPlan:'paid', memberCount:18, communityMemberCount:18 });
assert.equal(paidEmpty.dailyCeilingNeurons, 10000);
assert.equal(paidEmpty.communitySeatLimit, 18);
assert.equal(liveCoreModule.normalizePublicNodeCallback('https://commonweave-host-node.onrender.com/app/node-ai-operator-v1.html'), 'https://commonweave-host-node.onrender.com');
assert.equal(liveCoreModule.normalizePublicNodeCallback('https://provider.example.org:443/path'), 'https://provider.example.org');
for (const rejected of ['http://provider.example.org','https://localhost','https://127.0.0.1','https://node.local','https://[::1]']) assert.throws(() => liveCoreModule.normalizePublicNodeCallback(rejected));
const manifest = nodeModule.buildCloudNodeManifest('seed-east', { publicKey:'PUBLIC-TEST', keyId:'node-test' });
assert.equal(manifest.runtime, 'cloudflare-durable-object-v2');
assert.equal(manifest.security.stripePlatformSecretPresent, false);
assert.equal(manifest.security.cerbanimoSigningPrivateKeyPresent, false);

console.log(JSON.stringify({
  ok:true,
  authority:'cloudflare-core',
  topupSplit:'70/25/5',
  membershipSplit:'50/25/25',
  recurringMemberships:true,
  canonicalMoneyEdge:LIVE_MONEY_EDGE,
  nodeFabric:LIVE_NODE_FABRIC,
  platformReserve:true,
  separateHostTransfers:true,
  refundTransferReversal:true,
  adaptiveCapacity:true,
  paidPlanWithoutFundingStillTenThousand:true,
  authenticatedMoneyEvents:true,
  cloudValidationOptIn:true,
  hostNodeSecretsDistributed:false,
  liveMoneyDefault:false
}, null, 2));
