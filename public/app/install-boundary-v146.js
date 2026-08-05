(()=>{
'use strict';
const INSTALLER='/';
const DEV_KEY='commonweave.install-boundary.developer.v146';
const DETERMINISTIC_MODE_SCRIPT='/app/deterministic-mode-v175.js';
const SETTINGS_CONTROLLER_SCRIPT='/app/model-settings-controller-v173.js';
const SETTINGS_DELEGATION_SCRIPT='/app/settings-delegation-v175.js';
const ADDITIONS_SCRIPT='/extensions/commonweave-additions-v156.js';
const ADDITIONS_STYLE='/extensions/commonweave-additions-v156.css';
const SHARED_TOOLS_CLEANUP_SCRIPT='/app/shared-tools-cleanup-v175.js';
const DEVICE_CREDENTIALS_SCRIPT='/extensions/commonweave-device-credentials-v160.js';
const PROOF_PROGRESS_SCRIPT='/extensions/commonweave-proof-progress-v158.js';
const GEMINI_INTERACTIONS_SCRIPT='/extensions/commonweave-gemini-interactions-v159.js';
const LIVE_SOURCE_GUARD_SCRIPT='/extensions/commonweave-antigravity-live-source-guard-v167.js';
const ADDITIONS_VERSION='v177-final-settings-retirement';
const PREVIOUS_ADDITIONS_VERSION='v175-deterministic-single-ai-settings';
const FAST_CORE_COMPATIBILITY_REVISION='v177-clean-settings-package';
const SETTINGS_STABILITY_REVISION='v177-no-legacy-ai-surfaces';
const SETTINGS_CONTROLLER_REVISION='v177-deterministic-single-authority';
const SETTINGS_RUNTIME_REVISION='v175-unified-ai-settings';
const DETERMINISTIC_RUNTIME_REVISION='v175-deterministic-default';
const INTENTION_RESEARCH_REVISION='v163-latest-intention-agentic-research';
const HUD_STABILITY_REVISION='v164-hud-observer-stability';
const WORKFLOW_HANDOFF_REVISION='v165-reviewed-merlin-rook-proof-attachments';
const TWO_AGENT_RELAY_REVISION='living-school-two-agent-youtube-v166';
const LIVE_SOURCE_PROOF_REVISION='antigravity-live-source-proof-v167';
const LOCAL_LAYOUT_REVISION='merlin-local-layout-fallback-v167';
const params=new URLSearchParams(location.search);
function installedDisplay(){return navigator.standalone===true||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||matchMedia('(display-mode: minimal-ui)').matches||matchMedia('(display-mode: window-controls-overlay)').matches}
function localhost(){return['localhost','127.0.0.1','::1'].includes(location.hostname)}
function developer(){if(localhost()&&params.get('developer')==='1'){sessionStorage.setItem(DEV_KEY,'1');return true}return localhost()&&sessionStorage.getItem(DEV_KEY)==='1'}
function embedded(){try{return window.top!==window.self}catch{return true}}
function allowed(){return installedDisplay()||developer()||embedded()}
function installerUrl(){const target=`${location.pathname}${location.search}${location.hash}`;const next=new URL(INSTALLER,location.origin);next.searchParams.set('install','required');next.searchParams.set('next',target.slice(0,1800));return next.href}
function addScript(src){if(document.querySelector(`script[src^="${src}"]`))return;const script=document.createElement('script');script.src=`${src}?v=${ADDITIONS_VERSION}`;script.async=false;document.head.append(script)}
function installAdditions(){
  if(!document.querySelector(`link[href^="${ADDITIONS_STYLE}"]`)){const link=document.createElement('link');link.rel='stylesheet';link.href=`${ADDITIONS_STYLE}?v=${ADDITIONS_VERSION}`;document.head.append(link)}
  addScript(DETERMINISTIC_MODE_SCRIPT);
  addScript(SETTINGS_CONTROLLER_SCRIPT);
  addScript(SETTINGS_DELEGATION_SCRIPT);
  addScript(LIVE_SOURCE_GUARD_SCRIPT);
  addScript(DEVICE_CREDENTIALS_SCRIPT);
  addScript(ADDITIONS_SCRIPT);
  addScript(SHARED_TOOLS_CLEANUP_SCRIPT);
  addScript(PROOF_PROGRESS_SCRIPT);
  addScript(GEMINI_INTERACTIONS_SCRIPT);
}
if(!allowed()){document.documentElement.dataset.installBoundary='blocked';location.replace(installerUrl())}
else{document.documentElement.dataset.installBoundary=installedDisplay()?'installed':developer()?'developer':'embedded';installAdditions()}
globalThis.CommonweaveInstallBoundaryV146={allowed,installedDisplay,developer,embedded,installerUrl,installAdditions,additionsVersion:ADDITIONS_VERSION,previousAdditionsVersion:PREVIOUS_ADDITIONS_VERSION,fastCoreCompatibilityRevision:FAST_CORE_COMPATIBILITY_REVISION,settingsStabilityRevision:SETTINGS_STABILITY_REVISION,settingsControllerRevision:SETTINGS_CONTROLLER_REVISION,settingsRuntimeRevision:SETTINGS_RUNTIME_REVISION,deterministicRuntimeRevision:DETERMINISTIC_RUNTIME_REVISION,intentionResearchRevision:INTENTION_RESEARCH_REVISION,hudStabilityRevision:HUD_STABILITY_REVISION,workflowHandoffRevision:WORKFLOW_HANDOFF_REVISION,twoAgentRelayRevision:TWO_AGENT_RELAY_REVISION,liveSourceProofRevision:LIVE_SOURCE_PROOF_REVISION,localLayoutRevision:LOCAL_LAYOUT_REVISION,transformerActive:false};
})();
