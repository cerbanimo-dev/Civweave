import assert from 'node:assert/strict';
const origin=process.env.CIVWEAVE_STAGING_ORIGIN||'https://civweave-staging.pages.dev';
const root='/app/vendor/transformers-v4/wasm/';
async function get(url,options={}){
  const r=await fetch(new URL(url,origin),{cache:'no-store',headers:{'Cache-Control':'no-cache'},...options});
  assert(r.ok,url+' returned HTTP '+r.status);
  assert(!String(r.headers.get('content-type')||'').includes('text/html'),url+' returned the app-shell HTML fallback');
  return r;
}
const r=await get('/app/vendor/transformers-v4/stage-manifest-asyncify-v8.json');
const m=await r.json();
assert.equal(m.schema,'civweave.transformers-stage.v8','Staging has the old ONNX runtime bundle');
assert.equal(m.asyncifyModule,'ort-wasm-simd-threaded.asyncify.mjs');
assert(Array.isArray(m.asyncifyWasmChunks)&&m.asyncifyWasmChunks.length>=2);
const moduleResponse=await get(root+m.asyncifyModule);
const js=await moduleResponse.text();
assert(js.length>1000&&!/^\s*<(?:html|!doctype)/i.test(js),'Asyncify module is HTML or incomplete');
let bytes=0;
for(const [index,name] of m.asyncifyWasmChunks.entries()){
  assert.equal(name,'ort-wasm-simd-threaded.asyncify.wasm.part'+index);
  const chunk=await get(root+name,{method:'HEAD'});
  const size=Number(chunk.headers.get('content-length')||0);
  assert(size>0&&size<=24*1024*1024,'Invalid published WASM chunk size '+name+': '+size);
  bytes+=size;
}
assert.equal(bytes,m.asyncifyWasmBytes,'Published Asyncify shards do not match the staged build manifest');
const page=await get('/app/local-ai/llama32-two-pass-test-v4.html');
assert.match(await page.text(),/preflightAsyncify/);
const worker=await get('/app/local-ai/llama32-diagnostic-worker-v4.js');
assert.match(await worker.text(),/configuredWasmChunks/);
console.log('PASS: deployed staging serves the complete Asyncify WebGPU module and '+m.asyncifyWasmChunks.length+' WASM shards ('+bytes+' bytes) plus Llama diagnostic v4.');
