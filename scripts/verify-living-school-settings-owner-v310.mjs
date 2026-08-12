import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [index,cleanroom,parity,orchestrator]=await Promise.all([
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/cabinets/living-school/living-school-cleanroom-v218.mjs'),
  read('public/app/settings-parity-v295.js'),
  read('public/app/experience-orchestrator-v232.js')
]);

const settingsButton=index.match(/<button[^>]*>Settings<\/button>/)?.[0]||'';
assert.ok(settingsButton,'Living School Settings button is missing.');
assert.match(settingsButton,/data-open-unified-ai-settings/,'Living School Settings must be owned by the shared canonical settings surface.');
assert.match(settingsButton,/data-living-school-settings-owner="canonical"/,'Living School Settings ownership marker is missing.');
assert.doesNotMatch(settingsButton,/data-ls-action="open-ai-settings"/,'Living School must not route Settings through its legacy delegated action handler.');

assert.match(cleanroom,/closest\?\.\('\[data-ls-action\]'\)/,'Living School cleanroom action delegation contract changed unexpectedly.');
assert.match(parity,/\[data-open-unified-ai-settings\]/,'Canonical settings parity no longer recognizes the Living School Settings marker.');
assert.match(orchestrator,/\[data-open-unified-ai-settings\]/,'Experience orchestrator no longer recognizes the Living School Settings marker.');
assert.match(parity,/ensureManagement\(\)/,'Canonical settings parity no longer mounts downloaded-local management.');
assert.match(parity,/downloadedLocalManagement:true/,'Canonical settings parity lost downloaded-local ownership.');

console.log(JSON.stringify({ok:true,revision:'living-school-settings-owner-v310',owner:'canonical-settings-parity',legacyLivingSchoolActionBypassed:true,downloadedLocalManagement:true},null,2));
