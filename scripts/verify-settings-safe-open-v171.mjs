import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [controller,boundary,worker,workingCampus,workingPart,family,loader,realm,living,fellowfare,anarchadia,fellowfareRuntime,settingsRuntime]=await Promise.all([
  read('public/app/model-settings-controller-v173.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/service-worker-v156.js'),
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.part5.txt'),
  read('public/app/family-shell-v104.js'),
  read('public/app/family-ai-loader-v105.js'),
  read('public/app/realm-console-v140.html'),
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/anarchadia-console-v139.html'),
  read('public/app/fellowfare-cabinet-v144.js'),
  read('public/app/minilm-model-settings-v138.js')
]);

new Function(controller);
new Function(family);
new Function(loader);
new Function(settingsRuntime);
new Function(boundary);

for(const token of [
  "VERSION='173.0-direct-settings-controller'",
  'const DEPENDENCIES=',
  '/app/shared/civweave-model-runtime.js',
  '/app/minilm-model-settings-v138.js',
  'function installDormantReflexStatus()',
  "controller.postMessage({type:'GET_MODEL_PACKAGE_STATUS'}",
  'async function ensureReflex()',
  "REFLEX_SCRIPT='/app/minilm-reflex-runtime-v138.js",
  'installDormantReflexStatus();',
  "mark('ready')",
  'CivweaveModelSettingsControllerV173={version:VERSION,open,ensure,ensureReflex,modelPackageStatus,settingsBoundary,facade:reflexStatusProxy,settingsFacade:facade}'
])assert(controller.includes(token),`Direct settings controller missing ${token}`);
assert(!controller.includes("addEventListener('click'"),'The direct settings controller must not intercept application clicks.');
assert(!controller.includes('CivweaveFamilyAILoaderV105.openSettings='),'The settings controller still patches the chat loader.');
assert(!controller.includes('CivweaveFamilyShellV104.openSettings='),'The settings controller still patches the family shell.');
const settingsDependencyBlock=controller.slice(controller.indexOf('const DEPENDENCIES='),controller.indexOf('const REFLEX_SCRIPT='));
assert(!settingsDependencyBlock.includes('minilm-reflex-runtime'),'Opening settings still loads MiniLM.');

for(const token of [
  "VERSION='157.2-single-owner'",
  "EVENT_OWNERSHIP='controller-only'",
  'const {dialog,created}=build()',
  "if(!created)fill(dialog.querySelector('form'))",
  'void checkPackage(form)',
  'eventOwnership:EVENT_OWNERSHIP'
])assert(settingsRuntime.includes(token),`Unified settings single-owner lifecycle missing ${token}`);
assert(!settingsRuntime.includes("document.addEventListener('click'"),'The unified settings runtime still intercepts application clicks.');
assert(!settingsRuntime.includes('new MutationObserver'),'The unified settings runtime still observes the entire document.');
assert(!settingsRuntime.includes("document.querySelectorAll('[data-unified-model-settings]')"),'The unified settings runtime still auto-binds forms outside its explicit mount path.');

for(const token of [
  "VERSION='1.0.4-inline-civweave-r42-chat-only'",
  "settingsOwner:'CivweaveModelSettingsControllerV173'",
  'CivweaveModelSettingsControllerV173',
  'async function openSettings()'
])assert(loader.includes(token),`Chat loader cutover missing ${token}`);
assert(!loader.includes('/app/minilm-model-settings-v138.js'),'Chat loader still owns the settings interface.');
assert(!loader.includes('/app/model-settings-v133.css'),'Chat loader still owns settings styling.');
assert(loader.includes('/app/minilm-reflex-runtime-v138.js'),'Chat lost its explicit semantic runtime dependency.');
assert(loader.includes('CivweaveModelSettingsControllerV173?.facade'),'Chat does not distinguish the dormant reflex status proxy from the real semantic runtime.');

for(const token of [
  "VERSION='1.0.4-direct-settings-v173'",
  "settingsOwner:'CivweaveModelSettingsControllerV173'",
  'CivweaveModelSettingsControllerV173',
  'data-cwf-settings',
  "const SYSTEM_ORDER=['civweave','living-school','cerbanimo','fellowfare','anarchadia']"
])assert(family.includes(token),`Family shell cutover missing ${token}`);
assert(!family.includes('const SETTINGS_SCRIPTS='),'Family shell still contains a settings dependency loader.');
assert(!family.includes('/app/minilm-reflex-runtime-v138.js'),'Opening family settings can still reach MiniLM directly.');
assert(!family.includes('ensureSettings'),'Family shell still owns a settings readiness path.');

