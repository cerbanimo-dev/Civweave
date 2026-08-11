import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=relative=>fs.readFile(path.join(root,relative),'utf8');
const syntaxTargets=[
  'public/install-v130.js',
  'public/app/campus-background-download-v241.js',
  'public/app/required-campus-autostart-v1.js',
  'public/service-worker-installer-state-v280.js',
  'public/service-worker-offline-v211-override.js',
  'public/service-worker-v203.js',
  'scripts/browser-installer-gauntlet-v281.mjs'
];
for(const relative of syntaxTargets){
  const result=spawnSync(process.execPath,['--check',path.join(root,relative)],{encoding:'utf8'});
  assert.equal(result.status,0,`${relative} failed syntax check:\n${result.stderr||result.stdout||''}`);
}

const version=(await read('VERSION')).trim();
const pkg=JSON.parse(await read('package.json'));
const manifest=JSON.parse(await read('public/app/manifest.webmanifest'));
const installerHtml=await read('public/app/index.html');
const installerJs=await read('public/install-v130.js');
const autostart=await read('public/app/required-campus-autostart-v1.js');
const background=await read('public/app/campus-background-download-v241.js');
const installerWorker=await read('public/service-worker-installer-state-v280.js');
const offlineWorker=await read('public/service-worker-offline-v211-override.js');
const integrity=JSON.parse(await read('public/app/shell-integrity-v281.json'));

assert.equal(pkg.version,version,'package.json must match VERSION');
assert.equal(manifest.name,`Civweave v${version}`,'manifest release name must match VERSION');
assert.match(installerHtml,/Nothing large downloads until you ask for it\./,'installer must advertise an idle first paint');
assert.doesNotMatch(installerHtml,/<script[^>]+required-campus-autostart-v1\.js/i,'installer must not load the legacy autostart shim');
assert.doesNotMatch(installerHtml,/<script[^>]+knowledge-school-seeds-v1\.js/i,'knowledge-school runtime must stay lazy');
assert.doesNotMatch(installerHtml,/<script[^>]+video-atlas-installer-v1\.js/i,'video atlas installer must stay lazy');
assert.doesNotMatch(installerHtml,/<script[^>]+open-learning-media-installer-v1\.mjs/i,'open media installer must stay lazy');
assert.match(installerHtml,/installer-state-machine-v280\.js\?v=installer-state-machines-v280-lazy/,'campus state machine must load only after the explicit campus action');
assert.match(installerHtml,/civweave\.offline-campus\.explicit-opt-in\.v304/,'explicit campus opt-in must persist before background continuation is possible');
assert.doesNotMatch(installerJs,/\nprepareShell\(\);\s*\n\}\)\(\);\s*$/,'installer must not prepare the shell on page load');
assert.match(installerJs,/Nothing large downloads until you choose Install or Download offline campus/,'install action must be available before shell preparation');
assert.match(installerJs,/OFFLINE_MANIFEST_URL/,'storage preflight must run on explicit offline-campus request');
assert.match(installerJs,/civweave-offline-/,'shell reset must preserve downloaded campus data');
assert.match(autostart,/disabled:true/,'legacy autostart path must be a no-op compatibility shim');
assert.doesNotMatch(autostart,/\.click\(\)/,'legacy autostart shim must never click the campus button');
assert.match(background,/civweave\.offline-campus\.explicit-opt-in\.v304/,'background continuation must use the explicit opt-in key');
assert.match(background,/if\(!optedIn\(\)\|\|downloadActive/,'background continuation must refuse to start before opt-in');
assert.match(background,/campus-background-download-v304-explicit-opt-in/);
assert.doesNotMatch(installerWorker,/required-campus-autostart-v1\.js/,'autostart must not be a required shell asset');
assert.doesNotMatch(installerWorker,/campus-background-download-v241\.js/,'background downloader must not be required by the installer shell');
assert.match(offlineWorker,/Math\.min\(1500/,'offline discovery ceiling repair must remain intact');

assert.equal(integrity.version,version,'integrity manifest release must match VERSION');
assert.equal(integrity.algorithm,'sha256');
for(const [pathname,expected] of Object.entries(integrity.assets||{})){
  const bytes=await fs.readFile(path.join(root,'public',pathname.replace(/^\/+/,'')));
  const actual=crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(actual,expected,`${pathname} integrity digest is stale`);
}

console.log(JSON.stringify({ok:true,version,manualFirst:true,autostart:false,explicitCampusOptIn:true,lazyOptionalTools:true,integrityAssets:Object.keys(integrity.assets||{}).length},null,2));
