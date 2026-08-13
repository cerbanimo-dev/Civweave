(()=>{
'use strict';
const VERSION='document-lifecycle-v317-management-only';
const REVISION='document-lifecycle-v317-explicit-activation';
const ACTIVATED=(()=>{try{return new URL(document.currentScript?.src||'',location.href).searchParams.get('activate')==='1'}catch{return false}})();
if(!ACTIVATED){globalThis.CivweaveDocumentLifecycleBootstrapV221=Object.freeze({version:VERSION,dormant:true,activation:'settings-gateway-v317'});return}
if(globalThis.CivweaveDocumentLifecycleV221?.revision===REVISION)return;
let active=true,managementPromise=null;
const LOCAL_AI_MANAGEMENT_FILES=[
  ['/app/local-ai/model-registry-v266.js?v=1.0.87-v287-coherence-v288',()=>Boolean(globalThis.CivweaveLocalModelRegistryV266?.installable&&globalThis.CivweaveLocalModelRegistryV266?.byId)],
  ['/app/local-ai/download-manager-v267.js?v=1.0.67-v271',()=>Boolean(globalThis.CivweaveLocalModelDownloadV266?.status&&globalThis.CivweaveLocalModelDownloadV266?.selection&&globalThis.CivweaveLocalModelDownloadV266?.state)],
  ['/app/local-ai/download-policy-v278.js?v=1.0.81-v278',()=>globalThis.CivweaveLocalModelDownloadV266?.largeExternalDataForeground===true],
  ['/app/local-ai/metadata-repair-v276.js?v=1.0.81-v277',()=>globalThis.CivweaveLocalModelDownloadV266?.metadataOnlyRepair===true&&globalThis.CivweaveLocalModelDownloadV266?.metadataRepairRaceSafe===true],
  ['/app/local-ai/settings-panel-v267.js?v=1.0.116-v305-download-dock-layout',()=>Boolean(globalThis.CivweaveLocalAISettingsV266?.enhance&&globalThis.CivweaveLocalAISettingsV266?.openPath==='snapshot-first-v287')],
  ['/app/local-ai/primary-route-v283.js?v=1.0.88-v283',()=>globalThis.CivweaveLocalAIPrimaryRouteV283?.version==='1.0.85-local-ai-primary-route-v283'],
  ['/app/local-ai/hardware-tier-ui-v278.js?v=1.0.81-v278',()=>Boolean(globalThis.CivweaveLocalModelHardwareTierUIV278?.deviceFitRecommendations)]
];
function afterPaint(task){const run=()=>setTimeout(task,0);if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else setTimeout(task,0)}
function ensureScript(src,ready){if(ready?.())return Promise.resolve(true);return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.dataset.civweaveSettingsManagement='v317';const timer=setTimeout(()=>reject(new Error(`${src} did not become ready.`)),8000);script.onload=()=>{clearTimeout(timer);ready?.()?resolve(true):reject(new Error(`${src} loaded without becoming ready.`))};script.onerror=()=>{clearTimeout(timer);reject(new Error(`${src} could not load.`))};if(!active||!document.head?.isConnected){clearTimeout(timer);reject(new Error('Document is leaving.'));return}document.head.append(script)})}
function managementReady(){return Boolean(
  globalThis.CivweaveLocalAISettingsV266?.enhance&&
  globalThis.CivweaveLocalModelDownloadV266?.status&&
  globalThis.CivweaveLocalModelDownloadV266?.largeExternalDataForeground===true&&
  globalThis.CivweaveLocalModelDownloadV266?.metadataOnlyRepair===true&&
  globalThis.CivweaveLocalModelDownloadV266?.metadataRepairRaceSafe===true&&
  globalThis.CivweaveLocalModelRegistryV266?.installable&&
  globalThis.CivweaveLocalAIPrimaryRouteV283&&
  globalThis.CivweaveLocalModelHardwareTierUIV278?.deviceFitRecommendations===true
)}
function enhance(layer=document.getElementById('cw-ai-settings-cleanroom-v188')){if(!active||!layer?.isConnected||layer.hidden)return null;const panel=globalThis.CivweaveLocalAISettingsV266?.enhance?.()||null;globalThis.CivweaveLocalModelHardwareTierUIV278?.decorate?.();return panel}
function ensureLocalAISettingsManagement(){if(!active)return Promise.resolve(false);if(managementReady()){enhance();return Promise.resolve(true)}if(managementPromise)return managementPromise;managementPromise=(async()=>{for(const [src,ready] of LOCAL_AI_MANAGEMENT_FILES)await ensureScript(src,ready);if(!managementReady())throw new Error('Downloaded local AI management did not become ready.');enhance();return true})().catch(error=>{try{dispatchEvent(new CustomEvent('civweave:local-ai-settings-unavailable',{detail:{version:VERSION,revision:REVISION,message:String(error?.message||error)}}))}catch{}return false}).finally(()=>{managementPromise=null});return managementPromise}
function scheduleSettingsManagement(layer=document.getElementById('cw-ai-settings-cleanroom-v188')){if(!active||!layer?.isConnected||layer.hidden)return false;const epoch=String(layer.dataset.openedAt||'visible');if(layer.dataset.civweaveLifecycleManagementEpoch===epoch)return true;layer.dataset.civweaveLifecycleManagementEpoch=epoch;afterPaint(()=>{if(active&&layer.isConnected&&!layer.hidden)void ensureLocalAISettingsManagement()});return true}
function stopOnPageHide(event){if(!event?.persisted)active=false}
function revive(){active=true;const layer=document.getElementById('cw-ai-settings-cleanroom-v188');if(layer&&!layer.hidden)scheduleSettingsManagement(layer);return true}
addEventListener('pagehide',stopOnPageHide);addEventListener('pageshow',revive);addEventListener('beforeunload',()=>{active=false},{once:true});
globalThis.CivweaveDocumentLifecycleV221=Object.freeze({version:VERSION,revision:REVISION,active:()=>active,ensureLocalAISettingsManagement,scheduleSettingsManagement,managementReady,enhance,settingsEntryOwner:'settings-gateway-v317',inputOwnership:false,managementAfterPaint:true,globalObserverPatch:false,activationRequired:true,launchWork:'none',deviceFitManagement:true,completeManagementReadiness:true});
})();
