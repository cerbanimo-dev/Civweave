import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
await import('./verify-system-ownership-v317.mjs');
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [living,shell,gateway]=await Promise.all([
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/family-shell-v104.js'),
  read('public/app/settings-gateway-v317.js')
]);
assert.doesNotMatch(living,/>Settings<\/button>/i,'Living School may not ship a realm-local Settings button.');
assert.doesNotMatch(living,/data-living-school-settings-owner|data-ls-action="open-ai-settings"/);
assert.match(living,/family-shell-v104\.js/);
assert.match(shell,/data-open-unified-ai-settings/);
assert.match(gateway,/document\.addEventListener\('click',onClick,true\)/);
console.log(JSON.stringify({ok:true,revision:'living-school-settings-owner-v317',owner:'settings-gateway-v317',livingSchoolRealmLocalSettings:false,sharedFamilyControl:true},null,2));
