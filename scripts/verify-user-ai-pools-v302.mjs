import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [cloudEntry, poolRouter, poolCapacity, accountEdge, wrangler] = await Promise.all([
  'cloudflare/node-cloud/src/server-ai-entry-v2.mjs',
  'cloudflare/node-cloud/src/user-ai-pool-router-v2.mjs',
  'cloudflare/node-cloud/src/capacity-user-pools-v2.mjs',
  'cloudflare/account-edge/src/index.mjs',
  'cloudflare/node-cloud/wrangler.jsonc',
].map(read));

assert.match(cloudEntry, /capacity-user-pools-v2\.mjs/);
assert.match(cloudEntry, /user-ai-pool-router-v2\.mjs/);
assert.match(cloudEntry, /chooseUserAiPoolRoute/);
assert.match(cloudEntry, /google\/gemini-3\.1-flash-lite/);
assert.match(cloudEntry, /ai-gateway-unified-billing/);
assert.match(cloudEntry, /workers-ai-free/);
assert.match(cloudEntry, /CIVWEAVE_AI_GATEWAY_ID/);
assert.match(cloudEntry, /gateway:\s*\{\s*id:/);
assert.match(cloudEntry, /\/usage\/reserve/);
assert.match(cloudEntry, /\/usage\/settle/);
assert.match(cloudEntry, /\/members\/status/);
assert.match(cloudEntry, /input\.allowLifetimeCredits === true/);
assert.match(cloudEntry, /@cf\/meta\/llama-3\.1-8b-instruct-fast/);

assert.match(poolRouter, /includedFits && sharedFreeFits/);
assert.match(poolRouter, /route: 'workers-ai-free'/);
assert.match(poolRouter, /route: 'workers-ai-paid-overage'/);
assert.match(poolRouter, /route: 'ai-gateway-unified-billing'/);
assert.match(poolRouter, /pool: 'lifetime'/);

assert.match(poolCapacity, /usage-v2:included/);
assert.match(poolCapacity, /usage-v2:total/);
assert.match(poolCapacity, /usage-v2:workers-free-total/);
assert.match(poolCapacity, /fundingSource === 'lifetime'/);
assert.match(poolCapacity, /billingRail === 'workers-ai-free'/);
assert.match(poolCapacity, /billingRail !== 'workers-ai-free'/);
assert.match(poolCapacity, /allowLifetimeCredits !== true/);

assert.match(accountEdge, /index-legacy-v1\.mjs/);
assert.match(accountEdge, /server-ai-entry-v2\.mjs/);
assert.match(accountEdge, /capacity-user-pools-v2\.mjs/);
assert.match(accountEdge, /legacyAccountEdge\.fetch/);

assert.match(wrangler, /"main": "src\/server-ai-entry-v2\.mjs"/);
assert.match(wrangler, /"CIVWEAVE_UNIFIED_BILLING_MODEL": "google\/gemini-3\.1-flash-lite"/);
assert.match(wrangler, /"CIVWEAVE_AI_GATEWAY_ID": "default"/);

console.log(JSON.stringify({
  ok: true,
  revision: 'user-ai-pools-v302',
  personalIncludedPoolGuard: true,
  sharedFreePoolSeparated: true,
  unifiedBillingFallback: true,
  accountEdgeDelegated: true,
}, null, 2));
