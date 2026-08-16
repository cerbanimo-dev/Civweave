import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import vm from 'node:vm';

await import('./sync-release-version-assets.mjs');

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const exists=path=>access(new URL(path,root)).then(()=>true,()=>false);

const version=(await read('VERSION')).trim();
const ownership=JSON.parse(await read('config/system-ownership.json'));
const chatOwner=ownership?.systems?.['guide-chat']?.owner;
const familyNav=ownership?.systems?.['family-navigation'];

assert.equal(chatOwner,'public/app/guide-chat-surface-v350.js','Five-system navigation must use the canonical V350 guide-chat owner.');
assert.equal(familyNav?.owner,'public/app/themed-system-nav-v178.js','The expressive themed navigation must be the sole five-system navigation owner.');
assert.equal(familyNav?.routeContract,'public/app/system-routes-v227.js','Family navigation must keep the v227 route contract.');
assert.equal(familyNav?.loader,'public/app/install-boundary-v146.js','First-class routes must receive the navigation owner through the install boundary.');
assert.equal(familyNav?.retiredOwner,'public/app/family-shell-v104.js','The previous family-shell navigation owner must remain explicitly retired.');

const chatOwnerPath=`/${chatOwner.replace(/^public\//,'')}`;
const chatRevision=chatOwner.match(/-(v\d+)\.js$/i)?.[1];
assert.ok(chatRevision);

const paths={
  civweave:'/app/working-campus-v156.html',
  'living-school':'/app/cabinets/living-school/index.html',
  cerbanimo:'/app/realm-console-v140.html',
  fellowfare:'/app/fellowfare-cabinet-v144.html',
  anarchadia:'/app/anarchadia-console-v139.html'
};
const experienceScripts=[
  '/app/settings-gateway-v317.js',
  '/app/mobile-ai-hardening-v302.js',
  '/app/experience-orchestrator-v232.js',
  '/app/system-radio-agent-v233.js',
  '/app/radio-safe-stations-v1.js',
  '/app/radio-track-suggestions-v240.js',
  '/app/canonical-playlists-v1.js',
  '/app/radio-playlist-governance-v1.js',
  '/app/civweave-systems-mesh-v251.js',
  '/app/host-node-session-v1.js',
  '/app/node-ai-mesh-v1.js',
  '/app/quest-veil-mesh-v1.js',
  '/app/quest-veil-ledger-gate-v1.js',
  '/app/quest-veil-v1.js',
  '/app/guide-identity-integrity-v216.js',
  '/app/realm-session-integrity-v237.js',
  chatOwnerPath,
  '/app/working-campus-topbar-v243.js',
  '/app/themed-system-nav-v178.js',
  '/app/campus-background-download-v241.js',
  '/app/shared-review-surface-v234.js',
  '/app/shared-guide-surface-v236.js'
];
const retiredCanonicalChatScripts=[
  '/app/persistent-guide-chat-v215.js',
  '/app/persistent-guide-viewport-v216.js',
  '/app/chat-single-owner-v245.js'
];
const retiredFamilyNavAssets=[
  'public/app/assets/navigation/200-civweave-nav.webp',
  'public/app/assets/navigation/200-living-school-nav.webp',
  'public/app/assets/navigation/200-cerbanimo-nav.webp',
  'public/app/assets/navigation/200-fellowfare-nav.webp',
  'public/app/assets/navigation/200-anarchadia-nav.webp'
];

