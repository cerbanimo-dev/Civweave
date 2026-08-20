(()=>{
'use strict';
const VERSION='1.0.15-model-settings-controller-v173-gemma4-retry-import';
const GEMMA4_DEEP_VERSION='1.0.0-gemma4-e4b-q4-extension-v1';
const GEMMA4_DEEP_SRC='/app/local-ai/gemma4-e4b-q4-extension-v1.js?v=1.0.0-e4b-q4-deep';
const GEMMA4_PACK_VERSION='1.0.1-gemma4-pack-extension-v1-render-safe';
const GEMMA4_PACK_SRC='/app/local-ai/gemma4-pack-extension-v1.js?v=1.0.1-render-safe';
const GEMMA4_ACTIONS_VERSION='1.1.0-gemma4-dual-q4-actions-v1-retry-import';
const GEMMA4_ACTIONS_SRC='/app/local-ai/gemma4-dual-q4-actions-v1.js?v=1.1.0-retry-import';
if(globalThis.CivweaveModelSettingsControllerV173?.version===VERSION)return;
const canonical=()=>globalThis.CivweaveSettingsV320||null;
function open(launcher){return canonical()?.open?.(launcher)||null}
function close(reason){return canonical()?.close?.(reason)||false}
function ensure(){return canonical()?.ensure?.()||Promise.resolve(false)}
function readState(){return canonical()?.readState?.()||{route:'deterministic',provider:'deterministic'}}
function credentialStatus(){return canonical()?.credentialStatus?.()||{remembered:false,session:false,mode:'session'}}
function loadScript(src,ready,label){
  if(ready())return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const target=new URL(src,location.href).href;
    let script=[...document.scripts].find(row=>row.src===target);
    const finish=()=>ready()?resolve(true):reject(new Error(`${label} loaded without becoming ready.`));
    if(script){
      script.addEventListener('load',finish,{once:true});
      script.addEventListener('error',()=>reject(new Error(`${label} could not load.`)),{once:true});
      queueMicrotask(()=>{if(ready())resolve(true)});
      return;
    }
    script=document.createElement('script');
    script.src=src;
    script.async=false;
    script.dataset.civweaveGemma4Pack=label;
    script.onload=finish;
    script.onerror=()=>reject(new Error(`${label} could not load.`));
    document.head?.append(script);
  });
}
let packLoadPromise=null;
function ensureGemma4Pack(){
  const deepReady=()=>globalThis.CivweaveGemma4E4BQ4ExtensionV1?.version===GEMMA4_DEEP_VERSION;
  const packReady=()=>globalThis.CivweaveGemma4PackExtensionV1?.version===GEMMA4_PACK_VERSION;
  const actionsReady=()=>globalThis.CivweaveGemma4DualQ4ActionsV1?.version===GEMMA4_ACTIONS_VERSION;
  if(deepReady()&&packReady()&&actionsReady()){
    globalThis.CivweaveGemma4E4BQ4ExtensionV1?.activate?.();
    globalThis.CivweaveGemma4DualQ4ActionsV1?.scheduleDecorate?.();
    return true;
  }
  if(packLoadPromise)return true;
  packLoadPromise=loadScript(GEMMA4_DEEP_SRC,deepReady,'gemma4-e4b-q4-deep')
    .then(()=>loadScript(GEMMA4_PACK_SRC,packReady,'gemma4-q4-core-q2-optional-render-safe'))
    .then(()=>{globalThis.CivweaveGemma4E4BQ4ExtensionV1?.activate?.();return loadScript(GEMMA4_ACTIONS_SRC,actionsReady,'gemma4-dual-q4-actions')})
    .then(()=>{globalThis.CivweaveGemma4E4BQ4ExtensionV1?.activate?.();globalThis.CivweaveGemma4DualQ4ActionsV1?.scheduleDecorate?.();return true})
    .catch(error=>{console.warn('[Civweave] Gemma 4 dual-Q4 pack extension failed to load.',error);return false})
    .finally(()=>{packLoadPromise=null});
  return true;
}
ensureGemma4Pack();
addEventListener('pageshow',()=>queueMicrotask(ensureGemma4Pack));
const api=Object.freeze({version:VERSION,compatibilityFacade:true,canonical:'CivweaveSettingsV320',authority:'settings-v320',open,close,ensure,readState,credentialStatus,ensureGemma4Pack,gemma4PackCore:'q4f16',gemma4FastModel:'gemma4-e2b-it-q4f16',gemma4DeepModel:'gemma4-e4b-it-q4f16',gemma4IndependentUse:true,gemma4Q2OptionalExtension:true,gemma4RenderLoopSafe:true,gemma4BrowserRetry:true,gemma4BrowserImport:true,inputOwnership:false,presentationOwnership:false,credentialOwnership:false,domCreation:false,activationRequired:false,legacySettingsCapture:false,providerRuntimeOnOpen:false,quiescenceAfterPaint:true});
globalThis.CivweaveModelSettingsControllerV173=api;
globalThis.CivweaveModelSettingsControllerBootstrapV173=Object.freeze({version:VERSION,dormant:true,canonical:'CivweaveSettingsV320',gemma4DeepExtension:GEMMA4_DEEP_SRC,gemma4DeepVersion:GEMMA4_DEEP_VERSION,gemma4PackExtension:GEMMA4_PACK_SRC,gemma4PackVersion:GEMMA4_PACK_VERSION,gemma4Actions:GEMMA4_ACTIONS_SRC,gemma4ActionsVersion:GEMMA4_ACTIONS_VERSION});
})();
