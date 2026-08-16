import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {classifyHostDevice,recommendedHostRoute,GUILD_HOST_ONBOARDING_SCHEMA} from '../public/app/guild-host-onboarding-v1.mjs';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [hostSession,onboardingSource,pocketSource,mobileCreateSource,downloadsHtml,hostSetupHtml,desktopHostHtml,operatorHtml,operatorControl,offlineText]=await Promise.all([
  read('public/app/host-node-session-v1.js'),
  read('public/app/guild-host-onboarding-v1.mjs'),
  read('public/app/pocket-guild-node-v1.mjs'),
  read('public/app/mobile-guild-create-v1.mjs'),
  read('public/app/index.html'),
  read('public/host-setup.html'),
  read('public/host-local-anchor.html'),
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
assert.equal(recommendedHostRoute({deviceClass:'mobile',localMeshAvailable:false}),'pocket-node-pending');
assert.equal(recommendedHostRoute({deviceClass:'desktop',localMeshAvailable:true}),'persistent-local-node');
assert.match(hostSession,/const STEWARD_KEY='civweave\.host-steward\.v1'/);
assert.match(hostSession,/import\('\/app\/guild-host-onboarding-v1\.mjs'\)/);
assert.match(hostSession,/void ensureGuildHostOnboarding\(session\)/);
assert.match(hostSession,/if\(active\)\{void ensureGuildHostOnboarding\(active\);return active\}/);
assert.match(onboardingSource,/primaryOrigin=null/);
assert.match(onboardingSource,/inheritedDownloadOrigin:false/);
assert.doesNotMatch(onboardingSource,/primaryOrigin=globalThis\.location/);
assert.match(pocketSource,/primaryOrigin=null/);
assert.match(pocketSource,/cloudAttached:Boolean\(origin\)/);
assert.doesNotMatch(pocketSource,/primaryOrigin=location\.origin/);
assert.match(mobileCreateSource,/civweave\.guild-genesis\.v1/);
assert.match(mobileCreateSource,/workerCreated:false/);
assert.match(mobileCreateSource,/downloadOriginUsedAsBackend:false/);
assert.match(downloadsHtml,/Create mobile Guild/);
assert.match(downloadsHtml,/No Cloudflare Worker is created/);
assert.match(downloadsHtml,/mobile-guild-create-v1\.mjs/);
assert.match(downloadsHtml,/Desktop \/ Pi Guild directions/);
assert.match(downloadsHtml,/never makes the Guild you downloaded Civweave from pay for your hosting/);
assert.match(hostSetupHtml,/Pocket-only mobile Guilds create no Worker/);
assert.match(hostSetupHtml,/Cloudflare account authenticated for this Guild/);
assert.match(desktopHostHtml,/Nothing is created in the download source Guild's account/);
assert.match(desktopHostHtml,/node scripts\/setup-cloudflare-node\.mjs --host-id/);
assert.match(operatorHtml,/id="emergencyAiHost"/);
assert.match(operatorHtml,/\/app\/emergency-ai-host-control-v1\.mjs/);
assert.match(operatorControl,/CivweaveEmergencyAiHostV1\.readiness\(\)/);
assert.match(operatorControl,/Enable emergency AI host/);
for(const asset of ['/app/shared/guild-host-resilience-v1.mjs','/app/pocket-guild-node-v1.mjs','/app/guild-host-onboarding-v1.mjs','/app/emergency-ai-host-v1.mjs','/app/emergency-ai-mesh-v1.mjs','/app/emergency-ai-host-control-v1.mjs'])assert.ok(offline.assets.includes(asset),`${asset} must remain in the offline core.`);
console.log(JSON.stringify({ok:true,schema:GUILD_HOST_ONBOARDING_SCHEMA,mobilePremierRoute:'pocket-node',mobileFallback:'pocket-node-pending',mobileCloudDefault:false,downloadOriginInherited:false,desktopRoute:'persistent-local-node',stewardSessionHook:true,downloadsCreationSurface:true,emergencyAiMesh:true,emergencyAiOperatorControl:true,offlineCore:true}));