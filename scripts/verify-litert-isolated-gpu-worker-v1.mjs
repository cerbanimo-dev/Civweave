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
assert.match(trackerSource,/litert-gpu-worker-smoke-v1\.js\?v=1\.0\.4-wasm-assets-with-status-fix'\s*,\s*\{type:'classic'\}/);
assert.match(standaloneSource,/litert-gpu-worker-smoke-v1\.js\?v=1\.0\.4-wasm-assets-with-status-fix'\s*,\s*\{type:'classic'\}/);
assert.doesNotMatch(trackerSource,/litert-gpu-worker-smoke-v1\.js[^\n]*type:'module'/);
assert.doesNotMatch(standaloneSource,/litert-gpu-worker-smoke-v1\.js[^\n]*type:'module'/);


const reports=[],steps=[];
let invalidWasm=false,failOnLoaderWasm=false;
const wasmBytes=Uint8Array.from([0,97,115,109,1,0,0,0]);
const htmlBytes=Uint8Array.from([60,33,100,111,99,116,121,112]);
const modelManifest={coreVersion:'0.17.1',wasmFiles:['wasm/litertlm_wasm_internal.wasm'],omittedFiles:[{path:'wasm/litertlm_wasm_asyncify_internal.wasm',bytes:8,parts:['wasm/litertlm_wasm_asyncify_internal.wasm.part0']}]};
let activeWorker=null;
const fetchMock=async input=>{
  const url=String(typeof input==='string'?input:input?.url||input);
  if(url.includes('stage-manifest.json'))return{ok:true,status:200,url,headers:{get:()=> 'application/json'},json:async()=>modelManifest};
  const bytes=invalidWasm?htmlBytes:wasmBytes;
  return{ok:true,status:200,url,redirected:false,headers:{get:()=>invalidWasm?'text/html':'application/wasm'},body:{getReader:()=>{
    let emitted=false;return{read:async()=>emitted?{done:true}:{done:false,value:bytes},cancel:async()=>{emitted=true}}
  }}};
};

const mockSDK={
  loadLiteRtLm:async()=>{steps.push('wasm');if(failOnLoaderWasm)await activeWorker.fetch('/app/vendor/litert-lm/wasm/litertlm_wasm_asyncify_internal.wasm')},
  Engine:{create:async settings=>{
    steps.push('engine');assert.ok(settings.model);
    return{createConversation:async()=>{
      steps.push('conversation');
      return{sendMessageStreaming:async function*(){steps.push('stream');yield {content:[{type:'text',text:'READY'}]}},delete:async()=>{}};
    },delete:async()=>{}}
  }}
};
const self={postMessage:row=>reports.push(row),location:{href:'https://civweave-staging.pages.dev/'},fetch:fetchMock,importScripts:()=>{},__mockSDK:mockSDK};
activeWorker=self;
const context={
  self,globalThis:self,Date,Promise,Error,Object,Boolean,String,Number,Math,
  performance:{now:()=>Date.now()},
  navigator:{gpu:{}},
  WebAssembly:{Suspending(){},promising(){}},
  caches:{open:async()=>({match:async()=>({ok:true,body:{}})})},
  URL,fetch:fetchMock,Uint8Array
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
assert.ok(reports.some(row=>row.status==='asset'&&row.httpStatus===200),'HTTP success must not overwrite the asset event name');
assert.ok(reports.some(r=>r.status==='asset'&&r.valid===true&&r.magic.startsWith('00 61 73 6d')),'a real WASM magic signature is required before inference');
assert.ok(reports.some(r=>r.phase==='wasm-inventory'&&r.omittedWasm?.includes('wasm/litertlm_wasm_asyncify_internal.wasm')));
const previousEngineCount=steps.filter(x=>x==='engine').length;
invalidWasm=true;
const badReports=[],badSelf={postMessage:row=>badReports.push(row),location:self.location,fetch:fetchMock,importScripts:()=>{},__mockSDK:mockSDK};
activeWorker=badSelf;
vm.runInNewContext(instrumented,{...context,self:badSelf,globalThis:badSelf});
await badSelf.onmessage({data:{
  modelId:'gemma4-e4b-it-litert-web',
  modelUrl:'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/4f479a5ff97de64f5c1711ec439a2cb89e6a8fb4/gemma-4-E4B-it-web.litertlm'
}});
assert.equal(badReports.at(-1).code,'LITERT_STAGED_WASM_NOT_BINARY');
assert.equal(badReports.at(-1).phase,'wasm-inventory');
assert.equal(steps.filter(x=>x==='engine').length,previousEngineCount,'invalid WASM must never initialize a GPU engine');
invalidWasm=false;
failOnLoaderWasm=true;
const loaderReports=[],loaderSelf={postMessage:row=>loaderReports.push(row),location:self.location,fetch:fetchMock,importScripts:()=>{},__mockSDK:mockSDK};
activeWorker=loaderSelf;
vm.runInNewContext(instrumented,{...context,self:loaderSelf,globalThis:loaderSelf});
await loaderSelf.onmessage({data:{
  modelId:'gemma4-e4b-it-litert-web',
  modelUrl:'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/4f479a5ff97de64f5c1711ec439a2cb89e6a8fb4/gemma-4-E4B-it-web.litertlm'
}});
assert.ok(loaderReports.some(r=>r.phase==='wasm-request'&&r.url.includes('asyncify')),'capture the exact additional runtime WASM request');
failOnLoaderWasm=false;


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
