import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const releaseVersion=(await read('VERSION')).trim();
assert(/^\d+\.\d+\.\d+$/.test(releaseVersion),`Invalid canonical VERSION: ${releaseVersion}`);

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

for(const [label,source] of Object.entries(sources)){
  const compilable=label==='additive'?source.replace(/^\s*importScripts\([^\n]+\);/m,''):source;
  new Function(compilable);
}

function requires(source,tokens,label){for(const token of tokens)assert(source.includes(token),`${label} missing ${token}`)}
function forbids(source,tokens,label){for(const token of tokens)assert(!source.includes(token),`${label} contains forbidden behavior: ${token}`)}

requires(sources.controller,[
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
  'globalThis.CommonweaveAISettingsCleanroomV188=api',
  'globalThis.CommonweaveModelSettingsControllerV173=api'
],'controller');
forbids(sources.controller,[
  'MutationObserver','PerformanceObserver','setTimeout(','setInterval(','requestAnimationFrame(','requestIdleCallback(',
  'import(','importScripts(',"createElement('script')",'createElement("script")','commonweave-model-runtime','ensureRuntime',
  'detectCapabilities','.generate(','new Worker(','navigator.gpu','GPUDevice','GPUAdapter','showModal(',"createElement('dialog')",
  'document.body.style.overflow'
],'controller');
const openBlock=sources.controller.slice(sources.controller.indexOf('function open(launcher)'),sources.controller.indexOf('function ensure()'));
requires(openBlock,['if(existing&&!existing.hidden)return existing','const layer=existing||build()','layer.hidden=false'],'open path');
forbids(openBlock,['await ','Promise','fetch(','.focus('],'open path');

requires(sources.delegation,[
  "document.addEventListener('click',onClick);",
  "listenerPhase:'bubble'",
  'listenerCount:1',
  'mutationObserver:false',
  'polling:false',
  'timers:false',
  'diagnosticsRuntime:false'
],'delegation');
forbids(sources.delegation,[
  'MutationObserver','PerformanceObserver','setTimeout(','setInterval(',
  "addEventListener('click',onClick,true)","addEventListener('click',onClick,{capture:true",'longtask','commonweave.log-buffer.v1'
],'delegation');

requires(sources.unified,[
  'retiredRuntime:true',
  "authority:'ai-settings-cleanroom-v188'",
  'providerRuntimeOnOpen:false'
],'unified compatibility shell');
forbids(sources.unified,[
  'MutationObserver','setTimeout(','setInterval(','fetch(',"createElement('script')",'ensureRuntime','detectCapabilities','.generate('
],'unified compatibility shell');

requires(sources.boundary,[
  `const VERSION='${releaseVersion}';`,
  `const ADDITIONS_VERSION='v${releaseVersion}-canonical-core-only-v226';`,
  "const REVISION='canonical-core-only-v226'",
  'const LEGACY_SCRIPTS=[',
  "'/app/model-settings-controller-v173.js'",
  "'/app/settings-delegation-v175.js'",
  "canonicalPolicy:'core-only-no-global-additions-no-redirect'",
  'canonicalAutoScripts:0',
  'if(canonicalAppSurface()||!liveHead())return false;'
],'install boundary');
forbids(sources.boundary,[
  "ADDITIONS_VERSION='v188-ai-settings-cleanroom'",
  'SETTINGS_STABILITY_REVISION',
  'SETTINGS_CONTROLLER_REVISION',
  'SETTINGS_RUNTIME_REVISION',
  'SETTINGS_LOG_REVISION',
  'addScript(RELEASE_VERSION_SCRIPT)'
],'install boundary');

const activeWorkerImport=`importScripts('/service-worker-v203.js?v=${releaseVersion}-lightweight-shell-v208-legacy-v156-bridge-v209')`;
const bridgeMode=sources.additive.includes('legacy-v156-bridge-v209');
assert(bridgeMode,'The active package must use the retained lightweight worker bridge.');
requires(sources.additive,[activeWorkerImport,'GET_SHARED_IMAGE_STATUS','GET_CRITICAL_BOOT_STATUS','GET_ADDITIONS_STATUS'],'legacy package bridge');
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

console.log(JSON.stringify({
  ok:true,
  releaseVersion,
  revision:'cleanroom-capability-contract-v1.0.15',
  controllerAuthority:'single-cleanroom-controller',
  openPath:'synchronous-local-dom-only',
  canonicalBoundary:'core-only-zero-global-scripts',
  legacyCompatibility:true,
  mutationObserver:false,
  polling:false,
  timers:false,
  diagnosticsRuntime:false,
  providerRuntimeOnOpen:false,
  providerTestsAvailable:false,
  modelDiscoveryAvailable:false,
  installedPackageMode:'v218-cleanroom-wrapper-retained-v208-core',
  launcherSurfaces
},null,2));
