import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import('./sync-release-version-assets.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [routesSource,boundarySource,versionText]=await Promise.all([
  readFile(path.join(root,'public/app/system-routes-v227.js'),'utf8'),
  readFile(path.join(root,'public/app/install-boundary-v146.js'),'utf8'),
  readFile(path.join(root,'VERSION'),'utf8')
]);
const version=versionText.trim();
const BOOT_KEY='civweave.install-boundary.boot.v227';
const systems={civweave:'/app/working-campus-v156.html','living-school':'/app/cabinets/living-school/index.html',cerbanimo:'/app/realm-console-v140.html',fellowfare:'/app/fellowfare-cabinet-v144.html',anarchadia:'/app/anarchadia-console-v139.html'};
const allowedCanonicalSupport=['/app/system-routes-v227.js','/app/release-version-v1.js','/app/ai-settings-bind-guard-v230.js','/app/ai-settings-device-repair-v229.js'];
const allowedExperienceSupport=['/app/experience-orchestrator-v232.js','/app/civweave-systems-mesh-v251.js','/app/guide-identity-integrity-v216.js','/app/realm-session-integrity-v237.js','/app/guide-workspace-v242.js','/app/working-campus-topbar-v243.js','/app/themed-system-nav-v178.js','/app/campus-background-download-v241.js','/app/system-radio-agent-v233.js','/app/radio-track-suggestions-v240.js','/app/shared-review-surface-v234.js','/app/shared-guide-surface-v236.js'];
const retiredCanonicalChat=['/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js','/app/chat-single-owner-v245.js'];
const fellowfareBridge='/app/fellowfare-shared-guide-bridge-v236.js';

function runBoundary(pathname,{authorized=false,standalone=false}={}){
  const appended=[],replaced=[],storage=new Map(),documentElement={isConnected:true,dataset:{}},head={isConnected:true,append:node=>appended.push(node)},body={isConnected:true};
  if(authorized)storage.set(BOOT_KEY,'1');
  const document={documentElement,head,body,referrer:'',querySelector:()=>null,createElement:tag=>({tagName:String(tag).toUpperCase(),async:true,rel:'',href:'',src:'',dataset:{}})};
  const location={pathname,search:'',hash:'',hostname:'civweave.invalid',origin:'https://civweave.invalid',href:`https://civweave.invalid${pathname}`,replace:url=>replaced.push(String(url))};
  const context={console,URL,URLSearchParams,Map,Object,String,Boolean,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},navigator:{standalone},matchMedia:()=>({matches:standalone}),sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))},localStorage:{getItem:()=>null,setItem:()=>{}},document,location,addEventListener:()=>{},dispatchEvent:()=>true,queueMicrotask:callback=>callback()};
  context.window=context;context.top=context;context.self=context;context.globalThis=context;
  vm.runInNewContext(routesSource,context,{filename:'system-routes-v227.js'});
  vm.runInNewContext(boundarySource,context,{filename:'install-boundary-v146.js'});
  return{appended,replaced,storage,documentElement,api:context.CivweaveInstallBoundaryV146};
}

for(const [system,pathname] of Object.entries(systems)){
  const blocked=runBoundary(pathname);
  assert.equal(blocked.replaced.length,1,`${system} did not redirect an unauthorised hosted session to installer.`);
  assert.match(blocked.replaced[0],/\/app\/index\.html\?/);
  assert.equal(blocked.storage.has(BOOT_KEY),false,`${system} route identity seeded authorization.`);
  assert.equal(blocked.appended.length,0,`${system} booted canonical support before downloaded-runtime authorization.`);
  assert.equal(blocked.documentElement.dataset.installBoundary,'blocked');
  assert.equal(blocked.documentElement.dataset.civweaveRuntimeSource,'installer-required');

  const result=runBoundary(pathname,{authorized:true});
  assert.equal(result.replaced.length,0,`${system} redirected despite an authorized local runtime session.`);
  assert.equal(result.api.version,version);
  assert.equal(result.api.systemSurface(),system);
  assert.equal(result.api.allowed(),true);
  assert.equal(result.documentElement.dataset.civweaveSystemRoute,system);
  assert.equal(result.documentElement.dataset.civweaveRuntimeSource,'downloaded-package');
  const scriptPaths=result.appended.map(node=>{try{return new URL(String(node.src||''),'https://civweave.invalid').pathname}catch{return''}}).filter(Boolean);
  for(const retired of retiredCanonicalChat)assert.ok(!scriptPaths.includes(retired),`${system} booted retired canonical chat owner ${retired}.`);
  if(system==='civweave'){
    assert.deepEqual(scriptPaths,allowedExperienceSupport,'Civweave startup drifted beyond the approved experience subsystem.');
    assert.equal(result.documentElement.dataset.installBoundary,'canonical');
    assert.equal(result.documentElement.dataset.civweaveCanonicalCore,'only');
  }else{
    assert.equal(result.documentElement.dataset.installBoundary,'canonical-system');
    assert.equal(result.documentElement.dataset.civweaveCanonicalRealm,'self-contained');
    const realmBridge=system==='fellowfare'?[fellowfareBridge]:[];
    assert.deepEqual(scriptPaths,[...allowedExperienceSupport,...realmBridge,...allowedCanonicalSupport],`${system} canonical support drifted into the legacy compatibility bundle.`);
    assert(!scriptPaths.includes('/extensions/civweave-additions-v156.js'),`${system} reintroduced the post-paint shared-additions injector.`);
    assert(!scriptPaths.includes('/app/pwa-update-controller-v204.js'),`${system} reintroduced the update overlay during canonical startup.`);
  }
}
const standalone=runBoundary(systems.civweave,{standalone:true});
assert.equal(standalone.replaced.length,0,'Standalone PWA runtime was redirected.');
assert.equal(standalone.storage.get(BOOT_KEY),'1','Standalone runtime did not authorize subsequent in-app realm travel.');

