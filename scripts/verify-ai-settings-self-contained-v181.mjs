import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const count=(source,needle)=>source.split(needle).length-1;

const [controller,worker,additive,installer,boundary,campus,pwa]=await Promise.all([
  read('public/app/model-settings-controller-v173.js'),
  read('public/service-worker.js'),
  read('public/service-worker-v156.js'),
  read('public/install-v130.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/working-campus-v156.html'),
  read('public/app/pwa-v130.js')
]);

new Function(controller);
new Function(worker);
new Function(additive.replace(/^importScripts\([^\n]+\);/m,''));
new Function(installer);
new Function(boundary);
new Function(pwa);

for(const token of [
  "VERSION='1.0.6-settings-controller-v182'",
  "const LAYER_ID='cw-ai-settings-v182'",
  "authority:'self-contained-settings-v182'",
  "presentation:'self-contained-fixed-layer'",
  'providerRuntimeOnOpen:false',
  'singlePassOpen:true',
  'migrationOnDemand:true',
  'function build()',
  'function open()',
  'function ensureRuntime()',
  'function fill(form,options={})',
  "globalThis.CommonweaveUnifiedAISettingsV175=facade",
  "document.getElementById('cw-ai-settings-v181')?.remove()"
])assert(controller.includes(token),`Single-pass settings controller missing ${token}`);

for(const forbidden of [
  'const DEPENDENCIES=',
  'function afterPaint()',
  'function showBootstrap(',
  'await ensure()',
  "'/app/unified-ai-settings-v175.js",
  'worker=new Worker(',
  'pipeline(',
  'showModal('
])assert(!controller.includes(forbidden),`Settings controller still contains retired open behavior: ${forbidden}`);

const migrationBlock=controller.slice(controller.indexOf('function migrateDeterministicDefault()'),controller.indexOf('function existingKey()'));
assert(migrationBlock.includes('if(migrationComplete)return false'),'Storage migration is not guarded to once per page session.');
assert(migrationBlock.includes('migrationComplete=true'),'Storage migration does not mark completion before reading storage.');

const buildBlock=controller.slice(controller.indexOf('function build()'),controller.indexOf('function ensure()'));
assert(count(buildBlock,'fill(form);')===1,'First construction must fill the form exactly once.');

const openBlock=controller.slice(controller.indexOf('function open()'),controller.indexOf('function renderInline'));
for(const forbidden of ['await ','ensureRuntime(','RUNTIME_SCRIPT',"createElement('script')",'.focus('])assert(!openBlock.includes(forbidden),`Opening settings still activates asynchronous or native-focus work: ${forbidden}`);
for(const token of [
  'if(visible&&!visible.hidden)return visible',
  'const started=performance.now(),existed=Boolean(visible),layer=visible||build()',
  'if(existed)fill(form,{refresh:true})',
  'layer.hidden=false',
  'transformerStarted:false',
  'providerRuntimeLoaded:Boolean(runtime())'
])assert(openBlock.includes(token),`Single-pass open contract missing ${token}`);
assert(count(openBlock,'fill(form,{refresh:true})')===1,'Reopening must refresh the form exactly once.');

const closeBlock=controller.slice(controller.indexOf("function close(reason='explicit')"),controller.indexOf('function bind(form)'));
assert(closeBlock.includes('target.focus?.({preventScroll:true})'),'Closing settings does not restore focus to the launcher.');

const runtimeBlock=controller.slice(controller.indexOf('function ensureRuntime()'),controller.indexOf('async function testGemini'));
assert(runtimeBlock.includes("document.createElement('script')"),'Provider runtime loader does not create its script on demand.');
assert(controller.includes("const RUNTIME_SCRIPT='/app/shared/commonweave-model-runtime.js"),'Provider runtime loader path is missing.');
assert(controller.match(/await ensureRuntime\(\)/g)?.length===2,'Provider runtime must load only from explicit test paths.');
const submitBlock=controller.slice(controller.indexOf("form.addEventListener('submit'"),controller.indexOf('function build()'));
assert(!submitBlock.includes('ensureRuntime('),'Saving settings starts the selected provider.');

for(const token of [
  "CACHE_REVISION='direct-family-r43-settings-single-pass'",
  "AI_REVISION='self-contained-settings-v182-single-pass-fixed-ort'",
  "settingsPresentation:'self-contained-fixed-layer'",
  'providerRuntimeOnOpen:false',
  'singlePassOpen:true',
  'migrationOnDemand:true',
  "MODEL_CACHE='commonweave-model-1.0.6-minilm-fixed-ort-r1'"
])assert(worker.includes(token),`Core worker missing ${token}`);
for(const token of [
  'working-campus-additions-v182-settings-single-pass',
  "SETTINGS_CONTROLLER_REVISION='single-pass-no-autofocus-v182'",
  "settingsPresentation:'self-contained-fixed-layer'",
  'providerRuntimeOnOpen:false',
  'singlePassOpen:true',
  'migrationOnDemand:true'
])assert(additive.includes(token),`Additive worker missing ${token}`);
for(const token of [
  "ADDITIONS_REVISION='working-campus-additions-v182-settings-single-pass'",
  "AUTO_RESET_KEY='commonweave.device-package.auto-reset.v106-r44'",
  'single-pass AI settings'
])assert(installer.includes(token),`Installer migration missing ${token}`);
for(const token of [
  "ADDITIONS_VERSION='v182-settings-single-pass'",
  "SETTINGS_CONTROLLER_REVISION='v182-single-pass-single-authority'",
  "settingsPresentation:'self-contained-fixed-layer'",
  'providerRuntimeOnOpen:false',
  'singlePassOpen:true',
  'migrationOnDemand:true'
])assert(boundary.includes(token),`Install boundary missing ${token}`);
for(const token of ['working-campus-v182-v106','settings-v182-v106'])assert(campus.includes(token),`Working Campus missing ${token}`);
for(const token of ['working-campus-additions-v182-settings-single-pass','single-pass settings update'])assert(pwa.includes(token),`PWA delivery marker missing ${token}`);

console.log(JSON.stringify({
  ok:true,
  revision:'v182-ai-settings-single-pass-fixed-ort',
  openPath:'synchronous-local-dom-only',
  firstOpenFormFills:1,
  repeatedOpenIgnored:true,
  reopenFormFills:1,
  providerSelectAutofocus:false,
  launcherFocusRestored:true,
  migrationRunsPerPage:1,
  dynamicSettingsImports:false,
  providerRuntimeOnOpen:false,
  providerRuntimeTrigger:'explicit-test-buttons-only',
  saveStartsProvider:false,
  fixedOrtModelCache:true,
  installedDeviceRefresh:true
},null,2));
