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

assert.equal(familyNav?.owner,'public/app/themed-system-nav-v178.js','The five-guide rail must remain the sole family-navigation owner.');
assert.equal(familyNav?.routeContract,'public/app/system-routes-v227.js','The five-guide rail must keep the canonical route contract.');
assert.equal(familyNav?.loader,'public/app/install-boundary-v146.js','The install boundary must load the five-guide rail.');
assert.equal(familyNav?.retiredOwner,'public/app/family-shell-v104.js','The previous family-shell navigation owner must remain retired.');
assert.equal(chatOwner,'public/app/guide-chat-surface-v350.js','Guide shortcuts must target the canonical V350 chat owner.');

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

const [routesSource,boundarySource,navSource,familyShell,workerWrapper,workerNavigation,...pages]=await Promise.all([
  read('public/app/system-routes-v227.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/family-shell-v104.js'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-canonical-navigation-v227.js'),
  ...Object.values(paths).map(path=>read(`public${path}`))
]);

for(const source of [routesSource,boundarySource,navSource,familyShell,workerNavigation])new Function(source);

// Ownership and presentation: five guides, one global navigation rail.
assert.match(navSource,/CivweaveFamilyNavigationV178/,'The navigation owner must publish its ownership contract.');
assert.match(navSource,/cw-themed-system-avatar/,'The rail must render guide avatars.');
assert.match(navSource,/cw-themed-system-copy/,'The rail must render guide names/system labels rather than monogram-only navigation.');
for(const guide of ['Weaveling','Moss','Kamiya','Rook','Merlin'])assert.match(navSource,new RegExp(`character:'${guide}'`),`The rail is missing ${guide}.`);
assert.match(navSource,/grid-template-columns:repeat\(5/,'The rail must remain a five-guide control.');
assert.match(navSource,/nav\.bottom[\s\S]*?\.rc-bottom[\s\S]*?\.ls-tray[\s\S]*?\.bottom-nav\{display:none!important\}/,'Competing persistent bottom navigation must be suppressed while the guide rail owns navigation.');
assert.match(navSource,/main\.app>\.campus/,'Working Campus realm cards must not remain a second global system navigator.');
assert.doesNotMatch(navSource,/cwf104-tray/,'The current navigation owner must not depend on the retired family tray.');
assert.match(familyShell,/familyNavigationOwner:'themed-system-nav-v178'/,'Family shell must delegate navigation ownership.');
assert.match(familyShell,/familyNavigationOwnership:false/,'Family shell must explicitly disclaim navigation ownership.');
assert.doesNotMatch(familyShell,/cwf104-tray|data-cwf-system|cwf104-system/,'Family shell regained retired five-system navigation DOM.');

// Hold/right-click/keyboard quick-launch contract.
assert.match(navSource,/const MENU_ID='cw-themed-system-nav-menu'/,'The rail must own one quick-launch menu.');
assert.match(navSource,/const HOLD_MS=460/,'The hold gesture must remain intentional rather than hair-trigger.');
assert.match(navSource,/function startHold\(/,'The rail must implement pointer hold detection.');
assert.match(navSource,/function openQuickMenu\(/,'The rail must expose the guide shortcut menu.');
assert.match(navSource,/contextmenu/,'Desktop right-click must open the same guide shortcut menu.');
assert.match(navSource,/ContextMenu.*ArrowUp.*shiftKey/s,'Keyboard users must have a shortcut-menu equivalent.');
assert.match(navSource,/aria-haspopup=\\"menu\\"/,'Guide controls must advertise their menu relationship.');
assert.match(navSource,/role=\\"menuitem\\"/,'Quick-launch actions must expose menuitem semantics.');
assert.match(navSource,/event\.key==='Escape'/,'The quick menu must support Escape.');
assert.match(navSource,/event\.key==='ArrowDown'/,'The quick menu must support arrow-key traversal.');
assert.match(navSource,/navigator\.vibrate/,'A successful mobile hold may provide bounded tactile confirmation.');

// Each guide gets useful first-order shortcuts and the canonical guide thread.
const requiredQuickActions={
  civweave:['weave','progress','library','chat','settings'],
  'living-school':['continue','path','modules','practicum','chat'],
  cerbanimo:['quest','mission-room','project-workbench','observatory','chat'],
  fellowfare:['market','loom','assemblies','inbox','profile','chat'],
  anarchadia:['passport','proposals','ledger','observatory','governance','chat']
};
for(const [system,actions] of Object.entries(requiredQuickActions)){
  assert.match(navSource,new RegExp(`(?:'${system}'|${system.replaceAll('-','\\-')}):Object\\.freeze\\(\\[`),`${system} is missing its quick-launch set.`);
  for(const action of actions)assert.match(navSource,new RegExp(`id:'${action.replaceAll('-','\\-')}'`),`${system} is missing quick action ${action}.`);
}
assert.match(navSource,/CivweaveGuideChatSurfaceV350/,'Guide chat shortcuts must target the canonical chat surface.');
assert.match(navSource,/url\.searchParams\.set\('feature',feature\)/,'Cross-system quick launches must preserve the requested feature through canonical routing.');
assert.match(navSource,/applyRequestedFeature/,'A destination system must consume its requested quick-launch feature.');
assert.match(navSource,/civweave:guide-chat-state/,'Guide unread state must feed the rail.');
assert.match(navSource,/civweave:onboarding-step/,'Onboarding must highlight the canonical guide rail instead of a retired system switcher.');

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

// Every canonical route must receive the same owner through the install boundary.
assert.match(boundarySource,/const THEMED_SYSTEM_NAV='\/app\/themed-system-nav-v178\.js'/);
assert.match(boundarySource,/canonicalSystemCount:5/);
assert.match(boundarySource,/canonicalPolicy:'five-system-first-class-routes-v350-canonical-chat-owner'/);
assert.match(boundarySource,/guideWorkspaceRevision:'v350-single-current-chat-surface'/);
for(const [system,pathname] of Object.entries(paths)){
  assert.ok(boundarySource.includes(`['${pathname}','${system}']`),`Install boundary is missing ${system}.`);
}
for(const page of pages)assert.match(page,/\/app\/install-boundary-v146\.js/,'A canonical system surface lost the install boundary.');

// Worker navigation must preserve the canonical route graph instead of substituting the launcher.
const routeImport=workerWrapper.indexOf("importScripts('/app/system-routes-v227.js");
const coreImport=workerWrapper.indexOf("importScripts('/service-worker-core-v208.js");
assert.ok(routeImport>=0&&routeImport<coreImport,'The route contract must load before the worker core.');
assert.ok(workerWrapper.includes('family-nav-single-owner-r1'),'The worker cache must rotate for the single navigation owner.');
assert.match(workerNavigation,/exact-route-network-first-exact-route-cache-never-launcher-fallback/);
assert.match(workerNavigation,/precacheCanonicalRoutes/);

console.log(JSON.stringify({
  ok:true,
  version,
  revision:'five-guide-rail-hold-menu-v228',
  systems:Object.keys(paths),
  guides:['Weaveling','Moss','Kamiya','Rook','Merlin'],
  routeMatrix:25,
  interaction:'tap-system-hold-shortcuts',
  holdMilliseconds:460,
  quickLaunch:true,
  canonicalChatOwner:chatOwner,
  familyNavigationOwner:familyNav.owner,
  competingPersistentNavigationSuppressed:true,
  workingCampusRealmSwitcherSuppressed:true,
  retiredFamilyNavAssetsPurged:true,
  launcherSubstitution:false,
  installerSubstitution:false
},null,2));
