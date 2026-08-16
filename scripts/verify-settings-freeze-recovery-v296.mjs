import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
await import('./verify-system-ownership-v317.mjs');
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [gateway,controller,lifecycle,hardware,manager,policy,panel,runtime,chatOwner]=await Promise.all([
  'public/app/settings-gateway-v317.js',
  'public/app/model-settings-controller-v173.js',
  'public/app/document-lifecycle-v221.js',
  'public/app/local-ai/hardware-tier-ui-v278.js',
  'public/app/local-ai/download-manager-v267.js',
  'public/app/local-ai/download-policy-v278.js',
  'public/app/local-ai/settings-panel-v267.js',
  'public/app/local-ai/runtime-v266.js',
  'public/app/local-chat-owner-v295.js'
].map(read));
for(const source of [gateway,controller,lifecycle,hardware,manager,policy,panel,runtime,chatOwner])new Function(source);

assert.match(gateway,/launchWork:'none'/);
assert.match(gateway,/singleMenu:true/);
assert.match(gateway,/singleLauncherListener:true/);
assert.match(gateway,/settingsTabsCanonical:true/);
assert.match(gateway,/geminiPresetsBuiltIn:true/);
assert.doesNotMatch(gateway,/data-load-local-model-management/,'The freeze-triggering extra management button returned.');
for(const forbidden of ['prewarm','bootstrap-v266','local-chat-runtime-v295','CivweaveLocalModelRuntimeV266'])assert.ok(!gateway.includes(forbidden),`Settings owner reintroduced forbidden generative startup hook ${forbidden}`);
const openBlock=gateway.slice(gateway.indexOf('function open(launcher)'),gateway.indexOf('function ensure()'));
assert.match(openBlock,/layer\.hidden=false/,'Settings open path does not make the layer visible.');
assert.doesNotMatch(openBlock,/ensureManagement\(/,'Settings open must not initialize downloaded-model management.');
assert.doesNotMatch(openBlock,/local-inference-cancel-requested|requestInferenceQuiescence/,'Settings open must not stop or initialize inference.');
assert.doesNotMatch(openBlock,/requestAdapter|new Worker|\.generate\(/,'Settings open regained heavy model work.');
assert.match(openBlock,/afterPaint\(\(\)=>void ensureSettingsUI\(layer\)\)/,'Only the lightweight shared Settings UI extension may attach after paint.');
const localTabBlock=gateway.slice(gateway.indexOf("if(name==='local-models')"),gateway.indexOf("if(name==='membership')"));
assert.match(localTabBlock,/afterPaint\(\(\)=>void ensureManagement\(layer\)\)/,'Local model management must wait for an explicit Local models tab click and a paint.');
assert.doesNotMatch(localTabBlock,/local-inference-cancel-requested|requestInferenceQuiescence|requestAdapter|new Worker|\.generate\(/);
assert.match(gateway,/const GEMINI_SMALL='gemini-3\.1-flash-lite'/);
assert.match(gateway,/const GEMINI_COMPLEX='gemini-3\.7-flash'/);
assert.match(gateway,/geminiRouting:GEMINI_ROUTING/);

assert.match(controller,/compatibilityFacade:true/);
assert.match(controller,/presentationOwnership:false/);
assert.doesNotMatch(controller,/requestInferenceQuiescence|document\.createElement|addEventListener\('click'/,'Legacy controller regained active Settings behavior.');

assert.match(lifecycle,/explicitTabActivation:true/);
assert.match(lifecycle,/bfCacheAutoManagement:false/);
assert.match(lifecycle,/managementAfterPaint:true/);
assert.match(lifecycle,/globalObserverPatch:false/);
assert.match(lifecycle,/presentationOwnership:false/);
assert.match(lifecycle,/snapshot-first-v322/);
const managementList=lifecycle.match(/const LOCAL_AI_MANAGEMENT_FILES=\[([\s\S]*?)\n\];/)?.[1]||'';
for(const forbidden of ['runtime-v266','runtime-bridge-v266','bootstrap-v266','test-pulse-v269','fast-interactive-runtime'])assert.ok(!managementList.includes(forbidden),`Settings management lane includes inference asset ${forbidden}`);
assert.doesNotMatch(lifecycle,/function revive\(\)[\s\S]*scheduleSettingsManagement\(layer\)/,'BFCache restore must not activate model management by itself.');

assert.match(manager,/autoSyncOnLoad:false/);
assert.match(manager,/explicitSyncOnly:true/);
assert.doesNotMatch(manager,/queueMicrotask\(\(\)=>sync\(\)/);
assert.doesNotMatch(manager,/pageshow[^\n]*sync/);
assert.match(policy,/autoSyncOnLoad:false/);
assert.doesNotMatch(policy,/queueMicrotask\(\(\)=>sync\(\)/);
assert.match(panel,/snapshotOnlyView:true/);
assert.match(panel,/backgroundSyncOnView:false/);
assert.doesNotMatch(panel,/pageshow[^\n]*syncBackgroundJobs/);

assert.match(hardware,/observerFree:true/);
assert.match(hardware,/eventDrivenDecorations:true/);
assert.match(hardware,/settingsOpenGpuProbe:false/);
assert.match(hardware,/explicitHardwareProbe:true/);
assert.doesNotMatch(hardware,/MutationObserver/,'Settings hardware-fit UI must be event-driven, not mutation-driven.');
const decorateBlock=hardware.slice(hardware.indexOf('function decorate()'),hardware.indexOf('function watch()'));
assert.match(decorateBlock,/const device=staticDevice\(\)/);
assert.doesNotMatch(decorateBlock,/requestAdapter|\bprobe\s*\(/,'Automatic Settings decoration must not initialize a WebGPU adapter.');
const probeBlock=hardware.slice(hardware.indexOf('async function probe()'),hardware.indexOf('function linkFor'));
assert.match(probeBlock,/navigator\.gpu\.requestAdapter\(\)/,'Explicit hardware probe should remain available for an explicit test/use action.');

assert.match(runtime,/generationEpoch/);
assert.match(chatOwner,/generativePrewarmDisabled:true/);
assert.match(chatOwner,/generativeStartsOnSubmit:true/);
assert.doesNotMatch(chatOwner,/\.prewarm\s*\(/,'Chat owner must not prewarm generative models while Settings or chat UI is open.');

console.log(JSON.stringify({
  ok:true,
  revision:'settings-freeze-recovery-v322-explicit-tabs',
  singleSettingsInputOwner:true,
  singleSettingsPresentationOwner:true,
  settingsOpenUiOnly:true,
  localModelsExplicitTabOnly:true,
  cacheSyncOnView:false,
  settingsHardwareObserverFree:true,
  settingsOpenGpuProbe:false,
  geminiPresetsBuiltIn:true,
  generativePrewarmOnSettings:false,
  generativePrewarmOnChat:false,
  generativeStartsOnSubmit:true
},null,2));