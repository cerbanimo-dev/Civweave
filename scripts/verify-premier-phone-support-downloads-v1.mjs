import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const must=(condition,message)=>{if(!condition)throw new Error(message)};
const has=(text,needle,message)=>must(text.includes(needle),message||`Missing ${needle}`);
const lacks=(text,needle,message)=>must(!text.includes(needle),message||`Unexpected ${needle}`);

const actions=read('public/app/local-ai/gemma4-dual-actions-v2.js');
const phone=read('public/app/local-ai/gemma4-phone-performance-core-v1.js');
const worker=read('public/app/local-ai/premier-phone-support-worker-v1.js');
const qwen=read('public/app/local-ai/premier-phone-qwen-download-v1.js');
const importer=read('public/app/local-ai/browser-pack-pwa-import-v1.js');
const inference=read('public/app/local-ai/gemma4-inference-repair-v1.js');
const controller=read('public/app/model-settings-controller-v173.js');
const finalizer=read('public/app/local-ai/premier-phone-finalizer-v1.js');
const takeover=read('public/service-worker-gemma4-current-phone-v1.js');
const registeredWorker=read('public/service-worker-v203.js');
const retiredPack=read('public/app/local-ai/gemma4-pack-extension-v1.js');
const retiredDeep=read('public/app/local-ai/gemma4-e4b-q4-extension-v1.js');
const retiredActions=read('public/app/local-ai/gemma4-dual-q4-actions-v1.js');

has(actions,'1.3.2-gemma4-dual-actions-v2-local-selection-authority');
has(actions,'Download missing support files internally (');
for(const id of ['qwen3-0.6b-q8-wasm','silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','omnilingual-asr-300m-int8','supertonic-3-tts-int8'])has(actions,id);
has(actions,'premier-phone-support-worker-v1.js');
has(actions,'downloadSupportFiles');
has(actions,'supportStatus');
has(actions,'repairPremierReceipt');
has(actions,"const PENDING_KEY='civweave.ai-pack.browser-downloads.v1'");
has(actions,"receiptScope:'gemma-litert-browser-only'");
has(actions,'supportFilesManagedInternally:true');
has(actions,'supportAutoDetect:true');
has(actions,'browserReceiptGemmaOnly:true');
has(actions,'finished downloading but was not detected in Civweave internal storage');
has(actions,'preservesExistingLargeFiles:true');
has(actions,'supportLargeFileReimportRequired:false');
has(actions,'singlePresentationOwner:true');
has(actions,'localSelectionPersistsProviderRoute:true');
has(actions,'selectedButtonStateVisible:true');
has(actions,'persistLocalRoute?.(selected');
lacks(actions,'Complete Q4F16 core');

has(phone,'1.3.0-gemma4-phone-performance-core-v1-runtime-only-support-status');
has(phone,'baseComponentStatus=base.componentStatus?.bind(base)');
has(phone,'__civweaveGemma4PhonePerformanceCoreVersion:VERSION');
has(phone,"status:'support-required'");
has(phone,"phase:'phone-support-required'");
has(phone,'function decorateSettings(){return true}');
has(phone,'presentationOwnership:false');
has(phone,'runtimeOnly:true');
lacks(phone,"document.addEventListener('click'");

has(worker,'1.0.0-premier-phone-support-worker-v1');
has(worker,'civweave-specialized-model-packs-v1');
has(worker,'mainThreadLargeCachePut:false');
has(worker,'sequentialArtifacts:true');

has(qwen,'1.0.0-premier-phone-qwen-download-v1');
has(qwen,"const CACHE='civweave-model-generative-v266'");
has(qwen,"const ID='qwen3-0.6b-q8-wasm'");
has(qwen,"onnx/model_quantized.onnx");
has(qwen,'600_000_000');
has(qwen,'premier-phone-support-worker-v1.js');
has(qwen,'workerOnly:true');
has(qwen,'mainThreadLargeCachePut:false');
has(qwen,'autoDetect:true');
has(qwen,'if(!existing?.start||!existing?.status)globalThis.CivweaveLocalModelDownloadV266=api');
lacks(qwen,"download-manager-v267.js");

