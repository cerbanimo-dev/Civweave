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
  read('package.json'),read('public/app/loom-v128.html'),read('public/app/realm-v128.html'),read('public/app/lite-v129.html'),read('public/app/minilm-reflex-runtime-v138.js'),read('public/app/minilm-model-settings-v138.js'),read('public/app/assistant-runtime-v138.js'),read('public/app/models/all-minilm-l6-v2/adapter.js'),read('public/app/models/all-minilm-l6-v2/worker.js'),read('public/service-worker.js'),read('public/app/models/all-minilm-l6-v2/reflex-index.json'),read('public/app/models/all-minilm-l6-v2/model-manifest.json'),read('public/app/intention-planner-v138.js'),read('public/app/intention-ui-v138.js'),read('public/app/intention-ui-v138.css')
]);
const pkg=JSON.parse(pkgText),manifest=JSON.parse(manifestText),index=JSON.parse(indexText);
assert(manifest.id==='Xenova/all-MiniLM-L6-v2','wrong semantic model');
assert(manifest.behavior?.tokenGeneration===false,'semantic model is configured to generate tokens');
assert(manifest.behavior?.lexicalFallbackAlwaysAvailable===true,'lexical fallback is not guaranteed');
assert(manifest.behavior?.maximumInteractiveSemanticWaitMs===350,'interactive semantic wait exceeds the contract');
assert(manifest.embeddingDimensions===384,'unexpected embedding width');
for(const [name,html] of [['loom',loom],['realm',realm],['lite',lite]]){
  assert(html.includes('minilm-reflex-runtime-v138.js'),`${name} does not load reflex runtime`);
  assert(html.includes('minilm-model-settings-v138.js'),`${name} does not load reflex settings`);
  assert(html.includes('intention-planner-v138.js'),`${name} does not load intention planner`);
  assert(html.includes('intention-ui-v138.js'),`${name} does not load intention review UI`);
  assert(!html.includes('smollm2-fallback-runtime'),`${name} still loads SmolLM2 fallback`);
}
for(const required of ['conversationKind','Conversational message handled without semantic routing','No stored response pattern was used as finished dialogue','guidePrompt','semantic.score>=.42','normalizedBy:\'civweave-reflex-v2\''])assert(runtime.includes(required),`reflex runtime missing ${required}`);
assert(!runtime.includes('safe(entry?.answer'),'runtime still emits canned index answers');
for(const required of ['CivweaveAssistantV138','approvalGate','data-gate-action="activate"','CivweaveIntentionUI','civweave:intentions-changed'])assert(assistant.includes(required),`assistant missing ${required}`);
for(const required of ['Onboard Semantic Reflex','Run reflex speed trial','warm?.ready===false','Semantic package incomplete'])assert(settings.includes(required),`settings missing ${required}`);
for(const required of ["pipeline('feature-extraction'","['wasm','q8']","['webgpu','q4f16']",'verifyWasm','wasmMagic','onnx-r12'])assert(worker.includes(required),`worker missing ${required}`);
assert(worker.indexOf("['wasm','q8']")<worker.indexOf("['webgpu','q4f16']"),'WASM is not attempted before WebGPU');
for(const required of ['worker.js?v=reflex-r4','stopWorker','response.blob()).size'])assert(adapter.includes(required),`adapter missing ${required}`);
assert(sw.includes("CACHE_REVISION='minilm-runtime-r19'"),'service worker revision is stale');
for(const required of ['MODEL_GRAPH_PREFIX','binaryStreamFirst','ONNX_BACKEND_PREFIX','1.0.30-minilm-runtime-r19'])assert(sw.includes(required),`service worker missing ${required}`);
assert(!/CORE=\[[\s\S]*all-minilm-l6-v2\/onnx\/model_q4f16\.onnx/.test(sw),'WebGPU graph is eagerly precached');
assert(pkg.scripts?.prestart?.includes('ensure-minilm-model.mjs'),'host startup does not require MiniLM materialization');
assert(!pkg.scripts?.prestart?.includes('--soft'),'host startup can silently accept an incomplete MiniLM package');

const entries=Array.isArray(index.entries)?index.entries:[];
assert(index.schema==='civweave.reflex-index.v2','reflex index schema was not upgraded');
assert(entries.length>=10,'reflex index lost routing coverage');
for(const entry of entries){
  assert(entry.label&&entry.clarify,`${entry.id} lacks routing metadata`);
  assert(!('answer'in entry),`${entry.id} still stores canned answer prose`);
  assert(!('nextAction'in entry),`${entry.id} still stores canned next-action prose`);
}
const mutual=entries.find(entry=>entry.id==='mutual-aid-food-network');
assert(mutual?.system==='civweave','mutual-aid network is not coordinated by Civweave');
assert(mutual?.routeHints?.length===5,'mutual-aid routing metadata does not span the coordinating weave');

for(const required of ['time looper','time traveler','playable vertical slice','intention-activation','approvalGate','requiresExplicitActivation:true'])assert(planner.includes(required),`intention planner missing ${required}`);
for(const required of ['activate(planId)','review(planId)','data-plan-id','civweave:intentions-changed','CivweaveIntentionUI={open,render,activate,review,state,items}'])assert(ui.includes(required),`intention UI missing ${required}`);
for(const required of ['.cw138-chat-gate','.cw138-activate','.cw138-chat-message'])assert(uiCss.includes(required),`intention UI CSS missing ${required}`);

const storage=new Map();
const sandbox={console,Date,Math,localStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},globalThis:null};
sandbox.globalThis=sandbox;
vm.runInNewContext(planner,sandbox,{filename:'intention-planner-v138.js'});
const selfLoveConversation=[{role:'user',text:'Learn to love myself'},{role:'user',text:'Not being touched by others unless there are clear intentions'},{role:'user',text:'Build me a plan to teach me to love myself'}];
const selfLove=sandbox.CivweaveIntentionPlanner.buildPlan({text:selfLoveConversation.at(-1).text,history:selfLoveConversation,context:{routingAnswer:{room:'civweave.quad'}}});
assert(selfLove.state==='review'&&selfLove.requiresExplicitActivation===true,'self-love weave bypasses review');
assert(selfLove.paths.map(item=>item.realm).join(',')==='living-school,cerbanimo','self-love weave has the wrong paths');
assert(selfLove.governance?.realm==='anarchadia','self-love weave lacks its consent layer');
const gameText='let\'s make a plan to create a game about a time looper meeting a time traveler';
const game=sandbox.CivweaveIntentionPlanner.buildPlan({text:gameText,history:[{role:'user',text:gameText}],context:{routingAnswer:{room:'civweave.quad'}}});
assert(game.title==='Prototype a game about a time looper meeting a time traveler','game weave has a generic title');
assert(game.paths.map(item=>item.realm).join(',')==='living-school,cerbanimo','game weave does not include design and build paths');
assert(/looper/i.test(game.paths[0].purpose)&&/traveler/i.test(game.paths[0].purpose),'game learning path lost the temporal distinction');
assert(/playable/i.test(game.paths[1].title),'game skilled path is not a playable prototype');
const created=sandbox.CivweaveIntentionPlanner.maybeCreate({text:gameText,history:[{role:'user',text:gameText}],context:{routingAnswer:{room:'civweave.quad'}}});
assert(created?.response?.approvalGate?.kind==='intention-activation','plan response lacks a real activation gate');
assert(created.response.approvalGate.planId===created.plan.id,'activation gate does not target the persisted weave');
const saved=JSON.parse(storage.get('civweave.intentions.v127'));
assert(saved?.[0]?.kind==='weave-plan'&&saved[0].state==='review','reviewable game weave was not persisted');

