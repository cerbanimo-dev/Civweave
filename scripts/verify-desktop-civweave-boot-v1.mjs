import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [wrapper,assets]=await Promise.all([
  read('public/service-worker-v203.js'),
  read('public/service-worker-shell-assets-v1.js')
]);

assert.match(wrapper,/service-worker-shell-assets-v1\.js\?v=shell-assets-v1-repair-v2/,'Installed worker must retain the release-synchronizer-compatible shell-assets import URL.');
assert.match(wrapper,/desktop-civweave-boot-recovery-v363/,'Installed worker must declare the desktop Civweave recovery revision.');
assert.match(assets,/const REVISION='shell-assets-v1-repair-v10-desktop-boot'/,'Shell-assets runtime must rotate to the desktop boot revision.');

for(const pathname of [
  '/app/system-routes-v227.js',
  '/app/themed-system-nav-v178.js',
  '/app/working-campus-return-guard-v425.js',
  '/app/document-lifecycle-v221.js',
  '/app/working-campus-home-declutter-v1.js'
]){
  assert.ok(assets.includes(`'${pathname}'`),`Required desktop boot asset missing from shell contract: ${pathname}`);
}
assert.match(assets,/requiredCivweaveBoot:\[\.\.\.REQUIRED_CIVWEAVE_BOOT\]/,'Shell status must expose the required Civweave boot set.');
assert.match(assets,/for\(const pathname of \[\.\.\.REQUIRED_FAMILY_NAV,\.\.\.REQUIRED_CIVWEAVE_BOOT\]\)/,'Navigation and Civweave boot assets must both be promoted to REQUIRED_SHELL_ASSETS.');

console.log('Desktop Civweave boot verified: five-guide navigation and blank-screen recovery assets are required installed-shell dependencies.');
