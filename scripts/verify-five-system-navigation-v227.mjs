import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

await import('./sync-release-version-assets.mjs');
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const version=(await read('VERSION')).trim();
const paths={
  commonweave:'/app/working-campus-v156.html',
  'living-school':'/app/cabinets/living-school/index.html',
  cerbanimo:'/app/realm-console-v140.html',
  fellowfare:'/app/fellowfare-cabinet-v144.html',
  anarchadia:'/app/anarchadia-console-v139.html'
};
const [routesSource,boundarySource,navSource,campusSource,campusPart4,workerWrapper,workerNavigation,gatewayBase,gatewayWrapper,...pages]=await Promise.all([
  read('public/app/system-routes-v227.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/working-campus-v156.js'),
  read('public/app/working-campus-v156.part4.txt'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-canonical-navigation-v227.js'),
  read('server-gateway-v131-base.mjs'),
  read('server-gateway-v131.mjs'),
  ...Object.values(paths).map(path=>read(`public${path}`))
]);
for(const [label,source] of Object.entries({routesSource,boundarySource,navSource,campusSource,workerNavigation}))new Function(source);

function routeRuntime(pathname=paths.commonweave){
  const session=new Map();
  const context={
    URL,URLSearchParams,Map,Object,String,Boolean,
    location:{origin:'https://commonweave.test',pathname,href:`https://commonweave.test${pathname}`,assign(){},replace(){}},
    sessionStorage:{setItem:(key,value)=>session.set(key,String(value)),getItem:key=>session.get(key)||null},
    document:undefined
  };
  context.globalThis=context;
  vm.runInNewContext(routesSource,context,{filename:'system-routes-v227.js'});
  return{api:context.CommonweaveSystemRoutesV227,session};
}
const routeApi=routeRuntime().api;
assert.equal(routeApi.version,version,'Route contract version does not match VERSION.');
assert.equal(routeApi.routes().length,5,'Route contract must expose exactly five canonical systems.');
assert.deepEqual(Object.fromEntries(routeApi.routes().map(route=>[route.id,route.pathname])),paths,'Canonical system route map drifted.');
for(const [sourceId] of Object.entries(paths)){
  for(const [targetId,targetPath] of Object.entries(paths)){
    const url=routeApi.urlFor(targetId,{origin:'https://commonweave.test',source:sourceId,version});
    assert.equal(url.pathname,targetPath,`${sourceId} → ${targetId} changed destination.`);
    assert.equal(url.searchParams.get('installed'),'1',`${sourceId} → ${targetId} lost installed authorization.`);
    assert.equal(url.searchParams.get('navigation'),'five-system-route-contract-v227',`${sourceId} → ${targetId} lost route revision.`);
    assert.notEqual(url.pathname,'/app/index.html',`${sourceId} → ${targetId} routes through the blank launcher.`);
    assert.notEqual(url.pathname,'/',`${sourceId} → ${targetId} routes through the installer.`);
  }
}

function boundaryRuntime(pathname){
  const session=new Map(),appended=[],replaced=[];
  const root={dataset:{},isConnected:true};
  const head={isConnected:true,append:node=>appended.push(node),appendChild:node=>appended.push(node)};
  const body={isConnected:true};
  const document={documentElement:root,head,body,querySelector:()=>null,createElement:tag=>({tagName:tag.toUpperCase(),style:{}})};
  const location={origin:'https://commonweave.test',hostname:'commonweave.test',pathname,search:'',hash:'',href:`https://commonweave.test${pathname}`,replace:value=>replaced.push(String(value))};
  const context={
    URL,URLSearchParams,Map,Object,String,Boolean,document,location,
    navigator:{standalone:false},matchMedia:()=>({matches:false}),
    sessionStorage:{setItem:(key,value)=>session.set(key,String(value)),getItem:key=>session.get(key)||null},
    addEventListener:()=>{},dispatchEvent:()=>true,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},queueMicrotask:fn=>fn()
  };
  context.window=context;context.top=context;context.self=context;context.globalThis=context;
  vm.runInNewContext(routesSource,context,{filename:'system-routes-v227.js'});
  vm.runInNewContext(boundarySource,context,{filename:'install-boundary-v146.js'});
  return{context,session,appended,replaced,root};
}
for(const [system,pathname] of Object.entries(paths)){
  const result=boundaryRuntime(pathname);
  assert.equal(result.replaced.length,0,`${system} redirects to the installer with empty session state.`);
  assert.equal(result.context.CommonweaveInstallBoundaryV146.systemSurface(),system,`${system} is not a first-class boundary surface.`);
  assert.equal(result.context.CommonweaveInstallBoundaryV146.allowed(),true,`${system} is not authorized intrinsically.`);
  assert.equal(result.root.dataset.commonweaveSystemRoute,system,`${system} route identity is not stamped.`);
  if(system==='commonweave'){
    const sources=result.appended.map(node=>String(node.src||''));
    const brandSources=sources.filter(source=>source.includes('/app/civweave-brand.js'));
    const legacySources=sources.filter(source=>!source.includes('/app/civweave-brand.js'));
    assert.equal(brandSources.length,1,'Civweave canonical startup must load exactly one branding bootstrap.');
    assert.equal(legacySources.length,0,`Civweave canonical startup injected legacy scripts: ${legacySources.join(', ')}`);
  }else assert.ok(result.appended.some(node=>String(node.src||'').includes('/app/system-routes-v227.js')),`${system} does not load the shared route contract before legacy navigation.`);
}

