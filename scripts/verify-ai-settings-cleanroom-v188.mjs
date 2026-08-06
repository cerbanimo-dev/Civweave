import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const sources={};
for(const [name,file] of Object.entries({
  controller:'public/app/model-settings-controller-v173.js',
  unified:'public/app/unified-ai-settings-v175.js',
  delegation:'public/app/settings-delegation-v175.js',
  boundary:'public/app/install-boundary-v146.js',
  worker:'public/service-worker.js',
  additive:'public/service-worker-v156.js',
  wrapper:'public/service-worker-v203.js',
  lightweight:'public/service-worker-core-v208.js',
  livingSchoolBoundary:'public/service-worker-living-school-cleanroom-v218.js',
  installer:'public/install-v130.js'
}))sources[name]=await read(file);

new Function(sources.controller);
new Function(sources.unified);
new Function(sources.delegation);
new Function(sources.boundary);
new Function(sources.worker);
new Function(sources.additive.replace(/^\s*importScripts\([^\n]+\);/m,''));
new Function(sources.wrapper);
new Function(sources.lightweight);
new Function(sources.livingSchoolBoundary);

function requires(source,tokens,label){for(const token of tokens)assert(source.includes(token),`${label} missing ${token}`)}
function forbids(source,tokens,label){for(const token of tokens)assert(!source.includes(token),`${label} contains forbidden behavior: ${token}`)}

requires(sources.controller,[
  "VERSION='1.0.6-ai-settings-cleanroom-v188'","const LAYER_ID='cw-ai-settings-cleanroom-v188'","authority:'ai-settings-cleanroom-v188'",
  "eventOwnership:'single-cleanroom-controller'","presentation:'cleanroom-v188'",'providerRuntimeOnOpen:false','providerRuntimeAvailable:false',
  'providerTestsAvailable:false','modelDiscoveryAvailable:false','singlePassOpen:true','function open(launcher)','function close(reason=',
  'globalThis.CommonweaveAISettingsCleanroomV188=api','globalThis.CommonweaveModelSettingsControllerV173=api'
],'controller');
forbids(sources.controller,['MutationObserver','PerformanceObserver','setTimeout(','setInterval(','requestAnimationFrame(','requestIdleCallback(','import(','importScripts(',"createElement('script')",'createElement("script")','commonweave-model-runtime','ensureRuntime','detectCapabilities','.generate(','new Worker(','navigator.gpu','GPUDevice','GPUAdapter','showModal(',"createElement('dialog')",'document.body.style.overflow'],'controller');
const openBlock=sources.controller.slice(sources.controller.indexOf('function open(launcher)'),sources.controller.indexOf('function ensure()'));
forbids(openBlock,['await ','Promise','fetch(','.focus('],'open path');
requires(openBlock,['if(existing&&!existing.hidden)return existing','const layer=existing||build()','layer.hidden=false'],'open path');

requires(sources.delegation,["VERSION='188.0-ai-settings-cleanroom-delegation'","document.addEventListener('click',onClick);","listenerPhase:'bubble'",'listenerCount:1','mutationObserver:false','polling:false','timers:false','diagnosticsRuntime:false'],'delegation');
forbids(sources.delegation,['MutationObserver','PerformanceObserver','setTimeout(','setInterval(',"addEventListener('click',onClick,true)","addEventListener('click',onClick,{capture:true",'longtask','commonweave.log-buffer.v1'],'delegation');
requires(sources.unified,["VERSION='1.0.6-unified-settings-compat-v188'",'retiredRuntime:true',"authority:'ai-settings-cleanroom-v188'",'providerRuntimeOnOpen:false'],'unified compatibility shell');
forbids(sources.unified,['MutationObserver','setTimeout(','setInterval(','fetch(',"createElement('script')",'ensureRuntime','detectCapabilities','.generate('],'unified compatibility shell');
requires(sources.boundary,["ADDITIONS_VERSION='v188-ai-settings-cleanroom'","SETTINGS_STABILITY_REVISION='v188-no-observer-no-polling-no-capture'","SETTINGS_CONTROLLER_REVISION='v188-single-cleanroom-authority'","SETTINGS_RUNTIME_REVISION='v188-provider-runtime-disconnected'","SETTINGS_LOG_REVISION='v188-diagnostics-runtime-retired'","settingsPresentation:'cleanroom-v188'",'settingsMutationObserver:false','settingsPolling:false','settingsTimers:false','settingsDiagnosticsRuntime:false','providerRuntimeOnOpen:false','providerTestsAvailable:false'],'install boundary');

