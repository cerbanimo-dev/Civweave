import assert from 'node:assert/strict';
const ORIGIN='https://civweave-staging.pages.dev';
const commit=String(process.env.GITHUB_SHA||'').slice(0,40);
const params='gguf_verify='+encodeURIComponent(commit||Date.now().toString());
async function response(path){
  const url=ORIGIN+path+'?'+params;
  const answer=await fetch(url,{headers:{'Cache-Control':'no-cache'}});
  assert.equal(answer.status,200,url+' returned HTTP '+answer.status);
  const type=(answer.headers.get('content-type')||'').toLowerCase();
  assert.ok(!type.includes('text/html'),url+' returned HTML fallback');
  return answer;
}
const js=await response('/app/vendor/wllama/esm/index.js');
const source=await js.text();
assert.ok(source.includes('Wllama')&&source.length>40_000,'Self-hosted GGUF JS loader is missing or unexpectedly small.');
const wasm=await response('/app/vendor/wllama/esm/wasm/wllama.wasm');
const bytes=await wasm.arrayBuffer();
assert.ok(bytes.byteLength>500_000&&bytes.byteLength<24*1024*1024,'Unexpected browser GGUF WASM size.');
assert.deepEqual([...new Uint8Array(bytes,0,4)],[0,97,115,109],'GGUF WASM did not have valid WebAssembly magic bytes.');
const client=await response('/app/local-ai/browser-gguf-v1.js');
assert.ok((await client.text()).includes('GGUF_SELECTION_KEY'),'Embedded GGUF bridge is missing.');
console.log('Verified self-hosted GGUF JS, WASM binary and client bridge at staging origin '+commit);