for(const [system,pathname] of Object.entries(paths)){
  assert.ok(boundarySource.includes(`['${pathname}','${system}']`),`Boundary fallback map is missing ${system}.`);
}
assert.match(boundarySource,/canonicalSystemCount:5/);
assert.match(boundarySource,/five-system-first-class-routes-commonweave-core-only/);
assert.match(boundarySource,/const BRAND_SCRIPT='\/app\/civweave-brand\.js'/);
assert.match(navSource,/CommonweaveSystemRoutesV227/);
assert.match(navSource,/ROUTES\.navigate/);
assert.equal((navSource.match(/installed=1/g)||[]).length,5,'The five fallback navigation links are not independently authorized.');
assert.match(campusSource,/ensureRouteContract/);
assert.match(campusSource,/x-commonweave-package':'working-campus-v227/);
assert.match(campusPart4,/CommonweaveSystemRoutesV227/);
assert.match(campusPart4,/routes\.navigate\(id/);
assert.match(campusPart4,/searchParams\.set\('installed','1'\)/);

const routeImport=workerWrapper.indexOf("importScripts('/app/system-routes-v227.js");
const coreImport=workerWrapper.indexOf("importScripts('/service-worker-core-v208.js");
const shellRepairImport=workerWrapper.indexOf("importScripts('/service-worker-shell-repair-v225.js");
const canonicalImport=workerWrapper.indexOf("importScripts('/service-worker-canonical-navigation-v227.js");
assert.ok(routeImport>=0&&routeImport<coreImport,'Worker does not load the route contract before the core.');
assert.ok(canonicalImport>shellRepairImport,'Canonical navigation is not the final worker policy.');
assert.match(workerNavigation,/headers\.set\('x-commonweave-package',REVISION\)/);
assert.match(workerNavigation,/exact-route-network-first-exact-route-cache-never-launcher-fallback/);
assert.match(workerNavigation,/precacheCanonicalRoutes/);
assert.doesNotMatch(workerNavigation,/stableAppEntry\(/);
assert.doesNotMatch(workerNavigation,/findCached\('\/app\/index\.html'\)/);
assert.doesNotMatch(workerNavigation,/findCached\('\/offline\.html'\)/);
for(const pathname of Object.values(paths))assert.ok(routesSource.includes(`pathname:'${pathname}'`),`Route contract is missing ${pathname}.`);

assert.match(gatewayBase,/x-commonweave-package/,'Gateway no longer recognizes device-package requests.');
assert.match(gatewayWrapper,/pathname !== '\/app'/,'Render wrapper no longer preserves application file delivery.');
for(const [index,page] of pages.entries())assert.match(page,/\/app\/install-boundary-v146\.js/,`${Object.keys(paths)[index]} page lost the shared boundary.`);

console.log(JSON.stringify({ok:true,version,revision:'five-system-navigation-v227',systems:Object.keys(paths),routeMatrix:25,boundaryIntrinsicAuthorization:true,canonicalBrandBootstrap:true,canonicalLegacyScriptInjection:false,workerPackageHeader:true,workerFallback:'exact-route-or-visible-recovery',launcherSubstitution:false,installerSubstitution:false},null,2));
