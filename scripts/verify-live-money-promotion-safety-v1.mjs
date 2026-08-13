import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const parseJsonc = text => JSON.parse(text.split('\n').filter(line => !line.trim().startsWith('//')).join('\n'));

const CORE_ORIGIN = 'https://civweave-core.cerbanimo.workers.dev';
const NODE_ORIGIN = 'https://civweave-node-cloud.cerbanimo.workers.dev';
const LEGACY_ACCOUNT_ORIGIN = 'glaedn.workers.dev';
const gates = [
  'CIVWEAVE_MONEY_LIVE_ENABLED',
  'CIVWEAVE_MONEY_EMERGENCY_STOP',
  'CIVWEAVE_MONEY_COMPLIANCE_APPROVED',
  'CIVWEAVE_MONEY_JURISDICTION_APPROVED',
  'CIVWEAVE_MONEY_KYC_AML_READY',
  'CIVWEAVE_MONEY_TAX_REPORTING_READY',
  'CIVWEAVE_MONEY_TERMS_APPROVED'
];

const [
  wranglerText,
  deployWorkflow,
  promoteWorkflow,
  emergencyWorkflow,
  preflight,
  liveEntry,
  topologyText,
  transportsText,
  nodeWranglerText,
  bootstrap,
  envExample,
  humanGate,
  snapshotHardening
] = await Promise.all([
  read('cloudflare/core/wrangler.template.jsonc'),
  read('.github/workflows/deploy-cloudflare-money-edge-v1.yml'),
  read('.github/workflows/promote-cloudflare-live-money-v1.yml'),
  read('.github/workflows/cloudflare-money-emergency-stop-v1.yml'),
  read('scripts/verify-stripe-live-readiness-preflight.mjs'),
  read('cloudflare/core/src/live-entry.mjs'),
  read('config/launch-topology-v1.json'),
  read('config/host-node-transports-v1.json'),
  read('cloudflare/node-cloud/wrangler.jsonc'),
  read('lib/node-ai-bootstrap-v1.mjs'),
  read('.env.ai-wallet.example'),
  read('docs/finance/live-money-human-gate.md'),
  read('scripts/verify-stripe-snapshot-webhook-hardening.mjs')
]);

const wrangler = parseJsonc(wranglerText);
const topology = JSON.parse(topologyText);
const transports = JSON.parse(transportsText);
const nodeWrangler = parseJsonc(nodeWranglerText);

assert.equal(wrangler.keep_vars, true, 'ordinary deployments must preserve remote live-money state');
for (const gate of gates) assert.equal(wrangler.vars?.[gate], undefined, `${gate} must not be a source-controlled default`);

assert.ok(deployWorkflow.includes('wrangler@latest deploy --keep-vars'), 'ordinary core deploy must preserve remote vars');
assert.ok(deployWorkflow.includes('Capture current payment activation state'));
assert.ok(deployWorkflow.includes('Confirm ordinary deploy preserved payment activation state'));
assert.ok(!deployWorkflow.includes('secrets.STRIPE_SECRET_KEY'), 'ordinary deploy must not import the sandbox/live Stripe secret from GitHub');
assert.ok(!deployWorkflow.includes('secret put STRIPE_SECRET_KEY'), 'ordinary deploy must not rewrite the active Stripe platform credential');
assert.ok(!deployWorkflow.includes('secret put STRIPE_CONNECT_WEBHOOK_SECRET'), 'ordinary deploy must not rewrite payment webhook credentials');
assert.ok(!deployWorkflow.includes('secret put STRIPE_CONNECT_THIN_WEBHOOK_SECRET'), 'ordinary deploy must not rewrite thin webhook credentials');

