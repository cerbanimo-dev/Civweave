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
assert.match(trackerSource,/litert-gpu-worker-smoke-v1\.js\?v=1\.0\.13-complete-advanced-settings'\s*,\s*\{type:'classic'\}/);
assert.match(standaloneSource,/litert-gpu-worker-smoke-v1\.js\?v=1\.0\.13-complete-advanced-settings'\s*,\s*\{type:'classic'\}/);
assert.doesNotMatch(trackerSource,/litert-gpu-worker-smoke-v1\.js[^\n]*type:'module'/);
assert.doesNotMatch(standaloneSource,/litert-gpu-worker-smoke-v1\.js[^\n]*type:'module'/);


// Emulate the strict Emscripten WASM AdvancedSettings value_object binding.
// Previous mock accepted partial settings and masked "Missing field" crashes.
const advancedFields=[
  'prefill_batch_sizes','num_output_candidates','configure_magic_numbers',
  'verify_magic_numbers','clear_kv_cache_before_prefill',
  'num_logits_to_print_after_decode','gpu_madvise_original_shared_tensors',
  'is_benchmark','preferred_device_substr','num_threads_to_upload',
  'num_threads_to_compile','convert_weights_on_gpu',
  'optimize_shader_compilation','share_constant_tensors'
];
const reports=[],steps=[],engineSettings=[];
let adapterBindingLimit=268435456;
let invalidWasm=false,failOnLoaderWasm=false,loaderWasmName='litertlm_wasm_asyncify_internal.wasm',mockStreamMode='message-string';
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
  Backend:{GPU_ARTISAN:7},
  loadLiteRtLm:async()=>{steps.push('wasm');if(failOnLoaderWasm)await activeWorker.fetch('/app/local-ai/'+loaderWasmName)},
  Engine:{create:async settings=>{
    steps.push('engine');assert.ok(settings.model);engineSettings.push(settings);
    const adv=settings.mainExecutorSettings?.advancedSettings;
    if(adv){
      for(const field of advancedFields)if(!Object.hasOwn(adv,field))throw Error('Missing field: "'+field+'"');
      assert.ok(Array.isArray(adv.prefill_batch_sizes));
      assert.equal(Object.keys(adv).length,advancedFields.length,'unexpected AdvancedSettings shape');
    }
    return{createConversation:async()=>{
      steps.push('conversation');
      return{sendMessage:async()=>{steps.push('blocking');return {role:'assistant',content:'READY'}},sendMessageStreaming:async function*(){steps.push('stream');if(mockStreamMode==='message-string')yield {role:'assistant',content:'READY'};else if(mockStreamMode==='text-parts')yield {role:'assistant',content:[{type:'text',text:'READY'}]};else if(mockStreamMode==='empty')return;else if(mockStreamMode==='nontext')yield {role:'assistant',channels:{analysis:'internal'},content:[{type:'audio',data:'not-visible'}]};else throw Error('bad mocked stream mode')},delete:async()=>{}};
    },delete:async()=>{}}
  }}
};
const self={postMessage:row=>reports.push(row),location:{href:'https://civweave-staging.pages.dev/'},fetch:fetchMock,importScripts:()=>{},__mockSDK:mockSDK};
activeWorker=self;
const context={
  self,globalThis:self,Date,Promise,Error,Object,Boolean,String,Number,Math,
  performance:{now:()=>Date.now()},
  navigator:{gpu:{requestAdapter:async()=>({limits:{maxStorageBufferBindingSize:adapterBindingLimit,maxBufferSize:2147483648}})}},
  WebAssembly:{Suspending(){},promising(){}},
  caches:{open:async()=>({match:async()=>({ok:true,body:{}})})},
  URL,fetch:fetchMock,Uint8Array,setInterval:()=>1,clearInterval:()=>{}
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
const cases=[
  {mode:'text-parts',expected:'complete',tokens:1},
  {mode:'empty',expected:'LITERT_EMPTY_VISIBLE_OUTPUT',chunks:0},
  {mode:'nontext',expected:'LITERT_EMPTY_VISIBLE_OUTPUT',chunks:1}
];
for(const test of cases){
  mockStreamMode=test.mode;
  const rows=[];
  const newSelf={postMessage:row=>rows.push(row),location:self.location,fetch:fetchMock,importScripts:()=>{},__mockSDK:mockSDK};
  activeWorker=newSelf;
  vm.runInNewContext(instrumented,{...context,self:newSelf,globalThis:newSelf});
  await newSelf.onmessage({data:{
    modelId:'gemma4-e4b-it-litert-web',
    modelUrl:'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/4f479a5ff97de64f5c1711ec439a2cb89e6a8fb4/gemma-4-E4B-it-web.litertlm'
  }});
  assert.equal(rows.at(-1).status,test.expected==='complete'?'complete':'error',test.mode);
  if(test.expected==='complete'){assert.equal(rows.filter(row=>row.status==='token').length,test.tokens)}
  else{
    assert.equal(rows.at(-1).code,test.expected,test.mode);
    assert.equal(rows.at(-1).chunks,test.chunks,test.mode);
    assert.ok(Array.isArray(rows.at(-1).rawShapes));
  }
}
mockStreamMode='message-string';
activeWorker=self;
// Compare one-turn streaming with the LiteRT non-streaming API in a fresh
// worker. A successful blocking result proves model execution separately
// from the underlying async streaming waitUntilDone implementation.
const blockingRows=[],blockingSelf={postMessage:row=>blockingRows.push(row),location:self.location,fetch:fetchMock,importScripts:()=>{},__mockSDK:mockSDK};
activeWorker=blockingSelf;
vm.runInNewContext(instrumented,{...context,self:blockingSelf,globalThis:blockingSelf});
await blockingSelf.onmessage({data:{
  modelId:'gemma4-e4b-it-litert-web',
  modelUrl:'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/4f479a5ff97de64f5c1711ec439a2cb89e6a8fb4/gemma-4-E4B-it-web.litertlm',
  mode:'bounded-blocking'
}});
assert.equal(blockingRows.at(-1).status,'complete');
assert.equal(blockingRows.at(-1).mode,'bounded-blocking');
assert.ok(blockingRows.some(r=>r.status==='token'&&r.text==='READY'));
assert.ok(steps.includes('blocking'));
activeWorker=self;

assert.equal(reports[0].importScriptsAvailable,true);
assert.ok(reports.some(row=>row.status==='asset'&&row.httpStatus===200),'HTTP success must not overwrite the asset event name');
assert.ok(reports.some(r=>r.status==='asset'&&r.valid===true&&r.magic.startsWith('00 61 73 6d')),'a real WASM magic signature is required before inference');
assert.ok(reports.some(r=>r.phase==='wasm-inventory'&&r.omittedWasm?.includes('wasm/litertlm_wasm_asyncify_internal.wasm')));
const previousEngineCount=steps.filter(x=>x==='engine').length;
// The 160 MiB E4B compiled GPU binding must be rejected on a 128 MiB
// adapter before cache reads, WASM initialization or GPU engine creation.
adapterBindingLimit=134217728;
const unsupportedRows=[];
const unsupportedSelf={postMessage:row=>unsupportedRows.push(row),location:self.location,fetch:fetchMock,importScripts:()=>{},__mockSDK:mockSDK};
activeWorker=unsupportedSelf;
vm.runInNewContext(instrumented,{...context,self:unsupportedSelf,globalThis:unsupportedSelf});
await unsupportedSelf.onmessage({data:{
  modelId:'gemma4-e4b-it-litert-web',
  modelUrl:'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/4f479a5ff97de64f5c1711ec439a2cb89e6a8fb4/gemma-4-E4B-it-web.litertlm'
}});
assert.equal(unsupportedRows.at(-1).code,'LITERT_E4B_GPU_STORAGE_BINDING_UNSUPPORTED');
assert.equal(unsupportedRows.at(-1).phase,'gpu-limits');
assert.equal(unsupportedRows.at(-1).requiredBindingBytes,167772160);
assert.equal(unsupportedRows.at(-1).maximumBindingBytes,134217728);
assert.ok(!unsupportedRows.some(row=>row.phase==='wasm-inventory'||row.phase==='engine'));
assert.equal(steps.filter(x=>x==='engine').length,previousEngineCount);
// 512 context tokens also triggered a 160 MiB binding on the real GPU.
// The default GPU backend must reject that known-invalid pair before execution.
const reducedRows=[],reducedSelf={postMessage:row=>reducedRows.push(row),location:self.location,fetch:fetchMock,importScripts:()=>{},__mockSDK:mockSDK};
activeWorker=reducedSelf;
vm.runInNewContext(instrumented,{...context,self:reducedSelf,globalThis:reducedSelf});
await reducedSelf.onmessage({data:{
  modelId:'gemma4-e4b-it-litert-web',
  modelUrl:'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/4f479a5ff97de64f5c1711ec439a2cb89e6a8fb4/gemma-4-E4B-it-web.litertlm',
  contextTokens:512
}});
assert.equal(reducedRows.at(-1).status,'error');
assert.equal(reducedRows.at(-1).code,'LITERT_E4B_GPU_STORAGE_BINDING_UNSUPPORTED');
assert.ok(!reducedRows.some(row=>row.phase==='engine'));
// The legacy GPU_ARTISAN executor is distinct. It must be allowed to run
// with the same -web artifact without assuming the standard GPU bind size.
const legacyRows=[],legacySelf={postMessage:row=>legacyRows.push(row),location:self.location,fetch:fetchMock,importScripts:()=>{},__mockSDK:mockSDK};
activeWorker=legacySelf;
vm.runInNewContext(instrumented,{...context,self:legacySelf,globalThis:legacySelf});
await legacySelf.onmessage({data:{
  modelId:'gemma4-e4b-it-litert-web',
  modelUrl:'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/4f479a5ff97de64f5c1711ec439a2cb89e6a8fb4/gemma-4-E4B-it-web.litertlm',
  backendMode:'legacy-gpu-artisan',contextTokens:512
}});
assert.equal(legacyRows.at(-1).status,'complete');
assert.equal(legacyRows.at(-1).backendMode,'legacy-gpu-artisan');
assert.ok(legacyRows.some(row=>row.phase==='backend-comparison'));
assert.ok(legacyRows.some(row=>row.status==='gpu-limits'&&row.backendExperiment===true));
assert.equal(engineSettings.at(-1).backend,7);
assert.equal(engineSettings.at(-1).mainExecutorSettings.maxNumTokens,512);
assert.equal(engineSettings.at(-1).mainExecutorSettings.backendConfig.use_submodel,false);
assert.equal(engineSettings.at(-1).mainExecutorSettings.advancedSettings.convert_weights_on_gpu,true,'legacy backend uses default weight conversion');
assert.equal(engineSettings.at(-1).mainExecutorSettings.advancedSettings.prefill_batch_sizes.length,0);
assert.equal(engineSettings.at(-1).mainExecutorSettings.backendConfig.use_autosized_ringbuffers,false);
// Compare the two AdvancedSettings variants proposed by upstream #3866.
// They must preserve the same E4B weights, standard GPU backend and context.
for(const backendMode of ['no-gpu-weight-conversion','no-shared-gpu-constants']){
  const comparisonRows=[],comparisonSelf={postMessage:row=>comparisonRows.push(row),location:self.location,fetch:fetchMock,importScripts:()=>{},__mockSDK:mockSDK};
  activeWorker=comparisonSelf;
  vm.runInNewContext(instrumented,{...context,self:comparisonSelf,globalThis:comparisonSelf});
  await comparisonSelf.onmessage({data:{
    modelId:'gemma4-e4b-it-litert-web',
    modelUrl:'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/4f479a5ff97de64f5c1711ec439a2cb89e6a8fb4/gemma-4-E4B-it-web.litertlm',
    backendMode,contextTokens:512
  }});
  assert.equal(comparisonRows.at(-1).status,'complete',backendMode);
  const selectedSettings=engineSettings.at(-1);
  assert.equal(selectedSettings.backend,undefined,backendMode);
  assert.equal(selectedSettings.mainExecutorSettings.maxNumTokens,512,backendMode);
  assert.equal(selectedSettings.mainExecutorSettings.advancedSettings.convert_weights_on_gpu,false,backendMode);
  assert.equal(selectedSettings.mainExecutorSettings.advancedSettings.share_constant_tensors,backendMode==='no-shared-gpu-constants'?false:true,backendMode);
  assert.equal(selectedSettings.mainExecutorSettings.advancedSettings.prefill_batch_sizes.length,0,backendMode);
  assert.equal(selectedSettings.mainExecutorSettings.advancedSettings.num_threads_to_upload,-1,backendMode);
  assert.equal(selectedSettings.mainExecutorSettings.advancedSettings.configure_magic_numbers,true,backendMode);
  assert.ok(comparisonRows.some(row=>row.phase==='backend-comparison'));
}

adapterBindingLimit=268435456;
// Official -gpu artifact may have different compiled kernels. It must be
// tried from the selected File object and must not inherit -web's 160 MiB
// reject decision, even on a 128 MiB adapter.
adapterBindingLimit=134217728;
const gpuStream={from:'official-gpu-file-stream'};
const gpuFile={name:'gemma-4-E4B-it-gpu.litertlm',size:2969059328,stream:()=>gpuStream};
const officialRows=[],officialSelf={postMessage:row=>officialRows.push(row),location:self.location,fetch:fetchMock,importScripts:()=>{},__mockSDK:mockSDK};
activeWorker=officialSelf;
vm.runInNewContext(instrumented,{...context,self:officialSelf,globalThis:officialSelf});
await officialSelf.onmessage({data:{
  modelId:'gemma4-e4b-it-litert-web',
  modelUrl:'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/4f479a5ff97de64f5c1711ec439a2cb89e6a8fb4/gemma-4-E4B-it-web.litertlm',
  artifactKind:'official-gpu-file',
  modelFile:gpuFile,
  contextTokens:2048
}});
assert.equal(officialRows.at(-1).status,'complete');
assert.ok(officialRows.some(row=>row.phase==='local-file'&&row.bytes===gpuFile.size));
assert.ok(officialRows.some(row=>row.status==='gpu-limits'&&row.artifactKind==='official-gpu-file'&&row.compatible===null));
assert.equal(engineSettings.at(-1).model,gpuStream,'official -gpu file must stream directly into LiteRT, without a cache write');
const bogusRows=[],bogusSelf={postMessage:row=>bogusRows.push(row),location:self.location,fetch:fetchMock,importScripts:()=>{},__mockSDK:mockSDK};
activeWorker=bogusSelf;
vm.runInNewContext(instrumented,{...context,self:bogusSelf,globalThis:bogusSelf});
await bogusSelf.onmessage({data:{modelId:'gemma4-e4b-it-litert-web',artifactKind:'official-gpu-file',modelUrl:'https://huggingface.co/litert-community/fake',modelFile:{...gpuFile,size:123}}});
assert.equal(bogusRows.at(-1).code,'INVALID_GPU_TEST_OFFICIAL_FILE');
assert.equal(bogusRows.at(-1).phase,'input');
adapterBindingLimit=268435456;
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
assert.equal(steps.filter(x=>x==='engine').length,previousEngineCount+4,'invalid WASM must never initialize a GPU engine');
invalidWasm=false;
failOnLoaderWasm=true;
const loaderReports=[],loaderSelf={postMessage:row=>loaderReports.push(row),location:self.location,fetch:fetchMock,importScripts:()=>{},__mockSDK:mockSDK};
activeWorker=loaderSelf;
vm.runInNewContext(instrumented,{...context,self:loaderSelf,globalThis:loaderSelf});
await loaderSelf.onmessage({data:{
  modelId:'gemma4-e4b-it-litert-web',
  modelUrl:'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/4f479a5ff97de64f5c1711ec439a2cb89e6a8fb4/gemma-4-E4B-it-web.litertlm'
}});

assert.ok(loaderReports.some(r=>r.phase==='wasm-rewrite'&&r.url.includes('/app/local-ai/litertlm_wasm_asyncify_internal.wasm')&&r.target?.includes('/app/vendor/litert-lm/wasm/')),'rewrite worker-relative Emscripten wasm URL to canonical LiteRT asset');
assert.ok(loaderReports.some(r=>r.status==='asset'&&r.phase==='wasm-request'&&r.resolvedUrl.includes('/app/vendor/litert-lm/wasm/')),'verify canonical wasm was fetched with expected MIME');

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

console.log('PASS: independent LiteRT GPU worker validates streaming, bounded non-streaming, JS event-loop heartbeats, and fails on empty text.');
