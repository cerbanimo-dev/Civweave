import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const shell=read('public/app/persistent-system-shell-v1.html');
const shellRuntime=read('public/app/persistent-system-shell-v1.js');
const realm=read('public/app/realm-console-v140.html');
const cerbanimoNavStability=read('public/app/cerbanimo-nav-stability-v1.js');
const nav=read('public/app/themed-system-nav-v178.js');
const shellAssets=read('public/service-worker-shell-assets-v1.js');
const realmWorker=read('public/service-worker-five-system-pages-v1.js');
const homeWorker=read('public/service-worker-canonical-home-v1.js');
const quest=read('public/app/cerbanimo-quest-engine-v144.js');
const generationLifecycle=read('public/app/generation-lifecycle-v2.js');
const scriptTag=(html,path)=>[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].find(match=>match[1].split('?')[0]===path)?.[0]||'';
const lifecycleTag=scriptTag(shell,'/app/generation-lifecycle-v2.js');
const lifecycleVersion=generationLifecycle.match(/const VERSION=['"](\d+\.\d+\.\d+)[^'"]*['"]/i)?.[1];

assert(/data-build="persistent-system-shell-v1-r\d+[^\"]*"/.test(shell),'Persistent shell must expose a revisioned build identity without pinning the regression test to one historical revision.');
assert(shell.includes('id="cw-persistent-system-stage"'),'Persistent shell must own one content stage.');
assert(shell.includes('--cw-persistent-nav-space:'),'Persistent shell must define one shared reserved navbar height.');
assert(shell.includes('height:calc(100dvh - var(--cw-persistent-nav-space))'),'Persistent iframe stage must explicitly fill the viewport above the navbar.');
assert(!/#cw-persistent-system-stage\{[^}]*height:auto/.test(shell),'Persistent iframe must never use intrinsic height:auto; that exposes the parent background as a dark card.');
assert(scriptTag(shell,'/app/themed-system-nav-v178.js'),'Persistent shell must reuse the canonical shared navbar.');
assert(scriptTag(shell,'/app/persistent-shell-actions-v1.js'),'Persistent shell must reuse shared Guild/Map actions.');
assert(lifecycleTag&&lifecycleVersion&&lifecycleTag.includes(`v=${lifecycleVersion}-`),'Persistent shell must load the current generation lifecycle revision.');
assert(shellRuntime.includes("document.addEventListener('click',intercept,true)"),'Persistent shell must intercept shared navbar navigation before a top-level reload.');
assert(shellRuntime.includes("'#cw-themed-system-nav a[data-system]'"),'Persistent shell must route the existing shared navbar links.');
assert(shellRuntime.includes("'#cw-themed-system-nav-menu [data-cw-nav-feature]'"),'Persistent shell must keep shared navbar quick actions inside the persistent stage.');
assert(shellRuntime.includes("host.src=target.href"),'System changes must replace only the content stage.');
assert(shellRuntime.includes('history['),'Persistent system changes must update history without replacing the shell document.');
assert(shellRuntime.includes('host.dataset.cwExpectedHref=target.href'),'Persistent shell must record the expected iframe target for each navigation.');
assert(shellRuntime.includes('frameMatchesExpected(host,expectedHref)'),'Persistent shell must reject stale iframe load completions.');
assert(shellRuntime.includes('clearChildChromeWork()'),'Persistent shell must cancel old child-chrome observers and timers between system changes.');
assert(shellRuntime.includes('chromeTimers=[0,60,220,800,1800].map'),'Child-chrome retries must be owned by the active navigation and cancelable.');

assert(/data-build="realm-console-canonical-v\d+[^\"]*"/.test(realm),'Cerbanimo must expose a revisioned canonical realm build identity.');
assert(realm.includes("query.get('embed')==='1'"),'Cerbanimo must recognize persistent-shell embedding.');
assert(realm.includes("location.replace(target.href)"),'Direct top-level Cerbanimo entry must recover into the persistent system shell.');
assert(!realm.includes('/app/themed-system-nav-v178.js'),'Cerbanimo content must not instantiate another navbar.');
assert(!realm.includes('/app/persistent-shell-actions-v1.js'),'Cerbanimo content must not instantiate another Guild/Map rail.');
assert(!realm.includes('/app/install-boundary-v146.js'),'Cerbanimo content must not load the global shell injector inside the content frame.');
assert(!realm.includes('/app/platform-experience-v160.js'),'Cerbanimo content must not run the global experience observer stack inside the frame.');
assert(!realm.includes('/app/local-object-mesh-v146.js'),'Cerbanimo content must not run the global object-mesh observer stack inside the frame.');
assert(realm.includes('/app/cerbanimo-quest-engine-v144.js'),'Cerbanimo must retain the actual Quest engine.');
assert(cerbanimoNavStability.includes("const persistentEmbedded=embedded&&(params.get('embed')==='1'||params.get('persistentShell')==='1')"),'Cerbanimo nav stability must distinguish persistent-shell frames from top-level standalone entry.');
assert(!cerbanimoNavStability.includes('window.top.location.replace'),'Embedded Cerbanimo must never navigate the parent shell.');
assert(cerbanimoNavStability.includes("document.documentElement.dataset.cerbanimoEmbed=persistentEmbedded?'persistent-shell-frame':'foreign-frame'"),'Cerbanimo must explicitly mark persistent-shell embedding.');

assert(/const VERSION=['"][^'"]*generation-lifecycle-v2[^'"]*['"]/.test(generationLifecycle),'Generation lifecycle must use the canonical v2 runtime.');
assert(generationLifecycle.includes('const wiredFrames=new WeakSet()'),'Generation lifecycle must remember which iframe elements already own a load hook.');
assert(generationLifecycle.includes('if(!frame||wiredFrames.has(frame))return false'),'Generation lifecycle must not accumulate duplicate iframe load listeners.');
assert(!generationLifecycle.includes('new MutationObserver'),'Generation lifecycle must never use a document-wide MutationObserver to discover runtime readiness.');
assert(generationLifecycle.includes("frame.addEventListener('load',()=>setTimeout(attach,0),{passive:true})"),'Generation lifecycle must attach one passive load hook per persistent stage iframe.');
assert(generationLifecycle.includes('for(const delay of [0,100,500,1500,4000,9000])setTimeout(refreshBindings,delay)'),'Generation lifecycle startup discovery must remain finite and bounded.');

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

assert(/const VERSION=['"][^'"]*cerbanimo-v144[^'"]*['"]/.test(quest),'Quest engine must retain the canonical Cerbanimo runtime.');
assert(quest.includes("observer.observe(target,{childList:true,subtree:false})"),'Quest engine observer must remain shallow and frame-local.');
assert(quest.includes("if(typeof requestAnimationFrame==='function'&&!document.hidden)requestAnimationFrame(run);else setTimeout(run,0)"),'Quest rerenders must yield to the browser frame.');

console.log('Persistent navbar contract passed: one top-level canonical navbar survives system changes, Cerbanimo remains content-only, and cross-frame generation lifecycle discovery is finite, event-driven, and listener-idempotent.');
