import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [versionText,integrityText,wrapper,repairWorker,repairOnly,legacyAlias,builder,materializer,generator,coreWorker,installerWorker]=await Promise.all([
  read('VERSION'),read('public/app/shell-integrity-v281.json'),read('public/service-worker-v203.js'),read('public/service-worker-shell-repair-v293.js'),read('public/app/installer-repair-only-v1.js'),read('public/app/installer-online-fallback-v225.js'),read('scripts/build-service-worker-v211.mjs'),read('scripts/materialize-canonical-release.mjs'),read('scripts/generate-prelive-metadata-v281.mjs'),read('public/service-worker-core-v208.js'),read('public/service-worker-installer-state-v280.js')
]);
const version=versionText.trim(),integrity=JSON.parse(integrityText);
function extractStringArray(source,name,label){
  const match=source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[(.*?)\\];`,'s'));
  assert.ok(match,`Could not locate ${name} in ${label}.`);
  const value=Function(`"use strict"; return [${match[1]}];`)();
  assert.ok(Array.isArray(value)&&value.every(item=>typeof item==='string'),`${name} in ${label} must be a string array.`);return value;
}
const requiredShellAssets=[...new Set([...extractStringArray(coreWorker,'REQUIRED_SHELL_ASSETS','service-worker-core-v208.js'),...extractStringArray(installerWorker,'INSTALLER_STATE_ASSETS','service-worker-installer-state-v280.js')])];
const requiredShellAssetCount=requiredShellAssets.length;
assert.match(version,/^\d+\.\d+\.\d+$/);assert.equal(integrity.version,version);assert.equal(integrity.revision,'shell-integrity-v281');assert.equal(integrity.algorithm,'sha256');
assert.equal(integrity.requiredAssetCount,requiredShellAssetCount,'Shell integrity count drifted from runtime required assets.');
for(const pathname of requiredShellAssets)assert.ok(pathname in (integrity.assets||{}),`Shell integrity metadata is missing ${pathname}.`);
for(const [pathname,digest] of Object.entries(integrity.assets||{})){assert.ok(pathname.startsWith('/'));assert.match(String(digest),/^[a-f0-9]{64}$/i)}
const order=['/service-worker-living-school-cleanroom-v218.js','/service-worker-code-coherence-v288.js','/service-worker-core-v208.js','/service-worker-installed-launch-v282.js','/service-worker-installer-state-v280.js','/service-worker-shell-integrity-v281.js','/service-worker-shell-repair-v293.js','/service-worker-offline-v211-override.js'];
let previous=-1;for(const token of order){const index=wrapper.indexOf(token);assert.ok(index>previous,`Active worker order is missing or incorrect for ${token}.`);previous=index}
assert.ok(builder.includes("'public/service-worker-shell-repair-v293.js'"),'Worker generator can erase installed shell repair.');
assert.ok(builder.includes('install-only-pwa-v1'),'Worker generator can erase install-only boundary.');
assert.ok(materializer.includes("['scripts/generate-prelive-metadata-v281.mjs']"),'Canonical release materialization does not regenerate shell integrity metadata.');
assert.ok(generator.includes("crypto.createHash('sha256')"),'Pre-live metadata generator lost shell hashing.');
for(const token of ["const REVISION='installed-shell-repair-v293'","event.data?.type!=='REPAIR_DEVICE_PACKAGE'",'const result=await cacheShell()','const status=await shellStatus()',"policy:'verified-shell-only-preserve-campus-model-school-storage'"])assert.ok(repairWorker.includes(token),`Installed shell repair worker is missing ${token}`);
for(const [label,pattern] of [
  ['repair-state detection',/needs\? repair/],
  ['repair message dispatch',/worker\.postMessage\(\{type:'REPAIR_DEVICE_PACKAGE'\}/],
  ['repair response validation',/packet\?\.type!==['"]CIVWEAVE_DEVICE_PACKAGE_REPAIR['"]/],
  ['preserved storage policy',/storagePolicy:'preserve-campus-model-media-school-storage'/],
  ['repair button copy',/installButton\.textContent='Repair shell'/]
])assert.match(repairOnly,pattern,`Repair-only UI is missing ${label}`);
assert.match(repairOnly,/new MessageChannel\(\)/,'Repair UI no longer uses a reply channel.');
assert.match(repairOnly,/\[channel\.port2\]/,'Repair UI no longer transfers the reply port.');
assert.match(repairOnly,/browserRuntimePolicy:'installer-only-until-installed-display'/,'Repair UI can reopen browser runtime.');
assert.match(legacyAlias,/retired:true/,'Legacy online fallback alias is not marked retired.');
assert.match(legacyAlias,/browserRuntime:false/,'Legacy online fallback alias can still authorize browser runtime.');
assert.doesNotMatch(legacyAlias,/function openCampus\(/,'Legacy alias still contains campus launcher.');
function repairHarness({fail=false}={}){
  let messageHandler=null;const packets=[];
  const context={console,Promise,Array,Boolean,String,Error,VERSION:version,BUILD:'lightweight-shell-v208',cacheShell:async()=>{if(fail){const error=new Error('Integrity mismatch');error.failures=[{pathname:'/app/installed-entry-v146.html',message:'Integrity mismatch'}];throw error}return{integrity:'verified',integrityRevision:'shell-integrity-v281',optionalFailures:[]}},shellStatus:async()=>({ready:true,assetCount:requiredShellAssetCount,presentCount:requiredShellAssetCount,missing:[]}),self:{addEventListener(type,handler){if(type==='message')messageHandler=handler}}};
  vm.createContext(context);vm.runInContext(repairWorker,context,{filename:'service-worker-shell-repair-v293.js'});assert.equal(typeof messageHandler,'function');let pending=Promise.resolve();messageHandler({data:{type:'REPAIR_DEVICE_PACKAGE'},ports:[{postMessage(packet){packets.push(packet)}}],source:null,waitUntil(promise){pending=Promise.resolve(promise)}});return pending.then(()=>packets[0]);
}
const success=await repairHarness();assert.equal(success?.type,'CIVWEAVE_DEVICE_PACKAGE_REPAIR');assert.equal(success?.ready,true);assert.equal(success?.repaired,true);assert.equal(success?.integrity,'verified');
const failure=await repairHarness({fail:true});assert.equal(failure?.type,'CIVWEAVE_DEVICE_PACKAGE_REPAIR');assert.equal(failure?.ready,false);assert.equal(failure?.repaired,false);
console.log(JSON.stringify({ok:true,revision:'installed-shell-repair-v293-install-only-v1',version,shellIntegrityAssets:integrity.requiredAssetCount,repairMessage:'REPAIR_DEVICE_PACKAGE',repairScope:'verified-small-shell-only',browserRuntime:false,legacyAliasRetired:true,preservedStorage:['offline-campus','models','open-learning-media','knowledge-schools'],workerGeneratorLocked:true},null,2));
