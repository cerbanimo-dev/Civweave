import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const files={
  worker:read('public/service-worker-offline-v211-override.js'),
  controller:read('public/app/installer-state-machine-v280.js'),
  autostart:read('public/app/required-campus-autostart-v1.js'),
  background:read('public/app/campus-background-download-v241.js'),
  entry:read('public/service-worker-v203.js'),
  shell:read('public/service-worker-installer-state-v280.js')
};

assert.match(files.worker,/PAUSE_OFFLINE_PACKAGE/);
assert.match(files.worker,/downloadedAssets/);
assert.match(files.worker,/joinedExisting/);
assert.match(files.worker,/interrupted:\s*true/);
assert.match(files.worker,/civweave-campus-resume-v280/);
assert.match(files.worker,/current-manifest-only-v282/);
assert.match(files.controller,/Pause download/);
assert.match(files.controller,/Resume download/);
assert.match(files.controller,/calculating storage/);
assert.match(files.controller,/needs repair/);
assert.match(files.controller,/addEventListener\('click',onCampusButton,true\)/);
assert.match(files.autostart,/required-campus-autostart-v304-disabled/);
assert.match(files.autostart,/disabled:true/);
assert.match(files.autostart,/explicit-user-opt-in-only/);
assert.match(files.autostart,/function start\(\)\{return false\}/);
assert.doesNotMatch(files.autostart,/campusIsPaused/);
assert.doesNotMatch(files.autostart,/installer-state-machine-v280/);
assert.match(files.background,/civweave\.offline-campus\.explicit-opt-in\.v304/);
assert.match(files.background,/function optedIn\(\)/);
assert.match(files.background,/if\(!optedIn\(\)\|\|downloadActive/);
assert.match(files.background,/status\?\.ready\|\|status\?\.paused/);
assert.match(files.background,/!packet\.ready&&!packet\.paused/);
assert.match(files.background,/!lastStatus\?\.paused/);
assert.match(files.background,/data-state="paused"/);
assert.match(files.entry,/service-worker-installer-state-v280/);
assert.match(files.entry,/resumable-pause-v280/);
assert.match(files.shell,/installer-state-machine-v280\.js/);
assert.match(files.shell,/installer-storage-guard-v281\.js/);
assert.match(files.shell,/offline-campus-status-v210\.js/);
assert.match(files.shell,/campusAutostartRequired:\s*false/);
assert.doesNotMatch(files.shell,/required-campus-autostart-v1\.js/);
assert.doesNotMatch(files.shell,/campus-background-download-v241\.js/);

const listeners={};
const metadataWrites=[];
const context={
  VERSION:'1.0.51',
  OFFLINE_CACHE:'test-offline-cache',
  offlinePacket(){},
  offlineStatus:async()=>({}),
  downloadOfflinePackage:async()=>({}),
  loadOfflineManifest:async()=>({seeds:[]}),
  readOfflineMeta:async()=>null,
  writeOfflineMeta:async value=>{metadataWrites.push(value);return value},
  cacheOfflineAsset:async()=>({response:{headers:{get:()=>''},clone(){return this}},contentLength:0}),
  TEXT_CONTENT:/text/,
  discoverReferences:()=>[],
  post(){},
  self:{
    clients:{matchAll:async()=>[]},
    addEventListener(type,fn){(listeners[type]??=[]).push(fn)}
  },
  console
};
vm.createContext(context);
vm.runInContext(files.worker,context,{filename:'service-worker-offline-v211-override.js'});
const api=context.self.CivweaveOfflineCampusV211;
assert.equal(api.pauseSupported,true);
assert.equal(api.resumablePerFile,true);
assert.equal(api.syncTag,'civweave-campus-resume-v280');
const paused=api.packet({
  running:true,
  paused:true,
  total:10,
  downloaded:4,
  downloadedAssets:['a','b','c','d'],
  assets:['a','b','c','d','e','f','g','h','i','j']
});
assert.equal(paused.paused,true);
assert.equal(paused.running,false);
assert.equal(paused.downloaded,4);
assert.equal(paused.resumeSupported,true);
const cleaned=api.packet({
  ready:true,
  total:3,
  downloaded:2,
  downloadedAssets:['a','b'],
  assets:['a','b'],
  skipped:[{pathname:'/obsolete.js'}],
  skippedCount:1,
  discovered:3
});
assert.equal(cleaned.total,2);
assert.equal(cleaned.discovered,2);
assert.equal(cleaned.skippedCount,0);
assert.equal(cleaned.skipped.length,0);
assert.equal(cleaned.referencePolicy,'current-manifest-only-v282');
const migrated=await api.migrateMeta({
  revision:'offline-campus-current-graph-v280',
  ready:true,
  downloaded:2,
  assets:['a','b'],
  skipped:[{pathname:'/obsolete.js'}],
  skippedCount:1,
  discovered:3
},{seeds:[]});
assert.equal(migrated.discovered,2);
assert.equal(migrated.skippedCount,0);
assert.equal(metadataWrites.length,1);
assert.equal(metadataWrites[0].skippedCount,0);
assert.equal(metadataWrites[0].skipped.length,0);
assert.ok((listeners.message||[]).length>=1);
assert.ok((listeners.sync||[]).length>=1);

console.log('installer resume state v280 + current-manifest-only v282 smoke: ok');
