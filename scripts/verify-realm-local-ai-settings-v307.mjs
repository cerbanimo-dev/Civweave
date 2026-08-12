import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  boundary,
  lifecycle,
  settings,
  controller,
  routes,
  cerbanimo,
  livingSchool,
  fellowfare,
  anarchadia,
  campus
] = await Promise.all([
  'public/app/install-boundary-v146.js',
  'public/app/document-lifecycle-v221.js',
  'public/app/local-ai/settings-panel-v267.js',
  'public/app/model-settings-controller-v173.js',
  'public/app/system-routes-v227.js',
  'public/app/realm-console-v140.html',
  'public/app/cabinets/living-school/index.html',
  'public/app/fellowfare-cabinet-v144.html',
  'public/app/anarchadia-console-v139.html',
  'public/app/working-campus-v156.html'
].map(read));

for (const source of [boundary, lifecycle, settings, controller]) new Function(source);

assert.match(boundary, /const DOCUMENT_LIFECYCLE='\/app\/document-lifecycle-v221\.js';/);
const canonical = boundary.match(/const CANONICAL_SYSTEM_SCRIPTS=\[([^\]]+)\]/)?.[1] || '';
assert.ok(canonical.includes('DOCUMENT_LIFECYCLE'), 'Canonical realm support must load document lifecycle.');
assert.match(boundary, /realmLocalAISettingsRevision:'v307-lazy-management-via-document-lifecycle'/);

assert.match(lifecycle, /addEventListener\('civweave:model-settings-opened',\(\)=>ensureLocalAISettingsManagement\(\)\)/);
assert.match(lifecycle, /ensureMinimalManagement/);
assert.match(lifecycle, /settings-panel-v267\.js/);
assert.match(lifecycle, /managementOnly:true/);
assert.match(lifecycle, /inferenceDormantOnOpen:true/);

for (const token of ['Downloaded local AI', 'Download', 'Resume', 'Use locally', 'Remove', 'Model window', 'Civweave working default']) {
  assert.ok(settings.includes(token), `Local AI settings lost ${token}.`);
}
assert.match(settings, /data-local-download/);
assert.match(settings, /data-local-use/);
assert.match(settings, /data-local-remove/);
assert.match(settings, /\[data-settings-tab-panel="local-models"\]/);

const realms = new Map([
  ['cerbanimo', cerbanimo],
  ['living-school', livingSchool],
  ['fellowfare', fellowfare],
  ['anarchadia', anarchadia]
]);
for (const [name, html] of realms) {
  assert.ok(html.includes('/app/install-boundary-v146.js'), `${name} must enter the canonical install boundary.`);
  assert.ok(html.includes('/app/model-settings-controller-v173.js'), `${name} must retain the clean-room settings controller.`);
}
for (const pathname of ['/app/realm-console-v140.html', '/app/cabinets/living-school/index.html', '/app/fellowfare-cabinet-v144.html', '/app/anarchadia-console-v139.html']) {
  assert.ok(routes.includes(`pathname:'${pathname}'`), `Missing canonical route ${pathname}.`);
}
assert.ok(campus.includes('/app/document-lifecycle-v221.js'), 'Civweave campus must retain direct lifecycle support.');

console.log(JSON.stringify({
  ok: true,
  revision: 'realm-local-ai-settings-v307',
  realms: [...realms.keys()],
  managementOnly: true,
  inferenceDormantOnOpen: true
}, null, 2));
