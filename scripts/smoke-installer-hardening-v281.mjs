import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=relative=>fs.readFile(path.join(root,relative),'utf8');
const exists=relative=>fs.stat(path.join(root,relative)).then(stat=>stat.isFile()).catch(()=>false);
const syntaxTargets=[
  'public/install-v130.js',
  'public/app/installer-online-fallback-v225.js',
  'public/app/installer-state-machine-v280.js',
  'public/app/installer-storage-guard-v281.js',
  'public/app/required-campus-autostart-v1.js',
  'public/app/campus-background-download-v241.js',
  'public/service-worker-installer-state-v280.js',
  'public/service-worker-shell-integrity-v281.js',
  'public/service-worker-offline-v211-override.js',
  'public/service-worker-v203.js',
  'scripts/stage-transformers-assets.mjs',
  'scripts/stage-onnxruntime-web-assets.mjs',
  'scripts/ensure-minilm-fixed-ort-model.mjs',
  'scripts/generate-prelive-metadata-v281.mjs',
  'scripts/smoke-installer-resume-state-v280.mjs',
  'scripts/browser-installer-gauntlet-v281.mjs'
];
for(const relative of syntaxTargets){
  const result=spawnSync(process.execPath,['--check',path.join(root,relative)],{encoding:'utf8'});
  assert.equal(result.status,0,`${relative} failed syntax check:\n${result.stderr||result.stdout||''}`);
}

const version=(await read('VERSION')).trim();
const pkg=JSON.parse(await read('package.json'));
const manifest=JSON.parse(await read('public/app/manifest.webmanifest'));
const offline=JSON.parse(await read('public/app/offline-package-v208.json'));
const wrapper=await read('public/service-worker-v203.js');
const integrityWorker=await read('public/service-worker-shell-integrity-v281.js');
const storageGuard=await read('public/app/installer-storage-guard-v281.js');
const installerWorker=await read('public/service-worker-installer-state-v280.js');
const installerHtml=await read('public/app/index.html');
const installerJs=await read('public/install-v130.js');
const repairJs=await read('public/app/installer-online-fallback-v225.js');
const offlineWorker=await read('public/service-worker-offline-v211-override.js');
const transformersStage=await read('scripts/stage-transformers-assets.mjs');
const ortStage=await read('scripts/stage-onnxruntime-web-assets.mjs');
const miniLmEnsure=await read('scripts/ensure-minilm-fixed-ort-model.mjs');

assert.equal(pkg.version,version,'package.json must match VERSION');
assert.equal(manifest.name,`Civweave v${version}`,'manifest release name must match VERSION');
assert.match(wrapper,new RegExp(`service-worker-core-v208\\.js\\?v=${version.replaceAll('.','\\.')}[-']`));
assert.match(wrapper,/service-worker-shell-integrity-v281\.js\?v=shell-integrity-v281/);
assert.match(integrityWorker,/crypto\.subtle\.digest\('SHA-256'/);
assert.match(integrityWorker,/STAGING_CACHE/);
assert.match(integrityWorker,/lastKnownGoodCache/);
assert.match(integrityWorker,/Integrity mismatch/);
assert.match(integrityWorker,/findCached = async function findCachedV281/);
assert.match(integrityWorker,/current-caches-then-last-known-good-shell/);
assert.match(storageGuard,/storage\?\.persist\?\./);
assert.match(storageGuard,/storage\?\.estimate\?\./);
assert.match(storageGuard,/requiredFreeBytes/);
assert.match(storageGuard,/civweaveStorageState='insufficient'/);
assert.match(installerWorker,/installer-storage-guard-v281\.js/);

assert.doesNotMatch(installerHtml,/<script[^>]+required-campus-autostart-v1\.js/i,'installer must not autostart the offline campus');
assert.doesNotMatch(installerHtml,/<script[^>]+knowledge-school-seeds-v1\.js/i,'knowledge-school code must not load during first paint');
assert.doesNotMatch(installerHtml,/<script[^>]+video-atlas-installer-v1\.js/i,'video atlas must not load during first paint');
assert.match(installerHtml,/installer-state-machine-v280\.js\?v=installer-state-machines-v280-lazy/,'pause/resume controller must lazy-load on the first campus request');
assert.match(installerHtml,/Nothing large downloads until you ask for it\./,'installer must explain its idle first-paint state');
assert.match(installerJs,/button\.textContent = `Install Civweave v\$\{VERSION\}`/,'install button must be usable before shell preparation');
assert.doesNotMatch(installerJs,/\nprepareShell\(\);\s*\n\}\)\(\);\s*$/,'installer must not prepare the shell automatically on page load');
assert.match(installerJs,/civweave-offline-/,'shell reset must preserve the offline campus cache');
assert.match(installerJs,/Nothing large downloads until you choose Install or Download offline campus/,'idle installer guidance must be interaction-first');

