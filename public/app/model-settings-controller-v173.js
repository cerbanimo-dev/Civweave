(()=>{
'use strict';
const VERSION='1.0.11-model-settings-controller-v173-home-declutter-v1';
const HOME_DECLUTTER='/app/working-campus-home-declutter-v1.js?v=1.0.0';
if(globalThis.CivweaveModelSettingsControllerV173?.version===VERSION)return;
const canonical=()=>globalThis.CivweaveSettingsV320||null;
function open(launcher){return canonical()?.open?.(launcher)||null}
function close(reason){return canonical()?.close?.(reason)||false}
function ensure(){return canonical()?.ensure?.()||Promise.resolve(false)}
function readState(){return canonical()?.readState?.()||{route:'deterministic',provider:'deterministic'}}
function credentialStatus(){return canonical()?.credentialStatus?.()||{remembered:false,session:false,mode:'session'}}
function ensureHomeDeclutter(){
  if(location.pathname!=='/app/working-campus-v156.html')return false;
  if(globalThis.CivweaveHomeDeclutterV1)return true;
  if(document.querySelector('script[data-cw-home-declutter-v1]'))return true;
  const script=document.createElement('script');
  script.src=HOME_DECLUTTER;
  script.async=false;
  script.dataset.cwHomeDeclutterV1='';
  (document.head||document.documentElement).append(script);
  return true;
}
const api=Object.freeze({version:VERSION,compatibilityFacade:true,canonical:'CivweaveSettingsV320',authority:'settings-v320',open,close,ensure,readState,credentialStatus,inputOwnership:false,presentationOwnership:false,credentialOwnership:false,domCreation:false,activationRequired:false,legacySettingsCapture:false,providerRuntimeOnOpen:false,quiescenceAfterPaint:true,homeDeclutterLoader:true});
globalThis.CivweaveModelSettingsControllerV173=api;
globalThis.CivweaveModelSettingsControllerBootstrapV173=Object.freeze({version:VERSION,dormant:true,canonical:'CivweaveSettingsV320'});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureHomeDeclutter,{once:true});else ensureHomeDeclutter();
})();
