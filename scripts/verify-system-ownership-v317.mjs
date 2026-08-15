import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const registry=JSON.parse(await read('config/system-ownership.json'));
const settings=registry.systems.settings;
const paths={
  gateway:'public/app/settings-gateway-v317.js',
  lifecycle:'public/app/document-lifecycle-v221.js',
  controller:'public/app/model-settings-controller-v173.js',
  model:'public/app/model-settings-v133.js',
  visual:'public/app/visual-model-settings-v132.js',
  unified:'public/app/unified-ai-settings-v175.js',
  language:'public/app/language-settings-v1.js',
  parity:'public/app/settings-parity-v295.js',
  delegation:'public/app/settings-delegation-v175.js',
  bindGuard:'public/app/ai-settings-bind-guard-v230.js',
  repair:'public/app/ai-settings-device-repair-v229.js',
  credentialHelper:'public/app/device-credential-persistence-v211.js',
  anarchadiaStability:'public/app/anarchadia-runtime-stability-v159.js',
  brand:'public/app/civweave-brand.js',
  orchestrator:'public/app/experience-orchestrator-v232.js',
  boundary:'public/app/install-boundary-v146.js',
  shell:'public/app/family-shell-v104.js',
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
const src=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>[key,await read(path)])));
for(const key of ['gateway','lifecycle','controller','model','visual','unified','language','parity','delegation','bindGuard','repair','credentialHelper','anarchadiaStability','brand','orchestrator','boundary','shell'])assert.doesNotThrow(()=>new Function(src[key]),`${paths[key]} does not compile.`);

// Registry: one canonical Settings owner for input, DOM/presentation, and credentials.
assert.equal(registry.schema,'civweave.system-ownership.v2');
assert.equal(registry.policy,'extend-existing-owner-never-add-parallel-owner');
for(const field of ['owner','inputOwner','presentationOwner','credentialOwner'])assert.equal(settings[field],paths.gateway,`Settings ${field} must be the canonical gateway.`);
assert.equal(settings.managementService,paths.lifecycle);
assert.equal(settings.canonicalApi,'globalThis.CivweaveSettingsV320');
assert.equal(settings.canonicalControl,'[data-open-unified-ai-settings]');
assert.deepEqual(settings.allowedInputListenerFiles,[paths.gateway]);
for(const facade of [paths.controller,paths.model,paths.visual,paths.unified,paths.language,paths.parity])assert.ok(settings.compatibilityFacades.includes(facade),`${facade} must be registered only as a compatibility facade.`);
assert.ok(settings.forbiddenInputOwnerFiles.includes(paths.campusRuntime),'Campus runtime must remain explicitly forbidden from owning Settings input.');
assert.ok(settings.forbiddenPresentationOwners.includes(paths.controller),'Legacy controller must remain forbidden from owning Settings presentation.');

