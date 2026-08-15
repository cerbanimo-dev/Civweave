import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

const fileUrl=path=>new URL(`../${path}`,import.meta.url);
const read=path=>readFile(fileUrl(path),'utf8');
const absent=async path=>{
  try{await access(fileUrl(path));return false}
  catch(error){if(error?.code==='ENOENT')return true;throw error}
};
const registry=JSON.parse(await read('config/system-ownership.json'));
const settings=registry.systems.settings;
const paths={
  gateway:'public/app/settings-gateway-v317.js',
  controller:'public/app/model-settings-controller-v173.js',
  lifecycle:'public/app/document-lifecycle-v221.js',
  boundary:'public/app/install-boundary-v146.js',
  orchestrator:'public/app/experience-orchestrator-v232.js',
  shell:'public/app/family-shell-v104.js',
  parity:'public/app/settings-parity-v295.js',
  delegation:'public/app/settings-delegation-v175.js',
  credentialHelper:'public/app/device-credential-persistence-v211.js',
  anarchadiaStability:'public/app/anarchadia-runtime-stability-v159.js',
  brand:'public/app/civweave-brand.js',
  campusRuntime:'public/app/working-campus-v156.part5.txt',
  living:'public/app/cabinets/living-school/index.html',
  campus:'public/app/working-campus-v156.html',
  cerbanimo:'public/app/realm-console-v140.html',
  fellowfare:'public/app/fellowfare-cabinet-v144.html',
  anarchadia:'public/app/anarchadia-console-v139.html',
  codeCache:'public/service-worker-code-coherence-v288.js',
  localAICache:'public/service-worker-local-ai-coherence-v307.js',
  criticalCache:'public/service-worker-critical-v199.js'
};
const retiredRepairPaths=[
  'public/app/ai-settings-bind-guard-v230.js',
  'public/app/ai-settings-device-repair-v229.js'
];
const src=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>[key,await read(path)])));
for(const key of ['gateway','controller','lifecycle','boundary','orchestrator','shell','parity','delegation','credentialHelper','anarchadiaStability','brand'])assert.doesNotThrow(()=>new Function(src[key]),`${paths[key]} does not compile.`);
for(const path of retiredRepairPaths)assert.equal(await absent(path),true,`${path} is retired repair code and must stay physically absent.`);

assert.equal(registry.policy,'extend-existing-owner-never-add-parallel-owner');
assert.equal(settings.inputOwner,paths.gateway);
assert.equal(settings.presentationOwner,paths.controller);
assert.equal(settings.managementSubscriber,paths.lifecycle);
assert.equal(settings.credentialOwner,paths.controller);
assert.equal(settings.canonicalControl,'[data-open-unified-ai-settings]');
assert.deepEqual(settings.allowedInputListenerFiles,[paths.gateway]);
assert.ok(settings.forbiddenInputOwnerFiles.includes(paths.campusRuntime),'Campus runtime must be explicitly registered as a forbidden Settings owner.');
for(const path of retiredRepairPaths)assert.ok(settings.forbiddenInputOwnerFiles.includes(path),`${path} must remain a named forbidden Settings owner after physical retirement.`);

