import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [source,controller,coherence]=await Promise.all([
  read('public/app/local-ai/gemma4-pack-extension-v1.js'),
  read('public/app/model-settings-controller-v173.js'),
  read('public/service-worker-local-ai-coherence-v307.js')
]);
new Function(source);
new Function(controller);
new Function(coherence);
assert.match(source,/1\.0\.0-gemma4-pack-extension-v1/);
assert.match(source,/const Q4_ID='gemma4-e2b-it-q4f16'/);
assert.match(source,/q2Optional:true/);
assert.match(source,/fullReinstallRequired:false/);
assert.match(controller,/gemma4-pack-extension-v1\.js\?v=1\.0\.0-q4-core-q2-optional/);
assert.match(coherence,/local-ai-code-v315-gemma4-pack-core/);
assert.ok((coherence.match(/gemma4-pack-extension-v1\.js/g)||[]).length>=1);
assert.ok((coherence.match(/model-settings-controller-v173\.js/g)||[]).length>=2);

class Storage{
  constructor(seed={}){this.rows=new Map(Object.entries(seed))}
  getItem(key){return this.rows.has(key)?this.rows.get(key):null}
  setItem(key,value){this.rows.set(key,String(value))}
}
const localStorage=new Storage();
const e2={id:'gemma4-e2b-it-q2f16-mobile',label:'E2 Q2',installable:true,repo:'mobile/e2',revision:'q2e2',runtimeAsset:'/v4.js',wasmRoot:'/wasm/',wasmChunks:[],generation:{},capabilities:{},artifacts:[]};
const e4={id:'gemma4-e4b-it-q2f16-mobile',label:'E4 Q2',installable:true,repo:'mobile/e4',revision:'q2e4',artifacts:[]};
const qwen={id:'qwen3-0.6b-q8-wasm',label:'Qwen',installable:true,artifacts:[]};
const smol={id:'smollm3-3b-q4f16',label:'Smol',installable:true,artifacts:[]};
const originals=[e2,e4,qwen,smol];
const registry={
  version:'1.0.115-local-ai-registry-v302-gemma3-v4',models:originals,runtimeModels:[],
  byId:id=>originals.find(row=>row.id===id)||null,installable:()=>originals,experimental:()=>[],capable:()=>[e2],fallbacks:()=>[],
  directUrl:(model,path)=>`https://huggingface.co/${model.repo}/resolve/${model.revision}/${path}`
};
const premier={id:'premier-phone',label:'Premier Phone Pack',estimatedBytes:7_577_000_000,primaryModel:e2.id,deepModel:e4.id,fallbackModel:qwen.id,generative:[e2.id,e4.id,qwen.id],specialized:['silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','omnilingual-asr-300m-int8','supertonic-3-tts-int8'],installOrder:[qwen.id,e2.id,'silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','supertonic-3-tts-int8','omnilingual-asr-300m-int8',e4.id]};
const packs={version:'1.0.1',packs:{'premier-phone':premier},specialized:{},byId:id=>id==='premier-phone'?premier:null,catalogue:()=>[premier],componentStatus:async()=>({available:true,bytes:1}),status:async()=>({available:true}),use:async()=>({}),remove:async()=>true};
const sandbox={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,localStorage,
  document:{documentElement:{},addEventListener(){},getElementById(){return null}},
  MutationObserver:class{observe(){}},CustomEvent:class{},dispatchEvent(){return true},addEventListener(){},queueMicrotask,setTimeout,clearTimeout,
  CivweaveLocalModelRegistryV266:registry,CivweaveLocalModelPacksV1:packs,globalThis:null
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'gemma4-pack-extension-v1.js'});
const patchedRegistry=sandbox.CivweaveLocalModelRegistryV266;
const core=patchedRegistry.byId('gemma4-e2b-it-q4f16');
assert.ok(core,'Q4F16 core must be registered');
assert.equal(core.packRole,'required-core');
assert.equal(core.repo,'onnx-community/gemma-4-E2B-it-ONNX');
assert.ok(core.artifacts.some(row=>row.path==='onnx/decoder_model_merged_q4f16.onnx_data'));
assert.ok(core.artifacts.some(row=>row.path==='onnx/embed_tokens_q4f16.onnx_data'));
assert.equal(patchedRegistry.byId(e2.id).packRole,'optional-extension');
assert.equal(patchedRegistry.byId(e4.id).packRole,'optional-extension');
assert.ok(!patchedRegistry.installable().some(row=>row.id===e2.id||row.id===e4.id),'Q2 variants must not be required installable rows');

const patchedPack=sandbox.CivweaveLocalModelPacksV1.byId('premier-phone');
assert.equal(patchedPack.primaryModel,'gemma4-e2b-it-q4f16');
assert.deepEqual([...patchedPack.generative],['gemma4-e2b-it-q4f16','qwen3-0.6b-q8-wasm']);
assert.ok(!patchedPack.installOrder.includes(e2.id));
assert.ok(!patchedPack.installOrder.includes(e4.id));
assert.deepEqual(patchedPack.optionalExtensions.map(row=>row.id),[e2.id,e4.id]);
assert.equal(sandbox.CivweaveGemma4PackExtensionV1.existingQ2Preserved,true);
assert.equal(sandbox.CivweaveGemma4PackExtensionV1.fullReinstallRequired,false);

console.log(JSON.stringify({ok:true,coreModel:patchedPack.primaryModel,q2Required:false,q2Extensions:patchedPack.optionalExtensions.map(row=>row.id),existingQ2Preserved:true,fullReinstallRequired:false,pwaCoherent:true},null,2));
