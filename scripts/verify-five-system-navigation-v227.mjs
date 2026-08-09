import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

await import('./sync-release-version-assets.mjs');
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const version=(await read('VERSION')).trim();
const BOOT_KEY='civweave.install-boundary.boot.v227';
const paths={civweave:'/app/working-campus-v156.html','living-school':'/app/cabinets/living-school/index.html',cerbanimo:'/app/realm-console-v140.html',fellowfare:'/app/fellowfare-cabinet-v144.html',anarchadia:'/app/anarchadia-console-v139.html'};
const experienceScripts=['/app/experience-orchestrator-v232.js','/app/civweave-systems-mesh-v251.js','/app/guide-identity-integrity-v216.js','/app/realm-session-integrity-v237.js','/app/guide-workspace-v242.js','/app/working-campus-topbar-v243.js','/app/themed-system-nav-v178.js','/app/campus-background-download-v241.js','/app/system-radio-agent-v233.js','/app/radio-track-suggestions-v240.js','/app/shared-review-surface-v234.js','/app/shared-guide-surface-v236.js'];
const retiredCanonicalChatScripts=['/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js','/app/chat-single-owner-v245.js'];
const [routesSource,boundarySource,navSource,campusSource,campusPart4,workerWrapper,workerNavigation,offlineRuntime,gatewayBase,gatewayWrapper,...pages]=await Promise.all([
  read('public/app/system-routes-v227.js'),read('public/app/install-boundary-v146.js'),read('public/app/themed-system-nav-v178.js'),read('public/app/working-campus-v156.js'),read('public/app/working-campus-v156.part4.txt'),read('public/service-worker-v203.js'),read('public/service-worker-canonical-navigation-v227.js'),read('public/service-worker-offline-runtime-boundary-v266.js'),read('server-gateway-v131-base.mjs'),read('server-gateway-v131.mjs'),...Object.values(paths).map(path=>read(`public${path}`))
]);
for(const source of [routesSource,boundarySource,navSource,campusSource,workerNavigation,offlineRuntime])new Function(source);

