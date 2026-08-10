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
  'public/app/installer-state-machine-v280.js',
  'public/app/installer-storage-guard-v281.js',
  'public/app/required-campus-autostart-v1.js',
  'public/app/campus-background-download-v241.js',
  'public/service-worker-installer-state-v280.js',
  'public/service-worker-shell-integrity-v281.js',
  'public/service-worker-offline-v211-override.js',
  'public/service-worker-v203.js',
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
const autostart=await read('public/app/required-campus-autostart-v1.js');

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
assert.match(autostart,/STORAGE_GUARD_URL/);

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
  storageGuard:true,
  lastKnownGoodShell:true,
  deterministicFallback:true
},null,2));
