import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

await import('./sync-release-version-assets.mjs');
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const version=(await read('VERSION')).trim();
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
  '/app/guide-workspace-v242.js',
  '/app/working-campus-topbar-v243.js',
  '/app/themed-system-nav-v178.js',
  '/app/campus-background-download-v241.js',
  '/app/shared-review-surface-v234.js',
  '/app/shared-guide-surface-v236.js'
];
const retiredCanonicalChatScripts=['/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js','/app/chat-single-owner-v245.js'];
const [routesSource,boundarySource,coreRuntimeSource,navSource,campusSource,campusPart4,workerWrapper,workerNavigation,gatewayBase,gatewayWrapper,...pages]=await Promise.all([
  read('public/app/system-routes-v227.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/core-interface-runtime-v1.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/working-campus-v156.js'),
  read('public/app/working-campus-v156.part4.txt'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-canonical-navigation-v227.js'),
  read('releases/1.0.81/server/server-gateway-v131-base.mjs'),
  read('releases/1.0.81/server/server-gateway-v131.mjs'),
  ...Object.values(paths).map(path=>read(`public${path}`))
]);
for(const [label,source] of Object.entries({routesSource,boundarySource,coreRuntimeSource,navSource,campusSource,workerNavigation}))new Function(source);

function routeRuntime(pathname=paths.civweave){
  const session=new Map();
  const context={URL,URLSearchParams,Map,Object,String,Boolean,location:{origin:'https://civweave.test',pathname,href:`https://civweave.test${pathname}`,assign(){},replace(){}},sessionStorage:{setItem:(key,value)=>session.set(key,String(value)),getItem:key=>session.get(key)||null},document:undefined};
  context.globalThis=context;vm.runInNewContext(routesSource,context,{filename:'system-routes-v227.js'});return{api:context.CivweaveSystemRoutesV227,session};
}
const routeApi=routeRuntime().api;
assert.equal(routeApi.version,version,'Route contract version does not match VERSION.');
assert.equal(routeApi.routes().length,5,'Route contract must expose exactly five canonical systems.');
assert.deepEqual(Object.fromEntries(routeApi.routes().map(route=>[route.id,route.pathname])),paths,'Canonical system route map drifted.');
for(const [sourceId] of Object.entries(paths))for(const [targetId,targetPath] of Object.entries(paths)){const url=routeApi.urlFor(targetId,{origin:'https://civweave.test',source:sourceId,version});assert.equal(url.pathname,targetPath,`${sourceId} → ${targetId} changed destination.`);assert.equal(url.searchParams.get('installed'),'1',`${sourceId} → ${targetId} lost installed authorization.`);assert.equal(url.searchParams.get('navigation'),'five-system-route-contract-v227',`${sourceId} → ${targetId} lost route revision.`);assert.notEqual(url.pathname,'/app/index.html',`${sourceId} → ${targetId} routes through the blank launcher.`);assert.notEqual(url.pathname,'/',`${sourceId} → ${targetId} routes through the installer.`)}

function boundaryRuntime(pathname,{installed=false}={}){
  const session=new Map(),appended=[],replaced=[];const root={dataset:{},isConnected:true};const head={isConnected:true,append:node=>appended.push(node),appendChild:node=>appended.push(node)};const body={isConnected:true};const document={documentElement:root,head,body,querySelector:()=>null,createElement:tag=>({tagName:tag.toUpperCase(),style:{}})};const location={origin:'https://civweave.test',hostname:'civweave.test',pathname,search:'',hash:'',href:`https://civweave.test${pathname}`,replace:value=>replaced.push(String(value))};const context={URL,URLSearchParams,Map,Object,String,Boolean,document,location,navigator:{standalone:installed},matchMedia:query=>({matches:installed&&String(query).includes('display-mode')}),sessionStorage:{setItem:(key,value)=>session.set(key,String(value)),getItem:key=>session.get(key)||null},addEventListener:()=>{},dispatchEvent:()=>true,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},queueMicrotask:fn=>fn()};context.window=context;context.top=context;context.self=context;context.globalThis=context;vm.runInNewContext(routesSource,context,{filename:'system-routes-v227.js'});vm.runInNewContext(boundarySource,context,{filename:'install-boundary-v146.js'});return{context,session,appended,replaced,root};
}
for(const [system,pathname] of Object.entries(paths)){
  const browser=boundaryRuntime(pathname);assert.equal(browser.replaced.length,1,`${system} must redirect ordinary browser access to the installer.`);assert.equal(browser.context.CivweaveInstallBoundaryV146.allowed(),false,`${system} is incorrectly authorized in an ordinary browser.`);
  const result=boundaryRuntime(pathname,{installed:true});assert.equal(result.replaced.length,0,`${system} redirects an installed display to the installer.`);assert.equal(result.context.CivweaveInstallBoundaryV146.systemSurface(),system,`${system} is not a first-class boundary surface.`);assert.equal(result.context.CivweaveInstallBoundaryV146.allowed(),true,`${system} is not authorized in installed display mode.`);assert.equal(result.root.dataset.civweaveSystemRoute,system,`${system} route identity is not stamped.`);
  assert.equal(result.appended.length,1,`${system} boundary must inject exactly one core interface runtime.`);
  assert.ok(result.appended.some(node=>String(node.src||'').includes('/app/core-interface-runtime-v1.js')),`${system} boundary did not bootstrap the core interface runtime.`);
  for(const script of experienceScripts)assert.ok(!result.appended.some(node=>String(node.src||'').includes(script)),`${system} boundary directly loaded shared owner ${script}.`);
  for(const retired of retiredCanonicalChatScripts)assert.ok(!result.appended.some(node=>String(node.src||'').includes(retired)),`${system} resurrected retired canonical chat runtime ${retired}.`);
}
for(const script of ['/app/system-routes-v227.js','/app/release-version-v1.js',...experienceScripts])assert.ok(coreRuntimeSource.includes(`'${script}'`)||coreRuntimeSource.includes(`"${script}"`),`Core interface runtime does not assemble ${script}.`);
for(const retired of retiredCanonicalChatScripts)assert.ok(!coreRuntimeSource.includes(retired),`Core interface runtime resurrected retired canonical chat runtime ${retired}.`);
for(const [system,pathname] of Object.entries(paths))assert.ok(boundarySource.includes(`['${pathname}','${system}']`),`Boundary fallback map is missing ${system}.`);
assert.match(boundarySource,/canonicalSystemCount:5/);assert.match(boundarySource,/canonicalRuntimeScripts:1/);assert.match(boundarySource,/sharedLoadingOwner:'core-interface-runtime-v1'/);assert.match(boundarySource,/settingsGatewayRevision:'v317-single-owner-first-click-only'/);assert.match(boundarySource,/systemsMeshRevision:'v251-five-system-non-privileged-event-contract'/);assert.match(boundarySource,/nodeAiMeshRevision:'v1-node-owned-service-discovery-routing'/);assert.match(boundarySource,/questVeilRevision:'v1-mandatory-human-ledger-gate-plus-mesh-batches'/);assert.match(boundarySource,/questVeilHumanLedgerPolicy:'raw-task-chronicle-never-human-visible'/);assert.match(boundarySource,/questVeilMeshBountyPolicy:'per-item:learning=1-acorn;labor-material-exchange=1-button'/);assert.match(boundarySource,/five-system-first-class-routes-v242-canonical-chat-owner/);assert.match(boundarySource,/radioTrackSuggestionRevision:'v241-playlist-context-track-links'/);assert.match(boundarySource,/campusBackgroundDownloadRevision:'v241-worker-owned-download-bottom-progress-rail'/);assert.match(boundarySource,/guideWorkspaceRevision:'v250-v242-canonical-owner'/);assert.match(boundarySource,/guideSurfaceOwnershipPolicy:'v250-single-v242-runtime-five-local-window-ledgers-handover-only-cross-realm'/);assert.match(boundarySource,/workingCampusTopbarRevision:'v243-sticky-top-map-launch-contract'/);assert.match(boundarySource,/mapLaunchRevision:'v243-register-route-handler-or-open-event'/);assert.match(boundarySource,/browserBoundaryRevision:'v228-installed-only-stale-session-chat-escape-install-only-pwa-v1'/);assert.match(boundarySource,/browserRuntimePolicy:'installed-display-only'/);assert.match(boundarySource,/installedQueryIsAuthorization:false/);
const runtimeIndex=script=>coreRuntimeSource.indexOf(`'${script}'`);
const realmIndex=runtimeIndex('/app/realm-session-integrity-v237.js'),workspaceIndex=runtimeIndex('/app/guide-workspace-v242.js'),topbarIndex=runtimeIndex('/app/working-campus-topbar-v243.js');assert.ok(realmIndex>=0&&workspaceIndex>realmIndex,'Guide workspace must load after realm-local thread ownership.');assert.ok(topbarIndex>workspaceIndex,'Working Campus topbar must load after guide workspace ownership.');
const radioIndex=runtimeIndex('/app/system-radio-agent-v233.js'),trackIndex=runtimeIndex('/app/radio-track-suggestions-v240.js'),canonicalPlaylistsIndex=runtimeIndex('/app/canonical-playlists-v1.js'),playlistGovernanceIndex=runtimeIndex('/app/radio-playlist-governance-v1.js'),meshIndex=runtimeIndex('/app/civweave-systems-mesh-v251.js'),hostSessionIndex=runtimeIndex('/app/host-node-session-v1.js'),nodeMeshIndex=runtimeIndex('/app/node-ai-mesh-v1.js'),veilMeshIndex=runtimeIndex('/app/quest-veil-mesh-v1.js'),veilGateIndex=runtimeIndex('/app/quest-veil-ledger-gate-v1.js'),veilIndex=runtimeIndex('/app/quest-veil-v1.js');assert.ok(radioIndex>=0&&trackIndex>radioIndex,'Exact-track suggestions must remain after radio.');assert.ok(canonicalPlaylistsIndex>trackIndex,'Canonical playlists must load after exact-track suggestions.');assert.ok(playlistGovernanceIndex>canonicalPlaylistsIndex,'Playlist governance must load after canonical playlists.');assert.ok(meshIndex>playlistGovernanceIndex,'Systems mesh must remain after playlist governance.');assert.ok(hostSessionIndex>meshIndex,'Hub Node session ownership must load after systems mesh.');assert.ok(nodeMeshIndex>hostSessionIndex,'Node AI mesh must follow Hub Node session ownership.');assert.ok(veilMeshIndex>nodeMeshIndex,'Quest Veil mesh must follow the node AI mesh.');assert.ok(veilGateIndex>veilMeshIndex,'Mandatory Quest Veil ledger gate must follow its mesh runtime.');assert.ok(veilIndex>veilGateIndex,'Quest Veil finale renderer must remain downstream of the mandatory gate.');
assert.match(navSource,/CivweaveSystemRoutesV227/);assert.match(navSource,/ROUTES\.navigate/);assert.equal((navSource.match(/installed=1/g)||[]).length,5,'The five fallback navigation links are not independently authorized.');assert.match(campusSource,/ensureRouteContract/);assert.match(campusSource,/x-civweave-package':'working-campus-v227/);assert.match(campusPart4,/CivweaveSystemRoutesV227/);assert.match(campusPart4,/routes\.navigate\(id/);assert.match(campusPart4,/searchParams\.set\('installed','1'\)/);
const routeImport=workerWrapper.indexOf("importScripts('/app/system-routes-v227.js");const coreImport=workerWrapper.indexOf("importScripts('/service-worker-core-v208.js");const shellRepairImport=workerWrapper.indexOf("importScripts('/service-worker-shell-repair-v225.js");const canonicalImport=workerWrapper.indexOf("importScripts('/service-worker-canonical-navigation-v227.js");assert.ok(routeImport>=0&&routeImport<coreImport,'Worker does not load the route contract before the core.');assert.ok(canonicalImport>shellRepairImport,'Canonical navigation is not the final worker policy.');assert.match(workerNavigation,/headers\.set\('x-civweave-package',REVISION\)/);assert.match(workerNavigation,/exact-route-network-first-exact-route-cache-never-launcher-fallback/);assert.match(workerNavigation,/precacheCanonicalRoutes/);assert.doesNotMatch(workerNavigation,/stableAppEntry\(/);assert.doesNotMatch(workerNavigation,/findCached\('\/app\/index\.html'\)/);assert.doesNotMatch(workerNavigation,/findCached\('\/offline\.html'\)/);for(const pathname of Object.values(paths))assert.ok(routesSource.includes(`pathname:'${pathname}'`),`Route contract is missing ${pathname}.`);
assert.match(gatewayBase,/x-civweave-package/,'Gateway no longer recognizes device-package requests.');assert.match(gatewayWrapper,/pathname !== '\/app'/,'Render wrapper no longer preserves application file delivery.');for(const [index,page] of pages.entries())assert.match(page,/\/app\/install-boundary-v146\.js/,`${Object.keys(paths)[index]} page lost the shared boundary.`);
console.log(JSON.stringify({ok:true,version,revision:'five-system-navigation-v227-core-interface-runtime-v1-browser-boundary-v228-install-only-pwa-v1',systems:Object.keys(paths),routeMatrix:25,browserRequiresInstalledDisplay:true,boundaryInstalledAuthorization:true,experienceScripts,canonicalRuntimeScripts:1,sharedRuntimeScriptCount:experienceScripts.length,sharedLoadingOwner:'core-interface-runtime-v1',settingsOwner:'settings-gateway-v317',canonicalChatOwner:'guide-workspace-v242',retiredCanonicalChatScripts,workerPackageHeader:true,workerFallback:'exact-route-or-visible-recovery',backgroundCampus:true,guideWorkspace:'v250-v242-canonical-owner',workingCampusTopbar:'v243',systemsMesh:'v251-five-system-non-privileged-event-contract',nodeAiMesh:'v1-node-owned-service-discovery-routing',questVeil:'v1-mandatory-human-ledger-gate-plus-mesh-batches',launcherSubstitution:false,installerSubstitution:false},null,2));
