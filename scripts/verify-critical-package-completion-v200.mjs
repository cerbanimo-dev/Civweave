import {access,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
await import('./verify-living-school-cleanroom-v218.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const syntax=file=>{const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});assert.equal(result.status,0,`${file} syntax error:\n${result.stderr||result.stdout}`)};
const [wrapper,core,cleanup,critical,shell,nav,installer,pwa]=await Promise.all([
  read('public/service-worker-v203.js'),read('public/service-worker-core-v208.js'),read('public/service-worker-living-school-cleanroom-v218.js'),read('public/service-worker-critical-v199.js'),read('public/app/cabinets/living-school/index.html'),read('public/app/themed-system-nav-v178.js'),read('public/install-v130.js'),read('public/app/pwa-v130.js')
]);
for(const file of ['public/service-worker-living-school-cleanroom-v218.js','public/service-worker-core-v208.js','public/app/themed-system-nav-v178.js'])syntax(file);
const cleanIndex=wrapper.indexOf("importScripts('/service-worker-living-school-cleanroom-v218.js");
const coreIndex=wrapper.indexOf("importScripts('/service-worker-core-v208.js");
assert(cleanIndex>=0&&coreIndex>cleanIndex,'Living School cache boundary must load before the retained worker core.');
assert(core.includes("const BUILD = 'lightweight-shell-v208-installer-brand-v1-working-campus-return-v425'"),'Retained lightweight worker core lost the v425 return cache epoch.');
assert(core.includes("'/app/working-campus-return-guard-v425.js'"),'Retained worker core no longer precaches the Working Campus return guard.');
assert(wrapper.includes('working-campus-return-v425'),'Active worker wrapper no longer forces the v425 return cache epoch.');
for(const token of ['DOWNLOAD_OFFLINE_PACKAGE','GET_DEVICE_PACKAGE_STATUS','GET_OFFLINE_PACKAGE_STATUS'])assert(core.includes(token),`Retained worker core is missing ${token}.`);
for(const token of ["const CANONICAL='/app/cabinets/living-school/index.html'",'evictManaged()','event.stopImmediatePropagation()','cache:\'no-store\''])assert(cleanup.includes(token),`Living School worker boundary is missing ${token}.`);
for(const retiredToken of ['RETIRED_PATHS','evictRetired','retiredResponse'])assert(!cleanup.includes(retiredToken),`Living School worker still carries retired-version shim ${retiredToken}.`);
const retiredFiles=['living-school-bootstrap-v194.js','living-school-cabinet-v151.mjs','living-school-curriculum-launch-v212.js','living-school-flat-loader-v203.js','living-school-flat-loader-v211.js','living-school-flat-loader-v212.js','living-school-flat-loader-v213.js','living-school-interactions-v213.js','living-school-mutation-guard-v196.js','living-school-paths-v160.js','living-school-paths-v211.js','living-school-paths-v213.js','living-school-research-v162.js','living-school-runtime-stability-v159.js','living-school-two-agent-relay-v165.js','living-school-workbench-v158.js'];
for(const retired of retiredFiles){let exists=true;try{await access(path.join(root,'public/app/cabinets/living-school',retired))}catch{exists=false}assert.equal(exists,false,`Retired Living School file was restored: ${retired}`)}
assert(shell.includes('data-living-school-runtime="cleanroom-v218"')&&shell.includes('living-school-cleanroom-v218.mjs'),'Canonical Living School shell is not clean-room v218.');
assert(!/data-room|setRoom|living-school-flat-loader|living-school-workbench|living-school-two-agent-relay/.test(shell),'Canonical shell includes a legacy tripwire.');
for(const token of ['/app/fellowfare-cabinet-v144.html','/app/cerbanimo-deterministic-boundary-v203.js','/app/weaveling-memory-bridge-v191.js'])assert(critical.includes(token),`Other-realm critical compatibility lost ${token}.`);
for(const asset of ['Civweave-weaveling-sprites.png','Living-School-moss-sprites.png','Cerbanimo-kamiya-sprites.png','FellowFare-rook-sprites.png','Anarchadia-merlin-sprites.png'])assert(nav.includes(asset),`Shared five-system navigation lost expressive atlas ${asset}.`);
assert(nav.includes('background-size:500% 400%,cover')&&nav.includes('civweave:subsystem-avatar-state'),'Shared five-system navigation lost expressive subsystem-state rendering.');
assert(installer.includes('/service-worker-v203.js')&&pwa.includes('/service-worker-v203.js'),'Installed apps no longer request the active worker wrapper.');
console.log(JSON.stringify({ok:true,repair:'living-school-cleanroom',workingCampusReturn:'v425',workerOrder:['living-school-cache-boundary','retained-lightweight-core-v425'],offlineCampusPreserved:true,otherRealmCompatibilityPreserved:true,expressiveFiveSystemNavigation:true,retiredLivingSchoolFiles:retiredFiles.length,legacyLivingSchoolFilesPhysicallyPresent:false},null,2));
