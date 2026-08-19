import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [bridge,worker,manifestText,headers,installer,shellAssets,lowPressure,serviceWorker,root,pwaStart]=await Promise.all([
  read('public/app/pwa-install-prompt-v250.js'),
  read('public/pwa-installability-worker-v1.js'),
  read('public/app/manifest.webmanifest'),
  read('public/_headers'),
  read('public/install-v130.js'),
  read('public/service-worker-shell-assets-v1.js'),
  read('public/service-worker-offline-low-pressure-v1.js'),
  read('public/service-worker-v203.js'),
  read('public/index.html'),
  read('public/app/pwa-start-v436.html')
]);
const manifest=JSON.parse(manifestText);

assert.ok(manifest.name||manifest.short_name,'manifest must have an install name');
assert.equal(manifest.display,'standalone','PWA must launch standalone');
assert.ok(manifest.start_url,'manifest must have a start_url');
assert.ok(manifest.icons?.some(icon=>icon.sizes==='192x192'),'manifest must have a 192px icon');
assert.ok(manifest.icons?.some(icon=>icon.sizes==='512x512'),'manifest must have a 512px icon');

assert.match(worker,/self\.addEventListener\('install'/,'bootstrap worker must install');
assert.match(worker,/self\.addEventListener\('activate'/,'bootstrap worker must activate');
assert.match(worker,/self\.addEventListener\('fetch'/,'bootstrap worker must own a fetch handler for Chromium installability');
assert.match(worker,/event\.respondWith\(fetch\(request\)\)/,'bootstrap fetch handler must be network pass-through');
assert.ok(!worker.includes('caches.open('),'bootstrap worker must not download or cache the Civweave shell');

assert.ok(bridge.includes("const INSTALLABILITY_WORKER_URL='/pwa-installability-worker-v1.js?v=desktop-installability-v1'"),'installer must point at the tiny installability worker');
assert.ok(bridge.includes("INSTALLABILITY_WORKER_PATH='/pwa-installability-worker-v1.js'"),'installer must identify the bootstrap worker');
assert.ok(bridge.includes("SHELL_WORKER_PATH='/service-worker-v203.js'"),'installer must identify the real Civweave shell worker');
assert.ok(bridge.includes("navigator.serviceWorker.register(INSTALLABILITY_WORKER_URL,{scope:'/',updateViaCache:'none'})"),'installer must establish installability at root scope');
assert.ok(bridge.includes('void startInstallabilityBootstrap()'),'installer must establish browser installability on entry');
assert.ok(bridge.includes('async function retireInstallabilityBootstrap(){return false}'),'bootstrap retirement must remain a no-op compatibility hook');
assert.ok(!bridge.includes('registration.unregister()'),'installer must never unregister its current root worker in-page');
assert.ok(!bridge.includes('reloadForShellHandoff'),'installer must not force a worker handoff reload');
assert.ok(bridge.includes('async function scheduleShellUpgrade'),'real shell registration must be staged separately from the install click');
assert.ok(bridge.includes("navigator.serviceWorker.register(SHELL_WORKER_URL,{scope:'/',updateViaCache:'none'})"),'background state machine must register the real shell at root scope');
assert.ok(bridge.includes("activation:'deferred-until-safe'"),'shell activation must be explicitly deferred');
assert.ok(bridge.includes("document.visibilityState!=='hidden'"),'worker takeover must wait until the installer is hidden');
assert.ok(bridge.includes('SAFE_ACTIVATION_DELAY_MS=10000'),'hidden-page activation must include a settling delay');
assert.ok(bridge.includes("installSequencingPolicy:'native-install-first-stage-shell-no-controller-change-during-launch'"),'installer must publish cold-launch-safe sequencing');
assert.ok(bridge.includes('coldLaunchSafe:true'),'installer must expose the cold-launch-safe capability');
assert.ok(bridge.includes('noInstallerReload:true'),'installer must expose the no-reload contract');
assert.ok(bridge.includes('eagerShellPreparation:false'),'actual shell work must not block first paint');
assert.ok(bridge.includes('firstPaintShellWork:false'),'first paint must remain free of shell preparation');
assert.match(headers,/\/pwa-installability-worker-v1\.js\s+Cache-Control: no-cache/,'bootstrap worker must bypass stale HTTP caching');

// Existing installed copies can retain / as their baked start URL. Root must be
// a pure router and must never mutate the service worker during standalone boot.
assert.ok(root.includes("'/app/pwa-start-v436.html'"),'root must send installed launches through the static PWA start page');
assert.ok(root.includes('workerMutationDuringLaunch:false'),'root must publish the no-worker-mutation launch contract');
assert.ok(!root.includes('navigator.serviceWorker.register'),'root launch must not register a worker');
assert.ok(!root.includes('SKIP_WAITING'),'root launch must not activate a worker');
assert.ok(pwaStart.includes('Starting the Working Campus without changing the app worker during launch.'),'PWA start page must be worker-stable');
assert.ok(!pwaStart.includes('navigator.serviceWorker.register'),'PWA start page must not register a worker');
assert.ok(pwaStart.includes("location.replace(destination.href)"),'PWA start page must route directly to the campus');

for(const asset of [
  '/Civweave-weaveling-sprites.png',
  '/Living-School-moss-sprites.png',
  '/Cerbanimo-kamiya-sprites.png',
  '/FellowFare-rook-sprites.png',
  '/Anarchadia-merlin-sprites.png'
])assert.ok(shellAssets.includes(asset),`${asset} must remain available to the shell`);
const requiredNavBlock=shellAssets.match(/const REQUIRED_FAMILY_NAV=\[[\s\S]*?\];/)?.[0]||'';
assert.ok(requiredNavBlock,'required navigation block must exist');
assert.ok(shellAssets.includes('const OPTIONAL_NAV_MEDIA=['),'large avatar atlases must remain on-demand');
assert.ok(!requiredNavBlock.includes('Civweave-weaveling-sprites.png'),'sprite atlases must not block service-worker installation');

assert.ok(bridge.includes("addEventListener('beforeinstallprompt',capture,{capture:true})"),'v250 must capture beforeinstallprompt before legacy listeners');
assert.ok(bridge.includes('event.stopImmediatePropagation()'),'v250 must stop duplicate beforeinstallprompt ownership');
assert.ok(bridge.includes("singleOwnerPromptPolicy:'capture-stop-immediate-propagation'"),'v250 must publish its single-owner prompt contract');
assert.ok(bridge.includes('function openNativeInstallPrompt(prompt,button)'),'native prompt ownership must be isolated from the click handler');
assert.ok(bridge.includes('prompt.prompt();'),'the prompt must be called from the fresh user gesture');
assert.ok(bridge.includes('Promise.resolve(prompt.userChoice).then'),'native prompt choice must be observed asynchronously');
assert.ok(bridge.includes('NATIVE_PROMPT_WATCHDOG_MS'),'native prompt must have a watchdog');
assert.ok(bridge.includes('nonBlockingNativePrompt:true'),'installer must expose nonblocking native-prompt behavior');
assert.ok(installer.includes("addEventListener('beforeinstallprompt'"),'legacy listener remains detectable until retired intentionally');

assert.ok(bridge.includes("#download-offline-package"),'PWA bridge must recognize the campus download control');
assert.ok(bridge.includes('async function ownCampusClick(event)'),'campus click must have a nonblocking capture owner');
assert.ok(bridge.includes("event.target?.closest?.('#download-offline-package')"),'campus click must be intercepted before the legacy await chain');
assert.ok(bridge.includes('nonBlockingCampusDownload:true'),'installer must expose nonblocking campus behavior');
assert.ok(bridge.includes('Finish app setup first'),'campus control must fail open while the full worker is still staged');
assert.ok(serviceWorker.includes("importScripts('/service-worker-offline-low-pressure-v1.js?v=offline-campus-low-pressure-v1')"),'standard worker must import the low-pressure campus override');
assert.ok(lowPressure.includes("const LOW_PRESSURE_YIELD_MS=18"),'campus worker must yield between files');
assert.ok(lowPressure.includes("concurrency:1"),'campus worker must explicitly run one file at a time');
assert.ok(lowPressure.includes('await lowPressurePause(LOW_PRESSURE_YIELD_MS)'),'campus loop must yield after each asset');

console.log(JSON.stringify({
  ok:true,
  revision:'desktop-pwa-installability-bootstrap-v7-cold-launch-safe',
  bootstrapWorker:'/pwa-installability-worker-v1.js',
  forcedInstallerReload:false,
  rootWorkerUnregisterInPage:false,
  controllerChangeDuringLaunch:false,
  installedRootWorkerMutation:false,
  pwaStartWorkerMutation:false,
  shellActivationPolicy:'hidden-page-delay',
  nativePromptNonBlocking:true,
  campusDownloadNonBlocking:true,
  campusConcurrency:1,
  campusYieldMs:18,
  singlePromptOwner:'pwa-install-prompt-v250'
},null,2));
