import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
await import('./verify-system-ownership-v317.mjs');
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [gateway,lifecycle,living,boundary,mobile]=await Promise.all([
  read('public/app/settings-gateway-v317.js'),
  read('public/app/document-lifecycle-v221.js'),
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/mobile-ai-hardening-v302.js')
]);
assert.match(gateway,/lazyController:true/);
assert.match(gateway,/lazyManagement:true/);
assert.match(gateway,/managementAfterPaint:true/);
assert.match(lifecycle,/document-lifecycle-v317-explicit-activation/);
assert.match(lifecycle,/activationRequired:true/);
assert.doesNotMatch(living,/>Settings<\/button>/i);
assert.match(living,/family-shell-v104\.js/);
assert.ok(boundary.indexOf('SETTINGS_GATEWAY')<boundary.indexOf('EXPERIENCE_ORCHESTRATOR'),'Settings gateway must be registered before general experience modules.');
assert.match(mobile,/mobileFullscreenChat:true/);
assert.doesNotMatch(mobile,/addEventListener\('click'/,'Mobile hardening must not own Settings input.');
console.log(JSON.stringify({ok:true,revision:'mobile-local-settings-v317',systems:5,settingsOwner:'settings-gateway-v317',firstClickActivation:true,managementAfterPaint:true,livingSchoolShared:true},null,2));
