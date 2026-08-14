import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [repairOnly,boundary,installedEntryHtml,returnGuard]=await Promise.all([
  read('public/app/installer-repair-only-v1.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/installed-entry-v146.html'),
  read('public/app/working-campus-return-guard-v425.js')
]);
new Function(repairOnly);new Function(boundary);new Function(returnGuard);
assert.match(repairOnly,/function resumeRequiredNext\(\)/,'Installer lost required-next recovery.');
assert.match(repairOnly,/params\.get\('install'\)===['"]required['"]/,'Installer no longer recognizes install=required.');
assert.match(repairOnly,/CANONICAL_NEXT_PATHS/,'Installer required-next recovery is not allowlisted.');
assert.match(repairOnly,/if\(!required\|\|!rawNext\|\|!installedDisplay\(\)\)return false/,'Required-next recovery can run outside installed display mode.');
assert.match(repairOnly,/target\.searchParams\.set\('installed','1'\)/,'Installed recovery target is not marked installed.');
assert.match(repairOnly,/browserRuntimePolicy:'installer-only-until-installed-display'/,'Installer repair bridge lost install-only policy.');
assert.match(boundary,/function allowed\(\)\{return installedDisplay\(\)\|\|developer\(\)\}/,'Shared boundary can still authorize ordinary browser runtime.');
assert.match(boundary,/installedQueryIsAuthorization:false/,'installed=1 can become authorization again.');
assert.match(installedEntryHtml,/installed-entry-browser-gate-v1/,'Installed entry lost its pre-paint browser gate.');
assert.match(installedEntryHtml,/location\.replace\(installer\.href\)/,'Installed entry no longer redirects ordinary browser display to installer.');
assert.match(returnGuard,/function preauthorizeCanonicalCampus\(\)/,'Working Campus lost its installed-return recovery marker.');
console.log(JSON.stringify({ok:true,revision:'installer-redirect-loop-install-only-v1',installerRequiredNext:'allowlisted-and-installed-display-only',browserRuntime:false,installedQueryAuthorization:false,prePaintGate:true,workingCampusReturnGuardRetained:true},null,2));
