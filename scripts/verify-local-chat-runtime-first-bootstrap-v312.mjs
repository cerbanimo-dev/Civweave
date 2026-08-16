import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [localRuntime,orchestrator,bootstrap,registry,downloadManager,downloadPolicy,settings,hardware]=await Promise.all([
  read('public/app/local-chat-runtime-v295.js'),
  read('public/app/experience-orchestrator-v232.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/app/local-ai/model-registry-v266.js'),
  read('public/app/local-ai/download-manager-v267.js'),
  read('public/app/local-ai/download-policy-v278.js'),
  read('public/app/local-ai/settings-panel-v267.js'),
  read('public/app/local-ai/hardware-tier-ui-v278.js')
]);

for(const source of [localRuntime,orchestrator,bootstrap,registry,downloadManager,downloadPolicy,settings,hardware])new Function(source);

assert.match(localRuntime,/REVISION='v312-runtime-first-bootstrap'/,'local chat must advertise the runtime-first bootstrap revision');
assert.match(localRuntime,/bootstrap-v266\.js\?v=1\.0\.124-v312-runtime-first-bootstrap/,'local chat must request a fresh bootstrap epoch');
assert.match(localRuntime,/function waitForRuntime\(/,'local chat must independently observe the inference runtime becoming compatible');
assert.match(localRuntime,/Promise\.race\(\[Promise\.resolve\(boot\?\.ready\).*waitForRuntime\(BOOT_READY_TIMEOUT_MS\)/s,'runtime readiness must race the full bootstrap instead of waiting for every auxiliary module');
assert.match(localRuntime,/if\(runtimeReady\(\)\|\|outcome\?\.runtime\)/,'a compatible inference runtime must be sufficient to start chat');
assert.match(localRuntime,/bootstrapAuxiliaryFailureNonFatal:true/,'local chat must explicitly mark auxiliary bootstrap failure as non-fatal');
assert.match(localRuntime,/runtimeFirstBootstrap:true/,'runtime-first startup capability must be exposed');
assert.match(localRuntime,/runtime-ready-bootstrap-auxiliary-degraded/,'auxiliary bootstrap degradation must remain diagnosable');
assert.match(localRuntime,/without a compatible inference runtime after a clean reload/,'the terminal startup error must now describe the actual failed contract');

assert.match(orchestrator,/local-chat-runtime-v295\.js\?v=1\.0\.124-v312-runtime-first-bootstrap/,'orchestrator must cache-bust the repaired local chat runtime');
assert.match(orchestrator,/CivweaveLocalChatRuntimeV295\?\.revision==='v312-runtime-first-bootstrap'/,'orchestrator must reject the pre-v312 resident runtime');
assert.match(orchestrator,/runtimeFirstBootstrap:true/,'chat readiness diagnostics must expose runtime-first startup');

const runtimeIndex=bootstrap.indexOf("'/app/local-ai/runtime-v266.js");
const bridgeIndex=bootstrap.indexOf("'/app/local-ai/runtime-bridge-v266.js");
const settingsIndex=bootstrap.indexOf("'/app/local-ai/settings-panel-v267.js");
assert.ok(runtimeIndex>=0&&bridgeIndex>runtimeIndex&&settingsIndex>runtimeIndex,'bootstrap still loads auxiliary bridge/settings after the inference runtime, so chat must not couple its success to those later modules');

// Mutable support modules must be accepted by capability rather than frozen exact-version
// checks. Their release cadence is independent of the inference ABI, and exact pinning here
// previously prevented the runtime from loading after clean reloads.
assert.match(downloadManager,/explicitSyncOnly:true/);
assert.match(downloadManager,/autoSyncOnLoad:false/);
assert.match(downloadPolicy,/largeExternalDataForeground:true/);
assert.match(downloadPolicy,/explicitSyncOnly:true/);
assert.match(settings,/snapshotOnlyView:true/);
assert.match(settings,/settingsClickOwnership:false/);
assert.match(hardware,/deviceFitRecommendations:true/);
assert.match(hardware,/settingsOpenGpuProbe:false/);
assert.match(bootstrap,/const downloadManagerReady=.*?explicitSyncOnly===true.*?autoSyncOnLoad===false/s);
assert.match(bootstrap,/const downloadPolicyReady=.*?largeExternalDataForeground===true.*?explicitSyncOnly===true/s);
assert.match(bootstrap,/const settingsReady=.*?snapshotOnlyView===true.*?settingsClickOwnership===false.*?settingsPresentationOwnership===false/s);
assert.match(bootstrap,/const hardwareTierReady=.*?deviceFitRecommendations===true.*?settingsOpenGpuProbe===false/s);
assert.match(bootstrap,/download-manager-v267\.js\?v=1\.0\.68-v322-explicit-sync/);
assert.match(bootstrap,/download-policy-v278\.js\?v=1\.0\.82-v322-explicit-sync/);
assert.match(bootstrap,/settings-panel-v267\.js\?v=1\.0\.118-v323-view-only/);
assert.match(bootstrap,/hardware-tier-ui-v278\.js\?v=1\.0\.82-v321-settings-open-idle/);
assert.match(bootstrap,/mutableComponentCapabilityReadiness:true/);
assert.doesNotMatch(bootstrap,/CivweaveLocalModelDownloadV266\?\.version==='1\.0\.67-local-ai-download-v271-integrity'/,'bootstrap must not freeze the download manager to the retired v271 version');
assert.doesNotMatch(bootstrap,/CivweaveLocalModelDownloadPolicyV278\?\.version==='1\.0\.81-local-ai-download-policy-v278-foreground-large-files'/,'bootstrap must not freeze the download policy to the retired v278 version');
assert.doesNotMatch(bootstrap,/CivweaveLocalAISettingsV266.*?version==='1\.0\.116-local-ai-settings-v305-download-dock-layout'/s,'bootstrap must not freeze Settings content to the retired v305 version');
assert.doesNotMatch(bootstrap,/CivweaveLocalModelHardwareTierUIV278\?\.version==='1\.0\.81-local-ai-hardware-tier-ui-v278'/,'bootstrap must not freeze hardware recommendations to the retired version');

assert.match(registry,/id:'smollm2-135m-instruct-q8-wasm'.*?installable:true.*?repo:'onnx-community\/SmolLM2-135M-Instruct-ONNX'.*?dtype:'q8'.*?device:'wasm'/s,'SmolLM2 135M must remain the weak-phone CPU/WASM generator');
assert.match(registry,/id:'smollm3-3b-q4f16'.*?installable:true.*?runtime:'transformers-js-v3'/s,'SmolLM3 3B must remain an installable Transformers.js v3 desktop model');
assert.match(registry,/id:'gemma3-1b-it-q4f16'.*?installable:true/s,'Gemma 3 remains independently testable after its download completes');

console.log(JSON.stringify({
  ok:true,
  revision:'local-chat-runtime-first-bootstrap-v324-capability-readiness',
  fixes:{
    smollm2WeakPhoneBootstrap:true,
    smollm3DesktopBootstrap:true,
    runtimeReadyBeforeAuxiliaryUI:true,
    auxiliaryFailureNonFatal:true,
    mutableSupportModulesCapabilityGated:true,
    staleRuntimeRevisionRejected:true,
    gemmaDownloadPathUntouched:true
  }
},null,2));
