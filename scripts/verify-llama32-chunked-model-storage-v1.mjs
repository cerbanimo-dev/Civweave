import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {importChunkedFile,chunkedStatus,chunkedResponse,chunkCount,chunkPartUrl,chunkManifestUrl,CHUNK_BYTES} from '../public/app/local-ai/llama32-chunked-model-storage-v1.js';

class FakeCache{
  values=new Map();puts=new Map();
  async match(url){return this.values.get(String(url))?.clone()}
  async put(url,response){
    const key=String(url);
    this.values.set(key,response.clone());
    this.puts.set(key,(this.puts.get(key)||0)+1);
  }
  async delete(url){return this.values.delete(String(url))}
}
const cache=new FakeCache(),url='https://huggingface.co/onnx-community/Llama-3.2-3B-Instruct-ONNX/resolve/test/onnx/model_q4f16.onnx_data';
const bytes=CHUNK_BYTES*2+17;
const source=new Blob([new Uint8Array(bytes)]);
const controller=new AbortController();
const emitted=[];
await assert.rejects(()=>importChunkedFile(cache,url,source,{signal:controller.signal,onProgress:row=>{
  emitted.push(row.chunk);
  if(row.chunk===1)controller.abort();
}}),/Import aborted/);
assert.deepEqual(emitted,[1]);
assert.equal((await cache.match(chunkManifestUrl(url))),undefined,'crashed imports must not commit an incomplete manifest');
assert.equal(cache.puts.get(chunkPartUrl(url,0)),1);
const imported=await importChunkedFile(cache,url,source);
assert(imported.available);
assert.equal(imported.bytes,bytes);
assert.equal(imported.chunks,chunkCount(bytes));
assert.equal(cache.puts.get(chunkPartUrl(url,0)),1,'resume must reuse the first completed chunk');
assert.equal((await chunkedStatus(cache,url,bytes)).available,true);
assert.equal((await chunkedStatus(cache,url,bytes+1)).available,false,'wrong model size may not pass');
const response=await chunkedResponse(cache,url,bytes);
assert.equal(Number(response.headers.get('content-length')),bytes);
assert.equal(response.headers.get('x-civweave-chunked-model'),'1');
const data=new Uint8Array(await response.arrayBuffer());
assert.equal(data.length,bytes);
assert.equal(data.at(-1),0);
await cache.delete(chunkPartUrl(url,1));
assert.equal((await chunkedStatus(cache,url,bytes)).available,false,'evicted interior chunk must fail complete status');
const damaged=await chunkedResponse(cache,url,bytes);
await assert.rejects(()=>damaged.arrayBuffer(),/Model fragment 2/);
const page=await readFile('public/app/local-ai/llama32-two-pass-test-v4.html','utf8');
const worker=await readFile('public/app/local-ai/llama32-diagnostic-worker-v4.js','utf8');
const manager=await readFile('public/app/local-ai/download-manager-v267.js','utf8');
assert.match(page,/importChunkedFile\(cache,url,file/);
assert.match(page,/existing\.missing\.some\(row=>Number\(row\.sizeBytes/);
assert.match(page,/llama32-chunked-model-storage-v1\.js/);
assert.match(worker,/chunkedResponse\(cache,url,expected\)/);
assert.match(manager,/chunkedStatus\(c,u,Number\(a\.sizeBytes\|\|0\)\)/);
// Cache lookup must recognize both ONNX external-data shard names. A double-
// escaped JS regex silently rejects both names and reports cached chunks missing.
const runtime=await readFile('public/app/local-ai/worker-v266.js','utf8');
for(const [name,source] of [['two-pass page',page],['download manager',manager],['diagnostic worker',worker],['canonical worker',runtime]]){
  const literals=[...source.matchAll(/\/(?:\\.|[^\/\n])+\/\.test\((?:a\.path|artifact\.path|path)\)/g)].filter(row=>row[0].includes('onnx_data'));
  assert.equal(literals.length,1,name+' must use a single shard-suffix test');
  const literal=literals[0][0].split('.test(')[0];
  const matcher=new RegExp(literal.slice(1,-1));
  assert.equal(matcher.test('onnx/model_q4f16.onnx_data'),true,name+' must recognize first external-data shard');
  assert.equal(matcher.test('onnx/model_q4f16.onnx_data_1'),true,name+' must recognize numbered external-data shard');
  assert.equal(matcher.test('onnx/model_q4f16.onnx'),false,name+' must not mistake graph metadata for weights');
}
assert.doesNotMatch(page,/Model not downloaded on this device\./,'Never report missing weights before checking the offline cache');
assert.match(page,/async function refreshArtifactStatus\(/,'On-open read-only cache status must exist');
assert.match(page,/void refreshArtifactStatus\(\)/,'On-open status must run without loading model weights');

console.log('PASS: low-memory chunked import, resumability after abort, full streamed replay, strict source size, and eviction detection.');