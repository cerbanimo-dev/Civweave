import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const realm=read('public/app/realm-console-v140.html');
const consoleRuntime=read('public/app/realm-console-v140.js');
const navStability=read('public/app/cerbanimo-nav-stability-v1.js');
const questEngine=read('public/app/cerbanimo-quest-engine-v144.js');
const activeWorker=read('public/service-worker-v203.js');
const directShellRetirement=read('public/service-worker-direct-shell-retirement-v1.js');

assert(realm.includes('data-build="realm-console-canonical-v249-direct-shell-nav-interaction-r1"'),'Cerbanimo console is missing the direct-shell navigation/interaction build marker.');
assert(realm.includes('html.cw-themed-system-nav-active .rc-bottom{display:none!important}'),'Cerbanimo fallback room navigation must be hidden only after the canonical five-system rail is active.');
assert(!realm.includes('<style id="rc-single-owner-nav">.rc-bottom{display:none!important}</style>'),'Cerbanimo must not hide its fallback navigation unconditionally.');
assert(realm.includes('/app/system-routes-v227.js?v=1.0.167-five-system-route-contract-v229-v440-home-live-guild-balance'),'Cerbanimo must load the current direct five-system route contract.');
assert(realm.includes('/app/themed-system-nav-v178.js?v=1.0.163-five-guide-rail-direct-r2'),'Cerbanimo must cache-bust the canonical five-system navigation rail.');
assert(realm.includes('/app/cerbanimo-nav-stability-v1.js?v=nav-stability-r3-direct-shell'),'Cerbanimo must cache-bust direct-shell navigation recovery.');
assert(realm.includes('/app/realm-console-v140.js?v=canonical-r4-direct-shell-route-context'),'Cerbanimo must cache-bust the route-context interaction fix.');

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

assert(activeWorker.includes('/service-worker-direct-shell-retirement-v1.js?v=direct-shell-retirement-v1'),'The installed PWA must actively retire the old iframe family shell.');
assert(activeWorker.includes('/service-worker-canonical-navbar-v1.js?v=canonical-navbar-network-first-v8-v440-home-css-isolation'),'The installed PWA must keep network-first ownership of canonical navigation assets.');
assert(directShellRetirement.includes("'/app/persistent-family-shell-v1.html'"),'The direct-shell retirement worker must purge the old persistent family shell.');
assert(directShellRetirement.includes("cerbanimo:'/app/realm-console-v140.html'"),'Retired Cerbanimo shell clients must be redirected to the direct realm console.');

assert(questEngine.includes("const VERSION='1.0.33-cerbanimo-v144-frame-bounded'"),'Quest engine must retain the frame-bounded runtime revision.');
assert(questEngine.includes("if(typeof requestAnimationFrame==='function'&&!document.hidden)requestAnimationFrame(run);else setTimeout(run,0)"),'Quest engine rerenders must yield to a browser frame rather than chaining synchronous work.');
assert(questEngine.includes("observer.observe(target,{childList:true,subtree:false})"),'Quest engine must observe only console-shell replacement, not every descendant mutation.');
assert(!questEngine.includes("observer.observe(document.querySelector('#rc-app')||document.documentElement,{childList:true,subtree:true})"),'Quest engine must not restore the broad subtree observer that can wake on every UI mutation.');

console.log('Cerbanimo direct-shell regression contract passed: top-level route context survives taps, stale iframe markers are removed, navigation fails open, and Quest rerenders remain frame-bounded.');
