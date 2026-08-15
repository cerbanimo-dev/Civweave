import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
await import('./verify-system-ownership-v317.mjs');
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const releaseVersion=(await read('VERSION')).trim();
const sources=Object.fromEntries(await Promise.all(Object.entries({gateway:'public/app/settings-gateway-v317.js',controller:'public/app/model-settings-controller-v173.js',lifecycle:'public/app/document-lifecycle-v221.js',boundary:'public/app/install-boundary-v146.js',coreRuntime:'public/app/core-interface-runtime-v1.js',brand:'public/app/civweave-brand.js',credential:'public/app/device-credential-persistence-v211.js',codeCache:'public/service-worker-code-coherence-v288.js',localAICache:'public/service-worker-local-ai-coherence-v307.js',criticalCache:'public/service-worker-critical-v199.js',routes:'public/app/system-routes-v227.js',campusRuntime:'public/app/working-campus-v156.part5.txt'}).map(async([name,path])=>[name,await read(path)])));
for(const key of ['gateway','controller','lifecycle','boundary','coreRuntime','brand','credential'])assert.doesNotThrow(()=>new Function(sources[key]),`${key} does not compile.`);

assert.match(sources.gateway,/inputOwner:true,presentationOwner:true,credentialOwner:true/);
assert.match(sources.gateway,/singleMenu:true/);
assert.match(sources.gateway,/singleLauncherListener:true/);
assert.match(sources.gateway,/launchWork:'none'/);
assert.match(sources.gateway,/afterPaint\(\(\)=>void ensureManagement\(layer\)\)/);
assert.match(sources.gateway,/data-cw-language-settings="v320"/);
assert.match(sources.gateway,/data-settings-tab-panel="local-models"/);
assert.doesNotMatch(sources.gateway,/bootstrap-v266|runtime-v266|runtime-bridge-v266|test-pulse-v269|navigator\.gpu|new Worker\(/);
const openBlock=sources.gateway.slice(sources.gateway.indexOf('function open(launcher)'),sources.gateway.indexOf('function ensure()'));
for(const forbidden of ['await ','fetch(','.generate(','new Worker(','navigator.gpu','showModal('])assert.ok(!openBlock.includes(forbidden),`Canonical Settings open path regained ${forbidden}.`);

assert.match(sources.controller,/compatibilityFacade:true/);
assert.match(sources.controller,/canonical:'CivweaveSettingsV320'/);
assert.match(sources.controller,/presentationOwnership:false/);
assert.match(sources.controller,/domCreation:false/);
assert.doesNotMatch(sources.controller,/document\.createElement|addEventListener\('click'|showModal/);

assert.match(sources.lifecycle,/activationRequired:true/);
assert.match(sources.lifecycle,/managementAfterPaint:true/);
assert.match(sources.lifecycle,/serviceRole:'downloaded-model-settings-content'/);
assert.match(sources.lifecycle,/presentationOwnership:false/);
assert.match(sources.lifecycle,/settingsRootCreation:false/);
assert.match(sources.lifecycle,/cw-settings-v320/);
for(const forbidden of ['runtime-v266','runtime-bridge-v266','bootstrap-v266','test-pulse-v269','new Worker(','navigator.gpu'])assert.ok(!sources.lifecycle.includes(forbidden),`Settings management regained inference dependency ${forbidden}.`);

assert.doesNotMatch(sources.brand,/SettingsRepair|SETTINGS_REPAIR|ai-settings-device-repair/);
assert.match(sources.brand,/settingsDependency:false/);
assert.match(sources.credential,/automaticRestore:false/);
assert.match(sources.credential,/automaticListeners:false/);
assert.match(sources.credential,/settingsApiPatching:false/);
assert.doesNotMatch(sources.credential,/document\.addEventListener\('click'|SETTINGS_SELECTOR|api\.open\s*=/);
for(const forbidden of ['openSharedSettings','ensureSettingsRepairs','settingsRepairPromise','ai-settings-bind-guard-v230','ai-settings-device-repair-v229'])assert.ok(!sources.campusRuntime.includes(forbidden),`Campus retained old Settings preflight ${forbidden}.`);
assert.match(sources.campusRuntime,/setAttribute\('data-open-unified-ai-settings',''\)/);

assert.match(sources.boundary,/const CORE_INTERFACE_RUNTIME='\/app\/core-interface-runtime-v1\.js'/);
assert.doesNotMatch(sources.boundary,/SYSTEM_EXPERIENCE_SCRIPTS|CANONICAL_SYSTEM_SCRIPTS/,'Install boundary retained a superseded shared loader manifest.');
const boundaryBoot=sources.boundary.match(/function installSystemExperienceSupport\(\)\{([\s\S]*?)\n\}/)?.[1]||'';
assert.match(boundaryBoot,/addScript\(CORE_INTERFACE_RUNTIME\)/);
assert.doesNotMatch(boundaryBoot,/SETTINGS_GATEWAY|DOCUMENT_LIFECYCLE|AI_SETTINGS_BIND_GUARD|AI_SETTINGS_REPAIR/);
assert.match(sources.coreRuntime,/const SHARED_BOOT_SCRIPTS=Object\.freeze\(\[/);
assert.match(sources.coreRuntime,/['"]\/app\/settings-gateway-v317\.js['"]/);
for(const forbidden of ['AI_SETTINGS_BIND_GUARD','AI_SETTINGS_REPAIR','DOCUMENT_LIFECYCLE','model-settings-controller-v173.js?activate=1','settings-delegation-v175'])assert.ok(!sources.coreRuntime.includes(forbidden),`Core runtime eagerly includes ${forbidden}.`);
assert.doesNotMatch(sources.coreRuntime,/data-open-unified-ai-settings|addEventListener[^\n]*\('click'/,'Core runtime may assemble Settings but may not own Settings input.');
for(const pathname of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert.ok(sources.routes.includes(`pathname:'${pathname}'`),`Route contract is missing ${pathname}.`);
for(const key of ['codeCache','localAICache','criticalCache'])assert.ok(sources[key].includes("'/app/settings-gateway-v317.js'"),`${key} does not cache the Settings gateway.`);
assert.ok(sources.criticalCache.includes("'/app/core-interface-runtime-v1.js'"),'Critical cache does not pin the shared interface runtime.');
console.log(JSON.stringify({ok:true,releaseVersion,revision:'settings-v320-single-owner-core-interface-runtime-v1',canonicalApi:'CivweaveSettingsV320',interfaceRuntime:'core-interface-runtime-v1',systems:5,synchronousPanelOpen:true,managementAfterPaint:true,providerRuntimeOnOpen:false,inferenceBootstrapOnOpen:false,prototypePatching:false,settingsApiPatching:false,brandingDependency:false,campusPreflight:false,offlineFirstClick:true},null,2));
