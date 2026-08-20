import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [source,loader,serviceWorker]=await Promise.all([
  read('public/app/local-chat-bounded-recovery-v1.js'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/service-worker-local-ai-coherence-v307.js')
]);
new Function(source);
new Function(loader);
new Function(serviceWorker);

assert.match(source,/1\.1\.0-local-chat-bounded-recovery-v1-gemma4-q4/);
assert.match(source,/GEMMA4_Q4_ID='gemma4-e2b-it-q4f16'/);
assert.match(source,/GEMMA4_Q4_REVISION='9f4bef82ea6e296bc69f8a2f5939f73af81b07a6'/);
assert.match(source,/repo:'onnx-community\/gemma-4-E2B-it-ONNX'/);
assert.match(source,/dtype:'q4f16'/);
assert.match(source,/status:'runtime-blocked'/,'the Q2 mobile pack must be parked behind its browser-runtime floor');
assert.match(source,/feature:'2-bit-gather'/);
assert.match(source,/if\(recovering\)return 120000/,'Gemma 4 recovery attempts must not inherit the retired 15-minute floor');
assert.match(source,/return recovering\?300000/,'Gemma 4 local recovery must have a bounded total budget');
assert.match(source,/fifteenMinuteChatFloorRetired:true/);
assert.match(source,/watchReject\?\.\(error\);\s*queueMicrotask\(\(\)=>\{try\{runtime\.shutdown/s,'stall reason must reject before worker cancellation');
assert.match(source,/reject\(error\);\s*queueMicrotask\(\(\)=>\{try\{runtime\.shutdown/s,'total timeout reason must reject before worker cancellation');
assert.doesNotMatch(source,/Math\.max\(900000/,'bounded chat recovery must not restore the retired 15-minute minimum');

const recoveryIndex=loader.indexOf('/app/local-chat-bounded-recovery-v1.js');
const authorityIndex=loader.indexOf('/app/local-provider-authority-v1.js');
assert.ok(recoveryIndex>=0&&authorityIndex>recoveryIndex,'Gemma recovery/compatibility must install before provider authority');
assert.match(loader,/1\.0\.161-shared-guide-surface-v236-gemma4-q4/);
assert.match(loader,/1\.1\.0-gemma4-q4/);
assert.match(loader,/gemma4CompatibleQ4:true/);
assert.match(loader,/gemma4CompatibleModelId:'gemma4-e2b-it-q4f16'/);
assert.match(loader,/gemma4Q2RuntimeBlocked:true/);

assert.match(serviceWorker,/local-ai-code-v313-gemma4-q4/);
assert.ok((serviceWorker.match(/'\/app\/local-chat-bounded-recovery-v1\.js'/g)||[]).length>=2,'Gemma compatibility code must be eligible and warmable in the local-AI coherence cache');
assert.ok((serviceWorker.match(/'\/app\/shared-guide-surface-v236\.js'/g)||[]).length>=2,'the guide loader itself must use current-code coherence');
assert.match(serviceWorker,/gemma4CompatibleQ4Coherent: true/);

class MemoryStorage{
  constructor(seed={}){this.values=new Map(Object.entries(seed))}
  getItem(key){return this.values.has(key)?this.values.get(key):null}
  setItem(key,value){this.values.set(key,String(value))}
}
const localStorage=new MemoryStorage({
  'civweave.local-ai.selection.v266':JSON.stringify({active:true,id:'gemma3-1b-it-q4f16'}),
  'civweave-model-profiles-v1':JSON.stringify({interactive:{provider:'downloaded-local',model:'gemma4-e2b-it-q2f16-mobile'}}),
  'civweave.local-ai.health.v286':JSON.stringify({'qwen3-0.6b-q4f16':{ok:true,metrics:{tokensPerSecond:4}}})
});
let selection={active:true,id:'gemma3-1b-it-q4f16'};
let fallbackSeen=[];
let serverCalls=0;
const baseModels=[
  {id:'gemma4-e2b-it-q2f16-mobile',label:'Gemma 4 E2B IT',tier:'Gemma Fast',status:'device-test',installable:true,recommended:'phone-fast',repo:'onnx-community/gemma-4-E2B-it-qat-mobile-ONNX',revision:'mobile-revision',task:'text-generation',dtype:'q2f16',device:'webgpu',runtime:'transformers-js-v4',runtimeAsset:'/app/vendor/transformers-v4/transformers.min.js',wasmRoot:'/app/vendor/transformers-v4/wasm/',wasmChunks:['part0','part1'],requiresShaderF16:true,estimatedBytes:2335000000,contextWindowTokens:128000,workingContextTokens:8192,healthTimeoutMs:900000,generation:{nonThinkingTemperature:1},fallbackIds:['qwen3-0.6b-q8-wasm'],capabilities:{interactive:true,structuredOutput:true,agenticReasoning:true,code:true},artifacts:[]},
  {id:'gemma3-1b-it-q4f16',device:'webgpu',runtime:'transformers-js-v4',estimatedBytes:884000000,workingContextTokens:4096,generation:{nonThinkingTemperature:.7},fallbackIds:[]},
  {id:'smollm2-360m-instruct-q4f16',device:'webgpu',runtime:'transformers-js-v3',estimatedBytes:272000000,fallbackIds:[]},
  {id:'qwen3-0.6b-q4f16',device:'webgpu',runtime:'transformers-js-v3',estimatedBytes:610000000,fallbackIds:[]},
  {id:'qwen3-1.7b-q4f16',device:'webgpu',runtime:'transformers-js-v3',estimatedBytes:1470000000,fallbackIds:[]}
];
const baseMap=new Map(baseModels.map(model=>[model.id,model]));
const registry={
  models:baseModels,
  runtimeModels:[],
  byId:id=>baseMap.get(id)||null,
  fallbacks:modelOrId=>{const model=typeof modelOrId==='string'?baseMap.get(modelOrId):modelOrId;return(model?.fallbackIds||[]).map(id=>baseMap.get(id)).filter(Boolean)},
  installable:()=>baseModels.filter(model=>model.installable!==false),
  experimental:()=>[],
  capable:()=>baseModels
};
const sandbox={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,
  localStorage,
  queueMicrotask,setTimeout,clearTimeout,
  CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  dispatchEvent(){return true},addEventListener(){},
  document:{querySelector(){return null}},
  globalThis:null
};
sandbox.globalThis=sandbox;
sandbox.CivweaveLocalModelDownloadV266={selection:()=>selection};
sandbox.CivweaveLocalModelRegistryV266=registry;
sandbox.CivweaveLocalModelRuntimeV266={
  async generate(){
    const active=sandbox.CivweaveLocalModelRegistryV266.byId(selection.id);
    const rows=sandbox.CivweaveLocalModelRegistryV266.fallbacks(active);
    fallbackSeen=rows.map(row=>row.id);
    return{status:'success',outputText:'local recovery succeeded',id:selection.id,executionId:rows[0]?.id||selection.id,fallbackChain:rows.slice(0,1).map(row=>row.id)};
  },
  shutdown(){return true}
};
sandbox.CivweaveServerAIRouterV301={async handle(){serverCalls+=1}};

vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'local-chat-bounded-recovery-v1.js'});
const patchedRegistry=sandbox.CivweaveLocalModelRegistryV266;
const compatible=patchedRegistry.byId('gemma4-e2b-it-q4f16');
const parked=patchedRegistry.byId('gemma4-e2b-it-q2f16-mobile');
assert.ok(compatible,'the compatible Gemma 4 Q4F16 model must be in the live catalogue');
assert.equal(compatible.repo,'onnx-community/gemma-4-E2B-it-ONNX');
assert.equal(compatible.revision,'9f4bef82ea6e296bc69f8a2f5939f73af81b07a6');
assert.equal(compatible.dtype,'q4f16');
assert.equal(compatible.runtime,'transformers-js-v4');
assert.equal(compatible.compatibility.bundledTransformersVersion,'4.2.0');
assert.ok(compatible.artifacts.some(row=>row.path==='onnx/decoder_model_merged_q4f16.onnx_data'));
assert.ok(compatible.artifacts.some(row=>row.path==='onnx/embed_tokens_q4f16.onnx_data'));
assert.equal(parked.status,'runtime-blocked');
assert.equal(parked.runtimeRequirement.minimumVersion,'4.3.0');
assert.equal(parked.compatibleReplacementId,'gemma4-e2b-it-q4f16');
assert.equal(parked.fallbackIds[0],'gemma4-e2b-it-q4f16');

sandbox.CivweaveLocalChatRuntimeV295={
  version:'test-local-chat',
  revision:'v312-runtime-first-bootstrap',
  inferenceCoreFirst:true,
  fullBootstrapBlocking:false,
  async ready(){return true},
  budget(){return{maxNewTokens:64}},
  async generate(){throw new Error('retired base generate must be wrapped')}
};
const wrapped=sandbox.CivweaveLocalChatRuntimeV295;
assert.equal(wrapped.boundedFallbackRecovery,true);
assert.equal(wrapped.gemma4CompatibleQ4,true);

const result=await wrapped.generate({systemPrompt:'system',messages:[{role:'user',content:'Test'}],timeoutMs:60000,totalTimeoutMs:90000});
assert.equal(result.executionId,'qwen3-0.6b-q4f16','a measured healthy installed local model may still lead emergency recovery when the compatible Gemma pack is not installed');
assert.equal(fallbackSeen[0],'qwen3-0.6b-q4f16');
assert.ok(fallbackSeen.includes('gemma4-e2b-it-q4f16'),'the same-family compatible Gemma lane must participate in the local recovery catalogue');
assert.equal(sandbox.CivweaveLocalModelRegistryV266.byId('gemma4-e2b-it-q4f16')?.repo,'onnx-community/gemma-4-E2B-it-ONNX','temporary recovery must preserve the persistent Gemma compatibility catalogue');
assert.equal(serverCalls,0,'Gemma compatibility and bounded recovery must never contact the server router');

console.log(JSON.stringify({
  ok:true,
  revision:'local-chat-bounded-recovery-v1-gemma4-q4',
  transformersJsVersionDistinguished:true,
  gemma4Q2RuntimeBlocked:true,
  gemma4Q4CompatibleLane:true,
  gemma4Q4PinnedRevision:true,
  boundedAttempt:true,
  boundedTotal:true,
  stallReasonPreserved:true,
  healthAwareInstalledFallbacks:true,
  noServerFallback:true,
  pwaCoherenceCache:true
},null,2));