// Gateway: exactly one input path and one complete menu root. No runtime repair chain.
assert.match(src.gateway,/const SELECTOR='\[data-open-unified-ai-settings\]'/);
assert.match(src.gateway,/const LAYER_ID='cw-settings-v320'/);
assert.equal((src.gateway.match(/document\.addEventListener\('click'/g)||[]).length,1,'Settings gateway must have exactly one document click owner.');
assert.match(src.gateway,/document\.addEventListener\('click',onClick,true\)/);
assert.match(src.gateway,/data-cw-settings-form/);
assert.match(src.gateway,/data-cw-language-settings="v320"/);
assert.match(src.gateway,/name="safeMode"/);
assert.match(src.gateway,/data-settings-tab-panel="local-models"/);
assert.match(src.gateway,/data-local-model-slot-placeholder/);
assert.match(src.gateway,/CivweaveSettingsV320/);
assert.doesNotMatch(src.gateway,/model-settings-controller-v173\.js\?activate=1/,'Canonical gateway must not activate a second presentation owner.');
assert.doesNotMatch(src.gateway,/MutationObserver\s*=|HTMLFormElement\.prototype|Element\.prototype|setInterval\(/,'Settings ownership must not depend on runtime repair or prototype patching.');

// Downloaded-model management is a content service inside the already-created canonical root.
assert.match(src.lifecycle,/searchParams\.get\('activate'\)==='1'/);
assert.match(src.lifecycle,/activation:'settings-v320'/);
assert.match(src.lifecycle,/canonicalLayer\(layer\)/);
assert.match(src.lifecycle,/layer\?\.id==='cw-settings-v320'/);
assert.match(src.lifecycle,/settingsOwner:'settings-v320'/);
assert.match(src.lifecycle,/serviceRole:'downloaded-model-settings-content'/);
assert.match(src.lifecycle,/inputOwnership:false/);
assert.match(src.lifecycle,/presentationOwnership:false/);
assert.match(src.lifecycle,/settingsRootCreation:false/);
assert.match(src.lifecycle,/managementAfterPaint:true/);
assert.match(src.lifecycle,/globalObserverPatch:false/);
assert.match(src.lifecycle,/activationRequired:true/);
assert.match(src.lifecycle,/launchWork:'none'/);
assert.doesNotMatch(src.lifecycle,/document\.addEventListener\('click'/,'Management service may not intercept Settings input.');
assert.doesNotMatch(src.lifecycle,/new Worker\(|\.generate\(/,'Opening Settings management must not start inference.');

// Legacy Settings modules may forward API calls only; they are not owners anymore.
for(const key of ['controller','model','visual','unified','language','parity']){
  assert.match(src[key],/compatibilityFacade:true/,`${paths[key]} is not marked as a compatibility facade.`);
  assert.match(src[key],/canonical:'CivweaveSettingsV320'/,`${paths[key]} does not point to the canonical Settings API.`);
  assert.match(src[key],/inputOwnership:false/,`${paths[key]} regained Settings input ownership.`);
  assert.doesNotMatch(src[key],/document\.addEventListener\('click'/,`${paths[key]} regained a document Settings click listener.`);
  assert.doesNotMatch(src[key],/globalThis\.MutationObserver\s*=|HTMLFormElement\.prototype|Element\.prototype|setInterval\(/,`${paths[key]} contains runtime repair behavior.`);
}
for(const key of ['controller','model','visual','unified']){
  assert.match(src[key],/presentationOwnership:false/,`${paths[key]} regained Settings presentation ownership.`);
  assert.match(src[key],/credentialOwnership:false/,`${paths[key]} regained Settings credential ownership.`);
  assert.match(src[key],/domCreation:false/,`${paths[key]} regained Settings DOM creation.`);
}

// Former auxiliary owners stay retired/subordinate. Preserve these protections while changing the canonical owner.
for(const key of ['orchestrator','delegation','bindGuard','repair','credentialHelper','anarchadiaStability','lifecycle']){
  assert.doesNotMatch(src[key],/addEventListener\('click'[^\n]*(settings|Settings|SELECTOR|data-cwf-settings|openSettings)/i,`${paths[key]} regained Settings click ownership.`);
}
assert.doesNotMatch(src.orchestrator,/SETTINGS_SELECTOR|earlySettings|openSettingsIndependent|ensureSettingsModule|settingsCaptureOwner/);
assert.match(src.orchestrator,/settingsInputOwnership:false/);
assert.doesNotMatch(src.bindGuard,/HTMLFormElement[^\n]*prototype|proto\.querySelector|prototype\.querySelector/,'Bind guard may not patch browser prototypes.');
assert.match(src.bindGuard,/retired:true/);
assert.match(src.repair,/automaticListeners:false/);
assert.match(src.delegation,/listenerCount:0/);
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

// Campus may mark canonical controls, but Settings work cannot happen before explicit use.
for(const forbidden of ['openSharedSettings','ensureSettingsRepairs','settingsRepairPromise','ai-settings-bind-guard-v230','ai-settings-device-repair-v229'])assert.ok(!src.campusRuntime.includes(forbidden),`Campus runtime regained forbidden Settings path ${forbidden}.`);
assert.doesNotMatch(src.campusRuntime,/\$\('#settings-button'\)\.addEventListener\('click'/,'Campus Settings button regained a direct listener.');
assert.doesNotMatch(src.campusRuntime,/\$\('#model-chip'\)\.addEventListener\('click'/,'Campus model chip regained a direct Settings listener.');
assert.match(src.campusRuntime,/setAttribute\('data-open-unified-ai-settings',''\)/,'Campus controls are not delegated to the canonical gateway.');
const localBootstrapIndex=src.campusRuntime.indexOf("'/app/local-ai/bootstrap-v266.js");
const sendWeavelingIndex=src.campusRuntime.indexOf('async function sendWeaveling');
assert.ok(localBootstrapIndex>=0&&sendWeavelingIndex>=0,'Campus lost its explicit inference bootstrap path.');
assert.ok(!src.campusRuntime.slice(0,sendWeavelingIndex).includes('ensureDownloadedLocalAISettings();'),'Campus must not run local-AI bootstrap before an explicit chat/inference action.');

// Install boundary ships the canonical owner, never an eager alternate implementation or repair path.
assert.match(src.boundary,/const SETTINGS_GATEWAY='\/app\/settings-gateway-v317\.js'/);
const experience=src.boundary.match(/const SYSTEM_EXPERIENCE_SCRIPTS=\[([\s\S]*?)\n\];/)?.[1]||'';
assert.match(experience,/SETTINGS_GATEWAY/);
for(const forbidden of ['AI_SETTINGS_BIND_GUARD','AI_SETTINGS_REPAIR','DOCUMENT_LIFECYCLE','model-settings-controller-v173','settings-delegation-v175','settings-parity-v295'])assert.ok(!experience.includes(forbidden),`Launch experience still eagerly contains ${forbidden}.`);
assert.doesNotMatch(src.boundary,/addScript\(AI_SETTINGS_BIND_GUARD\)/);

// Shared shell displays one control without becoming another input owner.
assert.match(src.shell,/data-open-unified-ai-settings/);
assert.doesNotMatch(src.shell,/data-cwf-settings/);
assert.doesNotMatch(src.shell,/isSettingsControl|\.onclick=openSettings|function openSettings\(/);
assert.match(src.shell,/settingsOwner:'settings-gateway-v317'/);
assert.match(src.shell,/settingsInputOwnership:false/);

// Living School uses the same shared Settings system as every other realm.
assert.doesNotMatch(src.living,/>Settings<\/button>/i,'Living School still ships a realm-local Settings button.');
assert.doesNotMatch(src.living,/data-living-school-settings-owner|data-ls-action="open-ai-settings"/);
for(const legacy of ['model-settings-controller-v173.js','ai-settings-bind-guard-v230.js','ai-settings-device-repair-v229.js'])assert.ok(!src.living.includes(legacy),`Living School still directly loads ${legacy}.`);
assert.match(src.living,/family-shell-v104\.js/,'Living School must receive the shared family Settings control.');

// Legacy parent script tags are tolerated only when dormant; no route may activate an alternate Settings owner.
for(const key of ['campus','cerbanimo','fellowfare','anarchadia']){
  assert.doesNotMatch(src[key],/model-settings-controller-v173\.js[^"']*activate=1/,`${paths[key]} eagerly activates a legacy Settings facade.`);
  assert.doesNotMatch(src[key],/document-lifecycle-v221\.js[^"']*activate=1/,`${paths[key]} eagerly activates Settings management.`);
}
assert.match(src.campus,/data-open-unified-ai-settings/,'Civweave lost its canonical Settings control marker.');

// Offline first-click invariant: the one owner is already cached. Lazy compatibility/service modules remain cacheable, not authoritative.
for(const key of ['codeCache','localAICache','criticalCache'])assert.ok(src[key].includes("'/app/settings-gateway-v317.js'"),`${paths[key]} does not pin the canonical Settings gateway for offline first-click use.`);
assert.ok(src.codeCache.includes("'/app/model-settings-controller-v173.js'")&&src.codeCache.includes("'/app/document-lifecycle-v221.js'"),'Code coherence cache must retain lazy compatibility and management modules for offline use.');

console.log(JSON.stringify({ok:true,schema:registry.schema,policy:registry.policy,settings:{owner:settings.owner,inputOwner:settings.inputOwner,presentationOwner:settings.presentationOwner,credentialOwner:settings.credentialOwner,managementService:settings.managementService,canonicalApi:settings.canonicalApi,canonicalControl:settings.canonicalControl},singleDomOwner:true,singleInputOwner:true,legacyFacadesOnly:true,noRuntimeRepair:true,auxiliaryOwnersRetired:true,campusPreflight:false,brandingDependency:false,prototypePatching:false,settingsApiPatching:false,realmFallbackListeners:false,managementOnDemand:true,inferenceDormantOnOpen:true,livingSchoolShared:true,offlineFirstClick:true},null,2));
