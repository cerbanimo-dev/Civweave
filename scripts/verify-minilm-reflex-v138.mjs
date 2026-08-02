import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
async function digest(relative){const hash=createHash('sha256');for await(const chunk of createReadStream(path.join(root,relative)))hash.update(chunk);return hash.digest('hex')}

const [pkgText,loom,realm,lite,runtime,settings,assistant,adapter,worker,sw,indexText,manifestText,planner,ui,uiCss]=await Promise.all([
  read('package.json'),
  read('public/app/loom-v128.html'),
  read('public/app/realm-v128.html'),
  read('public/app/lite-v129.html'),
  read('public/app/minilm-reflex-runtime-v138.js'),
  read('public/app/minilm-model-settings-v138.js'),
  read('public/app/assistant-runtime-v138.js'),
  read('public/app/models/all-minilm-l6-v2/adapter.js'),
  read('public/app/models/all-minilm-l6-v2/worker.js'),
  read('public/service-worker.js'),
  read('public/app/models/all-minilm-l6-v2/reflex-index.json'),
  read('public/app/models/all-minilm-l6-v2/model-manifest.json'),
  read('public/app/intention-planner-v138.js'),
  read('public/app/intention-ui-v138.js'),
  read('public/app/intention-ui-v138.css')
]);
const pkg=JSON.parse(pkgText),manifest=JSON.parse(manifestText),index=JSON.parse(indexText);

assert(manifest.id==='Xenova/all-MiniLM-L6-v2','wrong semantic model');
assert(manifest.behavior?.tokenGeneration===false,'semantic model is configured to generate tokens');
assert(manifest.behavior?.lexicalFallbackAlwaysAvailable===true,'lexical fallback is not guaranteed');
assert(manifest.behavior?.maximumInteractiveSemanticWaitMs===350,'interactive semantic wait exceeds the contract');
assert(manifest.embeddingDimensions===384,'unexpected embedding width');

for(const [name,html] of [['loom',loom],['realm',realm],['lite',lite]]){
  assert(html.includes('minilm-reflex-runtime-v138.js?v=reflex-r1'),`${name} does not load reflex runtime`);
  assert(html.includes('minilm-model-settings-v138.js?v=reflex-r1'),`${name} does not load reflex settings`);
  assert(!html.includes('smollm2-fallback-runtime'),`${name} still loads SmolLM2 fallback`);
  assert(!html.includes('smollm2-small-model'),`${name} still loads SmolLM2 contract`);
}
assert(loom.includes('intention-planner-v138.js?v=weave-r1'),'Quad does not load intention planner');
assert(loom.includes('intention-ui-v138.js?v=weave-r1'),'Quad does not load intention review UI');
assert(realm.includes('intention-planner-v138.js?v=weave-r1'),'realm guides do not load intention planner');

for(const required of ['semanticWaitMs=350','selectLexical','semanticMatch','routeByRules','local-reflex','requestIdleCallback','mutual aid network'])assert(runtime.includes(required),`reflex runtime missing ${required}`);
for(const required of ['Onboard Semantic Reflex','Run reflex speed trial','Chat never waits for this model','MiniLM Reflex remains the immediate fallback','missingSummary','warm?.ready===false','Semantic package incomplete'])assert(settings.includes(required),`settings missing ${required}`);
assert(!settings.includes('Run five-prompt trial'),'old decoder trial remains active');
for(const required of ['CommonweaveAssistantV138','matching this against the local weave','Never expose internal request packets','CommonweaveIntentionPlanner','commonweave-planner'])assert(assistant.includes(required),`assistant missing ${required}`);
assert(!assistant.includes('fallbackExpectation'),'assistant can expose the old internal fallback packet');
for(const required of ["pipeline('feature-extraction'","['wasm','q8']","['webgpu','q4f16']","pooling:'mean'",'normalize:true','BACKEND_ROOT','wasmPaths=BACKEND_ROOT','env.useBrowserCache=false','proxy=false','numThreads=1','verifyWasm','wasmMagic','onnx-r12'])assert(worker.includes(required),`worker missing ${required}`);
assert(worker.indexOf("['wasm','q8']")<worker.indexOf("['webgpu','q4f16']"),'stable WASM backend is not attempted before experimental WebGPU');
assert(!worker.includes('wasmPaths={'),'worker uses the unsupported object-form wasmPaths configuration');
for(const required of ['model_q4f16.onnx','model_quantized.onnx','prewarm','match','benchmark','worker.js?v=reflex-r4','htmlFallback','length>=spec.minBytes','stopWorker'])assert(adapter.includes(required),`adapter missing ${required}`);

