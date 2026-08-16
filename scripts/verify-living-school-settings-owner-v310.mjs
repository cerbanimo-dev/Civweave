import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
await import('./verify-system-ownership-v317.mjs');
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [living,actions,shell,gateway]=await Promise.all([
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/cabinets/living-school/living-school-cleanroom-actions-v218.mjs'),
  read('public/app/family-shell-v104.js'),
  read('public/app/settings-gateway-v317.js')
]);
assert.doesNotMatch(living,/>Settings<\/button>/i,'Living School may not ship a realm-local Settings button.');
assert.doesNotMatch(living,/data-living-school-settings-owner|data-ls-action="open-ai-settings"/);
assert.doesNotMatch(actions,/['"]open-ai-settings['"]|CivweaveFamilyAILoaderV105\?\.openSettings/,'Living School cabinet actions regained a private Settings route.');
assert.match(living,/family-shell-v104\.js/);
assert.match(shell,/data-open-unified-ai-settings/);
assert.match(gateway,/document\.addEventListener\('click',onClick,true\)/);
assert.match(gateway,/data-settings-tabs="1"/,'The canonical Settings owner must own the shared tab composition.');
assert.match(gateway,/geminiPresetsBuiltIn:true/,'Gemini preset controls must belong to the shared Settings owner, not a realm.');
console.log(JSON.stringify({ok:true,revision:'living-school-settings-owner-v322',owner:'settings-gateway-v317',livingSchoolRealmLocalSettings:false,livingSchoolPrivateSettingsAction:false,sharedFamilyControl:true,canonicalComposition:true},null,2));