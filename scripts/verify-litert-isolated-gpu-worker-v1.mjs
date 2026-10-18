import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const [workerSource,trackerSource,standaloneSource]=await Promise.all([
  readFile('public/app/local-ai/litert-gpu-worker-smoke-v1.js','utf8'),
  readFile('public/app/guide-generation-tracker-v1.js','utf8'),
  readFile('public/app/local-ai/litert-gpu-worker-test-v1.html','utf8')
]);
assert.match(workerSource,/sendMessageStreaming\('READY'\)/);
assert.match(workerSource,/civweave-model-generative-v266/);
assert.match(trackerSource,/data-weave-worker-probe/);
assert.match(trackerSource,/storage\.persist\(\)/);
assert.match(trackerSource,/worker\?\.terminate\(\)/);
assert.match(workerSource,/typeof self\.importScripts==='function'/);
assert.match(trackerSource,/litert-gpu-worker-smoke-v1\.js\?v=1\.0\.1-classic-wasm-loader'\s*,\s*\{type:'classic'\}/);
assert.match(standaloneSource,/litert-gpu-worker-smoke-v1\.js\?v=1\.0\.1-classic-wasm-loader'\s*,\s*\{type:'classic'\}/);
assert.doesNotMatch(trackerSource,/litert-gpu-worker-smoke-v1\.js[^\n]*type:'module'/);
assert.doesNotMatch(standaloneSource,/litert-gpu-worker-smoke-v1\.js[^\n]*type:'module'/);


const reports=[],steps=[];
const mockSDK={
  loadLiteRtLm:async()=>{steps.push('wasm')},
  Engine:{create:async settings=>{
    steps.push('engine');assert.ok(settings.model);
    return{createConversation:async()=>{
      steps.push('conversation');
      return{sendMessageStreaming:async function*(){steps.push('stream');yield {content:[{type:'text',text:'READY'}]}},delete:async()=>{}};
    },delete:async()=>{}}
  }}
};
const self={postMessage:row=>reports.push(row),importScripts:()=>{},__mockSDK:mockSDK};
const context={
  self,globalThis:self,Date,Promise,Error,Object,Boolean,String,Number,Math,
  performance:{now:()=>Date.now()},
  navigator:{gpu:{}},
  WebAssembly:{Suspending(){},promising(){}},
  caches:{open:async()=>({match:async()=>({ok:true,body:{}})})}
};
const instrumented=workerSource.replace('await import(MODULE_URL)','await Promise.resolve(globalThis.__mockSDK)');
assert.notEqual(instrumented,workerSource);
vm.runInNewContext(instrumented,context);
await self.onmessage({data:{
  modelId:'gemma4-e4b-it-litert-web',
  modelUrl:'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/4f479a5ff97de64f5c1711ec439a2cb89e6a8fb4/gemma-4-E4B-it-web.litertlm'
}});
assert.deepEqual(steps,['wasm','engine','conversation','stream']);
assert.equal(reports.at(-1).status,'complete');
assert.ok(reports.some(r=>r.status==='token'&&r.text==='READY'));
assert.equal(reports[0].workerType,'classic');
assert.equal(reports[0].importScriptsAvailable,true);

// A module worker cannot run the upstream WASM loader even when the ESM
// entry module is loaded through dynamic import; reject before touching cache.
const moduleReports=[],moduleSelf={postMessage:row=>moduleReports.push(row),__mockSDK:mockSDK};
const moduleContext={...context,self:moduleSelf,globalThis:moduleSelf};
vm.runInNewContext(instrumented,moduleContext);
await moduleSelf.onmessage({data:{
  modelId:'gemma4-e4b-it-litert-web',
  modelUrl:'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/4f479a5ff97de64f5c1711ec439a2cb89e6a8fb4/gemma-4-E4B-it-web.litertlm'
}});
assert.equal(moduleReports.at(-1).code,'LITERT_CLASSIC_WORKER_REQUIRED');
assert.equal(moduleReports.at(-1).phase,'capabilities');

console.log('PASS: independent GPU worker streams model tokens and UI isolates diagnostics from the learning pipeline.');