assert(sw.includes("CACHE_REVISION='minilm-runtime-r18'"),'service worker revision is stale');
for(const required of ['/app/models/all-minilm-l6-v2/tokenizer.json','/app/intention-planner-v138.js','/app/intention-ui-v138.js','/app/intention-ui-v138.css','MODEL_GRAPH_PREFIX','modelNetworkFirst','binaryStreamFirst','ONNX_BACKEND_PREFIX'])assert(sw.includes(required),`service worker missing ${required}`);
assert(sw.includes("if(url.pathname.startsWith(ONNX_BACKEND_PREFIX)){event.respondWith(binaryStreamFirst(request))"),'ONNX runtime binary is not streamed directly');
assert(sw.includes("if(url.pathname.startsWith(MODEL_GRAPH_PREFIX)){event.respondWith(binaryStreamFirst(request))"),'ONNX model graph is not streamed directly');
assert(!/CORE=\[[\s\S]*all-minilm-l6-v2\/onnx\/model_q4f16\.onnx/.test(sw),'WebGPU graph is eagerly precached');
assert(!sw.includes('smollm2-360m-instruct'),'service worker still references SmolLM2');
assert(!pkgText.includes('ensure-smollm2'),'package lifecycle still invokes SmolLM2 materialization');
assert(pkg.scripts?.postinstall?.includes('ensure-minilm-model.mjs --soft'),'MiniLM is not materialized during install');
assert(pkg.scripts?.prestart?.includes('stage-transformers-assets.mjs && node scripts/ensure-minilm-model.mjs'),'host startup does not require a complete MiniLM package');
assert(!pkg.scripts?.prestart?.includes('--soft'),'host startup can silently accept an incomplete MiniLM package');
assert(pkg.scripts?.check?.includes('verify-minilm-reflex-v138.mjs'),'MiniLM verifier is not part of npm check');

const entries=Array.isArray(index.entries)?index.entries:[];
const mutual=entries.find(entry=>entry.id==='mutual-aid-food-network');
assert(mutual?.system==='commonweave','mutual-aid network is not coordinated by Commonweave');
assert(mutual?.subplans?.length===4,'mutual-aid pattern does not span all four realms');

for(const required of ['commonweave.intention-weave.v1','requiresExplicitActivation:true','living-school','cerbanimo','anarchadia','Remove a path','Move a path earlier or later'])assert(planner.includes(required),`intention planner missing ${required}`);
for(const required of ['Activate weave','Return to review','data-path-up','data-path-down','data-path-remove','data-plan-save'])assert(ui.includes(required),`intention UI missing ${required}`);
assert(uiCss.includes('.cw138-plan-state.is-active'),'intention UI lacks active-state styling');

const storage=new Map();
const sandbox={
  console,
  Date,
  Math,
  localStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
  globalThis:null
};
sandbox.globalThis=sandbox;
vm.runInNewContext(planner,sandbox,{filename:'intention-planner-v138.js'});
const conversation=[
  {role:'user',text:'Learn to love myself'},
  {role:'assistant',text:'Reflect on a gentle intention for self-kindness.'},
  {role:'user',text:'Caring for myself before worrying about others'},
  {role:'user',text:'Not being touched by others unless there are clear intentions'},
  {role:'user',text:'Clear communication without misleading information or hard-to-process emotional struggles between peers'},
  {role:'user',text:'Build me a plan to teach me to love myself'}
];
const built=sandbox.CommonweaveIntentionPlanner.buildPlan({text:conversation.at(-1).text,history:conversation,context:{routingAnswer:{room:'commonweave.quad'}}});
assert(built.state==='review','self-love weave is active before review');
assert(built.requiresExplicitActivation===true,'self-love weave does not require explicit activation');
assert(built.paths.length===2,'self-love weave should create learning and skilled paths without inventing materials');
assert(built.paths[0].realm==='living-school','self-love weave does not begin with a learning path');
assert(built.paths[1].realm==='cerbanimo','self-love weave does not include a doing path');
assert(built.governance?.realm==='anarchadia','self-love weave lacks a consent and peer-agreement layer');
assert(!built.paths.some(item=>item.realm==='fellowfare'),'self-love weave invented a material path');
const created=sandbox.CommonweaveIntentionPlanner.maybeCreate({text:conversation.at(-1).text,history:conversation,context:{routingAnswer:{room:'commonweave.quad'}}});
assert(created?.response?.choice?.mode==='Plan','plan trigger did not switch Weaveling to Plan mode');
const saved=JSON.parse(storage.get('commonweave.intentions.v127'));
assert(saved?.[0]?.kind==='weave-plan'&&saved[0].state==='review','reviewable weave was not persisted');

const wasmRuntime=await readFile(path.join(root,'public/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.wasm'));
assert(wasmRuntime.length>1000000,`ONNX WASM runtime is only ${wasmRuntime.length} bytes`);
assert(wasmRuntime[0]===0&&wasmRuntime[1]===97&&wasmRuntime[2]===115&&wasmRuntime[3]===109,'ONNX WASM runtime lacks the 0061736d magic bytes');

for(const [relative,size,sha] of [
  ['public/app/models/all-minilm-l6-v2/onnx/model_q4f16.onnx',30018257,'eb08a666c46109637e0b6cb04f6052a68efd59bb0252d4e0438d28fb6b2d853d'],
  ['public/app/models/all-minilm-l6-v2/onnx/model_quantized.onnx',22972370,'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1']
]){
  const info=await stat(path.join(root,relative));
  assert(info.size===size,`${relative} size is ${info.size}, expected ${size}`);
  assert(await digest(relative)===sha,`${relative} hash mismatch`);
}

console.log(JSON.stringify({
  ok:true,
  model:manifest.id,
  architecture:'canonical planner + lexical reflex + background semantic retrieval',
  interactiveWaitMs:350,
  tokenGeneration:false,
  backendOrder:['wasm','webgpu'],
  wasmRuntime:{bytes:wasmRuntime.length,magic:'0061736d'},
  graphs:{webgpu:30018257,wasm:22972370},
  patterns:entries.length,
  selfLoveWeave:{paths:built.paths.map(item=>item.realm),governance:built.governance.realm,state:built.state},
  cacheRevision:'minilm-runtime-r18'
},null,2));
