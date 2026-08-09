import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

await import('./sync-release-version-assets.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const [legacy,wrapper,routes,runtimeBoundary,cleanup,core,offline,release,navigation,shellRepair,canonical]=await Promise.all([
  read('public/service-worker-v156.js'),
  read('public/service-worker-v203.js'),
  read('public/app/system-routes-v227.js'),
  read('public/service-worker-offline-runtime-boundary-v266.js'),
  read('public/service-worker-living-school-cleanroom-v218.js'),
  read('public/service-worker-core-v208.js'),
  read('public/service-worker-offline-v211-override.js'),
  read('public/service-worker-release-coherence-v220.js'),
  read('public/service-worker-navigation-safety-v224.js'),
  read('public/service-worker-shell-repair-v225.js'),
  read('public/service-worker-canonical-navigation-v227.js')
]);
function context(){
  const listeners=[];
  const self={
    location:{origin:'https://civweave.test',href:'https://civweave.test/service-worker-v203.js?v=1.0.58-downloaded-runtime-v266'},
    addEventListener:(type,handler)=>listeners.push({type,handler}),
    skipWaiting:async()=>{},
    clients:{claim:async()=>{},matchAll:async()=>[],get:async()=>null}
  };
  const caches={open:async()=>({put:async()=>{},keys:async()=>[],match:async()=>null,delete:async()=>true}),keys:async()=>[],match:async()=>null,delete:async()=>true};
  const scope=vm.createContext({console,URL,URLSearchParams,Request,Response,Headers,Set,Map,Object,String,Boolean,Promise,AbortController,setTimeout,clearTimeout,self,caches,fetch:async()=>new Response('',{status:200}),globalThis:null});
  scope.globalThis=scope;
  return{listeners,scope};
}
function evaluate(source,name){const test=context();vm.runInContext(source,test.scope,{filename:name});return test.listeners}
assert(legacy.includes("importScripts('/service-worker-v203.js"),'Legacy registrations no longer bridge to v203.');
const orderedImports=[
  '/app/system-routes-v227.js',
  '/service-worker-offline-runtime-boundary-v266.js',
  '/service-worker-living-school-cleanroom-v218.js',
  '/service-worker-core-v208.js',
  '/service-worker-offline-v211-override.js',
  '/service-worker-release-coherence-v220.js',
  '/service-worker-navigation-safety-v224.js',
  '/service-worker-shell-repair-v225.js',
  '/service-worker-canonical-navigation-v227.js'
];
let previous=-1;
for(const pathname of orderedImports){const index=wrapper.indexOf(pathname);assert(index>previous,`Worker import order is missing or incorrect for ${pathname}.`);previous=index}
assert(wrapper.includes('/service-worker-release-coherence-v220.js?v=release-coherence-v226'),'Worker wrapper does not pin release coherence.');
const boundaryListeners=evaluate(runtimeBoundary,'offline-runtime-boundary-v266.js');
const cleanupListeners=evaluate(cleanup,'living-school-cleanroom-worker.js');
const coreListeners=evaluate(core,'lightweight-core-worker.js');
assert(boundaryListeners.some(row=>row.type==='fetch'),'Downloaded-runtime boundary did not register the first runtime fetch guard.');
assert(cleanupListeners.some(row=>row.type==='install')&&cleanupListeners.some(row=>row.type==='fetch'),'Clean-room worker boundary did not register install and fetch protection.');
assert(coreListeners.some(row=>row.type==='install')&&coreListeners.some(row=>row.type==='fetch'),'Retained worker core did not register install and fetch behavior.');
const combinedSource=[routes,runtimeBoundary,cleanup,core,offline,release,navigation,shellRepair,canonical].join('\n');
const combined=evaluate(combinedSource,'combined-civweave-worker.js');
assert(combined.filter(row=>row.type==='install').length>=3,'Combined worker lost install or five-route precache listeners.');
assert(combined.filter(row=>row.type==='fetch').length>=3,'Combined worker lost downloaded-runtime, clean-room, or general fetch listeners.');
assert(combined.filter(row=>row.type==='message').length>=2,'Combined worker lost package and repair messaging.');
assert(runtimeBoundary.includes('event.stopImmediatePropagation()'),'Downloaded canonical runtime requests are not isolated before generic/network caching.');
assert(runtimeBoundary.includes('canonical-runtime-current-downloaded-package-only-no-live-site-fallback'),'Downloaded-runtime policy drifted.');
assert(runtimeBoundary.includes("headers.set('x-civweave-runtime-source','downloaded-package')"),'Downloaded package responses do not declare their source.');
assert(cleanup.includes('event.stopImmediatePropagation()'),'Living School requests are not isolated before generic caching.');
assert(release.includes('working-campus-v156.part5.txt'),'Release policy omits campus source fragments.');
assert(canonical.includes("'x-civweave-package':REVISION"),'Canonical install-time precache no longer marks package requests.');
assert(canonical.includes('exact-route-current-package-first-no-live-network-runtime-fallback'),'Canonical runtime navigation must remain package-first.');
assert(canonical.includes('runtimeNetworkFallback:false'),'Canonical runtime navigation re-enabled hosted network fallback.');
const runtimeBranch=canonical.slice(canonical.indexOf('networkFirst=async function canonicalFiveSystemPackageFirst'),canonical.indexOf('self.CivweaveCanonicalNavigationV227'));
assert(runtimeBranch.length>0&&!runtimeBranch.includes('fetch('),'Canonical runtime navigation contains a live fetch call.');
for(const pathname of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert(routes.includes(`pathname:'${pathname}'`),`Route contract is missing ${pathname}.`);
console.log(JSON.stringify({ok:true,revision:'v266-five-system-downloaded-worker-stack',legacyBridge:true,duplicateGlobalConstCrash:false,downloadedRuntimeFetchBoundary:true,cleanroomFetchBoundary:true,retainedOfflineCore:true,campusFragmentCoherence:true,redirectSafety:true,shellSelfRepair:true,canonicalPackageNavigation:true,canonicalNetworkFallback:false,canonicalSystems:5,importLayers:orderedImports.length},null,2));
