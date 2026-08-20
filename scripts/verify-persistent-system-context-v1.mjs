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

assert.doesNotMatch(contextSource,/function interceptNavClick/,'Persistent guide context must not intercept realm navigation clicks.');
assert.match(contextSource,/realmNavigationReload:true/,'Persistent guide context must explicitly preserve real realm navigation.');
assert.match(contextSource,/stickyUntilExplicitSwitch:true/,'Selected guide context must stay sticky until the user changes it.');
assert.match(contextSource,/data-cw242-window/,'Guide switcher taps must continue to switch guide context in place.');
assert.match(contextSource,/patchFamilyAiLoader/,'Realm-aware chat opening must continue through persistent guide context.');
assert.match(contextSource,/routes\.navigate\(target,\{source:'family-shell-route'\}\)/,'Family-shell realm routes must delegate to the canonical route authority.');

assert.match(routeSource,/singlePersistentShell:false/,'System routes must expose first-class realm pages, not one shared shell.');
assert.match(routeSource,/legacyRealmEntrypoints:true/,'Canonical realm entrypoints must remain active.');
assert.match(routeSource,/navigationReloadOnSystemSwitch:true/,'Cross-realm navigation must perform a document navigation.');
for(const entrypoint of [
  '/app/working-campus-v156.html',
  '/app/cabinets/living-school/index.html',
  '/app/realm-console-v140.html',
  '/app/fellowfare-cabinet-v144.html',
  '/app/anarchadia-console-v139.html'
])assert.ok(routeSource.includes(entrypoint),`System route contract is missing canonical entrypoint ${entrypoint}`);
assert.match(routeSource,/globalThis\.location\?\.assign\?\.\(url\.href\)/,'Canonical route navigation must assign the destination URL.');

assert.match(guideCore,/pageGuideOwnership:false/,'Physical pages must not hard-lock the active chat guide.');
assert.doesNotMatch(guideCore,/api\.switchGuide\?\.\(currentSystem/,'Shared guide repair must not force a page guide back into control.');
assert.match(guideChat,/function switchGuide\(system,options=\{\}\)/,'Canonical chat must retain in-place guide switching.');
assert.match(guideChat,/activeSystem=SYSTEMS\.includes\(value\.activeSystem\)\?value\.activeSystem:pageSystem/,'Canonical chat must restore the saved guide context.');
assert.match(familyLoader,/openCanonical\(target,prefill\)/,'Realm-aware chat behavior must continue through the canonical chat owner.');
assert.match(nav,/data-system=\"\$\{item\.id\}\"/,'Five-system rail must expose stable system ids.');
assert.match(nav,/ROUTES\?\.navigate/,'Five-system rail must delegate realm taps to the canonical route authority.');
assert.match(workingCampus,/installPersistentChatLauncherOwnership/,'Working Campus must delegate launcher ownership to persistent guide context.');
assert.doesNotMatch(workingCampus,/switchGuide\?\.\('civweave'\)/,'Working Campus must not hard-lock the canonical chat to Weaveling.');
assert.doesNotMatch(workingCampus,/chat\.open\(\{guide:'civweave'/,'Working Campus launcher must not reopen Weaveling over the selected guide.');

const storage=new Map();
const listeners=new Map();
const switches=[];
const navSelections=[];
const routeCalls=[];
let loaderContext='';
let legacyShellRouteCalls=0;
const documentElement={dataset:{civweaveSystemRoute:'civweave'},addEventListener(){}};
const document={readyState:'complete',documentElement,body:{dataset:{}},getElementById(){return null},addEventListener(name,fn){listeners.set(name,fn)}};
const routeApi={
  identify:()=> 'civweave',
  navigate(system,options={}){routeCalls.push({system,options});return true}
};
const sandbox={
  console,Date,Math,Object,Array,Map,Set,String,Number,Boolean,JSON,Promise,WeakSet,URL,URLSearchParams,
  localStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
  location:{pathname:'/app/working-campus-v156.html',search:'',href:'https://civweave.invalid/app/working-campus-v156.html',origin:'https://civweave.invalid'},
  document,MutationObserver:undefined,
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  addEventListener(name,fn){const rows=Array.isArray(listeners.get(name))?listeners.get(name):[];rows.push(fn);listeners.set(name,rows)},
  dispatchEvent(){return true},setTimeout(){return 1},clearTimeout(){},queueMicrotask:fn=>fn(),
  CivweaveSystemRoutesV227:routeApi,
  CivweaveGuideChatSurfaceV350:{state:()=>({activeSystem:storage.get('active')||'civweave',open:true}),switchGuide(system,options){storage.set('active',system);switches.push({system,options});return true},open(){return true}},
  CivweaveFamilyNavigationV178:{syncCurrentSelection(system){navSelections.push(system)}},
  CivweaveFamilyAILoaderV105:{openChat(_system,options={}){loaderContext=options.contextSystem;return true}},
  CivweaveFamilyShellV104:{route(){legacyShellRouteCalls++;return false}}
};
sandbox.globalThis=sandbox;
vm.runInNewContext(contextSource,sandbox,{filename:'persistent-system-context-v1.js'});
const api=sandbox.CivweavePersistentSystemContextV1;
assert.ok(api?.owner,'Persistent guide context API did not boot.');
assert.equal(api.hostSystem(),'civweave');
assert.equal(storage.get('civweave.pending-system-context.v1'),'civweave','Direct realm page should seed its own guide context initially.');

assert.equal(api.switchContext('fellowfare',{source:'test'}),true);
assert.equal(switches.at(-1).system,'fellowfare');
assert.equal(switches.at(-1).options.open,true,'Guide switching must preserve an already-open chat.');
assert.equal(storage.get('civweave.pending-system-context.v1'),'fellowfare');
assert.equal(routeCalls.length,0,'Guide switching must not navigate away from the current realm.');
assert.equal(navSelections.at(-1),'civweave','Changing chat guide must not falsely mark another realm as the current page.');
assert.equal(documentElement.dataset.civweaveActiveSystemContext,'civweave');

sandbox.CivweaveFamilyAILoaderV105.openChat('civweave',{contextSystem:'civweave'});
assert.equal(loaderContext,'fellowfare','Opening chat from the physical realm must preserve the sticky user-selected guide.');
sandbox.CivweaveFamilyShellV104.route('living-school');
assert.equal(legacyShellRouteCalls,0,'Patched family shell route must not call its legacy implementation.');
assert.equal(routeCalls.at(-1).system,'living-school','Family shell realm route must invoke canonical navigation.');
assert.equal(routeCalls.at(-1).options.source,'family-shell-route');
assert.equal(switches.at(-1).system,'fellowfare','Realm navigation must not be rewritten into a guide-only switch.');

console.log(JSON.stringify({ok:true,revision:'persistent-system-context-v3-direct-routes',features:{directRealmNavigation:true,stickyGuideContext:true,guideSwitcherInPlace:true,pageGuideOwnership:false,familyChatPorted:true,familyRouteDelegated:true,workingCampusLockRemoved:true}},null,2));