const bridgeMode=sources.additive.includes('legacy-v156-bridge-v209');
if(bridgeMode){
  requires(sources.additive,["importScripts('/service-worker-v203.js?v=1.0.6-lightweight-shell-v208-legacy-v156-bridge-v209')",'GET_SHARED_IMAGE_STATUS','GET_CRITICAL_BOOT_STATUS','GET_ADDITIONS_STATUS'],'legacy package bridge');
  assert(!/^[ \t]*importScripts\('\/service-worker\.js/m.test(sources.additive),'legacy package bridge executes the retired base worker');
  assert(!/^[ \t]*importScripts\('\/service-worker-critical-v199\.js/m.test(sources.additive),'legacy package bridge executes the retired critical coordinator');
  const cleanImport="importScripts('/service-worker-living-school-cleanroom-v218.js";
  const coreImport="importScripts('/service-worker-core-v208.js";
  requires(sources.wrapper,[cleanImport,coreImport],'active worker wrapper');
  assert(sources.wrapper.indexOf(cleanImport)<sources.wrapper.indexOf(coreImport),'Living School retirement does not load before the retained core');
  requires(sources.livingSchoolBoundary,["const REVISION='living-school-cleanroom-v218'",'event.stopImmediatePropagation()'],'Living School worker boundary');
  requires(sources.lightweight,["const BUILD = 'lightweight-shell-v208'","'/app/install-boundary-v146.js'",'knowledgeLibrarySeparate: true','DOWNLOAD_OFFLINE_PACKAGE'],'retained lightweight installed package');
  assert(!sources.lightweight.includes('importScripts('),'retained lightweight core reintroduced the layered import stack');
  assert(!sources.installer.includes('GET_CRITICAL_BOOT_STATUS'),'installer still waits on the retired critical package coordinator');
  assert(!sources.installer.includes('GET_ADDITIONS_STATUS'),'installer still waits on the retired additive package');
}else{
  requires(sources.additive,["importScripts('/service-worker.js?v=1.0.6-base-r47-ai-settings-cleanroom')","EXTENSION_VERSION='working-campus-additions-v188-ai-settings-cleanroom'","SETTINGS_CONTROLLER_REVISION='single-cleanroom-authority-v188'","SETTINGS_RUNTIME_REVISION='provider-runtime-disconnected-v188'","SETTINGS_LOG_REVISION='diagnostics-runtime-retired-v188'","settingsPresentation:'cleanroom-v188'",'settingsMutationObserver:false','settingsPolling:false','settingsTimers:false','settingsDiagnosticsRuntime:false','providerRuntimeOnOpen:false','providerTestsAvailable:false'],'installed package refresh');
}
requires(sources.worker,["'/app/model-settings-controller-v173.js'","'/app/unified-ai-settings-v175.js'","'/app/settings-delegation-v175.js'"],'legacy core package compatibility');

const activeSurfaces=['public/app/working-campus-v156.html','public/app/realm-console-v140.html','public/app/fellowfare-cabinet-v144.html'];
const launcherTokens=['data-open-unified-ai-settings','id="aiSettings"','id="modelSettings"','id="btnAISettings"','data-ai-settings'];
let launcherSurfaces=0;
for(const file of activeSurfaces){
  const html=await read(file);
  if(launcherTokens.some(token=>html.includes(token)))launcherSurfaces+=1;
  assert(html.includes('/app/model-settings-controller-v173.js')||html.includes('/app/install-boundary-v146.js'),`${file} does not reach the clean-room compatibility path.`);
}
assert(launcherSurfaces>=1,'No packaged surface exposes a recognized AI settings launcher.');
console.log(JSON.stringify({ok:true,revision:'v188-ai-settings-cleanroom',controllerAuthority:'single-cleanroom-controller',openPath:'synchronous-local-dom-only',legacyDelegationRuntime:false,captureListener:false,mutationObserver:false,polling:false,timers:false,diagnosticsRuntime:false,providerRuntimeOnOpen:false,providerTestsAvailable:false,modelDiscoveryAvailable:false,installedPackageRefresh:true,installedPackageMode:bridgeMode?'v218-cleanroom-wrapper-retained-v208-core':'v188-layered-additive',launcherSurfaces},null,2));
