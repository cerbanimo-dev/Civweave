import fs from 'node:fs';
import assert from 'node:assert/strict';
import './verify-cerbanimo-universal-nav-stability-v1.mjs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const realmNavigationWorker=read('public/service-worker-five-system-pages-v1.js');
const releaseWorker=read('public/service-worker-release-generation-v1.js');
const activeWorker=read('public/service-worker-v203.js');
const realm=read('public/app/realm-console-v140.html');
const shell=read('public/app/persistent-system-shell-v1.html');
const shellRuntime=read('public/app/persistent-system-shell-v1.js');
const generationLifecycle=read('public/app/generation-lifecycle-v2.js');
const shellAssets=read('public/service-worker-shell-assets-v1.js');

assert(realmNavigationWorker.includes("const VERSION='five-system-pages-v1-persistent-shell-r5'"),'Realm navigation must use the persistent-shell revision.');
assert(realmNavigationWorker.includes("const CACHE='cw-five-system-pages-v2'"),'Embedded realm HTML must remain on the cache-distinct realm cache.');
assert(realmNavigationWorker.includes("const NETWORK_TIMEOUT_MS=4000"),'Embedded realm navigation must retain a finite deadline.');
assert(realmNavigationWorker.includes('new AbortController()'),'Embedded realm navigation must abort stalled requests.');
assert(realmNavigationWorker.includes("shellRedirect(url,spec.system)"),'Top-level realm navigation must move into the persistent shell rather than replacing its navbar.');

assert(releaseWorker.includes("const REVISION='release-generation-boundary-v2-bounded-network-20260915'"),'Runtime release generation must use the bounded-network revision.');
assert(releaseWorker.includes('const NETWORK_TIMEOUT_MS=3200'),'Runtime JS/CSS/HTML requests must have a finite network deadline.');
assert(releaseWorker.includes('const WARM_TIMEOUT_MS=2500'),'Warm-cache requests must have a finite deadline.');
assert(releaseWorker.includes('const WARM_CONCURRENCY=6'),'Warm-cache fanout must remain bounded on mobile connections.');
assert(releaseWorker.includes('async function boundedFetch(request,timeout=NETWORK_TIMEOUT_MS)'),'Runtime fetches must go through one bounded fetch primitive.');
assert(releaseWorker.includes("const controller=typeof AbortController==='function'?new AbortController():null"),'Bounded runtime fetches must abort stalled network work.');
assert(releaseWorker.includes("'/app/realm-console-v140.css'"),'The Cerbanimo first-paint stylesheet must be warmed with the current release.');
assert(releaseWorker.includes("'/app/realm-console-v140.js'"),'The Cerbanimo console runtime must be warmed with the current release.');
assert(releaseWorker.includes("'/app/cerbanimo-quest-engine-v144.js'"),'The Cerbanimo quest engine must be warmed with the current release.');
assert(releaseWorker.includes('queue=[...WARM_PATHS]'),'Release warming must use a bounded work queue rather than unbounded request fanout.');

assert(activeWorker.includes('/service-worker-five-system-pages-v1.js?v=five-system-pages-v1-persistent-shell-r5'),'Installed staging PWA must activate persistent realm routing.');
assert(activeWorker.includes('/service-worker-release-generation-v1.js?v=release-generation-boundary-v2-bounded-network-20260915'),'Installed staging must force clients onto the bounded runtime-fetch generation.');
assert(activeWorker.includes('staging-installed-entry-takeover-v21-learning-source-pack-authority'),'Staging must remain on the current installed-entry worker generation.');
assert(activeWorker.includes('persistent-stage-viewport-r1'),'Active staging worker must carry the persistent-stage viewport repair.');
assert(activeWorker.includes('/service-worker-shell-assets-v1.js?v=shell-assets-v1-repair-v27-event-bounded-generation-lifecycle-required'),'Installed staging must require the bounded-lifecycle shell generation.');
assert(shellAssets.includes("const REVISION='shell-assets-v1-repair-v27-event-bounded-generation-lifecycle-required'"),'Shell assets must expose the bounded-lifecycle generation.');
assert(shellAssets.includes("'/app/generation-lifecycle-v2.js'"),'Bounded generation lifecycle must be a required installed shell asset.');

assert(/data-build="persistent-system-shell-v1-r\d+[^\"]*"/.test(shell),'Persistent shell must expose a revisioned build identity.');
assert(shell.includes('/app/generation-lifecycle-v2.js?v=1.1.0-event-bounded-frame-binding'),'Persistent shell must load the bounded generation lifecycle runtime.');
assert(shell.includes('height:calc(100dvh - var(--cw-persistent-nav-space))'),'Persistent stage must explicitly fill the dynamic viewport above the universal navbar.');
assert(!/#cw-persistent-system-stage\{[^}]*height:auto/.test(shell),'Persistent stage must never regress to intrinsic iframe height:auto.');

assert(realm.includes('realm-console-canonical-v257-bounded-mobile-boot'),'Cerbanimo must use the bounded mobile boot build.');
assert(!realm.includes('/app/install-boundary-v146.js'),'Cerbanimo frame must not boot the global install/shell observer stack.');
assert(!realm.includes('/app/local-object-mesh-v146.js'),'Cerbanimo frame must not boot the global object-mesh observer stack.');
for(const src of [
  '/app/cw-reward-ledger-v2.js?v=basic-value-v1',
  '/app/civweave-basic-value-v1.js?v=acorn-scale-v2',
  '/app/cw-reward-receivers-v2.js?v=basic-value-v1',
  '/app/civweave-basic-value-model-v1.js?v=acorn-scale-v2'
]){
  assert(realm.includes(`<script src="${src}" defer></script>`),`${src} must never block Cerbanimo HTML parsing.`);
}
assert(realm.includes('<div class="rc-loading">Opening Cerbanimo…</div>'),'Cerbanimo must expose a paintable first-frame loading surface before workbench runtimes finish.');

assert(shellRuntime.includes('host.src=target.href'),'System navigation must change only the content stage.');
assert(shellRuntime.includes('persistentNavbar:true'),'Persistent shell API must explicitly guarantee navbar persistence.');
assert(generationLifecycle.includes('const wiredFrames=new WeakSet()'),'Cross-frame lifecycle discovery must bind each persistent iframe only once.');
assert(!generationLifecycle.includes('new MutationObserver'),'Cross-frame lifecycle discovery must not watch the entire shell DOM.');
assert(generationLifecycle.includes('for(const delay of [0,100,500,1500,4000,9000])setTimeout(refreshBindings,delay)'),'Cross-frame lifecycle discovery must remain finite.');

console.log('Cerbanimo freeze regression contract passed: installed runtime requests are deadline-bounded, warm-cache fanout is finite, Cerbanimo first paint is parser-independent from reward runtimes, and cross-frame lifecycle discovery remains bounded.');
