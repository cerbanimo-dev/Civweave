import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const files={
  controller:'public/app/model-settings-controller-v173.js',
  unified:'public/app/unified-ai-settings-v175.js',
  delegation:'public/app/settings-delegation-v175.js',
  boundary:'public/app/install-boundary-v146.js',
  worker:'public/service-worker.js',
  additive:'public/service-worker-v156.js',
};
const source={};
for(const [name,file] of Object.entries(files))source[name]=await read(file);

new Function(source.controller);
new Function(source.unified);
new Function(source.delegation);
new Function(source.boundary);
new Function(source.worker);
new Function(source.additive.replace(/^importScripts\([^\n]+\);/m,''));

for(const token of [
  "VERSION='1.0.6-ai-settings-cleanroom-v188'",
  "const LAYER_ID='cw-ai-settings-cleanroom-v188'",
  "authority:'ai-settings-cleanroom-v188'",
  "eventOwnership:'single-cleanroom-controller'",
  "presentation:'cleanroom-v188'",
  'providerRuntimeOnOpen:false',
  'providerRuntimeAvailable:false',
  'providerTestsAvailable:false',
  'modelDiscoveryAvailable:false',
  'singlePassOpen:true',
  'function open(launcher)',
  'function close(reason=',
  'function build()',
  'function readState()',
  'globalThis.CommonweaveAISettingsCleanroomV188=api',
  'globalThis.CommonweaveModelSettingsControllerV173=api',
])assert(source.controller.includes(token),`Clean-room controller missing ${token}`);

for(const forbidden of [
  'MutationObserver',
  'PerformanceObserver',
  'setTimeout(',
  'setInterval(',
  'requestAnimationFrame(',
  'requestIdleCallback(',
  'import(',
  'importScripts(',
  'createElement(\'script\')',
  'createElement("script")',
  'commonweave-model-runtime',
  'ensureRuntime',
  'detectCapabilities',
  '.generate(',
  'new Worker(',
  'navigator.gpu',
  'GPUDevice',
  'GPUAdapter',
  'showModal(',
  'createElement(\'dialog\')',
  'document.body.style.overflow',
])assert(!source.controller.includes(forbidden),`Clean-room controller contains forbidden runtime behavior: ${forbidden}`);

const openBlock=source.controller.slice(source.controller.indexOf('function open(launcher)'),source.controller.indexOf('function ensure()'));
for(const forbidden of ['await ','Promise','fetch(','.focus('])assert(!openBlock.includes(forbidden),`Open path is not strictly synchronous and local: ${forbidden}`);
for(const token of ['if(existing&&!existing.hidden)return existing','const layer=existing||build()','layer.hidden=false'])assert(openBlock.includes(token),`Open path missing ${token}`);

for(const token of [
  "VERSION='188.0-ai-settings-cleanroom-delegation'",
  "document.addEventListener('click',onClick);",
  "listenerPhase:'bubble'",
  'listenerCount:1',
  'mutationObserver:false',
  'polling:false',
  'timers:false',
  'diagnosticsRuntime:false',
])assert(source.delegation.includes(token),`Clean-room delegation missing ${token}`);
for(const forbidden of ['MutationObserver','PerformanceObserver','setTimeout(','setInterval(',"addEventListener('click',onClick,true)","addEventListener('click',onClick,{capture:true",'longtask','commonweave.log-buffer.v1'])assert(!source.delegation.includes(forbidden),`Delegation still contains retired machinery: ${forbidden}`);

for(const token of [
  "VERSION='1.0.6-unified-settings-compat-v188'",
  'retiredRuntime:true',
  "authority:'ai-settings-cleanroom-v188'",
  'providerRuntimeOnOpen:false',
])assert(source.unified.includes(token),`Unified compatibility shell missing ${token}`);
for(const forbidden of ['MutationObserver','setTimeout(','setInterval(','fetch(','createElement(\'script\')','ensureRuntime','detectCapabilities','.generate('])assert(!source.unified.includes(forbidden),`Unified compatibility shell contains runtime behavior: ${forbidden}`);

for(const token of [
  "ADDITIONS_VERSION='v188-ai-settings-cleanroom'",
  "SETTINGS_STABILITY_REVISION='v188-no-observer-no-polling-no-capture'",
  "SETTINGS_CONTROLLER_REVISION='v188-single-cleanroom-authority'",
  "SETTINGS_RUNTIME_REVISION='v188-provider-runtime-disconnected'",
  "SETTINGS_LOG_REVISION='v188-diagnostics-runtime-retired'",
  "settingsPresentation:'cleanroom-v188'",
  'settingsMutationObserver:false',
  'settingsPolling:false',
  'settingsTimers:false',
  'settingsDiagnosticsRuntime:false',
  'providerRuntimeOnOpen:false',
  'providerTestsAvailable:false',
])assert(source.boundary.includes(token),`Install boundary missing ${token}`);

for(const token of [
  "importScripts('/service-worker.js?v=1.0.6-base-r47-ai-settings-cleanroom')",
  "EXTENSION_VERSION='working-campus-additions-v188-ai-settings-cleanroom'",
  "SETTINGS_CONTROLLER_REVISION='single-cleanroom-authority-v188'",
  "SETTINGS_RUNTIME_REVISION='provider-runtime-disconnected-v188'",
  "SETTINGS_LOG_REVISION='diagnostics-runtime-retired-v188'",
  "settingsPresentation:'cleanroom-v188'",
  'settingsMutationObserver:false',
  'settingsPolling:false',
  'settingsTimers:false',
  'settingsDiagnosticsRuntime:false',
  'providerRuntimeOnOpen:false',
  'providerTestsAvailable:false',
])assert(source.additive.includes(token),`Installed package refresh missing ${token}`);

for(const pathToken of [
  "'/app/model-settings-controller-v173.js'",
  "'/app/unified-ai-settings-v175.js'",
  "'/app/settings-delegation-v175.js'",
])assert(source.worker.includes(pathToken),`Core device package no longer includes ${pathToken}`);

const activeSurfaces=[
  'public/app/working-campus-v156.html',
  'public/app/realm-console-v140.html',
  'public/app/fellowfare-cabinet-v144.html',
  'public/app/living-school-v142.html',
  'public/app/anarchadia-v139.html',
  'public/app/cabinets/commonweave-cabinet-v155.html',
  'public/app/cabinets/cerbanimo-cabinet-v155.html',
];
let launcherSurfaces=0;
for(const file of activeSurfaces){
  const html=await read(file);
  if(html.includes('data-open-unified-ai-settings'))launcherSurfaces+=1;
  assert(html.includes('/app/model-settings-controller-v173.js')||html.includes('/app/install-boundary-v146.js'),`${file} does not reach the clean-room controller compatibility path.`);
}
assert(launcherSurfaces>=5,`Only ${launcherSurfaces} active surfaces expose the AI settings launcher.`);

console.log(JSON.stringify({
  ok:true,
  revision:'v188-ai-settings-cleanroom',
  controllerAuthority:'single-cleanroom-controller',
  openPath:'synchronous-local-dom-only',
  legacyDelegationRuntime:false,
  captureListener:false,
  mutationObserver:false,
  polling:false,
  timers:false,
  diagnosticsRuntime:false,
  providerRuntimeOnOpen:false,
  providerTestsAvailable:false,
  modelDiscoveryAvailable:false,
  installedPackageRefresh:true,
  launcherSurfaces,
},null,2));