assert.match(repairJs,/const REPAIR_TIMEOUT_MS = 20000/,'repair must fail over promptly instead of stalling for 90 seconds');
assert.match(repairJs,/hardResetFallback/,'repair must have a shell-registration recovery fallback');
assert.match(repairJs,/PAUSE_OFFLINE_PACKAGE/,'repair must pause competing offline transfer work first');

assert.equal(offline.payloadPolicy,'code-first-lazy-visuals-v300','offline campus must identify the code-first payload policy');
for(const extension of ['.png','.webp','.jpg','.jpeg','.svg','.woff','.woff2','.ttf','.otf','.onnx','.wasm']){
  assert.ok(offline.excludeExtensions.includes(extension),`offline campus must defer ${extension} payloads`);
}
for(const prefix of ['/app/models/','/app/vendor/onnxruntime/','/app/vendor/transformers/','/app/vendor/transformers-v4/']){
  assert.ok(offline.excludePrefixes.includes(prefix),`offline campus must exclude ${prefix}`);
}
assert.ok(Number(offline.maxAssets)>=1000,'code-first campus budget must leave headroom for current code graph');
assert.match(offlineWorker,/const V211_PAYLOAD_POLICY = 'code-first-lazy-visuals-v300'/);
assert.match(offlineWorker,/optionalDependenciesBlockCompletion: false/);
assert.match(offlineWorker,/if \(!item\.required\)/,'optional dependency failures must retire instead of blocking completion');
assert.match(offlineWorker,/asset-budget-deferred/,'over-budget discovered dependencies must defer to runtime instead of hanging completion');

for(const source of [transformersStage,ortStage]){
  assert.match(source,/CIVWEAVE_STAGE_DEVICE_AI_ON_HOST/,'host staging must require an explicit device-AI opt-in');
  assert.match(source,/Hosted gateway: skipping device-side/,'host startup must skip device AI staging by default');
}
assert.match(miniLmEnsure,/CIVWEAVE_PULL_OPTIONAL_MODEL_ON_START/,'MiniLM startup materialization must require an explicit opt-in');
assert.match(miniLmEnsure,/Optional MiniLM is not staged during app startup/);
assert.equal(await exists('public/app/models/smollm2-360m-instruct/tokenizer.json'),false,'legacy SmolLM2 tokenizer payload must not ship in the repository');
assert.equal(await exists('public/app/models/smollm2-360m-instruct/model-manifest.json'),false,'legacy SmolLM2 bundled package manifest must be retired');

assert.equal(offline.preflight?.revision,'campus-storage-budget-v281','offline manifest must contain a generated storage budget');
assert.ok(Number(offline.preflight?.estimatedBytes)>0,'campus estimate must be positive');
assert.ok(Number(offline.preflight?.safetyBytes)>=64*1024*1024,'campus safety margin must be at least 64 MiB');
assert.equal(
  Number(offline.preflight?.requiredFreeBytes),
  Number(offline.preflight?.estimatedBytes)+Number(offline.preflight?.safetyBytes),
  'required free bytes must include the safety margin'
);

assert.equal(await exists('public/app/shell-integrity-v281.json'),true,'shell integrity manifest must be generated');
const integrity=JSON.parse(await read('public/app/shell-integrity-v281.json'));
assert.equal(integrity.version,version,'integrity manifest release must match VERSION');
assert.equal(integrity.algorithm,'sha256');
assert.ok(Number(integrity.requiredAssetCount)>0);
assert.equal(Object.keys(integrity.assets||{}).length,integrity.requiredAssetCount);
for(const [pathname,expected] of Object.entries(integrity.assets||{})){
  assert.match(expected,/^[a-f0-9]{64}$/i,`${pathname} must have a SHA-256 digest`);
  const bytes=await fs.readFile(path.join(root,'public',pathname.replace(/^\/+/,'')));
  const actual=crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(actual,expected,`${pathname} integrity digest is stale`);
}

console.log(JSON.stringify({
  ok:true,
  version,
  syntaxTargets:syntaxTargets.length,
  integrityAssets:integrity.requiredAssetCount,
  campusEstimatedBytes:offline.preflight.estimatedBytes,
  campusRequiredFreeBytes:offline.preflight.requiredFreeBytes,
  interactionFirst:true,
  autostartCampus:false,
  lazyVisuals:true,
  hostedDeviceAiStaging:false,
  legacySmolPayload:false,
  repairFallback:true,
  storageGuard:true,
  lastKnownGoodShell:true,
  deterministicFallback:true
},null,2));