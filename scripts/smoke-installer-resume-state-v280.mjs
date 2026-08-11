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
assert.match(files.worker,/explicitOptInRequired:\s*true/);
assert.match(files.worker,/optionalDependenciesBlockCompletion:\s*false/);
assert.match(files.controller,/Pause download/);
assert.match(files.controller,/Resume download/);
assert.match(files.controller,/calculating storage/);
assert.match(files.controller,/needs repair/);
assert.match(files.controller,/addEventListener\('click',onCampusButton,true\)/);
assert.match(files.autostart,/campusIsPaused/);
assert.match(files.background,/explicitOptIn/);
assert.match(files.background,/!status\?\.explicitOptIn/);
assert.match(files.entry,/service-worker-installer-state-v280/);
assert.match(files.entry,/resumable-pause-v280/);
assert.match(files.shell,/installer-state-machine-v280\.js/);
assert.match(files.shell,/offline-campus-status-v210\.js/);
assert.doesNotMatch(files.shell,/required-campus-autostart-v1\.js/);
assert.doesNotMatch(files.shell,/campus-background-download-v241\.js/);
assert.doesNotMatch(files.shell,/installer-storage-guard-v281\.js/);

const listeners={};
let persisted=null;
const response=()=>({
  headers:{get:()=> 'text/plain'},
  clone(){return{text:async()=>''}}
});
const context={
  VERSION:'1.0.51',
  OFFLINE_CACHE:'test-offline-cache',
  offlinePacket(){},
  offlineStatus:async()=>({}),
  downloadOfflinePackage:async()=>({}),
  loadOfflineManifest:async()=>({seeds:[]}),
  readOfflineMeta:async()=>persisted,
  writeOfflineMeta:async value=>{persisted=value;return value},
  cacheOfflineAsset:async()=>({response:response(),contentLength:10}),
  TEXT_CONTENT:/text/,
  discoverReferences:()=>[],
  post(){},
  URL,
  setTimeout,
  clearTimeout,
  Date,
  self:{
    location:{origin:'https://example.test'},
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
assert.equal(api.explicitOptInRequired,true);
assert.equal(api.optionalDependenciesBlockCompletion,false);
assert.equal(api.syncTag,'civweave-campus-resume-v280');
const paused=api.packet({
  running:true,
  paused:true,
  explicitOptIn:true,
  total:10,
  downloaded:4,
  downloadedAssets:['a','b','c','d'],
  assets:['a','b','c','d','e','f','g','h','i','j']
});
assert.equal(paused.paused,true);
assert.equal(paused.running,false);
assert.equal(paused.downloaded,4);
assert.equal(paused.explicitOptIn,true);
assert.equal(paused.resumeSupported,true);
assert.ok((listeners.message||[]).length>=1);
assert.ok((listeners.sync||[]).length>=1);

persisted=null;
context.loadOfflineManifest=async()=>({
  seeds:['/required.html'],
  assets:['/optional.js'],
  maxAssets:50,
  maxDepth:1
});
context.cacheOfflineAsset=async pathname=>{
  if(pathname==='/optional.js'){
    const error=new Error('/optional.js returned 503');
    error.status=503;
    throw error;
  }
  return{response:response(),contentLength:10};
};
const manual=await context.downloadOfflinePackage({data:{type:'DOWNLOAD_OFFLINE_PACKAGE'},ports:[],source:null});
assert.equal(manual.explicitOptIn,true,'manual campus request must persist explicit opt-in');
assert.equal(manual.ready,true,'one optional dependency failure must not leave the campus unfinished');
assert.equal(manual.failedCount,0,'optional dependency failure must not remain in the blocking failure set');
assert.equal(manual.skippedCount,1,'optional dependency failure must be visible as skipped/deferred');
assert.equal(manual.downloaded,1,'required seed must remain downloaded');
assert.equal(manual.total,1,'retired optional dependency must not inflate completion denominator');

persisted=null;
context.cacheOfflineAsset=async()=>({response:response(),contentLength:10});
const backgroundOnly=await context.downloadOfflinePackage({data:{type:'DOWNLOAD_OFFLINE_PACKAGE',background:true},ports:[],source:null});
assert.equal(backgroundOnly.explicitOptIn,false,'background-only request must not create user opt-in');

console.log('installer resume state v280 smoke: ok');