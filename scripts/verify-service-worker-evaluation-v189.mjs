import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

await import('./sync-release-version-assets.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const [legacy,wrapper,routes,cleanup,core,offline,release,navigation,shellRepair,canonical]=await Promise.all([
  read('public/service-worker-v156.js'),read('public/service-worker-v203.js'),read('public/app/system-routes-v227.js'),read('public/service-worker-living-school-cleanroom-v218.js'),read('public/service-worker-core-v208.js'),read('public/service-worker-offline-v211-override.js'),read('public/service-worker-release-coherence-v220.js'),read('public/service-worker-navigation-safety-v224.js'),read('public/service-worker-shell-repair-v225.js'),read('public/service-worker-canonical-navigation-v227.js')
]);
function context(){
  const listeners=[];
  const self={location:{origin:'https://commonweave.test'},addEventListener:(type,handler)=>listeners.push({type,handler}),skipWaiting:async()=>{},clients:{claim:async()=>{},matchAll:async()=>[]}};
  const caches={open:async()=>({put:async()=>{},keys:async()=>[],match:async()=>null,delete:async()=>true}),keys:async()=>[],match:async()=>null,delete:async()=>true};
  const scope=vm.createContext({console,URL,URLSearchParams,Request,Response,Headers,Set,Map,Object,String,Boolean,Promise,AbortController,setTimeout,clearTimeout,self,caches,fetch:async()=>new Response('',{status:200}),globalThis:null});
  scope.globalThis=scope;
  return{listeners,scope};
}
function evaluate(source,name){const test=context();vm.runInContext(source,test.scope,{filename:name});return test.listeners}
assert(legacy.includes("importScripts('/service-worker-v203.js"),'Legacy registrations no longer bridge to v203.');
const orderedImports=['/app/system-routes-v227.js','/service-worker-living-school-cleanroom-v218.js','/service-worker-core-v208.js','/service-worker-offline-v211-override.js','/service-worker-release-coherence-v220.js','/service-worker-navigation-safety-v224.js','/service-worker-shell-repair-v225.js','/service-worker-canonical-navigation-v227.js'];
let previous=-1;for(const pathname of orderedImports){const index=wrapper.indexOf(pathname);assert(index>previous,`Worker import order is missing or incorrect for ${pathname}.`);previous=index}
assert(wrapper.includes('/service-worker-release-coherence-v220.js?v=release-coherence-v226'),'Worker wrapper does not pin release coherence.');
const cleanupListeners=evaluate(cleanup,'living-school-cleanroom-worker.js');
const coreListeners=evaluate(core,'lightweight-core-worker.js');
assert(cleanupListeners.some(row=>row.type==='install')&&cleanupListeners.some(row=>row.type==='fetch'),'Clean-room worker boundary did not register install and fetch protection.');
assert(coreListeners.some(row=>row.type==='install')&&coreListeners.some(row=>row.type==='fetch'),'Retained worker core did not register install and fetch behavior.');
const combinedSource=[routes,cleanup,core,offline,release,navigation,shellRepair,canonical].join('\n');
const combined=evaluate(combinedSource,'combined-commonweave-worker.js');
assert(combined.filter(row=>row.type==='install').length>=3,'Combined worker lost install or five-route precache listeners.');
assert(combined.filter(row=>row.type==='fetch').length>=2,'Combined worker lost fetch listeners.');
assert(combined.filter(row=>row.type==='message').length>=2,'Combined worker lost package and repair messaging.');
assert(cleanup.includes('event.stopImmediatePropagation()'),'Living School requests are not isolated before generic caching.');
assert(release.includes('working-campus-v156.part5.txt'),'Release policy omits campus source fragments.');
assert(canonical.includes("headers.set('x-commonweave-package',REVISION)"),'Canonical navigation does not authenticate package requests.');
assert(canonical.includes('exact-route-network-first-exact-route-cache-never-launcher-fallback'),'Canonical navigation fallback policy drifted.');
for(const pathname of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert(routes.includes(`pathname:'${pathname}'`),`Route contract is missing ${pathname}.`);
console.log(JSON.stringify({ok:true,revision:'v227-five-system-worker-stack',legacyBridge:true,duplicateGlobalConstCrash:false,cleanroomFetchBoundary:true,retainedOfflineCore:true,campusFragmentCoherence:true,redirectSafety:true,shellSelfRepair:true,canonicalPackageNavigation:true,canonicalSystems:5,importLayers:orderedImports.length},null,2));
