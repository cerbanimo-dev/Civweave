import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [installerFallback,returnGuard]=await Promise.all([
  read('public/app/installer-online-fallback-v225.js'),
  read('public/app/working-campus-return-guard-v425.js')
]);

new Function(installerFallback);
new Function(returnGuard);

assert.match(installerFallback,/function resumeRequiredNext\(\)/,'Installer lost required-next recovery.');
assert.match(installerFallback,/params\.get\('install'\) === 'required'/,'Installer no longer recognizes install=required.');
assert.match(installerFallback,/CANONICAL_NEXT_PATHS/,'Installer required-next recovery is not allowlisted.');
assert.match(installerFallback,/target\.searchParams\.set\('installed', '1'\)/,'Recovered next target is not explicitly authorized.');
assert.match(installerFallback,/installer-redirect-loop-failsafe-v1/,'Repeated required-next navigation has no installed-entry failsafe.');
assert.match(installerFallback,/if \(resumeRequiredNext\(\)\) return;/,'Required-next recovery does not run before installer observers and optional tools.');

assert.match(returnGuard,/function preauthorizeCanonicalCampus\(\)/,'Working Campus lost pre-boundary authorization.');
assert.match(returnGuard,/sessionStorage\.setItem\(BOOT_KEY,'1'\)/,'Working Campus does not stamp the current install-boundary boot key.');
assert.match(returnGuard,/sessionStorage\.setItem\(LEGACY_BOOT_KEY,'1'\)/,'Working Campus does not stamp the legacy install-boundary boot key.');
assert.match(returnGuard,/preauthorizeCanonicalCampus\(\);\naddEventListener\('pagehide'/,'Working Campus authorization no longer runs before lifecycle listeners and the shared boundary.');
assert.match(returnGuard,/installBoundaryPolicy:'canonical-campus-preauthorized-before-shared-boundary'/,'Working Campus redirect-loop policy marker drifted.');

console.log(JSON.stringify({
  ok:true,
  revision:'installer-redirect-loop-v1',
  installerRequiredNext:'single-use-allowlisted-next-with-installed-authorization',
  repeatedRedirect:'safe-installed-entry',
  workingCampus:'preauthorized-before-install-boundary'
},null,2));
