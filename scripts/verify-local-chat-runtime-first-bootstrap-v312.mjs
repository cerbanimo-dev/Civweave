import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [localRuntime,orchestrator,bootstrap,registry]=await Promise.all([
  read('public/app/local-chat-runtime-v295.js'),
  read('public/app/experience-orchestrator-v232.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/app/local-ai/model-registry-v266.js')
]);

for(const source of [localRuntime,orchestrator,bootstrap,registry])new Function(source);

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

assert.match(registry,/id:'smollm3-3b-q4f16'.*?installable:true.*?runtime:'transformers-js-v3'/s,'SmolLM3 3B must remain an installable Transformers.js v3 desktop model');
assert.match(registry,/id:'gemma3-1b-it-q4f16'.*?installable:true/s,'Gemma 3 remains independently testable after its download completes');

console.log(JSON.stringify({
  ok:true,
  revision:'local-chat-runtime-first-bootstrap-v312',
  fixes:{
    smollm3DesktopBootstrap:true,
    runtimeReadyBeforeAuxiliaryUI:true,
    auxiliaryFailureNonFatal:true,
    staleRuntimeRevisionRejected:true,
    gemmaDownloadPathUntouched:true
  }
},null,2));
