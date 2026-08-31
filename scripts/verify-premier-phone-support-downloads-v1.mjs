import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const must=(condition,message)=>{if(!condition)throw new Error(message)};
const has=(text,needle,message)=>must(text.includes(needle),message||`Missing ${needle}`);
const lacks=(text,needle,message)=>must(!text.includes(needle),message||`Unexpected ${needle}`);

const actions=read('public/app/local-ai/gemma4-dual-actions-v2.js');
const phone=read('public/app/local-ai/gemma4-phone-performance-core-v1.js');
const worker=read('public/app/local-ai/premier-phone-support-worker-v1.js');
const importer=read('public/app/local-ai/browser-pack-pwa-import-v1.js');
const inference=read('public/app/local-ai/gemma4-inference-repair-v1.js');
const controller=read('public/app/model-settings-controller-v173.js');
const takeover=read('public/service-worker-gemma4-current-phone-v1.js');
const registeredWorker=read('public/service-worker-v203.js');
const retiredPack=read('public/app/local-ai/gemma4-pack-extension-v1.js');
const retiredDeep=read('public/app/local-ai/gemma4-e4b-q4-extension-v1.js');
const retiredActions=read('public/app/local-ai/gemma4-dual-q4-actions-v1.js');

has(actions,'1.3.0-gemma4-dual-actions-v2-support-downloads');
has(actions,'Download missing support files (');
for(const id of ['qwen3-0.6b-q8-wasm','silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','omnilingual-asr-300m-int8','supertonic-3-tts-int8'])has(actions,id);
has(actions,'premier-phone-support-worker-v1.js');
has(actions,'downloadSupportFiles');
has(actions,'supportStatus');
has(actions,'preservesExistingLargeFiles:true');
has(actions,'supportLargeFileReimportRequired:false');
has(actions,'singlePresentationOwner:true');
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

has(importer,'1.3.0-browser-pack-pwa-import-v1-event-driven-current-owner-handoff');
has(importer,'Finish Premier Phone setup');
has(importer,'ensureCurrentPremierOwner');
has(importer,'currentPremierOwnerHandoff:true');
has(importer,'completedPremierActionsRelinquished:true');
has(importer,'passiveBridgeLoad:false');
has(importer,'mutationObserver:false');
has(importer,'if(!current?.streamingImportProgress)return;');
has(importer,'if(currentOwnerActive(card))continue;');
lacks(importer,'new MutationObserver');
lacks(importer,'observer.observe');

has(inference,'1.0.11-gemma4-inference-repair-v1-current-phone-authority');
has(inference,"PHONE_AUTH_VERSION='1.3.0-gemma4-phone-performance-core-v1-runtime-only-support-status'");
has(inference,'phoneAuthorityRuntimeOnly:true');

has(controller,'1.0.25-model-settings-controller-v173-passive-gemma-support-downloads');
has(controller,'gemma4MissingSupportDownloadAction:true');
has(controller,'gemma4SupportWorkerOnly:true');
has(controller,'gemma4PassivePreload:false');
has(controller,'providerRuntimeOnOpen:false');
has(controller,'passiveGemmaHydration:false');

has(registeredWorker,'gemma4-current-phone-worker-v3-support-downloads');
has(takeover,'gemma4-current-phone-worker-v3-support-downloads');
has(takeover,'premier-phone-support-worker-v1.js');
has(takeover,'browser-pack-pwa-import-v1.js');
has(takeover,'browserPackImporterCurrent:true');
has(takeover,'preservesDownloadedModels:true');
has(takeover,'preservesSavedModelState:true');

for(const text of [retiredPack,retiredDeep,retiredActions]){
  has(text,'sourceRetired:true');
  has(text,'presentationOwnership:false');
  has(text,'mutationObserver:false');
  lacks(text,'Complete Q4F16 core');
  lacks(text,'Gemma 4 E2B Q4F16 is the fast core');
}

console.log('Premier Phone support-download authority verified.');