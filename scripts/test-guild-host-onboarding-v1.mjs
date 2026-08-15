import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {classifyHostDevice,recommendedHostRoute,GUILD_HOST_ONBOARDING_SCHEMA} from '../public/app/guild-host-onboarding-v1.mjs';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [hostSession,onboardingSource,operatorHtml,operatorControl,offlineText]=await Promise.all([
  read('public/app/host-node-session-v1.js'),
  read('public/app/guild-host-onboarding-v1.mjs'),
  read('public/app/node-ai-operator-v1.html'),
  read('public/app/emergency-ai-host-control-v1.mjs'),
  read('public/app/offline-package-v208.json')
]);
const offline=JSON.parse(offlineText);

assert.equal(GUILD_HOST_ONBOARDING_SCHEMA,'civweave.guild-host-onboarding.v1');
assert.equal(classifyHostDevice({userAgent:'Mozilla/5.0 (Linux; Android 15; Mobile)',maxTouchPoints:5,coarsePointer:true}),'mobile');
assert.equal(classifyHostDevice({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',maxTouchPoints:5,coarsePointer:true}),'mobile');
assert.equal(classifyHostDevice({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',maxTouchPoints:0,coarsePointer:false}),'desktop');
assert.equal(recommendedHostRoute({deviceClass:'mobile',localMeshAvailable:true}),'pocket-node');
assert.equal(recommendedHostRoute({deviceClass:'mobile',localMeshAvailable:false}),'cloudflare-host-node');
assert.equal(recommendedHostRoute({deviceClass:'desktop',localMeshAvailable:true}),'persistent-local-node');
assert.match(hostSession,/const STEWARD_KEY='civweave\.host-steward\.v1'/);
assert.match(hostSession,/import\('\/app\/guild-host-onboarding-v1\.mjs'\)/);
assert.match(hostSession,/void ensureGuildHostOnboarding\(session\)/);
assert.match(hostSession,/if\(active\)\{void ensureGuildHostOnboarding\(active\);return active\}/);
assert.match(onboardingSource,/CivweaveEmergencyAiMeshV1\.start\(\{guildId:id,baseUrl:origin\}\)/);
assert.match(operatorHtml,/id="emergencyAiHost"/);
assert.match(operatorHtml,/\/app\/emergency-ai-host-control-v1\.mjs/);
assert.match(operatorControl,/CivweaveEmergencyAiHostV1\.readiness\(\)/);
assert.match(operatorControl,/Enable emergency AI host/);
for(const asset of ['/app/shared/guild-host-resilience-v1.mjs','/app/pocket-guild-node-v1.mjs','/app/guild-host-onboarding-v1.mjs','/app/emergency-ai-host-v1.mjs','/app/emergency-ai-mesh-v1.mjs','/app/emergency-ai-host-control-v1.mjs'])assert.ok(offline.assets.includes(asset),`${asset} must remain in the offline core.`);
console.log(JSON.stringify({ok:true,schema:GUILD_HOST_ONBOARDING_SCHEMA,mobilePremierRoute:'pocket-node',mobileFallback:'cloudflare-host-node',desktopRoute:'persistent-local-node',stewardSessionHook:true,emergencyAiMesh:true,emergencyAiOperatorControl:true,offlineCore:true}));
