(()=>{
'use strict';
const VERSION='175.0-deterministic-single-authority-controller';
if(globalThis.CommonweaveModelSettingsControllerV173?.version===VERSION)return;
const STYLE='/app/model-settings-v133.css?v=deterministic-settings-v175';
const DEPENDENCIES=[
  ['/app/shared/commonweave-model-runtime.js?v=deterministic-settings-v175',()=>globalThis.CommonweaveModelRuntime],
  ['/app/unified-ai-settings-v175.js?v=deterministic-settings-v175',()=>globalThis.CommonweaveUnifiedAISettingsV175]
];
let ensurePromise=null,openPromise=null;
function mark(state,message=''){
  document.documentElement.dataset.settingsOpenState=state;
  if(message)document.documentElement.dataset.settingsOpenMessage=String(message).slice(0,240);
  else delete document.documentElement.dataset.settingsOpenMessage;
}
function addStyle(){
  if(document.querySelector('link[data-cw175-settings-style]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=STYLE;link.dataset.cw175SettingsStyle='';document.head.append(link);
}
function waitForReady(ready,pathname,timeoutMs=8000){
  return new Promise((resolve,reject)=>{const started=Date.now();const tick=()=>{if(ready?.())return resolve(true);if(Date.now()-started>=timeoutMs)return reject(new Error(`${pathname} did not become ready`));setTimeout(tick,50)};tick()});
}
function loadScript(src,ready){
  if(ready?.())return Promise.resolve(true);
  const pathname=new URL(src,location.href).pathname;
  const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===pathname);
  if(existing)return waitForReady(ready,pathname);
  return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.dataset.cw175SettingsDependency='';const timer=setTimeout(()=>finish(new Error(`${pathname} timed out`)),8000);function finish(error){clearTimeout(timer);if(error){script.remove();reject(error)}else resolve(true)}script.onload=()=>ready?.()?finish():finish(new Error(`${pathname} loaded without its runtime`));script.onerror=()=>finish(new Error(`Could not load ${pathname}`));document.head.append(script)});
}
async function ensure(){
  if(globalThis.CommonweaveUnifiedAISettingsV175)return true;
  if(ensurePromise)return ensurePromise;
  ensurePromise=(async()=>{addStyle();for(const [src,ready] of DEPENDENCIES)await loadScript(src,ready);globalThis.CommonweaveUnifiedAISettingsV175.migrateDeterministicDefault?.();return true})().catch(error=>{ensurePromise=null;throw error});
  return ensurePromise;
}
async function open(){
  if(openPromise)return openPromise;
  mark('opening');
  openPromise=(async()=>{await ensure();const runtime=globalThis.CommonweaveUnifiedAISettingsV175;if(!runtime?.open)throw new Error('The unified Commonweave AI settings surface did not become ready.');const dialog=runtime.open();mark('open');return dialog})().catch(error=>{mark('error',error.message);dispatchEvent(new CustomEvent('commonweave:model-settings-error',{detail:{version:VERSION,message:error.message}}));throw error}).finally(()=>{openPromise=null});
  return openPromise;
}
async function renderInline(target){await ensure();return globalThis.CommonweaveUnifiedAISettingsV175.renderInline(target)}
const facade={version:`${VERSION}-facade`,open,ensure,renderInline};
if(!globalThis.CommonweaveModelSettingsV133)globalThis.CommonweaveModelSettingsV133=facade;
mark('ready');
globalThis.CommonweaveModelSettingsControllerV173=Object.freeze({version:VERSION,authority:'CommonweaveUnifiedAISettingsV175',defaultRoute:'deterministic',transformerActive:false,open,ensure,renderInline,facade,settingsFacade:facade});
})();
