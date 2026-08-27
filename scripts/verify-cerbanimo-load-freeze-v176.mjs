import fs from 'node:fs';
import assert from 'node:assert/strict';
import './verify-cerbanimo-universal-nav-stability-v1.mjs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const realmNavigationWorker=read('public/service-worker-five-system-pages-v1.js');
const activeWorker=read('public/service-worker-v203.js');
const realm=read('public/app/realm-console-v140.html');
const shell=read('public/app/persistent-system-shell-v1.html');
const shellRuntime=read('public/app/persistent-system-shell-v1.js');

assert(realmNavigationWorker.includes("const VERSION='five-system-pages-v1-persistent-shell-r5'"),'Realm navigation must use the persistent-shell revision.');
assert(realmNavigationWorker.includes("const CACHE='cw-five-system-pages-v2'"),'Embedded realm HTML must remain on the cache-distinct realm cache.');
assert(realmNavigationWorker.includes("const NETWORK_TIMEOUT_MS=4000"),'Embedded realm navigation must retain a finite deadline.');
assert(realmNavigationWorker.includes('new AbortController()'),'Embedded realm navigation must abort stalled requests.');
assert(realmNavigationWorker.includes("shellRedirect(url,spec.system)"),'Top-level realm navigation must move into the persistent shell rather than replacing its navbar.');
assert(activeWorker.includes('/service-worker-five-system-pages-v1.js?v=five-system-pages-v1-persistent-shell-r5'),'Installed staging PWA must activate persistent realm routing.');
assert(activeWorker.includes('staging-installed-entry-takeover-v21-learning-source-pack-authority'),'Staging must remain on the current installed-entry worker generation.');
assert(activeWorker.includes('persistent-stage-viewport-r1'),'Active staging worker must carry the persistent-stage viewport repair.');
assert(activeWorker.includes('/service-worker-shell-assets-v1.js?v=shell-assets-v1-repair-v25-persistent-navbar-required'),'Installed staging must require persistent shell assets and sprite media.');
assert(shell.includes('persistent-system-shell-v1-r10-local-model-full-route'),'Persistent shell must retain the full-height stage while using the iframe-aware full-route local-settings revision.');
assert(shell.includes('height:calc(100dvh - var(--cw-persistent-nav-space))'),'Persistent stage must explicitly fill the dynamic viewport above the universal navbar.');
assert(!/#cw-persistent-system-stage\{[^}]*height:auto/.test(shell),'Persistent stage must never regress to intrinsic iframe height:auto.');
assert(realm.includes('realm-console-canonical-v256-persistent-shell-content-r1'),'Cerbanimo must use the content-only frame build.');
assert(!realm.includes('/app/install-boundary-v146.js'),'Cerbanimo frame must not boot the global install/shell observer stack.');
assert(!realm.includes('/app/local-object-mesh-v146.js'),'Cerbanimo frame must not boot the global object-mesh observer stack.');
assert(shellRuntime.includes('host.src=target.href'),'System navigation must change only the content stage.');
assert(shellRuntime.includes('persistentNavbar:true'),'Persistent shell API must explicitly guarantee navbar persistence.');

console.log('Cerbanimo freeze regression contract passed: the universal navbar lives outside realm content, the content iframe fills the viewport above it, top-level system switches never replace it, and Cerbanimo boots only its frame-local workbench runtimes.');
