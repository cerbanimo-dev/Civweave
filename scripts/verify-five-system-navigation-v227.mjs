import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import vm from 'node:vm';

await import('./sync-release-version-assets.mjs');

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const exists=path=>access(new URL(path,root)).then(()=>true,()=>false);
const version=(await read('VERSION')).trim();
const ownership=JSON.parse(await read('config/system-ownership.json'));
const familyNav=ownership?.systems?.['family-navigation'];
const chatOwner=ownership?.systems?.['guide-chat']?.owner;

assert.equal(familyNav?.owner,'public/app/themed-system-nav-v178.js','The themed five-system navigation must remain the sole family-navigation owner.');
assert.equal(familyNav?.routeContract,'public/app/system-routes-v227.js','Navigation must keep the canonical route contract.');
assert.equal(familyNav?.loader,'public/app/install-boundary-v146.js','The install boundary must load the canonical navigation owner.');
assert.equal(familyNav?.retiredOwner,'public/app/family-shell-v104.js','The previous family-shell navigation owner must remain retired.');
assert.equal(chatOwner,'public/app/guide-chat-surface-v350.js','Guide chat must keep the canonical V350 owner.');

const paths={
  civweave:'/app/working-campus-v156.html',
  'living-school':'/app/cabinets/living-school/index.html',
  cerbanimo:'/app/realm-console-v140.html',
  fellowfare:'/app/fellowfare-cabinet-v144.html',
  anarchadia:'/app/anarchadia-console-v139.html'
};
const retiredFamilyNavAssets=[
  'public/app/assets/navigation/200-civweave-nav.webp',
  'public/app/assets/navigation/200-living-school-nav.webp',
  'public/app/assets/navigation/200-cerbanimo-nav.webp',
  'public/app/assets/navigation/200-fellowfare-nav.webp',
  'public/app/assets/navigation/200-anarchadia-nav.webp'
];
const campusPartPaths=[1,2,3,4,5].map(number=>`public/app/working-campus-v156.part${number}.txt`);

