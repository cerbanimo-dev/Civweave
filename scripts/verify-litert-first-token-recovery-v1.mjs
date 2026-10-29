import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/app/local-ai/litert-gemma4-fast-runtime-v1.js',import.meta.url),'utf8');
const moduleImport='import(MODULE_URL)';
assert.equal(source.split(moduleImport).length,2,'The Web SDK entrypoint changed; update this test rather than silently skipping it.');
const E4B='gemma4-e4b-it-litert-web';
let defaultFails=false,failQueue=false,failExecutorMetadata=false;
const attempted=[],configs=[],events=[],chunks=[];
const fakeModule={
  Backend:{GPU_ARTISAN:'gpu-artisan'},
  getOrLoadGlobalLiteRtLm:async()=>true,
  Engine:{create:async settings=>{
    attempted.push(settings);
    if(failExecutorMetadata)throw new Error('Streaming LlmExecutorMetadata section is not supported yet');
    if(defaultFails&&settings.backend===undefined)throw new Error('Default device backend declined initialization');
    if(settings.backend!==undefined){
      assert.equal(settings.backend,'gpu-artisan');
      assert.equal(settings.mainExecutorSettings.backendConfig.use_submodel,false,'Never enable untested MTP on phones');
    }else assert.equal(settings.mainExecutorSettings.backendConfig,undefined,'Private artisan config must not leak into standard backend');
    return{
      createConversation:async config=>{
        configs.push(config);
        if(failQueue)throw new Error('Unknown wgpu::QueueWorkDoneStatus0');
        if(config!==undefined)assert.equal(config.prefillPrefaceOnInit,true);
        return{
          async *sendMessageStreaming(input){
            assert.equal(typeof input,'string');
            chunks.push(input);
            yield{content:[{type:'text',text:'Tarot'}]};
            yield{content:[{type:'text',text:' works'}]};
          },
          getBenchmarkInfo:async()=>({}),
          delete:async()=>{}
        };
      },
      delete:async()=>{}
    };
  }}
};
const sandbox={
  console,Date,Math,Promise,Map,Set,JSON,String,Object,Array,Number,RegExp,Boolean,
  performance:{now:()=>Date.now()},queueMicrotask:()=>{},addEventListener:()=>{},
  CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail}},
  dispatchEvent:event=>{events.push(event);return true},
  WebAssembly:{Suspending:()=>{},promising:()=>{}},navigator:{gpu:{requestAdapter:async()=>({limits:{maxStorageBufferBindingSize:268435456,maxBufferSize:2147483648}})},platform:'Android'},
  caches:{open:async()=>({match:async()=>({ok:true,body:{}})})},
  CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:'gemma4-e2b-it-litert-web'}),status:async()=>({available:true})},
  CivweaveLocalModelRegistryV266:{byId:()=>({artifacts:[{required:true,path:'model.litertlm'}]}),directUrl:()=>'/model.litertlm'},
  __mockModule:fakeModule
};
sandbox.globalThis=sandbox;
vm.runInNewContext(source.replace(moduleImport,'Promise.resolve(globalThis.__mockModule)'),sandbox);
const api=sandbox.CivweaveLiteRTGemma4FastRuntimeV1;
const progress=[],output=[];
const first=await api.runFast({__civweaveStage:'Local Weave Draft',systemPrompt:'You are Moss.',messages:[{role:'user',content:'Teach me tarot.'}],maxNewTokens:32,structuredTool:null,onToken:e=>output.push(e.text),onProgress:e=>progress.push(e.phase)},E4B);
assert.equal(first.outputText,'Tarot works');
assert.equal(first.model.id,E4B);
assert.equal(attempted[0].backend,undefined,'SDK-managed WebGPU must be first');
assert.equal(attempted[0].mainExecutorSettings.maxNumTokens,2048);
assert.deepEqual(output,['Tarot',' works']);
assert.ok(progress.includes('prefilling-preface'));
assert.ok(progress.includes('awaiting-first-token'));
assert.ok(progress.includes('first-stream-chunk'));
assert.equal(api.state().engineMode,'standard');
assert.equal(configs[0].sessionConfig.samplerParams,undefined);
const minimal=await api.runFast({__civweaveProbe:true,messages:[{role:'user',content:'Say READY.'}],maxNewTokens:32},E4B);
assert.equal(minimal.outputText,'Tarot works');
assert.equal(configs[1],undefined,'The diagnostic must use bare createConversation() without any preface');
await api.unload();

defaultFails=true;
const second=await api.runFast({messages:[{role:'user',content:'A second test'}],maxNewTokens:32},E4B);
assert.equal(second.outputText,'Tarot works');
assert.deepEqual(attempted.slice(1).map(x=>x.backend===undefined?'standard':'compat'),['standard','compat']);
assert.equal(api.state().engineMode,'compat');
assert.ok(events.some(e=>e.type==='civweave:litert-gemma4-backend-fallback'));

// The Qwen 3.5 4B hybrid bundle has executor metadata not yet supported by
// LiteRT-LM Web 0.17.1's GPU_ARTISAN streaming engine. Switching Blob/File
// source or retrying the same backend cannot fix it; cache must remain untouched.
await api.unload();
failExecutorMetadata=true;
const attemptsBefore=attempted.length;
await assert.rejects(
  ()=>api.runFast({__civweaveProbe:true,messages:[{role:'user',content:'Say READY.'}],maxNewTokens:32},'qwen35-4b-litert-web'),
  error=>error.code==='LOCAL_LITERT_STREAMING_EXECUTOR_METADATA_UNSUPPORTED'&&
    error.executionModel==='qwen35-4b-litert-web'&&error.retryable===false&&
    /GGUF/.test(error.message)&&/preserved/.test(error.message)
);
assert.equal(attempted.length-attemptsBefore,1,'Do not retry unsupported metadata through the same streaming engine');
assert.equal(api.state().gpuQuarantine,null,'An unsupported model section is not GPU device loss');
failExecutorMetadata=false;

await assert.rejects(
  ()=>api.runFast({systemPrompt:'Plan',messages:[{role:'user',content:'x'.repeat(25000)}],maxNewTokens:900},E4B),
  error=>error.code==='LOCAL_PROMPT_CONTEXT_OVERFLOW'&&error.executionModel===E4B
);
assert.equal(api.state().generationActive,false);
failQueue=true;
await assert.rejects(
  ()=>api.runFast({__civweaveProbe:true,messages:[{role:'user',content:'Say READY.'}],maxNewTokens:32},E4B),
  error=>error.code==='CIVWEAVE_LOCAL_GPU_QUEUE_FAILED'&&error.restartRequired&&error.rawGpuError==='Unknown wgpu::QueueWorkDoneStatus0'
);
assert.ok(api.state().gpuQuarantine,'A failed device must be quarantined, not reused');
await assert.rejects(
  ()=>api.runFast({__civweaveProbe:true,messages:[{role:'user',content:'Say READY.'}]},E4B),
  error=>error.code==='CIVWEAVE_LOCAL_GPU_RESTART_REQUIRED'
);
console.log(JSON.stringify({ok:true,model:E4B,defaultBackendFirst:true,noMtp:true,prefillBeforeFirstToken:true,promptOverflowDetected:true,compatibilityFallback:true},null,2));