const wasmRuntime=await readFile(path.join(root,'public/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.wasm'));
assert(wasmRuntime.length>1000000,`ONNX WASM runtime is only ${wasmRuntime.length} bytes`);
assert(wasmRuntime[0]===0&&wasmRuntime[1]===97&&wasmRuntime[2]===115&&wasmRuntime[3]===109,'ONNX WASM runtime lacks the 0061736d magic bytes');
for(const [relative,size,sha] of [
  ['public/app/models/all-minilm-l6-v2/onnx/model_q4f16.onnx',30018257,'eb08a666c46109637e0b6cb04f6052a68efd59bb0252d4e0438d28fb6b2d853d'],
  ['public/app/models/all-minilm-l6-v2/onnx/model_quantized.onnx',22972370,'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1']
]){const info=await stat(path.join(root,relative));assert(info.size===size,`${relative} size is ${info.size}, expected ${size}`);assert(await digest(relative)===sha,`${relative} hash mismatch`)}
console.log(JSON.stringify({ok:true,model:manifest.id,architecture:'semantic retrieval labels + contextual guide composition + explicit activation gate',interactiveWaitMs:350,tokenGeneration:false,backendOrder:['wasm','webgpu'],patterns:entries.length,gameWeave:{title:game.title,paths:game.paths.map(item=>item.realm),state:game.state},approvalGate:created.response.approvalGate.kind,cacheRevision:'minilm-runtime-r19'},null,2));
