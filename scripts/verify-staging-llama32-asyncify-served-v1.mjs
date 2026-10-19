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
  // Cloudflare Pages can omit Content-Length from a successful HEAD response,
  // especially for static binary assets served with chunked transfer encoding.
  // HEAD=200 with size=0 is not evidence of an empty .wasm.part file.
  let size=Number(chunk.headers.get('content-length')||0);
  if(!size){
    const actual=await get(root+name,{method:'GET',headers:{
      'Cache-Control':'no-cache','Range':'bytes=0-0'
    }});
    const range=actual.headers.get('content-range')||'';
    const match=range.match(/^bytes 0-0\\/(\\d+)$/i);
    if(actual.status===206&&match){
      size=Number(match[1]);
      await actual.body?.cancel?.();
    }else{
      // The host ignored Range or omitted byte headers; validate actual bytes
      // rather than trusting transport metadata or declaring false failure.
      size=0;
      for await (const part of actual.body||[]){size+=part.byteLength;assert(size<=24*1024*1024,'Oversized Asyncify WASM shard '+name)}
    }
  }
  assert(size>0&&size<=24*1024*1024,'Invalid published WASM chunk size '+name+': '+size);
  bytes+=size;
}
assert.equal(bytes,m.asyncifyWasmBytes,'Published Asyncify shards do not match the staged build manifest');
const page=await get('/app/local-ai/llama32-two-pass-test-v4.html');
assert.match(await page.text(),/preflightAsyncify/);
const worker=await get('/app/local-ai/llama32-diagnostic-worker-v4.js');
assert.match(await worker.text(),/configuredWasmChunks/);
console.log('PASS: deployed staging serves the complete Asyncify WebGPU module and '+m.asyncifyWasmChunks.length+' WASM shards ('+bytes+' bytes) plus Llama diagnostic v4.');
