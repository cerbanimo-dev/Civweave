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
assert.doesNotMatch(runtime,/forceSingleThread:spec\.device==='wasm'/);
assert.match(runtime,/spec\.device==='wasm'&&\(!globalThis\.crossOriginIsolated\|\|mobileLike\(\)\|\|hardwareConcurrency\(\)<4\)/);
assert.match(worker,/wasmThreads=forceSingleThread\?1:\(isolated\?requestedThreads:1\)/);
assert.match(headers,/Cross-Origin-Opener-Policy: same-origin/);
assert.match(headers,/Cross-Origin-Embedder-Policy: credentialless/);
assert.match(runtime,/compatibility\?Math\.min\(512,Math\.max\(192,/);
assert.match(runtime,/compatibility\?Math\.min\(48,Math\.max\(8,/);
assert.match(runtime,/compatibilityPromptCap:true/);
assert.match(runtime,/function residencyMs\(\).*?hidden.*?30000.*?mobileLike\(\).*?90000.*?300000/s);
assert.match(runtime,/function prewarm\(/);
assert.match(runtime,/selected\.device!=='webgpu'.*?compatibility-model-not-prewarmed/s);
assert.match(runtime,/addEventListener\('pagehide'.*?shutdown/s);
assert.match(owner,/document\.addEventListener\('focusin',prewarmIntent,true\)/);
assert.match(owner,/addEventListener\('civweave:guide-workspace-state',prewarmWorkspace\)/);
assert.match(owner,/detail\.open===true&&detail\.minimized!==true/);
assert.match(owner,/intentPrewarm:true/);
assert.match(owner,/chatOpenPrewarm:true/);
assert.match(orchestrator,/CivweaveLocalChatOwnerV295\?\.intentPrewarm===true&&globalThis\.CivweaveLocalChatOwnerV295\?\.chatOpenPrewarm===true/);
assert.match(orchestrator,/chatOpenPrewarm:true/);
assert.match(worker,/message\.type==='prewarm'/);
assert.match(worker,/progress_total\?\?p\.progress/);
assert.match(worker,/high=Math\.max\(high,pct\)/);
assert.match(owner,/progressOverall\?\?p\?\.progress_total\?\?p\?\.progress/);
assert.match(worker,/use_external_data_format/);
assert.match(hardware,/HEALTH='civweave\.local-ai\.health\.v286'/);
assert.match(hardware,/tokensPerSecond:4/);
assert.match(hardware,/coldStartMs:90000/);
assert.match(hardware,/ttftMs:15000/);
assert.match(hardware,/qwen3-0\.6b-q4f16.*?Best first try/s);
assert.match(hardware,/smollm3-3b-q4f16.*?Benchmark first/s);
assert.match(hardware,/fallbackUsed.*?Fallback only/s);
assert.match(hardware,/deviceFitRecommendations:true/);
assert.match(settings,/HEALTH='civweave\.local-ai\.health\.v286'/);
const managementBody=lifecycle.match(/function managementReady\(\)\{([\s\S]*?)\}\nfunction enhance/)?.[1]||'';
assert.match(managementBody,/largeExternalDataForeground===true/);
assert.match(managementBody,/metadataOnlyRepair===true/);
assert.match(managementBody,/metadataRepairRaceSafe===true/);
assert.match(managementBody,/CivweaveLocalAIPrimaryRouteV283/);
assert.match(managementBody,/deviceFitRecommendations===true/);
assert.match(lifecycle,/deviceFitManagement:true/);
assert.match(lifecycle,/completeManagementReadiness:true/);
assert.match(lifecycle,/settingsEntryOwner:'settings-gateway-v317'/);
assert.match(lifecycle,/inputOwnership:false/);
assert.match(bootstrap,/adaptiveResidency===true.*?adaptiveWasmThreads===true.*?intentPrewarm===true.*?compatibilityPromptCap===true/s);
assert.match(bootstrap,/deviceFitRecommendations===true/);
assert.match(bootstrap,/smoothFitRuntime:true/);
assert.match(wrapper,/smoothFitRuntime===true/);
assert.match(wrapper,/adaptiveResidency===true.*?adaptiveWasmThreads===true.*?intentPrewarm===true/s);
assert.match(coherence,/CW_LOCAL_AI_EXTRA_PATHS[\s\S]*experience-orchestrator-v232\.js/);
assert.match(coherence,/CW_LOCAL_AI_CRITICAL[\s\S]*experience-orchestrator-v232\.js/);
assert.match(coherence,/smoothFitOrchestrator: true/);
console.log(JSON.stringify({ok:true,revision:'local-ai-smooth-fit-v317',recommendationPolicy:'measured-smoothness-first',smoothTarget:{coldStartMs:90000,ttftMs:15000,tokensPerSecond:4},residency:{desktopMs:300000,mobileMs:90000,hiddenMs:30000},wasm:'adaptive-threading-plus-interactive-context-cap',prewarm:'chat-open-or-input-focus',progress:'monotonic-overall',externalData:'explicit-single-file-path',management:'complete-on-demand-v317',coherence:'orchestrator-network-first'},null,2));
