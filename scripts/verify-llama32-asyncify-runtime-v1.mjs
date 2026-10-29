import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const stage=read('scripts/stage-transformers-v4-assets.mjs');
const build=read('scripts/build-cloudflare-pages.mjs');
const registry=read('public/app/local-ai/model-registry-v266.js');
const page=read('public/app/local-ai/llama32-two-pass-test-v4.html');
const sourceManifest='public/app/vendor/transformers-v4/stage-manifest-asyncify-v8.json';
assert.match(stage,/ORT_ASYNC_MJS='ort-wasm-simd-threaded\.asyncify\.mjs'/);
assert.match(stage,/ORT_ASYNC_WASM='ort-wasm-simd-threaded\.asyncify\.wasm'/);
assert.match(stage,/asyncifyWasmChunks:asyncSplit\.names/);
assert.match(build,/ort-wasm-simd-threaded\.asyncify\.mjs/);
assert.match(build,/ort-wasm-simd-threaded\.asyncify\.wasm\.part0/);
assert.match(registry,/const LLAMA32_ASYNCIFY_WASM_CHUNKS=/);
const entry=registry.split('\n').find(line=>line.includes("id:'llama32-3b-instruct-q4f16'"));
assert(entry&&entry.includes('wasmChunks:LLAMA32_ASYNCIFY_WASM_CHUNKS'),'Llama must load Asyncify WASM, not the Gemma JSEP binary');
assert.match(page,/asyncifyWasmChunks/);
assert.match(page,/preflightAsyncify/);
assert.match(page,/\.asyncify\.mjs/);
new Function(page.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import\s+.*;\s*$/gm,''));
if(process.argv.includes('--built')){
  const m=JSON.parse(read(sourceManifest));
  assert.equal(m.schema,'civweave.transformers-stage.v8');
  const gemma=JSON.parse(read('public/app/vendor/transformers-v4/stage-manifest.json'));
  assert.equal(gemma.schema,'civweave.transformers-stage.v7','Existing Gemma runtime repair must continue to accept staging manifest');
  assert.equal(m.asyncifyModule,'ort-wasm-simd-threaded.asyncify.mjs');
  assert(m.asyncifyWasmChunks.length>=2);
  for(const name of [m.asyncifyModule,...m.asyncifyWasmChunks]){
    const target='public/app/vendor/transformers-v4/wasm/'+name;
    assert(existsSync(target),'Missing packaged runtime: '+target);
    assert(statSync(target).size>0&&statSync(target).size<=24*1024*1024,'Cloudflare Pages size limit violated: '+target);
  }
  assert.equal(m.asyncifyWasmChunks.reduce((size,name)=>size+statSync('public/app/vendor/transformers-v4/wasm/'+name).size,0),m.asyncifyWasmBytes);
  console.log('PASS: pinned Asyncify JS/WASM pair is staged, sharded, byte complete, and Cloudflare Pages compatible.');
}else console.log('PASS: Llama WebGPU Asyncify runtime is explicitly staged and selected by the model registry.');
