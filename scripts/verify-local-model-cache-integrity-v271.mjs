import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [integrity,runtime,worker,bootstrap,bg,rootSw]=await Promise.all([
  read('public/app/local-ai/cache-integrity-v271.js'),
  read('public/app/local-ai/runtime-v266.js'),
  read('public/app/local-ai/worker-v266.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/service-worker-local-model-download-v267.js'),
  read('public/service-worker-v203.js'),
]);
for(const source of [integrity,runtime,worker,bootstrap,bg,rootSw])new Function(source);

const checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name)};
check('integrity layer validates JSON bodies',integrity.includes('JSON.parse(text)')&&integrity.includes("broken(artifact,'invalid-json'"));
check('integrity layer evicts corrupt cache entries',integrity.includes('await cache.delete(key)')&&integrity.includes('evictBroken'));
check('integrity layer limits automatic repair to metadata',integrity.includes('MAX_METADATA_REPAIR_BYTES=16_000_000')&&integrity.includes('missing.every(row=>!isWeight(row.path))'));
check('runtime auto-repairs metadata before worker inference',runtime.includes('state?.repair?.metadataOnly')&&runtime.includes('await manager.repairMetadata(spec.id,{onProgress})'));
check('worker independently rejects malformed cached JSON',worker.includes('async function validatedHit')&&worker.includes('JSON.parse(text)')&&worker.includes('await cache.delete(key)'));
check('background fetch validates JSON before cache.put',bg.includes('async function validateRecord')&&bg.includes('JSON.parse(text)')&&bg.indexOf('validateRecord(record.request,response)')<bg.indexOf('cache.put(record.request,response)'));
check('root service worker cache-busts v271 background worker',rootSw.includes('1.0.67-local-model-background-v271-integrity'));
check('bootstrap loads integrity after download manager and before runtime',bootstrap.indexOf('download-manager-v267.js')<bootstrap.indexOf('cache-integrity-v271.js')&&bootstrap.indexOf('cache-integrity-v271.js')<bootstrap.indexOf('runtime-v266.js?v=1.0.67-v271'));

const repo='onnx-community/Test-ONNX',revision='abc123';
const artifacts=[
  {path:'config.json',minBytes:5,required:true},
  {path:'tokenizer.json',minBytes:5,required:true},
  {path:'onnx/model_q4f16.onnx',minBytes:100,required:true},
];
const url=path=>`https://huggingface.co/${repo}/resolve/${revision}/${path}`;
const entries=new Map([
  [url('config.json'),new Response('',{status:200,headers:{'content-type':'application/json'}})],
  [url('tokenizer.json'),new Response('{"ok":true}',{status:200,headers:{'content-type':'application/json'}})],
  [url('onnx/model_q4f16.onnx'),new Response(new Uint8Array(128),{status:200,headers:{'content-length':'128','content-type':'application/octet-stream'}})],
]);
const deleted=[];
const cache={
  async match(key){const value=entries.get(String(key));return value?.clone?.()||value},
  async delete(key){deleted.push(String(key));return entries.delete(String(key))},
  async put(key,value){entries.set(String(key),value.clone?.()||value)},
};
let startCalls=0;
const base={
  version:'1.0.60-local-ai-download-v267',cache:'civweave-model-generative-v266',
  selection:()=>({active:true,id:'test-model'}),
  state:()=>({status:'ready',percent:100,error:''}),
  start:async()=>{startCalls+=1;entries.set(url('config.json'),new Response('{"model_type":"test"}',{status:200,headers:{'content-type':'application/json'}}));return{status:'downloading'}},
  models:[],
};
const registry={
  byId:id=>id==='test-model'?{id:'test-model',label:'Test Model',repo,revision,installable:true,artifacts}:null,
  directUrl:(model,path)=>url(path),
  models:[{id:'test-model',label:'Test Model',repo,revision,installable:true,artifacts}],
};
const context={
  console,Response,TextEncoder,Uint8Array,Date,Promise,Error,Object,Boolean,Number,String,Math,
  setTimeout,clearTimeout,
  navigator:{onLine:true},
  caches:{open:async()=>cache},
  CivweaveLocalModelDownloadV266:base,
  CivweaveLocalModelRegistryV266:registry,
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent:()=>true,
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(integrity,context,{filename:'cache-integrity-v271.js'});
const manager=context.CivweaveLocalModelDownloadV266;
const brokenStatus=await manager.status('test-model');
assert.equal(brokenStatus.available,false);
assert.equal(brokenStatus.repair.metadataOnly,true);
assert.deepEqual([...brokenStatus.repair.paths],['config.json']);
assert.ok(deleted.includes(url('config.json')),'empty config.json must be evicted');
assert.ok(entries.has(url('onnx/model_q4f16.onnx')),'healthy ONNX weight must remain cached');
checks.push('empty cached config is detected and evicted without touching weights');

const repaired=await manager.repairMetadata('test-model');
assert.equal(startCalls,1,'metadata repair should start exactly one targeted resume pass');
assert.equal(repaired.available,true);
assert.ok(entries.has(url('onnx/model_q4f16.onnx')),'metadata repair must preserve healthy ONNX weight');
checks.push('metadata repair restores package without redownloading healthy weights');

console.log(JSON.stringify({ok:true,revision:'local-model-cache-integrity-v271',checks:checks.length,features:{bodyValidation:true,malformedJsonEviction:true,metadataOnlyRepair:true,normalRuntimeAutoRepair:true,backgroundIngressValidation:true,weightPreservation:true}},null,2));
