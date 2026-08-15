import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
await import('./verify-system-ownership-v317.mjs');

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const releaseVersion=(await read('VERSION')).trim();
const sources=Object.fromEntries(await Promise.all(Object.entries({
  gateway:'public/app/settings-gateway-v317.js',
  controller:'public/app/model-settings-controller-v173.js',
  lifecycle:'public/app/document-lifecycle-v221.js',
  boundary:'public/app/install-boundary-v146.js',
  coreRuntime:'public/app/core-interface-runtime-v1.js',
  brand:'public/app/civweave-brand.js',
  credential:'public/app/device-credential-persistence-v211.js',
  codeCache:'public/service-worker-code-coherence-v288.js',
  localAICache:'public/service-worker-local-ai-coherence-v307.js',
  criticalCache:'public/service-worker-critical-v199.js',
  routes:'public/app/system-routes-v227.js',
  campusRuntime:'public/app/working-campus-v156.part5.txt'
}).map(async([name,path])=>[name,await read(path)])));
for(const key of ['gateway','controller','lifecycle','boundary','coreRuntime','brand','credential'])assert.doesNotThrow(()=>new Function(sources[key]),`${key} does not compile.`);

// Opening Settings is a tiny input-to-DOM path. It cannot depend on model startup.
assert.match(sources.gateway,/inputOwner:true/);
assert.match(sources.gateway,/lazyController:true/);
assert.match(sources.gateway,/lazyManagement:true/);
assert.match(sources.gateway,/launchWork:'none'/);
assert.match(sources.gateway,/afterPaint\(\(\)=>void ensureManagement\(layer\)\)/);
assert.doesNotMatch(sources.gateway,/bootstrap-v266|runtime-v266|runtime-bridge-v266|test-pulse-v269|navigator\.gpu|new Worker\(/);

assert.match(sources.controller,/const LAYER_ID='cw-ai-settings-cleanroom-v188'/);
assert.match(sources.controller,/searchParams\.get\('activate'\)==='1'/);
assert.match(sources.controller,/providerRuntimeOnOpen:false/);
assert.match(sources.controller,/providerTestsAvailable:false/);
assert.match(sources.controller,/modelDiscoveryAvailable:false/);
assert.match(sources.controller,/singlePassOpen:true/);
assert.match(sources.controller,/layer\.querySelector\('\[data-close\]'\)\.addEventListener/);
const openBlock=sources.controller.slice(sources.controller.indexOf('function open(launcher)'),sources.controller.indexOf('function ensure()'));
for(const forbidden of ['await ','fetch(','.generate(','new Worker(','navigator.gpu','showModal('])assert.ok(!openBlock.includes(forbidden),`Controller open path regained ${forbidden}.`);

// Management is allowed only after the panel is painted and contains no inference startup lane.
assert.match(sources.lifecycle,/activationRequired:true/);
assert.match(sources.lifecycle,/managementAfterPaint:true/);
assert.match(sources.lifecycle,/globalObserverPatch:false/);
for(const forbidden of ['runtime-v266','runtime-bridge-v266','bootstrap-v266','test-pulse-v269','new Worker(','navigator.gpu'])assert.ok(!sources.lifecycle.includes(forbidden),`Settings management regained inference dependency ${forbidden}.`);

// No unrelated subsystem may secretly bootstrap Settings repair.
assert.doesNotMatch(sources.brand,/SettingsRepair|SETTINGS_REPAIR|ai-settings-device-repair/);
assert.match(sources.brand,/settingsDependency:false/);
assert.match(sources.credential,/automaticRestore:false/);
assert.match(sources.credential,/automaticListeners:false/);
assert.match(sources.credential,/settingsApiPatching:false/);
assert.doesNotMatch(sources.credential,/document\.addEventListener\('click'|SETTINGS_SELECTOR|api\.open\s*=/);

// The active campus does not wait for local AI before Settings can paint.
for(const forbidden of ['openSharedSettings','ensureSettingsRepairs','settingsRepairPromise','ai-settings-bind-guard-v230','ai-settings-device-repair-v229'])assert.ok(!sources.campusRuntime.includes(forbidden),`Campus retained old Settings preflight ${forbidden}.`);
assert.match(sources.campusRuntime,/setAttribute\('data-open-unified-ai-settings',''\)/);

// Five active systems enter one boundary, one interface runtime, and one Settings gateway.
assert.match(sources.boundary,/const CORE_INTERFACE_RUNTIME='\/app\/core-interface-runtime-v1\.js'/);
assert.doesNotMatch(sources.boundary,/SYSTEM_EXPERIENCE_SCRIPTS|CANONICAL_SYSTEM_SCRIPTS/);
const boundaryBoot=sources.boundary.match(/function installSystemExperienceSupport\(\)\{([\s\S]*?)\n\}/)?.[1]||'';
assert.match(boundaryBoot,/addScript\(CORE_INTERFACE_RUNTIME\)/);
assert.doesNotMatch(boundaryBoot,/SETTINGS_GATEWAY|DOCUMENT_LIFECYCLE|AI_SETTINGS_BIND_GUARD|AI_SETTINGS_REPAIR/);
assert.match(sources.coreRuntime,/['"]\/app\/settings-gateway-v317\.js['"]/);
for(const forbidden of ['AI_SETTINGS_BIND_GUARD','AI_SETTINGS_REPAIR','DOCUMENT_LIFECYCLE','model-settings-controller-v173.js?activate=1','settings-delegation-v175'])assert.ok(!sources.coreRuntime.includes(forbidden),`Core runtime eagerly includes ${forbidden}.`);
for(const pathname of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert.ok(sources.routes.includes(`pathname:'${pathname}'`),`Route contract is missing ${pathname}.`);

// Offline first click is a release invariant, not an online-only convenience.
for(const key of ['codeCache','localAICache','criticalCache'])assert.ok(sources[key].includes("'/app/settings-gateway-v317.js'"),`${key} does not cache the Settings gateway.`);
assert.ok(sources.codeCache.includes("'/app/model-settings-controller-v173.js'")&&sources.codeCache.includes("'/app/document-lifecycle-v221.js'"),'Code cache cannot activate Settings offline.');
assert.ok(sources.criticalCache.includes("'/app/core-interface-runtime-v1.js'"),'Critical cache does not pin the shared interface runtime.');

console.log(JSON.stringify({ok:true,releaseVersion,revision:'settings-cleanroom-single-gateway-v317',inputOwner:'settings-gateway-v317',interfaceRuntime:'core-interface-runtime-v1',systems:5,synchronousPanelOpen:true,firstClickControllerActivation:true,managementAfterPaint:true,providerRuntimeOnOpen:false,inferenceBootstrapOnOpen:false,prototypePatching:false,settingsApiPatching:false,brandingDependency:false,campusPreflight:false,offlineFirstClick:true},null,2));
