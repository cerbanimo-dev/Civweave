import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [version, router, settings, mesh, spine, assistant, familyLoader, knowledgeBridge, deterministicMode, settingsController, settingsRepair, deviceCredentials, cloudEntry, fabricEntry, modelRouter, accountEdge, wrangler, offlineText] = await Promise.all([
  'VERSION',
  'public/app/server-ai-router-v301.js',
  'public/app/server-ai-settings-v301.js',
  'public/app/node-ai-mesh-v1.js',
  'public/app/fast-interactive-runtime-v192.js',
  'public/app/assistant-runtime-v141.js',
  'public/app/family-ai-loader-v105.js',
  'public/app/knowledge-encyclopedia-bridge-v271.js',
  'public/app/deterministic-mode-v175.js',
  'public/app/model-settings-controller-v173.js',
  'public/app/ai-settings-device-repair-v229.js',
  'public/app/device-credential-persistence-v211.js',
  'cloudflare/node-cloud/src/server-ai-entry-v1.mjs',
  'cloudflare/node-cloud/src/entry.mjs',
  'cloudflare/node-cloud/src/model-router-v1.mjs',
  'cloudflare/account-edge/src/index.mjs',
  'cloudflare/node-cloud/wrangler.jsonc',
  'public/app/offline-package-v208.json',
].map(read));

for (const source of [router, settings, mesh, spine]) new Function(source);
const offline = JSON.parse(offlineText);

assert.match(version.trim(), /^\d+\.\d+\.\d+$/);
assert.match(router, /server-ai-router-v303-public-capacity/);
assert.match(settings, /server-ai-settings-v306-lazy-local-model-tab/);
assert.ok(mesh.includes(`server-ai-router-v301.js?v=${version.trim()}-v303-public-capacity`));
assert.ok(mesh.includes(`server-ai-settings-v301.js?v=${version.trim()}-v306-lazy-local-model-tab`));
assert.match(router, /const ROUTE='server-auto'/);
assert.match(router, /\['device-local','server-local','cloudflare-workers-ai'\]/);
assert.match(router, /s\.register\(MIDDLEWARE_ID,\{handle\},60\)/);
assert.match(router, /localServerService\(candidate\)/);
assert.match(router, /CivweaveNodeAIMeshV1/);
assert.match(router, /\/api\/ai\/node\/generate/);
assert.match(router, /allowLifetimeCredits===true/);
assert.doesNotMatch(router, /allowLifetimeCredits\s*:\s*true/);
assert.match(router, /Open AI settings to add compute or choose a membership/);
assert.match(router, /capabilityRequirements/);
assert.match(router, /task:clone\(request\.task/);
assert.match(router, /Approve Kimi once/);
assert.match(router, /modelTierCeiling:'smart'/);
assert.match(router, /ensureCapacitySession/);
assert.match(router, /PUBLIC_FABRIC_ORIGIN='https:\/\/civweave-node-cloud\.cerbanimo\.workers\.dev'/);
assert.match(router, /'x-civweave-node-id':session\.nodeId/);

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
assert.match(assistant, /'server-auto'\]\.includes\(v\)\?v:'bundled'/);
assert.match(assistant, /function taskMetadata\(ctx\)/);
assert.match(assistant, /if\(type\)return\{response:conversational\(type,systemId,pre\).*provider:'deterministic-local'/);
assert.match(assistant, /awaitvisibleresult/, 'Assistant must normalize machine next-action tokens into readable guidance.');
assert.ok(familyLoader.includes(`assistant-runtime-v141.js?v=${version.trim()}-server-auto-v305`));
assert.match(knowledgeBridge, /if\(selected==='server-auto'\)return original\(options\)/);
assert.match(deterministicMode, /'hosted','server-auto'\]\.includes\(raw\)\?raw:'deterministic'/);
assert.match(settingsController, /if\(route==='server-auto'\)return'server-auto'/);
assert.match(settingsRepair, /if\(provider==='server-auto'\)return'server-auto'/);
assert.match(settingsRepair, /state\.provider==='deterministic'\|\|state\.provider==='server-auto'/);
assert.match(deviceCredentials, /if\(provider==='server-auto'\)return'server-auto'/);
assert.ok(familyLoader.includes(`deterministic-mode-v175.js?v=${version.trim()}-server-auto-v304`));

assert.match(settings, /Server-side AI · local → host → Cloudflare/);
assert.match(settings, /data-compute-buy/);
assert.match(settings, /ensureDefaultRoute/);
assert.match(settings, /function ensureDefaultRoute\(\).*persistServerRoute\(\{source:/);
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
assert.match(cloudEntry, /selectWorkersAiModel/);
assert.match(cloudEntry, /estimateGenerationNeurons/);
assert.match(cloudEntry, /KIMI_APPROVAL_REQUIRED/);
assert.match(cloudEntry, /approval\.scope === 'single-request'/);
assert.match(cloudEntry, /patch\/debug-heavy task requires the code-specialist validation pass/);
assert.match(modelRouter, /@cf\/google\/gemma-4-26b-a4b-it/);
assert.match(modelRouter, /@cf\/qwen\/qwen2\.5-coder-32b-instruct/);
assert.match(modelRouter, /@cf\/openai\/gpt-oss-120b/);
assert.match(modelRouter, /@cf\/zai-org\/glm-4\.7-flash/);
assert.match(modelRouter, /@cf\/moonshotai\/kimi-k2\.7-code/);
assert.doesNotMatch(modelRouter, /messages\.map\(item => item\?\.content\)/, 'System-prompt scaffolding must not select an expensive model.');
assert.match(modelRouter, /function selectWorkersAiModel/);
assert.match(modelRouter, /function estimateGenerationNeurons/);
assert.match(cloudEntry, /x-civweave-node-signature/);
assert.match(cloudEntry, /allowedCampusOrigin/);
assert.match(cloudEntry, /request\.method === 'OPTIONS'/);
assert.match(fabricEntry, /PUBLIC_CAPACITY_NODE_ID = 'civweave-cloud'/);
assert.match(fabricEntry, /PUBLIC_CAPACITY_USER_ID = 'civweave-public-guest'/);
assert.match(fabricEntry, /campus-origin-required/);
assert.doesNotMatch(fabricEntry, /access-control-allow-origin['"]?\s*:\s*['"]\*/);

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
  capabilityAwareCloudflareModelSelection: true,
  localFailureFailover: true,
  incompleteLocalResultFailover: true,
  v271SpineCompatibility: true,
  offlineControlsCached: true,
  lifetimeCreditsRequireExplicitPermission: true,
}, null, 2));
