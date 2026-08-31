(()=>{
'use strict';
const VERSION='1.2.0-gemma4-dual-actions-v2-phone-delegated';
if(globalThis.CivweaveGemma4DualQ4ActionsV1?.version===VERSION)return;
const phone=()=>globalThis.CivweaveGemma4PhonePerformanceCoreV1;
const handoff=()=>globalThis.CivweaveGemma4BrowserPackCoherenceV1;
function scheduleDecorate(){
  queueMicrotask(()=>{
    try{phone()?.decorateSettings?.()}catch{}
    try{handoff()?.scheduleDecorate?.()}catch{}
  });
  return true;
}
function pendingSummary(){
  const bridge=globalThis.CivweaveBrowserPackDownloadV1,receipt=bridge?.pending?.('premier-phone')||null,missing=receipt&&bridge?.unimportedRecords?bridge.unimportedRecords(receipt):[];
  return{receipt,missing,startedMissing:[],unstartedMissing:missing,imported:receipt?.importedKeys?.length||0,total:receipt?.large?.length||0};
}
async function useModel(modelId){
  const m=globalThis.CivweaveLocalModelDownloadV266;if(!m?.status||!m?.select)throw new Error('Local model manager is unavailable.');
  const checked=await m.status(modelId);if(!checked?.available)throw new Error(`${checked?.label||modelId} is not installed.`);m.select(modelId);return checked;
}
globalThis.CivweaveGemma4DualQ4ActionsV1=Object.freeze({
  version:VERSION,
  primaryModel:'gemma4-e2b-it-litert-web',deepModel:'gemma4-e4b-it-litert-web',packId:'premier-phone',
  scheduleDecorate,decorateSettings:()=>{scheduleDecorate();return true},pendingSummary,useModel,
  compatibilityOnly:true,currentPhoneAuthority:true,presentationOwnership:false,
  mutationObserverGuarded:false,mutationObserver:false,q4PresentationRetired:true,
  preservesExistingLargeFiles:true,fullPackReinstallRequired:false
});
scheduleDecorate();
})();