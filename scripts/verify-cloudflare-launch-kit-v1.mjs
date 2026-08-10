import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const parseJsonc = text => JSON.parse(text.split('\n').filter(line => !line.trim().startsWith('//')).join('\n'));

const [
  topologyText,
  transportsText,
  rootWranglerText,
  coreWranglerText,
  nodeWranglerText,
  coreSource,
  nodeSource,
  migration,
  guide
] = await Promise.all([
  read('config/launch-topology-v1.json'),
  read('config/host-node-transports-v1.json'),
  read('wrangler.jsonc'),
  read('cloudflare/core/wrangler.template.jsonc'),
  read('cloudflare/node-cloud/wrangler.jsonc'),
  read('cloudflare/core/src/index.mjs'),
  read('cloudflare/node-cloud/src/index.mjs'),
  read('cloudflare/core/migrations/0001_core.sql'),
  read('docs/operations/launch-kit-cloudflare-node-fabric-v1.md')
]);

const topology = JSON.parse(topologyText);
const transports = JSON.parse(transportsText);
const rootWrangler = parseJsonc(rootWranglerText);
const coreWrangler = parseJsonc(coreWranglerText);
const nodeWrangler = parseJsonc(nodeWranglerText);

assert.equal(topology.schema, 'civweave.launch-topology.v1');
assert.equal(topology.platformFeeBps, 1500, 'Cerbanimo launch fee must be 15%');
assert.equal(topology.backbone.worker, 'civweave-core');
assert.equal(topology.cloudNodeFabric.worker, 'civweave-node-cloud');
assert.equal(topology.cloudNodeFabric.containsStripePlatformSecret, false);
assert.equal(topology.cloudNodeFabric.containsCerbanimoSigningPrivateKey, false);
assert.equal(topology.physicalNodeFabric.manualCerbanimoSecretsRequired, false);
assert.equal(topology.physicalNodeFabric.manualStripeSecretsRequired, false);
assert.equal(topology.transition.renderIsAuthority, false);
assert.equal(topology.transition.cloudflareMoneyEdgeLive, false);

assert.equal(rootWrangler.pages_build_output_dir, './.cloudflare-pages', 'existing canonical Pages build must stay intact');
assert.equal(coreWrangler.name, 'civweave-core');
assert.equal(coreWrangler.main, 'src/index.mjs');
assert.ok(coreWrangler.d1_databases?.some(binding => binding.binding === 'DB' && binding.database_name === 'civweave-core'));
assert.ok(coreWrangler.r2_buckets?.some(binding => binding.binding === 'PACKAGES' && binding.bucket_name === 'civweave-distribution'));
assert.equal(coreWrangler.vars.CIVWEAVE_PLATFORM_FEE_BPS, '1500');
assert.equal(coreWrangler.vars.CIVWEAVE_MONEY_LIVE_ENABLED, 'false');

assert.equal(nodeWrangler.name, 'civweave-node-cloud');
assert.ok(nodeWrangler.routes?.some(route => route.pattern === '*.nodes.commonweave.earth/*'));
assert.ok(nodeWrangler.routes?.some(route => route.pattern === 'nodes.commonweave.earth/*'));
assert.ok(nodeWrangler.durable_objects?.bindings?.some(binding => binding.name === 'NODES' && binding.class_name === 'CivweaveCloudNode'));
assert.ok(nodeWrangler.migrations?.some(item => item.new_sqlite_classes?.includes('CivweaveCloudNode')));
assert.ok(nodeWrangler.services?.some(binding => binding.binding === 'CORE' && binding.service === 'civweave-core'));
const parsedNodeConfig = JSON.stringify(nodeWrangler);
for (const forbidden of ['STRIPE_SECRET_KEY', 'STRIPE_CONNECT_WEBHOOK_SECRET', 'CIVWEAVE_MONEY_EDGE_PRIVATE_KEY']) {
  assert.ok(!parsedNodeConfig.includes(forbidden), `${forbidden} must not be bound to the node fabric`);
}

assert.ok(coreSource.includes('/api/stripe/webhook'));
assert.ok(coreSource.includes('verifyStripeWebhook'));
assert.ok(coreSource.includes('env.DB.prepare'));
assert.ok(coreSource.includes('env.PACKAGES.get'));
assert.ok(nodeSource.includes('export class CivweaveCloudNode'));
assert.ok(nodeSource.includes('new WebSocketPair()'));
assert.ok(nodeSource.includes('acceptWebSocket'));
assert.ok(nodeSource.includes('env.CORE.fetch'));
assert.ok(!nodeSource.includes('STRIPE_SECRET_KEY'));
assert.ok(!nodeSource.includes('CIVWEAVE_MONEY_EDGE_PRIVATE_KEY'));
assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS nodes'));
assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS stripe_events'));

assert.equal(transports.profiles['raspberry-pi-public'].transport, 'cloudflare-tunnel');
assert.equal(transports.profiles['raspberry-pi-public'].privateIdentity, 'generated-on-node');
assert.equal(transports.profiles['private-edge'].transport, 'cloudflare-relay-websocket');
for (const secret of transports.forbiddenOnCommunityNodes) assert.ok(transports.centralOnlySecrets.includes(secret) || secret === 'CIVWEAVE_MONEY_EDGE_PRIVATE_KEY');

assert.ok(guide.includes('Cloudflare Tunnel'));
assert.ok(guide.includes('one SQLite-backed Durable Object per cloud node'));
assert.ok(guide.includes('Cloudflare money-edge live mode is not enabled'));
assert.ok(guide.includes('1500'));

for (const file of ['cloudflare/core/src/index.mjs', 'cloudflare/node-cloud/src/index.mjs']) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, `${file} syntax failed: ${result.stderr || result.stdout}`);
}

const coreModule = await import(new URL('cloudflare/core/src/index.mjs', root));
const nodeModule = await import(new URL('cloudflare/node-cloud/src/index.mjs', root));
const normalized = coreModule.normalizeNodeRecord({ nodeId: 'Seed East', publicOrigin: 'https://seed-east.nodes.commonweave.earth', capabilities: ['relay', 'relay', 'discovery'] });
assert.equal(normalized.nodeId, 'seed-east');
assert.deepEqual(normalized.capabilities, ['relay', 'discovery']);
assert.equal(nodeModule.nodeIdFromHostname('seed-east.nodes.commonweave.earth'), 'seed-east');
assert.equal(nodeModule.nodeIdFromHostname('nodes.commonweave.earth'), null);
const cloudManifest = nodeModule.buildCloudNodeManifest('seed-east', { displayName: 'Seed East' });
assert.equal(cloudManifest.runtime, 'cloudflare-durable-object-v1');
assert.equal(cloudManifest.publicOrigin, 'https://seed-east.nodes.commonweave.earth');
assert.equal(cloudManifest.security.stripePlatformSecretPresent, false);
assert.equal(cloudManifest.security.cerbanimoSigningPrivateKeyPresent, false);

console.log(JSON.stringify({
  ok: true,
  schema: topology.schema,
  platformFeeBps: topology.platformFeeBps,
  canonicalPagesPreserved: true,
  coreWorker: coreWrangler.name,
  nodeFabricWorker: nodeWrangler.name,
  wildcardNodeRoute: true,
  durableObjectPerNode: true,
  raspberryPiTunnel: true,
  communitySecretsDistributed: false,
  cloudflareMoneyEdgeLive: false,
  moduleContractsExercised: true
}, null, 2));
