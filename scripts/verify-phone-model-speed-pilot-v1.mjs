import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const policySource=read('public/app/local-ai/local-generation-model-policy-v1.js');
const registrySource=read('public/app/local-ai/model-registry-v266.js');
const observerSource=read('public/app/local-ai/model-performance-observer-v1.js');
const settings=read('public/app/local-ai/settings-panel-v267.js');
const shell=read('public/app/persistent-system-shell-v1.html');
const campus=read('public/app/working-campus-v440.html');
const events=new Map(),values=new Map();
const sandbox={
  console,Date,JSON,Math,Object,Array,Promise,Map,Set,RegExp,String,Number,Boolean,
  localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)},
  addEventListener:(name,fn)=>{const a=events.get(name)||[];a.push(fn);events.set(name,a)},
  dispatchEvent:e=>{for(const fn of events.get(e.type)||[])fn(e)},
  CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  navigator:{userAgent:'Android'},WebAssembly:{},
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(registrySource,sandbox,{filename:'model-registry-v266.js'});
const registry=sandbox.CivweaveLocalModelRegistryV266;
assert.equal(registry.byId('qwen35-4b-litert-web').runtime,'litert-lm-web');
const qwen=registry.byId('qwen35-4b-litert-web');
assert.equal(qwen.artifacts[0].path,'Qwen3.5-4B_mixed_int4.litertlm');
assert.equal(qwen.artifacts[0].sizeBytes,2754070624,'match published 2026-10-16 4B Mixed INT4 bytes');
assert.equal(qwen.estimatedBytes,2754070624);
assert.ok(qwen.artifacts[0].minBytes>2700000000,'reject stale 2.57GB artifact as ready');
assert.equal(registry.byId('qwen3-1.7b-q4f16').installable,true,'lightweight browser fallback must remain installable');
assert.equal(registry.byId('llama32-3b-instruct-q4f16').installable,true,'retain desktop 3B experiment');
vm.runInContext(policySource,sandbox,{filename:'local-generation-model-policy-v1.js'});
const policy=sandbox.CivweaveLocalGenerationModelPolicyV1;
for(const id of ['qwen35-4b-litert-web','qwen35-9b-litert-web','llama32-3b-instruct-q4f16','qwen3-1.7b-q4f16']){
  values.set('civweave.local-ai.selection.v266',JSON.stringify({id,active:true}));
  assert.equal(policy.resolve('fast'),id,'never silently run a different fast model: '+id);
  assert.equal(policy.resolve('deep'),id,'never silently require an uninstalled 9B planning model: '+id);
  assert.equal(policy.resolve('deep',{selectedModel:id}),id);
}
assert.equal(policy.resolve('deep',{selectedModel:'qwen35-4b-litert-web'}),'qwen35-4b-litert-web');
vm.runInContext(observerSource,sandbox,{filename:'model-performance-observer-v1.js'});
const notify=(type,detail)=>sandbox.dispatchEvent(new sandbox.CustomEvent(type,{detail}));
notify('civweave:litert-gemma4-complete',{model:'qwen35-4b-litert-web',ttftMs:2000,approxTokensPerSecond:19.5,generationMs:5400,outputText:'DO NOT RECORD PRIVATE CONTENT'});
notify('civweave:local-onnx-generate-complete',{model:'qwen3-1.7b-q4f16',selectedModel:'qwen35-4b-litert-web',fallbackUsed:true,backend:'webgpu',metrics:{ttftMs:700,tokensPerSecond:30,totalMs:3300},prompt:'PRIVATE'});
notify('civweave:weave-pipeline',{model:'qwen35-4b-litert-web',phase:'pipeline',state:'complete',kind:'learning',text:'PRIVATE'});
let recorded=sandbox.CivweaveLocalModelPerformanceV1.read();
assert.equal(recorded['qwen35-4b-litert-web'].samples.length,1);
assert.equal(recorded['qwen35-4b-litert-web'].samples[0].approximate,true);
assert.equal(recorded['qwen35-4b-litert-web'].lastPlan.validated,true,'record deterministic JSON contract, not grammar guarantee');
assert.equal(recorded['qwen3-1.7b-q4f16'].samples[0].fallbackUsed,true,'attribute fallback to the actual engine');
assert.doesNotMatch(values.get('civweave.local-ai.performance.v1'),/PRIVATE|DO NOT RECORD/,'no prompt or response content may be stored');
assert.match(settings,/performanceSnapshot\(\)/);
assert.match(settings,/Phone candidate:/);
assert.match(settings,/Measured speed:/);
assert.doesNotMatch(observerSource,/\.start\(|\.generate\(|\.runFast\(/,'measurement must not start inference');
for(const [name,html]of [['persistent shell',shell],['Working Campus',campus]]){
  assert.match(html,/model-performance-observer-v1\.js\?v=1\.0\.0/,name+' must install performance observer');
  assert.match(html,/local-generation-model-policy-v1\.js\?v=1\.0\.3-selected-qwen-model/,name+' must load updated explicit model policy');
}
console.log('PASS: Qwen 4B published artifact, user-selected single model role, light comparison, local-only per-engine speed and structured plan measurements.');
