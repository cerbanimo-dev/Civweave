import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [bridge,worker,manifestText,headers]=await Promise.all([
  read('public/app/pwa-install-prompt-v250.js'),
  read('public/pwa-installability-worker-v1.js'),
  read('public/app/manifest.webmanifest'),
  read('public/_headers')
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
assert.ok(bridge.includes("navigator.serviceWorker.register(INSTALLABILITY_WORKER_URL,{scope:'/',updateViaCache:'none'})"),'installer must register the bootstrap worker at root scope');
assert.ok(bridge.includes('void ensureInstallabilityBootstrap()'),'installer must establish browser installability on entry');
assert.ok(bridge.includes("installabilityBootstrapPolicy:'tiny-navigation-pass-through-worker-no-shell-cache'"),'installer must publish the bootstrap policy');
assert.ok(bridge.includes('eagerInstallabilityBootstrap:true'),'installer must explicitly enable tiny installability bootstrap');
assert.ok(bridge.includes('eagerShellPreparation:false'),'actual Civweave shell download must remain user initiated');
assert.ok(bridge.includes('firstPaintShellWork:false'),'first paint must remain free of shell preparation');
assert.ok(bridge.includes('void completeShellAfterBrowserInstall()'),'browser-menu installation must still prepare the real shell after installation');
assert.match(headers,/\/pwa-installability-worker-v1\.js\s+Cache-Control: no-cache/,'bootstrap worker must bypass stale HTTP caching');

console.log(JSON.stringify({
  ok:true,
  revision:'desktop-pwa-installability-bootstrap-v1',
  bootstrapWorker:'/pwa-installability-worker-v1.js',
  bootstrapCachesShell:false,
  rootScope:true,
  shellPreparationUserInitiated:true,
  browserMenuInstallCompletesShell:true
},null,2));
