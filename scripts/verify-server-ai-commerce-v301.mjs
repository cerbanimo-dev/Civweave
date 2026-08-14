import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [version, router, settings, mesh, spine, cloudEntryV1, cloudEntryV2, cloudEntryV3, cloudEntryV4, cloudEntryV5, capacityExtension, hostingCapacity, hostingNode, recoveryNode, accountEdge, legacyAccountEdge, wrangler, offlineText] = await Promise.all([
  'VERSION',
  'public/app/server-ai-router-v301.js',
  'public/app/server-ai-settings-v301.js',
  'public/app/node-ai-mesh-v1.js',
  'public/app/fast-interactive-runtime-v192.js',
  'cloudflare/node-cloud/src/server-ai-entry-v1.mjs',
  'cloudflare/node-cloud/src/server-ai-entry-v2.mjs',
  'cloudflare/node-cloud/src/server-ai-entry-v3.mjs',
  'cloudflare/node-cloud/src/server-ai-entry-v4.mjs',
  'cloudflare/node-cloud/src/server-ai-entry-v5.mjs',
  'cloudflare/node-cloud/src/capacity-community-extension-v1.mjs',
  'cloudflare/node-cloud/src/capacity-hosting-plan-v1.mjs',
  'cloudflare/node-cloud/src/cloud-node-hosting-v1.mjs',
  'cloudflare/node-cloud/src/cloud-node-recovery-v1.mjs',
  'cloudflare/account-edge/src/index.mjs',
  'cloudflare/account-edge/src/index-legacy-v1.mjs',
  'cloudflare/node-cloud/wrangler.jsonc',
  'public/app/offline-package-v208.json',
].map(read));

for (const source of [router, settings, mesh, spine]) new Function(source);
const offline = JSON.parse(offlineText);
const cloudRuntime = `${cloudEntryV1}\n${cloudEntryV2}\n${cloudEntryV3}\n${cloudEntryV4}\n${cloudEntryV5}\n${hostingCapacity}\n${hostingNode}\n${recoveryNode}`;
const accountRuntime = `${accountEdge}\n${legacyAccountEdge}`;

assert.match(version.trim(), /^\d+\.\d+\.\d+$/);
assert.match(router, /1\.0\.116-server-ai-router-v301/);
assert.match(settings, /1\.0\.117-server-ai-settings-v305-community-dividend/);
assert.match(mesh, /server-ai-router-v301\.js\?v=1\.0\.116-v301/);
assert.match(mesh, /server-ai-settings-v301\.js\?v=1\.0\.117-v305-community-dividend/);
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
assert.match(settings, /data-community-share-bps/);
assert.match(settings, /data-node-equal-topup/);
assert.match(settings, /Cloudflare top-ups always share at least 1% with everyone/);
assert.match(settings, /Every \$5\/month of active membership contributes \+2 potential free seats and a \+200 daily-neuron target for every member/);
assert.match(settings, /shareMode:equal\?'node-equal':'personal'/);
assert.match(settings, /shareBps,shareMode/);
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
assert.ok(offline.assets.includes('/app/host-node-session-v1.js'), 'Offline core must cache the canonical Hub Node session owner.');

assert.match(cloudRuntime, /POST|request\.method === 'POST'/);
assert.match(cloudRuntime, /\/api\/ai\/node\/generate/);
assert.match(cloudRuntime, /\/api\/commerce\/options/);
assert.match(cloudRuntime, /\/api\/commerce\/topup/);
assert.match(cloudRuntime, /\/api\/commerce\/membership/);
assert.match(cloudRuntime, /\/api\/money-edge\/topups/);
assert.match(cloudRuntime, /\/api\/money-edge\/memberships/);
assert.match(cloudRuntime, /\/usage\/reserve/);
assert.match(cloudRuntime, /\/usage\/settle/);
assert.match(cloudRuntime, /\/members\/status/);
assert.match(cloudRuntime, /quota: updatedStatus\.quota|quota: memberStatus\.quota/);
assert.match(cloudRuntime, /input\.allowLifetimeCredits === true/);
assert.match(cloudRuntime, /@cf\/meta\/llama-3\.1-8b-instruct-fast/);
assert.match(cloudRuntime, /x-civweave-node-signature/);
assert.match(cloudEntryV2, /chooseUserAiPoolRoute/);
assert.match(cloudEntryV2, /ai-gateway-unified-billing/);
assert.match(cloudEntryV2, /\/api\/commerce\/membership\/prejoin/);
assert.match(cloudEntryV3, /minimumCommunityShareBps:100/);
assert.match(cloudEntryV3, /maximumCommunityShareBps:500/);
assert.match(cloudEntryV3, /defaultCommunityShareBps:100/);
assert.match(cloudEntryV3, /node-equal/);
assert.match(cloudEntryV3, /\/topups\/share-preference/);
assert.match(cloudEntryV4, /capacity-hosting-plan-v1\.mjs/);
assert.match(cloudEntryV4, /cloud-node-recovery-v1\.mjs/);
assert.match(cloudEntryV5, /server-ai-entry-v4\.mjs/);
assert.match(cloudEntryV5, /cloud-node-recovery-v2\.mjs/);
assert.match(cloudEntryV5, /account-directory-v1\.mjs/);
assert.match(cloudEntryV5, /\/api\/account-directory\//);
assert.match(recoveryNode, /cloud-node-hosting-v1\.mjs/);
assert.match(recoveryNode, /HubAccountRecoveryOfflineService/);
assert.match(hostingCapacity, /freeMaxMembers:\s*28/);
assert.match(hostingCapacity, /hostedMaxMembers:\s*400/);
assert.match(hostingCapacity, /scaleThresholdMembers:\s*200/);
assert.match(hostingNode, /hosting\.plan\.paid/);
assert.match(capacityExtension, /topup-sharing:/);
assert.match(capacityExtension, /communityTopupReserveMicrocents/);
assert.match(capacityExtension, /activePendingPaidCount/);

assert.match(accountEdge, /server-ai-entry-v2\.mjs/);
assert.match(accountEdge, /legacyAccountEdge\.fetch/);
assert.match(legacyAccountEdge, /server-ai-entry-v1\.mjs/);
assert.match(accountRuntime, /central-money-edge-required/);
assert.match(wrangler, /"main": "src\/server-ai-entry-v5\.mjs"/);
assert.match(wrangler, /"CIVWEAVE_UNIFIED_BILLING_MODEL": "google\/gemini-3\.1-flash-lite"/);
assert.match(wrangler, /"CIVWEAVE_CANONICAL_INSTALL_ORIGIN": "https:\/\/civweave\.cc"/);

console.log(JSON.stringify({
  ok: true,
  version: version.trim(),
  revision: 'server-ai-commerce-v301-composed-user-pools-community-dividend-hosting-recovery-directory-v2',
  routeOrder: ['device-local', 'server-local', 'cloudflare-workers-ai'],
  memberships: true,
  topups: true,
  communityTopupMinimumPercent: 1,
  communityTopupMaximumPercent: 5,
  nodeEqualTopups: true,
  cloudflareGeneration: true,
  perUserPoolRouting: true,
  hostedCapacity: true,
  recoveryComposition: true,
  accountDirectoryComposition: true,
  freeHostMaxMembers: 28,
  hostedMaxMembers: 400,
  accountMoneyAuthorityPreserved: true,
  localFailureFailover: true,
  incompleteLocalResultFailover: true,
  v271SpineCompatibility: true,
  offlineControlsCached: true,
  lifetimeCreditsRequireExplicitPermission: true,
}, null, 2));