function routeRuntime(pathname=paths.civweave){
  const session=new Map();
  const context={URL,URLSearchParams,Map,Object,String,Boolean,location:{origin:'https://civweave.test',pathname,href:`https://civweave.test${pathname}`,assign(){},replace(){}},sessionStorage:{setItem:(key,value)=>session.set(key,String(value)),getItem:key=>session.get(key)||null},document:undefined};
  context.globalThis=context;
  vm.runInNewContext(routesSource,context,{filename:'system-routes-v227.js'});
  return{api:context.CivweaveSystemRoutesV227,session};
}
const routeProbe=routeRuntime(),routeApi=routeProbe.api;
assert.equal(routeApi.version,version,'Route contract version does not match VERSION.');
assert.equal(routeApi.routes().length,5,'Route contract must expose exactly five canonical systems.');
assert.equal(routeApi.intrinsicAuthorization,false,'Route contract must explicitly reject intrinsic authorization.');
assert.equal(routeProbe.session.has(BOOT_KEY),false,'Loading or recognizing the route contract must not seed the boot key.');
assert.deepEqual(Object.fromEntries(routeApi.routes().map(route=>[route.id,route.pathname])),paths,'Canonical system route map drifted.');
for(const [sourceId] of Object.entries(paths))for(const [targetId,targetPath] of Object.entries(paths)){
  const url=routeApi.urlFor(targetId,{origin:'https://civweave.test',source:sourceId,version});
  assert.equal(url.pathname,targetPath,`${sourceId} → ${targetId} changed destination.`);
  assert.equal(url.searchParams.get('installed'),'1',`${sourceId} → ${targetId} lost the compatibility installed marker.`);
  assert.equal(url.searchParams.get('navigation'),'five-system-route-contract-v227',`${sourceId} → ${targetId} lost route revision.`);
}
assert.ok(!/if\(typeof document[^\n]+authorize\(\)/.test(routesSource),'Route recognition still authorizes itself during script load.');

function boundaryRuntime(pathname,{authorized=false,standalone=false,search=''}={}){
  const session=new Map(),local=new Map(),appended=[],replaced=[];
  if(authorized)session.set(BOOT_KEY,'1');
  const root={dataset:{},isConnected:true},head={isConnected:true,append:node=>appended.push(node),appendChild:node=>appended.push(node)},body={isConnected:true,style:{removeProperty(){}}};
  const document={documentElement:root,head,body,referrer:'',querySelector:()=>null,createElement:tag=>({tagName:tag.toUpperCase(),style:{},dataset:{}})};
  const location={origin:'https://civweave.test',hostname:'civweave.test',pathname,search,hash:'',href:`https://civweave.test${pathname}${search}`,replace:value=>replaced.push(String(value))};
  const context={URL,URLSearchParams,Map,Object,String,Boolean,document,location,navigator:{standalone},matchMedia:()=>({matches:standalone}),sessionStorage:{setItem:(key,value)=>session.set(key,String(value)),getItem:key=>session.get(key)||null},localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,String(value))},addEventListener:()=>{},dispatchEvent:()=>true,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},queueMicrotask:fn=>fn()};
  context.window=context;context.top=context;context.self=context;context.globalThis=context;
  vm.runInNewContext(routesSource,context,{filename:'system-routes-v227.js'});
  vm.runInNewContext(boundarySource,context,{filename:'install-boundary-v146.js'});
  return{context,session,appended,replaced,root};
}
for(const [system,pathname] of Object.entries(paths)){
  const blocked=boundaryRuntime(pathname,{search:'?installed=1'});
  assert.equal(blocked.context.CivweaveInstallBoundaryV146.systemSurface(),system);
  assert.equal(blocked.context.CivweaveInstallBoundaryV146.allowed(),false,`${system} must not authorize itself merely because its URL is canonical or contains installed=1.`);
  assert.equal(blocked.session.has(BOOT_KEY),false,`${system} route recognition seeded authorization before installer redirect.`);
  assert.equal(blocked.replaced.length,1,`${system} must redirect a fresh hosted session to installer/update recovery.`);
  assert.match(blocked.replaced[0],/\/app\/index\.html\?/i);
  assert.match(blocked.replaced[0],/source=runtime-boundary-v266/);
  assert.equal(blocked.appended.length,0);
  assert.equal(blocked.root.dataset.civweaveRuntimeSource,'installer-required');

  const allowed=boundaryRuntime(pathname,{authorized:true});
  assert.equal(allowed.replaced.length,0);
  assert.equal(allowed.context.CivweaveInstallBoundaryV146.allowed(),true);
  assert.equal(allowed.root.dataset.civweaveSystemRoute,system);
  assert.equal(allowed.root.dataset.civweaveRuntimeSource,'downloaded-package');
  for(const script of experienceScripts)assert.ok(allowed.appended.some(node=>String(node.src||'').includes(script)),`${system} does not load ${script} after authorization.`);
  for(const retired of retiredCanonicalChatScripts)assert.ok(!allowed.appended.some(node=>String(node.src||'').includes(retired)),`${system} resurrected ${retired}.`);
  if(system==='civweave')assert.equal(allowed.appended.length,experienceScripts.length);
  else assert.ok(allowed.appended.some(node=>String(node.src||'').includes('/app/system-routes-v227.js')));
}
const standalone=boundaryRuntime(paths.civweave,{standalone:true});
assert.equal(standalone.replaced.length,0);
assert.equal(standalone.session.get(BOOT_KEY),'1','Standalone runtime must seed boot authorization for in-app realm navigation.');

