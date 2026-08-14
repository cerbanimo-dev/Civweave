import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

import {
  needsBootstrap,
  parseWorkersDevUrl,
  starterNodeIds,
} from './provision-cloudflare-account-edge-v1.mjs';
import {
  accountNodePath,
  scopeAccountNodeHtml,
} from '../cloudflare/account-edge/src/index.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const parseJsonc = text => JSON.parse(text.split('\n').filter(line => !line.trim().startsWith('//')).join('\n'));

const [
  accountWorkerSource,
  legacyAccountWorkerSource,
  accountWranglerText,
  nodeFabricSource,
  capacitySource,
  setupSource,
  provisionSource,
  affinitySource,
  canonicalWorkflow,
  communityWorkflow,
  hostSetup,
] = await Promise.all([
  read('cloudflare/account-edge/src/index.mjs'),
  read('cloudflare/account-edge/src/index-legacy-v1.mjs'),
  read('cloudflare/account-edge/wrangler.jsonc'),
  read('cloudflare/node-cloud/src/index.mjs'),
  read('cloudflare/node-cloud/src/capacity.mjs'),
  read('scripts/setup-cloudflare-node.mjs'),
  read('scripts/provision-cloudflare-account-edge-v1.mjs'),
  read('scripts/verify-cloudflare-pages-account-target-v1.mjs'),
  read('.github/workflows/deploy-civweave-pages.yml'),
  read('.github/workflows/deploy-civweave-host-pages.yml'),
  read('public/host-setup.html'),
]);
const accountWrangler = parseJsonc(accountWranglerText);
const accountEdgeRuntimeSource = `${accountWorkerSource}\n${legacyAccountWorkerSource}`;

assert.deepEqual(starterNodeIds('Garden Club'), ['garden-club-a', 'garden-club-b', 'garden-club-c']);
assert.equal(starterNodeIds('civweave').length, 3);
assert.equal(needsBootstrap({ hostNodeIds: [] }), true);
assert.equal(needsBootstrap({ hostNodeIds: ['a', 'b'] }), true);
assert.equal(needsBootstrap({ hostNodeIds: ['a', 'b', 'c'] }), false);
assert.equal(
  parseWorkersDevUrl('Deployment complete! https://civweave-host-edge.example.workers.dev'),
  'https://civweave-host-edge.example.workers.dev',
);
assert.deepEqual(accountNodePath('/nodes/garden-a/api/node/health'), {
  nodeId: 'garden-a',
  pathname: '/api/node/health',
});
assert.equal(accountNodePath('/api/fabric/health'), null);

const sampleNodeHtml = '<a href="/api/ai/node/manifest">Manifest</a><a href="/api/ai/node/capacity">Capacity</a><a href="/api/node/health">Health</a>';
for (const nodeId of ['civweave-a', 'civweave-b', 'civweave-c']) {
  const origin = `https://civweave-host-edge.cerbanimo.workers.dev/nodes/${nodeId}`;
  const scoped = scopeAccountNodeHtml(sampleNodeHtml, origin);
  assert.ok(scoped.includes(`href="${origin}/api/ai/node/manifest"`));
  assert.ok(scoped.includes(`href="${origin}/api/ai/node/capacity"`));
  assert.ok(scoped.includes(`href="${origin}/api/node/health"`));
  assert.ok(!scoped.includes('href="/api/'));
}

assert.equal(accountWrangler.name, 'civweave-host-edge');
assert.equal(accountWrangler.workers_dev, true);
assert.equal(accountWrangler.preview_urls, false);
assert.equal(accountWrangler.vars.CIVWEAVE_WORKERS_PLAN, 'free');
assert.equal(accountWrangler.vars.CIVWEAVE_ACCOUNT_EDGE_MODE, 'path-v1');
assert.equal(accountWrangler.services, undefined, 'account edge must not bind the central core Worker');
assert.ok(accountWrangler.durable_objects.bindings.some(item => item.name === 'NODES' && item.class_name === 'CivweaveAccountNode'));
assert.ok(accountWrangler.durable_objects.bindings.some(item => item.name === 'CAPACITY' && item.class_name === 'CivweaveCapacityAccount'));
assert.ok(accountWrangler.migrations.some(item => item.new_sqlite_classes?.includes('CivweaveAccountNode')));
assert.ok(accountWrangler.migrations.some(item => item.new_sqlite_classes?.includes('CivweaveCapacityAccount')));
for (const forbidden of ['STRIPE_SECRET_KEY', 'STRIPE_CONNECT_WEBHOOK_SECRET', 'CIVWEAVE_MONEY_EDGE_PRIVATE_KEY', 'NODE_FABRIC_BINDING_TOKEN']) {
  assert.ok(!accountWranglerText.includes(forbidden), `account Worker config must not mention central secret ${forbidden}`);
}

