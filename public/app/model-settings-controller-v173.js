(()=>{
'use strict';
const VERSION='1.0.28-model-settings-controller-v173-premier-phone-finalizer';
const GEMMA4_QWEN_VERSION='1.0.0-premier-phone-qwen-download-v1';
const GEMMA4_QWEN_SRC='/app/local-ai/premier-phone-qwen-download-v1.js?v=1.0.0-qwen-internal';
const GEMMA4_FINALIZER_VERSION='1.0.0-premier-phone-finalizer-v1';
const GEMMA4_FINALIZER_SRC='/app/local-ai/premier-phone-finalizer-v1.js?v=1.0.0-idempotent-existing-components';
const GEMMA4_ACTIONS_VERSION='1.3.1-gemma4-dual-actions-v2-support-autodetect';
const GEMMA4_ACTIONS_SRC='/app/local-ai/gemma4-dual-actions-v2.js?v=1.3.1-support-autodetect';
const GEMMA4_FAST_VERSION='1.1.1-gemma4-litert-fast-extension-v1-browser-handoff-guard';
const GEMMA4_FAST_SRC='/app/local-ai/gemma4-litert-fast-extension-v1.js?v=1.1.1-browser-handoff-guard';
const GEMMA4_PHONE_VERSION='1.3.0-gemma4-phone-performance-core-v1-runtime-only-support-status';
const GEMMA4_PHONE_SRC='/app/local-ai/gemma4-phone-performance-core-v1.js?v=1.3.0-runtime-only-support-status';
const GEMMA4_Q2_RETIRE_VERSION='1.0.0-gemma4-q2-retirement-v1';
const GEMMA4_Q2_RETIRE_SRC='/app/local-ai/gemma4-q2-retirement-v1.js?v=1.0.0-q2-retirement';
const GEMMA4_BROWSER_PACK_VERSION='1.0.2-gemma4-browser-pack-coherence-v2-event-driven';
const GEMMA4_BROWSER_PACK_SRC='/app/local-ai/gemma4-browser-pack-coherence-v2.js?v=1.0.2-event-driven';
const GEMMA4_OPFS_VERSION='1.0.0-gemma4-opfs-storage-v1';
const GEMMA4_OPFS_SRC='/app/local-ai/gemma4-opfs-storage-v1.js?v=1.0.0-opfs-large-model';
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
async function settleGemma4Phone(){
  const actions=globalThis.CivweaveGemma4DualQ4ActionsV1;
  try{await actions?.synchronizeImportedModels?.()}catch(error){console.warn('[Civweave] Gemma 4 imported-model reconciliation deferred.',error)}
  try{globalThis.CivweaveGemma4PhonePerformanceCoreV1?.applyAuthority?.()}catch{}
  try{await actions?.refreshSupportStatus?.({autoReconcile:true})}catch(error){console.warn('[Civweave] Premier Phone support status deferred.',error)}
  actions?.scheduleDecorate?.();
  globalThis.CivweaveGemma4Q2RetirementV1?.scheduleDecorate?.();
  globalThis.CivweaveGemma4BrowserPackCoherenceV1?.scheduleDecorate?.();
  return true;
}
let packLoadPromise=null;
function ensureGemma4Pack(){
  const qwenReady=()=>globalThis.CivweavePremierPhoneQwenDownloadV1?.version===GEMMA4_QWEN_VERSION;
  const finalizerReady=()=>globalThis.CivweavePremierPhoneFinalizerV1?.version===GEMMA4_FINALIZER_VERSION;
  const actionsReady=()=>globalThis.CivweaveGemma4DualQ4ActionsV1?.version===GEMMA4_ACTIONS_VERSION;
  const fastReady=()=>globalThis.CivweaveGemma4LiteRTFastExtensionV1?.version===GEMMA4_FAST_VERSION;
  const phoneReady=()=>globalThis.CivweaveGemma4PhonePerformanceCoreV1?.version===GEMMA4_PHONE_VERSION;
  const retireReady=()=>globalThis.CivweaveGemma4Q2RetirementV1?.version===GEMMA4_Q2_RETIRE_VERSION;
  const browserPackReady=()=>globalThis.CivweaveGemma4BrowserPackCoherenceV1?.version===GEMMA4_BROWSER_PACK_VERSION;
  const opfsReady=()=>globalThis.CivweaveGemma4OPFSStorageV1?.version===GEMMA4_OPFS_VERSION;
  if(qwenReady()&&finalizerReady()&&actionsReady()&&fastReady()&&phoneReady()&&retireReady()&&browserPackReady()&&opfsReady())return settleGemma4Phone();
  if(packLoadPromise)return packLoadPromise;
  packLoadPromise=loadScript(GEMMA4_QWEN_SRC,qwenReady,'premier-phone-qwen-internal-download')
    .then(()=>loadScript(GEMMA4_FINALIZER_SRC,finalizerReady,'premier-phone-idempotent-finalizer'))
    .then(()=>loadScript(GEMMA4_ACTIONS_SRC,actionsReady,'gemma4-current-phone-actions'))
    .then(()=>loadScript(GEMMA4_FAST_SRC,fastReady,'gemma4-litert-current-mobile-models'))
    .then(()=>loadScript(GEMMA4_PHONE_SRC,phoneReady,'gemma4-current-phone-pack-authority'))
    .then(()=>loadScript(GEMMA4_Q2_RETIRE_SRC,retireReady,'gemma4-q2-retirement'))
    .then(()=>loadScript(GEMMA4_BROWSER_PACK_SRC,browserPackReady,'gemma4-browser-pack-coherence'))
    .then(()=>loadScript(GEMMA4_OPFS_SRC,opfsReady,'gemma4-opfs-large-model-storage'))
    .then(settleGemma4Phone)
    .catch(error=>{console.warn('[Civweave] Gemma 4 current phone pack failed to load.',error);return false})
    .finally(()=>{packLoadPromise=null});
  return packLoadPromise;
}
const api=Object.freeze({
  version:VERSION,
  compatibilityFacade:true,
  canonical:'CivweaveSettingsV320',
  authority:'settings-v320',
  open,close,ensure,readState,credentialStatus,ensureGemma4Pack,
  gemma4PackCore:'litert-current-only',
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
  gemma4LegacyQ4PresentationOwner:false,
  gemma4LegacyPackExtensionLoaded:false,
  gemma4LegacyDeepExtensionLoaded:false,
  gemma4SinglePhonePresentationOwner:true,
  gemma4ImportedReceiptReconciledBeforeDecorate:true,
  gemma4SupportStatusBeforeReady:true,
  gemma4MissingSupportDownloadAction:true,
  gemma4SupportWorkerOnly:true,
  gemma4SupportAutoDetect:true,
  gemma4SupportFilesInternal:true,
  gemma4QwenInternalManager:true,
  gemma4QwenManagerExplicitOnly:true,
  gemma4BrowserReceiptGemmaOnly:true,
  gemma4IdempotentFinalizer:true,
  gemma4FinalizerPreservesExistingDownloads:true,
  gemma4FinalizerLoadsBeforeLegacyActions:true,
  gemma4PassivePreload:false,
  inputOwnership:false,presentationOwnership:false,credentialOwnership:false,domCreation:false,activationRequired:false,legacySettingsCapture:false,providerRuntimeOnOpen:false,quiescenceAfterPaint:true
});
globalThis.CivweaveModelSettingsControllerV173=api;
globalThis.CivweaveModelSettingsControllerBootstrapV173=Object.freeze({
  version:VERSION,dormant:true,canonical:'CivweaveSettingsV320',passiveGemmaHydration:false,
  premierPhoneQwen:GEMMA4_QWEN_SRC,premierPhoneQwenVersion:GEMMA4_QWEN_VERSION,
  premierPhoneFinalizer:GEMMA4_FINALIZER_SRC,premierPhoneFinalizerVersion:GEMMA4_FINALIZER_VERSION,
  gemma4Actions:GEMMA4_ACTIONS_SRC,gemma4ActionsVersion:GEMMA4_ACTIONS_VERSION,
  gemma4FastExtension:GEMMA4_FAST_SRC,gemma4FastVersion:GEMMA4_FAST_VERSION,
  gemma4PhoneAuthority:GEMMA4_PHONE_SRC,gemma4PhoneVersion:GEMMA4_PHONE_VERSION,
  gemma4Q2Retirement:GEMMA4_Q2_RETIRE_SRC,gemma4Q2RetirementVersion:GEMMA4_Q2_RETIRE_VERSION,
  gemma4BrowserPackCoherence:GEMMA4_BROWSER_PACK_SRC,gemma4BrowserPackCoherenceVersion:GEMMA4_BROWSER_PACK_VERSION,
  gemma4OPFSStorage:GEMMA4_OPFS_SRC,gemma4OPFSStorageVersion:GEMMA4_OPFS_VERSION,
  retiredPresentationModules:Object.freeze(['/app/local-ai/gemma4-pack-extension-v1.js','/app/local-ai/gemma4-e4b-q4-extension-v1.js','/app/local-ai/gemma4-dual-q4-actions-v1.js'])
});
})();