has(importer,'1.3.2-browser-pack-pwa-import-v1-premier-incremental-handoff');
has(importer,"const PREMIER_BROWSER_IDS=new Set(['gemma4-e2b-it-litert-web','gemma4-e4b-it-litert-web'])");
has(importer,'browserRecords');
has(importer,'missingBrowserRecords');
has(importer,'Recheck imported Gemma files');
has(importer,'Support files will download internally after these are imported.');
has(importer,'supportFilesInternal:true');
has(importer,'premierGemmaOnly:true');
has(importer,'Finish Premier Phone setup');
has(importer,'ensureCurrentPremierOwner');
has(importer,'currentPremierOwnerHandoff:true');
has(importer,'completedPremierActionsRelinquished:true');
has(importer,'passiveBridgeLoad:false');
has(importer,'mutationObserver:false');
has(importer,'if(!current?.streamingImportProgress)return;');
has(importer,"if(currentOwnerActive()){currentOwner()?.scheduleDecorate?.();continue}");
has(importer,'incrementalPremierImport:true');
has(importer,'ownerSettlementOnEveryImport:true');
has(importer,'ownerRequiresCompletedGemmaReceipt:true');
lacks(importer,'new MutationObserver');
lacks(importer,'observer.observe');

has(inference,'1.0.11-gemma4-inference-repair-v1-current-phone-authority');
has(inference,"PHONE_AUTH_VERSION='1.3.0-gemma4-phone-performance-core-v1-runtime-only-support-status'");
has(inference,'phoneAuthorityRuntimeOnly:true');

has(controller,'1.0.29-model-settings-controller-v173-local-selection-authority');
has(controller,'1.0.0-premier-phone-qwen-download-v1');
has(controller,'premier-phone-qwen-download-v1.js?v=1.0.0-qwen-internal');
has(controller,'1.0.0-premier-phone-finalizer-v1');
has(controller,'premier-phone-finalizer-v1.js?v=1.0.0-idempotent-existing-components');
has(controller,'1.3.2-gemma4-dual-actions-v2-local-selection-authority');
has(controller,'gemma4-dual-actions-v2.js?v=1.3.2-local-selection-authority');
has(controller,"loadScript(GEMMA4_QWEN_SRC,qwenReady,'premier-phone-qwen-internal-download')");
has(controller,"loadScript(GEMMA4_FINALIZER_SRC,finalizerReady,'premier-phone-idempotent-finalizer')");
must(controller.indexOf('loadScript(GEMMA4_FINALIZER_SRC')<controller.indexOf('loadScript(GEMMA4_ACTIONS_SRC'),'Finalizer must load before legacy current-action listener.');
has(controller,'gemma4MissingSupportDownloadAction:true');
has(controller,'gemma4SupportWorkerOnly:true');
has(controller,'gemma4SupportAutoDetect:true');
has(controller,'gemma4SupportFilesInternal:true');
has(controller,'gemma4QwenInternalManager:true');
has(controller,'gemma4QwenManagerExplicitOnly:true');
has(controller,'gemma4BrowserReceiptGemmaOnly:true');
has(controller,'gemma4IdempotentFinalizer:true');
has(controller,'gemma4FinalizerPreservesExistingDownloads:true');
has(controller,'gemma4LocalSelectionPersistsProviderRoute:true');
has(controller,'gemma4PassivePreload:false');
has(controller,'providerRuntimeOnOpen:false');
has(controller,'passiveGemmaHydration:false');

has(finalizer,'preservesExistingModels:true');
has(finalizer,'downloadsMissingSupportOnly:true');
has(finalizer,'requeuesVerifiedLargeModels:false');
has(finalizer,'individualDownloadsRecognized:true');
has(finalizer,'let legacyError=null');
has(finalizer,'const verified=await supportStatus()');
has(finalizer,'if(verified.missing.length&&legacyError)throw legacyError');

has(registeredWorker,'gemma4-current-phone-worker-v5-qwen-internal');
has(takeover,'gemma4-current-phone-worker-v5-qwen-internal');
has(takeover,'staging-gemma4-current-phone-owner-v5-qwen-internal');
has(takeover,'premier-phone-qwen-download-v1.js');
has(takeover,'premier-phone-support-worker-v1.js');
has(takeover,'browser-pack-pwa-import-v1.js');
has(takeover,'qwenInternalManagerCurrent:true');
has(takeover,'browserPackImporterCurrent:true');
has(takeover,'supportAutoDetectCurrent:true');
has(takeover,'preservesDownloadedModels:true');
has(takeover,'preservesSavedModelState:true');

for(const text of [retiredPack,retiredDeep,retiredActions]){
  has(text,'sourceRetired:true');
  has(text,'presentationOwnership:false');
  has(text,'mutationObserver:false');
  lacks(text,'Complete Q4F16 core');
  lacks(text,'Gemma 4 E2B Q4F16 is the fast core');
}

console.log('Premier Phone internal support downloads, idempotent finalization, incremental Gemma import, local selection authority, Qwen compatibility ownership, and autodetection verified.');