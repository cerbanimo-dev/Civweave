import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [policySource,structured,pipeline,tracker,chat]=await Promise.all([
  read('public/app/local-ai/local-generation-model-policy-v1.js'),
  read('public/app/local-ai/gemma4-structured-task-authority-v1.js'),
  read('public/app/local-ai/gemma4-weave-draft-pipeline-v1.js'),
  read('public/app/guide-generation-tracker-v1.js'),
  read('public/app/guide-chat-surface-v350.js')
]);
let selected={active:true,id:'gemma4-e2b-it-litert-web'};
const installed=new Set(['gemma4-e2b-it-litert-web','gemma4-e4b-it-litert-web','qwen35-4b-litert-web','qwen35-9b-litert-web']);
const sandbox={console,Map,Set,Object,Array,JSON,String,Math,Date,Promise,
  localStorage:{getItem:()=>null},
  addEventListener:()=>{},dispatchEvent:()=>{},
  CustomEvent:class {constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  CivweaveLocalModelDownloadV266:{
    selection:()=>selected,
    status:async id=>({available:installed.has(id)})
  }
};
sandbox.globalThis=sandbox;
vm.runInNewContext(policySource,sandbox);
const policy=sandbox.CivweaveLocalGenerationModelPolicyV1;
assert.equal(policy.resolve('intake'),'gemma4-e4b-it-litert-web','intake must use deep rather than the selected fast model');
assert.equal(policy.resolve('deep'),'gemma4-e4b-it-litert-web');
assert.equal(policy.resolve('fast'),'gemma4-e2b-it-litert-web');
assert.equal(await policy.requireRole('deep'),'gemma4-e4b-it-litert-web');
selected={active:true,id:'qwen35-4b-litert-web'};
assert.equal(policy.resolve('deep'),'qwen35-9b-litert-web');
assert.equal(policy.resolve('intake'),'qwen35-9b-litert-web');
assert.equal(policy.resolve('fast'),'qwen35-4b-litert-web');
assert.equal(await policy.requireRole('deep'),'qwen35-9b-litert-web');
assert.equal(policy.resolve('deep',{config:{model:'gemma4-e2b-it-litert-web'}}),'gemma4-e4b-it-litert-web','explicit request must retain its configured family');
installed.delete('qwen35-9b-litert-web');
await assert.rejects(()=>policy.requireRole('deep'),error=>error.code==='LOCAL_GENERATION_ROLE_MODEL_UNAVAILABLE'&&error.executionModel==='qwen35-9b-litert-web');
selected={active:true,id:'some-custom-local-model'};
assert.equal(policy.resolve('deep'),'some-custom-local-model','unsupported selection must never be silently mapped to Gemma');
assert.equal(policy.supportsSelected(),false,'LiteRT-specialized pipeline must not hijack unrelated models');
for(const [source,label] of [[structured,'intake authority'],[pipeline,'draft pipeline'],[tracker,'generation tracker'],[chat,'chat surface']]){
  assert.doesNotMatch(source,/['"]gemma4-e4b-it-litert-web['"]/,`${label} hardcodes one generation model`);
}
assert.match(structured,/CivweaveLocalGenerationModelPolicyV1/);
assert.match(pipeline,/CivweaveLocalGenerationModelPolicyV1/);
assert.match(tracker,/CivweaveLocalGenerationModelPolicyV1/);
assert.match(chat,/CivweaveLocalGenerationModelPolicyV1/);
console.log('PASS: configurable local fast/deep models, deep intake, Qwen and Gemma families, missing pack errors, independent models, no hard-coded planner IDs.');
