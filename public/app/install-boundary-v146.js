(()=>{
'use strict';
const INSTALLER='/';
const DEV_KEY='commonweave.install-boundary.developer.v146';
const MEMORY_SCRIPT='/app/weaveling-memory-v191.js';
const MEMORY_BRIDGE_SCRIPT='/app/weaveling-memory-bridge-v191.js';
const DETERMINISTIC_MODE_SCRIPT='/app/deterministic-mode-v175.js';
const SETTINGS_CONTROLLER_SCRIPT='/app/model-settings-controller-v173.js';
const SETTINGS_DELEGATION_SCRIPT='/app/settings-delegation-v175.js';
const GEMINI_TASK_ROUTER_SCRIPT='/app/gemini-task-tier-router-v213.js';
const PERSISTENT_GUIDE_CHAT_SCRIPT='/app/persistent-guide-chat-v215.js';
const ADDITIONS_SCRIPT='/extensions/commonweave-additions-v156.js';
const ADDITIONS_STYLE='/extensions/commonweave-additions-v156.css';
const SHARED_TOOLS_CLEANUP_SCRIPT='/app/shared-tools-cleanup-v175.js';
const DEVICE_CREDENTIALS_SCRIPT='/extensions/commonweave-device-credentials-v160.js';
const PROOF_PROGRESS_SCRIPT='/extensions/commonweave-proof-progress-v158.js';
const GEMINI_INTERACTIONS_SCRIPT='/extensions/commonweave-gemini-interactions-v159.js';
const LIVE_SOURCE_GUARD_SCRIPT='/extensions/commonweave-antigravity-live-source-guard-v167.js';
const THEMED_SYSTEM_NAV_SCRIPT='/app/themed-system-nav-v178.js';
const PWA_UPDATE_SCRIPT='/app/pwa-update-controller-v204.js';
const ADDITIONS_VERSION='v215-guide-chat-notifications';
// Compatibility marker: ADDITIONS_VERSION='v214-persistent-guide-chat'
// Compatibility marker: ADDITIONS_VERSION='v213-gemini-task-tier-routing'
// Compatibility marker: ADDITIONS_VERSION='v207-registration-watchdog'
// Compatibility marker: ADDITIONS_VERSION='v204-visible-update-library-preservation'
// Compatibility marker: ADDITIONS_VERSION='v191-memory-credential'
// Compatibility marker: ADDITIONS_VERSION='v188-ai-settings-cleanroom'
const PREVIOUS_ADDITIONS_VERSION='v214-persistent-guide-chat';
const EARLIER_ADDITIONS_VERSION='v213-gemini-task-tier-routing';
const FAST_CORE_COMPATIBILITY_REVISION='v215-v106-guide-chat-notifications';
const PACKAGE_RECOVERY_REVISION='v207-registration-update-deadlines';
const SETTINGS_STABILITY_REVISION='v188-no-observer-no-polling-no-capture';
const SETTINGS_CONTROLLER_REVISION='v188-single-cleanroom-authority-v191-credentials';
// Compatibility marker: SETTINGS_CONTROLLER_REVISION='v188-single-cleanroom-authority'
const SETTINGS_RUNTIME_REVISION='v188-provider-runtime-disconnected';
const SETTINGS_LOG_REVISION='v188-diagnostics-runtime-retired';
const CREDENTIAL_REVISION='v191-explicit-session-or-device';
const MEMORY_REVISION='v191-working-and-long-term-local';
const DETERMINISTIC_RUNTIME_REVISION='v175-deterministic-default';
const GEMINI_TASK_ROUTING_REVISION='v213-small-3.1-flash-lite-complex-3.5-flash-lite';
const PERSISTENT_GUIDE_CHAT_REVISION='v215-one-thread-five-guide-notifications';
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
function installAdditions(){if(!document.querySelector(`link[href^="${ADDITIONS_STYLE}"]`)){const link=document.createElement('link');link.rel='stylesheet';link.href=`${ADDITIONS_STYLE}?v=${ADDITIONS_VERSION}`;document.head.append(link)}addScript(MEMORY_SCRIPT);addScript(MEMORY_BRIDGE_SCRIPT);addScript(DETERMINISTIC_MODE_SCRIPT);addScript(SETTINGS_CONTROLLER_SCRIPT);addScript(SETTINGS_DELEGATION_SCRIPT);addScript(GEMINI_TASK_ROUTER_SCRIPT);addScript(PERSISTENT_GUIDE_CHAT_SCRIPT);addScript(LIVE_SOURCE_GUARD_SCRIPT);addScript(DEVICE_CREDENTIALS_SCRIPT);addScript(ADDITIONS_SCRIPT);addScript(SHARED_TOOLS_CLEANUP_SCRIPT);addScript(PROOF_PROGRESS_SCRIPT);addScript(GEMINI_INTERACTIONS_SCRIPT);addScript(THEMED_SYSTEM_NAV_SCRIPT);addScript(PWA_UPDATE_SCRIPT)}
if(!allowed()){document.documentElement.dataset.installBoundary='blocked';location.replace(installerUrl())}else{document.documentElement.dataset.installBoundary=installedDisplay()?'installed':developer()?'developer':'embedded';installAdditions()}
globalThis.CommonweaveInstallBoundaryV146={version:'1.0.6',allowed,installedDisplay,developer,embedded,installerUrl,installAdditions,additionsVersion:ADDITIONS_VERSION,previousAdditionsVersion:PREVIOUS_ADDITIONS_VERSION,earlierAdditionsVersion:EARLIER_ADDITIONS_VERSION,fastCoreCompatibilityRevision:FAST_CORE_COMPATIBILITY_REVISION,packageRecoveryRevision:PACKAGE_RECOVERY_REVISION,onlineSelfHeal:true,missingAssetDetails:true,settingsStabilityRevision:SETTINGS_STABILITY_REVISION,settingsControllerRevision:SETTINGS_CONTROLLER_REVISION,settingsRuntimeRevision:SETTINGS_RUNTIME_REVISION,settingsLogRevision:SETTINGS_LOG_REVISION,credentialRevision:CREDENTIAL_REVISION,credentialPersistence:'explicit-session-or-device',automaticCredentialPersistence:false,memoryRevision:MEMORY_REVISION,memoryLocalOnly:true,logLevelKey:null,logBufferKey:null,diagnosticQueryParameter:null,deterministicRuntimeRevision:DETERMINISTIC_RUNTIME_REVISION,geminiTaskRoutingRevision:GEMINI_TASK_ROUTING_REVISION,geminiSmallModel:'gemini-3.1-flash-lite',geminiComplexModel:'gemini-3.5-flash-lite',persistentGuideChatRevision:PERSISTENT_GUIDE_CHAT_REVISION,persistentGuideChatHistory:'shared-v214-key',persistentGuideChatSubmissionPipelines:1,persistentGuideChatGuideCount:5,persistentGuideChatCurrentRealmPriority:true,persistentGuideChatThemedSwitching:true,persistentGuideChatAboveNavigation:true,persistentGuideChatNotifications:true,persistentGuideChatNotificationPalettes:{weaveling:'pearl-silver',moss:'green',kamiya:'purple',rook:'amber',merlin:'pink'},intentionResearchRevision:INTENTION_RESEARCH_REVISION,hudStabilityRevision:HUD_STABILITY_REVISION,workflowHandoffRevision:WORKFLOW_HANDOFF_REVISION,twoAgentRelayRevision:TWO_AGENT_RELAY_REVISION,liveSourceProofRevision:LIVE_SOURCE_PROOF_REVISION,localLayoutRevision:LOCAL_LAYOUT_REVISION,themedSystemNavRevision:'v178',pwaUpdateRevision:'v207-registration-watchdog',knowledgeCache:'cwknowledge-school-seeds-v2',settingsPresentation:'cleanroom-v188',nativeDialog:false,legacySettingsCapture:false,settingsMutationObserver:false,settingsPolling:false,settingsTimers:false,settingsDiagnosticsRuntime:false,transformerActive:false,providerRuntimeOnOpen:false,providerTestsAvailable:false,singlePassOpen:true,migrationOnDemand:false};
})();