const pages=[['realm',realm],['living-school',living],['fellowfare',fellowfare],['anarchadia',anarchadia],['working-campus',workingCampus]];
const scriptIndex=(html,src)=>html.indexOf(`<script src="${src}`);
for(const [name,html] of pages){
  const controllerIndex=scriptIndex(html,'/app/model-settings-controller-v173.js');
  const loaderIndex=scriptIndex(html,'/app/family-ai-loader-v105.js');
  assert(controllerIndex>=0,`${name} does not load the direct settings controller.`);
  if(loaderIndex>=0)assert(controllerIndex<loaderIndex,`${name} loads chat before the direct settings controller.`);
}
assert(workingPart.includes('CivweaveModelSettingsControllerV173')&&!workingPart.includes('CivweaveFamilyAILoaderV105.openSettings'),'Working Campus still routes settings through chat.');
assert(fellowfareRuntime.includes('CivweaveFamilyAILoaderV105?.openSettings'),'FellowFare compatibility call was unexpectedly removed before its chat-loader delegate was retained.');

for(const token of [
  "ADDITIONS_VERSION='v174-settings-single-owner-assets'",
  "PREVIOUS_ADDITIONS_VERSION='v173-ai-loader-cutover'",
  "SETTINGS_CONTROLLER_SCRIPT='/app/model-settings-controller-v173.js'",
  "SETTINGS_CONTROLLER_REVISION='v173-direct-settings-controller'",
  "SETTINGS_RUNTIME_REVISION='v157.2-single-owner'",
  'addScript(SETTINGS_CONTROLLER_SCRIPT)',
  'script.src=`${src}?v=${ADDITIONS_VERSION}`',
  'additionsVersion:ADDITIONS_VERSION',
  'previousAdditionsVersion:PREVIOUS_ADDITIONS_VERSION',
  'settingsRuntimeRevision:SETTINGS_RUNTIME_REVISION'
])assert(boundary.includes(token),`Install boundary missing ${token}`);
assert(!boundary.includes('SETTINGS_SAFE_OPEN_SCRIPT'),'Install boundary still loads a click interceptor.');

for(const token of [
  "EXTENSION_VERSION='working-campus-additions-v174-settings-single-owner-assets'",
  "SETTINGS_CONTROLLER_REVISION='direct-settings-controller-v173'",
  "SETTINGS_RUNTIME_REVISION='settings-runtime-v157.2-single-owner'",
  "EXTENSION_CACHE='cwext-working-campus-additions-v174-settings-single-owner-assets'",
  "PREVIOUS_EXTENSION_CACHE='cwext-working-campus-additions-v173-ai-loader-cutover'",
  "'/app/model-settings-controller-v173.js'",
  "'/app/minilm-model-settings-v138.js'",
  "'/app/family-ai-loader-v105.js'",
  'settingsControllerRevision:SETTINGS_CONTROLLER_REVISION',
  'settingsRuntimeRevision:SETTINGS_RUNTIME_REVISION'
])assert(worker.includes(token),`Installed-device cutover missing ${token}`);
const extensionBlock=worker.slice(worker.indexOf('const EXTENSION_FILES=['),worker.indexOf('const BOUNDARY='));
assert(!extensionBlock.includes('civweave-settings-safe-open'),'The new extension cache still installs the retired settings interceptor.');

for(const token of ['name="apiKey"','data-test-gemini','data-test-antigravity','data-package-state','data-benchmark'])assert(settingsRuntime.includes(token),`Unified settings lost ${token}`);

console.log(JSON.stringify({
  ok:true,
  revision:'v174-settings-single-owner-assets',
  settingsOwner:'CivweaveModelSettingsControllerV173',
  settingsRuntime:'CivweaveModelSettingsV157',
  settingsEventOwnership:'controller-only',
  chatOwner:'CivweaveFamilyAILoaderV105',
  settingsDependencies:['civweave-model-runtime','unified-settings'],
  chatDependencies:['workspace','semantic-reflex','planner','assistant','core-loop'],
  miniLM:'dormant-until-explicit-benchmark-or-chat',
  entryPoints:pages.map(([name])=>name),
  installedMigration:true,
  retired:['window-click-interceptor','settings-runtime-mutation-observer','family-settings-loader','chat-settings-loader']
},null,2));