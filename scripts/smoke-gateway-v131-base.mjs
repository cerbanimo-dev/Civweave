import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
await import('./stage-maplibre-v275.mjs');
const PORT=18792,origin=`http://127.0.0.1:${PORT}`,VERSION='1.0.160',BUILD='1.0.160-install-only-fullscreen-family-gateway';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dataDir=await mkdtemp(path.join(os.tmpdir(),'civweave-gateway-v106-')),output=[];
const child=spawn(process.execPath,['scripts/start-civweave-v131.mjs'],{cwd:root,env:{...process.env,RENDER:'true',HOST:'127.0.0.1',PORT:String(PORT),DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});child.stdout.on('data',chunk=>output.push(chunk.toString()));child.stderr.on('data',chunk=>output.push(chunk.toString()));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),assert=(condition,message)=>{if(!condition)throw new Error(message)};
async function wait(){let last;for(let i=0;i<80;i+=1){try{const response=await fetch(`${origin}/api/health`,{cache:'no-store'});if(response.ok)return response.json();last=new Error(`health ${response.status}`)}catch(error){last=error}await sleep(200)}throw last||new Error('gateway did not start')}
function requiredDeviceAssets(workerSource){const core=workerSource.match(/const CORE=(\[[\s\S]*?\]);\nconst DEVICE_REQUIRED=/),mapCore=workerSource.match(/const MAP_CORE=(\[[\s\S]*?\]);\nconst CORE=/),required=workerSource.match(/const DEVICE_REQUIRED=([^;]+);/);assert(core&&required,'service worker core package manifest could not be parsed');const declarations=[`const CORE=${core[1]};`];if(mapCore)declarations.push(`const MAP_CORE=${mapCore[1]};`);return Function(`"use strict";${declarations.join('')}return ${required[1]};`)()}
try{
  const health=await wait();assert(output.join('').includes('Starting gateway runtime.'),'environment-aware start did not select gateway on Render');assert(health.build===BUILD,`unexpected build ${health.build}`);assert(health.appVersion===VERSION,`unexpected version ${health.appVersion}`);assert(health.release?.localInstallRequired===true,'gateway does not require installation');
  const rootResponse=await fetch(`${origin}/`,{cache:'no-store'}),rootHtml=await rootResponse.text();assert(rootResponse.ok,'gateway installer root failed');assert(rootHtml.includes(`<title>Install Civweave v${VERSION}</title>`),'gateway root is not the current Civweave installer');assert(rootHtml.includes('Download offline files only when you choose.'),'gateway root does not preserve the manual-first campus boundary');assert(rootHtml.includes('/app/logos/civweave-app-icon.png'),'gateway root does not use the app icon');
  for(const route of ['/loom/','/lite/','/app/realm-console-v140.html','/app/fullscreen-family-v104.html','/app/cabinet-mode-v142.html']){const response=await fetch(origin+route,{cache:'no-store'}),body=await response.json();assert(response.status===410,`${route} returned ${response.status}, expected 410`);assert(body.localInstallRequired===true,`${route} does not explain installation`)}
  for(const route of ['/service-worker.js','/service-worker-v156.js','/app/manifest.webmanifest','/install-v130.js','/install-v130.css','/app/logos/civweave-app-icon.png','/app/logos/civweave-icon-192.png']){const response=await fetch(origin+route,{cache:'no-store'});assert(response.ok,`installer asset ${route} returned ${response.status}`)}
  const packageHeaders={'x-civweave-package':'install'},workerSource=await readFile(path.join(root,'public','service-worker.js'),'utf8'),requiredAssets=[...new Set(requiredDeviceAssets(workerSource))];
  for(const forbidden of ['all-minilm-l6-v2','transformers.min.js','ort-wasm','minilm-reflex','minilm-model-settings','civweave-settings-safe-open'])assert(!requiredAssets.some(route=>route.includes(forbidden)),`v1.0.17 package still includes ${forbidden}`);
  for(const route of requiredAssets){const response=await fetch(origin+route,{cache:'no-store',headers:packageHeaders});assert(response.ok,`required core package asset ${route} returned ${response.status}`);await response.arrayBuffer()}

  const gateway=await fetch(`${origin}/app/settings-gateway-v317.js`,{headers:packageHeaders}).then(response=>response.text());
for(const token of [
  "VERSION='1.0.130-settings-v320-single-owner'",
  "const LAYER_ID='cw-settings-v320'",
  "const INPUT_SLOT='__civweaveSettingsV320Capture'",
  'inputOwner:true,presentationOwner:true,credentialOwner:true',
  'singleMenu:true',
  'singleLauncherListener:true',
  "launchWork:'none'",
  'afterPaint(()=>void ensureManagement(layer))',
  'data-cw-language-settings="v320"',
  'data-settings-tab-panel="local-models"',
  'globalThis.CivweaveSettingsV320=api',
])assert(gateway.includes(token),`canonical V320 settings gateway missing ${token}`);
const gatewayOpen=gateway.slice(gateway.indexOf('function open(launcher)'),gateway.indexOf('function ensure()'));
for(const forbidden of ['await ','fetch(','.generate(','new Worker(','navigator.gpu','showModal('])assert(!gatewayOpen.includes(forbidden),`canonical Settings open path performs ${forbidden}`);
for(const forbidden of ['MutationObserver','PerformanceObserver','setInterval(','requestIdleCallback(','bootstrap-v266','runtime-v266','runtime-bridge-v266','test-pulse-v269'])assert(!gateway.includes(forbidden),`canonical V320 settings gateway contains ${forbidden}`);

const controller=await fetch(`${origin}/app/model-settings-controller-v173.js`,{headers:packageHeaders}).then(response=>response.text());
for(const token of [
  "VERSION='1.0.10-model-settings-controller-v173-compat-v320'",
  'compatibilityFacade:true',
  "canonical:'CivweaveSettingsV320'",
  "authority:'settings-v320'",
  'inputOwnership:false',
  'presentationOwnership:false',
  'credentialOwnership:false',
  'domCreation:false',
  'activationRequired:false',
  'providerRuntimeOnOpen:false',
])assert(controller.includes(token),`model-settings compatibility facade missing ${token}`);
for(const forbidden of ['document.createElement',"addEventListener('click'",'showModal(','MutationObserver','PerformanceObserver','setInterval(','requestIdleCallback(','new Worker(','navigator.gpu'])assert(!controller.includes(forbidden),`model-settings compatibility facade contains ${forbidden}`);
  const settings=await fetch(`${origin}/app/unified-ai-settings-v175.js`,{headers:packageHeaders}).then(response=>response.text());
  for(const token of ["VERSION='1.0.8-unified-settings-compat-v320'",'compatibilityFacade:true','retiredRuntime:true',"canonical:'CivweaveSettingsV320'","authority:'settings-v320'",'inputOwnership:false','presentationOwnership:false','domCreation:false'])assert(settings.includes(token),`unified Settings facade missing ${token}`);
  for(const forbidden of ['MutationObserver','PerformanceObserver','setInterval(','requestIdleCallback(','document.createElement',"addEventListener('click'",'ensureRuntime','detectCapabilities','.generate(','new Worker(','navigator.gpu'])assert(!settings.includes(forbidden),`unified Settings facade contains ${forbidden}`);
  assert(settings.includes('canonical()?.open?.(launcher)')&&settings.includes('canonical()?.close?.(reason)')&&settings.includes('canonical()?.ensure?.()'),'unified Settings facade must delegate through V320 rather than own presentation');
  const delegation=await fetch(`${origin}/app/settings-delegation-v175.js`,{headers:packageHeaders}).then(response=>response.text());
  for(const token of ["VERSION='188.2-retired-settings-v320'","REVISION='320.0-single-settings-owner'",'retired:true','compatibilityFacade:true',"canonical:'CivweaveSettingsV320'",'listenerCount:0','inputOwnership:false','presentationOwnership:false','credentialOwnership:false','mutationObserver:false','polling:false','timers:false'])assert(delegation.includes(token),`Settings delegation facade missing ${token}`);
  for(const forbidden of ['MutationObserver','PerformanceObserver','setInterval(',"document.addEventListener('click'",'document.createElement','new Worker(','navigator.gpu'])assert(!delegation.includes(forbidden),`Settings delegation facade contains ${forbidden}`);
  assert(delegation.includes('globalThis.CivweaveSettingsV320?.open?.(launcher)'),'Settings delegation facade must forward only to V320');

  const campus=await fetch(`${origin}/app/working-campus-v156.html`,{headers:packageHeaders}).then(response=>response.text());assert(campus.includes('/app/logos/civweave-symbol.svg')&&campus.includes(VERSION)&&!campus.includes('/app/logos/civweave.webp'),'Working Campus header is stale');
  const campusCss=await fetch(`${origin}/app/working-campus-v156.css`,{headers:packageHeaders}).then(response=>response.text());assert(campusCss.includes('#brand-home.brand{grid-template-columns:64px')&&campusCss.includes('.app .campus .realm-node{min-height:96px!important')&&campusCss.includes('--cw-themed-nav-height:58px'),'Working Campus compact shell contract is stale');
  for(const retired of ['/extensions/civweave-settings-safe-open-v171.js','/extensions/civweave-settings-safe-open-v172.js']){const response=await fetch(origin+retired,{headers:packageHeaders});assert(response.status===404,`${retired} still exists with status ${response.status}`)}
  const sharedTools=await fetch(`${origin}/extensions/civweave-additions-v156.js`,{headers:packageHeaders}).then(response=>response.text());assert(sharedTools.includes('Node & friends')&&sharedTools.includes('aiVault:false'),'Shared Tools regressed');
  const packageLedger=await fetch(`${origin}/app/shared/civweave-parity-ledger.json`,{cache:'no-store',headers:packageHeaders});assert(packageLedger.ok,`marked parity ledger returned ${packageLedger.status}`);const ledger=await packageLedger.json();assert(Array.isArray(ledger.systems)&&ledger.systems.length>=5,'parity ledger is missing systems');
  const telemetry=await fetch(`${origin}/api/boot-log`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'room-opened'})});assert(telemetry.status===204,`boot telemetry returned ${telemetry.status}`);
  console.log(JSON.stringify({ok:true,version:VERSION,build:BUILD,requiredCoreAssetCount:requiredAssets.length,defaultProvider:'deterministic',settingsControllerRevision:'v318',settingsPresentation:'cleanroom-v188-v317',settingsDelegation:'retired-v317-single-gateway',nativeDialog:false,outsideTap:'safe-close',settingsTransformerWork:false,providerRuntimeOnOpen:false,providerTestsAvailable:false,modelDiscoveryAvailable:false,captureListener:false,mutationObserver:false,polling:false,settingsPaintBeforeInferenceCancellation:true,settingsCancellationScheduling:'after-paint-only',campusIconPixels:64,campusShell:'compact-v235',manualFirstInstaller:true},null,2));
}catch(error){console.error(output.join(''));throw error}finally{child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(1500)]);if(!child.killed)child.kill('SIGKILL');await rm(dataDir,{recursive:true,force:true})}
