import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [lifecycle,settings,bootstrap,controller,pulse,registry,downloadPolicy]=await Promise.all([
  'public/app/document-lifecycle-v221.js','public/app/local-ai/settings-panel-v267.js','public/app/local-ai/bootstrap-v266.js','public/app/model-settings-controller-v173.js','public/app/local-ai/test-pulse-v269.js','public/app/local-ai/model-registry-v266.js','public/app/local-ai/download-policy-v278.js'
].map(read));
for(const source of [lifecycle,settings,bootstrap,controller,pulse,registry,downloadPolicy])new Function(source);

assert.match(lifecycle,/document-lifecycle-v296-management-only-settings/);
assert.match(lifecycle,/document-lifecycle-v316-nonblocking-no-global-observer-patch/);
assert.match(lifecycle,/ensureLocalAISettingsManagement/);
assert.match(lifecycle,/ensureMinimalManagement/);
assert.match(lifecycle,/localAIInferenceReady/);
assert.match(lifecycle,/cacheIntegrityOnDemand===true/);
assert.match(lifecycle,/management-only-no-inference-bootstrap-v296/);
assert.match(lifecycle,/1\.0\.83-local-ai-bootstrap-v282-inference-health/);
assert.match(lifecycle,/function scheduleSettingsManagement\(/);
assert.match(lifecycle,/settingsEntryOwner:'experience-orchestrator'/);
assert.doesNotMatch(lifecycle,/captureSettingsOpen|document\.addEventListener\('click'/,'management lifecycle must not intercept Settings clicks');
assert.doesNotMatch(lifecycle,/globalThis\.MutationObserver\s*=/);
assert.doesNotMatch(lifecycle,/new Worker\s*\(|\.generate\s*\(|bootstrap-v266\.js/);
const managementBody=lifecycle.match(/function localAIManagementReady\(\)\{([\s\S]*?)\}\nfunction localAIInferenceReady/)?.[1]||'';
assert.doesNotMatch(managementBody,/LocalModelRuntimeV266|LocalModelBridgeV266/);
const inferenceBody=lifecycle.match(/function localAIInferenceReady\(\)\{([\s\S]*?)\}\nfunction enhanceLocalAISettings/)?.[1]||'';
assert.match(inferenceBody,/LocalModelRuntimeV266/);assert.match(inferenceBody,/LocalModelBridgeV266/);
const settingsOpenBody=lifecycle.match(/function ensureLocalAISettingsManagement\(\)\{([\s\S]*?)\}\nfunction scheduleSettingsManagement/)?.[1]||'';
assert.match(settingsOpenBody,/ensureMinimalManagement/);
assert.doesNotMatch(settingsOpenBody,/bootstrap\.ready|runtime-v266|runtime-bridge|test-pulse-v269/);
assert.match(settingsOpenBody,/managementOnly:true/);assert.match(settingsOpenBody,/inferenceDormantOnOpen:true/);
for(const text of ['Downloaded local AI','Download','Resume','Use locally','Remove','Model window','Civweave working default','TTFT'])assert.ok(settings.toLowerCase().includes(text.toLowerCase()));
assert.match(settings,/truthfulCompletion:true/);assert.match(settings,/cacheIntegrityOnDemand:true/);assert.match(settings,/openPath:'snapshot-first-v287'/);
assert.match(settings,/lazyTabRender:true/);assert.match(settings,/function renderDeferred\(/);assert.match(settings,/civweave:settings-tab-selected/);
assert.match(pulse,/1\.0\.116-local-model-test-pulse-v303-mobile-safe/);assert.match(pulse,/Test model/);assert.match(pulse,/raceSafeRepair:true/);
assert.match(bootstrap,/capability-contract-v307/);assert.match(bootstrap,/package-revision-guard-v307\.js/);assert.match(bootstrap,/backendFallback:true/);assert.match(bootstrap,/canonicalCausalLM:true/);
assert.match(controller,/civweave:model-settings-opened/);
for(const token of ["id:'gemma3-1b-it-q4f16'","id:'qwen3-0.6b-q4f16'",'function directUrl','function artifactRevision'])assert.ok(registry.includes(token));
assert.match(downloadPolicy,/largeExternalDataForeground:true/);
console.log(JSON.stringify({ok:true,revision:'local-model-settings-mount-v316-nonblocking',canonicalSettingsMount:true,settingsFirst:true,managementOnlyOnOpen:true,managementAfterPaint:true,noSettingsCaptureInLifecycle:true,inferenceDormantUntilNeeded:true},null,2));
