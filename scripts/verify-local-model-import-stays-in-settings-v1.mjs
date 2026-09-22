import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/app/settings-local-route-v331.js',import.meta.url),'utf8');
new vm.Script(source,{filename:'settings-local-route-v331.js'});

assert.match(source,/data-local-pack-import=/,'Browser pack state must expose an in-Settings import button.');
assert.match(source,/browser\?\.pickAndImport|browser\.pickAndImport/,'Import action must use the local file picker directly.');
assert.match(source,/importStaysInSettings:true/,'Action route must declare in-Settings import ownership.');
assert.doesNotMatch(source,/href=`\/app\/index\.html\?source=settings-ai-pack-import/,'Local Models must not navigate to the whole-app downloads page to import model files.');
assert.doesNotMatch(source,/target=\"_blank\"[^\n]*Import finished downloads/,'Local Models import must not open a new app/downloads page.');
assert.match(source,/function settingsVisible\(\)/,'Download dock must know when Settings is open.');
assert.match(source,/if\(settingsVisible\(\)\)\{hideDock\(\);return\}/,'Download dock must be suppressed while Settings is visible.');
assert.match(source,/downloadDockOutsideSettingsOnly:true/,'Action route must declare the dock boundary.');
assert.doesNotMatch(source,/new\s+MutationObserver|MutationObserver\s*\(/,'Fix must remain observer-free.');

console.log(JSON.stringify({ok:true,contract:'local-model-import-stays-in-settings-v1',inSettingsImport:true,wholeAppRedirect:false,settingsDockSuppressed:true,observerFree:true},null,2));