for(const [system,pathname] of Object.entries(paths))assert.ok(boundarySource.includes(`['${pathname}','${system}']`));
for(const marker of ["canonicalPolicy:'five-system-first-class-routes-v242-canonical-chat-owner'","runtimeCanonicalPolicy:'five-system-first-class-routes-v266-downloaded-runtime-only'","runtimeAuthorizationPolicy:'standalone-or-preauthorized-session-never-route-intrinsic'","runtimeSourcePolicy:'current-downloaded-package-never-live-site-fallback'",'canonicalSystemCount:5',"onlineSelfHeal:false"])assert.ok(boundarySource.includes(marker),`Install boundary lost ${marker}.`);
assert.ok(!/function systemSurface\(\)[\s\S]{0,300}authorize\(\)/.test(boundarySource),'Install-boundary route identity must never authorize as a side effect.');

const realmIndex=experienceScripts.indexOf('/app/realm-session-integrity-v237.js'),workspaceIndex=experienceScripts.indexOf('/app/guide-workspace-v242.js'),topbarIndex=experienceScripts.indexOf('/app/working-campus-topbar-v243.js');
assert.equal(workspaceIndex,realmIndex+1);assert.equal(topbarIndex,workspaceIndex+1);
assert.match(navSource,/CivweaveSystemRoutesV227/);assert.match(navSource,/ROUTES\.navigate/);assert.match(navSource,/const EMBEDDED=window\.self!==window\.top/);
assert.match(campusSource,/ensureRouteContract/);assert.match(campusSource,/x-civweave-package':'working-campus-v227/);assert.match(campusPart4,/CivweaveSystemRoutesV227/);assert.match(campusPart4,/routes\.navigate\(id/);

const routeImport=workerWrapper.indexOf("importScripts('/app/system-routes-v227.js"),offlineBoundaryImport=workerWrapper.indexOf("importScripts('/service-worker-offline-runtime-boundary-v266.js"),coreImport=workerWrapper.indexOf("importScripts('/service-worker-core-v208.js"),canonicalImport=workerWrapper.indexOf("importScripts('/service-worker-canonical-navigation-v227.js");
assert.ok(routeImport>=0&&offlineBoundaryImport>routeImport&&offlineBoundaryImport<coreImport);
assert.ok(canonicalImport>coreImport);
for(const marker of ['exact-route-current-package-first-no-live-network-runtime-fallback','runtimeNetworkFallback:false','precacheCanonicalRoutes','currentPackage(pathname)'])assert.ok(workerNavigation.includes(marker));
const runtimeFunction=workerNavigation.slice(workerNavigation.indexOf('networkFirst=async function canonicalFiveSystemPackageFirst'),workerNavigation.indexOf('self.CivweaveCanonicalNavigationV227'));
assert.ok(runtimeFunction.length>0&&!runtimeFunction.includes('fetch(')&&!runtimeFunction.includes('originalNetworkFirst(request'),'Canonical runtime navigation can still escape to network-first behavior.');
for(const marker of ["const REVISION='offline-runtime-boundary-v266'",'canonical-runtime-current-downloaded-package-only-no-live-site-fallback',"headers.set('x-civweave-runtime-source','downloaded-package')",'event.stopImmediatePropagation()','package-miss',"`civweave-offline-${RELEASE}-`","`civweave-shell-${RELEASE}-`","`civweave-runtime-${RELEASE}-`"])assert.ok(offlineRuntime.includes(marker));
assert.match(gatewayBase,/x-civweave-package/);assert.match(gatewayWrapper,/pathname !== '\/app'/);
for(const [index,page] of pages.entries())assert.match(page,/\/app\/install-boundary-v146\.js/,`${Object.keys(paths)[index]} page lost runtime boundary.`);

console.log(JSON.stringify({ok:true,version,revision:'five-system-navigation-v266-downloaded-runtime',systems:Object.keys(paths),routeMatrix:25,routeIdentityAuthorization:false,boundaryIntrinsicAuthorization:false,queryInstalledIsAuthorization:false,standaloneAuthorization:true,canonicalRuntimeSource:'downloaded-package',canonicalNetworkFallback:false,offlineRuntimeBoundary:'v266',canonicalChatOwner:'guide-workspace-v242',workerFallback:'current-package-or-visible-repair',hostRole:'installer-update-recovery-only'},null,2));
