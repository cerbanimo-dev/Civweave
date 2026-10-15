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
const engineAttempts=[],events=[];let failDuringDecode=false,failStandard=false;
const fakeModule={
  Backend:{GPU_ARTISAN:'gpu-artisan'},
  getOrLoadGlobalLiteRtLm:async()=>true,
  Engine:{
    create:async settings=>{
      const compatibility=settings.backend==='gpu-artisan';
      engineAttempts.push({compatibility,settings});
      if(!compatibility&&failStandard)throw new Error('Standard SDK backend refused initialization');
      if(compatibility){
        const config=settings.mainExecutorSettings.backendConfig;
        for(const field of fields)assert.ok(Object.hasOwn(config,field),'Missing compatibility field: '+field);
        assert.equal(config.use_submodel,false,'Never enable untested speculative submodel on the phone');
        assert.equal(config.use_autosized_ringbuffers,false);
      }else{
        assert.equal(settings.backend,undefined,'Default LiteRT WebGPU backend must be SDK-managed');
        assert.equal(settings.mainExecutorSettings.backendConfig,undefined,'Do not supply a private GPU_ARTISAN struct on the standard path');
      }
      return{
        createConversation:async conversationConfig=>{
          assert.equal(conversationConfig.preface.extra_context.enable_thinking,false);
          assert.equal(conversationConfig.prefillPrefaceOnInit,true,'Prefill before entering first-token watchdog');
          return{
            sendMessageStreaming:async function*(){
              if(failDuringDecode)throw new Error('Simulated WebGPU decode error');
              yield {content:[{type:'text',text:'{"title":"Tarot Memory System"}'}]};
            },
            getBenchmarkInfo:async()=>({}),
            delete:async()=>{}
          };
        },
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
assert.deepEqual(engineAttempts.map(row=>row.compatibility),[false],'Standard engine should run first without speculative mode');
await engine.unload();
failStandard=true;
const compatible=await engine.runFast({messages:[{role:'user',content:'Teach tarot'}],maxNewTokens:64},EXECUTING);
assert.equal(compatible.outputText,'{"title":"Tarot Memory System"}');
assert.deepEqual(engineAttempts.map(row=>row.compatibility),[false,false,true]);
assert.ok(events.includes('civweave:litert-gemma4-backend-fallback'));


failDuringDecode=true;
await assert.rejects(
  ()=>engine.runFast({messages:[{role:'user',content:'Remember tarot'}]},EXECUTING),
  error=>error.executionModel===EXECUTING&&/Simulated WebGPU decode error/.test(error.message),
  'The returned error must identify E4B as the actual executing model'
);
assert.ok(events.includes('civweave:litert-gemma4-failed'));
console.log(JSON.stringify({ok:true,contract:'litert-0.17.1-standard-webgpu-safe-compat-runtime',fields:fields.length,selected:SELECTED,executed:EXECUTING,mtpDisabled:true,standardWebGpuFirst:true,compatibilityFallback:true,errorAttribution:true},null,2));
