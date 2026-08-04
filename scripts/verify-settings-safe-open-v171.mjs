import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [hotfix,boundary,worker,workingCampus,family,loader]=await Promise.all([
  read('public/extensions/commonweave-settings-safe-open-v172.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/service-worker-v156.js'),
  read('public/app/working-campus-v156.html'),
  read('public/app/family-shell-v104.js'),
  read('public/app/family-ai-loader-v105.js')
]);

new Function(hotfix);
for(const token of [
  "VERSION='172.0-settings-window-capture'",
  'const SETTINGS_SCRIPTS=',
  '/app/shared/commonweave-model-runtime.js',
  '/app/minilm-model-settings-v138.js',
  'function installDormantStatusProxy()',
  "controller.postMessage({type:'GET_MODEL_PACKAGE_STATUS'}",
  'async function ensureReflex()',
  'CommonweaveFamilyAILoaderV105.openSettings=open',
  'CommonweaveFamilyShellV104.openSettings=open',
  "target.closest('[data-unified-model-settings],#cw-ai-settings-v157')",
  'function captureSettingsClick(event)',
  "addEventListener('click',captureSettingsClick,true)",
  'event.stopImmediatePropagation()',
  "mark('ready')"
])assert(hotfix.includes(token),`Settings window-capture opener missing ${token}`);

assert(!hotfix.includes("document.addEventListener('click',captureSettingsClick"),'The settings interceptor is still registered on document, where older document-capture handlers can run first.');
const settingsOnlyBlock=hotfix.slice(hotfix.indexOf('const SETTINGS_SCRIPTS='),hotfix.indexOf('const REFLEX_SCRIPT='));
assert(!settingsOnlyBlock.includes('minilm-reflex-runtime'),'Opening settings still loads the MiniLM reflex runtime.');
const openBlock=hotfix.slice(hotfix.indexOf('async function open()'),hotfix.indexOf('function settingsControl'));
assert(openBlock.includes('await ensureSettings()'),'Settings opener does not wait for its bounded settings dependencies.');
assert(!openBlock.includes('.ensure()'),'Settings opener delegates to the full assistant loader.');
assert(family.includes("document.addEventListener('click'"),'The regression fixture no longer contains the older document-capture family handler; the window-capture contract needs review.');
assert(family.includes('/app/minilm-reflex-runtime-v138.js'),'The regression fixture no longer demonstrates the eager MiniLM dependency that the interceptor must bypass.');

for(const token of [
  "SETTINGS_SAFE_OPEN_SCRIPT='/extensions/commonweave-settings-safe-open-v172.js'",
  "SETTINGS_SAFE_OPEN_REVISION='v172-settings-window-capture'",
  'addScript(SETTINGS_SAFE_OPEN_SCRIPT)',
  "additionsVersion:'v172-settings-window-capture'",
  'settings-window-capture-v172'
])assert(boundary.includes(token),`Install boundary missing ${token}`);
assert(boundary.indexOf('addScript(SETTINGS_SAFE_OPEN_SCRIPT)')<boundary.indexOf('addScript(DEVICE_CREDENTIALS_SCRIPT)'),'Window-capture settings interception must install before credential decoration.');

for(const token of [
  "EXTENSION_VERSION='working-campus-additions-v172-settings-window-capture'",
  "SETTINGS_SAFE_OPEN_REVISION='settings-window-capture-v172'",
  "EXTENSION_CACHE='cwext-working-campus-additions-v172-settings-window-capture'",
  "'/extensions/commonweave-settings-safe-open-v172.js'",
  'settingsSafeOpenRevision:SETTINGS_SAFE_OPEN_REVISION'
])assert(worker.includes(token),`Installed-device delivery missing ${token}`);

assert(workingCampus.includes('id="settings-button"')&&workingCampus.includes('id="model-chip"'),'Working Campus lost one of its settings entry points.');
assert(family.includes('data-cwf-settings')&&loader.includes('async function openSettings()'),'Family settings compatibility surfaces are missing.');

console.log(JSON.stringify({ok:true,revision:'v172-settings-window-capture',entryPoints:'window-capture-before-legacy-document-handlers',settingsDependencies:['commonweave-model-runtime','unified-settings'],miniLM:'dormant-until-explicit-benchmark-or-prewarm',diagnosticDataset:'settingsOpenState',installedDelivery:true},null,2));