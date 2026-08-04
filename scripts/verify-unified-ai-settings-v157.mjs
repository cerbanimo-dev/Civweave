import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [html,loader,settings,styles,baseWorker,additiveWorker,...parts]=await Promise.all([
  read('public/app/working-campus-v156.html'),
  read('public/app/family-ai-loader-v105.js'),
  read('public/app/minilm-model-settings-v138.js'),
  read('public/app/model-settings-v133.css'),
  read('public/service-worker.js'),
  read('public/service-worker-v156.js'),
  ...[1,2,3,4,5].map(index=>read(`public/app/working-campus-v156.part${index}.txt`))
]);

const campusSource=parts.join('');
new Function(campusSource);
new Function(settings);
new Function(loader);
new Function(additiveWorker.replace(/^'use strict';\s*importScripts\([^\n]+\);/,'\'use strict\';'));

assert(html.includes('/app/family-ai-loader-v105.js?v=unified-settings-r1'),'Working Campus does not load the shared settings loader.');
assert(!html.includes('<dialog id="settings"'),'Working Campus still ships a duplicate model-settings dialog.');
for(const stale of ['id="model-route"','id="model-key"','id="test-gemini"','id="test-antigravity"'])assert(!html.includes(stale),`Working Campus still owns stale control ${stale}.`);
for(const token of ['openSharedSettings','CommonweaveFamilyAILoaderV105.openSettings','commonweave:model-settings-saved','syncModelChip'])assert(campusSource.includes(token),`Working Campus shared-settings bridge is missing ${token}.`);
assert(!parts[4].includes("$('#model-route').addEventListener"),'Working Campus still binds its retired settings form.');

for(const token of [
  'CommonweaveModelSettingsV157',
  'CommonweaveModelSettingsV133=globalThis.CommonweaveModelSettingsV157',
  "VERSION='157.1'",
  'Gemini API key',
  'gemini-3.5-flash-lite',
  'https://generativelanguage.googleapis.com/v1beta',
  'data-paste-key',
  'data-import-key',
  'extractKey',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'data-test-gemini',
  'data-test-antigravity',
  'runtime().generate',
  "actualModel.includes('antigravity')",
  'A Gemini fallback does not count as a successful Antigravity test.',
  'commonweave:model-settings-saved',
  'Run reflex speed trial'
])assert(settings.includes(token),`Shared settings component is missing ${token}.`);
assert(!settings.includes('localStorage.setItem("commonweave-model-session"'),'A session API key is written to localStorage.');

for(const token of ['.cw-ai-header','.cw-ai-secret-tools','.cw-ai-test-grid','.cw-ai-form-footer','--cw-ai-mint','#0a1022'])assert(styles.includes(token),`Restyled settings surface is missing ${token}.`);
for(const token of ["lazy-ai-r37-unified-settings","CommonweaveModelSettingsV157?.version==='157.1'",'const settingsApi=','CommonweaveModelSettingsV133','api.open()'])assert(loader.includes(token),`Family loader unified settings contract is missing ${token}.`);

for(const token of ["CACHE_REVISION='direct-family-r37-fast-install'","DEVICE_REVISION='device-package-r37-core'","MODEL_REVISION='minilm-on-demand-r1'",'modelOnDemand','GET_MODEL_PACKAGE_STATUS'])assert(baseWorker.includes(token),`Fast-core base worker lost ${token}.`);
for(const token of [
  "EXTENSION_VERSION='working-campus-additions-v157-unified-settings-fast-core'",
  'PATCHED_CORE_FILES',
  'patchCorePackage',
  '/app/family-ai-loader-v105.js',
  '/app/minilm-model-settings-v138.js',
  '/app/model-settings-v133.css',
  '/app/working-campus-v156.html',
  '/app/working-campus-v156.part4.txt',
  '/app/working-campus-v156.part5.txt'
])assert(additiveWorker.includes(token),`Fast-core additive worker does not deliver ${token}.`);

console.log(JSON.stringify({
  ok:true,
  settingsRuntime:'157.1',
  compatibilityAlias:'v133-to-v157',
  sharedSurfaces:['working-campus','settings-bar'],
  geminiKeyIngestion:['direct-entry','clipboard','env-file','json-file','raw-key-file'],
  liveTests:['gemini-generate','antigravity-direct-no-fallback'],
  duplicateWorkingCampusDialog:false,
  corePackage:'r37-fast-deferred-minilm',
  additiveSettingsRevision:'unified-settings-fast-core'
},null,2));
