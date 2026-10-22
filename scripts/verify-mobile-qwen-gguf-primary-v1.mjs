import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

const read=path=>readFile(path,'utf8');
const [settings,runtime,gguf,build,stage]=await Promise.all([
  read('public/app/settings-gateway-v317.js'),
  read('public/app/shared/civweave-model-runtime.js'),
  read('public/app/local-ai/browser-gguf-v1.js'),
  read('scripts/build-cloudflare-pages.mjs'),
  read('scripts/stage-wllama-browser-v1.mjs')
]);
new vm.Script(settings,{filename:'settings-gateway-v317.js'});
new vm.Script(runtime,{filename:'civweave-model-runtime.js'});
for(const source of ['public/app/local-ai/browser-gguf-v1.js','scripts/stage-wllama-browser-v1.mjs'])
  execFileSync(process.execPath,['--check',source]);

const keep=settings.indexOf('data-mobile-gguf-panel');
const replaceable=settings.indexOf('data-settings-tab-panel="local-models"');
assert.ok(keep>0&&replaceable>keep,'GGUF controls must stay in persistent AI & safety tab.');
assert.match(settings,/data-embedded-gguf-download/);
assert.match(settings,/data-embedded-gguf-activate/);
assert.match(settings,/gguf\.download\(selected\.url/);
assert.match(settings,/gguf\.activate\(selected\)/);
assert.match(settings,/persist\(\{\.\.\.DEFAULTS,route:'openai-compatible'/);
assert.doesNotMatch(settings,/data-mobile-qwen-connect|checkedPhoneEndpoint|probePhoneGGUF/,'Server-only GGUF UI must be retired.');

assert.match(gguf,/export const GGUF_SELECTION_KEY='civweave\.mobile\.gguf-primary\.v2'/);
assert.match(gguf,/\.modelManager\.downloadModel\(/);
assert.match(gguf,/\.modelManager\.getModels\(/);
assert.match(gguf,/\.validate\(\)==='valid'/);
assert.match(gguf,/\.loadModel\(file,/);
assert.match(gguf,/\.createChatCompletion\(params\)/);
assert.match(gguf,/enable_thinking:false/);
assert.match(gguf,/n_gpu_layers:gpuLayers/);
assert.match(gguf,/n_gpu_layers:[0-9]|create\(0\)/);
assert.match(gguf,/Qwen3\.5-4B-IQ2_M\.gguf/);
assert.match(gguf,/Qwen3\.5-2B-Q4_K_M\.gguf/);
assert.match(gguf,/\.size>24\*1024\*1024|GGUF_NOT_DOWNLOADED/);
assert.doesNotMatch(gguf,/llama-server|\.litertlm|127\.0\.0\.1|chat\/completions/,'Embedded engine must not depend on native server or LiteRT.');

const browserDispatch=runtime.indexOf('const browserGGUF=await import(');
const networkDispatch=runtime.indexOf('const url = openAIChatUrl(config.endpoint, config);',browserDispatch);
assert.ok(browserDispatch>0&&networkDispatch>browserDispatch,'Browser GGUF must intercept before any native HTTP transport.');
assert.match(runtime,/selectedGGUF\.model===config\.model/);
assert.match(runtime,/browserGGUF\.generate\(/);
assert.match(runtime,/emit\(context,'partial'/);
assert.match(runtime,/networkInference:false/);
assert.match(build,/stage-wllama-browser-v1\.mjs/);
assert.match(build,/app\/vendor\/wllama\/esm\/wasm\/wllama\.wasm/);
assert.match(stage,/@wllama\/wllama@3\.8\.1/);
assert.match(stage,/--package-lock=false/);

console.log('Browser-only GGUF contracts: settings, verified cache, native worker runtime, no HTTP inference, and pinned asset stage passed.');
