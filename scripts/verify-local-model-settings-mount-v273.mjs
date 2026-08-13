import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [lifecycle,settings,bootstrap,controller,pulse,registry,downloadPolicy]=await Promise.all([
  'public/app/document-lifecycle-v221.js','public/app/local-ai/settings-panel-v267.js','public/app/local-ai/bootstrap-v266.js','public/app/model-settings-controller-v173.js','public/app/local-ai/test-pulse-v269.js','public/app/local-ai/model-registry-v266.js','public/app/local-ai/download-policy-v278.js'
].map(read));
for(const source of [lifecycle,settings,bootstrap,controller,pulse,registry,downloadPolicy])new Function(source);

assert.match(lifecycle,/document-lifecycle-v317-management-only/);
assert.match(lifecycle,/document-lifecycle-v317-explicit-activation/);
assert.match(lifecycle,/searchParams\.get\('activate'\)==='1'/);
assert.match(lifecycle,/ensureLocalAISettingsManagement/);
assert.match(lifecycle,/function scheduleSettingsManagement\(/);
assert.match(lifecycle,/settingsEntryOwner:'settings-gateway-v317'/);
assert.match(lifecycle,/inputOwnership:false/);
assert.match(lifecycle,/managementAfterPaint:true/);
assert.match(lifecycle,/globalObserverPatch:false/);
assert.match(lifecycle,/activationRequired:true/);
assert.match(lifecycle,/launchWork:'none'/);
assert.doesNotMatch(lifecycle,/captureSettingsOpen|document\.addEventListener\('click'/,'management lifecycle must not intercept Settings clicks');
assert.doesNotMatch(lifecycle,/MutationObserver|globalThis\.MutationObserver\s*=/,'management lifecycle must not patch or observe the global DOM');
const managementList=lifecycle.match(/const LOCAL_AI_MANAGEMENT_FILES=\[([\s\S]*?)\n\];/)?.[1]||'';
for(const token of ['model-registry-v266.js','download-manager-v267.js','settings-panel-v267.js','primary-route-v283.js'])assert.ok(managementList.includes(token),`Settings management lost ${token}.`);
for(const forbidden of ['runtime-v266','runtime-bridge-v266','bootstrap-v266','test-pulse-v269','fast-interactive-runtime'])assert.ok(!managementList.includes(forbidden),`Settings management lane includes inference asset ${forbidden}.`);
const settingsOpenBody=lifecycle.match(/function ensureLocalAISettingsManagement\(\)\{([\s\S]*?)\}\nfunction scheduleSettingsManagement/)?.[1]||'';
assert.doesNotMatch(settingsOpenBody,/bootstrap\.ready|runtime-v266|runtime-bridge|test-pulse-v269|new Worker\(|\.generate\(/,'Opening Settings must not start inference.');
for(const text of ['Downloaded local AI','Download','Resume','Use locally','Remove','Model window','Civweave working default','TTFT'])assert.ok(settings.toLowerCase().includes(text.toLowerCase()));
assert.match(settings,/truthfulCompletion:true/);assert.match(settings,/cacheIntegrityOnDemand:true/);assert.match(settings,/openPath:'snapshot-first-v287'/);
assert.match(pulse,/1\.0\.116-local-model-test-pulse-v303-mobile-safe/);assert.match(pulse,/Test model/);assert.match(pulse,/raceSafeRepair:true/);
assert.match(bootstrap,/capability-contract-v307/);assert.match(bootstrap,/package-revision-guard-v307\.js/);assert.match(bootstrap,/backendFallback:true/);assert.match(bootstrap,/canonicalCausalLM:true/);
assert.match(controller,/civweave:model-settings-opened/);assert.match(controller,/activationRequired:true/);assert.match(controller,/eventOwnership:'none-input-owned-by-settings-gateway-v317'/);
for(const token of ["id:'gemma3-1b-it-q4f16'","id:'qwen3-0.6b-q4f16'",'function directUrl','function artifactRevision'])assert.ok(registry.includes(token));
assert.match(downloadPolicy,/largeExternalDataForeground:true/);
console.log(JSON.stringify({ok:true,revision:'local-model-settings-mount-v317-gateway',canonicalSettingsMount:true,settingsEntryOwner:'settings-gateway-v317',firstClickActivation:true,managementOnlyOnOpen:true,managementAfterPaint:true,noSettingsCaptureInLifecycle:true,inferenceDormantUntilNeeded:true},null,2));
