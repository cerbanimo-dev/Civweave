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
  '/app/civweave-systems-mesh-v251.js',
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
const [routesSource,boundarySource,navSource,campusSource,campusPart4,workerWrapper,workerNavigation,gatewayBase,gatewayWrapper,...pages]=await Promise.all([
  read('public/app/system-routes-v227.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/working-campus-v156.js'),
  read('public/app/working-campus-v156.part4.txt'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-canonical-navigation-v227.js'),
  read('releases/1.0.81/server/server-gateway-v131-base.mjs'),
  read('releases/1.0.81/server/server-gateway-v131.mjs'),
  ...Object.values(paths).map(path=>read(`public${path}`))
]);
for(const [label,source] of Object.entries({routesSource,boundarySource,navSource,campusSource,workerNavigation}))new Function(source);

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

function boundaryRuntime(pathname){
  const session=new Map(),appended=[],replaced=[];const root={dataset:{},isConnected:true};const head={isConnected:true,append:node=>appended.push(node),appendChild:node=>appended.push(node)};const body={isConnected:true};const document={documentElement:root,head,body,querySelector:()=>null,createElement:tag=>({tagName:tag.toUpperCase(),style:{}})};const location={origin:'https://civweave.test',hostname:'civweave.test',pathname,search:'',hash:'',href:`https://civweave.test${pathname}`,replace:value=>replaced.push(String(value))};const context={URL,URLSearchParams,Map,Object,String,Boolean,document,location,navigator:{standalone:false},matchMedia:()=>({matches:false}),sessionStorage:{setItem:(key,value)=>session.set(key,String(value)),getItem:key=>session.get(key)||null},addEventListener:()=>{},dispatchEvent:()=>true,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},queueMicrotask:fn=>fn()};context.window=context;context.top=context;context.self=context;context.globalThis=context;vm.runInNewContext(routesSource,context,{filename:'system-routes-v227.js'});vm.runInNewContext(boundarySource,context,{filename:'install-boundary-v146.js'});return{context,session,appended,replaced,root};
}
for(const [system,pathname] of Object.entries(paths)){
  const result=boundaryRuntime(pathname);assert.equal(result.replaced.length,0,`${system} redirects to the installer with empty session state.`);assert.equal(result.context.CivweaveInstallBoundaryV146.systemSurface(),system,`${system} is not a first-class boundary surface.`);assert.equal(result.context.CivweaveInstallBoundaryV146.allowed(),true,`${system} is not authorized intrinsically.`);assert.equal(result.root.dataset.civweaveSystemRoute,system,`${system} route identity is not stamped.`);
  for(const script of experienceScripts)assert.ok(result.appended.some(node=>String(node.src||'').includes(script)),`${system} does not load ${script} from the shared experience boundary.`);
  for(const retired of retiredCanonicalChatScripts)assert.ok(!result.appended.some(node=>String(node.src||'').includes(retired)),`${system} resurrected retired canonical chat runtime ${retired}.`);
  if(system==='civweave'){assert.equal(result.appended.length,experienceScripts.length,'Civweave canonical startup must inject only the approved experience-layer scripts.');assert.ok(result.appended.every(node=>experienceScripts.some(script=>String(node.src||'').includes(script))),'Civweave canonical startup injected a non-experience or legacy script.')}else assert.ok(result.appended.some(node=>String(node.src||'').includes('/app/system-routes-v227.js')),`${system} does not load the shared route contract before compatibility navigation.`);
}
for(const [system,pathname] of Object.entries(paths))assert.ok(boundarySource.includes(`['${pathname}','${system}']`),`Boundary fallback map is missing ${system}.`);
assert.match(boundarySource,/canonicalSystemCount:5/);assert.match(boundarySource,/canonicalExperienceScripts:SYSTEM_EXPERIENCE_SCRIPTS\.length/);assert.match(boundarySource,/settingsGatewayRevision:'v317-single-owner-first-click-only'/);assert.match(boundarySource,/systemsMeshRevision:'v251-five-system-non-privileged-event-contract'/);assert.match(boundarySource,/nodeAiMeshRevision:'v1-node-owned-service-discovery-routing'/);assert.match(boundarySource,/questVeilRevision:'v1-mandatory-human-ledger-gate-plus-mesh-batches'/);assert.match(boundarySource,/questVeilHumanLedgerPolicy:'raw-task-chronicle-never-human-visible'/);assert.match(boundarySource,/questVeilMeshBountyPolicy:'per-item:learning=1-acorn;labor-material-exchange=1-button'/);assert.match(boundarySource,/five-system-first-class-routes-v242-canonical-chat-owner/);assert.match(boundarySource,/radioTrackSuggestionRevision:'v241-playlist-context-track-links'/);assert.match(boundarySource,/campusBackgroundDownloadRevision:'v241-worker-owned-download-bottom-progress-rail'/);assert.match(boundarySource,/guideWorkspaceRevision:'v250-v242-canonical-owner'/);assert.match(boundarySource,/guideSurfaceOwnershipPolicy:'v250-single-v242-runtime-five-local-window-ledgers-handover-only-cross-realm'/);assert.match(boundarySource,/workingCampusTopbarRevision:'v243-sticky-top-map-launch-contract'/);assert.match(boundarySource,/mapLaunchRevision:'v243-register-route-handler-or-open-event'/);
const realmIndex=experienceScripts.indexOf('/app/realm-session-integrity-v237.js'),workspaceIndex=experienceScripts.indexOf('/app/guide-workspace-v242.js'),topbarIndex=experienceScripts.indexOf('/app/working-campus-topbar-v243.js');assert.equal(workspaceIndex,realmIndex+1,'Guide workspace must load immediately after realm-local thread ownership.');assert.equal(topbarIndex,workspaceIndex+1,'Working Campus topbar must load immediately after guide workspace ownership.');
const radioIndex=experienceScripts.indexOf('/app/system-radio-agent-v233.js'),trackIndex=experienceScripts.indexOf('/app/radio-track-suggestions-v240.js'),meshIndex=experienceScripts.indexOf('/app/civweave-systems-mesh-v251.js'),nodeMeshIndex=experienceScripts.indexOf('/app/node-ai-mesh-v1.js'),veilMeshIndex=experienceScripts.indexOf('/app/quest-veil-mesh-v1.js'),veilGateIndex=experienceScripts.indexOf('/app/quest-veil-ledger-gate-v1.js'),veilIndex=experienceScripts.indexOf('/app/quest-veil-v1.js');assert.equal(radioIndex,3,'Radio must remain immediately after the Settings gateway, mobile AI guard, and experience orchestrator.');assert.equal(trackIndex,radioIndex+1,'Exact-track suggestions must remain immediately after radio.');assert.equal(meshIndex,trackIndex+1,'Systems mesh must remain immediately after radio suggestions.');assert.equal(nodeMeshIndex,meshIndex+1,'Node AI mesh must follow systems mesh.');assert.equal(veilMeshIndex,nodeMeshIndex+1,'Quest Veil mesh must follow the node AI mesh.');assert.equal(veilGateIndex,veilMeshIndex+1,'Mandatory Quest Veil ledger gate must follow its mesh runtime.');assert.equal(veilIndex,veilGateIndex+1,'Quest Veil finale renderer must remain downstream of the mandatory gate.');
assert.match(navSource,/CivweaveSystemRoutesV227/);assert.match(navSource,/ROUTES\.navigate/);assert.equal((navSource.match(/installed=1/g)||[]).length,5,'The five fallback navigation links are not independently authorized.');assert.match(campusSource,/ensureRouteContract/);assert.match(campusSource,/x-civweave-package':'working-campus-v227/);assert.match(campusPart4,/CivweaveSystemRoutesV227/);assert.match(campusPart4,/routes\.navigate\(id/);assert.match(campusPart4,/searchParams\.set\('installed','1'\)/);
const routeImport=workerWrapper.indexOf("importScripts('/app/system-routes-v227.js");const coreImport=workerWrapper.indexOf("importScripts('/service-worker-core-v208.js");const shellRepairImport=workerWrapper.indexOf("importScripts('/service-worker-shell-repair-v225.js");const canonicalImport=workerWrapper.indexOf("importScripts('/service-worker-canonical-navigation-v227.js");assert.ok(routeImport>=0&&routeImport<coreImport,'Worker does not load the route contract before the core.');assert.ok(canonicalImport>shellRepairImport,'Canonical navigation is not the final worker policy.');assert.match(workerNavigation,/headers\.set\('x-civweave-package',REVISION\)/);assert.match(workerNavigation,/exact-route-network-first-exact-route-cache-never-launcher-fallback/);assert.match(workerNavigation,/precacheCanonicalRoutes/);assert.doesNotMatch(workerNavigation,/stableAppEntry\(/);assert.doesNotMatch(workerNavigation,/findCached\('\/app\/index\.html'\)/);assert.doesNotMatch(workerNavigation,/findCached\('\/offline\.html'\)/);for(const pathname of Object.values(paths))assert.ok(routesSource.includes(`pathname:'${pathname}'`),`Route contract is missing ${pathname}.`);
assert.match(gatewayBase,/x-civweave-package/,'Gateway no longer recognizes device-package requests.');assert.match(gatewayWrapper,/pathname !== '\/app'/,'Render wrapper no longer preserves application file delivery.');for(const [index,page] of pages.entries())assert.match(page,/\/app\/install-boundary-v146\.js/,`${Object.keys(paths)[index]} page lost the shared boundary.`);
console.log(JSON.stringify({ok:true,version,revision:'five-system-navigation-v227-settings-gateway-v317',systems:Object.keys(paths),routeMatrix:25,boundaryIntrinsicAuthorization:true,experienceScripts,canonicalExperienceScriptCount:experienceScripts.length,settingsOwner:'settings-gateway-v317',canonicalChatOwner:'guide-workspace-v242',retiredCanonicalChatScripts,workerPackageHeader:true,workerFallback:'exact-route-or-visible-recovery',backgroundCampus:true,guideWorkspace:'v250-v242-canonical-owner',workingCampusTopbar:'v243',systemsMesh:'v251-five-system-non-privileged-event-contract',nodeAiMesh:'v1-node-owned-service-discovery-routing',questVeil:'v1-mandatory-human-ledger-gate-plus-mesh-batches',launcherSubstitution:false,installerSubstitution:false},null,2));