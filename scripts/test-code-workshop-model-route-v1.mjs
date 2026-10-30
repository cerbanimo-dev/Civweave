import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCodeInferenceRoute,normalizeCodeInferenceResult,runCodeInference} from '../public/creator-suite/shared/code-inference-route-v1.mjs';

test('selected downloaded local provider uses canonical local runtime, not bare shared runtime',()=>{
 const route=resolveCodeInferenceRoute({provider:'downloaded-local',model:'qwen35-4b-litert-web'},{active:true,id:'qwen35-4b-litert-web'});
 assert.equal(route.kind,'downloaded-local');
 assert.equal(route.model,'qwen35-4b-litert-web');
});
test('provider explicit routing does not silently replace remote or manual routes',()=>{
 for (const provider of ['gemini','ollama','openai-compatible','hosted','manual','deterministic']){
  assert.equal(resolveCodeInferenceRoute({provider,model:'saved'},{active:true,id:'qwen'}).kind,'shared');
 }
 assert.equal(resolveCodeInferenceRoute({provider:'server-auto'},{active:true,id:'qwen'}).kind,'server-auto');
 assert.equal(resolveCodeInferenceRoute({provider:'cloudflare-workers-ai'},{active:false}).kind,'server-auto');
 assert.equal(resolveCodeInferenceRoute({provider:'browser'},{active:false}).kind,'shared');
 assert.equal(resolveCodeInferenceRoute({provider:'browser'},{active:true,id:'qwen'}).kind,'downloaded-local');
});
test('local config must have a selected installed model',()=>{
 assert.throws(()=>resolveCodeInferenceRoute({provider:'downloaded-local'},{active:false}),/selected downloaded local model/i);
});
test('success result preserves provider, JSON and tokens',()=>{
 const value=normalizeCodeInferenceResult({status:'success',outputText:'{"type":"done"}',usage:{outputTokens:9}},'qwen');
 assert.equal(value.status,'success');assert.equal(value.actual.provider,'downloaded-local');assert.equal(value.outputText,'{"type":"done"}');
 assert.equal(value.usage.outputTokens,9);
});
test('direct local inference calls canonical local owner without requiring model-runtime.generate',async()=>{
 let calls=0,progress=0;
 const result=await runCodeInference({provider:'downloaded-local',model:'qwen'},[{role:'system',content:'Do this'},{role:'user',content:'Write code'}],{
   selection:{active:true,id:'qwen'},
   loadLocal:async()=>({generate:async args=>{calls++;assert.equal(args.systemPrompt,'Do this');assert.deepEqual(args.messages,[{role:'user',content:'Write code'}]);args.onProgress({phase:'generating'});return {status:'success',outputText:'{"type":"done"}'};}}),
   sharedRuntime:null,
   onProgress:()=>progress++
 });
 assert.equal(result.status,'success');assert.equal(calls,1);assert.equal(progress,1);
});
test('remote provider retains shared runtime and explicit failure',async()=>{
 let calls=0;
 const result=await runCodeInference({provider:'ollama',model:'qwen3.5:4b'},[{role:'user',content:'Hello'}],{
  selection:{active:true,id:'qwen'},
  loadLocal:async()=>{throw Error('Must not load local')},
  sharedRuntime:{generate:async request=>{calls++;assert.equal(request.config.provider,'ollama');return {status:'provider-error',error:{code:'DISCONNECTED',message:'Unreachable'}};}}
 });
 assert.equal(calls,1);assert.equal(result.status,'provider-error');
});

test('server auto delegates to canonical Guild/Cloudflare router without falling through bare model runtime',async()=>{
 let local=0,shared=0,server=0;
 const result=await runCodeInference({provider:'server-auto',model:'civweave-server-auto-v1'},[{role:'user',content:'Write code'}],{
   selection:null,loadLocal:async()=>{local++;},loadServer:async()=>({handle:async req=>{server++;assert.equal(req.config.provider,'server-auto');assert.equal(req.responseFormat,'json');return{handled:true,result:{status:'success',outputText:'{\"type\":\"done\"}',actual:{provider:'cloudflare-workers-ai',model:'test'}}};}}),
   sharedRuntime:{generate:async()=>{shared++;}}
 });
 assert.equal(server,1);assert.equal(local,0);assert.equal(shared,0);assert.equal(result.actual.provider,'cloudflare-workers-ai');
});
