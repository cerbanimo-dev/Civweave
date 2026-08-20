import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [contextSource,routeSource,guideCore,guideChat,familyLoader,nav,workingCampus]=await Promise.all([
  read('public/app/persistent-system-context-v1.js'),
  read('public/app/system-routes-v227.js'),
  read('public/app/shared-guide-surface-v236-core-v244.js'),
  read('public/app/guide-chat-surface-v350.js'),
  read('public/app/family-ai-loader-v105.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/working-campus-v156.js')
]);
for(const source of [contextSource,routeSource,guideCore,guideChat,familyLoader,nav,workingCampus])new Function(source);

assert.doesNotMatch(contextSource,/location\.assign\(/,'Persistent system switching must never navigate the document.');
assert.match(contextSource,/navigationReload:false/,'System context must explicitly declare no-reload navigation.');
assert.match(contextSource,/stickyUntilExplicitSwitch:true/,'Selected system context must stay sticky until the user changes it.');
assert.match(contextSource,/data-cw242-window/,'Guide switcher taps must update the same persistent context.');
assert.match(contextSource,/patchFamilyAiLoader/,'Realm-aware chat opening must be redirected into persistent context.');
assert.match(contextSource,/patchFamilyShell/,'Family-shell route callers must be redirected into persistent context.');
assert.match(routeSource,/singlePersistentShell:true/,'System routes must expose one persistent shell.');
assert.match(routeSource,/navigationReloadOnSystemSwitch:false/,'System routes must forbid document reloads for in-shell switches.');
assert.match(routeSource,/context/,'System deep links must carry an in-shell context hint.');
for(const retired of ['realm-console-v140.html','fellowfare-cabinet-v144.html','anarchadia-console-v139.html','cabinets/living-school/index.html'])assert.equal(routeSource.includes(retired),false,`System route contract still names retired entrypoint ${retired}`);
assert.match(guideCore,/pageGuideOwnership:false/,'Physical pages must not own the active guide anymore.');
assert.doesNotMatch(guideCore,/api\.switchGuide\?\.\(currentSystem/,'Shared guide repair must not force a page guide back into control.');
assert.match(guideChat,/function switchGuide\(system,options=\{\}\)/,'Canonical chat must retain in-place guide switching.');
assert.match(guideChat,/activeSystem=SYSTEMS\.includes\(value\.activeSystem\)\?value\.activeSystem:pageSystem/,'Canonical chat must restore the saved guide context.');
assert.match(familyLoader,/openCanonical\(target,prefill\)/,'Realm-aware chat behavior must continue through the canonical chat owner.');
assert.match(nav,/data-system=\"\$\{item\.id\}\"/,'Five-guide rail must expose stable system ids for no-reload switching.');
assert.match(workingCampus,/installPersistentChatLauncherOwnership/,'Working Campus must delegate launcher ownership to persistent system context.');
assert.doesNotMatch(workingCampus,/switchGuide\?\.\('civweave'\)/,'Working Campus must not hard-lock the canonical chat to Weaveling.');
assert.doesNotMatch(workingCampus,/chat\.open\(\{guide:'civweave'/,'Working Campus launcher must not reopen Weaveling over the selected guide.');

const storage=new Map();
const listeners=new Map();
const switches=[];
const navSelections=[];
let loaderContext='';
let shellRouteCalls=0;
const documentElement={dataset:{civweaveSystemRoute:'civweave'},addEventListener(){}};
const document={readyState:'complete',documentElement,body:{dataset:{}},getElementById(){return null},addEventListener(name,fn){listeners.set(name,fn)}};
const sandbox={
  console,Date,Math,Object,Array,Map,Set,String,Number,Boolean,JSON,Promise,WeakSet,URL,URLSearchParams,
  localStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
  location:{pathname:'/app/working-campus-v156.html',search:'?context=cerbanimo',href:'https://civweave.invalid/app/working-campus-v156.html?context=cerbanimo',origin:'https://civweave.invalid'},
  document,MutationObserver:undefined,
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  addEventListener(name,fn){const rows=Array.isArray(listeners.get(name))?listeners.get(name):[];rows.push(fn);listeners.set(name,rows)},
  dispatchEvent(){return true},setTimeout(){return 1},clearTimeout(){},queueMicrotask:fn=>fn(),
  CivweaveGuideChatSurfaceV350:{state:()=>({activeSystem:storage.get('active')||'cerbanimo',open:true}),switchGuide(system,options){storage.set('active',system);switches.push({system,options});return true},open(){return true}},
  CivweaveFamilyNavigationV178:{syncCurrentSelection(system){navSelections.push(system)}},
  CivweaveFamilyAILoaderV105:{openChat(_system,options={}){loaderContext=options.contextSystem;return true}},
  CivweaveFamilyShellV104:{route(){shellRouteCalls++;return false}}
};
sandbox.globalThis=sandbox;
vm.runInNewContext(contextSource,sandbox,{filename:'persistent-system-context-v1.js'});
const api=sandbox.CivweavePersistentSystemContextV1;
assert.ok(api?.owner,'Persistent system context API did not boot.');
assert.equal(api.hostSystem(),'civweave');
assert.equal(api.requestedContext(),'cerbanimo');
assert.equal(storage.get('civweave.pending-system-context.v1'),'cerbanimo','Deep-link context should seed the persistent selection once.');
assert.equal(api.switchContext('fellowfare',{source:'test'}),true);
assert.equal(switches.at(-1).system,'fellowfare');
assert.equal(switches.at(-1).options.open,true,'Switching systems must preserve an already-open chat.');
assert.equal(storage.get('civweave.pending-system-context.v1'),'fellowfare');
assert.equal(navSelections.at(-1),'fellowfare');
assert.equal(documentElement.dataset.civweaveActiveSystemContext,'fellowfare');

sandbox.CivweaveFamilyAILoaderV105.openChat('civweave',{contextSystem:'civweave'});
assert.equal(loaderContext,'fellowfare','Opening chat from the physical shell must preserve the sticky user-selected guide instead of snapping back to Weaveling.');
sandbox.CivweaveFamilyShellV104.route('living-school');
assert.equal(shellRouteCalls,0,'Patched family shell route must not call its old navigation implementation.');
assert.equal(storage.get('civweave.pending-system-context.v1'),'living-school');
assert.equal(switches.at(-1).system,'living-school');

console.log(JSON.stringify({ok:true,revision:'persistent-system-context-v2-single-shell',features:{noReload:true,stickyGuideContext:true,guideSwitcherOwnsContext:true,pageGuideOwnership:false,familyChatPorted:true,familyRouteRedirected:true,workingCampusLockRemoved:true,singleShellDeepLinks:true}},null,2));
