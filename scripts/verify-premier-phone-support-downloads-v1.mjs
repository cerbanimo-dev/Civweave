import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const must=(condition,message)=>{if(!condition)throw new Error(message)};
const has=(text,needle,message)=>must(text.includes(needle),message||`Missing ${needle}`);
const lacks=(text,needle,message)=>must(!text.includes(needle),message||`Unexpected ${needle}`);

const actions=read('public/app/local-ai/gemma4-dual-actions-v2.js');
const phone=read('public/app/local-ai/gemma4-phone-performance-core-v1.js');
const worker=read('public/app/local-ai/premier-phone-support-worker-v1.js');
const controller=read('public/app/model-settings-controller-v173.js');
const takeover=read('public/service-worker-gemma4-current-phone-v1.js');
const retiredPack=read('public/app/local-ai/gemma4-pack-extension-v1.js');
const retiredDeep=read('public/app/local-ai/gemma4-e4b-q4-extension-v1.js');
const retiredActions=read('public/app/local-ai/gemma4-dual-q4-actions-v1.js');

has(actions,"1.3.0-gemma4-dual-actions-v2-support-downloads");
has(actions,"Download missing support files (");
has(actions,"'qwen3-0.6b-q8-wasm'");
has(actions,"'silero-vad-onnx'");
has(actions,"'parakeet-tdt-0.6b-v3-int8'");
has(actions,"'omnilingual-asr-300m-int8'");
has(actions,"'supertonic-3-tts-int8'");
has(actions,'premier-phone-support-worker-v1.js');
has(actions,'downloadSupportFiles');
has(actions,'supportStatus');
has(actions,'preservesExistingLargeFiles:true');
has(actions,'supportLargeFileReimportRequired:false');
lacks(actions,'Complete Q4F16 core','Current phone owner must never restore the retired Q4 action.');

has(phone,"1.3.0-gemma4-phone-performance-core-v1-runtime-only-support-status");
has(phone,'baseComponentStatus=base.componentStatus?.bind(base)');
has(phone,'__civweaveGemma4PhonePerformanceCoreVersion:VERSION');
has(phone,'base.__civweaveGemma4PhonePerformanceCoreVersion===VERSION');
has(phone,"status:'support-required'");
has(phone,"phase:'phone-support-required'");
has(phone,'function decorateSettings(){return true}');
has(phone,'presentationOwnership:false');
has(phone,'runtimeOnly:true');
has(phone,'replacesOlderPackWrappers:true');
lacks(phone,"document.addEventListener('click'",'Runtime authority must not own Settings clicks.');

has(worker,"1.0.0-premier-phone-support-worker-v1");
has(worker,"civweave-specialized-model-packs-v1");
has(worker,"self.addEventListener('message'");
has(worker,'cache.put');
has(worker,'mainThreadLargeCachePut:false');

has(controller,"1.0.25-model-settings-controller-v173-passive-gemma-support-downloads");
has(controller,"1.3.0-gemma4-dual-actions-v2-support-downloads");
has(controller,"1.3.0-gemma4-phone-performance-core-v1-runtime-only-support-status");
has(controller,'gemma4MissingSupportDownloadAction:true');
has(controller,'gemma4SupportWorkerOnly:true');
has(controller,'gemma4PassivePreload:false');
has(controller,'providerRuntimeOnOpen:false');
has(controller,'passiveGemmaHydration:false');

has(takeover,'gemma4-current-phone-worker-v3-support-downloads');
has(takeover,'premier-phone-support-worker-v1.js');
has(takeover,'preservesDownloadedModels:true');
has(takeover,'preservesSavedModelState:true');

for(const [name,text] of [['pack',retiredPack],['deep',retiredDeep],['actions',retiredActions]]){
  has(text,'sourceRetired:true',`${name} legacy source is not physically retired.`);
  has(text,'presentationOwnership:false',`${name} legacy source still claims presentation ownership.`);
  has(text,'mutationObserver:false',`${name} legacy source still permits observer ownership.`);
  lacks(text,'Complete Q4F16 core',`${name} legacy source still contains the stale Q4 button.`);
  lacks(text,'Gemma 4 E2B Q4F16 is the fast core',`${name} legacy source still contains stale Premier Phone copy.`);
}

console.log('Premier Phone support-download authority verified.');