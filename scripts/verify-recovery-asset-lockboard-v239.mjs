import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const read=path=>fs.readFileSync(resolve(root,path),'utf8');

const offline=read('public/service-worker-offline-v211-override.js');
const worker=read('public/service-worker-v203.js');
const integrity=read('public/service-worker-shell-integrity-v281.js');
const installerPage=read('public/app/index.html');
const installRuntime=read('public/install-v130.js');
const autostart=read('public/app/required-campus-autostart-v1.js');
const campus=read('public/app/working-campus-v156.js');
const lockboardHtml=read('public/app/asset-lockboard-v239.html');
const lockboard=read('public/app/asset-lockboard-v239.js');
const customizer=read('public/app/asset-customization-v239.js');
const boundary=read('public/app/install-boundary-v146.js');
const background=read('public/app/campus-background-download-v241.js');

const checks=[
  ['offline crawler keeps v280 resumable graph identity with verified shell staging',()=>{
    assert.match(offline,/offline-campus-current-graph-v280/);
    assert.match(worker,/offline-campus-current-graph-v280/);
    assert.match(worker,/policy=resumable-pause-v280/);
    assert.match(offline,/const V211_POLICY = 'resumable-pause-v280'/);
    assert.match(offline,/const V211_SYNC_TAG = 'civweave-campus-resume-v280'/);
    assert.match(offline,/const V211_BATCH_SIZE = 16/);
    assert.match(offline,/downloadedAssets/);
    assert.match(offline,/pauseSupported: true/);
    assert.match(integrity,/crypto\.subtle\.digest\('SHA-256'/);
    assert.match(integrity,/lastKnownGoodCache/);
  }],
  ['previous package assets never seed the next crawl',()=>{
    assert.match(offline,/const initialAssets = \[\.\.\.new Set\(\(manifest\.seeds \|\| \[\]\)\.filter\(Boolean\)\)\]/);
    assert.doesNotMatch(offline,/initialAssets[^\n]+previousAssets/);
    assert.match(offline,/current-manifest-only-v282/);
  }],
  ['same-release retries are cache-first while a new release refreshes discovery text',()=>{
    assert.match(offline,/const preferNetwork = !sameRelease && V211_DISCOVERY_TEXT\.test\(item\.pathname\)/);
    assert.match(offline,/cacheOfflineAsset\(item\.pathname, \{ preferNetwork \}\)/);
    assert.match(offline,/skippedCount: 0/);
  }],
  ['campus can finish while canonical pages are in use',()=>{
    assert.match(offline,/self\.clients\?\.matchAll\?\./);
    assert.match(offline,/backgroundSafe: true/);
    assert.match(background,/DOWNLOAD_OFFLINE_PACKAGE/);
    assert.match(background,/height:4px/);
    assert.match(boundary,/CAMPUS_BACKGROUND_DOWNLOAD='\/app\/campus-background-download-v241\.js'/);
    assert.match(boundary,/v241-worker-owned-download-bottom-progress-rail/);
  }],
  ['installer runtime is the sole service-worker registration owner',()=>{
    assert.doesNotMatch(installerPage,/navigator\.serviceWorker\.register\s*\(/);
    assert.match(installRuntime,/navigator\.serviceWorker\.register\s*\(/);
  }],
  ['legacy campus autostart path is an inert compatibility shim',()=>{
    assert.doesNotMatch(autostart,/new MutationObserver/);
    assert.match(autostart,/disabled:true/);
    assert.match(autostart,/explicit-user-opt-in-only/);
    assert.doesNotMatch(autostart,/\.click\(\)/);
    assert.doesNotMatch(autostart,/DOWNLOAD_OFFLINE_PACKAGE/);
  }],
  ['required campus remains independent from PWA install availability',()=>{
    assert.doesNotMatch(autostart,/button\.disabled\s*=\s*true/);
    assert.doesNotMatch(autostart,/civweave\.pwa\.install-accepted/);
  }],
  ['asset lockboard remains independent from the retired autostart shim',()=>{
    assert.doesNotMatch(autostart,/asset-lockboard-v239\.html/);
  }],
  ['Working Campus repairs null or malformed persisted plans before runtime',()=>{
    assert.match(campus,/working-campus-state-repair-v238/);
    assert.match(campus,/function repairPersistedCampusState\(\)/);
    assert.match(campus,/\['review','active'\]\.includes\(state\.stage\)/);
    assert.match(campus,/Recovered weave/);
  }],
  ['Working Campus header owns top-edge hit testing',()=>{
    assert.match(campus,/cw-working-campus-hit-safety-v238/);
    assert.match(campus,/z-index:2147483620!important/);
    assert.match(campus,/pointer-events:auto!important/);
  }],
  ['Working Campus brand uses direct app icon fallback',()=>{
    assert.match(campus,/\/app\/logos\/civweave-app-icon\.png/);
  }],
  ['asset lockboard supports canonical locks and personal replacements',()=>{
    assert.match(lockboard,/civweave\.asset-lockboard\.export\.v239/);
    assert.match(lockboard,/slotLocks/);
    assert.match(lockboard,/pathOverrides/);
    assert.match(lockboard,/Exported/);
  }],
  ['lockboard previews stay literal even when a personal skin exists',()=>{
    assert.doesNotMatch(lockboardHtml,/asset-customization-v239\.js/);
    assert.match(lockboardHtml,/asset-lockboard-v239\.js/);
  }],
  ['personal customization is opt-in and path based',()=>{
    assert.match(customizer,/civweave\.asset-lockboard\.v239/);
    assert.match(customizer,/pathOverrides/);
    assert.match(customizer,/applyStylesheets/);
    assert.match(boundary,/installAssetCustomizationIfConfigured/);
    assert.match(boundary,/v239-local-path-overrides-on-demand/);
  }]
];

for(const [name,run] of checks){run();console.log(`✓ ${name}`)}

const generated=spawnSync(process.execPath,[resolve(root,'scripts/generate-asset-lockboard-catalog-v239.mjs')],{cwd:root,encoding:'utf8'});
assert.equal(generated.status,0,generated.stderr||generated.stdout);
const catalog=JSON.parse(read('public/app/asset-lockboard-catalog-v239.json'));
assert.equal(catalog.schema,'civweave.asset-lockboard.catalog.v239');
assert.ok(catalog.assetCount>0,'asset catalog should contain images');
assert.ok(catalog.slotCount>0,'asset catalog should contain source slots');
assert.ok(catalog.assets.some(asset=>asset.path==='/app/assets/ai/merlin.png'),'Merlin should be selectable in the image inventory');
assert.ok(catalog.assets.some(asset=>asset.path.includes('civweave')),'Civweave-branded assets should be selectable');
console.log(`✓ generated catalog contains ${catalog.assetCount} images and ${catalog.slotCount} source slots`);
console.log(`Recovery + asset lockboard v239 verified: ${checks.length+1}/${checks.length+1} checks passed.`);
