import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {validateStrictJson,LEARNING_TRIAL_SCHEMA} from '../public/app/local-ai/llama32-structured-constraints-v1.js';
const read=path=>readFileSync(path,'utf8');
const registry=read('public/app/local-ai/model-registry-v266.js');
const worker=read('public/app/local-ai/worker-v266.js');
const page=read('public/app/local-ai/llama32-two-pass-test-v1.html');
const livePage=read('public/app/local-ai/llama32-two-pass-test-v3.html');
const latestPage=read('public/app/local-ai/llama32-two-pass-test-v4.html');
assert.match(latestPage,/preflightAsyncify/);
assert.match(latestPage,/llama32-diagnostic-worker-v4\.js/);
assert.match(livePage,/handleProgress\(r\.progress\|\|\{\}\)/);
assert.match(livePage,/sessionReady=true/);
assert.match(livePage,/new Worker\('\/app\/local-ai\/llama32-diagnostic-worker-v3\.js/);

const builder=read('scripts/build-cloudflare-pages.mjs');
const stage=read('scripts/stage-llama-structured-output-v1.mjs');
const policy=read('public/app/local-ai/local-generation-model-policy-v1.js');
assert.match(registry,/id:'llama32-3b-instruct-q4f16'/);
assert.match(registry,/model_q4f16\.onnx_data_1/);
assert.match(registry,/license:'llama3\.2'/);
assert.match(registry,/status:'retired',installable:false/);
assert.match(policy,/deep:'llama32-3b-instruct-q4f16'/);
assert.doesNotMatch(policy,/deep:'gemma4-e4b-it-litert-web'/);
assert.match(worker,/options\.logits_processor=\[new StructuredOutputProcessor/);
assert.match(worker,/do_sample:!structuredSchema/);
assert.match(worker,/structuredSchema\?structured\.value/);
assert.match(page,/PASS 1 · free-form/);
assert.match(page,/preferBackground:false/,'Llama test must never start Background Fetch silently');
assert.match(page,/WEIGHT_FILES=\['onnx\/model_q4f16.onnx_data','onnx\/model_q4f16.onnx_data_1'\]/);
const crashGuard=read('public/app/local-ai/llama32-two-pass-test-v4.html');
assert.match(crashGuard,/civweave\.llama32\.gpu-active\.v1/,'v5 must persist the last phase across browser-process exits');
assert.match(crashGuard,/if\(isMobile&&!allowMemoryRisk\.checked\)/,'mobile large-model crash risks require explicit opt-in');
assert.match(crashGuard,/checkpoint\('worker-start',true\)/,'worker creation must persist an unclean-run checkpoint');
assert.match(crashGuard,/checkpoint\(next,true\)/,'phase transitions must be persisted to diagnose crashes');
assert.match(crashGuard,/if\(worker\)\{try\{localStorage\.setItem\(RESULT_KEY/,'normal completion must clear the crash checkpoint');
assert.match(crashGuard,/inspect\.onclick=async\(\)=>/,'GPU preflight must not require a full ONNX model load');
assert.doesNotMatch(crashGuard,/localStorage\.clear\(\)|caches\.delete\(CACHE\)/,'crash protection must not delete cached model weights');

assert.match(page,/await cache.put\(url,new Response\(file/,'native browser downloads must be importable into offline cache');
assert.match(page,/file.size!==row.sizeBytes/,'file imports must reject truncated weight shards');
assert.doesNotMatch(page,/Browser download started\. Keep the model files on this origin/);
assert.match(page,/PASS 2 · compile with 4\.3\.1 schema token masking/);
assert.match(page,/if\(!compiled\?\.strictJson\|\|!compiled\?\.jsonValidated/);
assert.match(stage,/--pack-destination/);
assert.match(builder,/runNodeScriptAsync\(llamaStructuredStage/);
const valid={title:'Tarot fundamentals',capability:'Read a three-card spread',modules:[{title:'Major arcana',outcome:'Recall basic meanings'},{title:'Minor arcana',outcome:'Recognize four suits'},{title:'Daily spreads',outcome:'Read three cards'}],assumptions:[]};
assert.equal(validateStrictJson(JSON.stringify(valid),LEARNING_TRIAL_SCHEMA).ok,true);
for(const content of ['some prose '+JSON.stringify(valid),JSON.stringify({...valid,modules:[]}),JSON.stringify({...valid,extra:true}),JSON.stringify({...valid,assumptions:'none'}),'{incomplete']){
 assert.equal(validateStrictJson(content,LEARNING_TRIAL_SCHEMA).ok,false,content.slice(0,50));
}
new Function(worker);
new Function(page.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import\s+.*;\s*$/gm,''));

// Shared Moss / Weaveling generation must never send an ONNX selection to
// Gemma/Qwen LiteRT's profile-only runner. The Llama compiler should use the
// canonical downloaded-model WebGPU worker with real token-level constraints.
const authority=read('public/app/local-ai/gemma4-structured-task-authority-v1.js');
const spine=read('public/app/local-ai/runtime-v266.js');
const pipeline=read('public/app/local-ai/gemma4-weave-draft-pipeline-v1.js');
assert.match(authority,/async function modelRuntimeFor\(model\)/,'local model family must select its owning backend');
assert.match(authority,/runtime\.generate\(\{messages,/,'Llama must generate through the canonical local runtime');
assert.match(authority,/structuredOutputSchema:args\.structuredOutputSchema/,'intake and compiler must preserve a constrained schema when supplied');
assert.match(authority,/await modelRuntimeFor\(model\)/,'controlled generation must not assume every local model is LiteRT');
assert.match(pipeline,/structuredOutputSchema:phase==='compile'\|\|phase==='repair'\?onnxCompiler\?schema:null:null/,'Llama compile needs token-level grammar');
assert.match(pipeline,/onnxCompiler&&\(phase==='compile'\|\|phase==='repair'\)&&\(!result\?\.strictJson\|\|!result\?\.jsonValidated\)/,'strict JSON may never silently become prompt-only JSON');
assert.match(spine,/function assertLlama32AndroidReady\(/,'prior Android renderer crashes must block ordinary app retries');
assert.match(spine,/LOCAL_LLAMA32_ANDROID_PREFLIGHT_REQUIRED/,'explicit safe refusal must identify the real memory risk');
assert.match(spine,/expectedModelId/,'selected model must be bound to its runtime request');
assert.match(spine,/structuredOutputSchema:requestOptions\.structuredOutputSchema/,'worker must receive the JSON grammar schema');
assert.match(spine,/if\(strictModel\)/,'strict ONNX generation must not silently fall back to another model');


// Behavior contract: a previous Android renderer crash must fail *before*
// creating a GPU worker. A successful isolated two-pass diagnostic permits
// exactly the selected ONNX model and sends the grammar to that worker.
const values=new Map(),gpuMessages=[];
const storage={
  getItem:key=>values.has(key)?values.get(key):null,
  setItem:(key,value)=>values.set(key,String(value)),
  removeItem:key=>values.delete(key)
};
const llamaId='llama32-3b-instruct-q4f16';
const llamaSpec={id:llamaId,label:'Llama 3B trial',installable:true,device:'webgpu',runtime:'transformers-js-v4',dtype:'q4f16',repo:'test/llama',revision:'test',artifacts:[],generation:{},healthTimeoutMs:240000};
class FakeWorker{
  events={};
  constructor(){gpuMessages.push({event:'created'})}
  addEventListener(name,fn){this.events[name]=fn}
  postMessage(packet){
    gpuMessages.push(packet);
    queueMicrotask(()=>this.events.message({data:{id:packet.id,type:'done',result:{text:'{"title":"demo"}',strictJson:!!packet.structuredOutputSchema,jsonValidated:!!packet.structuredOutputSchema,backend:'webgpu'}}}));
  }
  terminate(){}
}
const context={
  console,Date,Math,JSON,Object,Boolean,Number,String,Set,Map,Promise,
  setTimeout,clearTimeout,queueMicrotask,performance:{now:()=>42},
  localStorage:storage,sessionStorage:storage,
  navigator:{userAgent:'Android; diagnostic test',gpu:{requestAdapter:async()=>({})},hardwareConcurrency:8},
  document:{visibilityState:'visible'},
  matchMedia:()=>({matches:false}),innerWidth:400,innerHeight:800,crossOriginIsolated:true,
  addEventListener:()=>{},dispatchEvent:()=>true,CustomEvent:class{constructor(name,options){this.type=name;this.detail=options?.detail}},
  Worker:FakeWorker,
  CivweaveLocalModelRegistryV266:{byId:id=>id===llamaId?llamaSpec:null,cpuFallback:()=>null,fallbacks:()=>[]},
  CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:llamaId}),status:async()=>({available:true})}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(spine,context,{filename:'runtime-v266.js'});
const core=context.CivweaveLocalModelRuntimeV266;
values.set('civweave.llama32.gpu-active.v1',JSON.stringify({at:1000,phase:'loading-model',sessionReady:false}));
await assert.rejects(()=>core.generate({expectedModelId:llamaId,strictModel:true,messages:[]}),
  e=>e.code==='LOCAL_LLAMA32_ANDROID_PREFLIGHT_REQUIRED');
assert.equal(gpuMessages.length,0,'Android crash guard must not create or load a Worker');
await assert.rejects(()=>core.prewarm({}),e=>e.code==='LOCAL_LLAMA32_ANDROID_PREFLIGHT_REQUIRED');
assert.equal(gpuMessages.length,0,'prewarm cannot bypass the Android crash guard');
values.set('civweave.llama32.gpu-result.v1',JSON.stringify({at:2000,sessionReady:true,report:'PASS · both Llama 3.2 3B runs completed, second pass constrained and validated.'}));
await assert.rejects(()=>core.generate({expectedModelId:'a different model',strictModel:true,messages:[]}),
  e=>e.code==='LOCAL_MODEL_SELECTION_MISMATCH');
const enforcedSchema={type:'object',required:['title'],properties:{title:{type:'string'}}};
const compiled=await core.generate({expectedModelId:llamaId,strictModel:true,messages:[{role:'user',content:'demo'}],structuredOutputSchema:enforcedSchema});
assert.equal(compiled.executionId,llamaId);
assert.equal(compiled.fallbackUsed,false);
assert.equal(compiled.strictJson,true);
assert.equal(compiled.jsonValidated,true);
assert.deepEqual(JSON.parse(JSON.stringify(gpuMessages.find(x=>x.type==='generate')?.structuredOutputSchema)),enforcedSchema,'strict grammar must reach worker');
core.shutdown({reason:'contract-complete'});


// Reproduce the reported production regression: the local policy supports
// Llama, but that must NOT install a Gemma/Qwen LiteRT first-request owner.
const litertOwner=read('public/app/local-ai/gemma4-litert-request-authority-v1.js');
const litertBridge=read('public/app/local-ai/gemma4-first-request-intake-bridge-v1.js');
const litertLearning=read('public/app/local-ai/gemma4-learning-plan-entry-authority-v1.js');
const shell=read('public/app/persistent-system-shell-v1.html');
const campus=read('public/app/working-campus-v440.html');
for(const id of ['llama32-3b-instruct-q4f16','smollm2-135m-instruct-q8-wasm','qwen35-4b-litert-web','gemma4-e4b-it-litert-web']){
  const isLiteRT=/(?:gemma4|qwen35).*-litert-web$/.test(id),family=isLiteRT?'litert-lm-web':id.startsWith('llama')?'transformers-js-v4':'transformers-js-v3';
  const sandbox={console,Date,Math,JSON,Object,Array,String,Boolean,RegExp,Promise,Map,Set,
    queueMicrotask:()=>{},addEventListener:()=>{},dispatchEvent:()=>{},setTimeout:()=>0,clearTimeout:()=>{},
    localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
    CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id})},
    CivweaveLocalModelRegistryV266:{byId:()=>({id,runtime:family})},
    // Deliberately TRUE for Llama: this previously incorrectly admitted LiteRT.
    CivweaveLocalGenerationModelPolicyV1:{supportsSelected:()=>true,resolve:()=>id}};
  sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(litertOwner,sandbox,{filename:'gemma4-litert-request-authority-v1.js'});
  vm.runInContext(litertBridge,sandbox,{filename:'gemma4-first-request-intake-bridge-v1.js'});
  vm.runInContext(litertLearning,sandbox,{filename:'gemma4-learning-plan-entry-authority-v1.js'});
  assert.equal(sandbox.CivweaveGemma4LiteRTRequestAuthorityV1.selectedFast(),isLiteRT,id+' must be dispatched by its registered engine family');
  assert.equal(sandbox.CivweaveGemma4FirstRequestIntakeBridgeV1.selectedGemma(),isLiteRT,id+' cannot enter a Gemma-specific bridge by policy alias');
  assert.equal(sandbox.CivweaveGemma4LearningPlanEntryAuthorityV1.selectedGemma(),isLiteRT,id+' cannot enter Gemma-specific Moss adapter');
}
{
  let calledLiteRT=0,calledONNX=0,lastRequest=null;
  const id='llama32-3b-instruct-q4f16',sandbox={console,Date,Math,JSON,Object,Array,String,Boolean,RegExp,Promise,Map,Set,
    queueMicrotask:()=>{},addEventListener:()=>{},dispatchEvent:()=>{},setTimeout:()=>0,clearTimeout:()=>{},
    localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
    CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id})},
    CivweaveLocalModelRegistryV266:{byId:()=>({id,runtime:'transformers-js-v4'})},
    CivweaveLocalGenerationModelPolicyV1:{resolve:()=>id,supportsSelected:()=>true},
    CivweaveLocalChatRuntimeV295:{ready:async()=>true},
    CivweaveLocalModelRuntimeV266:{generate:async request=>{lastRequest=request;calledONNX+=1;throw Object.assign(new Error('Android model GPU initialization is not validated.'),{code:'LOCAL_LLAMA32_ANDROID_PREFLIGHT_REQUIRED'})}},
    CivweaveLiteRTGemma4FastRuntimeV1:{runFast:async()=>{calledLiteRT+=1;throw Error('LiteRT attempted for ONNX!')}}};
  sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(authority,sandbox,{filename:'gemma4-structured-task-authority-v1.js'});
  await assert.rejects(()=>sandbox.CivweaveGemma4StructuredTaskAuthorityV1.controlledFastRun({
    systemPrompt:'You are Moss.',messages:[{role:'user',content:'Plan tarot study'}],maxNewTokens:128,
    structuredOutputSchema:{type:'object',properties:{title:{type:'string'}}}
  },id,'Local JSON Compile',200000),e=>e.code==='LOCAL_LLAMA32_ANDROID_PREFLIGHT_REQUIRED');
  assert.equal(calledLiteRT,0,'Llama must NEVER enter LiteRT profile-only runner');
  assert.equal(calledONNX,1,'Llama must enter canonical ONNX runtime exactly once');
  assert.equal(lastRequest.expectedModelId,id);
  assert.equal(lastRequest.strictModel,true);
  assert.equal(lastRequest.structuredOutputSchema.type,'object');
}
for(const [filename,source] of [['persistent shell',shell],['Working Campus',campus]]){
  assert.match(source,/gemma4-structured-task-authority-v1\.js\?v=1\.4\.6-model-cache-inventory/,filename+' must cache-bust the corrected dispatcher');
  assert.match(source,/gemma4-litert-request-authority-v1\.js\?v=1\.2\.28-runtime-family-gate/,filename+' must cache-bust the corrected LiteRT admission');
}
assert.match(shell,/gemma4-first-request-intake-bridge-v1\.js\?v=1\.2\.10-runtime-family-gate/);
assert.match(shell,/gemma4-learning-plan-entry-authority-v1\.js\?v=1\.2\.3-backend-gate/);
assert.match(shell,/gemma4-weave-draft-pipeline-v1\.js\?v=1\.3\.9-runtime-family-gate/);


// The next actual-device Moss error came from the download manager returning
// unavailable. It must state WHICH cached files or chunks are missing, and
// must not try a 2.42 GB GPU model as a probe for Cache Storage readiness.
{
  const id='llama32-3b-instruct-q4f16';
  const calls={status:0,gpu:0,deleted:0};
  let current={available:false,state:{status:'ready'},rows:[
    {path:'config.json',required:true,ok:true},
    {path:'onnx/model_q4f16.onnx_data',required:true,ok:false,reason:'chunk-missing',index:7},
    {path:'onnx/model_q4f16.onnx_data_1',required:true,ok:false,reason:'chunk-manifest-missing'},
  ],missing:[
    {path:'onnx/model_q4f16.onnx_data',required:true,reason:'chunk-missing',index:7},
    {path:'onnx/model_q4f16.onnx_data_1',required:true,reason:'chunk-manifest-missing'},
  ]};
  const sb={console,Date,Math,JSON,Object,Array,String,Boolean,RegExp,Promise,Map,Set,
    queueMicrotask:()=>{},addEventListener:()=>{},dispatchEvent:()=>{},setTimeout:()=>0,clearTimeout:()=>{},
    localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
    CivweaveLocalGenerationModelPolicyV1:{resolve:()=>id,supportsSelected:()=>true,display:x=>x},
    CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id}),status:async()=>{calls.status++;return current}},
    CivweaveLocalModelRuntimeV266:{generate:async()=>{calls.gpu++;throw Error('no inference should be attempted for incomplete model cache')}},
    CivweaveLiteRTGemma4FastRuntimeV1:{runFast:async()=>{calls.gpu++;throw Error('no LiteRT fallback')}}};
  sb.globalThis=sb;
  vm.createContext(sb);
  vm.runInContext(authority,sb,{filename:'gemma4-structured-task-authority-v1.js'});
  await assert.rejects(()=>sb.CivweaveGemma4StructuredTaskAuthorityV1.requireDeepModel(),e=>{
    assert.equal(e.code,'LOCAL_PLANNING_MODEL_REQUIRED');
    assert.match(e.message,/onnx\/model_q4f16\.onnx_data \(chunk-missing at fragment 8\)/);
    assert.match(e.message,/onnx\/model_q4f16\.onnx_data_1 \(chunk-manifest-missing\)/);
    assert.match(e.message,/offline files are not verified/);
    assert.equal(e.status.state.status,'ready','download state alone is not evidence that bytes exist');
    return true;
  });
  assert.equal(calls.status,1);
  assert.equal(calls.gpu,0);
  current={available:true,rows:[{path:'onnx/model_q4f16.onnx_data',required:true,ok:true}],missing:[]};
  assert.equal(await sb.CivweaveGemma4StructuredTaskAuthorityV1.requireDeepModel(),id,'complete cache must be admitted by inventory (subject to the separate Android GPU guard)');
}
assert.match(read('public/app/local-ai/download-manager-v267.js'),/reason:chunks.reason\|\|'chunk-incomplete'/,'chunked offline cache must surface exact missing-manifest/fragment reasons');
assert.match(read('public/app/local-ai/download-manager-v267.js'),/reason:'chunk-inventory-unavailable'/,'inventory exceptions must not be disguised as a missing download');

console.log('PASS: Llama 3.2 3B installable trial, hard-token constrained compile wiring, and independent strict JSON validation.');
