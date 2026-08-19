import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [bridge,worker,manifestText,headers,installer,shellAssets]=await Promise.all([
  read('public/app/pwa-install-prompt-v250.js'),
  read('public/pwa-installability-worker-v1.js'),
  read('public/app/manifest.webmanifest'),
  read('public/_headers'),
  read('public/install-v130.js'),
  read('public/service-worker-shell-assets-v1.js')
]);
const manifest=JSON.parse(manifestText);

assert.ok(manifest.name||manifest.short_name,'manifest must have an install name');
assert.equal(manifest.display,'standalone','desktop PWA must launch standalone');
assert.ok(manifest.start_url,'manifest must have a start_url');
assert.ok(manifest.icons?.some(icon=>icon.sizes==='192x192'),'manifest must have a 192px icon');
assert.ok(manifest.icons?.some(icon=>icon.sizes==='512x512'),'manifest must have a 512px icon');

assert.match(worker,/self\.addEventListener\('install'/,'bootstrap worker must install');
assert.match(worker,/self\.addEventListener\('activate'/,'bootstrap worker must activate');
assert.match(worker,/self\.addEventListener\('fetch'/,'bootstrap worker must own a fetch handler for Chromium installability');
assert.match(worker,/event\.respondWith\(fetch\(request\)\)/,'bootstrap fetch handler must be network pass-through');
assert.ok(!worker.includes('caches.open('),'bootstrap worker must not download or cache the Civweave shell');
assert.ok(!worker.includes('cache.add'),'bootstrap worker must not pre-cache assets');

assert.ok(bridge.includes("const INSTALLABILITY_WORKER_URL='/pwa-installability-worker-v1.js?v=desktop-installability-v1'"),'installer must point at the installability worker');
assert.ok(bridge.includes("const INSTALLABILITY_WORKER_PATH='/pwa-installability-worker-v1.js'"),'installer must identify the bootstrap worker independently from query-string revisions');
assert.ok(bridge.includes("const SHELL_WORKER_PATH='/service-worker-v203.js'"),'installer must identify the real Civweave shell worker');
assert.ok(bridge.includes("const SHELL_HANDOFF_KEY='civweave.pwa.shell-handoff.v1'"),'installer must persist the bootstrap-to-shell navigation handoff');
assert.ok(bridge.includes("navigator.serviceWorker.register(INSTALLABILITY_WORKER_URL,{scope:'/',updateViaCache:'none'})"),'installer must register the bootstrap worker at root scope');
assert.ok(bridge.includes('void startInstallabilityBootstrap()'),'installer must establish browser installability on entry');
assert.ok(bridge.includes('async function retireInstallabilityBootstrap()'),'installer must explicitly retire the tiny bootstrap before shell download');
assert.ok(bridge.includes('registration.unregister()'),'bootstrap-to-shell handoff must release the bootstrap registration');
assert.ok(bridge.includes('async function beginNavigationHandoff'),'bootstrap retirement must be allowed to complete across a navigation boundary');
assert.ok(bridge.includes("reloadForShellHandoff('download')")||bridge.includes("beginNavigationHandoff('download')"),'user-initiated shell preparation must navigate after retiring the bootstrap worker');
assert.ok(bridge.includes('async function resumeShellHandoff()'),'the reloaded installer must resume the requested shell download');
assert.ok(bridge.includes('if(shellHandoffPending())void resumeShellHandoff();else void startInstallabilityBootstrap()'),'a pending shell handoff must suppress bootstrap re-registration on reload');
assert.ok(bridge.includes("installabilityBootstrapPolicy:'tiny-navigation-pass-through-worker-retired-across-navigation-before-shell-download'"),'installer must publish the navigation-safe bootstrap handoff policy');
assert.ok(bridge.includes('navigationSafeShellHandoff:true'),'installer must expose the navigation-safe handoff capability');
assert.ok(bridge.includes('eagerInstallabilityBootstrap:true'),'installer must explicitly enable tiny installability bootstrap');
assert.ok(bridge.includes('eagerShellPreparation:false'),'actual Civweave shell download must remain user initiated');
assert.ok(bridge.includes('firstPaintShellWork:false'),'first paint must remain free of shell preparation');
assert.ok(bridge.includes('void completeShellAfterBrowserInstall()'),'browser-menu installation must still prepare the real shell after installation');
assert.match(headers,/\/pwa-installability-worker-v1\.js\s+Cache-Control: no-cache/,'bootstrap worker must bypass stale HTTP caching');

for(const asset of [
  '/Civweave-weaveling-sprites.png',
  '/Living-School-moss-sprites.png',
  '/Cerbanimo-kamiya-sprites.png',
  '/FellowFare-rook-sprites.png',
  '/Anarchadia-merlin-sprites.png'
]){
  assert.ok(shellAssets.includes(asset),`${asset} must remain available to the shell`);
}
assert.ok(shellAssets.includes('const OPTIONAL_NAV_MEDIA=['),'large avatar atlases must be on-demand rather than install-critical');
assert.ok(!/const REQUIRED_FAMILY_NAV=\[[\s\S]*Civweave-weaveling-sprites\.png/.test(shellAssets),'sprite atlases must not block service-worker installation');

// The PWA bridge is the only effective owner of Chromium's deferred prompt.
// install-v130 still contains a legacy listener for compatibility, so v250 must intercept
// the event in capture phase and stop it before that listener can call preventDefault again.
assert.ok(bridge.includes("addEventListener('beforeinstallprompt',capture,{capture:true})"),'v250 must capture beforeinstallprompt before legacy listeners');
assert.ok(bridge.includes('event.stopImmediatePropagation()'),'v250 must stop duplicate beforeinstallprompt ownership');
assert.ok(bridge.includes("singleOwnerPromptPolicy:'capture-stop-immediate-propagation'"),'v250 must publish its single-owner prompt contract');
assert.ok(bridge.includes('prompt.prompt();'),'the sole prompt owner must call the native prompt from the install click');
assert.ok(installer.includes("addEventListener('beforeinstallprompt'"),'legacy listener remains detectable until it is retired intentionally');

console.log(JSON.stringify({
  ok:true,
  revision:'desktop-pwa-installability-bootstrap-v4-navigation-shell-handoff',
  bootstrapWorker:'/pwa-installability-worker-v1.js',
  bootstrapCachesShell:false,
  rootScope:true,
  shellPreparationUserInitiated:true,
  bootstrapRetiredBeforeShell:true,
  navigationSafeShellHandoff:true,
  avatarMediaInstallCritical:false,
  browserMenuInstallCompletesShell:true,
  singlePromptOwner:'pwa-install-prompt-v250'
},null,2));
