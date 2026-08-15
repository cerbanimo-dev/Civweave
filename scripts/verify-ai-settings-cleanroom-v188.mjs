import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
await import('./verify-system-ownership-v317.mjs');

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const releaseVersion=(await read('VERSION')).trim();
const [gateway,controller,campusHtml,campusRuntime,workerCore,routes,brand,credential]=await Promise.all([
  'public/app/settings-gateway-v317.js',
  'public/app/model-settings-controller-v173.js',
  'public/app/working-campus-v156.html',
  'public/app/working-campus-v156.js',
  'public/service-worker-core-v208.js',
  'public/app/system-routes-v227.js',
  'public/app/civweave-brand.js',
  'public/app/device-credential-persistence-v211.js'
].map(read));

for(const source of [gateway,controller,campusRuntime,brand,credential])assert.doesNotThrow(()=>new Function(source));

assert.match(gateway,/inputOwner:true/);
assert.match(gateway,/launchWork:'none'/);
assert.match(gateway,/generativeRuntimeOnOpen:false/);
assert.match(gateway,/workingCampusStaticController:true/);
assert.doesNotMatch(gateway,/bootstrap-v266|runtime-v266|runtime-bridge-v266|test-pulse-v269|navigator\.gpu|new Worker\(|document-lifecycle-v221/);

assert.match(controller,/const LAYER_ID='cw-ai-settings-cleanroom-v188'/);
assert.match(controller,/searchParams\.get\('activate'\)==='1'/);
assert.match(controller,/providerRuntimeOnOpen:false/);
assert.match(controller,/providerTestsAvailable:false/);
assert.match(controller,/modelDiscoveryAvailable:false/);
assert.match(controller,/singlePassOpen:true/);
const openBlock=controller.slice(controller.indexOf('function open(launcher)'),controller.indexOf('function ensure()'));
for(const forbidden of ['await ','fetch(','.generate(','new Worker(','navigator.gpu','showModal('])assert.ok(!openBlock.includes(forbidden),`Controller open path regained ${forbidden}.`);

assert.match(campusHtml,/model-settings-controller-v173\.js\?activate=1/);
assert.match(campusHtml,/settings-gateway-v317\.js/);
assert.doesNotMatch(campusHtml,/document-lifecycle-v221|working-campus-return-guard-v425|install-boundary-v146/);
assert.doesNotMatch(campusRuntime,/Function\s*\(|working-campus-v156\.part|repairPersistedCampusState/);
assert.match(campusRuntime,/generativeStart:'submit-only'/);

assert.doesNotMatch(brand,/SettingsRepair|SETTINGS_REPAIR|ai-settings-device-repair/);
assert.match(brand,/settingsDependency:false/);
assert.match(credential,/automaticRestore:false/);
assert.match(credential,/automaticListeners:false/);
assert.match(credential,/settingsApiPatching:false/);

for(const pathname of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])
  assert.ok(routes.includes(`pathname:'${pathname}'`),`Route contract is missing ${pathname}.`);

for(const pathname of ['/app/settings-gateway-v317.js','/app/model-settings-controller-v173.js','/app/working-campus-v156.html','/app/working-campus-v156.js'])
  assert.ok(workerCore.includes(`'${pathname}'`),`Offline shell is missing ${pathname}.`);

console.log(JSON.stringify({
  ok:true,
  releaseVersion,
  revision:'settings-cleanroom-static-interface-v1',
  inputOwner:'settings-gateway-v317',
  systems:5,
  workingCampusStaticController:true,
  synchronousPanelOpen:true,
  providerRuntimeOnOpen:false,
  inferenceBootstrapOnOpen:false,
  brandingDependency:false,
  campusFragmentEval:false,
  offlineFirstClick:true
},null,2));
