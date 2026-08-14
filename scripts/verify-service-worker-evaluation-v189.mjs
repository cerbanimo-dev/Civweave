import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

await import('./sync-release-version-assets.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const [legacy,wrapper,routes,cleanup,coherence,core,installedLaunch,installerState,integrity,offline,campusCompletion,release,navigation,shellRepair,canonical,chatRepair,localModel]=await Promise.all([
  read('public/service-worker-v156.js'),
  read('public/service-worker-v203.js'),
  read('public/app/system-routes-v227.js'),
  read('public/service-worker-living-school-cleanroom-v218.js'),
  read('public/service-worker-code-coherence-v288.js'),
  read('public/service-worker-core-v208.js'),
  read('public/service-worker-installed-launch-v282.js'),
  read('public/service-worker-installer-state-v280.js'),
  read('public/service-worker-shell-integrity-v281.js'),
  read('public/service-worker-offline-v211-override.js'),
  read('public/service-worker-campus-completion-v246.js'),
  read('public/service-worker-release-coherence-v220.js'),
  read('public/service-worker-navigation-safety-v224.js'),
  read('public/service-worker-shell-repair-v225.js'),
  read('public/service-worker-canonical-navigation-v227.js'),
  read('public/service-worker-chat-repair-v245.js'),
  read('public/service-worker-local-model-download-v267.js')
]);
function context(){
  const listeners=[];
  const self={location:{origin:'https://civweave.test',hostname:'civweave.test'},addEventListener:(type,handler)=>listeners.push({type,handler}),skipWaiting:async()=>{},clients:{claim:async()=>{},matchAll:async()=>[]}};
  const caches={open:async()=>({put:async()=>{},keys:async()=>[],match:async()=>null,delete:async()=>true}),keys:async()=>[],match:async()=>null,delete:async()=>true};
  const crypto={subtle:{digest:async()=>new Uint8Array(32).buffer}};
  const scope=vm.createContext({console,URL,URLSearchParams,Request,Response,Headers,Set,Map,Object,String,Boolean,Number,Array,Math,Promise,AbortController,setTimeout,clearTimeout,self,caches,crypto,fetch:async()=>new Response('',{status:200}),globalThis:null});
  scope.globalThis=scope;
  return{listeners,scope};
}
function evaluate(source,name){const test=context();vm.runInContext(source,test.scope,{filename:name});return test.listeners}
assert(legacy.includes("importScripts('/service-worker-v203.js"),'Legacy registrations no longer bridge to v203.');
assert(legacy.includes('code-coherence-v288'),'Legacy worker bridge does not force the v288 coherence stack.');
const orderedImports=[
  '/app/system-routes-v227.js',
  '/service-worker-living-school-cleanroom-v218.js',
  '/service-worker-code-coherence-v288.js',
  '/service-worker-core-v208.js',
  '/service-worker-installed-launch-v282.js',
  '/service-worker-installer-state-v280.js',
  '/service-worker-shell-integrity-v281.js',
  '/service-worker-offline-v211-override.js',
  '/service-worker-campus-completion-v246.js',
  '/service-worker-release-coherence-v220.js',
  '/service-worker-navigation-safety-v224.js',
  '/service-worker-shell-repair-v225.js',
  '/service-worker-canonical-navigation-v227.js',
  '/service-worker-chat-repair-v245.js',
  '/service-worker-local-model-download-v267.js'
];
let previous=-1;for(const pathname of orderedImports){const index=wrapper.indexOf(pathname);assert(index>previous,`Worker import order is missing or incorrect for ${pathname}.`);previous=index}
assert(wrapper.includes('/service-worker-code-coherence-v288.js?v=1.0.91-code-coherence-v288'),'Worker wrapper does not pin code coherence v288.');
assert(wrapper.indexOf('/service-worker-code-coherence-v288.js')<wrapper.indexOf('/service-worker-core-v208.js'),'Code coherence must intercept mutable app code before generic cache-first handling.');
assert(wrapper.includes('/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v294-campus-recovery'),'Worker wrapper does not pin installed PWA launch recovery v294.');
assert(wrapper.includes('/service-worker-release-coherence-v220.js?v=release-coherence-v226'),'Worker wrapper does not pin release coherence.');
assert(wrapper.includes('/service-worker-shell-integrity-v281.js?v=shell-integrity-v281'),'Worker wrapper does not pin shell integrity.');
assert(wrapper.includes('/service-worker-offline-v211-override.js?v=offline-campus-current-graph-v280&policy=resumable-pause-v280'),'Worker wrapper does not pin resumable campus v280.');
assert(wrapper.includes('/service-worker-shell-repair-v225.js?v=shell-self-repair-v225-install-only-pwa-v1'),'Worker wrapper does not pin the install-only shell repair.');
const cleanupListeners=evaluate(cleanup,'living-school-cleanroom-worker.js');
const coherenceListeners=evaluate(coherence,'code-coherence-worker.js');
const coreListeners=evaluate(core,'lightweight-core-worker.js');
assert(cleanupListeners.some(row=>row.type==='install')&&cleanupListeners.some(row=>row.type==='fetch'),'Clean-room worker boundary did not register install and fetch protection.');
assert(coherenceListeners.some(row=>row.type==='install')&&coherenceListeners.some(row=>row.type==='fetch'),'Code coherence worker did not register install and fetch protection.');
assert(coreListeners.some(row=>row.type==='install')&&coreListeners.some(row=>row.type==='fetch'),'Retained worker core did not register install and fetch behavior.');
assert(coherence.includes("network-first-current-version-cache-legacy-offline-fallback"),'Code coherence policy marker drifted.');
assert(coherence.includes('event.stopImmediatePropagation()'),'Code coherence no longer owns eligible executable app requests before the generic cache layer.');
assert(coherence.indexOf('const response = await cwCodeFetch(request)')<coherence.indexOf('const current = await cache.match'),'Code coherence no longer attempts a fresh executable response before cached fallback.');
for(const pathname of ['/app/document-lifecycle-v221.js','/app/working-campus-v156.part5.txt','/app/local-ai/bootstrap-v266.js','/app/local-ai/settings-panel-v267.js'])assert(coherence.includes(`'${pathname}'`),`Code coherence critical set is missing ${pathname}.`);
const combinedSource=[routes,cleanup,coherence,core,installedLaunch,installerState,integrity,offline,campusCompletion,release,navigation,shellRepair,canonical,chatRepair,localModel].join('\n');
const combined=evaluate(combinedSource,'combined-civweave-worker.js');
assert(combined.filter(row=>row.type==='install').length>=5,'Combined worker lost code-coherence/install/integrity/five-route precache listeners.');
assert(combined.filter(row=>row.type==='fetch').length>=3,'Combined worker lost clean-room, code-coherence, installed-launch, or core fetch listeners.');
assert(combined.filter(row=>row.type==='message').length>=3,'Combined worker lost package, pause, or repair messaging.');
assert(cleanup.includes('event.stopImmediatePropagation()'),'Living School requests are not isolated before generic caching.');
assert(installedLaunch.includes("const V282_CAMPUS_PATH='/app/working-campus-v156.html'"),'Installed launch worker lost the Working Campus recovery path.');
assert(installedLaunch.includes("policy:'installed-entry-then-working-campus-never-installer-substitution'"),'Installed launch worker can substitute the installer again or lose campus recovery.');
assert(shellRepair.includes("const V225_OPTIONAL_ASSETS = ['/app/installer-repair-only-v1.js']"),'Repair-only installer guard is no longer retained by the shell repair cache lane.');
assert(shellRepair.includes('browserRuntime:false'),'Shell repair no longer records the no-browser-runtime contract.');
assert(!shellRepair.includes('installer-online-fallback-v225.js'),'Shell repair can resurrect the online fallback again.');
assert(integrity.includes("crypto.subtle.digest('SHA-256'"),'Integrity worker no longer verifies SHA-256.');
assert(integrity.includes('lastKnownGoodCache'),'Integrity worker no longer retains a previous shell cache.');
assert(offline.includes("const V211_REVISION = 'offline-campus-current-graph-v280'"),'Offline worker revision drifted from v280.');
assert(offline.includes("const V211_POLICY = 'resumable-pause-v280'"),'Offline worker policy drifted from resumable pause.');
assert(release.includes('working-campus-v156.part5.txt'),'Release policy omits campus source fragments.');
assert(canonical.includes("headers.set('x-civweave-package',REVISION)"),'Canonical navigation does not authenticate package requests.');
assert(canonical.includes('exact-route-network-first-exact-route-cache-never-launcher-fallback'),'Canonical navigation fallback policy drifted.');
for(const pathname of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert(routes.includes(`pathname:'${pathname}'`),`Route contract is missing ${pathname}.`);
console.log(JSON.stringify({ok:true,revision:'v288-code-coherence-v294-installed-launch-worker-stack-install-only-pwa-v1',legacyBridge:true,duplicateGlobalConstCrash:false,cleanroomFetchBoundary:true,codeCoherence:'network-first',retainedOfflineCore:true,installedLaunch:true,installedLaunchCampusRecovery:true,installerGuardOfflineCached:true,installerState:true,shellIntegrity:true,resumableCampus:'v280',campusFragmentCoherence:true,redirectSafety:true,shellSelfRepair:true,canonicalPackageNavigation:true,canonicalSystems:5,importLayers:orderedImports.length,browserRuntime:false},null,2));