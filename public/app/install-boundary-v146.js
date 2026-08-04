(()=>{
'use strict';
const INSTALLER='/';
const DEV_KEY='commonweave.install-boundary.developer.v146';
const ADDITIONS_SCRIPT='/extensions/commonweave-additions-v156.js';
const ADDITIONS_STYLE='/extensions/commonweave-additions-v156.css';
const DEVICE_CREDENTIALS_SCRIPT='/extensions/commonweave-device-credentials-v160.js';
const MODEL_DOWNLOAD_SCRIPT='/extensions/commonweave-model-download-v157.js';
const PROOF_PROGRESS_SCRIPT='/extensions/commonweave-proof-progress-v158.js';
const GEMINI_INTERACTIONS_SCRIPT='/extensions/commonweave-gemini-interactions-v159.js';
const PREVIOUS_ADDITIONS_VERSION='v164-latest-intention-agentic-research-hud-stability';
const FAST_CORE_COMPATIBILITY_REVISION='v157-fast-core';
const SETTINGS_STABILITY_REVISION='v161-settings-dialog-stability';
const INTENTION_RESEARCH_REVISION='v163-latest-intention-agentic-research';
const HUD_STABILITY_REVISION='v164-hud-observer-stability';
const WORKFLOW_HANDOFF_REVISION='v165-reviewed-merlin-rook-proof-attachments';
// Compatibility marker: settings-dialog-stability-v161
// Compatibility marker: additionsVersion:'v161-settings-dialog-stability'
// Compatibility marker: additionsVersion:'v160-device-credentials'
// Compatibility marker: additionsVersion:'v163-latest-intention-agentic-research'
const params=new URLSearchParams(location.search);
function installedDisplay(){
  return navigator.standalone===true
    ||matchMedia('(display-mode: standalone)').matches
    ||matchMedia('(display-mode: fullscreen)').matches
    ||matchMedia('(display-mode: minimal-ui)').matches
    ||matchMedia('(display-mode: window-controls-overlay)').matches;
}
function localhost(){return ['localhost','127.0.0.1','::1'].includes(location.hostname)}
function developer(){
  if(localhost()&&params.get('developer')==='1'){sessionStorage.setItem(DEV_KEY,'1');return true}
  return localhost()&&sessionStorage.getItem(DEV_KEY)==='1';
}
function embedded(){try{return window.top!==window.self}catch{return true}}
function allowed(){return installedDisplay()||developer()||embedded()}
function installerUrl(){
  const target=`${location.pathname}${location.search}${location.hash}`;
  const next=new URL(INSTALLER,location.origin);
  next.searchParams.set('install','required');
  next.searchParams.set('next',target.slice(0,1800));
  return next.href;
}
function addScript(src){if(document.querySelector(`script[src^="${src}"]`))return;const script=document.createElement('script');script.src=`${src}?v=reviewed-merlin-rook-proof-attachments-v165`;script.defer=true;document.head.append(script)}
function installAdditions(){
  if(!document.querySelector(`link[href^="${ADDITIONS_STYLE}"]`)){
    const link=document.createElement('link');link.rel='stylesheet';link.href=`${ADDITIONS_STYLE}?v=reviewed-merlin-rook-proof-attachments-v165`;document.head.append(link);
  }
  addScript(DEVICE_CREDENTIALS_SCRIPT);
  addScript(ADDITIONS_SCRIPT);
  addScript(MODEL_DOWNLOAD_SCRIPT);
  addScript(PROOF_PROGRESS_SCRIPT);
  addScript(GEMINI_INTERACTIONS_SCRIPT);
}
if(!allowed()){
  document.documentElement.dataset.installBoundary='blocked';
  location.replace(installerUrl());
}else{
  document.documentElement.dataset.installBoundary=installedDisplay()?'installed':developer()?'developer':'embedded';
  installAdditions();
}
globalThis.CommonweaveInstallBoundaryV146={allowed,installedDisplay,developer,embedded,installerUrl,installAdditions,additionsVersion:'v165-reviewed-merlin-rook-proof-attachments',previousAdditionsVersion:PREVIOUS_ADDITIONS_VERSION,fastCoreCompatibilityRevision:FAST_CORE_COMPATIBILITY_REVISION,settingsStabilityRevision:SETTINGS_STABILITY_REVISION,intentionResearchRevision:INTENTION_RESEARCH_REVISION,hudStabilityRevision:HUD_STABILITY_REVISION,workflowHandoffRevision:WORKFLOW_HANDOFF_REVISION};
})();