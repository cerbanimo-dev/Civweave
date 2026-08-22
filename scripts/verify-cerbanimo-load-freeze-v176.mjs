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

assert(realm.includes('data-build="realm-console-canonical-v251-universal-navbar-only-r1"'),'Cerbanimo console is missing the universal-navbar-only build marker.');
assert(realm.includes('<style id="rc-universal-nav-only">.rc-bottom{display:none!important}</style>'),'Cerbanimo must never expose legacy realm-local bottom navigation from stale cached runtime code.');
assert(!realm.includes('html.cw-themed-system-nav-active .rc-bottom{display:none!important}'),'Cerbanimo must not make a realm-local bottom bar conditional on universal-nav readiness.');
assert(realm.includes('Cerbanimo owns no realm-local bottom navigation. The existing universal five-system navbar is the only bottom navigation owner.'),'Cerbanimo must document universal navbar ownership explicitly.');
const mainIndex=realm.indexOf('<main id="rc-app"');
const normalizeIndex=realm.indexOf('id="rc-universal-nav-route-normalization"');
const parityIndex=realm.indexOf('/app/shared/civweave-parity-runtime.js');
const consoleIndex=realm.indexOf('/app/realm-console-v140.js');
const routeIndex=realm.indexOf('/app/system-routes-v227.js');
const navIndex=realm.indexOf('/app/themed-system-nav-v178.js');
assert(mainIndex>=0&&normalizeIndex>mainIndex&&parityIndex>normalizeIndex&&consoleIndex>parityIndex&&routeIndex>consoleIndex&&navIndex>routeIndex,'Cerbanimo must paint, normalize stale route markers, render, then mount the universal navbar.');
assert(realm.includes("next.searchParams.delete('embed')"),'Cerbanimo must clear stale embed markers before the universal navbar evaluates the route.');
assert(realm.includes("next.searchParams.get('civweave')==='1'"),'Cerbanimo must clear the retired pseudo-embed marker before universal navbar boot.');
assert(realm.includes('/app/themed-system-nav-v178.js?v=1.0.163-five-guide-rail-universal-top-level-r1" defer'),'Cerbanimo must mount the existing universal five-system navbar, not a realm-specific substitute.');
assert(realm.includes('/app/cerbanimo-nav-stability-v1.js?v=nav-stability-r4-universal-navbar-only" defer'),'Cerbanimo universal-navbar recovery must remain deferred and non-blocking.');

assert(consoleRuntime.includes("const VERSION='1.0.32'"),'Cerbanimo realm console runtime must include the universal-navbar-only revision.');
assert(!consoleRuntime.includes('function bottomNav('),'Cerbanimo runtime must not define a realm-local bottom navbar.');
assert(!consoleRuntime.includes('class=\"rc-bottom\"'),'Cerbanimo runtime must not render a realm-local bottom navbar.');
assert(consoleRuntime.includes('const query=new URLSearchParams(location.search)'),'Internal Cerbanimo routing must preserve the current canonical launch context.');
assert(consoleRuntime.includes("query.delete('embed')"),'Top-level Cerbanimo interactions must remove stale iframe markers.');
assert(consoleRuntime.includes("query.get('civweave')==='1'"),'Top-level Cerbanimo interactions must recognize and remove the retired pseudo-embed marker.');
assert(!consoleRuntime.includes("new URLSearchParams({system:state.systemId,embed:'1'})"),'Internal Cerbanimo clicks must never force the top-level app back into iframe mode.');

assert(navStability.includes("const VERSION='1.0.5-cerbanimo-universal-navbar-only'"),'Cerbanimo navigation recovery must expose the universal-navbar-only revision.');
assert(navStability.includes("navOwner:'universal-five-system-navbar'"),'Cerbanimo must identify the universal five-system navbar as its sole navigation owner.');
assert(navStability.includes("document.querySelectorAll('.rc-bottom').forEach(node=>node.remove())"),'Cerbanimo recovery must remove any realm-local bottom bar produced by stale runtime code.');
assert(navStability.includes("const NAV_SRC='/app/themed-system-nav-v178.js?v=1.0.163-five-guide-rail-universal-top-level-r1'"),'Cerbanimo recovery must remount the existing universal navbar component.');
assert(navStability.includes('function cleanDirectUrl()'),'Cerbanimo navigation recovery must normalize legacy route markers before remounting the universal navbar.');
assert(navStability.includes("[0,180,700,1800]"),'Cerbanimo navigation recovery must remain bounded.');
assert(!navStability.includes('setInterval'),'Cerbanimo navigation recovery must not poll forever.');

assert(realmNavigationWorker.includes("const NETWORK_TIMEOUT_MS=1800"),'Exact realm navigation must have a short finite network deadline.');
assert(realmNavigationWorker.includes('new AbortController()'),'Exact realm navigation must be able to abort a stalled request.');
assert(realmNavigationWorker.includes("signal:controller.signal"),'The realm HTML network request must use the abort signal.');
assert(realmNavigationWorker.includes("const cachedPromise=cached(pathname)"),'Realm navigation must prepare the last validated page while the network attempt runs.');
assert(realmNavigationWorker.includes("policy:'exact-network-first-bounded-realm-html-cached-fallback-never-home-substitution'"),'Realm navigation must preserve exact-system ownership while failing over quickly.');
assert(activeWorker.includes('/service-worker-five-system-pages-v1.js?v=five-system-pages-v1-bounded-realm-navigation-r2'),'The installed PWA must retain bounded exact-realm navigation.');
assert(activeWorker.includes('/service-worker-direct-shell-retirement-v1.js?v=direct-shell-retirement-v1'),'The installed PWA must actively retire the old iframe family shell.');
assert(directShellRetirement.includes("'/app/persistent-family-shell-v1.html'"),'The direct-shell retirement worker must purge the old persistent family shell.');
assert(directShellRetirement.includes("cerbanimo:'/app/realm-console-v140.html'"),'Retired Cerbanimo shell clients must be redirected to the direct realm console.');

assert(questEngine.includes("const VERSION='1.0.33-cerbanimo-v144-frame-bounded'"),'Quest engine must retain the frame-bounded runtime revision.');
assert(questEngine.includes("if(typeof requestAnimationFrame==='function'&&!document.hidden)requestAnimationFrame(run);else setTimeout(run,0)"),'Quest engine rerenders must yield to a browser frame rather than chaining synchronous work.');
assert(questEngine.includes("observer.observe(target,{childList:true,subtree:false})"),'Quest engine must observe only console-shell replacement, not every descendant mutation.');
assert(!questEngine.includes("observer.observe(document.querySelector('#rc-app')||document.documentElement,{childList:true,subtree:true})"),'Quest engine must not restore the broad subtree observer that can wake on every UI mutation.');

console.log('Cerbanimo regression contract passed: exact realm navigation is bounded, stale route markers are normalized before boot, and the universal five-system navbar is the sole bottom navigation owner.');
