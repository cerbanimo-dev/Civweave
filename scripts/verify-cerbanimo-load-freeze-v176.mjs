import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const realm=read('public/app/realm-console-v140.html');
const consoleRuntime=read('public/app/realm-console-v140.js');
const navStability=read('public/app/cerbanimo-nav-stability-v1.js');
const questEngine=read('public/app/cerbanimo-quest-engine-v144.js');
const activeWorker=read('public/service-worker-v203.js');
const realmNavigationWorker=read('public/service-worker-five-system-pages-v1.js');
const directShellRetirement=read('public/service-worker-direct-shell-retirement-v1.js');

assert(realm.includes('data-build="realm-console-canonical-v250-paint-before-navigation-r1"'),'Cerbanimo console is missing the paint-before-navigation build marker.');
assert(realm.includes('html.cw-themed-system-nav-active .rc-bottom{display:none!important}'),'Cerbanimo fallback room navigation must be hidden only after the canonical five-system rail is active.');
assert(!realm.includes('<style id="rc-single-owner-nav">.rc-bottom{display:none!important}</style>'),'Cerbanimo must not hide its fallback navigation unconditionally.');
const mainIndex=realm.indexOf('<main id="rc-app"');
const parityIndex=realm.indexOf('/app/shared/civweave-parity-runtime.js');
const consoleIndex=realm.indexOf('/app/realm-console-v140.js');
const routeIndex=realm.indexOf('/app/system-routes-v227.js');
const navIndex=realm.indexOf('/app/themed-system-nav-v178.js');
assert(mainIndex>=0&&parityIndex>mainIndex&&consoleIndex>parityIndex&&routeIndex>consoleIndex&&navIndex>routeIndex,'Cerbanimo must paint its loading surface, then run render-critical scripts, then boot navigation.');
assert(realm.includes('/app/system-routes-v227.js?v=1.0.167-five-system-route-contract-v229-v440-home-live-guild-balance" defer'),'Cerbanimo route ownership must be deferred until after the page can paint.');
assert(realm.includes('/app/themed-system-nav-v178.js?v=1.0.163-five-guide-rail-direct-r2" defer'),'Cerbanimo five-system navigation must be deferred until after the page can paint.');
assert(realm.includes('/app/cerbanimo-nav-stability-v1.js?v=nav-stability-r3-direct-shell" defer'),'Cerbanimo navigation recovery must not parser-block the page.');

assert(consoleRuntime.includes("const VERSION='1.0.31'"),'Cerbanimo realm console runtime version must include the direct-route fix.');
assert(consoleRuntime.includes('const query=new URLSearchParams(location.search)'),'Internal Cerbanimo routing must preserve the current canonical launch context.');
assert(consoleRuntime.includes("query.delete('embed')"),'Top-level Cerbanimo interactions must remove stale iframe markers.');
assert(consoleRuntime.includes("query.get('civweave')==='1'"),'Top-level Cerbanimo interactions must recognize and remove the retired pseudo-embed marker.');
assert(!consoleRuntime.includes("new URLSearchParams({system:state.systemId,embed:'1'})"),'Internal Cerbanimo clicks must never force the top-level app back into iframe mode.');

assert(navStability.includes("const VERSION='1.0.4-cerbanimo-nav-stability-direct-route-recovery'"),'Cerbanimo navigation recovery must expose the direct-route revision.');
assert(navStability.includes('function normalizeDirectRoute()'),'Cerbanimo navigation recovery must normalize legacy route markers before remounting the rail.');
assert(navStability.includes("next.searchParams.delete('embed')"),'Cerbanimo navigation recovery must clear stale embed markers on top-level routes.');
assert(navStability.includes("next.searchParams.get('civweave')==='1'"),'Cerbanimo navigation recovery must clear the retired civweave pseudo-embed marker.');
assert(navStability.includes("[0,180,700,1800]"),'Cerbanimo navigation recovery must remain bounded.');
assert(!navStability.includes('setInterval'),'Cerbanimo navigation recovery must not poll forever.');

assert(realmNavigationWorker.includes("const NETWORK_TIMEOUT_MS=1800"),'Exact realm navigation must have a short finite network deadline.');
assert(realmNavigationWorker.includes('new AbortController()'),'Exact realm navigation must be able to abort a stalled request.');
assert(realmNavigationWorker.includes("signal:controller.signal"),'The realm HTML network request must use the abort signal.');
assert(realmNavigationWorker.includes("const cachedPromise=cached(pathname)"),'Realm navigation must prepare the last validated page while the network attempt runs.');
assert(realmNavigationWorker.includes("policy:'exact-network-first-bounded-realm-html-cached-fallback-never-home-substitution'"),'Realm navigation must preserve exact-system ownership while failing over quickly.');
assert(activeWorker.includes('/service-worker-five-system-pages-v1.js?v=five-system-pages-v1-bounded-realm-navigation-r2'),'The installed PWA must rotate to bounded exact-realm navigation.');
assert(activeWorker.includes("cwrecovery-v445-cerbanimo-navigation"),'Staging must perform a one-shot activation of the bounded Cerbanimo navigation repair.');
assert(activeWorker.includes('/service-worker-direct-shell-retirement-v1.js?v=direct-shell-retirement-v1'),'The installed PWA must actively retire the old iframe family shell.');
assert(directShellRetirement.includes("'/app/persistent-family-shell-v1.html'"),'The direct-shell retirement worker must purge the old persistent family shell.');
assert(directShellRetirement.includes("cerbanimo:'/app/realm-console-v140.html'"),'Retired Cerbanimo shell clients must be redirected to the direct realm console.');

assert(questEngine.includes("const VERSION='1.0.33-cerbanimo-v144-frame-bounded'"),'Quest engine must retain the frame-bounded runtime revision.');
assert(questEngine.includes("if(typeof requestAnimationFrame==='function'&&!document.hidden)requestAnimationFrame(run);else setTimeout(run,0)"),'Quest engine rerenders must yield to a browser frame rather than chaining synchronous work.');
assert(questEngine.includes("observer.observe(target,{childList:true,subtree:false})"),'Quest engine must observe only console-shell replacement, not every descendant mutation.');
assert(!questEngine.includes("observer.observe(document.querySelector('#rc-app')||document.documentElement,{childList:true,subtree:true})"),'Quest engine must not restore the broad subtree observer that can wake on every UI mutation.');

console.log('Cerbanimo load-freeze regression contract passed: realm navigation has a finite network deadline, the page paints before nav boot, route context survives taps, and Quest rerenders remain frame-bounded.');