const api=runBoundary(systems.civweave,{authorized:true}).api;
assert.equal(api.canonicalSystemCount,5);
assert.equal(api.canonicalAutoScripts,0);
assert.equal(api.canonicalSubsystemSupportScripts,4);
assert.equal(api.canonicalExperienceScripts,allowedExperienceSupport.length);
assert.equal(api.canonicalSubsystemCompatibility,'route-version-settings-only-no-legacy-additions');
assert.equal(api.canonicalPolicy,'five-system-first-class-routes-v242-canonical-chat-owner');
assert.equal(api.runtimeCanonicalPolicy,'five-system-first-class-routes-v266-downloaded-runtime-only');
assert.equal(api.runtimeAuthorizationPolicy,'standalone-or-preauthorized-session-never-route-intrinsic');
assert.equal(api.runtimeSourcePolicy,'current-downloaded-package-never-live-site-fallback');
assert.equal(api.systemsMeshRevision,'v251-five-system-non-privileged-event-contract');
assert.equal(api.persistentGuideChatSubmissionPipelines,1);
assert.equal(api.persistentGuideChatGuideCount,5);
assert.equal(api.persistentGuideChatThreadPolicy,'five-realm-local-ledgers-plus-explicit-handover');
assert.equal(api.persistentGuideChatWindowPolicy,'five-switchable-windows-current-realm-launcher');
assert.equal(api.realmSessionIntegrityRevision,'v237-realm-local-memory-handover-state-repair');
assert.equal(api.guideWorkspaceRevision,'v250-v242-canonical-owner');
assert.equal(api.workingCampusTopbarRevision,'v243-sticky-top-map-launch-contract');
assert.equal(api.mapLaunchRevision,'v243-register-route-handler-or-open-event');
assert.equal(api.guideSurfaceOwnershipPolicy,'v250-single-v242-runtime-five-local-window-ledgers-handover-only-cross-realm');
assert.equal(api.fellowfareGuideBridgeRevision,'v236-native-workbench-shared-thread');
assert.equal(api.radioTrackSuggestionRevision,'v241-playlist-context-track-links');
assert.equal(api.campusBackgroundDownloadRevision,'v241-worker-owned-download-bottom-progress-rail');
assert.equal(api.pwaUpdateRevision,'v250-installed-entry-every-launch');
console.log(JSON.stringify({ok:true,version,revision:api.revision,canonicalSystems:Object.keys(systems),emptySessionAuthorized:false,emptySessionRedirectsInstaller:true,standaloneAuthorized:true,runtimeSource:'downloaded-package',civweaveGlobalAdditions:0,canonicalExperienceScripts:api.canonicalExperienceScripts,canonicalSubsystemSupportScripts:api.canonicalSubsystemSupportScripts,canonicalChatOwner:'guide-workspace-v242',systemsMesh:'v251-five-system-non-privileged-event-contract',retiredCanonicalChat,realmLocalGuideThreads:true,guideWorkspace:'v250-v242-canonical-owner',workingCampusTopbar:'v243-sticky-map',fellowfareNativeSharedThread:true,radioTrackSuggestions:true,backgroundCampus:true,legacyCompatibility:'noncanonical-only'},null,2));
