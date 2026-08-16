import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [runtime,worker,hardware,owner,wrapper,orchestrator,bootstrap,lifecycle,settings,coherence,headers]=await Promise.all([
  'public/app/local-ai/runtime-v266.js',
  'public/app/local-ai/worker-v266.js',
  'public/app/local-ai/hardware-tier-ui-v278.js',
  'public/app/local-chat-owner-v295.js',
  'public/app/local-chat-runtime-v295.js',
  'public/app/experience-orchestrator-v232.js',
  'public/app/local-ai/bootstrap-v266.js',
  'public/app/document-lifecycle-v221.js',
  'public/app/local-ai/settings-panel-v267.js',
  'public/service-worker-local-ai-coherence-v307.js',
  'public/_headers'
].map(read));

for(const source of [runtime,worker,hardware,owner,wrapper,orchestrator,bootstrap,lifecycle,settings,coherence])new Function(source);

// Weak-phone WASM execution remains bounded and resource-safe.
assert.doesNotMatch(runtime,/forceSingleThread:spec\.device==='wasm'/);
assert.match(runtime,/spec\.device==='wasm'&&\(!globalThis\.crossOriginIsolated\|\|mobileLike\(\)\|\|hardwareConcurrency\(\)<4\)/);
assert.match(worker,/wasmThreads=forceSingleThread\?1:\(isolated\?requestedThreads:1\)/);
assert.match(headers,/Cross-Origin-Opener-Policy: same-origin/);
assert.match(headers,/Cross-Origin-Embedder-Policy: credentialless/);
assert.match(runtime,/compatibility\?Math\.min\(512,Math\.max\(192,/);
assert.match(runtime,/compatibility\?Math\.min\(48,Math\.max\(8,/);
assert.match(runtime,/compatibilityPromptCap:true/);
assert.match(runtime,/function residencyMs\(\).*?hidden.*?return 0.*?mobileLike\(\).*?15000.*?30000/s);
assert.match(runtime,/visibilitychange.*?hidden.*?shutdown\(\{reason:'tab-hidden'\}\)/s,'hidden tabs must release local model memory immediately');
assert.match(runtime,/idleResidencyStopShip:true/,'resource-safe idle residency contract must be exported');
assert.match(runtime,/function prewarm\(/,'explicit low-level prewarm remains available to non-UI callers');
assert.match(runtime,/selected\.device!=='webgpu'.*?compatibility-model-not-prewarmed/s);
assert.match(runtime,/addEventListener\('pagehide'.*?shutdown/s);

// Generative work starts only when the user submits a turn.
assert.match(owner,/generativePrewarmDisabled:true/);
assert.match(owner,/generativeStartsOnSubmit:true/);
assert.match(owner,/intentPrewarm:false/);
assert.match(owner,/chatOpenPrewarm:false/);
assert.match(owner,/prewarmTrigger:'none'/);
assert.doesNotMatch(owner,/\.prewarm\s*\(/,'chat owner must not prewarm a generative model');
assert.doesNotMatch(owner,/prewarmIntent|prewarmWorkspace|beginPrewarm|local-chat-prewarm-progress/);
assert.doesNotMatch(owner,/civweave:guide-workspace-state/,'chat open/switch must remain presentation-only');
assert.doesNotMatch(owner,/addEventListener\('focusin'/,'chat focus/type must remain presentation-only');
assert.match(orchestrator,/generativePrewarm:false/);
assert.match(orchestrator,/generativeStartsOnSubmit:true/);
assert.doesNotMatch(orchestrator,/chatOpenPrewarm:true|intentPrewarm===true/);

// Worker progress and external-data support stay monotonic and explicit.
assert.match(worker,/message\.type==='prewarm'/,'worker may keep explicit non-UI prewarm protocol');
assert.match(worker,/progress_total\?\?p\.progress/);
assert.match(worker,/high=Math\.max\(high,pct\)/);
assert.match(owner,/progressOverall\?\?p\?\.progress_total\?\?p\?\.progress/);
assert.match(worker,/use_external_data_format/);

// Device-fit policy must prefer the tiny WASM model on weak phones and a stronger
// WebGPU model on capable devices without probing the GPU just to open Settings.
assert.match(hardware,/HEALTH='civweave\.local-ai\.health\.v286'/);
assert.match(hardware,/tokensPerSecond:4/);
assert.match(hardware,/coldStartMs:90000/);
assert.match(hardware,/ttftMs:15000/);
assert.match(hardware,/qwen3-0\.6b-q4f16.*?Best first try/s);
assert.match(hardware,/smollm3-3b-q4f16.*?Benchmark first/s);
assert.match(hardware,/fallbackUsed.*?Fallback only/s);
assert.match(hardware,/deviceFitRecommendations:true/);
assert.match(hardware,/observerFeedbackBounded:true/);
assert.match(hardware,/idempotentSummaryWrites:true/);
assert.match(hardware,/lowEndGeneratorAware:true/);
assert.match(hardware,/settingsOpenGpuProbe:false/);
assert.match(hardware,/explicitHardwareProbe:true/);
const fitStart=hardware.indexOf('function unmeasuredFit('),fitEnd=hardware.indexOf('\nfunction fit(',fitStart);
assert.ok(fitStart>=0&&fitEnd>fitStart,'device-fit fallback policy is missing');
const unmeasuredFit=vm.runInNewContext(`(${hardware.slice(fitStart,fitEnd)})`);
const tiny={id:'smollm2-135m-instruct-q8-wasm'},qwen={id:'qwen3-0.6b-q4f16'};
const weak={webgpuApi:false,mobile:true,memoryGB:2,shaderF16:false};
const strong={webgpuApi:true,mobile:false,memoryGB:8,shaderF16:true};
assert.equal(unmeasuredFit(tiny,weak).state,'recommended','SmolLM2 135M must remain viable without WebGPU');
assert.ok(unmeasuredFit(tiny,weak).rank>unmeasuredFit(qwen,weak).rank,'weak/no-WebGPU devices must prefer SmolLM2 135M over WebGPU models');
assert.ok(unmeasuredFit(qwen,strong).rank>unmeasuredFit(tiny,strong).rank,'capable WebGPU devices should prefer the stronger small WebGPU generator');

// Summary writes are idempotent, preventing recursive Settings observer feedback.
const summaryStart=hardware.indexOf('function summary('),summaryEnd=hardware.indexOf('\nfunction decorate()',summaryStart);
assert.ok(summaryStart>=0&&summaryEnd>summaryStart,'device-fit summary decorator is missing');
const summary=vm.runInNewContext(`(${hardware.slice(summaryStart,summaryEnd)})`,{NOTE:'cw-local-ai-device-fit-v314'});
let summaryText='',summaryWrites=0,observerCallbacks=0;
const summaryNode={get textContent(){return summaryText},set textContent(value){summaryText=String(value);summaryWrites++;observerCallbacks++}};
const summaryPanel={querySelector(){return summaryNode}};
const summaryDevice={webgpuApi:true,cores:8,memoryGB:8,isolated:true};
const decorateSummary=()=>summary(summaryPanel,summaryDevice,{label:'Qwen 3 0.6B'},1);
decorateSummary();
while(observerCallbacks){observerCallbacks--;assert.ok(summaryWrites<20,'device-fit summary entered a recursive observer feedback loop');decorateSummary()}
assert.equal(summaryWrites,1,'unchanged device-fit summary text must not retrigger its MutationObserver');

// Current Settings architecture is view-only until the user performs a model action.
assert.match(settings,/HEALTH='civweave\.local-ai\.health\.v286'/);
assert.match(settings,/snapshotOnlyView:true/);
assert.match(settings,/actionModulesOnDemand:true/);
assert.match(settings,/managerLoadedOnView:false/);
assert.match(settings,/hardwareProbeOnView:false/);
assert.match(settings,/settingsClickOwnership:false/);
assert.match(settings,/settingsPresentationOwnership:false/);
assert.match(lifecycle,/REVISION='document-lifecycle-v323-view-only-actions-lazy'/);
assert.match(lifecycle,/settings-panel-v267\.js\?v=1\.0\.118-v323-view-only/);
assert.match(lifecycle,/viewOnlyOnTab:true/);
assert.match(lifecycle,/actionModulesOnDemand:true/);
assert.match(lifecycle,/settingsEntryOwner:'settings-v320'/);
assert.match(lifecycle,/settingsOwner:'settings-v320'/);
assert.match(lifecycle,/serviceRole:'downloaded-model-settings-view'/);
assert.match(lifecycle,/inputOwnership:false/);
assert.match(lifecycle,/presentationOwnership:false/);
assert.match(lifecycle,/launchWork:'none'/);
assert.match(lifecycle,/explicitTabActivation:true/);

// Bootstrap and chat wrapper both require the tuned runtime capabilities.
assert.match(bootstrap,/adaptiveResidency===true.*?adaptiveWasmThreads===true.*?intentPrewarm===true.*?compatibilityPromptCap===true/s,'low-level runtime capability may remain; UI callers are separately forbidden');
assert.match(bootstrap,/deviceFitRecommendations===true/);
assert.match(bootstrap,/smoothFitRuntime:true/);
assert.match(bootstrap,/componentCompatibility:'capability-contract-v324'/);
assert.match(wrapper,/smoothFitRuntime===true/);
assert.match(wrapper,/adaptiveResidency===true.*?adaptiveWasmThreads===true.*?intentPrewarm===true/s,'low-level runtime capability may remain; UI callers are separately forbidden');

// Local-AI code assets are kept coherent ahead of generic shell caches.
assert.match(coherence,/CW_LOCAL_AI_EXTRA_PATHS[\s\S]*experience-orchestrator-v232\.js/);
assert.match(coherence,/CW_LOCAL_AI_CRITICAL[\s\S]*experience-orchestrator-v232\.js/);
assert.match(coherence,/smoothFitOrchestrator: true/);
assert.match(coherence,/bootstrapCapabilityReadiness: true/);

console.log(JSON.stringify({
  ok:true,
  revision:'local-ai-smooth-fit-v324-view-only-settings',
  recommendationPolicy:'measured-smoothness-first-with-low-end-wasm-floor',
  smoothTarget:{coldStartMs:90000,ttftMs:15000,tokensPerSecond:4},
  residency:{desktopMs:30000,mobileMs:15000,hiddenMs:0},
  wasm:'adaptive-threading-plus-interactive-context-cap',
  prewarm:'forbidden-from-chat-and-settings',
  generativeStart:'submit-only',
  progress:'monotonic-overall',
  externalData:'explicit-single-file-path',
  settingsView:'saved-state-only-actions-lazy-v323',
  settingsDecoration:'bounded-idempotent-observer',
  weakPhoneGenerator:'smollm2-135m-instruct-q8-wasm',
  coherence:'orchestrator-network-first-bootstrap-capability-v308'
},null,2));