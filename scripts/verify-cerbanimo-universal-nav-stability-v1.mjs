import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const shell=read('public/app/persistent-system-shell-v1.html');
const shellRuntime=read('public/app/persistent-system-shell-v1.js');
const realm=read('public/app/realm-console-v140.html');
const nav=read('public/app/themed-system-nav-v178.js');
const shellAssets=read('public/service-worker-shell-assets-v1.js');
const realmWorker=read('public/service-worker-five-system-pages-v1.js');
const homeWorker=read('public/service-worker-canonical-home-v1.js');
const quest=read('public/app/cerbanimo-quest-engine-v144.js');

assert(shell.includes('data-build="persistent-system-shell-v1-r1"'),'Persistent shell must be the top-level five-system owner.');
assert(shell.includes('id="cw-persistent-system-stage"'),'Persistent shell must own one content stage.');
assert(shell.includes('/app/themed-system-nav-v178.js?v=1.0.163-five-system-navigation-v232-canonical-rail'),'Persistent shell must reuse the canonical shared navbar unchanged.');
assert(shell.includes('/app/persistent-shell-actions-v1.js?v=1.0.6-direct-routes-bounded-nav-observer'),'Persistent shell must reuse shared Guild/Map actions.');
assert(shellRuntime.includes("document.addEventListener('click',intercept,true)"),'Persistent shell must intercept shared navbar navigation before a top-level reload.');
assert(shellRuntime.includes("'#cw-themed-system-nav a[data-system]'"),'Persistent shell must route the existing shared navbar links.');
assert(shellRuntime.includes("'#cw-themed-system-nav-menu [data-cw-nav-feature]'"),'Persistent shell must keep shared navbar quick actions inside the persistent stage.');
assert(shellRuntime.includes("host.src=target.href"),'System changes must replace only the content stage.');
assert(shellRuntime.includes('history['),'Persistent system changes must update history without replacing the shell document.');

assert(realm.includes('data-build="realm-console-canonical-v256-persistent-shell-content-r1"'),'Cerbanimo must be a content-only realm inside the persistent shell.');
assert(realm.includes("query.get('embed')==='1'"),'Cerbanimo must recognize persistent-shell embedding.');
assert(realm.includes("location.replace(target.href)"),'Direct top-level Cerbanimo entry must recover into the persistent system shell.');
assert(!realm.includes('/app/themed-system-nav-v178.js'),'Cerbanimo content must not instantiate another navbar.');
assert(!realm.includes('/app/persistent-shell-actions-v1.js'),'Cerbanimo content must not instantiate another Guild/Map rail.');
assert(!realm.includes('/app/install-boundary-v146.js'),'Cerbanimo content must not load the global shell injector inside the content frame.');
assert(!realm.includes('/app/platform-experience-v160.js'),'Cerbanimo content must not run the global experience observer stack inside the frame.');
assert(!realm.includes('/app/local-object-mesh-v146.js'),'Cerbanimo content must not run the global object-mesh observer stack inside the frame.');
assert(realm.includes('/app/cerbanimo-quest-engine-v144.js'),'Cerbanimo must retain the actual Quest engine.');

for(const sheet of ['/Civweave-weaveling-sprites.png','/Living-School-moss-sprites.png','/Cerbanimo-kamiya-sprites.png','/FellowFare-rook-sprites.png','/Anarchadia-merlin-sprites.png']){
  assert(nav.includes(sheet),`Shared navbar must retain sprite sheet ${sheet}.`);
  assert(shellAssets.includes(sheet),`Installed shell must require sprite sheet ${sheet}.`);
}
for(const fallback of ['/app/assets/ai/chat/weaveling-face-v255.webp','/app/assets/ai/chat/moss-face-v255.webp','/app/assets/ai/chat/kamiya-face-v255.webp','/app/assets/ai/chat/rook-face-v255.webp','/app/assets/ai/chat/merlin-face-v255.webp'])assert(shellAssets.includes(fallback),`Installed shell must require fallback portrait ${fallback}.`);
assert(shellAssets.includes('/app/persistent-system-shell-v1.html'),'Persistent shell HTML must be a required installed asset.');
assert(shellAssets.includes('/app/persistent-system-shell-v1.js'),'Persistent shell runtime must be a required installed asset.');

assert(realmWorker.includes("const SHELL_PATH='/app/persistent-system-shell-v1.html'"),'Realm navigation worker must target the persistent shell.');
assert(realmWorker.includes("url.searchParams.get('embed')==='1'"),'Realm worker must preserve embedded content loads.');
assert(realmWorker.includes('shellRedirect(url,spec.system)'),'Top-level realm navigation must enter the persistent shell.');
assert(homeWorker.includes("const SHELL_PATH='/app/persistent-system-shell-v1.html'"),'Home navigation worker must target the same persistent shell.');
assert(homeWorker.includes("url.searchParams.get('embed')==='1'"),'Home worker must preserve embedded Civweave content.');

assert(quest.includes("const VERSION='1.0.33-cerbanimo-v144-frame-bounded'"),'Quest engine must retain the frame-bounded runtime.');
assert(quest.includes("observer.observe(target,{childList:true,subtree:false})"),'Quest engine observer must remain shallow and frame-local.');
assert(quest.includes("if(typeof requestAnimationFrame==='function'&&!document.hidden)requestAnimationFrame(run);else setTimeout(run,0)"),'Quest rerenders must yield to the browser frame.');

console.log('Persistent navbar contract passed: one top-level canonical navbar survives system changes, realm pages are content-only, sprite media is required offline, and Cerbanimo no longer runs global shell observers inside its frame.');
