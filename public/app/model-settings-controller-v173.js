(()=>{
'use strict';
const VERSION='1.0.11-model-settings-controller-v173-gemma4-pack-core';
const GEMMA4_PACK_SRC='/app/local-ai/gemma4-pack-extension-v1.js?v=1.0.0-q4-core-q2-optional';
if(globalThis.CivweaveModelSettingsControllerV173?.version===VERSION)return;
const canonical=()=>globalThis.CivweaveSettingsV320||null;
function open(launcher){return canonical()?.open?.(launcher)||null}
function close(reason){return canonical()?.close?.(reason)||false}
function ensure(){return canonical()?.ensure?.()||Promise.resolve(false)}
function readState(){return canonical()?.readState?.()||{route:'deterministic',provider:'deterministic'}}
function credentialStatus(){return canonical()?.credentialStatus?.()||{remembered:false,session:false,mode:'session'}}
function ensureGemma4Pack(){
  if(globalThis.CivweaveGemma4PackExtensionV1?.version==='1.0.0-gemma4-pack-extension-v1')return true;
  const path=new URL(GEMMA4_PACK_SRC,location.href).pathname;
  if([...document.scripts].some(script=>{try{return new URL(script.src,location.href).pathname===path}catch{return false}}))return false;
  const script=document.createElement('script');
  script.src=GEMMA4_PACK_SRC;
  script.async=false;
  script.dataset.civweaveGemma4Pack='q4-core-q2-optional';
  script.onerror=()=>console.warn('[Civweave] Gemma 4 pack extension failed to load.');
  document.head?.append(script);
  return true;
}
ensureGemma4Pack();
addEventListener('pageshow',()=>queueMicrotask(ensureGemma4Pack));
const api=Object.freeze({version:VERSION,compatibilityFacade:true,canonical:'CivweaveSettingsV320',authority:'settings-v320',open,close,ensure,readState,credentialStatus,ensureGemma4Pack,gemma4PackCore:'q4f16',gemma4Q2OptionalExtension:true,inputOwnership:false,presentationOwnership:false,credentialOwnership:false,domCreation:false,activationRequired:false,legacySettingsCapture:false,providerRuntimeOnOpen:false,quiescenceAfterPaint:true});
globalThis.CivweaveModelSettingsControllerV173=api;
globalThis.CivweaveModelSettingsControllerBootstrapV173=Object.freeze({version:VERSION,dormant:true,canonical:'CivweaveSettingsV320',gemma4PackExtension:GEMMA4_PACK_SRC});
})();