const [
  routesSource,
  boundarySource,
  navSource,
  familyShell,
  campusSource,
  campusPart4,
  workerWrapper,
  workerNavigation,
  criticalCompat,
  sharedImagesCompat,
  livingSchool,
  gatewayBase,
  gatewayWrapper,
  ...pages
]=await Promise.all([
  read('public/app/system-routes-v227.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/family-shell-v104.js'),
  read('public/app/working-campus-v156.js'),
  read('public/app/working-campus-v156.part4.txt'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-canonical-navigation-v227.js'),
  read('public/service-worker-critical-v199.js'),
  read('public/service-worker-shared-images-v203.js'),
  read('public/app/cabinets/living-school/index.html'),
  read('releases/1.0.81/server/server-gateway-v131-base.mjs'),
  read('releases/1.0.81/server/server-gateway-v131.mjs'),
  ...Object.values(paths).map(path=>read(`public${path}`))
]);

for(const source of [routesSource,boundarySource,navSource,familyShell,campusSource,workerNavigation,criticalCompat,sharedImagesCompat])new Function(source);

assert.match(navSource,/CivweaveFamilyNavigationV178/,'The current navigation owner must publish its ownership contract.');
assert.match(navSource,/cw-themed-system-avatar/,'The current navigation owner must render expressive avatars.');
assert.match(navSource,/cw-themed-system-monogram/,'The current navigation owner must render compact realm monograms.');
assert.doesNotMatch(navSource,/cwf104-tray/,'The current navigation owner must not hide or depend on the retired family tray.');
assert.match(familyShell,/familyNavigationOwner:'themed-system-nav-v178'/,'Family shell must delegate navigation ownership.');
assert.match(familyShell,/familyNavigationOwnership:false/,'Family shell must explicitly disclaim navigation ownership.');
assert.doesNotMatch(familyShell,/cwf104-tray|data-cwf-system|cwf104-system/,'Family shell regained retired five-system navigation DOM.');
assert.ok(experienceScripts.includes(`/${familyNav.owner.replace(/^public\//,'')}`),'Install boundary experience bundle lost the canonical navigation owner.');

for(const asset of retiredFamilyNavAssets){
  assert.equal(await exists(asset),false,`Retired navigation asset still exists: ${asset}`);
}
for(const [name,source] of [
  ['Living School',livingSchool],
  ['critical compatibility worker',criticalCompat],
  ['shared-image compatibility worker',sharedImagesCompat]
]){
  assert.doesNotMatch(source,/\/app\/assets\/navigation\/200-(?:civweave|living-school|cerbanimo|fellowfare|anarchadia)-nav\.webp/,`${name} still references retired 200px navigation art.`);
}

function routeRuntime(pathname=paths.civweave){
  const session=new Map();
  const context={
    URL,URLSearchParams,Map,Object,String,Boolean,
    location:{origin:'https://civweave.test',pathname,href:`https://civweave.test${pathname}`,assign(){},replace(){}},
    sessionStorage:{setItem:(k,v)=>session.set(k,String(v)),getItem:k=>session.get(k)||null},
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
    assert.notEqual(url.pathname,'/');
  }
}

function boundaryRuntime(pathname,{installed=false,launchSession=false}={}){
  const session=new Map(launchSession?[['civweave.pwa.launch-session.v1','1']]:[]);
  const appended=[];
  const replaced=[];
  const rootEl={dataset:{},isConnected:true};
  const head={isConnected:true,append:node=>appended.push(node)};
  const body={isConnected:true};
  const viewport={content:'width=device-width',getAttribute(){return this.content},setAttribute(_n,v){this.content=v}};
  const document={
    documentElement:rootEl,
    head,
    body,
    querySelector:selector=>selector==='meta[name="viewport"]'?viewport:null,
    createElement:tag=>({tagName:tag.toUpperCase(),style:{}})
  };
  const location={
    origin:'https://civweave.test',
    hostname:'civweave.test',
    pathname,
    search:'',
    hash:'',
    href:`https://civweave.test${pathname}`,
    replace:value=>replaced.push(String(value))
  };
  const context={
    URL,URLSearchParams,Map,Object,String,Boolean,document,location,
    navigator:{standalone:installed},
    matchMedia:q=>({matches:installed&&String(q).includes('display-mode')}),
    sessionStorage:{setItem:(k,v)=>session.set(k,String(v)),getItem:k=>session.get(k)||null,removeItem:k=>session.delete(k)},
    addEventListener:()=>{},
    dispatchEvent:()=>true,
    CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
    queueMicrotask:fn=>fn()
  };
  context.window=context;
  context.top=context;
  context.self=context;
  context.globalThis=context;
  vm.runInNewContext(routesSource,context);
  vm.runInNewContext(boundarySource,context);
  return{context,appended,replaced,root:rootEl};
}

for(const [system,pathname] of Object.entries(paths)){
  const browser=boundaryRuntime(pathname);
  assert.equal(browser.replaced.length,1,`${system} must reject ordinary browser access`);
  const installed=boundaryRuntime(pathname,{installed:true});
  assert.equal(installed.replaced.length,0);
  assert.equal(installed.context.CivweaveInstallBoundaryV146.systemSurface(),system);
  assert.equal(installed.context.CivweaveInstallBoundaryV146.allowed(),true);
  assert.equal(installed.root.dataset.civweaveSystemRoute,system);
  for(const script of experienceScripts){
    assert.ok(installed.appended.some(node=>String(node.src||'').includes(script)),`${system} missing ${script}`);
  }
  assert.equal(installed.appended.filter(node=>String(node.src||'').includes('/app/themed-system-nav-v178.js')).length,1,`${system} must receive exactly one navigation owner from the install boundary.`);
  for(const retired of retiredCanonicalChatScripts){
    assert.ok(!installed.appended.some(node=>String(node.src||'').includes(retired)));
  }
  if(system==='civweave')assert.equal(installed.appended.length,experienceScripts.length);
  const launched=boundaryRuntime(pathname,{launchSession:true});
  assert.equal(launched.replaced.length,0,`${system} must accept a PWA launch session`);
}

for(const [system,pathname] of Object.entries(paths))assert.ok(boundarySource.includes(`['${pathname}','${system}']`));
for(const token of [
  'canonicalSystemCount:5',
  'settingsGatewayRevision:',
  "systemsMeshRevision:'v251-five-system-non-privileged-event-contract'",
  "radioSafeStationRevision:'v1-general-audience-independent-queue'",
  `canonicalPolicy:'five-system-first-class-routes-${chatRevision}-canonical-chat-owner'`,
  `guideWorkspaceRevision:'${chatRevision}-single-current-chat-surface'`,
  `guideSurfaceOwnershipPolicy:'${chatRevision}-single-current-surface-five-private-ledgers-handover-only-cross-realm'`,
  "browserRuntimePolicy:'installed-display-or-pwa-launch-session'",
  'installedQueryIsAuthorization:false'
])assert.ok(boundarySource.includes(token),`Boundary missing ${token}`);

assert.equal(experienceScripts.indexOf('/app/radio-safe-stations-v1.js'),experienceScripts.indexOf('/app/system-radio-agent-v233.js')+1);
assert.equal(experienceScripts.indexOf(chatOwnerPath),experienceScripts.indexOf('/app/realm-session-integrity-v237.js')+1);
assert.equal(experienceScripts.indexOf('/app/working-campus-topbar-v243.js'),experienceScripts.indexOf(chatOwnerPath)+1);
assert.match(navSource,/CivweaveSystemRoutesV227/);
assert.match(navSource,/ROUTES\?\.navigate|ROUTES\.navigate/);
assert.match(campusSource,/ensureRouteContract/);
assert.match(campusPart4,/CivweaveSystemRoutesV227/);

const routeImport=workerWrapper.indexOf("importScripts('/app/system-routes-v227.js");
const coreImport=workerWrapper.indexOf("importScripts('/service-worker-core-v208.js");
const repairImport=workerWrapper.indexOf("importScripts('/service-worker-shell-repair-v293.js");
const canonicalImport=workerWrapper.indexOf("importScripts('/service-worker-canonical-navigation-v227.js");
assert.ok(routeImport>=0&&routeImport<coreImport);
assert.ok(repairImport>=0&&canonicalImport>repairImport);
assert.ok(!workerWrapper.includes('/service-worker-shell-repair-v225.js'));
assert.ok(workerWrapper.includes('/service-worker-shell-assets-v1.js?v=shell-assets-v1-repair-v2'));
assert.ok(workerWrapper.includes('family-nav-single-owner-r1'),'Active worker wrapper must rotate for the single navigation owner purge.');
assert.match(workerNavigation,/exact-route-network-first-exact-route-cache-never-launcher-fallback/);
assert.match(workerNavigation,/precacheCanonicalRoutes/);

assert.match(gatewayBase,/x-civweave-package/);
assert.match(gatewayWrapper,/pathname !== '\/app'/);
for(const page of pages)assert.match(page,/\/app\/install-boundary-v146\.js/);

console.log(JSON.stringify({
  ok:true,
  version,
  revision:'five-system-navigation-v227-single-owner-r1',
  systems:Object.keys(paths),
  routeMatrix:25,
  browserRequiresInstalledProof:true,
  pwaLaunchSession:true,
  experienceScripts:experienceScripts.length,
  settingsOwner:'settings-gateway-v317',
  canonicalChatOwner:chatOwner,
  familyNavigationOwner:familyNav.owner,
  retiredFamilyNavAssetsPurged:true,
  radioSafeStation:true,
  shellRepairOwner:'v293',
  retiredV225:false,
  launcherSubstitution:false,
  installerSubstitution:false
},null,2));
