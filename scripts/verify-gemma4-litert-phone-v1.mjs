import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [extension,runtime,stageRuntime]=await Promise.all([
  read('public/app/local-ai/gemma4-litert-fast-extension-v1.js'),
  read('public/app/local-ai/litert-gemma4-fast-runtime-v1.js'),
  read('scripts/stage-litert-lm-web-assets.mjs')
]);

for(const source of [extension,runtime])new Function(source);

// Exact, pinned Web-optimized Gemma 4 artifacts for the 12 GB Android profile.
assert.match(extension,/gemma4-e2b-it-litert-web/);
assert.match(extension,/gemma4-e4b-it-litert-web/);
assert.match(extension,/73d35ec36cf24347ab4eec1a46f0aafbb9c3a89d/);
assert.match(extension,/4f479a5ff97de64f5c1711ec439a2cb89e6a8fb4/);
assert.match(extension,/2_008_432_640/);
assert.match(extension,/2_969_059_328/);
assert.match(extension,/3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5/);
assert.match(extension,/3904d826d5dddd25ea173e85204caec09e68ba038116e9b992b69cbdc94f57a0/);

// Both legacy Q4 and mobile Q2 model selections transparently accelerate when
// the matching LiteRT artifact is present, preserving ONNX as compatibility fallback.
for(const id of [
  'gemma4-e2b-it-q4f16','gemma4-e2b-it-q2f16-mobile',
  'gemma4-e4b-it-q4f16','gemma4-e4b-it-q2f16-mobile'
]) assert.match(runtime,new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(runtime,/return base\.generate\(args\)/);

// Phone memory discipline: keep one large WebGPU engine resident and release it
// when models change or the page leaves.
assert.match(runtime,/oneEngineAtATime:true/);
assert.match(runtime,/engineModelId!==profile\.id.*?unloadEngine\('switch-model'\)/s);
assert.match(runtime,/civweave:local-model-selection[\s\S]*unloadEngine\('selection-change'\)/);
assert.match(runtime,/pagehide[\s\S]*unloadEngine\('pagehide'\)/);

// Keep prompt/KV memory bounded on a 12 GB phone while allowing full planning output.
assert.match(runtime,/contextTokens:4096/);
assert.match(runtime,/maxOutputTokens:2400/);
assert.match(runtime,/maxOutputTokens:2800/);

// Preserve Gemma's published non-thinking sampler rather than reducing quality to gain speed.
assert.match(extension,/topK:64,topP:\.95,nonThinkingTemperature:1/);
assert.match(runtime,/samplerParams:\{k:64,p:\.95,temperature:1\}/);

// Match LiteRT-LM v0.14's official Web GPU_ARTISAN MTP configuration. If a
// device rejects the submodel path, runtime creation must retry without MTP.
assert.match(runtime,/num_output_candidates:1/);
assert.match(runtime,/wait_for_weight_uploads:true/);
assert.match(runtime,/num_decode_steps_per_sync:1/);
assert.match(runtime,/sequence_batch_size:0/);
assert.match(runtime,/supported_lora_ranks:\[\]/);
assert.match(runtime,/max_top_k:64/);
assert.match(runtime,/enable_decode_logits:false/);
assert.match(runtime,/enable_external_embeddings:false/);
assert.match(runtime,/use_submodel:Boolean\(useSubmodel\)/);
assert.match(runtime,/instantiateEngine\(mod,profile,true\)/);
assert.match(runtime,/instantiateEngine\(mod,profile,false\)/);
assert.match(runtime,/civweave:litert-gemma4-mtp-fallback/);
assert.match(runtime,/webBindingSpeculativeDecodingConfigured:engineUsesMtp/);

// Pages cannot ship LiteRT's >24 MiB Asyncify fallback binaries. The phone
// fast lane therefore requires Chromium's standardized JSPI path; unsupported
// browsers take the existing ONNX fallback before LiteRT is loaded.
assert.match(runtime,/WebAssembly\?\.Suspending/);
assert.match(runtime,/WebAssembly\?\.promising/);
assert.match(runtime,/capability:'webassembly-jspi'/);
assert.match(runtime,/jspiRequired:true/);
assert.match(stageRuntime,/litertlm_wasm_asyncify_internal\.wasm/);
assert.match(stageRuntime,/litertlm_wasm_compat_asyncify_internal\.wasm/);
assert.match(stageRuntime,/omitPagesIncompatibleFallbacks/);
assert.match(stageRuntime,/browserProfile:'chromium-jspi-webgpu'/);
assert.match(stageRuntime,/requiresJspi:true/);
assert.match(stageRuntime,/MAX_CLOUDFLARE_ASSET_BYTES=24\*1024\*1024/);

console.log(JSON.stringify({
  ok:true,
  profile:'gemma4-12gb-android-litert-dual-mtp-jspi-v1',
  fastModel:'gemma4-e2b-it-litert-web',
  deepModel:'gemma4-e4b-it-litert-web',
  contextTokens:4096,
  maxOutputTokens:{e2b:2400,e4b:2800},
  engineResidency:'one-at-a-time',
  compatibilityFallback:'existing ONNX Q4/Q2',
  mtp:'requested-with-safe-non-mtp-engine-fallback',
  webRuntime:'chromium-jspi-webgpu',
  pagesAssetLimitMiB:24,
  asyncifyFallbacks:'excluded-from-pages-output'
},null,2));