const [routesSource,boundarySource,navSource,familyShell,workerWrapper,workerNavigation,...pages]=await Promise.all([
  read('public/app/system-routes-v227.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/family-shell-v104.js'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-canonical-navigation-v227.js'),
  ...Object.values(paths).map(path=>read(`public${path}`))
]);
const campusParts=(await Promise.all(campusPartPaths.map(read))).join('');
const campusRuntime=await read('public/app/working-campus-v156.js');
const campusPage=pages[0];

for(const source of [routesSource,boundarySource,navSource,familyShell,workerNavigation,campusRuntime,campusParts])new Function(source);

// Presentation regression: preserve the established compact avatar + monogram
// navigation. The later text-heavy five-guide rail is intentionally not the UI.
assert.match(navSource,/CivweaveFamilyNavigationV178/,'Navigation must publish its ownership contract.');
assert.match(navSource,/cw-themed-system-avatar/,'Navigation must render guide imagery.');
assert.match(navSource,/cw-themed-system-monogram/,'Navigation must keep the compact monogram treatment.');
assert.doesNotMatch(navSource,/cw-themed-system-copy/,'The replacement character-name/system-label rail must not return.');
assert.doesNotMatch(navSource,/const MENU_ID='cw-themed-system-nav-menu'/,'The replacement hold-menu rail must not become the navigation presentation again.');
assert.doesNotMatch(navSource,/function openQuickMenu\(/,'Navigation must not depend on the replacement quick-menu implementation.');
assert.match(navSource,/--cw-themed-nav-button-width:156px/,'Desktop navigation must keep its compact established geometry.');
assert.match(navSource,/grid-template-columns:repeat\(5,minmax\(0,var\(--cw-themed-nav-button-width\)\)\)/,'Navigation must retain five compact system controls.');
for(const [guide,monogram] of Object.entries({Weaveling:'Cw',Moss:'LS',Kamiya:'Co',Rook:'FF',Merlin:'Ai'})){
  assert.match(navSource,new RegExp(`character:'${guide}'`),`Navigation is missing ${guide}.`);
  assert.match(navSource,new RegExp(`monogram:'${monogram}'`),`Navigation is missing ${guide}'s established monogram.`);
}
assert.match(navSource,/aria-label','Travel between Civweave systems'|aria-label","Travel between Civweave systems"/,'Navigation must remain a direct system switcher.');
assert.match(navSource,/data\.civweaveSystemRoute/,'Navigation must honor the install-boundary route declaration.');
assert.match(navSource,/fullscreen-family-v104\.html/,'Navigation must retain fullscreen-family route recovery.');
assert.match(navSource,/addEventListener\('pageshow',ensureMounted\)/,'Navigation must recover after bfcache/page restoration.');
assert.match(navSource,/addEventListener\('focus',ensureMounted\)/,'Navigation must recover after app focus.');
assert.match(navSource,/nav\.bottom[\s\S]*?\.rc-bottom[\s\S]*?\.ls-tray[\s\S]*?\.bottom-nav\{display:none!important\}/,'Competing persistent bottom navigation must remain suppressed.');
assert.match(familyShell,/familyNavigationOwner:'themed-system-nav-v178'/,'Family shell must delegate navigation ownership.');
assert.match(familyShell,/familyNavigationOwnership:false/,'Family shell must explicitly disclaim navigation ownership.');
assert.doesNotMatch(familyShell,/cwf104-tray|data-cwf-system|cwf104-system/,'Family shell regained retired five-system navigation DOM.');

// Character media must remain present in the package source even though the shell
// is allowed to fetch the heavier sprite atlases on demand.
for(const asset of [
  'public/Civweave-weaveling-sprites.png',
  'public/Living-School-moss-sprites.png',
  'public/Cerbanimo-kamiya-sprites.png',
  'public/FellowFare-rook-sprites.png',
  'public/Anarchadia-merlin-sprites.png',
  'public/app/assets/ai/chat/weaveling-face-v255.webp',
  'public/app/assets/ai/chat/moss-face-v255.webp',
  'public/app/assets/ai/chat/kamiya-face-v255.webp',
  'public/app/assets/ai/chat/rook-face-v255.webp',
  'public/app/assets/ai/chat/merlin-face-v255.webp'
])assert.equal(await exists(asset),true,`Navigation image source is missing: ${asset}`);

// Working Campus keeps the current Quest model independently of the navigation presentation.
assert.doesNotMatch(campusPage,/id="guided-mode"|id="roam-mode"|class="bottom"/,'Working Campus must not retain permanent mode controls or its retired local bottom navigation.');
assert.match(campusPage,/id="view-title">Current Quest</,'Working Campus must name the canonical current-state surface Current Quest.');
assert.match(campusParts,/function questModeControls\(/,'Guided Rails / Free Roam must remain contextual to the active Quest.');
assert.match(campusParts,/data-quest-mode="guided"/,'The active Quest must expose Guided Rails contextually.');
assert.match(campusParts,/data-quest-mode="roam"/,'The active Quest must expose Free Roam contextually.');
assert.doesNotMatch(campusParts,/function progressView\(/,'Progress must not return as a separate Working Campus view.');
assert.match(campusParts,/CivweaveWorkingCampusV156/,'Working Campus must publish its canonical view API.');
assert.match(campusRuntime,/state\.view==='weave'\|\|state\.view==='progress'\?'quest'/,'Persisted legacy Weave/Progress views must migrate to Current Quest.');
assert.match(campusRuntime,/\['quest','library','campus'\]/,'State repair must accept only the canonical Quest/library/campus view set.');

for(const asset of retiredFamilyNavAssets)assert.equal(await exists(asset),false,`Retired navigation asset still exists: ${asset}`);

function routeRuntime(pathname=paths.civweave){
  const session=new Map();
  const context={
    URL,URLSearchParams,Map,Object,String,Boolean,
    location:{origin:'https://civweave.test',pathname,href:`https://civweave.test${pathname}`,assign(){},replace(){}},
    sessionStorage:{setItem:(key,value)=>session.set(key,String(value)),getItem:key=>session.get(key)||null},
    document:undefined
  };
  context.globalThis=context;
  vm.runInNewContext(routesSource,context);
  return context.CivweaveSystemRoutesV227;
}
const routeApi=routeRuntime();
assert.equal(routeApi.version,version);
assert.equal(routeApi.routes().length,5);
assert.deepEqual(Object.fromEntries(routeApi.routes().map(route=>[route.id,route.pathname])),paths);
for(const sourceId of Object.keys(paths)){
  for(const [targetId,targetPath] of Object.entries(paths)){
    const url=routeApi.urlFor(targetId,{origin:'https://civweave.test',source:sourceId,version});
    assert.equal(url.pathname,targetPath);
    assert.equal(url.searchParams.get('installed'),'1');
    assert.equal(url.searchParams.get('navigation'),'five-system-route-contract-v227');
    assert.notEqual(url.pathname,'/app/index.html');
  }
}

// Every canonical route must still receive the same navigation owner through the install boundary.
assert.match(boundarySource,/const THEMED_SYSTEM_NAV='\/app\/themed-system-nav-v178\.js'/);
assert.match(boundarySource,/canonicalSystemCount:5/);
assert.match(boundarySource,/canonicalPolicy:'five-system-first-class-routes-v350-canonical-chat-owner'/);
assert.match(boundarySource,/guideWorkspaceRevision:'v350-single-current-chat-surface'/);
for(const [system,pathname] of Object.entries(paths)){
  assert.ok(boundarySource.includes(`['${pathname}','${system}']`),`Install boundary is missing ${system}.`);
}
for(const page of pages)assert.match(page,/\/app\/install-boundary-v146\.js/,'A canonical system surface lost the install boundary.');

// Worker routing and staged cache rotation retain post-UI-rewrite reliability fixes.
const routeImport=workerWrapper.indexOf("importScripts('/app/system-routes-v227.js");
const coreImport=workerWrapper.indexOf("importScripts('/service-worker-core-v208.js");
assert.ok(routeImport>=0&&routeImport<coreImport,'The route contract must load before the worker core.');
assert.ok(workerWrapper.includes('family-nav-single-owner-r1'),'The worker must retain the single navigation owner cache contract.');
assert.ok(workerWrapper.includes('staging-installed-entry-takeover-v3-nav-restore'),'Staging must rotate installed devices onto the restored navigation build.');
assert.match(workerNavigation,/exact-route-network-first-exact-route-cache-never-launcher-fallback/);
assert.match(workerNavigation,/precacheCanonicalRoutes/);

console.log(JSON.stringify({
  ok:true,
  version,
  revision:'five-system-nav-restored-v230',
  systems:Object.keys(paths),
  guides:['Weaveling','Moss','Kamiya','Rook','Merlin'],
  routeMatrix:25,
  presentation:'compact-avatar-monogram',
  interaction:'tap-system',
  currentQuest:true,
  separateProgressView:false,
  contextualQuestMode:true,
  canonicalChatOwner:chatOwner,
  familyNavigationOwner:familyNav.owner,
  competingPersistentNavigationSuppressed:true,
  replacementGuideRailSuppressed:true,
  characterMediaPresent:true,
  launcherSubstitution:false,
  installerSubstitution:false
},null,2));