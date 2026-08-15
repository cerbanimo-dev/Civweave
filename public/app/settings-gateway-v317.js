(()=>{
'use strict';
const VERSION='1.0.160-settings-gateway-static-v1';
const SELECTOR='[data-open-unified-ai-settings]';
const CONTROLLER='/app/model-settings-controller-v173.js?activate=1&v=1.0.160-interface-runtime-v1';
const INPUT_SLOT='__civweaveSettingsGatewayCaptureV1';
const MANAGEMENT=[
  ['/app/local-ai/model-registry-v266.js?v=1.0.87-v287-coherence-v288',()=>Boolean(globalThis.CivweaveLocalModelRegistryV266?.installable&&globalThis.CivweaveLocalModelRegistryV266?.byId)],
  ['/app/local-ai/download-manager-v267.js?v=1.0.67-v271',()=>Boolean(globalThis.CivweaveLocalModelDownloadV266?.status&&globalThis.CivweaveLocalModelDownloadV266?.selection)],
  ['/app/local-ai/download-policy-v278.js?v=1.0.81-v278',()=>globalThis.CivweaveLocalModelDownloadV266?.largeExternalDataForeground===true],
  ['/app/local-ai/metadata-repair-v276.js?v=1.0.81-v277',()=>globalThis.CivweaveLocalModelDownloadV266?.metadataOnlyRepair===true],
  ['/app/local-ai/settings-panel-v267.js?v=1.0.116-v305-download-dock-layout',()=>Boolean(globalThis.CivweaveLocalAISettingsV266?.enhance)],
  ['/app/local-ai/primary-route-v283.js?v=1.0.88-v283',()=>Boolean(globalThis.CivweaveLocalAIPrimaryRouteV283)],
  ['/app/local-ai/hardware-tier-ui-v278.js?v=1.0.81-v278-settings-stability-v318',()=>Boolean(globalThis.CivweaveLocalModelHardwareTierUIV278?.deviceFitRecommendations)]
];
if(globalThis.CivweaveSettingsGatewayV317?.version===VERSION)return;
let compatibilityControllerPromise=null,managementPromise=null;
function append(src,ready,label){
  if(ready?.())return Promise.resolve(true);
  const pathname=new URL(src,location.href).pathname,existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===pathname);
  if(existing)return new Promise((resolve,reject)=>{const started=Date.now(),timer=setInterval(()=>{if(ready?.()){clearInterval(timer);resolve(true)}else if(Date.now()-started>8000){clearInterval(timer);reject(new Error(`${label} did not become ready.`))}},40)});
  return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.dataset.civweaveExplicitSettingsAction='1';const timer=setTimeout(()=>{script.remove();reject(new Error(`${label} timed out.`))},8000);script.onload=()=>{clearTimeout(timer);ready?.()?resolve(true):reject(new Error(`${label} loaded without becoming ready.`))};script.onerror=()=>{clearTimeout(timer);reject(new Error(`${label} could not load.`))};document.head.append(script)});
}
function loadLegacyController(){if(globalThis.CivweaveModelSettingsControllerV173?.open)return Promise.resolve(globalThis.CivweaveModelSettingsControllerV173);if(compatibilityControllerPromise)return compatibilityControllerPromise;compatibilityControllerPromise=append(CONTROLLER,()=>Boolean(globalThis.CivweaveModelSettingsControllerV173?.open),'Settings controller').then(()=>globalThis.CivweaveModelSettingsControllerV173).finally(()=>{compatibilityControllerPromise=null});return compatibilityControllerPromise}
async function ensureManagement(layer){if(managementPromise)return managementPromise;managementPromise=(async()=>{for(const [src,ready] of MANAGEMENT)await append(src,ready,'Local AI management');const panel=globalThis.CivweaveLocalAISettingsV266?.enhance?.()||null;globalThis.CivweaveLocalModelHardwareTierUIV278?.decorate?.();return panel})().catch(error=>{console.error('[Civweave Settings] Local AI management failed.',error);const button=layer?.querySelector?.('[data-cw-local-ai-manage]');if(button){button.disabled=false;button.textContent='Local AI management unavailable'}return null}).finally(()=>{managementPromise=null});return managementPromise}
function mountExplicitManagementAction(layer){if(!layer?.isConnected||layer.querySelector('[data-cw-local-ai-manage]'))return;const host=layer.querySelector('[data-content]')||layer.querySelector('main')||layer,section=document.createElement('section');section.className='cw-ai-settings-row';section.innerHTML='<div><b>Downloaded local AI</b><small>Model files and device-fit tools stay dormant until you open them.</small></div><button type="button" data-cw-local-ai-manage>Manage local AI</button>';const button=section.querySelector('[data-cw-local-ai-manage]');button.addEventListener('click',async()=>{button.disabled=true;button.textContent='Opening local AI…';const panel=await ensureManagement(layer);if(panel){button.textContent='Local AI open';button.hidden=true}else button.disabled=false});host.append(section)}
async function open(launcher){try{const controller=globalThis.CivweaveModelSettingsControllerV173?.open?globalThis.CivweaveModelSettingsControllerV173:await loadLegacyController(),layer=controller.open(launcher);if(!layer)return null;globalThis.CivweaveLanguageSettingsV1?.mount?.(layer);mountExplicitManagementAction(layer);return layer}catch(error){console.error('[Civweave Settings]',error);try{dispatchEvent(new CustomEvent('civweave:model-settings-open-failed',{detail:{version:VERSION,message:String(error?.message||error)}}))}catch{}return null}}
function onClick(event){const target=event.target instanceof Element?event.target.closest(SELECTOR):null;if(!target||target.closest('#cw-ai-settings-cleanroom-v188'))return;event.preventDefault();event.stopImmediatePropagation();void open(target)}
const previous=globalThis[INPUT_SLOT];if(previous&&typeof previous==='function')document.removeEventListener('click',previous,true);document.addEventListener('click',onClick,true);globalThis[INPUT_SLOT]=onClick;
globalThis.CivweaveSettingsGatewayV317=Object.freeze({version:VERSION,selector:SELECTOR,open,ensureManagement,inputOwner:true,launchWork:'none',generativeRuntimeOnOpen:false,workingCampusStaticController:true,legacyRouteControllerFallback:true,managementActivation:'explicit-secondary-action',reloadSafeCapture:true});
try{dispatchEvent(new CustomEvent('civweave:settings-gateway-ready',{detail:{version:VERSION,selector:SELECTOR,inputOwner:'settings-gateway-v317'}}))}catch{}
})();
