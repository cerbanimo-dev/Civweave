import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [version, router, settings, mesh, spine, cloudLegacy, cloudEntry, poolRouter, poolCapacity, accountEdge, wrangler, offlineText] = await Promise.all([
  'VERSION',
  'public/app/server-ai-router-v301.js',
  'public/app/server-ai-settings-v301.js',
  'public/app/node-ai-mesh-v1.js',
  'public/app/fast-interactive-runtime-v192.js',
  'cloudflare/node-cloud/src/server-ai-entry-v1.mjs',
  'cloudflare/node-cloud/src/server-ai-entry-v2.mjs',
  'cloudflare/node-cloud/src/user-ai-pool-router-v2.mjs',
  'cloudflare/node-cloud/src/capacity-user-pools-v2.mjs',
  'cloudflare/account-edge/src/index.mjs',
  'cloudflare/node-cloud/wrangler.jsonc',
  'public/app/offline-package-v208.json',
].map(read));

for (const source of [router, settings, mesh, spine]) new Function(source);
const offline = JSON.parse(offlineText);

assert.match(version.trim(), /^\d+\.\d+\.\d+$/);
assert.match(router, /1\.0\.116-server-ai-router-v301/);
assert.match(settings, /1\.0\.116-server-ai-settings-v304-tabbed/);
assert.match(mesh, /server-ai-router-v301\.js\?v=1\.0\.116-v301/);
assert.match(mesh, /server-ai-settings-v301\.js\?v=1\.0\.116-v304-tabbed/);
assert.match(router, /const ROUTE='server-auto'/);
assert.match(router, /\['device-local','server-local','cloudflare-workers-ai'\]/);
assert.match(router, /s\.register\(MIDDLEWARE_ID,\{handle\},60\)/);
assert.match(router, /localServerService\(candidate\)/);
assert.match(router, /CivweaveNodeAIMeshV1/);
assert.match(router, /\/api\/ai\/node\/generate/);
assert.match(router, /allowLifetimeCredits===true/);
assert.doesNotMatch(router, /allowLifetimeCredits\s*:\s*true/);
assert.match(router, /Open AI settings to add compute or choose a membership/);
assert.match(router, /CivweaveHostNodeSessionV1/);
assert.match(router, /recordUsage/);
assert.match(router, /approximateTurnsLeft/);

assert.match(spine, /1\.0\.116-runtime-spine-v271-server-auto-v301/);
assert.match(spine, /serverAuto\(request\)/);
assert.match(spine, /function localResultNeedsFailover/);
assert.match(spine, /completionValidation\?\.valid===false/);
assert.match(spine, /completionValidation\?\.clipped===true/);
assert.match(spine, /structured\?\.requested===true&&result\.structured\?\.valid===false/);
assert.match(spine, /\^downloaded-local/);
assert.match(spine, /local-result-incomplete/);
assert.match(spine, /civweave:runtime-spine-failover/);
assert.match(spine, /to:'server-auto-v301'/);

assert.match(settings, /Server-side AI · local → host → Cloudflare/);
assert.match(settings, /data-compute-buy/);
assert.match(settings, /data-membership-buy/);
assert.match(settings, /\/api\/commerce\/topup/);
assert.match(settings, /\/api\/commerce\/membership/);
assert.match(settings, /\/api\/ai\/node\/live\/topups/);
assert.match(settings, /Membership & compute/);
for (const tab of ['general','local-models','membership']) assert.ok(settings.includes(`data-settings-tab="${tab}"`));
assert.doesNotMatch(settings, /insertAdjacentElement\('afterend',button\)/);

assert.match(mesh, /ensureServerAI/);
assert.ok(offline.assets.includes('/app/server-ai-router-v301.js'), 'Offline core must cache the server AI router control surface.');
assert.ok(offline.assets.includes('/app/server-ai-settings-v301.js'), 'Offline core must cache the server AI settings and commerce entry surface.');
assert.ok(offline.assets.includes('/app/host-node-session-v1.js'), 'Offline core must cache the canonical Hub Node session owner.');

for (const path of ['/api/commerce/options', '/api/commerce/topup', '/api/commerce/membership', '/api/money-edge/topups', '/api/money-edge/memberships']) {
  assert.ok(cloudLegacy.includes(path), `Legacy commerce boundary must retain ${path}.`);
}
assert.match(cloudLegacy, /x-civweave-node-signature/);

assert.match(cloudEntry, /chooseUserAiPoolRoute/);
assert.match(cloudEntry, /google\/gemini-3\.1-flash-lite/);
assert.match(cloudEntry, /ai-gateway-unified-billing/);
assert.match(cloudEntry, /workers-ai-free/);
assert.match(cloudEntry, /workers-ai-paid-overage/);
assert.match(cloudEntry, /CIVWEAVE_AI_GATEWAY_ID/);
assert.match(cloudEntry, /gateway:\s*\{\s*id:/);
assert.match(cloudEntry, /\/usage\/reserve/);
assert.match(cloudEntry, /\/usage\/settle/);
assert.match(cloudEntry, /\/members\/status/);
assert.match(cloudEntry, /input\.allowLifetimeCredits === true/);
assert.match(cloudEntry, /@cf\/meta\/llama-3\.1-8b-instruct-fast/);

assert.match(poolRouter, /includedFits && sharedFreeFits/);
assert.match(poolRouter, /route: 'ai-gateway-unified-billing'/);
assert.match(poolRouter, /pool: 'lifetime'/);
assert.match(poolCapacity, /usage-v2:included/);
assert.match(poolCapacity, /usage-v2:workers-free-total/);
assert.match(poolCapacity, /fundingSource === 'lifetime'/);
assert.match(poolCapacity, /billingRail === 'workers-ai-free'/);
assert.match(poolCapacity, /billingRail !== 'workers-ai-free'/);

assert.match(accountEdge, /server-ai-entry-v2\.mjs/);
assert.match(accountEdge, /capacity-user-pools-v2\.mjs/);
assert.match(wrangler, /"main": "src\/server-ai-entry-v2\.mjs"/);

console.log(JSON.stringify({
  ok: true,
  version: version.trim(),
  revision: 'server-ai-commerce-v301-user-pools-v2',
  routeOrder: ['device-local', 'server-local', 'cloudflare-user-pool-router'],
  memberships: true,
  topups: true,
  cloudflareGeneration: true,
  personalIncludedPoolGuard: true,
  unifiedBillingFallback: true,
  lifetimeCreditsRequireExplicitPermission: true,
}, null, 2));