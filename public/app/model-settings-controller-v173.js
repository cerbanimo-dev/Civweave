(()=>{
'use strict';
const VERSION='1.0.22-model-settings-controller-v173-passive-gemma-opfs-stream-actions';
const GEMMA4_DEEP_VERSION='1.0.0-gemma4-e4b-q4-extension-v1';
const GEMMA4_DEEP_SRC='/app/local-ai/gemma4-e4b-q4-extension-v1.js?v=1.0.0-e4b-q4-deep';
const GEMMA4_PACK_VERSION='1.0.1-gemma4-pack-extension-v1-render-safe';
const GEMMA4_PACK_SRC='/app/local-ai/gemma4-pack-extension-v1.js?v=1.0.1-render-safe';
const GEMMA4_ACTIONS_VERSION='1.1.0-gemma4-dual-q4-actions-v1-retry-import';
const GEMMA4_ACTIONS_SRC='/app/local-ai/gemma4-dual-q4-actions-v1.js?v=1.1.0-retry-import';
const GEMMA4_FAST_VERSION='1.1.1-gemma4-litert-fast-extension-v1-browser-handoff-guard';
const GEMMA4_FAST_SRC='/app/local-ai/gemma4-litert-fast-extension-v1.js?v=1.1.1-browser-handoff-guard';
const GEMMA4_PHONE_VERSION='1.2.0-gemma4-phone-performance-core-v1-resume-authority';
const GEMMA4_PHONE_SRC='/app/local-ai/gemma4-phone-performance-core-v1.js?v=1.2.0-resume-authority';
const GEMMA4_Q2_RETIRE_VERSION='1.0.0-gemma4-q2-retirement-v1';
const GEMMA4_Q2_RETIRE_SRC='/app/local-ai/gemma4-q2-retirement-v1.js?v=1.0.0-q2-retirement';
const GEMMA4_BROWSER_PACK_VERSION='1.0.1-gemma4-browser-pack-coherence-v1-status-sync';
const GEMMA4_BROWSER_PACK_SRC='/app/local-ai/gemma4-browser-pack-coherence-v1.js?v=1.0.1-status-sync';
const GEMMA4_OPFS_VERSION='1.0.1-gemma4-opfs-storage-v1-stream-transfer';
const GEMMA4_OPFS_SRC='/app/local-ai/gemma4-opfs-storage-v1.js?v=1.0.1-opfs-stream-transfer';
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
    const target=new URL(src,location.href),path=target.pathname;
    let script=[...document.scripts].find(row=>{try{return new URL(row.src,location.href).pathname===path}catch{return false}});
    const finish=()=>ready()?resolve(true):reject(new Error(`${label} loaded without becoming ready.`));
    if(script&&!ready())try{script.remove()}catch{}
    if(ready())return resolve(true);
    script=document.createElement('script');
    script.src=`${src}${src.includes('?')?'&':'?'}cwSettingsGemma4=${Date.now()}`;
    script.async=false;
    script.dataset.civweaveGemma4Pack=label;
    script.onload=finish;
    script.onerror=()=>reject(new Error(`${label} could not load.`));
    document.head?.append(script);
  });
}
let packLoadPromise=null;
function ensureGemma4Pack(){
  const packReady=()=>globalThis.CivweaveGemma4PackExtensionV1?.version===GEMMA4_PACK_VERSION;
  const deepReady=()=>globalThis.CivweaveGemma4E4BQ4ExtensionV1?.version===GEMMA4_DEEP_VERSION;
  const actionsReady=()=>globalThis.CivweaveGemma4DualQ4ActionsV1?.version===GEMMA4_ACTIONS_VERSION;
  const fastReady=()=>globalThis.CivweaveGemma4LiteRTFastExtensionV1?.version===GEMMA4_FAST_VERSION;
  const phoneReady=()=>globalThis.CivweaveGemma4PhonePerformanceCoreV1?.version===GEMMA4_PHONE_VERSION;
  const retireReady=()=>globalThis.CivweaveGemma4Q2RetirementV1?.version===GEMMA4_Q2_RETIRE_VERSION;
  const browserPackReady=()=>globalThis.CivweaveGemma4BrowserPackCoherenceV1?.version===GEMMA4_BROWSER_PACK_VERSION;
  const opfsReady=()=>globalThis.CivweaveGemma4OPFSStorageV1?.version===GEMMA4_OPFS_VERSION;
  if(packReady()&&deepReady()&&actionsReady()&&fastReady()&&phoneReady()&&retireReady()&&browserPackReady()&&opfsReady()){
    globalThis.CivweaveGemma4E4BQ4ExtensionV1?.activate?.();
    globalThis.CivweaveGemma4PhonePerformanceCoreV1?.activate?.();
    globalThis.CivweaveGemma4DualQ4ActionsV1?.scheduleDecorate?.();
    globalThis.CivweaveGemma4Q2RetirementV1?.scheduleDecorate?.();
    globalThis.CivweaveGemma4BrowserPackCoherenceV1?.scheduleDecorate?.();
    return Promise.resolve(true);
  }
  if(packLoadPromise)return packLoadPromise;
  packLoadPromise=loadScript(GEMMA4_PACK_SRC,packReady,'gemma4-q4-compatibility-core')
    .then(()=>loadScript(GEMMA4_DEEP_SRC,deepReady,'gemma4-e4b-q4-compatibility'))
    .then(()=>loadScript(GEMMA4_ACTIONS_SRC,actionsReady,'gemma4-dual-q4-actions'))
    .then(()=>loadScript(GEMMA4_FAST_SRC,fastReady,'gemma4-litert-current-mobile-models'))
    .then(()=>loadScript(GEMMA4_PHONE_SRC,phoneReady,'gemma4-current-phone-pack-authority'))
    .then(()=>loadScript(GEMMA4_Q2_RETIRE_SRC,retireReady,'gemma4-q2-retirement'))
    .then(()=>loadScript(GEMMA4_BROWSER_PACK_SRC,browserPackReady,'gemma4-browser-pack-coherence'))
    .then(()=>loadScript(GEMMA4_OPFS_SRC,opfsReady,'gemma4-opfs-large-model-storage'))
    .then(()=>{
      globalThis.CivweaveGemma4E4BQ4ExtensionV1?.activate?.();
      globalThis.CivweaveGemma4PhonePerformanceCoreV1?.activate?.();
      globalThis.CivweaveGemma4DualQ4ActionsV1?.scheduleDecorate?.();
      globalThis.CivweaveGemma4Q2RetirementV1?.scheduleDecorate?.();
      globalThis.CivweaveGemma4BrowserPackCoherenceV1?.scheduleDecorate?.();
      return true;
    })
    .catch(error=>{console.warn('[Civweave] Gemma 4 current phone pack failed to load.',error);return false})
    .finally(()=>{packLoadPromise=null});
  return packLoadPromise;
}
// Settings is a saved-state view. Gemma compatibility/runtime/storage code is
// available through ensureGemma4Pack() for an explicit model action, but must
// never hydrate merely because Settings loaded, reopened, or received pageshow.
const api=Object.freeze({
  version:VERSION,
  compatibilityFacade:true,
  canonical:'CivweaveSettingsV320',
  authority:'settings-v320',
  open,close,ensure,readState,credentialStatus,ensureGemma4Pack,
  gemma4PackCore:'litert-current+q4-compatibility',
  gemma4FastModel:'gemma4-e2b-it-litert-web',
  gemma4DeepModel:'gemma4-e4b-it-litert-web',
  gemma4CompatibilityModels:Object.freeze(['gemma4-e2b-it-q4f16','gemma4-e4b-it-q4f16']),
  gemma4RetiredModels:Object.freeze(['gemma4-e2b-it-q2f16-mobile','gemma4-e4b-it-q2f16-mobile']),
  gemma4IndependentUse:true,
  gemma4Q2OptionalExtension:false,
  gemma4Q2Retired:true,
  gemma4ObsoleteDeleteAction:true,
  gemma4MaxVariantsPerSize:2,
  gemma4RenderLoopSafe:true,
  gemma4BrowserRetry:true,
  gemma4BrowserImport:true,
  gemma4BrowserManagedLiteRT:true,
  gemma4MidrangeUsesLiteRT:true,
  gemma4PostImportStatusSync:true,
  gemma4DownloadHandoffAwaitable:true,
  gemma4OPFSLargeModels:true,
  gemma4CacheStorageLargePut:false,
  gemma4PassivePreload:false,
  inputOwnership:false,presentationOwnership:false,credentialOwnership:false,domCreation:false,activationRequired:false,legacySettingsCapture:false,providerRuntimeOnOpen:false,quiescenceAfterPaint:true
});
globalThis.CivweaveModelSettingsControllerV173=api;
globalThis.CivweaveModelSettingsControllerBootstrapV173=Object.freeze({
  version:VERSION,dormant:true,canonical:'CivweaveSettingsV320',passiveGemmaHydration:false,
  gemma4PackExtension:GEMMA4_PACK_SRC,gemma4PackVersion:GEMMA4_PACK_VERSION,
  gemma4DeepExtension:GEMMA4_DEEP_SRC,gemma4DeepVersion:GEMMA4_DEEP_VERSION,
  gemma4Actions:GEMMA4_ACTIONS_SRC,gemma4ActionsVersion:GEMMA4_ACTIONS_VERSION,
  gemma4FastExtension:GEMMA4_FAST_SRC,gemma4FastVersion:GEMMA4_FAST_VERSION,
  gemma4PhoneAuthority:GEMMA4_PHONE_SRC,gemma4PhoneVersion:GEMMA4_PHONE_VERSION,
  gemma4Q2Retirement:GEMMA4_Q2_RETIRE_SRC,gemma4Q2RetirementVersion:GEMMA4_Q2_RETIRE_VERSION,
  gemma4BrowserPackCoherence:GEMMA4_BROWSER_PACK_SRC,gemma4BrowserPackCoherenceVersion:GEMMA4_BROWSER_PACK_VERSION,
  gemma4OPFSStorage:GEMMA4_OPFS_SRC,gemma4OPFSStorageVersion:GEMMA4_OPFS_VERSION
});
})();