for (const secret of ['STRIPE_LIVE_SECRET_KEY','STRIPE_LIVE_CONNECT_WEBHOOK_SECRET','STRIPE_LIVE_CONNECT_THIN_WEBHOOK_SECRET']) {
  assert.ok(promoteWorkflow.includes(`secrets.${secret}`), `promotion workflow must require ${secret}`);
}
assert.ok(promoteWorkflow.includes("sk_live_*|rk_live_*"), 'promotion must reject non-live Stripe server credentials');
assert.ok(promoteWorkflow.includes('node scripts/verify-stripe-live-readiness-preflight.mjs'));
assert.ok(promoteWorkflow.includes('wait-for-money-edge-state-v1.mjs'), 'promotion must wait for semantic Worker propagation');
assert.ok(promoteWorkflow.includes('wrangler@latest deploy --keep-vars --config "$CONFIG"'), 'staged Stripe secrets must be published as one coherent Worker version');
assert.ok(promoteWorkflow.includes('--only-operational-blocker=live-money-disabled'), 'pre-enable verification must require live-money-disabled as the only blocker');
assert.ok(promoteWorkflow.includes("CONFIRMATION"));
assert.ok(promoteWorkflow.includes('ENABLE CIVWEAVE LIVE MONEY'));
assert.ok(promoteWorkflow.includes('restoring live switch to false'), 'promotion must fail closed if final verification fails');
assert.ok(promoteWorkflow.indexOf('CIVWEAVE_MONEY_LIVE_ENABLED": "false"') < promoteWorkflow.indexOf('CIVWEAVE_MONEY_LIVE_ENABLED": "true"'), 'promotion must stage gates while live money is off before the final switch');
for (const gate of gates.filter(gate => !['CIVWEAVE_MONEY_LIVE_ENABLED','CIVWEAVE_MONEY_EMERGENCY_STOP'].includes(gate))) {
  assert.ok(promoteWorkflow.includes(`${gate}": "true"`), `promotion must explicitly stage ${gate}`);
}

assert.ok(emergencyWorkflow.includes('CIVWEAVE_MONEY_EMERGENCY_STOP'));
assert.ok(emergencyWorkflow.includes('CLEAR CIVWEAVE EMERGENCY STOP'));
assert.ok(emergencyWorkflow.includes('liveReady remained true'));

assert.ok(preflight.includes(CORE_ORIGIN));
assert.ok(liveEntry.includes(`LIVE_CIVWEAVE_MONEY_EDGE_ORIGIN = '${CORE_ORIGIN}'`));
assert.ok(liveEntry.includes(`LIVE_CIVWEAVE_NODE_FABRIC_ORIGIN = '${NODE_ORIGIN}'`));
assert.equal(topology.backbone.publicApiOrigin, CORE_ORIGIN);
assert.equal(topology.cloudNodeFabric.publicFabricOrigin, NODE_ORIGIN);
assert.equal(topology.physicalNodeFabric.moneyEdgeUrl, CORE_ORIGIN);
assert.equal(transports.moneyEdgeAuthority, CORE_ORIGIN);
assert.equal(nodeWrangler.vars.PUBLIC_FABRIC_ORIGIN, NODE_ORIGIN);
assert.ok(bootstrap.includes(`DEFAULT_CIVWEAVE_MONEY_EDGE_URL = '${CORE_ORIGIN}'`));
assert.ok(envExample.includes(`CIVWEAVE_MONEY_EDGE_URL=${CORE_ORIGIN}`));
assert.ok(humanGate.includes(`${CORE_ORIGIN}/api/money-edge/webhooks/stripe`));
assert.ok(humanGate.includes(`${CORE_ORIGIN}/api/connect-demo/webhooks/stripe-thin`));
assert.ok(snapshotHardening.includes(`${CORE_ORIGIN}/api/money-edge/webhooks/stripe`));

for (const [name, text] of Object.entries({
  deployWorkflow,
  promoteWorkflow,
  emergencyWorkflow,
  preflight,
  liveEntry,
  topologyText,
  transportsText,
  nodeWranglerText,
  bootstrap,
  envExample,
  humanGate,
  snapshotHardening
})) {
  assert.equal(text.includes(LEGACY_ACCOUNT_ORIGIN), false, `${name} still references the retired Cloudflare account origin`);
}

console.log(JSON.stringify({
  ok: true,
  coreOrigin: CORE_ORIGIN,
  nodeOrigin: NODE_ORIGIN,
  ordinaryDeployPreservesLiveState: true,
  ordinaryDeployDoesNotRewriteStripeSecrets: true,
  liveCredentialsRequireDedicatedPromotion: true,
  liveCredentialPropagationIsSemantic: true,
  humanAttestationsRemainExplicit: true,
  enablementIsLastStep: true,
  failedPromotionRollsBackClosed: true,
  emergencyStopWorkflowPresent: true,
  retiredCloudflareAccountExcludedFromPaymentCriticalFiles: true
}, null, 2));
