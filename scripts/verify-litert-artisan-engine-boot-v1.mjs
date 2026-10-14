import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the real browser runtime with only the external WASM/WebGPU layer mocked.
// This catches a missing LiteRT-LM GPU_ARTISAN struct field before a phone can fail.
const runtime=await readFile(new URL('../public/app/local-ai/litert-gemma4-fast-runtime-v1.js',import.meta.url),'utf8');
const unified=await readFile(new URL('../public/app/unified-chat-system-v1.js',import.meta.url),'utf8');
assert.match(unified,/error\?\.executionModel\|\|config\.model/,'Moss errors must attribute the executing model rather than the selected model');
const importCall='import(MODULE_URL)';
assert.equal(runtime.split(importCall).length,2,'The LiteRT module boundary changed; update the mock harness rather than skipping the test');

const SELECTED='gemma4-e2b-it-litert-web',EXECUTING='gemma4-e4b-it-litert-web';
const fields=['num_output_candidates','wait_for_weight_uploads','num_decode_steps_per_sync','sequence_batch_size','supported_lora_ranks','max_top_k','enable_decode_logits','enable_external_embeddings','use_submodel','prefer_texture_weights','set_enable_host_mapped_pointer','disallow_8bit_convs','use_autosized_ringbuffers'];
const engineAttempts=[],events=[];let failDuringDecode=false;
const fakeModule={
  Backend:{GPU_ARTISAN:'gpu-artisan'},
  getOrLoadGlobalLiteRtLm:async()=>true,
  Engine:{
    create:async settings=>{
      assert.equal(settings.backend,'gpu-artisan');
      const config=settings.mainExecutorSettings.backendConfig;
      for(const field of fields)assert.ok(Object.hasOwn(config,field),'Missing field: "'+field+'"');
      assert.equal(config.use_autosized_ringbuffers,false);
      engineAttempts.push(config);
      // Force the actual MTP fallback; it must preserve the complete config.
      if(config.use_submodel)throw new Error('Test GPU does not support MTP');
      return{
        createConversation:async()=>({
          sendMessageStreaming:async function*(){
            if(failDuringDecode)throw new Error('Simulated WebGPU decode error');
            yield {content:'{"title":"Tarot Memory System"}'};
          },
          getBenchmarkInfo:async()=>({}),
          delete:async()=>{}
        }),
        delete:async()=>{}
      };
    }
  }
};
const sandbox={
  console,Date,Promise,Math,performance:{now:()=>Date.now()},
  queueMicrotask:()=>{},addEventListener:()=>{},
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}},
  dispatchEvent:event=>{events.push(event.type);return true},
  navigator:{gpu:{},platform:'Linux aarch64'},
  WebAssembly:{Suspending:()=>{},promising:()=>{}},
  caches:{open:async()=>({match:async()=>({ok:true,body:{}})})},
  __mockLiteRtLmModule:fakeModule,
  CivweaveLocalModelDownloadV266:{
    selection:()=>({active:true,id:SELECTED}),
    status:async()=>({available:true})
  },
  CivweaveLocalModelRegistryV266:{
    byId:()=>({artifacts:[{required:true,path:'model.litertlm'}]}),
    directUrl:()=>'/test/model.litertlm'
  },
  CivweaveLocalChatRuntimeV295:{generate:async()=>({status:'fallback'})}
};
sandbox.globalThis=sandbox;
vm.runInNewContext(runtime.replace(importCall,'Promise.resolve(globalThis.__mockLiteRtLmModule)'),sandbox,{filename:'litert-gemma4-fast-runtime-v1.js'});
const engine=sandbox.CivweaveLiteRTGemma4FastRuntimeV1;
assert.ok(engine?.runFast);
const result=await engine.runFast({messages:[{role:'user',content:'Teach me tarot'}],structuredTool:null},EXECUTING);
assert.equal(result.status,'success');
assert.equal(result.model.id,EXECUTING,'The selected E2B model must not replace the forced E4B model');
assert.equal(result.outputText,'{"title":"Tarot Memory System"}');
assert.deepEqual(engineAttempts.map(row=>row.use_submodel),[true,false]);
assert.ok(events.includes('civweave:litert-gemma4-mtp-fallback'));

failDuringDecode=true;
await assert.rejects(
  ()=>engine.runFast({messages:[{role:'user',content:'Remember tarot'}]},EXECUTING),
  error=>error.executionModel===EXECUTING&&/Simulated WebGPU decode error/.test(error.message),
  'The returned error must identify E4B as the actual executing model'
);
assert.ok(events.includes('civweave:litert-gemma4-failed'));
console.log(JSON.stringify({ok:true,contract:'litert-0.17.1-gpu-artisan-full-field-e4b-runtime',fields:fields.length,selected:SELECTED,executed:EXECUTING,mtpFallback:true,errorAttribution:true},null,2));
