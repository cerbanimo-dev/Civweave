import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [installerRepair,returnGuard,boundary]=await Promise.all([
  read('public/app/installer-repair-only-v1.js'),
  read('public/app/working-campus-return-guard-v425.js'),
  read('public/app/install-boundary-v146.js')
]);

new Function(installerRepair);
new Function(returnGuard);
new Function(boundary);

assert.match(installerRepair,/function resumeRequiredNext\(\)/,'Installer lost required-next recovery.');
assert.match(installerRepair,/params\.get\('install'\)===\s*'required'/,'Installer no longer recognizes install=required.');
assert.match(installerRepair,/CANONICAL_NEXT_PATHS/,'Installer required-next recovery is not allowlisted.');
assert.match(installerRepair,/!required\|\|!rawNext\|\|!installedDisplay\(\)/,'Required-next recovery can run in an ordinary browser tab.');
assert.match(installerRepair,/target\.searchParams\.set\('installed','1'\)/,'Recovered installed target lost its diagnostic launch marker.');
assert.match(installerRepair,/if\(resumeRequiredNext\(\)\)return;/,'Required-next recovery does not run before installer observers and optional tools.');
assert.match(installerRepair,/browserRuntimePolicy:'installer-only-until-installed-display'/,'Installer no longer declares the install-only browser policy.');
assert.doesNotMatch(installerRepair,/function openCampus/,'Installer repair bridge restored a browser-campus launcher.');

assert.match(boundary,/function allowed\(\)\{return installedDisplay\(\)\|\|developer\(\)\}/,'Shared boundary no longer requires installed display mode.');
assert.match(boundary,/installedQueryIsAuthorization:false/,'installed=1 became an authorization token again.');
assert.doesNotMatch(boundary,/Boolean\(systemSurface\(\)\)\|\|installedDisplay\(\)\|\|explicitInstalled\(\)/,'Canonical routes can self-authorize in browser tabs again.');

// The return guard still stamps legacy boot keys for BFCache compatibility, but the shared boundary must ignore them.
assert.match(returnGuard,/function preauthorizeCanonicalCampus\(\)/,'Working Campus lost its legacy BFCache compatibility marker.');
assert.match(returnGuard,/sessionStorage\.setItem\(BOOT_KEY,'1'\)/,'Working Campus no longer stamps the current legacy boot key.');
assert.match(returnGuard,/sessionStorage\.setItem\(LEGACY_BOOT_KEY,'1'\)/,'Working Campus no longer stamps the prior legacy boot key.');
assert.match(boundary,/function explicitInstalled\(\)/,'Boundary lost diagnostic installed-state reporting.');
assert.match(boundary,/function allowed\(\)\{return installedDisplay\(\)\|\|developer\(\)\}/,'Legacy boot keys are being trusted as runtime authorization.');

console.log(JSON.stringify({
  ok:true,
  revision:'installer-redirect-loop-v2-install-only-pwa',
  installerRequiredNext:'single-use-allowlisted-next-installed-display-only',
  repeatedRedirect:'browser-stays-installer-installed-app-resumes',
  installedQueryAuthorization:false,
  browserRuntime:false,
  workingCampus:'legacy-bfcache-marker-non-authorizing'
},null,2));