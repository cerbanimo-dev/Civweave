import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
await import('./verify-living-school-cleanroom-v218.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const [wrapper,core,cleanup,critical,shell,nav,installer,pwa]=await Promise.all([
  read('public/service-worker-v203.js'),read('public/service-worker-core-v208.js'),read('public/service-worker-living-school-cleanroom-v218.js'),read('public/service-worker-critical-v199.js'),read('public/app/cabinets/living-school/index.html'),read('public/app/themed-system-nav-v178.js'),read('public/install-v130.js'),read('public/app/pwa-v130.js')
]);
new Function(cleanup);new Function(core);new Function(nav);
const cleanIndex=wrapper.indexOf("importScripts('/service-worker-living-school-cleanroom-v218.js");
const coreIndex=wrapper.indexOf("importScripts('/service-worker-core-v208.js");
assert(cleanIndex>=0&&coreIndex>cleanIndex,'Living School cache retirement must load before the retained worker core.');
assert(core.includes("const BUILD = 'lightweight-shell-v208-installer-brand-v1-working-campus-return-v425'"),'Retained lightweight worker core lost the v425 return cache epoch.');
assert(core.includes("'/app/working-campus-return-guard-v425.js'"),'Retained worker core no longer precaches the Working Campus return guard.');
assert(wrapper.includes('working-campus-return-v425'),'Active worker wrapper no longer forces the v425 return cache epoch.');
for(const token of ['DOWNLOAD_OFFLINE_PACKAGE','GET_DEVICE_PACKAGE_STATUS','GET_OFFLINE_PACKAGE_STATUS'])assert(core.includes(token),`Retained worker core is missing ${token}.`);
for(const token of ["const REVISION='living-school-cleanroom-v218'","const CANONICAL='/app/cabinets/living-school/index.html'",'RETIRED_PATHS','evictRetired()','event.stopImmediatePropagation()','cache:\'no-store\''])assert(cleanup.includes(token),`Living School worker boundary is missing ${token}.`);
for(const retired of ['living-school-bootstrap-v194.js','living-school-cabinet-v151.mjs','living-school-workbench-v158.js','living-school-interactions-v213.js','living-school-paths-v213.js','living-school-two-agent-relay-v165.js'])assert(cleanup.includes(retired),`Worker cleanup does not retire ${retired}.`);
assert(shell.includes('data-living-school-runtime="cleanroom-v218"')&&shell.includes('living-school-cleanroom-v218.mjs'),'Canonical Living School shell is not clean-room v218.');
assert(!/data-room|setRoom|living-school-flat-loader|living-school-workbench|living-school-two-agent-relay/.test(shell),'Canonical shell includes a legacy tripwire.');
for(const token of ['/app/fellowfare-cabinet-v144.html','/app/cerbanimo-deterministic-boundary-v203.js','/app/weaveling-memory-bridge-v191.js'])assert(critical.includes(token),`Other-realm critical compatibility lost ${token}.`);
for(const asset of ['Civweave-weaveling-sprites.png','Living-School-moss-sprites.png','Cerbanimo-kamiya-sprites.png','FellowFare-rook-sprites.png','Anarchadia-merlin-sprites.png'])assert(nav.includes(asset),`Shared five-system navigation lost expressive atlas ${asset}.`);
assert(nav.includes('background-size:500% 400%,cover')&&nav.includes('civweave:subsystem-avatar-state'),'Shared five-system navigation lost expressive subsystem-state rendering.');
assert(installer.includes('/service-worker-v203.js')&&pwa.includes('/service-worker-v203.js'),'Installed apps no longer request the rotated v203 wrapper.');
console.log(JSON.stringify({ok:true,repair:'living-school-cleanroom-v218',workingCampusReturn:'v425',workerOrder:['living-school-cache-retirement','retained-lightweight-core-v425'],offlineCampusPreserved:true,otherRealmCompatibilityPreserved:true,expressiveFiveSystemNavigation:true,legacyLivingSchoolCacheEviction:true},null,2));