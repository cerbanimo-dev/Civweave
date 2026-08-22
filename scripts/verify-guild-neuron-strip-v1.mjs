import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [strip, router, loader, chatRepair, worker, usage, hostSession, systemRoutes, localCapacity, campus] = await Promise.all([
  'public/app/minilm-decision-strip-v1.js',
  'public/app/server-ai-router-v301.js',
  'public/app/shared-guide-surface-v236.js',
  'public/service-worker-chat-repair-v245.js',
  'public/service-worker-v203.js',
  'public/app/guild-chat-usage-v1.js',
  'public/app/host-node-session-v1.js',
  'public/app/system-routes-v227.js',
  'public/app/host-node-local-capacity-v1.js',
  'public/app/working-campus-v440.html',
].map(read));

for (const source of [strip, router, loader, chatRepair, worker, usage, hostSession, systemRoutes, localCapacity]) new Function(source);

assert.match(strip, /1\.3\.1-minilm-decision-strip-live-guild-balance/);
assert.match(strip, /civweave\.mobile-guild\.v1/);
assert.match(strip, /civweave\.host-capacity\.sessions\.v1/);
assert.match(strip, /mobileGuildCapacitySession/);
assert.match(strip, /function joinedCapacitySession/);
assert.match(strip, /kind:'joined-guild-capacity'/);
assert.match(strip, /kind:'human-chat-guild-context'/);
assert.match(strip, /kind:'mobile-guild-state'/);
assert.match(strip, /function sharedUsageSnapshot/);
assert.match(strip, /CivweaveGuildChatUsageV1\?\.snapshot/);
assert.match(strip, /function requestGuildUsageRefresh/);
assert.match(strip, /ensureBalanceRuntime/);
assert.match(strip, /1\.0\.137-mobile-guild-quota/);
assert.match(strip, /1\.0\.2-mobile-session-upgrade/);
assert.match(strip, /guildTelemetry/);
assert.match(strip, /neurons syncing/);
assert.match(strip, /conversations syncing/);
assert.match(strip, /trackerPlacement:'same-horizontal-strip'/);
assert.match(strip, /host-or-joined-or-mobile-capacity-or-human-context/);
assert.match(strip, /balanceRuntimeSelfHeal:true/);
assert.match(strip, /1\.0\.121-guild-telemetry/);

assert.match(router, /1\.0\.121-server-ai-router-v301-guild-telemetry/);
assert.match(router, /civweave\.guild-ai-telemetry\.v1/);
assert.match(router, /function recordGuildUsage/);
assert.match(router, /includedRemainingNeurons/);
assert.match(router, /civweave:guild-ai-telemetry/);
assert.match(router, /guildOwned\?recordGuildUsage\(session,body\)/);
assert.doesNotMatch(router, /guildOwned\?\{\}/);
assert.match(router, /guildTelemetry/);
assert.match(router, /approximateTurnsLeft/);

assert.match(hostSession, /1\.0\.137-host-node-session-v6-mobile-guild-session-upgrade/);
assert.match(hostSession, /const saved=credentialFor\(selected\.origin,\{nodeId:selected\.nodeId\}\),legacy=legacyGuildkeeperCredential/);
assert.match(hostSession, /createCredential:!saved&&Boolean\(legacy\)/);
assert.match(hostSession, /sessionFor\(selected\.nodeId\)\|\|sessionFor\(selected\.origin\)/);
assert.match(hostSession, /includedRemainingNeurons/);

assert.match(usage, /1\.0\.2-guild-chat-usage-v1-mobile-session-upgrade/);
assert.match(usage, /if\(!session&&api\.ensureSelected\)/);
assert.doesNotMatch(usage, /loginMode!=='legacy-mobile-selection'/);
assert.match(usage, /api\.status\(session\.nodeId\|\|session\.origin\|\|selected\.origin\)/);
assert.match(usage, /civweave:guild-chat-usage-refreshed/);

assert.match(loader, /1\.0\.179-shared-guide-surface-v236-live-guild-balance/);
assert.match(loader, /server-ai-router-v301\.js\?v=1\.0\.121-guild-telemetry/);
assert.match(loader, /minilm-decision-strip-v1\.js\?v=1\.3\.1-live-guild-balance/);
assert.match(loader, /routeDecisionStrip:'v1\.3\.1-live-guild-balance'/);
assert.match(loader, /serverAIRouter:'v301-guild-telemetry'/);

assert.match(systemRoutes, /const VERSION='1\.0\.167'/);
assert.match(systemRoutes, /guild-chat-usage-v1\.js\?v=1\.0\.2-mobile-session-upgrade/);
assert.match(systemRoutes, /GUILD_USAGE_VERSION='1\.0\.2-'/);
assert.match(systemRoutes, /civweaveGuildUsageRepair='v2'/);

assert.match(localCapacity, /host-node-local-capacity-v6-live-guild-quota/);
assert.match(localCapacity, /host-node-session-v1\.js\?v=1\.0\.137-mobile-guild-quota/);
assert.match(localCapacity, /SESSION_RUNTIME_VERSION = '1\.0\.137-'/);
assert.match(localCapacity, /repair=\$\{Date\.now\(\)\}/);

assert.match(chatRepair, /REVISION='guild-live-balance-v2'/);
for (const path of ['minilm-decision-strip-v1.js','server-ai-router-v301.js','guild-chat-usage-v1.js','host-node-session-v1.js','host-node-local-capacity-v1.js','system-routes-v227.js']) assert.ok(chatRepair.includes(path), `chat repair must purge ${path}`);
assert.match(chatRepair, /function purgeCriticalChatRuntimeCaches/);
assert.match(chatRepair, /activation-targeted-critical-purge-explicit-full-repair/);
assert.match(worker, /system-routes-v227\.js\?v=1\.0\.167-five-system-route-contract-v229-v440-home-live-guild-balance/);
assert.match(worker, /service-worker-chat-repair-v245\.js\?v=guild-live-balance-v2&purge=guild-live-balance-v2/);

assert.match(campus, /system-routes-v227\.js\?v=working-campus-v440-live-guild-balance-v1/);
assert.match(campus, /shared-guide-surface-v236\.js\?v=working-campus-v440-live-guild-balance-v1/);

console.log('Guild neuron/conversation live-balance regression checks passed.');
