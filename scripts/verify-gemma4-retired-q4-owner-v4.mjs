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

for(const [name,source] of [['controller',controller],['takeover',takeover],['currentActions',currentActions],['phone',phone]])new vm.Script(source,{filename:name});

// This exact text is the stale screen reported after 2/2 LiteRT files imported.
assert.match(deepLegacy,/Gemma 4 E2B Q4F16 is the fast core and E4B Q4F16 is the deep core/,'Regression fixture changed: expected stale copy must remain attributable to the retired E4 Q4 extension.');
assert.match(deepLegacy,/Complete Q4F16 core/,'Regression fixture changed: retired deep extension must be the source of the stale Q4 action.');
assert.match(packLegacy,/Complete Q4F16 core/,'Legacy pack extension is also a retired Q4 presentation owner.');
assert.match(dualLegacy,/new MutationObserver/,'Legacy dual-Q4 actions remain unsafe presentation code and must never be loaded by the current phone chain.');

assert.match(controller,/1\.0\.24-model-settings-controller-v173-passive-gemma-single-owner/);
const activeController=controller.slice(0,controller.indexOf('const api=Object.freeze'));
assert.doesNotMatch(activeController,/GEMMA4_PACK_SRC|GEMMA4_DEEP_SRC|gemma4-pack-extension-v1\.js|gemma4-e4b-q4-extension-v1\.js/,'Current model-settings action chain must not load retired Q4 presentation extensions.');
assert.match(controller,/gemma4-dual-actions-v2\.js\?v=1\.2\.2-single-owner-opfs-reconcile/);
assert.match(controller,/await actions\?\.synchronizeImportedModels\?\.\(\)/,'Imported OPFS receipt must reconcile before any current phone decoration.');
assert.match(controller,/CivweaveGemma4PhonePerformanceCoreV1\?\.applyAuthority\?\.\(\)/,'Controller may reassert phone data authority without reactivating legacy presentation hooks.');
assert.doesNotMatch(controller,/CivweaveGemma4PhonePerformanceCoreV1\?\.activate\?\.\(\)/,'Controller must not re-run phone activation after OPFS reconciliation.');
assert.match(controller,/gemma4SinglePhonePresentationOwner:true/);
assert.match(controller,/gemma4ImportedReceiptReconciledBeforeDecorate:true/);
assert.match(controller,/gemma4LegacyPackExtensionLoaded:false/);
assert.match(controller,/gemma4LegacyDeepExtensionLoaded:false/);
assert.match(controller,/gemma4PassivePreload:false/,'Working Settings menu must remain passive.');
assert.match(controller,/providerRuntimeOnOpen:false/,'Opening Settings must remain runtime-inert.');

const takeoverImport=worker203.indexOf("importScripts('/service-worker-gemma4-current-phone-v1.js?v=gemma4-current-phone-worker-v1')");
const localAiImport=worker203.indexOf("importScripts('/service-worker-local-ai-coherence-v307.js");
assert.ok(takeoverImport>=0&&localAiImport>takeoverImport,'Current Gemma takeover must register before historical local-AI coherence.');
assert.match(takeover,/gemma4-e4b-q4-extension-v1\.js/);
assert.match(takeover,/gemma4-pack-extension-v1\.js/);
assert.match(takeover,/gemma4-dual-q4-actions-v1\.js/);
assert.match(takeover,/x-civweave-retired-presentation/);
assert.match(takeover,/purgesExecutablePathsOnly:true/);
assert.match(takeover,/preservesDownloadedModels:true/);
assert.match(takeover,/preservesSavedModelState:true/);
assert.doesNotMatch(takeover,/civweave-model-generative-v266|civweave-specialized-model-packs-v1/,'Takeover must not delete downloaded model payload caches.');

assert.doesNotMatch(currentActions,/Q4F16 core|data-gemma4-core-complete|new MutationObserver/,'Current action owner must not revive Q4 presentation.');
assert.match(currentActions,/Finish phone performance core/);
assert.match(currentActions,/singlePresentationOwner:true/);
assert.match(currentActions,/presentationOwnership:true/);
assert.doesNotMatch(currentActions,/phone\(\)\?\.decorateSettings/,'Current action owner must never invoke the older phone-core Settings decorator.');
assert.match(currentActions,/opfs\(\)\?\.opfsStatus|storage\.opfsStatus/,'Completed browser receipts must be verified against OPFS directly.');
assert.match(currentActions,/writeDownloadReady/,'Verified OPFS payloads must reconcile the download-manager saved state before phone authority checks.');
assert.match(currentActions,/synchronizeImportedModels/,'2\/2 imported payloads must have an explicit reconciliation path.');
assert.match(phone,/Web-optimized LiteRT-LM phone binaries/);
assert.match(phone,/Complete phone performance core/,'Older phone-core presentation remains a compatibility fixture but must not own the current action layer.');

console.log(JSON.stringify({ok:true,contract:'gemma4-phone-single-owner-v5',staleCopySource:'gemma4-e4b-q4-extension-v1.js',currentController:'litert-single-owner',opfsReceiptReconciledBeforeDecorate:true,currentActionsOwnPresentation:true,phoneCoreDecoratorNotInvoked:true,workerTakeoverBeforeLegacyCoherence:true,settingsPassive:true,downloadedModelsPreserved:true},null,2));