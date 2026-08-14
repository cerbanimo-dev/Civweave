import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [cloudEntry,poolRouter,poolCapacity,hostingCapacity,hostingNode,recoveryNode,hostedEntry,accountEdge,legacyAccountEdge,wrangler] = await Promise.all([
  'cloudflare/node-cloud/src/server-ai-entry-v2.mjs',
  'cloudflare/node-cloud/src/user-ai-pool-router-v2.mjs',
  'cloudflare/node-cloud/src/capacity-user-pools-v2.mjs',
  'cloudflare/node-cloud/src/capacity-hosting-plan-v1.mjs',
  'cloudflare/node-cloud/src/cloud-node-hosting-v1.mjs',
  'cloudflare/node-cloud/src/cloud-node-recovery-v1.mjs',
  'cloudflare/node-cloud/src/server-ai-entry-v4.mjs',
  'cloudflare/account-edge/src/index.mjs',
  'cloudflare/account-edge/src/index-legacy-v1.mjs',
  'cloudflare/node-cloud/wrangler.jsonc',
].map(read));

assert.match(cloudEntry,/capacity-user-pools-v2\.mjs/);
assert.match(cloudEntry,/user-ai-pool-router-v2\.mjs/);
assert.match(cloudEntry,/chooseUserAiPoolRoute/);
assert.match(cloudEntry,/google\/gemini-3\.1-flash-lite/);
assert.match(cloudEntry,/ai-gateway-unified-billing/);
assert.match(cloudEntry,/workers-ai-free/);
assert.match(cloudEntry,/CIVWEAVE_AI_GATEWAY_ID/);
assert.match(cloudEntry,/gateway:\s*\{\s*id:/);
assert.match(cloudEntry,/\/usage\/reserve/);
assert.match(cloudEntry,/\/usage\/settle/);
assert.match(cloudEntry,/\/members\/status/);
assert.match(cloudEntry,/input\.allowLifetimeCredits === true/);
assert.match(cloudEntry,/@cf\/meta\/llama-3\.1-8b-instruct-fast/);
assert.match(cloudEntry,/\/api\/commerce\/membership\/prejoin/,'Paid-seat membership prejoin must survive the compute-routing merge.');
assert.match(cloudEntry,/prepare-membership/,'Paid-seat preparation must survive the compute-routing merge.');

assert.match(poolRouter,/includedFits && sharedFreeFits/);
assert.match(poolRouter,/route: 'workers-ai-free'/);
assert.match(poolRouter,/route: 'workers-ai-paid-overage'/);
assert.match(poolRouter,/route: 'ai-gateway-unified-billing'/);
assert.match(poolRouter,/pool: 'lifetime'/);

assert.match(poolCapacity,/capacity-membership-resident-v1\.mjs/,'User-pool accounting must extend, not replace, paid membership residency.');
assert.match(poolCapacity,/usage-v2:included/);
assert.match(poolCapacity,/usage-v2:total/);
assert.match(poolCapacity,/usage-v2:workers-free-total/);
assert.match(poolCapacity,/fundingSource === 'lifetime'/);
assert.match(poolCapacity,/billingRail === 'workers-ai-free'/);
assert.match(poolCapacity,/billingRail !== 'workers-ai-free'/);
assert.match(poolCapacity,/allowLifetimeCredits !== true/);

assert.match(hostingCapacity,/freeMaxMembers:\s*28/);
assert.match(hostingCapacity,/hostedMaxMembers:\s*400/);
assert.match(hostingCapacity,/scaleThresholdMembers:\s*200/);
assert.match(hostingCapacity,/\/settlements\/hosting/);
assert.match(hostingNode,/hosting\.plan\.paid/);
assert.match(recoveryNode,/cloud-node-hosting-v1\.mjs/,'Recovery-aware Cloud Nodes must extend the canonical hosting node instead of replacing hosting behavior.');
assert.match(recoveryNode,/extends BaseCloudNode/,'Recovery-aware Cloud Nodes must preserve the hosting node inheritance chain.');
assert.match(hostedEntry,/capacity-hosting-plan-v1\.mjs/);
assert.match(hostedEntry,/cloud-node-recovery-v1\.mjs/,'The deployed v4 entry must expose the recovery-aware Cloud Node wrapper.');

assert.match(accountEdge,/index-legacy-v1\.mjs/);
assert.match(accountEdge,/server-ai-entry-v2\.mjs/);
assert.match(accountEdge,/capacity-user-pools-v2\.mjs/);
assert.match(accountEdge,/legacyAccountEdge\.fetch/);
assert.match(legacyAccountEdge,/central-money-edge-required/,'Legacy account-edge money authority guard must remain intact.');

assert.match(wrangler,/"main": "src\/server-ai-entry-v4\.mjs"/);
assert.match(wrangler,/"CIVWEAVE_UNIFIED_BILLING_MODEL": "google\/gemini-3\.1-flash-lite"/);
assert.match(wrangler,/"CIVWEAVE_AI_GATEWAY_ID": "default"/);
assert.match(wrangler,/"CIVWEAVE_CANONICAL_INSTALL_ORIGIN": "https:\/\/civweave\.cc"/);

console.log(JSON.stringify({ok:true,revision:'user-ai-pools-v302-membership-preserving-hosting-recovery-v1',personalIncludedPoolGuard:true,sharedFreePoolSeparated:true,unifiedBillingFallback:true,paidMembershipPreserved:true,hostedCapacity:true,recoveryAwareHosting:true,freeHostMaxMembers:28,hostedMaxMembers:400,accountEdgeDelegated:true},null,2));
