#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/app/local-ai/ios-webgpu-qwen-v1.js','utf8');
const settings=readFileSync('public/app/settings-gateway-v317.js','utf8');
const runtime=readFileSync('public/app/shared/civweave-model-runtime.js','utf8');
const campus=readFileSync('public/app/working-campus-v440.html','utf8');
const standalone=readFileSync('public/app/ios-webgpu-qwen-test-v1.html','utf8');
const downloads=readFileSync('public/app/settings-local-models-direct-v325.js','utf8');
new Function(settings);new Function(runtime);
for(const id of ['qwen35-08b-onnx-webgpu','qwen35-2b-onnx-webgpu','qwen35-4b-onnx-webgpu'])
  assert.ok(source.includes(id),'missing iOS WebGPU model choice: '+id);
for(const repo of ['onnx-community/Qwen3.5-0.8B-ONNX-OPT','onnx-community/Qwen3.5-2B-ONNX-OPT','onnx-community/Qwen3.5-4B-ONNX-OPT'])
  assert.ok(source.includes(repo),'expected official HF browser ONNX model: '+repo);
assert.ok(source.includes("const TRANSFORMERS='/app/vendor/transformers-v4/transformers.min.js'"));
assert.ok(source.includes('Qwen3_5ForConditionalGeneration.from_pretrained'));
assert.ok(source.includes("hf.env.useBrowserCache=true"));
assert.ok(source.includes("skip_prompt:true,skip_special_tokens:true"));
assert.match(settings,/data-ios-webgpu-model/);
assert.match(settings,/api\.mount\(target,\{activate/);
assert.match(settings,/localApiFlavor:'ios-webgpu',stream:true/);
assert.match(runtime,/config\.localApiFlavor==='ios-webgpu'/);
assert.match(runtime,/return\{text:run\.text,model:run\.model,streamed:run\.streamed,backend:run\.backend/);
assert.match(runtime,/networkInference:false/);
assert.match(runtime,/config\.localApiFlavor\?\{localApiFlavor:config\.localApiFlavor,stream:config\.stream\}/);
assert.match(campus,/settings-gateway-v317\.js\?v=1\.0\.139-ios-webgpu-qwen35/);
assert.match(standalone,/Qwen 3\.5 0\.8B/);
assert.match(standalone,/from '\/app\/local-ai\/ios-webgpu-qwen-v1\.js\?v=/);
assert.match(standalone,/Test streamed tokens/);
assert.match(downloads,/data-direct-open-ios-webgpu/);
assert.match(downloads,/safariWebGPUMarkup/);
const actualImport='import(TRANSFORMERS)';
assert.equal(source.split(actualImport).length,3,'mock exactly two SDK imports for an isolated regression');
const instrumented=source.replaceAll(actualImport,'Promise.resolve(globalThis.__civweaveMockHF)');
let processorLoads=0,modelLoads=0,lastGenerationArgs=null,lastPrompt='',modelDisposed=false;
const mock={
  env:{},
  AutoProcessor:{async from_pretrained(repo){processorLoads++;assert.match(repo,/Qwen3\.5-0\.8B/);
    const proc=async(prompt)=>{lastPrompt=prompt;return{input_ids:'tokens'}};
    proc.tokenizer={};return proc;}},
  Qwen3_5ForConditionalGeneration:{async from_pretrained(repo,opts){
    modelLoads++;assert.match(repo,/Qwen3\.5-0\.8B/);
    assert.equal(opts.device,'webgpu');assert.equal(opts.dtype.decoder_model_merged,'q4');
    return{async generate(options){lastGenerationArgs=options;options.streamer.options.callback_function('REA');options.streamer.options.callback_function('DY');
      return{sequences:[]}},async dispose(){modelDisposed=true}};
  }},
  TextStreamer:class {constructor(tokenizer,options){this.options=options}},
  InterruptableStoppingCriteria:class {reset(){}interrupt(){}}
};
const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
const originalSecure=Object.getOwnPropertyDescriptor(globalThis,'isSecureContext');
const originalCache=Object.getOwnPropertyDescriptor(globalThis,'caches');
const originalMock=Object.getOwnPropertyDescriptor(globalThis,'__civweaveMockHF');
function globalSet(name,value){Object.defineProperty(globalThis,name,{value,configurable:true,writable:true})}
try{
  globalSet('navigator',{userAgent:'iPhone OS 26',maxTouchPoints:5,
    gpu:{requestAdapter:async()=>({limits:{maxStorageBufferBindingSize:268435456,maxBufferSize:1000000000}})}});
  globalSet('isSecureContext',true);
  globalSet('caches',{open:async()=>({})});
  globalSet('__civweaveMockHF',mock);
  const m=await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'));
  assert.equal(m.status().resident,false,'module import must not load weights');
  assert.equal(modelLoads,0);
  assert.equal(m.browserCapability().ios,true);
  const caps=await m.probeGPU();
  assert.equal(caps.maxStorageBufferBindingSize,268435456);
  await assert.rejects(()=>m.prepare('qwen35-nonexistent'),{code:'IOS_WEBGPU_MODEL_UNKNOWN'});
  assert.equal(modelLoads,0,'invalid model must never download weights');
  await m.prepare('qwen35-08b-onnx-webgpu');
  assert.equal(modelLoads,1);
  const live=[];
  const result=await m.generate({modelId:'qwen35-08b-onnx-webgpu',
    messages:[{role:'user',content:'Say READY only.'}],maxTokens:32,structured:true,
    onToken:(part,full)=>live.push([part,full])});
  assert.equal(result.text,'READY');assert.equal(result.streamed,true);
  assert.deepEqual(live,[['REA','REA'],['DY','READY']]);
  assert.match(lastPrompt,/Return exactly one valid JSON object/);
  assert.match(lastPrompt,/<\|im_start\|>user/);
  assert.equal(lastGenerationArgs.max_new_tokens,32);
  assert.equal(modelLoads,1,'resident model should not redownload on every prompt');
  await m.unload();assert.equal(m.status().resident,false);
  assert.equal(modelDisposed,true);
  assert.equal(mock.env.useBrowserCache,true);
  assert.equal(mock.env.useCustomCache,false);
}finally{
  for(const [name,descriptor] of [['navigator',originalNavigator],['isSecureContext',originalSecure],['caches',originalCache],['__civweaveMockHF',originalMock]]){
    if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
  }
}
console.log('PASS: Safari WebGPU Qwen on-device test, 0.8B/2B/4B catalog, opt-in model loading, real-time streaming and shared Civweave routing.');
