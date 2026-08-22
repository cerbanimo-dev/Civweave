import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const realm=read('public/app/realm-console-v140.html');
const guard=read('public/app/cerbanimo-universal-nav-single-owner-v1.js');
const media=read('public/app/universal-nav-media-stability-v1.js');
const actions=read('public/app/persistent-shell-actions-v1.js');
const quest=read('public/app/cerbanimo-quest-engine-v144.js');

assert(realm.includes('data-build="realm-console-canonical-v252-universal-nav-single-owner-r1"'),'Cerbanimo must use the single-owner universal-nav build.');
assert(realm.includes('/app/cerbanimo-universal-nav-single-owner-v1.js?v=1.0.0'),'The single-owner guard must run before deferred route bootstrap.');
assert(realm.indexOf('/app/cerbanimo-universal-nav-single-owner-v1.js')<realm.indexOf('/app/system-routes-v227.js'),'The guard must run before system-routes can install redundant navigation observers.');
assert(realm.includes('/app/universal-nav-media-stability-v1.js?v=1.0.0-canonical-ai-portraits'),'Cerbanimo must repair the existing universal nav with canonical portraits.');
assert(!realm.includes('/app/cerbanimo-video-task-contract-v1.mjs'),'Task taps must not automatically invoke video-resolution work in the core Cerbanimo console.');
assert(!realm.includes('/app/cerbanimo-task-tool-links-v1.mjs'),'Creator-tool mutation observers must not run in the core Cerbanimo console.');

assert(guard.includes("owner:'themed-system-nav-v178'"),'The universal themed navbar must be the explicit sole system-navigation owner.');
assert(guard.includes('CivweaveFiveSystemDirectNavigationV1'),'The redundant direct-navigation capture owner must be suppressed on Cerbanimo.');
assert(guard.includes('CivweavePersistentSystemContextV1'),'The redundant whole-document system-context owner must be suppressed on Cerbanimo.');
assert(!guard.includes('CivweavePersistentShellActionsV1'),'Cerbanimo must keep the shared Guild/Map actions instead of replacing them with a stub.');
assert(actions.includes("const VERSION='1.0.6-direct-routes-bounded-nav-observer'"),'Shared Guild/Map actions must use the bounded observer revision.');
assert(actions.includes("observer.observe(target,{childList:true,subtree:false})"),'Guild/Map action recovery must watch only direct body children.');
assert(!actions.includes("observer.observe(document.documentElement,{childList:true,subtree:true})"),'Guild/Map actions must not watch every Cerbanimo subtree mutation.');

for(const file of ['weaveling.png','moss.png','kamiya.png','rook.png','merlin.png'])assert(media.includes(`/app/assets/ai/${file}`),`Universal navbar must use canonical ${file}.`);
assert(media.includes(".cw-themed-system-avatar{display:none!important}"),'The stale sprite overlay must not cover canonical portrait images.');
assert(!media.includes('MutationObserver'),'Portrait repair must use bounded retries rather than a permanent DOM observer.');
assert(media.includes('[0,120,420,1000,2200]'),'Portrait repair retries must be finite.');

assert(quest.includes("const VERSION='1.0.33-cerbanimo-v144-frame-bounded'"),'Quest engine must retain the frame-bounded runtime.');
assert(quest.includes("observer.observe(target,{childList:true,subtree:false})"),'Quest engine observer must remain shell-bounded.');
assert(quest.includes("if(typeof requestAnimationFrame==='function'&&!document.hidden)requestAnimationFrame(run);else setTimeout(run,0)"),'Quest rerenders must yield to the browser frame.');

console.log('Cerbanimo universal-nav stability contract passed: canonical portraits are used, redundant system-navigation observers are suppressed, Guild/Map actions stay available with a bounded observer, task clicks do not trigger video resolution, and quest rendering remains frame-bounded.');