assert.ok(capacitySource.includes('maxHostNodes: 3'));
assert.ok(capacitySource.includes('This account already has its three host nodes.'));
assert.ok(accountEdgeRuntimeSource.includes('CivweaveAccountNode extends CivweaveCloudNode'));
assert.ok(accountEdgeRuntimeSource.includes('x-civweave-account-edge-origin'));
assert.ok(accountEdgeRuntimeSource.includes('accountEdgePath: true'));
assert.ok(accountEdgeRuntimeSource.includes('scopeAccountNodeHtml'));
assert.ok(accountEdgeRuntimeSource.includes('central-money-edge-required'));
assert.ok(accountWorkerSource.includes('server-ai-entry-v2.mjs'), 'account edge must delegate generation to the per-user AI router');
assert.ok(accountWorkerSource.includes('legacyAccountEdge.fetch'), 'non-generation account-edge behavior must remain delegated to the established authority');
assert.ok(nodeFabricSource.includes("url.pathname === '/api/fabric/location'"));
assert.ok(nodeFabricSource.includes("url.pathname === '/internal/location'"));
assert.ok(nodeFabricSource.includes('civweave.hub-location-owner.v1'));
assert.ok(nodeFabricSource.includes('publicPrecision'), 'hub location precision mode must remain explicit');
assert.ok(nodeFabricSource.includes("['rounded', 'precise']"), 'hub location must support rounded and precise public modes');
assert.ok(nodeFabricSource.includes('coordinateDecimals = precise ? 6 : 3'), 'hub location precision must remain 6 decimals precise / 3 decimals rounded');
assert.ok(nodeFabricSource.includes('coordinateDecimals,'), 'hub location manifest must expose the selected coordinate precision');

assert.ok(setupSource.includes('Provisioning contract:'));
assert.ok(setupSource.includes('Worker + 3 starter Durable Object nodes'));
assert.ok(setupSource.includes('provision-cloudflare-account-edge-v1.mjs'));
assert.ok(setupSource.includes('--allow-partial'));
assert.ok(setupSource.includes('accountEdge,'));
assert.ok(setupSource.includes('pagesDeploymentMatchesProject'));

assert.ok(provisionSource.includes("const STARTER_NODE_COUNT = 3"));
assert.ok(provisionSource.includes("'secret', 'list'"));
assert.ok(provisionSource.includes("'secret', 'put', 'NODE_FABRIC_OPERATOR_TOKEN'"));
assert.ok(provisionSource.includes('operatorSecretRotated'));
assert.ok(provisionSource.includes('/api/fabric/nodes/'));
assert.ok(provisionSource.includes('/api/node/health'));
assert.ok(provisionSource.includes('/api/ai/node/manifest'));
assert.ok(provisionSource.includes("const WORKERS_PERMISSION = 'Account > Workers Scripts > Edit'"));
assert.ok(provisionSource.includes("capability: 'worker-plus-three-starter-nodes'"));
assert.ok(provisionSource.includes('requiredPermissions: [WORKERS_PERMISSION]'));
assert.ok(provisionSource.includes('retryCommand:'));

assert.ok(affinitySource.includes('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID'));
assert.ok(affinitySource.includes('.pages.dev'));
for (const workflow of [canonicalWorkflow, communityWorkflow]) {
  assert.ok(workflow.includes('verify-cloudflare-pages-account-target-v1.mjs'));
  assert.ok(workflow.includes('provision-cloudflare-account-edge-v1.mjs'));
  assert.ok(workflow.includes('--strict'));
  assert.ok(workflow.includes('continue-on-error: true'));
  assert.ok(workflow.includes("requiredPermissions: ['Account > Workers Scripts > Edit']"));
  assert.ok(workflow.includes('accountEdge,'));
  assert.ok(workflow.includes('Refusing a false-green deploy'));
}
assert.ok(!canonicalWorkflow.includes('Canonical Cloudflare account edge is not fully provisioned.'));
assert.ok(!communityWorkflow.includes('Community Cloudflare account edge is not fully provisioned.'));
assert.ok(canonicalWorkflow.includes('--host-id civweave'));
assert.ok(communityWorkflow.includes('CIVWEAVE_HOST_ID'));
assert.ok(communityWorkflow.includes('Verify stable community host origin'));
assert.ok(hostSetup.includes('id="edge-worker"'));
assert.ok(hostSetup.includes('id="edge-node-a"'));
assert.ok(hostSetup.includes('id="edge-node-b"'));
assert.ok(hostSetup.includes('id="edge-node-c"'));
assert.ok(hostSetup.includes('Account → Workers Scripts → Edit'));
assert.ok(hostSetup.includes('renderAccountEdge(meta)'));
assert.ok(hostSetup.includes('id="sync-location"'));
assert.ok(hostSetup.includes('navigator.geolocation.watchPosition'));
assert.ok(hostSetup.includes("position.coords.latitude.toFixed(3)"));

for (const file of [
  'cloudflare/account-edge/src/index.mjs',
  'cloudflare/account-edge/src/index-legacy-v1.mjs',
  'scripts/provision-cloudflare-account-edge-v1.mjs',
  'scripts/setup-cloudflare-node.mjs',
  'scripts/verify-cloudflare-pages-account-target-v1.mjs',
  'scripts/test-cloudflare-account-bootstrap-v1.mjs',
]) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: new URL('../', import.meta.url),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${file} syntax failed: ${result.stderr || result.stdout}`);
}

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.cloudflare-account-bootstrap.v1',
  starterNodesPerAccount: 3,
  accountWorker: 'civweave-host-edge',
  durableObjects: ['NODES:CivweaveAccountNode', 'CAPACITY:CivweaveCapacityAccount'],
  accountMoneyAuthority: false,
  composedAccountEdge: true,
  partialSetupBlocksPages: false,
  githubMainAccountAffinityRequired: true,
}, null, 2));
