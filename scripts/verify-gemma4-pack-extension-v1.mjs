import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [e2Source,e4Source,actions,controller,coherence]=await Promise.all([
  read('public/app/local-ai/gemma4-pack-extension-v1.js'),
  read('public/app/local-ai/gemma4-e4b-q4-extension-v1.js'),
  read('public/app/local-ai/gemma4-dual-q4-actions-v1.js'),
  read('public/app/model-settings-controller-v173.js'),
  read('public/service-worker-local-ai-coherence-v307.js')
]);

for(const source of [e2Source,e4Source,actions,controller,coherence])new Function(source);

assert.match(e2Source,/const Q4_ID='gemma4-e2b-it-q4f16'/);
assert.match(e2Source,/q2Optional:true/);
assert.match(e2Source,/fullReinstallRequired:false/);
assert.match(e4Source,/const E4_Q4='gemma4-e4b-it-q4f16'/);
assert.match(e4Source,/onnx-community\/gemma-4-E4B-it-ONNX/);
assert.match(e4Source,/874c3395246e1063e6c8fcf40445bb79ea10b0f5/);
assert.match(e4Source,/decoder_model_merged_q4f16\.onnx_data_1/);
assert.match(actions,/e2UsableBeforeE4:true/);
assert.match(actions,/partialCoreUsable:true/);
assert.match(actions,/smallFileRecovery:true/);
assert.match(actions,/preservesExistingLargeFiles:true/);
assert.match(actions,/data-gemma4-use-model/);
assert.match(actions,/prepareCurrentReceipt/);
assert.match(controller,/gemma4-e4b-q4-extension-v1\.js\?v=1\.0\.0-e4b-q4-deep/);
assert.match(controller,/gemma4-pack-extension-v1\.js\?v=1\.0\.1-render-safe/);
assert.match(controller,/gemma4-dual-q4-actions-v1\.js\?v=1\.0\.0-independent-use/);
assert.match(coherence,/local-ai-code-v317-gemma4-dual-q4/);
assert.match(coherence,/gemma4-e4b-q4-extension-v1\.js/);
assert.match(coherence,/gemma4-dual-q4-actions-v1\.js/);
assert.match(coherence,/gemma4IndependentQ4UseCoherent: true/);

