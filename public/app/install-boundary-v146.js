(()=>{
'use strict';

const VERSION='1.0.133';
const REVISION='chat-convergence-v250-navigation-lifecycle-v424';
const params=new URLSearchParams(location.search);
const requestedRelease=/^\d+\.\d+\.\d+$/.test(params.get('version')||'')?params.get('version'):VERSION;
const INSTALLER='/app/index.html';
const BOOT_KEY='civweave.install-boundary.boot.v227';
const LEGACY_BOOT_KEY='civweave.install-boundary.boot.v226';
const DEV_KEY='civweave.install-boundary.developer.v146';
const ADDITIONS_VERSION=`${requestedRelease}-chat-convergence-v250-navigation-lifecycle-v424`;
const ADDITIONS_STYLE='/extensions/civweave-additions-v156.css';
const SETTINGS_GATEWAY='/app/settings-gateway-v317.js';
const PLATFORM_STABILITY='/app/platform-stability-v159.js';
const MOBILE_AI_HARDENING='/app/mobile-ai-hardening-v302.js';
const GUIDE_IDENTITY_SCRIPT='/app/guide-identity-integrity-v216.js';
const REALM_SESSION_INTEGRITY='/app/realm-session-integrity-v237.js';
const GUIDE_WORKSPACE='/app/guide-workspace-v242.js';
const WORKING_CAMPUS_TOPBAR='/app/working-campus-topbar-v243.js';
const THEMED_SYSTEM_NAV='/app/themed-system-nav-v178.js';
const CAMPUS_BACKGROUND_DOWNLOAD='/app/campus-background-download-v241.js';
const SHARED_GUIDE_SURFACE='/app/shared-guide-surface-v236.js';
const FELLOWFARE_GUIDE_BRIDGE='/app/fellowfare-shared-guide-bridge-v236.js';
const ASSET_CUSTOMIZATION='/app/asset-customization-v239.js';
const ASSET_CUSTOMIZATION_STORAGE='civweave.asset-lockboard.v239';
const PWA_UPDATE_SCRIPT='/app/pwa-update-controller-v204.js';
const ROUTE_CONTRACT='/app/system-routes-v227.js';
const RELEASE_VERSION='/app/release-version-v1.js';
const EXPERIENCE_ORCHESTRATOR='/app/experience-orchestrator-v232.js';
const SYSTEMS_MESH_RUNTIME='/app/civweave-systems-mesh-v251.js';
const NODE_AI_MESH_RUNTIME='/app/node-ai-mesh-v1.js';
const QUEST_VEIL='/app/quest-veil-v1.js';
const QUEST_VEIL_MESH='/app/quest-veil-mesh-v1.js';
const QUEST_VEIL_LEDGER_GATE='/app/quest-veil-ledger-gate-v1.js';
const SYSTEM_RADIO_AGENT='/app/system-radio-agent-v233.js';
const RADIO_TRACK_SUGGESTIONS='/app/radio-track-suggestions-v240.js';
const SHARED_REVIEW_SURFACE='/app/shared-review-surface-v234.js';
const FALLBACK_PATHS=new Map([
  ['/app/working-campus-v156.html','civweave'],
  ['/app/cabinets/living-school/index.html','living-school'],
  ['/app/realm-console-v140.html','cerbanimo'],
  ['/app/fellowfare-cabinet-v144.html','fellowfare'],
  ['/app/anarchadia-console-v139.html','anarchadia']
]);
const CANONICAL_SYSTEM_SCRIPTS=[ROUTE_CONTRACT,RELEASE_VERSION];
const SYSTEM_EXPERIENCE_SCRIPTS=[
  SETTINGS_GATEWAY,
  MOBILE_AI_HARDENING,
  EXPERIENCE_ORCHESTRATOR,
  // Keep station + exact-track suggestions directly behind the orchestrator so
  // slower mesh/guide/workspace modules cannot starve the six-second radio UI.
  SYSTEM_RADIO_AGENT,
  RADIO_TRACK_SUGGESTIONS,
  SYSTEMS_MESH_RUNTIME,
  NODE_AI_MESH_RUNTIME,
  QUEST_VEIL_MESH,
  QUEST_VEIL_LEDGER_GATE,
  QUEST_VEIL,
  GUIDE_IDENTITY_SCRIPT,
  REALM_SESSION_INTEGRITY,
  GUIDE_WORKSPACE,
  WORKING_CAMPUS_TOPBAR,
  THEMED_SYSTEM_NAV,
  CAMPUS_BACKGROUND_DOWNLOAD,
  SHARED_REVIEW_SURFACE,
  SHARED_GUIDE_SURFACE
];
const COMPATIBILITY_SCRIPTS=[
  ROUTE_CONTRACT,
  RELEASE_VERSION,
  SETTINGS_GATEWAY,
  '/app/weaveling-memory-v191.js',
  '/app/weaveling-memory-bridge-v191.js',
  '/app/deterministic-mode-v175.js',
  MOBILE_AI_HARDENING,
  '/app/gemini-task-tier-router-v213.js',
  GUIDE_IDENTITY_SCRIPT,
  REALM_SESSION_INTEGRITY,
  GUIDE_WORKSPACE,
  '/extensions/civweave-antigravity-live-source-guard-v167.js',
  '/extensions/civweave-device-credentials-v160.js',
  '/extensions/civweave-additions-v156.js',
  '/app/shared-tools-cleanup-v175.js',
  '/extensions/civweave-proof-progress-v158.js',
  '/extensions/civweave-gemini-interactions-v159.js',
  THEMED_SYSTEM_NAV,
  SHARED_GUIDE_SURFACE,
  PWA_UPDATE_SCRIPT
];
let unloading=false;
addEventListener('pagehide',()=>{unloading=true});
addEventListener('beforeunload',()=>{unloading=true});

function installedDisplay(){
  return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);
}
function localhost(){return['localhost','127.0.0.1','::1'].includes(location.hostname)}
function developer(){
  if(localhost()&&params.get('developer')==='1'){try{sessionStorage.setItem(DEV_KEY,'1')}catch{}return true}
  try{return localhost()&&sessionStorage.getItem(DEV_KEY)==='1'}catch{return false}
}
function embedded(){try{return window.top!==window.self}catch{return true}}
function authorize(){
  try{sessionStorage.setItem(BOOT_KEY,'1');sessionStorage.setItem(LEGACY_BOOT_KEY,'1')}catch{}
}
function explicitInstalled(){
  try{
    if(params.get('installed')==='1'){authorize();return true}
    return sessionStorage.getItem(BOOT_KEY)==='1'||sessionStorage.getItem(LEGACY_BOOT_KEY)==='1';
  }catch{return params.get('installed')==='1'}
}
function systemSurface(){
  const contract=globalThis.CivweaveSystemRoutesV227;
  const system=contract?.identify?.(location.pathname)||FALLBACK_PATHS.get(location.pathname)||'';
  if(system)authorize();
  return system;
}
function canonicalAppSurface(){return systemSurface()==='civweave'}
function allowed(){return Boolean(systemSurface())||installedDisplay()||explicitInstalled()||developer()||embedded()}
function installerUrl(){
  const target=`${location.pathname}${location.search}${location.hash}`;
  const next=new URL(INSTALLER,location.origin);
  next.searchParams.set('install','required');
  next.searchParams.set('next',target.slice(0,1800));
  return next.href;
}
function liveHead(head=document.head){return!unloading&&document.documentElement?.isConnected&&head?.isConnected}
function addScript(src){
  const head=document.head;
  if(!liveHead(head)||document.querySelector(`script[src^="${src}"]`))return false;
  const script=document.createElement('script');
  script.src=`${src}?v=${ADDITIONS_VERSION}`;
  script.async=false;
  if(!liveHead(head))return false;
  head.append(script);
  return true;
}
function assetCustomizationConfigured(){
  try{
    const value=JSON.parse(localStorage.getItem(ASSET_CUSTOMIZATION_STORAGE)||'{}');
    return value?.personalEnabled!==false&&value?.pathOverrides&&Object.keys(value.pathOverrides).length>0;
  }catch{return false}
}
function installAssetCustomizationIfConfigured(){
  if(!assetCustomizationConfigured())return false;
  return addScript(ASSET_CUSTOMIZATION);
}
function installEarlyGuards(){
  addScript(MOBILE_AI_HARDENING);
  addScript(PLATFORM_STABILITY);
  return true;
}
function installSystemExperienceSupport(){
  const system=systemSurface();
  if(!system||!liveHead())return false;
  SYSTEM_EXPERIENCE_SCRIPTS.forEach(addScript);
  if(system==='fellowfare')addScript(FELLOWFARE_GUIDE_BRIDGE);
  installAssetCustomizationIfConfigured();
  return true;
}
function installCanonicalSystemSupport(){
  if(canonicalAppSurface()||!systemSurface()||!liveHead())return false;
  CANONICAL_SYSTEM_SCRIPTS.forEach(addScript);
  return true;
}
function installCanonicalSystemSupportWhenReady(){
  if(document.body)return installCanonicalSystemSupport();
  addEventListener('DOMContentLoaded',installCanonicalSystemSupport,{once:true});
  return true;
}
function installAdditions(){
  const head=document.head;
  if(systemSurface()||!liveHead(head))return false;
  if(!document.querySelector(`link[href^="${ADDITIONS_STYLE}"]`)){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=`${ADDITIONS_STYLE}?v=${ADDITIONS_VERSION}`;
    if(liveHead(head))head.append(link);
  }
  COMPATIBILITY_SCRIPTS.forEach(addScript);
  installAssetCustomizationIfConfigured();
  return true;
}
function installAdditionsWhenReady(){
  if(document.body)return installAdditions();
  addEventListener('DOMContentLoaded',installAdditions,{once:true});
  return true;
}
function resumeFromPageShow(){
  unloading=false;
  const system=systemSurface();
  if(system){
    installSystemExperienceSupport();
    if(system!=='civweave')installCanonicalSystemSupportWhenReady();
    return true;
  }
  installEarlyGuards();
  installAdditionsWhenReady();
  return true;
}
function start(){
  const root=document.documentElement,system=systemSurface();
  if(!allowed()){
    if(root)root.dataset.installBoundary='blocked';
    location.replace(installerUrl());
    return;
  }
  if(system){
    root.dataset.installBoundary=system==='civweave'?'canonical':'canonical-system';
    root.dataset.civweaveSystemRoute=system;
    installSystemExperienceSupport();
  }else if(root)root.dataset.installBoundary=installedDisplay()?'installed':developer()?'developer':'embedded';
  if(system==='civweave'){
    root.dataset.civweaveCanonicalCore='only';
    queueMicrotask(()=>dispatchEvent(new CustomEvent('civweave:canonical-core-only',{detail:{version:VERSION,revision:REVISION,system}})));
    return;
  }
  if(system){
    root.dataset.civweaveCanonicalRealm='self-contained';
    installCanonicalSystemSupportWhenReady();
    return;
  }
  installEarlyGuards();
  installAdditionsWhenReady();
}

addEventListener('pageshow',resumeFromPageShow);
start();

globalThis.CivweaveInstallBoundaryV146=Object.freeze({
  version:VERSION,allowed,
  revision:REVISION,
  systemSurface,
  canonicalAppSurface,
  installedDisplay,
  explicitInstalled,
  developer,
  embedded,
  installerUrl,
  installEarlyGuards,
  installSystemExperienceSupport,
  installCanonicalSystemSupport,
  installCanonicalSystemSupportWhenReady,
  installAdditions,
  installAdditionsWhenReady,
  resumeFromPageShow,
  assetCustomizationConfigured,
  installAssetCustomizationIfConfigured,
  additionsVersion:ADDITIONS_VERSION,
  publicBrand:'Civweave',
  canonicalPolicy:'five-system-first-class-routes-v242-canonical-chat-owner',
  canonicalSystemCount:5,
  canonicalAutoScripts:0,
  canonicalSubsystemSupportScripts:CANONICAL_SYSTEM_SCRIPTS.length,
  canonicalExperienceScripts:SYSTEM_EXPERIENCE_SCRIPTS.length,
  canonicalSubsystemCompatibility:'route-version-settings-only-no-legacy-additions',
  settingsGatewayRevision:'v317-single-owner-first-click-only',
  settingsLaunchPolicy:'gateway-only-no-controller-lifecycle-repair-or-delegation',
  realmLocalAISettingsRevision:'v307-lazy-management-via-document-lifecycle',
  legacyChatRuntimePolicy:'removed-from-current-source-v251',
  systemsMeshRevision:'v251-five-system-non-privileged-event-contract',
  nodeAiMeshRevision:'v1-node-owned-service-discovery-routing',
  questVeilRevision:'v1-mandatory-human-ledger-gate-plus-mesh-batches',
  questVeilHumanLedgerPolicy:'raw-task-chronicle-never-human-visible',
  questVeilMeshBountyPolicy:'per-item:learning=1-acorn;labor-material-exchange=1-button',
  campusBackgroundDownloadRevision:'v241-worker-owned-download-bottom-progress-rail',
  radioRecommendationRevision:'v233-every-page-30-minute-snooze-bottom-left',
  radioTrackSuggestionRevision:'v241-playlist-context-track-links',
  radioFloatingPlacementRevision:'v236-bottom-left-above-shared-nav',
  sharedReviewSurfaceRevision:'v234-chat-owned-review-and-weaves-under-review',
  sharedGuideSurfaceRevision:'v236-navigation-lifecycle-v424-mirror-into-v242-canonical-thread',
  realmSessionIntegrityRevision:'v237-realm-local-memory-handover-state-repair',
  guideWorkspaceRevision:'v250-v242-canonical-owner',
  workingCampusTopbarRevision:'v243-sticky-top-map-launch-contract',
  mobileAiHardeningRevision:'v302-mobile-fullscreen-chat-interrupted-test-recovery',
  mapLaunchRevision:'v243-register-route-handler-or-open-event',
  fellowfareGuideBridgeRevision:'v236-native-workbench-shared-thread',
  assetCustomizationRevision:'v239-local-path-overrides-on-demand',
  guideIdentityRevision:'v216-explicit-responder-ownership',
  guideIdentityPolicy:'explicit-selected-guide-or-explicit-handoff',
  guideSurfaceOwnershipPolicy:'v250-single-v242-runtime-five-local-window-ledgers-handover-only-cross-realm',
  guideIdentityMigration:'realm-action-owner',
  guideWorkspaceSubmissionPipelines:1,
  guideWorkspaceGuideCount:5,
  guideWorkspaceThreadPolicy:'five-realm-local-ledgers-plus-explicit-handover',
  guideWorkspaceWindowPolicy:'five-switchable-windows-current-realm-launcher',
  pwaUpdateRevision:'v250-installed-entry-every-launch',
  aiSettingsBindGuard:'retired-v317-no-input-no-prototype-patch',
  aiSettingsPersistenceRepair:'controller-owned-on-demand-v317',
  platformStabilityGuard:'v159-dom-ready-safe',
  navigationLifecycleRevision:'v424-head-capture-bfcache-resume',
  compatibilityDomReady:true,
  onlineSelfHeal:true,
  missingAssetDetails:true
});
})();