// Gateway: the only Settings input listener, no launch-time implementation work.
assert.match(src.gateway,/const SELECTOR='\[data-open-unified-ai-settings\]'/);
assert.equal((src.gateway.match(/addEventListener\('click'/g)||[]).length,1,'Settings gateway must have exactly one click listener.');
assert.match(src.gateway,/document\.addEventListener\('click',onClick,true\)/);
assert.match(src.gateway,/model-settings-controller-v173\.js\?activate=1/);
assert.match(src.gateway,/document-lifecycle-v221\.js\?activate=1/);
assert.match(src.gateway,/afterPaint\(\(\)=>void ensureManagement\(layer\)\)/);
assert.doesNotMatch(src.gateway,/queueMicrotask\([^)]*ensureController/);
assert.doesNotMatch(src.gateway,/DOMContentLoaded[^\n]*ensureController/);

// Controller: dormant when an old HTML script tag loads it, fixed at the actual close lookup.
assert.match(src.controller,/searchParams\.get\('activate'\)==='1'/);
assert.match(src.controller,/if\(!ACTIVATED\).*dormant:true/s);
assert.match(src.controller,/layer\.querySelector\('\[data-close\]'\)\.addEventListener/);
assert.doesNotMatch(src.controller,/form\.querySelector\('\[data-close\]'\)\.addEventListener/);
assert.doesNotMatch(src.controller,/^restoreRememberedCredential\(\);$/m,'Controller performs credential mutation merely because the script was parsed.');
assert.match(src.controller,/eventOwnership:'none-input-owned-by-settings-gateway-v317'/);

// Known former owners may remain only as callers/subscribers. Retired repair runtimes are deleted, not kept as inert globals.
for(const key of ['orchestrator','parity','delegation','credentialHelper','anarchadiaStability','lifecycle']){
  assert.doesNotMatch(src[key],/addEventListener\('click'[^\n]*(settings|Settings|SELECTOR|data-cwf-settings|openSettings)/i,`${paths[key]} regained Settings click ownership.`);
}
assert.doesNotMatch(src.orchestrator,/SETTINGS_SELECTOR|earlySettings|openSettingsIndependent|ensureSettingsModule|settingsCaptureOwner/);
assert.match(src.orchestrator,/settingsInputOwnership:false/);
assert.match(src.parity,/retiredInputOwner:true/);
assert.match(src.delegation,/listenerCount:0/);
assert.match(src.lifecycle,/searchParams\.get\('activate'\)==='1'/);
assert.match(src.lifecycle,/settingsEntryOwner:'settings-gateway-v317'/);
assert.match(src.lifecycle,/inputOwnership:false/);
assert.doesNotMatch(src.credentialHelper,/SETTINGS_SELECTOR|document\.addEventListener\('click'|api\.open\s*=|originalOpen|patchSettingsApi\(\);\s*$/m,'Credential helper may not intercept input or monkey-patch Settings open().');
assert.match(src.credentialHelper,/automaticRestore:false/);
assert.match(src.credentialHelper,/automaticListeners:false/);
assert.match(src.credentialHelper,/inputOwnership:false/);
assert.match(src.credentialHelper,/settingsApiPatching:false/);
assert.doesNotMatch(src.anarchadiaStability,/data-cwf-settings|closest\?\.\('\[data-open-unified-ai-settings\]'\)/,'Realm stability layer may not intercept any Settings control.');
assert.match(src.anarchadiaStability,/settingsInputOwnership:false/);
assert.match(src.anarchadiaStability,/settingsOwner:'settings-gateway-v317'/);

// Branding is branding. It must never bootstrap Settings or repair code.
assert.doesNotMatch(src.brand,/SETTINGS_REPAIR|ai-settings-device-repair|loadSettingsRepair|settingsRepair:/,'Brand runtime regained a Settings dependency.');
assert.match(src.brand,/settingsDependency:false/);

// The active Civweave campus runtime may mark controls, but may never preflight or own Settings.
for(const forbidden of ['openSharedSettings','ensureSettingsRepairs','settingsRepairPromise','ai-settings-bind-guard-v230','ai-settings-device-repair-v229'])assert.ok(!src.campusRuntime.includes(forbidden),`Campus runtime regained forbidden Settings path ${forbidden}.`);
assert.doesNotMatch(src.campusRuntime,/\$\('#settings-button'\)\.addEventListener\('click'/,'Campus Settings button regained a direct listener.');
assert.doesNotMatch(src.campusRuntime,/\$\('#model-chip'\)\.addEventListener\('click'/,'Campus model chip regained a direct Settings listener.');
assert.match(src.campusRuntime,/setAttribute\('data-open-unified-ai-settings',''\)/,'Campus controls are not delegated to the canonical gateway.');
const localBootstrapIndex=src.campusRuntime.indexOf("'/app/local-ai/bootstrap-v266.js");
const sendWeavelingIndex=src.campusRuntime.indexOf('async function sendWeaveling');
assert.ok(localBootstrapIndex>=0&&sendWeavelingIndex>=0,'Campus lost its explicit inference bootstrap path.');
assert.ok(!src.campusRuntime.slice(0,sendWeavelingIndex).includes('ensureDownloadedLocalAISettings();'),'Campus must not run local-AI bootstrap before an explicit chat/inference action.');

// Install boundary may install the tiny gateway, never an activated implementation or a retired repair runtime.
assert.match(src.boundary,/const SETTINGS_GATEWAY='\/app\/settings-gateway-v317\.js'/);
const experience=src.boundary.match(/const SYSTEM_EXPERIENCE_SCRIPTS=\[([\s\S]*?)\n\];/)?.[1]||'';
assert.match(experience,/SETTINGS_GATEWAY/);
for(const forbidden of ['AI_SETTINGS_BIND_GUARD','AI_SETTINGS_REPAIR','DOCUMENT_LIFECYCLE','model-settings-controller-v173','settings-delegation-v175','settings-parity-v295'])assert.ok(!experience.includes(forbidden),`Launch experience still eagerly contains ${forbidden}.`);
assert.doesNotMatch(src.boundary,/addScript\(AI_SETTINGS_BIND_GUARD\)/);

// Shared family shell displays the button but does not own its input.
assert.match(src.shell,/data-open-unified-ai-settings/);
assert.doesNotMatch(src.shell,/data-cwf-settings/);
assert.doesNotMatch(src.shell,/isSettingsControl|\.onclick=openSettings|function openSettings\(/);
assert.match(src.shell,/settingsOwner:'settings-gateway-v317'/);
assert.match(src.shell,/settingsInputOwnership:false/);

// Living School is not a special Settings implementation anymore.
assert.doesNotMatch(src.living,/>Settings<\/button>/i,'Living School still ships a realm-local Settings button.');
assert.doesNotMatch(src.living,/data-living-school-settings-owner|data-ls-action="open-ai-settings"/);
for(const legacy of ['model-settings-controller-v173.js','ai-settings-bind-guard-v230.js','ai-settings-device-repair-v229.js'])assert.ok(!src.living.includes(legacy),`Living School still directly loads ${legacy}.`);
assert.match(src.living,/family-shell-v104\.js/,'Living School must receive the same shared family Settings control as the other realms.');

// Old direct script tags in large legacy parents are tolerated only as dormant bootstraps.
for(const key of ['campus','cerbanimo','fellowfare','anarchadia']){
  assert.doesNotMatch(src[key],/model-settings-controller-v173\.js[^"']*activate=1/,`${paths[key]} eagerly activates Settings.`);
  assert.doesNotMatch(src[key],/document-lifecycle-v221\.js[^"']*activate=1/,`${paths[key]} eagerly activates Settings management.`);
}
assert.match(src.campus,/data-open-unified-ai-settings/,'Civweave lost its canonical Settings control marker.');

// Offline-first invariant: the owner must already be cached before the first click.
for(const key of ['codeCache','localAICache','criticalCache'])assert.ok(src[key].includes("'/app/settings-gateway-v317.js'"),`${paths[key]} does not pin the Settings gateway for offline first-click use.`);
assert.ok(src.codeCache.includes("'/app/model-settings-controller-v173.js'")&&src.codeCache.includes("'/app/document-lifecycle-v221.js'"),'Code coherence cache must retain the lazy controller and management subscriber for offline activation.');
for(const path of retiredRepairPaths)for(const key of ['codeCache','localAICache','criticalCache'])assert.ok(!src[key].includes(path.replace('public','')),`${paths[key]} still caches retired repair runtime ${path}.`);

console.log(JSON.stringify({ok:true,schema:registry.schema,policy:registry.policy,settings:{inputOwner:settings.inputOwner,presentationOwner:settings.presentationOwner,managementSubscriber:settings.managementSubscriber,credentialOwner:settings.credentialOwner,canonicalControl:settings.canonicalControl,oneInputListener:true,lazyController:true,lazyManagement:true,livingSchoolShared:true,campusPreflight:false,brandingDependency:false,prototypePatching:false,settingsApiPatching:false,realmFallbackListeners:false,retiredRepairFilesAbsent:true,offlineFirstClick:true}},null,2));
