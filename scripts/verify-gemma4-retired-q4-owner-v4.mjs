import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [controller,deepLegacy,packLegacy,dualLegacy,worker203,takeover,currentActions,phone]=await Promise.all([
  'public/app/model-settings-controller-v173.js',
  'public/app/local-ai/gemma4-e4b-q4-extension-v1.js',
  'public/app/local-ai/gemma4-pack-extension-v1.js',
  'public/app/local-ai/gemma4-dual-q4-actions-v1.js',
  'public/service-worker-v203.js',
  'public/service-worker-gemma4-current-phone-v1.js',
  'public/app/local-ai/gemma4-dual-actions-v2.js',
  'public/app/local-ai/gemma4-phone-performance-core-v1.js'
].map(read));

for(const [name,source] of [['controller',controller],['deepLegacy',deepLegacy],['packLegacy',packLegacy],['dualLegacy',dualLegacy],['takeover',takeover],['currentActions',currentActions],['phone',phone]])new vm.Script(source,{filename:name});

for(const [name,source] of [['deepLegacy',deepLegacy],['packLegacy',packLegacy],['dualLegacy',dualLegacy]]){
  assert.match(source,/sourceRetired:true/,`${name} must be physically retired.`);
  assert.match(source,/presentationOwnership:false/,`${name} must not own Settings presentation.`);
  assert.match(source,/mutationObserver:false/,`${name} must not install an observer.`);
  assert.doesNotMatch(source,/Gemma 4 E2B Q4F16 is the fast core and E4B Q4F16 is the deep core/,`${name} must not retain stale Premier Phone copy.`);
  assert.doesNotMatch(source,/Complete Q4F16 core/,`${name} must not retain the stale Q4 action.`);
  assert.doesNotMatch(source,/new MutationObserver/,`${name} must not retain its historical observer loop.`);
}

assert.match(controller,/1\.0\.26-model-settings-controller-v173-passive-gemma-support-autodetect/);
const activeController=controller.slice(0,controller.indexOf('const api=Object.freeze'));
assert.doesNotMatch(activeController,/GEMMA4_PACK_SRC|GEMMA4_DEEP_SRC|gemma4-pack-extension-v1\.js|gemma4-e4b-q4-extension-v1\.js/,'Current model-settings action chain must not load retired Q4 presentation extensions.');
assert.match(controller,/gemma4-dual-actions-v2\.js\?v=1\.3\.1-support-autodetect/);
assert.match(controller,/await actions\?\.synchronizeImportedModels\?\.\(\)/,'Imported OPFS state must reconcile before current phone decoration.');
assert.match(controller,/actions\?\.refreshSupportStatus\?\.\(\{autoReconcile:true\}\)/,'Current phone chain must resolve internally stored support state after the Gemma imports.');
assert.match(controller,/CivweaveGemma4PhonePerformanceCoreV1\?\.applyAuthority\?\.\(\)/,'Controller may reassert phone data authority without reactivating legacy presentation hooks.');
assert.doesNotMatch(controller,/CivweaveGemma4PhonePerformanceCoreV1\?\.activate\?\.\(\)/,'Controller must not re-run phone activation after OPFS reconciliation.');
assert.match(controller,/gemma4SinglePhonePresentationOwner:true/);
assert.match(controller,/gemma4ImportedReceiptReconciledBeforeDecorate:true/);
assert.match(controller,/gemma4MissingSupportDownloadAction:true/);
assert.match(controller,/gemma4SupportAutoDetect:true/);
assert.match(controller,/gemma4SupportFilesInternal:true/);
assert.match(controller,/gemma4BrowserReceiptGemmaOnly:true/);
assert.match(controller,/gemma4LegacyPackExtensionLoaded:false/);
assert.match(controller,/gemma4LegacyDeepExtensionLoaded:false/);
assert.match(controller,/gemma4PassivePreload:false/,'Working Settings menu must remain passive.');
assert.match(controller,/providerRuntimeOnOpen:false/,'Opening Settings must remain runtime-inert.');
assert.match(controller,/passiveGemmaHydration:false/,'Opening Settings must not hydrate Gemma code.');

