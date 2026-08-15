import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const version=(await read('VERSION')).trim();
const [repairOnly,boundary,installedEntryHtml,installedEntryRuntime,returnGuard,localServer]=await Promise.all([
  read('public/app/installer-repair-only-v2.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/installed-entry-v146.html'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/working-campus-return-guard-v425.js'),
  read(`releases/${version}/server/server-local-v131.mjs`)
]);
new Function(repairOnly);new Function(boundary);new Function(installedEntryRuntime);new Function(returnGuard);
assert.match(repairOnly,/function resumeRequiredNext\(\)/,'Installer lost required-next recovery.');
assert.match(repairOnly,/params\.get\('install'\)===['"]required['"]/,'Installer no longer recognizes install=required.');
assert.match(repairOnly,/CANONICAL_NEXT_PATHS/,'Installer required-next recovery is not allowlisted.');
assert.match(repairOnly,/if\(!required\|\|!rawNext\|\|!installedDisplay\(\)\)return false/,'Repair-only required-next recovery must remain conservative outside installed display mode.');
assert.match(repairOnly,/target\.searchParams\.set\('installed','1'\)/,'Installed recovery target is not marked installed.');
assert.match(repairOnly,/browserRuntimePolicy:'installer-only-until-installed-display'/,'Installer repair bridge lost its conservative repair-only policy.');
assert.match(repairOnly,/cacheDistinctPath:true/,'Installer repair bridge lost the stale-cache escape path.');
assert.match(boundary,/const LAUNCH_SESSION_KEY=['"]civweave\.pwa\.launch-session\.v1['"]/,'Shared boundary lost the PWA launch-session key.');
assert.match(boundary,/function allowed\(\)\{return installedDisplay\(\)\|\|launchSession\(\)\|\|developer\(\)\}/,'Shared boundary must authorize only installed display, PWA launch session, or local developer mode.');
assert.doesNotMatch(boundary,/civweave\.pwa\.installed-capability\.v1/,'Shared boundary restored a durable browser-visible runtime capability.');
assert.match(boundary,/installedQueryIsAuthorization:false/,'installed=1 can become authorization again.');
assert.match(installedEntryHtml,/installed-entry-browser-gate-v3-launch-session/,'Installed entry lost its launch-session pre-paint gate.');
assert.match(installedEntryHtml,/globalThis\.launchQueue\.setConsumer/,'Installed entry no longer consumes the PWA launch event.');
assert.match(installedEntryHtml,/sessionStorage\.setItem\(LAUNCH_SESSION_KEY,'1'\)/,'Installed entry does not mint session-scoped launch authorization.');
assert.doesNotMatch(installedEntryHtml,/getInstalledRelatedApps/,'Installed runtime authorization must not come from installed-app discovery.');
assert.match(installedEntryRuntime,/async function installedLaunchAuthorized\(\)/,'Installed runtime lost its launch-session authorization boundary.');
assert.match(installedEntryRuntime,/browserRuntimePolicy:'installed-display-or-pwa-launch-session'/,'Installed runtime policy drifted from PWA launch-session authorization.');
assert.match(returnGuard,/function preauthorizeCanonicalCampus\(\)/,'Working Campus lost its installed-return recovery marker.');
assert.match(localServer,/const isInstallerSurface = originalPathname === '\/app\/index\.html'/,'Local host no longer exempts the installer document from legacy /app redirects.');
assert.match(localServer,/if \(!isAsset && !isInstallerSurface\)/,'Legacy route redirect can catch the installer document again.');
console.log(JSON.stringify({ok:true,revision:'installer-redirect-loop-pwa-launch-session-v1',installerRequiredNext:'repair-display-only',browserRuntime:'installed-display-or-pwa-launch-session',installedQueryAuthorization:false,prePaintGate:true,pwaLaunchQueue:true,workingCampusReturnGuardRetained:true,installerServerException:true,cacheDistinctRepair:true},null,2));