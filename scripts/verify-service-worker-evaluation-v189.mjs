import vm from 'node:vm';
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

await import('./sync-release-version-assets.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const exists=file=>access(path.join(root,file)).then(()=>true,()=>false);
const [legacy,wrapper,routes,cleanup,coherence,core,shellAssets,installedLaunch,installerState,integrity,offline,campusCompletion,release,navigation,shellRepair,canonical,chatRepair,localModel,repairOnly]=await Promise.all([
  read('public/service-worker-v156.js'),read('public/service-worker-v203.js'),read('public/app/system-routes-v227.js'),read('public/service-worker-living-school-cleanroom-v218.js'),read('public/service-worker-code-coherence-v288.js'),read('public/service-worker-core-v208.js'),read('public/service-worker-shell-assets-v1.js'),read('public/service-worker-installed-launch-v282.js'),read('public/service-worker-installer-state-v280.js'),read('public/service-worker-shell-integrity-v281.js'),read('public/service-worker-offline-v211-override.js'),read('public/service-worker-campus-completion-v246.js'),read('public/service-worker-release-coherence-v220.js'),read('public/service-worker-navigation-safety-v224.js'),read('public/service-worker-shell-repair-v293.js'),read('public/service-worker-canonical-navigation-v227.js'),read('public/service-worker-chat-repair-v245.js'),read('public/service-worker-local-model-download-v267.js'),read('public/app/installer-repair-only-v2.js')
]);
function context(){
  const listeners=[];
  const self={location:{origin:'https://civweave.test',hostname:'civweave.test'},addEventListener:(type,handler)=>listeners.push({type,handler}),skipWaiting:async()=>{},clients:{claim:async()=>{},matchAll:async()=>[]}};
  const caches={open:async()=>({put:async()=>{},keys:async()=>[],match:async()=>null,delete:async()=>true}),keys:async()=>[],match:async()=>null,delete:async()=>true};
  const crypto={subtle:{digest:async()=>new Uint8Array(32).buffer}};
  const scope=vm.createContext({console,URL,URLSearchParams,Request,Response,Headers,Set,Map,Object,String,Boolean,Number,Array,Math,Promise,AbortController,setTimeout,clearTimeout,self,caches,crypto,fetch:async()=>new Response('',{status:200}),globalThis:null});
  scope.globalThis=scope;return{listeners,scope};
}
function evaluate(source,name){const test=context();vm.runInContext(source,test.scope,{filename:name});return test.listeners}
assert(legacy.includes("importScripts('/service-worker-v203.js"),'Legacy registrations no longer bridge to v203.');
const orderedImports=['/app/system-routes-v227.js','/service-worker-living-school-cleanroom-v218.js','/service-worker-code-coherence-v288.js','/service-worker-core-v208.js','/service-worker-shell-assets-v1.js','/service-worker-installed-launch-v282.js','/service-worker-installer-state-v280.js','/service-worker-shell-integrity-v281.js','/service-worker-shell-repair-v293.js','/service-worker-offline-v211-override.js','/service-worker-campus-completion-v246.js','/service-worker-release-coherence-v220.js','/service-worker-navigation-safety-v224.js','/service-worker-canonical-navigation-v227.js','/service-worker-chat-repair-v245.js','/service-worker-local-model-download-v267.js'];
let previous=-1;for(const pathname of orderedImports){const index=wrapper.indexOf(pathname);assert(index>previous,`Worker import order is missing or incorrect for ${pathname}.`);previous=index}
assert(wrapper.includes('working-campus-return-v425-install-only-pwa-v1'),'Worker wrapper does not force the install-only core refresh.');
assert(wrapper.includes('/service-worker-shell-assets-v1.js?v=shell-assets-v1-repair-v2'),'Worker wrapper does not load the declarative repair-v2 shell asset.');
assert(wrapper.includes('/service-worker-shell-repair-v293.js?v=installed-shell-repair-v293'),'Worker wrapper does not load the canonical v293 repair responder.');
assert(!wrapper.includes('/service-worker-shell-repair-v225.js'),'Worker wrapper resurrected the retired v225 repair owner.');
assert.equal(await exists('public/service-worker-shell-repair-v225.js'),false,'Retired v225 repair runtime must remain physically absent.');
const cleanupListeners=evaluate(cleanup,'living-school-cleanroom-worker.js');
const coherenceListeners=evaluate(coherence,'code-coherence-worker.js');
const coreListeners=evaluate(core,'lightweight-core-worker.js');
assert(cleanupListeners.some(row=>row.type==='install')&&cleanupListeners.some(row=>row.type==='fetch'),'Clean-room worker boundary lost install/fetch protection.');
assert(coherenceListeners.some(row=>row.type==='install')&&coherenceListeners.some(row=>row.type==='fetch'),'Code coherence worker lost install/fetch protection.');
assert(coreListeners.some(row=>row.type==='install')&&coreListeners.some(row=>row.type==='fetch'),'Retained worker core lost install/fetch behavior.');
const combinedSource=[routes,cleanup,coherence,core,shellAssets,installedLaunch,installerState,integrity,shellRepair,offline,campusCompletion,release,navigation,canonical,chatRepair,localModel].join('\n');
const combined=evaluate(combinedSource,'combined-civweave-worker.js');
assert(combined.filter(row=>row.type==='install').length>=5,'Combined worker lost install listeners.');
assert(combined.filter(row=>row.type==='fetch').length>=3,'Combined worker lost fetch listeners.');
const repairOwners=(combinedSource.match(/event\.data\?\.type\s*!==?\s*['"]REPAIR_DEVICE_PACKAGE['"]/g)||[]).length;
assert.equal(repairOwners,1,'Combined worker must have exactly one REPAIR_DEVICE_PACKAGE responder.');
assert(installedLaunch.includes("policy:'installed-entry-then-working-campus-never-installer-substitution'"),'Installed launch worker regressed.');
assert(shellAssets.includes("const OPTIONAL=['/app/installer-repair-only-v2.js']"),'Declarative shell assets must retain repair bridge v2.');
assert(!shellAssets.includes('installer-repair-only-v1.js'),'Declarative shell assets must not seed stale repair bridge v1.');
assert(!shellAssets.includes('installer-online-fallback-v225.js'),'Declarative shell assets must not resurrect online fallback.');
assert(shellRepair.includes("event.data?.type!=='REPAIR_DEVICE_PACKAGE'"),'v293 must remain the explicit installed-shell repair responder.');
assert(repairOnly.includes("browserRuntimePolicy:'installer-only-until-installed-display'"),'Repair bridge must keep browser runtime disabled.');
assert(repairOnly.includes('cacheDistinctPath:true'),'Repair bridge must declare its stale-cache escape.');
assert(integrity.includes("crypto.subtle.digest('SHA-256'"),'Integrity worker no longer verifies SHA-256.');
assert(offline.includes("const V211_POLICY = 'resumable-pause-v280'"),'Offline policy drifted.');
assert(canonical.includes('exact-route-network-first-exact-route-cache-never-launcher-fallback'),'Canonical navigation fallback policy drifted.');
for(const pathname of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert(routes.includes(`pathname:'${pathname}'`),`Route contract is missing ${pathname}.`);
console.log(JSON.stringify({ok:true,revision:'v189-single-shell-repair-owner-v293',legacyBridge:true,codeCoherence:'network-first',retainedOfflineCore:true,installedLaunch:true,repairOnly:true,cacheDistinctRepair:true,browserRuntime:false,shellIntegrity:true,canonicalSystems:5,repairOwners,importLayers:orderedImports.length},null,2));
