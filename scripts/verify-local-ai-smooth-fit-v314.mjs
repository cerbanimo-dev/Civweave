import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

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

// CPU/WASM compatibility must use available desktop threads rather than being
// permanently crippled to a single lane.
assert.doesNotMatch(runtime,/forceSingleThread:spec\.device==='wasm'/,'WASM fallback must not always be single-threaded');
assert.match(runtime,/spec\.device==='wasm'&&\(!globalThis\.crossOriginIsolated\|\|mobileLike\(\)\|\|hardwareConcurrency\(\)<4\)/,'single-thread WASM must be reserved for unsupported/mobile/low-core devices');
assert.match(worker,/wasmThreads=forceSingleThread\?1:\(isolated\?requestedThreads:1\)/,'worker must retain threaded WASM when eligible');
assert.match(headers,/Cross-Origin-Opener-Policy: same-origin/);
assert.match(headers,/Cross-Origin-Embedder-Policy: credentialless/);

// Keep CPU compatibility responsive enough for interactive chat instead of
// asking a slow fallback to prefill a full WebGPU-sized context and long answer.
assert.match(runtime,/compatibility\?Math\.min\(512,Math\.max\(192,/,'WASM fallback prompt must be capped at 512 tokens');
assert.match(runtime,/compatibility\?Math\.min\(48,Math\.max\(8,/,'WASM fallback output must be capped at 48 tokens');
assert.match(runtime,/compatibilityPromptCap:true/);

// Warm on explicit chat intent, not for the entire platform session.
assert.match(runtime,/function residencyMs\(\).*?hidden.*?30000.*?mobileLike\(\).*?90000.*?300000/s,'residency must be 30s hidden, 90s mobile, 5m desktop');
assert.match(runtime,/function prewarm\(/,'runtime must expose a dedicated prewarm path');
assert.match(runtime,/selected\.device!=='webgpu'.*?compatibility-model-not-prewarmed/s,'CPU fallback must never be prewarmed speculatively');
assert.match(runtime,/addEventListener\('pagehide'.*?shutdown/s,'pagehide must still release the inference worker');
assert.match(owner,/document\.addEventListener\('focusin',prewarmIntent,true\)/,'chat input focus must remain a prewarm trigger');
assert.match(owner,/addEventListener\('civweave:guide-workspace-state',prewarmWorkspace\)/,'opening the canonical chat workspace must begin prewarm before typing');
assert.match(owner,/detail\.open===true&&detail\.minimized!==true/,'minimized/closed chat must not prewarm the model');
assert.match(owner,/intentPrewarm:true/);
assert.match(owner,/chatOpenPrewarm:true/);
assert.match(orchestrator,/CivweaveLocalChatOwnerV295\?\.intentPrewarm===true&&globalThis\.CivweaveLocalChatOwnerV295\?\.chatOpenPrewarm===true/,'orchestrator must reject a stale focus-only chat owner');
assert.match(orchestrator,/chatOpenPrewarm:true/,'orchestrator diagnostics must advertise chat-open prewarm');
assert.match(worker,/message\.type==='prewarm'/,'worker must support model-only prewarm without generation');

// Loading UI may expose per-artifact movement, but the user-facing overall
// percentage must never move backwards within a load phase.
assert.match(worker,/progress_total\?\?p\.progress/,'worker must prefer aggregate Transformers progress when available');
assert.match(worker,/high=Math\.max\(high,pct\)/,'worker must high-water-mark loading progress');
assert.match(owner,/progressOverall\?\?p\?\.progress_total\?\?p\?\.progress/,'chat must prefer monotonic/aggregate load progress');
assert.match(worker,/use_external_data_format/,'single external-data ONNX packages must use the explicit Transformers loader path');

// Recommendations are earned by measured performance, not static RAM labels.
assert.match(hardware,/HEALTH='civweave\.local-ai\.health\.v286'/);
assert.match(hardware,/tokensPerSecond:4/);
assert.match(hardware,/coldStartMs:90000/);
assert.match(hardware,/ttftMs:15000/);
assert.match(hardware,/qwen3-0\.6b-q4f16.*?Best first try/s);
assert.match(hardware,/smollm3-3b-q4f16.*?Benchmark first/s);
assert.match(hardware,/fallbackUsed.*?Fallback only/s,'a fallback result must not promote the selected model');
assert.match(hardware,/deviceFitRecommendations:true/);
assert.match(hardware,/settingsSafeActivation:true/);
assert.match(hardware,/mutationStableSummary:true/);
assert.match(hardware,/if\(node\.textContent!==copy\)node\.textContent=copy/,'device-fit summary must not mutate itself forever');
assert.doesNotMatch(hardware,/\['civweave:model-settings-opened'/,'opening the General settings tab must not probe graphics hardware');
assert.match(settings,/HEALTH='civweave\.local-ai\.health\.v286'/,'settings must read the same health ledger as Test model');

// Management preload must not declare completion before policy, metadata,
// primary-route and device-fit modules have actually loaded.
const managementBody=lifecycle.match(/function localAIManagementReady\(\)\{([\s\S]*?)\}\nfunction localAIInferenceReady/)?.[1]||'';
assert.match(managementBody,/largeExternalDataForeground===true/);
assert.match(managementBody,/metadataOnlyRepair===true/);
assert.match(managementBody,/CivweaveLocalAIPrimaryRouteV283/);
assert.match(managementBody,/deviceFitRecommendations===true/);
assert.match(lifecycle,/deviceFitManagement:true/);

// Same-version stale globals must fail the new capability contract and reload.
assert.match(bootstrap,/adaptiveResidency===true.*?adaptiveWasmThreads===true.*?intentPrewarm===true.*?compatibilityPromptCap===true/s);
assert.match(bootstrap,/deviceFitRecommendations===true/);
assert.match(bootstrap,/smoothFitRuntime:true/);
assert.match(wrapper,/smoothFitRuntime===true/);
assert.match(wrapper,/adaptiveResidency===true.*?adaptiveWasmThreads===true.*?intentPrewarm===true/s);

// The orchestrator is now part of the dedicated network-first local-AI code
// graph so installed PWAs cannot satisfy the new contract with a stale copy.
assert.match(coherence,/CW_LOCAL_AI_EXTRA_PATHS[\s\S]*experience-orchestrator-v232\.js/);
assert.match(coherence,/CW_LOCAL_AI_CRITICAL[\s\S]*experience-orchestrator-v232\.js/);
assert.match(coherence,/smoothFitOrchestrator: true/);

console.log(JSON.stringify({
  ok:true,
  revision:'local-ai-smooth-fit-v314',
  recommendationPolicy:'measured-smoothness-first',
  smoothTarget:{coldStartMs:90000,ttftMs:15000,tokensPerSecond:4},
  residency:{desktopMs:300000,mobileMs:90000,hiddenMs:30000},
  wasm:'adaptive-threading-plus-interactive-context-cap',
  prewarm:'chat-open-or-input-focus',
  progress:'monotonic-overall',
  externalData:'explicit-single-file-path',
  coherence:'orchestrator-network-first'
},null,2));
