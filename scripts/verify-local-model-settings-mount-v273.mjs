import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [lifecycle,campus,settings,bootstrap,controller,pulse,registry,downloadPolicy]=await Promise.all([
  'public/app/document-lifecycle-v221.js',
  'public/app/working-campus-v156.part5.txt',
  'public/app/local-ai/settings-panel-v267.js',
  'public/app/local-ai/bootstrap-v266.js',
  'public/app/model-settings-controller-v173.js',
  'public/app/local-ai/test-pulse-v269.js',
  'public/app/local-ai/model-registry-v266.js',
  'public/app/local-ai/download-policy-v278.js'
].map(read));

for(const source of [lifecycle,settings,bootstrap,controller,pulse,registry,downloadPolicy])new Function(source);
new Function(campus.replace(/\}\)\(\);\s*$/,''));

assert.match(lifecycle,/document-lifecycle-v296-management-only-settings/);
assert.match(lifecycle,/document\.addEventListener\('click',captureSettingsOpen,true\)/);
assert.match(lifecycle,/controller\.open\(launcher\)/);
assert.match(lifecycle,/event\.stopImmediatePropagation\(\)/);
assert.match(lifecycle,/ensureLocalAISettingsManagement/);
assert.match(lifecycle,/ensureMinimalManagement/);
assert.match(lifecycle,/localAIInferenceReady/);
assert.match(lifecycle,/cacheIntegrityOnDemand===true/);
assert.match(lifecycle,/management-only-no-inference-bootstrap-v296/);
assert.match(lifecycle,/1\.0\.83-local-ai-bootstrap-v282-inference-health/);
assert.doesNotMatch(lifecycle,/new Worker\s*\(/);
assert.doesNotMatch(lifecycle,/\.generate\s*\(/);
assert.doesNotMatch(lifecycle,/bootstrap-v266\.js/,'opening settings must not request the full local inference bootstrap');

const managementBody=lifecycle.match(/function localAIManagementReady\(\)\{([\s\S]*?)\}\nfunction localAIInferenceReady/)?.[1]||'';
assert.ok(managementBody,'localAIManagementReady must remain inspectable');
assert.doesNotMatch(managementBody,/LocalModelRuntimeV266|LocalModelBridgeV266/,'settings/model management must not require inference readiness');
const inferenceBody=lifecycle.match(/function localAIInferenceReady\(\)\{([\s\S]*?)\}\nfunction enhanceLocalAISettings/)?.[1]||'';
assert.match(inferenceBody,/LocalModelRuntimeV266/);
assert.match(inferenceBody,/LocalModelBridgeV266/);
const settingsOpenBody=lifecycle.match(/function ensureLocalAISettingsManagement\(\)\{([\s\S]*?)\}\nfunction captureSettingsOpen/)?.[1]||'';
assert.ok(settingsOpenBody,'ensureLocalAISettingsManagement must remain inspectable');
assert.match(settingsOpenBody,/ensureMinimalManagement/);
assert.doesNotMatch(settingsOpenBody,/bootstrap\.ready|runtime-v266|runtime-bridge|test-pulse-v269|ensureScript\([^\n]*bootstrap/i,'settings open must not load or await inference machinery');
assert.match(settingsOpenBody,/managementOnly:true/);
assert.match(settingsOpenBody,/inferenceDormantOnOpen:true/);

for(const text of ['Downloaded local AI','Download','Resume','Use locally','Remove','Model window','Civweave working default','TTFT']){
  assert.ok(settings.toLowerCase().includes(text.toLowerCase()),`Local settings panel lost ${text}.`);
}
assert.match(settings,/1\.0\.83-local-ai-settings-v282-health/);
assert.match(settings,/truthfulCompletion:true/);
assert.match(settings,/cacheIntegrityOnDemand:true/);
assert.match(settings,/openPath:'snapshot-first-v287'/);

assert.match(pulse,/const VERSION='1\.0\.86-local-model-test-pulse-v286-wasm-performance'/);
assert.match(pulse,/Test model/);
assert.match(pulse,/raceSafeRepair:true/);
assert.match(pulse,/thinkingDisabledForHealth:true/);

assert.match(bootstrap,/REVISION='1\.0\.115-local-ai-bootstrap-v302-session-handoff'/);
assert.match(bootstrap,/capability-contract-v302/);
assert.match(bootstrap,/model-registry-v266\.js\?v=1\.0\.115-v302-gemma3-v4/);
assert.match(bootstrap,/runtime-v266\.js\?v=1\.0\.115-v302-session-handoff/);
assert.match(bootstrap,/settings-panel-v267\.js\?v=1\.0\.91-v288/);
assert.match(bootstrap,/test-pulse-v269\.js\?v=1\.0\.86-v286/);
assert.match(bootstrap,/1\.0\.86-local-model-test-pulse-v286-wasm-performance/);
assert.doesNotMatch(bootstrap,/1\.0\.83-local-model-test-pulse-v282-health/);
assert.match(bootstrap,/download-policy-v278\.js/);
assert.match(bootstrap,/metadata-repair-v276\.js/);
assert.ok(bootstrap.indexOf('download-manager-v267.js')<bootstrap.indexOf('download-policy-v278.js'));
assert.ok(bootstrap.indexOf('download-policy-v278.js')<bootstrap.indexOf('metadata-repair-v276.js'));
assert.match(bootstrap,/backendFallback:true/);
assert.match(bootstrap,/hardwareLadder:true/);
assert.match(bootstrap,/canonicalCausalLM:true/);
assert.match(bootstrap,/artifactRevision/);
assert.match(bootstrap,/smallModelFastPath===true/);
assert.match(controller,/civweave:model-settings-opened/);

for(const token of ["id:'gemma3-1b-it-q4f16'","repo:'onnx-community/gemma-3-1b-it-ONNX'","recommended:'default'","id:'smollm3-3b-q4f16'","id:'qwen3-4b-q4f16'","id:'qwen3-8b-ortgenai-int4'","id:'qwen3-14b-hardware-target'","id:'gemma4-26b-a4b-workstation'",'function directUrl','function artifactRevision','contextWindowTokens:65_536']){
  assert.ok(registry.includes(token),`Registry lost ${token}`);
}
assert.match(downloadPolicy,/preferBackground===false/);
assert.match(downloadPolicy,/largeExternalDataForeground:true/);

// Full inference remains available to chat/test paths. It is deliberately absent from settings open.
assert.match(campus,/bootstrap-v266\.js\?v=1\.0\.83-v282/);
assert.match(campus,/canonicalCausalLM===true/);
assert.match(campus,/CivweaveLocalModelBridgeV266\?\.patch/);

console.log(JSON.stringify({
  ok:true,
  revision:'local-model-settings-mount-v296-management-only',
  canonicalSettingsMount:true,
  settingsFirst:true,
  managementOnlyOnOpen:true,
  inferenceDormantUntilNeeded:true,
  bootstrapTestPulse:'v286-current',
  componentCompatibility:'capability-contract-v302'
},null,2));
