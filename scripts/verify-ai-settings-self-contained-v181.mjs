import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [controller,worker,additive,installer,boundary]=await Promise.all([
  read('public/app/model-settings-controller-v173.js'),
  read('public/service-worker.js'),
  read('public/service-worker-v156.js'),
  read('public/install-v130.js'),
  read('public/app/install-boundary-v146.js')
]);

new Function(controller);
new Function(worker);
new Function(additive.replace(/^importScripts\([^\n]+\);/m,''));
new Function(installer);
new Function(boundary);

for(const token of [
  "VERSION='1.0.6-settings-controller-v181'",
  "const LAYER_ID='cw-ai-settings-v181'",
  "authority:'self-contained-settings-v181'",
  "presentation:'self-contained-fixed-layer'",
  'providerRuntimeOnOpen:false',
  'function build()',
  'function open()',
  'function ensureRuntime()',
  "globalThis.CommonweaveUnifiedAISettingsV175=facade",
  "document.getElementById('cw-ai-settings-bootstrap-v180')?.remove()"
])assert(controller.includes(token),`Self-contained settings controller missing ${token}`);

for(const forbidden of [
  'const DEPENDENCIES=',
  'function afterPaint()',
  'function showBootstrap(',
  'await ensure()',
  "'/app/unified-ai-settings-v175.js",
  'worker=new Worker(',
  'pipeline('
])assert(!controller.includes(forbidden),`Settings open path still contains retired bootstrap/import behavior: ${forbidden}`);

const openBlock=controller.slice(controller.indexOf('function open()'),controller.indexOf('function renderInline'));
for(const forbidden of ['await ','ensureRuntime(','RUNTIME_SCRIPT','createElement(\'script\')'])assert(!openBlock.includes(forbidden),`Opening settings still activates asynchronous runtime work: ${forbidden}`);
for(const token of ['const started=performance.now(),layer=build()','layer.hidden=false','transformerStarted:false','providerRuntimeLoaded:Boolean(runtime())'])assert(openBlock.includes(token),`Immediate open contract missing ${token}`);

const runtimeBlock=controller.slice(controller.indexOf('function ensureRuntime()'),controller.indexOf('async function testGemini'));
assert(runtimeBlock.includes('document.createElement(\'script\')'),'Provider runtime loader does not create its script only on demand.');
assert(controller.includes("const RUNTIME_SCRIPT='/app/shared/commonweave-model-runtime.js"),'Provider runtime loader path is missing.');
assert(controller.indexOf('function ensureRuntime()')<controller.indexOf('async function testGemini'),'Provider runtime helper is not isolated before explicit tests.');
assert(controller.match(/await ensureRuntime\(\)/g)?.length===2,'Provider runtime should load only from the two explicit test paths.');

for(const token of [
  "CACHE_REVISION='direct-family-r42-settings-self-contained'",
  "AI_REVISION='self-contained-settings-v181'",
  "settingsPresentation:'self-contained-fixed-layer'",
  'providerRuntimeOnOpen:false'
])assert(worker.includes(token),`Core worker missing ${token}`);
for(const token of [
  'working-campus-additions-v181-settings-self-contained',
  "SETTINGS_CONTROLLER_REVISION='self-contained-no-import-v181'",
  "settingsPresentation:'self-contained-fixed-layer'",
  'providerRuntimeOnOpen:false'
])assert(additive.includes(token),`Additive worker missing ${token}`);
for(const token of [
  "ADDITIONS_REVISION='working-campus-additions-v181-settings-self-contained'",
  "AUTO_RESET_KEY='commonweave.device-package.auto-reset.v106-r43'",
  'self-contained AI settings'
])assert(installer.includes(token),`Installer migration missing ${token}`);
for(const token of [
  "ADDITIONS_VERSION='v181-settings-self-contained'",
  "SETTINGS_CONTROLLER_REVISION='v181-self-contained-single-authority'",
  "settingsPresentation:'self-contained-fixed-layer'",
  'providerRuntimeOnOpen:false'
])assert(boundary.includes(token),`Install boundary missing ${token}`);

console.log(JSON.stringify({
  ok:true,
  revision:'v181-ai-settings-self-contained',
  openPath:'synchronous-local-dom-only',
  bootstrap:false,
  dynamicSettingsImports:false,
  providerRuntimeOnOpen:false,
  providerRuntimeTrigger:'explicit-test-buttons-only',
  staleBootstrapCleanup:true,
  installedDeviceRefresh:true
},null,2));
