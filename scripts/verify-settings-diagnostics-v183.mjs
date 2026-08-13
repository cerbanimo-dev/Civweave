import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
await import('./verify-system-ownership-v317.mjs');
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [gateway,delegation,campus,boundary]=await Promise.all([
  read('public/app/settings-gateway-v317.js'),
  read('public/app/settings-delegation-v175.js'),
  read('public/app/working-campus-v156.html'),
  read('public/app/install-boundary-v146.js')
]);
new Function(gateway);new Function(delegation);new Function(boundary);
assert.match(gateway,/inputOwner:true/);
assert.match(gateway,/launchWork:'none'/);
assert.match(gateway,/civweave:model-settings-open-failed/,'Gateway must surface failures for diagnostics without delegating input ownership.');
assert.match(delegation,/retired:true/);
assert.match(delegation,/listenerCount:0/);
assert.match(delegation,/inputOwnership:false/);
assert.doesNotMatch(delegation,/document\.addEventListener\('click'|stopImmediatePropagation\(\)/,'Diagnostics/delegation compatibility code may not intercept Settings input.');
assert.match(campus,/data-open-log-diagnostics/,'Working Campus lost its explicit diagnostics control.');
assert.match(campus,/data-settings-diagnostics="cwlog"/,'Working Campus lost its diagnostics marker.');
assert.match(campus,/data-open-unified-ai-settings/,'Working Campus lost its canonical Settings marker.');
assert.match(boundary,/settingsGatewayRevision:'v317-single-owner-first-click-only'/);
console.log(JSON.stringify({ok:true,revision:'settings-diagnostics-v317-subscriber-only',settingsInputOwner:'settings-gateway-v317',diagnosticsInputOwnership:false,settingsFailureEvent:true,diagnosticsControl:true,settingsOpenBlocking:false},null,2));
