import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [strip, router, loader] = await Promise.all([
  'public/app/minilm-decision-strip-v1.js',
  'public/app/server-ai-router-v301.js',
  'public/app/shared-guide-surface-v236.js',
].map(read));

for (const source of [strip, router, loader]) new Function(source);

assert.match(strip, /1\.3\.0-minilm-decision-strip-guild-resolver-telemetry/);
assert.match(strip, /civweave\.mobile-guild\.v1/);
assert.match(strip, /mobileGuildCapacitySession/);
assert.match(strip, /guildContext\(\)/);
assert.match(strip, /kind:'mobile-guild-state'/);
assert.match(strip, /guildTelemetry/);
assert.match(strip, /neurons syncing/);
assert.match(strip, /conversations syncing/);
assert.match(strip, /trackerPlacement:'same-horizontal-strip'/);
assert.match(strip, /routerSelfHeal:true/);
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

assert.match(loader, /server-ai-router-v301\.js\?v=1\.0\.121-guild-telemetry/);
assert.match(loader, /minilm-decision-strip-v1\.js\?v=1\.3\.0-guild-resolver-telemetry/);
assert.match(loader, /routeDecisionStrip:'v1\.3-guild-resolver-telemetry'/);
assert.match(loader, /serverAIRouter:'v301-guild-telemetry'/);

console.log('Guild neuron/conversation strip regression checks passed.');
