import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import('./sync-release-version-assets.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const [routesSource,boundarySource,versionText,ownershipText]=await Promise.all([
  read('public/app/system-routes-v227.js'),
  read('public/app/install-boundary-v146.js'),
  read('VERSION'),
  read('config/system-ownership.json')
]);
const version=versionText.trim();
const ownership=JSON.parse(ownershipText);
const canonicalChatOwner=ownership?.systems?.['guide-chat']?.owner;
assert.equal(canonicalChatOwner,'public/app/guide-chat-surface-v350.js','Canonical core must use the V350 guide-chat owner.');
const canonicalChatPath=`/${canonicalChatOwner.replace(/^public\//,'')}`;
const canonicalChatRevision=canonicalChatOwner.match(/-(v\d+)\.js$/i)?.[1];
assert.ok(canonicalChatRevision,'Canonical guide-chat owner must expose a revisioned filename.');
const systems={civweave:'/app/working-campus-v156.html','living-school':'/app/cabinets/living-school/index.html',cerbanimo:'/app/realm-console-v140.html',fellowfare:'/app/fellowfare-cabinet-v144.html',anarchadia:'/app/anarchadia-console-v139.html'};
const allowedCanonicalSupport=['/app/system-routes-v227.js','/app/release-version-v1.js'];
const allowedExperienceSupport=[
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
  canonicalChatPath,
  '/app/working-campus-topbar-v243.js',
  '/app/themed-system-nav-v178.js',
  '/app/campus-background-download-v241.js',
  '/app/shared-review-surface-v234.js',
  '/app/shared-guide-surface-v236.js'
];
const retiredCanonicalChat=['/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js','/app/chat-single-owner-v245.js'];
const fellowfareBridge='/app/fellowfare-shared-guide-bridge-v236.js';
function runBoundary(pathname,{installed=false}={}){
  const appended=[],replaced=[],storage=new Map(),documentElement={isConnected:true,dataset:{}},head={isConnected:true,append:node=>appended.push(node)},body={isConnected:true};
  const document={documentElement,head,body,querySelector:selector=>{const match=String(selector).match(/^script\[src\^=\"([^\"]+)\"\]$/);if(!match)return null;return appended.find(node=>String(node.src||'').startsWith(match[1]))||null},createElement:tag=>({tagName:String(tag).toUpperCase(),async:true,rel:'',href:'',src:''})};
  const location={pathname,search:'',hash:'',hostname:'civweave.invalid',origin:'https://civweave.invalid',href:`https://civweave.invalid${pathname}`,replace:url=>replaced.push(String(url))};
  const context={console,URL,URLSearchParams,Map,Object,String,Boolean,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},navigator:{standalone:installed},matchMedia:query=>({matches:installed&&String(query).includes('display-mode')}),sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))},localStorage:{getItem:()=>null},document,location,addEventListener:()=>{},dispatchEvent:()=>true,queueMicrotask:callback=>callback()};
  context.window=context;context.top=context;context.self=context;context.globalThis=context;
  vm.runInNewContext(routesSource,context,{filename:'system-routes-v227.js'});
  vm.runInNewContext(boundarySource,context,{filename:'install-boundary-v146.js'});
  return{appended,replaced,documentElement,api:context.CivweaveInstallBoundaryV146};
}
for(const [system,pathname] of Object.entries(systems)){
  const browser=runBoundary(pathname);
  assert.equal(browser.replaced.length,1,`${system} must redirect ordinary browser access to the installer.`);
  assert.equal(browser.api.allowed(),false,`${system} is incorrectly authorized in an ordinary browser.`);
  const result=runBoundary(pathname,{installed:true});
  assert.equal(result.replaced.length,0,`${system} redirected an installed display.`);
  assert.equal(result.api.version,version);
  assert.equal(result.api.systemSurface(),system);
  assert.equal(result.api.allowed(),true);
  assert.equal(result.documentElement.dataset.civweaveSystemRoute,system);
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
const api=runBoundary(systems.civweave,{installed:true}).api;
assert.equal(api.canonicalSystemCount,5);
assert.equal(api.canonicalAutoScripts,0);
assert.equal(api.canonicalSubsystemSupportScripts,allowedCanonicalSupport.length);
assert.equal(api.canonicalExperienceScripts,allowedExperienceSupport.length);
assert.equal(api.canonicalSubsystemCompatibility,'route-version-settings-only-no-legacy-additions');
assert.equal(api.canonicalPolicy,`five-system-first-class-routes-${canonicalChatRevision}-canonical-chat-owner`);
assert.equal(api.settingsGatewayRevision,'v317-single-owner-first-click-only');
assert.equal(api.settingsLaunchPolicy,'gateway-only-no-controller-lifecycle-repair-or-delegation');
assert.equal(api.systemsMeshRevision,'v251-five-system-non-privileged-event-contract');
assert.equal(api.nodeAiMeshRevision,'v1-node-owned-service-discovery-routing');
assert.equal(api.questVeilRevision,'v1-mandatory-human-ledger-gate-plus-mesh-batches');
assert.equal(api.questVeilHumanLedgerPolicy,'raw-task-chronicle-never-human-visible');
assert.equal(api.questVeilMeshBountyPolicy,'per-item:learning=1-acorn;labor-material-exchange=1-button');
assert.equal(api.guideWorkspaceSubmissionPipelines,1);
assert.equal(api.guideWorkspaceGuideCount,5);
assert.equal(api.guideWorkspaceThreadPolicy,'five-realm-local-ledgers-plus-explicit-handover');
assert.equal(api.guideWorkspaceWindowPolicy,'single-current-surface-explicit-guide-selector');
assert.equal(api.realmSessionIntegrityRevision,'v237-realm-local-memory-handover-state-repair');
assert.equal(api.guideWorkspaceRevision,`${canonicalChatRevision}-single-current-chat-surface`);
assert.equal(api.workingCampusTopbarRevision,'v243-sticky-top-map-launch-contract');
assert.equal(api.mapLaunchRevision,'v243-register-route-handler-or-open-event');
assert.equal(api.guideSurfaceOwnershipPolicy,`${canonicalChatRevision}-single-current-surface-five-private-ledgers-handover-only-cross-realm`);
assert.equal(api.fellowfareGuideBridgeRevision,'v236-native-workbench-shared-thread');
assert.equal(api.radioTrackSuggestionRevision,'v241-playlist-context-track-links');
assert.equal(api.campusBackgroundDownloadRevision,'v241-worker-owned-download-bottom-progress-rail');
assert.equal(api.pwaUpdateRevision,'v250-installed-entry-every-launch');
assert.equal(api.browserBoundaryRevision,'v228-installed-only-stale-session-chat-escape-install-only-pwa-v1');
assert.equal(api.browserRuntimePolicy,'installed-display-only');
assert.equal(api.installedQueryIsAuthorization,false);
const radioIndex=allowedExperienceSupport.indexOf('/app/system-radio-agent-v233.js');
const trackIndex=allowedExperienceSupport.indexOf('/app/radio-track-suggestions-v240.js');
const playlistsIndex=allowedExperienceSupport.indexOf('/app/canonical-playlists-v1.js');
const governanceIndex=allowedExperienceSupport.indexOf('/app/radio-playlist-governance-v1.js');
const meshIndex=allowedExperienceSupport.indexOf('/app/civweave-systems-mesh-v251.js');
assert.equal(trackIndex,radioIndex+1,'Track suggestions must immediately follow radio.');
assert.equal(playlistsIndex,trackIndex+1,'Canonical playlists must immediately follow track suggestions.');
assert.equal(governanceIndex,playlistsIndex+1,'Playlist governance must immediately follow canonical playlists.');
assert.equal(meshIndex,governanceIndex+1,'Systems mesh must immediately follow playlist governance.');
console.log(JSON.stringify({ok:true,version,revision:api.revision,canonicalSystems:Object.keys(systems),browserRequiresInstalledDisplay:true,emptySessionAuthorized:false,boundaryInstalledAuthorization:true,civweaveGlobalAdditions:0,canonicalExperienceScripts:api.canonicalExperienceScripts,canonicalSubsystemSupportScripts:api.canonicalSubsystemSupportScripts,settingsOwner:'settings-gateway-v317',canonicalChatOwner,mobileAIHardening:'v302',systemsMesh:'v251-five-system-non-privileged-event-contract',nodeAiMesh:'v1-node-owned-service-discovery-routing',questVeil:'v1-mandatory-human-ledger-gate-plus-mesh-batches',retiredCanonicalChat,realmLocalGuideThreads:true,guideWorkspace:`${canonicalChatRevision}-single-current-chat-surface`,workingCampusTopbar:'v243-sticky-map',fellowfareNativeSharedThread:true,radioTrackSuggestions:true,canonicalPlaylists:true,playlistGovernance:true,backgroundCampus:true,hostNodeSession:true,legacyCompatibility:'noncanonical-only'},null,2));