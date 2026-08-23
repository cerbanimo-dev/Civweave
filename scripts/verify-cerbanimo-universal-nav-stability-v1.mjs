import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const realm=read('public/app/realm-console-v140.html');
const nav=read('public/app/themed-system-nav-v178.js');
const actions=read('public/app/persistent-shell-actions-v1.js');
const quest=read('public/app/cerbanimo-quest-engine-v144.js');

assert(realm.includes('data-build="realm-console-canonical-v254-shared-navbar-r1"'),'Cerbanimo must use the direct shared-navbar build.');
assert(realm.includes('data-civweave-system="cerbanimo"'),'Cerbanimo must declare its system to the shared navbar.');
assert(realm.includes('/app/system-routes-v227.js?v=1.0.167-five-system-route-contract-v229-v440-home-live-guild-balance'),'Cerbanimo must load the shared system routes.');
assert(realm.includes('/app/themed-system-nav-v178.js?v=1.0.163-five-system-navigation-v232-canonical-rail'),'Cerbanimo must load the canonical shared themed navbar directly.');
assert(realm.includes('/app/persistent-shell-actions-v1.js?v=1.0.6-direct-routes-bounded-nav-observer'),'Cerbanimo must reuse the shared Guild/Map navbar actions.');
assert(realm.indexOf('/app/system-routes-v227.js')<realm.indexOf('/app/themed-system-nav-v178.js'),'Shared system routes must be ready before the navbar mounts.');
assert(realm.indexOf('/app/themed-system-nav-v178.js')<realm.indexOf('/app/realm-console-v140.js'),'The shared navbar must mount before Cerbanimo workbench boot code.');
assert(!realm.includes('/app/cerbanimo-universal-nav-single-owner-v1.js'),'Cerbanimo must not install a realm-specific navbar ownership shim.');
assert(!realm.includes('/app/universal-nav-media-stability-v1.js'),'Cerbanimo must not replace shared navbar sprites with a realm-specific portrait repair layer.');
assert(!realm.includes('/app/cerbanimo-nav-stability-v1.js'),'Cerbanimo must not run a second navbar watchdog/reinjection loop.');
assert(!realm.includes('rc-staging-current-worker-refresh'),'Cerbanimo must not reload itself to repair navbar state.');
assert(!realm.includes('rc-universal-nav-only'),'Cerbanimo must not hide local navigation with a realm-specific navbar stylesheet.');
assert(!realm.includes('/app/cerbanimo-video-task-contract-v1.mjs'),'Task taps must not automatically invoke video-resolution work in the core Cerbanimo console.');
assert(!realm.includes('/app/cerbanimo-task-tool-links-v1.mjs'),'Creator-tool mutation observers must not run in the core Cerbanimo console.');

for(const sheet of ['/Civweave-weaveling-sprites.png','/Living-School-moss-sprites.png','/Cerbanimo-kamiya-sprites.png','/FellowFare-rook-sprites.png','/Anarchadia-merlin-sprites.png'])assert(nav.includes(sheet),`Shared navbar must retain sprite sheet ${sheet}.`);
for(const fallback of ['/app/assets/ai/chat/weaveling-face-v255.webp','/app/assets/ai/chat/moss-face-v255.webp','/app/assets/ai/chat/kamiya-face-v255.webp','/app/assets/ai/chat/rook-face-v255.webp','/app/assets/ai/chat/merlin-face-v255.webp'])assert(nav.includes(fallback),`Shared navbar must retain fallback portrait ${fallback}.`);
assert(nav.includes("const NAV_ID='cw-themed-system-nav'"),'The canonical themed-system-nav runtime must remain the navbar owner.');
assert(nav.includes('CivweaveFamilyNavigationV178'),'The shared navbar must expose its canonical API.');

assert(actions.includes("const VERSION='1.0.6-direct-routes-bounded-nav-observer'"),'Shared Guild/Map actions must use the bounded observer revision.');
assert(actions.includes("observer.observe(target,{childList:true,subtree:false})"),'Guild/Map action recovery must watch only direct body children.');
assert(!actions.includes("observer.observe(document.documentElement,{childList:true,subtree:true})"),'Guild/Map actions must not watch every Cerbanimo subtree mutation.');

assert(quest.includes("const VERSION='1.0.33-cerbanimo-v144-frame-bounded'"),'Quest engine must retain the frame-bounded runtime.');
assert(quest.includes("observer.observe(target,{childList:true,subtree:false})"),'Quest engine observer must remain shell-bounded.');
assert(quest.includes("if(typeof requestAnimationFrame==='function'&&!document.hidden)requestAnimationFrame(run);else setTimeout(run,0)"),'Quest rerenders must yield to the browser frame.');

console.log('Cerbanimo shared-navbar contract passed: the realm reuses the canonical five-system navbar and sprite sheets directly, with no Cerbanimo-specific navbar shim, portrait replacement layer, reinjection watchdog, or reload loop.');
