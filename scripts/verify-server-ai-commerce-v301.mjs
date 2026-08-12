import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [version, router, settings, mesh, spine, cloudEntry, accountEdge, wrangler, offlineText] = await Promise.all([
  'VERSION',
  'public/app/server-ai-router-v301.js',
  'public/app/server-ai-settings-v301.js',
  'public/app/node-ai-mesh-v1.js',
  'public/app/fast-interactive-runtime-v192.js',
  'cloudflare/node-cloud/src/server-ai-entry-v1.mjs',
  'cloudflare/account-edge/src/index.mjs',
  'cloudflare/node-cloud/wrangler.jsonc',
  'public/app/offline-package-v208.json',
].map(read));

for (const source of [router, settings, mesh, spine]) new Function(source);
const offline = JSON.parse(offlineText);

assert.equal(version.trim(), '1.0.116');
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
for (const secret of ['STRIPE_SECRET_KEY','STRIPE_CONNECT_WEBHOOK_SECRET','CIVWEAVE_MONEY_EDGE_PRIVATE_KEY','NODE_FABRIC_OPERATOR_TOKEN']) {
  assert.ok(!router.includes(secret) && !settings.includes(secret), `Browser server AI surface must not reference ${secret}.`);
}

assert.match(mesh, /ensureServerAI/);
assert.ok(offline.assets.includes('/app/server-ai-router-v301.js'), 'Offline core must cache the server AI router control surface.');
assert.ok(offline.assets.includes('/app/server-ai-settings-v301.js'), 'Offline core must cache the server AI settings and commerce entry surface.');

assert.match(cloudEntry, /POST|request\.method === 'POST'/);
assert.match(cloudEntry, /\/api\/ai\/node\/generate/);
assert.match(cloudEntry, /\/api\/commerce\/options/);
assert.match(cloudEntry, /\/api\/commerce\/topup/);
assert.match(cloudEntry, /\/api\/commerce\/membership/);
assert.match(cloudEntry, /\/api\/money-edge\/topups/);
assert.match(cloudEntry, /\/api\/money-edge\/memberships/);
assert.match(cloudEntry, /\/usage\/reserve/);
assert.match(cloudEntry, /\/usage\/settle/);
assert.match(cloudEntry, /input\.allowLifetimeCredits === true/);
assert.match(cloudEntry, /@cf\/meta\/llama-3\.1-8b-instruct-fast/);
assert.match(cloudEntry, /x-civweave-node-signature/);

assert.match(accountEdge, /node-cloud\/src\/server-ai-entry-v1\.mjs/);
assert.match(wrangler, /"main": "src\/server-ai-entry-v1\.mjs"/);

console.log(JSON.stringify({
  ok: true,
  version: version.trim(),
  revision: 'server-ai-commerce-v301',
  routeOrder: ['device-local', 'server-local', 'cloudflare-workers-ai'],
  memberships: true,
  topups: true,
  cloudflareGeneration: true,
  localFailureFailover: true,
  incompleteLocalResultFailover: true,
  v271SpineCompatibility: true,
  offlineControlsCached: true,
  lifetimeCreditsRequireExplicitPermission: true,
}, null, 2));
