import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [extension,runtime]=await Promise.all([
  read('public/app/local-ai/gemma4-litert-fast-extension-v1.js'),
  read('public/app/local-ai/litert-gemma4-fast-runtime-v1.js')
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

// MTP/speculative decoding is intentionally not claimed until the vendored LiteRT
// runtime is upgraded and verified on real Android WebGPU hardware.
assert.match(runtime,/webBindingSpeculativeDecodingConfigured:false/);
assert.doesNotMatch(runtime,/speculativeDecoding:\s*true/);

console.log(JSON.stringify({
  ok:true,
  profile:'gemma4-12gb-android-litert-dual-v1',
  fastModel:'gemma4-e2b-it-litert-web',
  deepModel:'gemma4-e4b-it-litert-web',
  contextTokens:4096,
  maxOutputTokens:{e2b:2400,e4b:2800},
  engineResidency:'one-at-a-time',
  compatibilityFallback:'existing ONNX Q4/Q2',
  speculativeDecoding:'disabled-until-runtime-upgrade-and-device-benchmark'
},null,2));