class Storage{
  constructor(seed={}){this.rows=new Map(Object.entries(seed))}
  getItem(key){return this.rows.has(key)?this.rows.get(key):null}
  setItem(key,value){this.rows.set(key,String(value))}
  removeItem(key){this.rows.delete(key)}
}
const localStorage=new Storage();
const e2q2={id:'gemma4-e2b-it-q2f16-mobile',label:'E2 Q2',installable:true,repo:'mobile/e2',revision:'q2e2',runtimeAsset:'/v4.js',wasmRoot:'/wasm/',wasmChunks:[],generation:{},capabilities:{},artifacts:[]};
const e4q2={id:'gemma4-e4b-it-q2f16-mobile',label:'E4 Q2',installable:true,repo:'mobile/e4',revision:'q2e4',runtimeAsset:'/v4.js',wasmRoot:'/wasm/',wasmChunks:[],generation:{},capabilities:{},artifacts:[]};
const qwen={id:'qwen3-0.6b-q8-wasm',label:'Qwen',installable:true,repo:'qwen/fallback',revision:'qwen',artifacts:[]};
const smol={id:'smollm3-3b-q4f16',label:'Smol',installable:true,repo:'smol/3b',revision:'smol',artifacts:[]};
const originals=[e2q2,e4q2,qwen,smol];
const registry={
  version:'registry-test',models:originals,runtimeModels:[],
  byId:id=>originals.find(row=>row.id===id)||null,
  installable:()=>originals,experimental:()=>[],capable:()=>[e2q2],fallbacks:()=>[],
  directUrl:(model,path)=>`https://huggingface.co/${model.repo}/resolve/${model.revision}/${path}`
};
const premier={
  id:'premier-phone',label:'Premier Phone Pack',estimatedBytes:7_577_000_000,
  primaryModel:e2q2.id,deepModel:e4q2.id,fallbackModel:qwen.id,
  generative:[e2q2.id,e4q2.id,qwen.id],
  specialized:['silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','omnilingual-asr-300m-int8','supertonic-3-tts-int8'],
  installOrder:[qwen.id,e2q2.id,'silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','supertonic-3-tts-int8','omnilingual-asr-300m-int8',e4q2.id]
};
const packs={
  version:'packs-test',packs:{'premier-phone':premier},specialized:{},
  byId:id=>id==='premier-phone'?premier:null,catalogue:()=>[premier],
  componentStatus:async()=>({available:true,bytes:1}),status:async()=>({available:true}),use:async()=>({}),remove:async()=>true
};
const sandbox={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,localStorage,
  document:{documentElement:{},addEventListener(){},getElementById(){return null}},
  CustomEvent:class{},dispatchEvent(){return true},addEventListener(){},queueMicrotask,
  setTimeout(){return 1},clearTimeout(){},
  CivweaveLocalModelRegistryV266:registry,CivweaveLocalModelPacksV1:packs,globalThis:null
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(e2Source,sandbox,{filename:'gemma4-pack-extension-v1.js'});
vm.runInContext(e4Source,sandbox,{filename:'gemma4-e4b-q4-extension-v1.js'});
assert.equal(sandbox.CivweaveGemma4E4BQ4ExtensionV1.activate(),true);

const patchedRegistry=sandbox.CivweaveLocalModelRegistryV266;
const fast=patchedRegistry.byId('gemma4-e2b-it-q4f16');
const deep=patchedRegistry.byId('gemma4-e4b-it-q4f16');
assert.ok(fast,'E2B Q4F16 fast lane must be registered');
assert.ok(deep,'E4B Q4F16 deep lane must be registered');
assert.equal(fast.repo,'onnx-community/gemma-4-E2B-it-ONNX');
assert.equal(deep.repo,'onnx-community/gemma-4-E4B-it-ONNX');
assert.equal(deep.revision,'874c3395246e1063e6c8fcf40445bb79ea10b0f5');
assert.ok(deep.artifacts.some(row=>row.path==='onnx/decoder_model_merged_q4f16.onnx_data'));
assert.ok(deep.artifacts.some(row=>row.path==='onnx/decoder_model_merged_q4f16.onnx_data_1'));
assert.ok(deep.artifacts.some(row=>row.path==='onnx/embed_tokens_q4f16.onnx_data'));
assert.equal(patchedRegistry.byId(e2q2.id).packRole,'optional-extension');
assert.equal(patchedRegistry.byId(e4q2.id).packRole,'optional-extension');
assert.ok(!patchedRegistry.installable().some(row=>row.id===e2q2.id||row.id===e4q2.id),'Q2 variants must remain outside required installable rows');

const patchedPack=sandbox.CivweaveLocalModelPacksV1.byId('premier-phone');
assert.equal(patchedPack.primaryModel,'gemma4-e2b-it-q4f16');
assert.equal(patchedPack.deepModel,'gemma4-e4b-it-q4f16');
assert.ok(patchedPack.generative.includes('gemma4-e2b-it-q4f16'));
assert.ok(patchedPack.generative.includes('gemma4-e4b-it-q4f16'));
assert.ok(patchedPack.installOrder.includes('gemma4-e2b-it-q4f16'));
assert.ok(patchedPack.installOrder.includes('gemma4-e4b-it-q4f16'));
assert.ok(!patchedPack.installOrder.includes(e2q2.id));
assert.ok(!patchedPack.installOrder.includes(e4q2.id));
assert.equal(sandbox.CivweaveGemma4PackExtensionV1.existingQ2Preserved,true);
assert.equal(sandbox.CivweaveGemma4PackExtensionV1.fullReinstallRequired,false);
assert.equal(sandbox.CivweaveGemma4E4BQ4ExtensionV1.q4RequiredCore,true);
assert.equal(sandbox.CivweaveGemma4E4BQ4ExtensionV1.q2Optional,true);

console.log(JSON.stringify({
  ok:true,
  fastModel:patchedPack.primaryModel,
  deepModel:patchedPack.deepModel,
  q2Required:false,
  independentUse:true,
  existingQ2Preserved:true,
  fullReinstallRequired:false,
  pwaCoherent:true
},null,2));
