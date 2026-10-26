import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
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
assert(scriptTag(realm,'/app/themed-system-nav-v178.js'),'Cerbanimo must load the canonical destination-feature owner. Loading that owner must not mount embedded chrome.');
assert(!realm.includes('/app/persistent-shell-actions-v1.js'),'Cerbanimo content must not instantiate another Guild/Map rail.');
assert(!realm.includes('/app/install-boundary-v146.js'),'Cerbanimo content must not load the global shell injector inside the content frame.');
assert(!realm.includes('/app/platform-experience-v160.js'),'Cerbanimo content must not run the global experience observer stack inside the frame.');
assert(!realm.includes('/app/local-object-mesh-v146.js'),'Cerbanimo content must not run the global object-mesh observer stack inside the frame.');
assert(realm.includes('/app/cerbanimo-quest-engine-v144.js'),'Cerbanimo must retain the actual Quest engine.');
assert(cerbanimoNavStability.includes("const persistentEmbedded=embedded&&(params.get('embed')==='1'||params.get('persistentShell')==='1')"),'Cerbanimo nav stability must distinguish persistent-shell frames from top-level standalone entry.');
assert(!cerbanimoNavStability.includes('window.top.location.replace'),'Embedded Cerbanimo must never navigate the parent shell.');
assert(cerbanimoNavStability.includes("document.documentElement.dataset.cerbanimoEmbed=persistentEmbedded?'persistent-shell-frame':'foreign-frame'"),'Cerbanimo must explicitly mark persistent-shell embedding.');

// The shared navigation file also owns destination-feature consumption. Prove
// its real embedded path instead of mistaking a script tag for another navbar.
{
  const href='https://civweave.test/app/realm-console-v140.html?system=cerbanimo&cabinet=1&installed=1&embed=1&persistentShell=1&feature=project-workbench';
  const listeners=new Map(),created=[],removed=[],parentRail={owner:'parent'},childNodes=new Map();
  for(const id of ['cw-themed-system-nav','cw-themed-system-nav-menu','cw-themed-system-nav-style'])childNodes.set(id,{remove(){removed.push(id);childNodes.delete(id)}});
  let ready=false,activations=0;
  const child={},parent={rail:parentRail};child.self=child;child.top=parent;
  const document={readyState:'complete',documentElement:{dataset:{civweaveSystem:'cerbanimo'},classList:{remove(){}}},body:{style:{removeProperty(){}}},getElementById:id=>childNodes.get(id)||null,
    querySelector:selector=>ready&&selector==='[data-dashboard-room="project-workbench"],[data-room="project-workbench"]'?{click(){activations++}}:null,
    createElement:type=>{created.push(type);throw new Error('Embedded navigation attempted to create '+type)},addEventListener(){}};
  const context={window:child,document,location:new URL(href),URL,URLSearchParams,addEventListener:(name,handler)=>listeners.set(name,handler),
    setTimeout:()=>{throw new Error('Embedded feature readiness must not schedule mount retries')}};
  vm.runInNewContext(nav,context);
  const owner=context.CivweaveFamilyNavigationV178;
  assert.equal(owner.ensureMounted(),false);assert.equal(owner.mount(),false);
  assert.equal(childNodes.size,0,'Embedded startup must remove only its own stale navigation DOM.');
  assert.equal(removed.length,3);assert.deepEqual(created,[]);assert.equal(parent.rail,parentRail);
  assert.equal(activations,0,'The shortcut must wait for the actual capability to become ready.');
  ready=true;listeners.get('civweave:realm-console-ready')();
  assert.equal(activations,1,'The requested native workbench must activate through the existing owner.');
  listeners.get('civweave:realm-console-ready')();
  assert.equal(activations,1,'Repeated readiness must not replay the destination action.');
  assert.equal(context.location.href,href,'An embedded shortcut must preserve its parent launch identity.');
  const listenerCount=listeners.size;vm.runInNewContext(nav,context);
  assert.equal(context.CivweaveFamilyNavigationV178,owner);assert.equal(listeners.size,listenerCount);assert.deepEqual(created,[]);
}

// Exercise the parent runtime's public suppression operation against actual
// frame URLs. A matching native view may change its hash; other documents may
// not acquire the parent's chrome policy by changing origin, path or launch keys.
{
  const expected='https://civweave.test/app/realm-console-v140.html?system=cerbanimo&cabinet=1&installed=1&embed=1&persistentShell=1&feature=project-workbench';
  let removals=0;
  const childDocument={documentElement:{dataset:{}},getElementById:()=>({remove(){removals++}})};
  const frame={dataset:{cwExpectedHref:expected},contentDocument:childDocument,contentWindow:{location:{href:expected+'#project-workbench'}}};
  const document={readyState:'loading',getElementById:id=>id==='cw-persistent-system-stage'?frame:null,addEventListener(){}};
  const context={document,location:new URL('https://civweave.test/app/persistent-system-shell-v1.html?system=cerbanimo'),URL,URLSearchParams,addEventListener(){},MutationObserver:class{observe(){}disconnect(){}}};
  vm.runInNewContext(shellRuntime,context);
  const owner=context.CivweavePersistentSystemShellV1;
  assert.equal(owner.suppressChildChrome(),true);assert.equal(removals,3);assert.equal(childDocument.documentElement.dataset.persistentParentChrome,'parent-owned');
  const rejected=[expected.replace('https://civweave.test','https://untrusted.test'),expected.replace('realm-console-v140','fellowfare-cabinet-v144'),expected.replace('system=cerbanimo','system=fellowfare'),expected.replace('embed=1','embed=0'),expected.replace('persistentShell=1','persistentShell=0'),expected.replace('feature=project-workbench','feature=observatory')];
  for(const href of rejected){frame.contentWindow.location.href=href;const before=removals;assert.equal(owner.suppressChildChrome(),false,href);assert.equal(removals,before,'Rejected frame identity must not mutate its document.');}
}

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
