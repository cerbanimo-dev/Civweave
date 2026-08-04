import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [hotfix,boundary,worker,workingCampus,family,loader]=await Promise.all([
  read('public/extensions/commonweave-settings-safe-open-v171.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/service-worker-v156.js'),
  read('public/app/working-campus-v156.html'),
  read('public/app/family-shell-v104.js'),
  read('public/app/family-ai-loader-v105.js')
]);

new Function(hotfix);
for(const token of [
  "VERSION='171.0-settings-safe-open'",
  'const SETTINGS_SCRIPTS=',
  '/app/shared/commonweave-model-runtime.js',
  '/app/minilm-model-settings-v138.js',
  'function installDormantStatusProxy()',
  "controller.postMessage({type:'GET_MODEL_PACKAGE_STATUS'}",
  'async function ensureReflex()',
  'CommonweaveFamilyAILoaderV105.openSettings=open',
  'CommonweaveFamilyShellV104.openSettings=open',
  "target.closest('[data-unified-model-settings],#cw-ai-settings-v157')",
  "event.stopImmediatePropagation()",
  'document.addEventListener(\'click\''
])assert(hotfix.includes(token),`Settings-safe opener missing ${token}`);

const settingsOnlyBlock=hotfix.slice(hotfix.indexOf('const SETTINGS_SCRIPTS='),hotfix.indexOf('const REFLEX_SCRIPT='));
assert(!settingsOnlyBlock.includes('minilm-reflex-runtime'),'Opening settings still loads the MiniLM reflex runtime.');
const openBlock=hotfix.slice(hotfix.indexOf('async function open()'),hotfix.indexOf('function settingsControl'));
assert(openBlock.includes('await ensureSettings()'),'Settings opener does not wait for its bounded settings dependencies.');
assert(!openBlock.includes('.ensure()'),'Settings opener delegates to the full assistant loader.');
assert(hotfix.indexOf('addScript(SETTINGS_SAFE_OPEN_SCRIPT)')<hotfix.indexOf('addScript(DEVICE_CREDENTIALS_SCRIPT)')||boundary.indexOf('addScript(SETTINGS_SAFE_OPEN_SCRIPT)')<boundary.indexOf('addScript(DEVICE_CREDENTIALS_SCRIPT)'),'Settings-safe interception must install before credential decoration.');

for(const token of [
  "SETTINGS_SAFE_OPEN_SCRIPT='/extensions/commonweave-settings-safe-open-v171.js'",
  "SETTINGS_SAFE_OPEN_REVISION='v171-settings-safe-open'",
  'addScript(SETTINGS_SAFE_OPEN_SCRIPT)',
  "additionsVersion:'v171-settings-safe-open'"
])assert(boundary.includes(token),`Install boundary missing ${token}`);

for(const token of [
  "EXTENSION_VERSION='working-campus-additions-v171-settings-safe-open'",
  "SETTINGS_SAFE_OPEN_REVISION='settings-safe-open-v171'",
  "EXTENSION_CACHE='cwext-working-campus-additions-v171-settings-safe-open'",
  "'/extensions/commonweave-settings-safe-open-v171.js'",
  'settingsSafeOpenRevision:SETTINGS_SAFE_OPEN_REVISION'
])assert(worker.includes(token),`Installed-device delivery missing ${token}`);

assert(workingCampus.includes('id="settings-button"')&&workingCampus.includes('id="model-chip"'),'Working Campus lost one of its settings entry points.');
assert(family.includes('data-cwf-settings')&&loader.includes('async function openSettings()'),'Family settings compatibility surfaces are missing.');

console.log(JSON.stringify({ok:true,revision:'v171-settings-safe-open',entryPoints:'capture-routed-to-bounded-loader',settingsDependencies:['commonweave-model-runtime','unified-settings'],miniLM:'dormant-until-explicit-benchmark-or-prewarm',installedDelivery:true},null,2));
