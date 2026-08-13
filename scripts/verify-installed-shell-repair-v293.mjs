import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [versionText,integrityText,wrapper,repairWorker,fallback,builder,materializer,generator,coreWorker,installerWorker]=await Promise.all([
  read('VERSION'),
  read('public/app/shell-integrity-v281.json'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-shell-repair-v293.js'),
  read('public/app/installer-online-fallback-v225.js'),
  read('scripts/build-service-worker-v211.mjs'),
  read('scripts/materialize-canonical-release.mjs'),
  read('scripts/generate-prelive-metadata-v281.mjs'),
  read('public/service-worker-core-v208.js'),
  read('public/service-worker-installer-state-v280.js')
]);
const version=versionText.trim();
const integrity=JSON.parse(integrityText);
function extractStringArray(source,name,label){
  const match=source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[(.*?)\\];`,'s'));
  assert.ok(match,`Could not locate ${name} in ${label}.`);
  const value=Function(`"use strict"; return [${match[1]}];`)();
  assert.ok(Array.isArray(value)&&value.every(item=>typeof item==='string'),`${name} in ${label} must be a string array.`);
  return value;
}
const requiredShellAssets=[...new Set([
  ...extractStringArray(coreWorker,'REQUIRED_SHELL_ASSETS','service-worker-core-v208.js'),
  ...extractStringArray(installerWorker,'INSTALLER_STATE_ASSETS','service-worker-installer-state-v280.js')
])];
const requiredShellAssetCount=requiredShellAssets.length;
assert.match(version,/^\d+\.\d+\.\d+$/);
assert.equal(integrity.version,version,'Generated shell integrity metadata is not release-coherent.');
assert.equal(integrity.revision,'shell-integrity-v281');
assert.equal(integrity.algorithm,'sha256');
assert.ok(requiredShellAssetCount>=15,'Verified shell unexpectedly lost manual-first shell or installer-state assets.');
assert.equal(integrity.requiredAssetCount,requiredShellAssetCount,'Verified shell count drifted from the runtime-declared manual-first shell and installer-state assets.');
assert.equal(Object.keys(integrity.assets||{}).length,requiredShellAssetCount,'Shell integrity asset map drifted from the runtime-declared required asset count.');
for(const pathname of requiredShellAssets)assert.ok(pathname in (integrity.assets||{}),`Shell integrity metadata is missing required runtime asset ${pathname}.`);
for(const [pathname,digest] of Object.entries(integrity.assets||{})){
  assert.ok(pathname.startsWith('/'),`Integrity pathname is not absolute: ${pathname}`);
  assert.match(String(digest),/^[a-f0-9]{64}$/i,`Integrity digest is invalid for ${pathname}`);
}

const order=[
  '/service-worker-living-school-cleanroom-v218.js',
  '/service-worker-code-coherence-v288.js',
  '/service-worker-core-v208.js',
  '/service-worker-installed-launch-v282.js',
  '/service-worker-installer-state-v280.js',
  '/service-worker-shell-integrity-v281.js',
  '/service-worker-shell-repair-v293.js',
  '/service-worker-offline-v211-override.js'
];
let previous=-1;
for(const token of order){
  const index=wrapper.indexOf(token);
  assert.ok(index>previous,`Active worker order is missing or incorrect for ${token}.`);
  previous=index;
}
assert.ok(wrapper.includes("/service-worker-shell-repair-v293.js?v=installed-shell-repair-v293"));
assert.ok(builder.includes("'public/service-worker-code-coherence-v288.js'"),'Worker generator can erase v288 code coherence.');
assert.ok(builder.includes("'public/service-worker-shell-repair-v293.js'"),'Worker generator can erase installed shell repair.');
assert.ok(builder.includes("/service-worker-code-coherence-v288.js?v=1.0.91-code-coherence-v288"));
assert.ok(builder.includes("/service-worker-shell-repair-v293.js?v=installed-shell-repair-v293"));
assert.ok(materializer.includes("['scripts/generate-prelive-metadata-v281.mjs']"),'Canonical release materialization does not regenerate shell integrity metadata.');
assert.ok(generator.includes("version,")&&generator.includes("revision: 'shell-integrity-v281'")&&generator.includes("crypto.createHash('sha256')"),'Pre-live metadata generator lost release-bound shell hashing.');

for(const token of [
  "const REVISION='installed-shell-repair-v293'",
  "event.data?.type!=='REPAIR_DEVICE_PACKAGE'",
  'const result=await cacheShell()',
  'const status=await shellStatus()',
  "policy:'verified-shell-only-preserve-campus-model-school-storage'"
])assert.ok(repairWorker.includes(token),`Installed shell repair worker is missing ${token}`);
for(const token of [
  'needs? repair',
  "worker.postMessage({ type: 'REPAIR_DEVICE_PACKAGE' }",
  "packet?.type !== 'CIVWEAVE_DEVICE_PACKAGE_REPAIR'",
  "storagePolicy: 'preserve-campus-model-media-school-storage'",
  "installButton.textContent = 'Repair shell'"
])assert.ok(fallback.includes(token),`Installer repair UI is missing ${token}`);

function repairHarness({fail=false}={}){
  let messageHandler=null;
  const packets=[];
  const context={
    console,
    Promise,
    Array,
    Boolean,
    String,
    Error,
    VERSION:version,
    BUILD:'lightweight-shell-v208',
    cacheShell:async()=>{
      if(fail){const error=new Error('Integrity mismatch');error.failures=[{pathname:'/app/installed-entry-v146.html',message:'Integrity mismatch'}];throw error;}
      return{integrity:'verified',integrityRevision:'shell-integrity-v281',optionalFailures:[]};
    },
    shellStatus:async()=>({ready:true,assetCount:requiredShellAssetCount,presentCount:requiredShellAssetCount,missing:[]}),
    self:{addEventListener(type,handler){if(type==='message')messageHandler=handler}}
  };
  vm.createContext(context);
  vm.runInContext(repairWorker,context,{filename:'service-worker-shell-repair-v293.js'});
  assert.equal(typeof messageHandler,'function');
  let pending=Promise.resolve();
  messageHandler({
    data:{type:'REPAIR_DEVICE_PACKAGE'},
    ports:[{postMessage(packet){packets.push(packet)}}],
    source:null,
    waitUntil(promise){pending=Promise.resolve(promise)}
  });
  return pending.then(()=>packets[0]);
}
const success=await repairHarness();
assert.equal(success?.type,'CIVWEAVE_DEVICE_PACKAGE_REPAIR');
assert.equal(success?.ready,true);
assert.equal(success?.repaired,true);
assert.equal(success?.integrity,'verified');
const failure=await repairHarness({fail:true});
assert.equal(failure?.type,'CIVWEAVE_DEVICE_PACKAGE_REPAIR');
assert.equal(failure?.ready,false);
assert.equal(failure?.repaired,false);
assert.equal(failure?.failures?.[0]?.pathname,'/app/installed-entry-v146.html');

console.log(JSON.stringify({
  ok:true,
  revision:'installed-shell-repair-v293',
  version,
  shellIntegrityAssets:integrity.requiredAssetCount,
  shellIntegrityDerivedFromRuntime:true,
  repairMessage:'REPAIR_DEVICE_PACKAGE',
  repairScope:'verified-small-shell-only',
  preservedStorage:['offline-campus','models','open-learning-media','knowledge-schools'],
  workerGeneratorLocked:true,
  canonicalMaterializerRegeneratesIntegrity:true,
  manualFirstShell:true
},null,2));