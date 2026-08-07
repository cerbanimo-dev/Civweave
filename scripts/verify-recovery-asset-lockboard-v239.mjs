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
const autostart=read('public/app/required-campus-autostart-v1.js');
const campus=read('public/app/working-campus-v156.js');
const lockboard=read('public/app/asset-lockboard-v239.js');
const customizer=read('public/app/asset-customization-v239.js');
const boundary=read('public/app/install-boundary-v146.js');

const checks=[
  ['offline crawler is current-graph v238',()=>{
    assert.match(offline,/offline-campus-current-graph-v238/);
    assert.match(worker,/offline-campus-current-graph-v238/);
    assert.match(offline,/const V211_BATCH_SIZE = 12/);
  }],
  ['previous package assets never seed the next crawl',()=>{
    assert.match(offline,/const initialAssets = \[\.\.\.new Set\(\(manifest\.seeds \|\| \[\]\)\.filter\(Boolean\)\)\]/);
    assert.doesNotMatch(offline,/initialAssets[^\n]+previousAssets/);
    assert.match(offline,/stale-not-rediscovered/);
  }],
  ['text graph refreshes while binary assets reuse cache',()=>{
    assert.match(offline,/const preferNetwork = V211_DISCOVERY_TEXT\.test\(item\.pathname\)/);
    assert.match(offline,/cacheOfflineAsset\(item\.pathname, \{ preferNetwork \}\)/);
  }],
  ['old installer-wide mutation observer is gone',()=>{
    assert.doesNotMatch(autostart,/new MutationObserver/);
    assert.match(autostart,/civweave:offline-campus-status/);
  }],
  ['installed shell shows a campus waiting spinner',()=>{
    assert.match(autostart,/Waiting for campus files…/);
    assert.match(autostart,/cw-campus-waiting:before/);
  }],
  ['asset lockboard link is runtime assembled to avoid crawl expansion',()=>{
    assert.match(autostart,/\['\/app', 'asset-lockboard-v239\.html'\]\.join\('\/'\)/);
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
