import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  version,
  cloudEntry,
  poolRouter,
  poolCapacity,
  hostingCapacity,
  hostingNode,
  recoveryNode,
  recoveryNodeV2,
  accountDirectory,
  cloudEntryV4,
  cloudEntryV5,
  cloudEntryV6,
  cloudEntryV7,
  guildkeeperCapacity,
  capacityExtension,
  accountEdge,
  legacyAccountEdge,
  accountRuntime,
  wrangler,
] = await Promise.all([
  'VERSION',
  'cloudflare/node-cloud/src/server-ai-entry-v2.mjs',
  'cloudflare/node-cloud/src/user-ai-pool-router-v2.mjs',
  'cloudflare/node-cloud/src/capacity-user-pools-v2.mjs',
  'cloudflare/node-cloud/src/capacity-hosting-plan-v1.mjs',
  'cloudflare/node-cloud/src/cloud-node-hosting-v1.mjs',
  'cloudflare/node-cloud/src/cloud-node-recovery-v1.mjs',
  'cloudflare/node-cloud/src/cloud-node-recovery-v2.mjs',
  'cloudflare/node-cloud/src/account-directory-v1.mjs',
  'cloudflare/node-cloud/src/server-ai-entry-v4.mjs',
  'cloudflare/node-cloud/src/server-ai-entry-v5.mjs',
  'cloudflare/node-cloud/src/server-ai-entry-v6.mjs',
  'cloudflare/node-cloud/src/server-ai-entry-v7.mjs',
  'cloudflare/node-cloud/src/capacity-guildkeeper-v1.mjs',
  'cloudflare/account-edge/src/capacity-extension.mjs',
  'cloudflare/account-edge/src/index.mjs',
  'cloudflare/account-edge/src/index-legacy-v1.mjs',
  'cloudflare/account-edge/src/account-runtime.mjs',
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
assert.match(cloudEntry, /\/api\/commerce\/membership\/prejoin/);
assert.match(cloudEntry, /prepare-membership/);

assert.match(poolRouter, /includedFits && sharedFreeFits/);
assert.match(poolRouter, /route: 'workers-ai-free'/);
assert.match(poolRouter, /route: 'workers-ai-paid-overage'/);
assert.match(poolRouter, /route: 'ai-gateway-unified-billing'/);
assert.match(poolRouter, /pool: 'lifetime'/);

assert.match(poolCapacity, /capacity-membership-resident-v1\.mjs/);
assert.match(poolCapacity, /usage-v2:included/);
assert.match(poolCapacity, /usage-v2:total/);
assert.match(poolCapacity, /usage-v2:workers-free-total/);
assert.match(poolCapacity, /fundingSource === 'lifetime'/);
assert.match(poolCapacity, /billingRail === 'workers-ai-free'/);
assert.match(poolCapacity, /billingRail !== 'workers-ai-free'/);
assert.match(poolCapacity, /allowLifetimeCredits !== true/);

assert.match(cloudEntryV4, /capacity-hosting-plan-v1\.mjs/);
assert.match(cloudEntryV4, /cloud-node-recovery-v1\.mjs/);
assert.match(cloudEntryV5, /server-ai-entry-v4\.mjs/);
assert.match(cloudEntryV5, /cloud-node-recovery-v2\.mjs/);
assert.match(cloudEntryV5, /account-directory-v1\.mjs/);
assert.match(cloudEntryV6, /server-ai-entry-v5\.mjs/);
assert.match(cloudEntryV6, /capacity-guildkeeper-v1\.mjs/);
assert.match(cloudEntryV6, /\/api\/fabric\/capacity\/guildkeepers/);
assert.match(cloudEntryV7, /server-ai-entry-v6\.mjs/);
assert.match(cloudEntryV7, /CivweaveCloudNode extends BaseCloudNode/);
assert.ok(cloudEntryV7.includes("url.pathname==='/api/chat/channel-key'"));
assert.ok(cloudEntryV7.includes("url.pathname==='/api/chat/envelopes'"));
assert.match(cloudEntryV7, /authenticatedMember/);
assert.match(cloudEntryV7, /humanGroupKey/);
assert.match(cloudEntryV7, /humanGroupEnvelopes/);
assert.match(guildkeeperCapacity, /membersPerGuildkeeper/);
assert.match(guildkeeperCapacity, /GUILDKEEPER_EXPANSION_REQUIRED/);
assert.match(guildkeeperCapacity, /splitGuildkeeperEarnings/);
assert.match(recoveryNode, /cloud-node-hosting-v1\.mjs/);
assert.match(recoveryNode, /HubAccountRecoveryOfflineService/);
assert.match(recoveryNodeV2, /cloud-node-recovery-v1\.mjs/);
assert.match(accountDirectory, /ACCOUNT_DIRECTORY/);
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
assert.match(wrangler, /"main": "src\/server-ai-entry-v7\.mjs"/);
assert.match(wrangler, /"CIVWEAVE_UNIFIED_BILLING_MODEL": "google\/gemini-3\.1-flash-lite"/);
assert.match(wrangler, /"CIVWEAVE_CANONICAL_INSTALL_ORIGIN": "https:\/\/civweave\.cc"/);

console.log(JSON.stringify({
  ok: true,
  version: version.trim(),
  revision: 'server-ai-commerce-v301-composed-user-pools-community-dividend-hosting-recovery-directory-guildkeepers-human-group-relay-v1',
  routeOrder: ['device-local', 'server-local', 'cloudflare-workers-ai'],
  memberships: true,
  topups: true,
  communityTopupMinimumPercent: 1,
  communityTopupMaximumPercent: 5,
  nodeEqualTopups: true,
  cloudflareGeneration: true,
  perUserPoolRouting: true,
  hostedCapacity: true,
  guildkeeperGovernance: true,
  guildkeeperMembersPerKeeper: 28,
  humanGroupRelay: true,
  authenticatedGuildChatKeys: true,
  recoveryComposition: true,
  accountDirectoryComposition: true,
  freeHostMaxMembers: 28,
  hostedMaxMembers: 400,
}, null, 2));