const takeoverImport=worker203.indexOf("importScripts('/service-worker-gemma4-current-phone-v1.js?v=gemma4-current-phone-worker-v4-support-autodetect')");
const localAiImport=worker203.indexOf("importScripts('/service-worker-local-ai-coherence-v307.js");
assert.ok(takeoverImport>=0&&localAiImport>takeoverImport,'Current Gemma takeover must register before historical local-AI coherence.');
assert.match(takeover,/gemma4-current-phone-worker-v4-support-autodetect/,'Takeover generation must change so installed PWAs receive support autodetection code.');
assert.match(takeover,/staging-gemma4-current-phone-owner-v4-support-autodetect/,'Takeover must use a fresh one-shot recovery marker.');
assert.match(takeover,/premier-phone-support-worker-v1\.js/,'Support worker must be included in current executable ownership.');
assert.match(takeover,/browser-pack-pwa-import-v1\.js/,'Gemma-only importer must be included in current executable ownership.');
assert.match(takeover,/supportAutoDetectCurrent:true/);
assert.match(takeover,/gemma4-e4b-q4-extension-v1\.js/);
assert.match(takeover,/gemma4-pack-extension-v1\.js/);
assert.match(takeover,/gemma4-dual-q4-actions-v1\.js/);
assert.match(takeover,/x-civweave-retired-presentation/);
assert.match(takeover,/cwGemma4ReloadAppClients/,'Staging takeover must replace an already-running page realm with stale Q4 code.');
assert.match(takeover,/client\.navigate\(url\.href\)/,'One-shot takeover must reload controlled app clients after executable purge.');
assert.match(takeover,/reloadsAppClientsOnce:true/);
assert.match(takeover,/purgesExecutablePathsOnly:true/);
assert.match(takeover,/preservesDownloadedModels:true/);
assert.match(takeover,/preservesSavedModelState:true/);
assert.doesNotMatch(takeover,/await caches\.delete\(['"]civweave-model-generative-v266|await caches\.delete\(['"]civweave-specialized-model-packs-v1/,'Takeover must not delete downloaded model payload caches.');

assert.doesNotMatch(currentActions,/Q4F16 core|data-gemma4-core-complete|new MutationObserver/,'Current action owner must not revive Q4 presentation.');
assert.match(currentActions,/Download missing support files internally/);
assert.match(currentActions,/Finish phone performance core/);
assert.match(currentActions,/repairPremierReceipt/);
assert.match(currentActions,/supportAutoDetect:true/);
assert.match(currentActions,/supportFilesInternal:true/);
assert.match(currentActions,/browserReceiptGemmaOnly:true/);
assert.match(currentActions,/singlePresentationOwner:true/);
assert.match(currentActions,/presentationOwnership:true/);
assert.doesNotMatch(currentActions,/phone\(\)\?\.decorateSettings/,'Current action owner must never invoke the phone-core Settings decorator.');
assert.match(currentActions,/opfs\(\)\?\.opfsStatus|storage\.opfsStatus/,'Completed browser receipts must be verified against OPFS directly.');
assert.match(currentActions,/writeDownloadReady/,'Verified OPFS payloads must reconcile the download-manager saved state before phone authority checks.');
assert.match(currentActions,/synchronizeImportedModels/,'Imported payloads must have an explicit reconciliation path.');
assert.match(currentActions,/downloadSupportFiles/,'Missing support components must have an explicit internal action path.');

assert.match(phone,/runtimeOnly:true/);
assert.match(phone,/presentationOwnership:false/);
assert.match(phone,/function decorateSettings\(\)\{return true\}/,'Phone core is runtime/data authority only.');
assert.doesNotMatch(phone,/Complete phone performance core|Complete Q4F16 core/,'Runtime-only phone core must not contain a competing Settings action.');

console.log(JSON.stringify({ok:true,contract:'gemma4-phone-single-owner-v8',retiredQ4SourcesPhysicallyStubbed:true,currentController:'litert-support-autodetect-single-owner',opfsReceiptReconciledBeforeDecorate:true,currentActionsOwnPresentation:true,phoneCoreRuntimeOnly:true,workerTakeoverBeforeLegacyCoherence:true,registeredWorkerGeneration:'v4-support-autodetect',supportFilesInternal:true,supportAutoDetect:true,browserReceiptGemmaOnly:true,reloadsOldPageRealm:true,settingsPassive:true,downloadedModelsPreserved:true},null,2));