import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
async function digest(relative){const hash=createHash('sha256');for await(const chunk of createReadStream(path.join(root,relative)))hash.update(chunk);return hash.digest('hex')}
const [pkgText,loom,realm,lite,runtime,settings,assistant,adapter,worker,sw,indexText,manifestText]=await Promise.all([
  read('package.json'),read('public/app/loom-v128.html'),read('public/app/realm-v128.html'),read('public/app/lite-v129.html'),read('public/app/minilm-reflex-runtime-v138.js'),read('public/app/minilm-model-settings-v138.js'),read('public/app/assistant-runtime-v138.js'),read('public/app/models/all-minilm-l6-v2/adapter.js'),read('public/app/models/all-minilm-l6-v2/worker.js'),read('public/service-worker.js'),read('public/app/models/all-minilm-l6-v2/reflex-index.json'),read('public/app/models/all-minilm-l6-v2/model-manifest.json')
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
for(const required of ['semanticWaitMs=350','selectLexical','semanticMatch','routeByRules','local-reflex','requestIdleCallback','mutual aid network'])assert(runtime.includes(required),`reflex runtime missing ${required}`);
for(const required of ['Onboard Semantic Reflex','Run reflex speed trial','Chat never waits for this model','MiniLM Reflex remains the immediate fallback'])assert(settings.includes(required),`settings missing ${required}`);
assert(!settings.includes('Run five-prompt trial'),'old decoder trial remains active');
for(const required of ['CommonweaveAssistantV138','matching this against the local weave','Never expose internal request packets','context,messages:providerMessages'])assert(assistant.includes(required),`assistant missing ${required}`);
assert(!assistant.includes('fallbackExpectation'),'assistant can expose the old internal fallback packet');
for(const required of ["pipeline('feature-extraction'", "['webgpu','q4f16']", "['wasm','q8']", "pooling:'mean'", 'normalize:true'])assert(worker.includes(required),`worker missing ${required}`);
for(const required of ['model_q4f16.onnx','model_quantized.onnx','prewarm','match','benchmark'])assert(adapter.includes(required),`adapter missing ${required}`);
assert(sw.includes("CACHE_REVISION='minilm-reflex-r13'"),'service worker revision is stale');
assert(sw.includes('/app/models/all-minilm-l6-v2/tokenizer.json'),'tokenizer is not in offline shell');
assert(!/CORE=\[[\s\S]*model_q4f16\.onnx/.test(sw),'WebGPU graph is eagerly precached');
assert(!sw.includes('smollm2-360m-instruct'),'service worker still references SmolLM2');
assert(!pkgText.includes('ensure-smollm2'),'package lifecycle still invokes SmolLM2 materialization');
assert(pkg.scripts?.check?.includes('verify-minilm-reflex-v138.mjs'),'MiniLM verifier is not part of npm check');
const entries=Array.isArray(index.entries)?index.entries:[];
const mutual=entries.find(entry=>entry.id==='mutual-aid-food-network');
assert(mutual?.system==='commonweave','mutual-aid network is not coordinated by Commonweave');
assert(mutual?.subplans?.length===4,'mutual-aid pattern does not span all four realms');
for(const [relative,size,sha] of [
  ['public/app/models/all-minilm-l6-v2/onnx/model_q4f16.onnx',30018257,'eb08a666c46109637e0b6cb04f6052a68efd59bb0252d4e0438d28fb6b2d853d'],
  ['public/app/models/all-minilm-l6-v2/onnx/model_quantized.onnx',22972370,'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1']
]){
  const info=await stat(path.join(root,relative));assert(info.size===size,`${relative} size is ${info.size}, expected ${size}`);assert(await digest(relative)===sha,`${relative} hash mismatch`);
}
console.log(JSON.stringify({ok:true,model:manifest.id,architecture:'canonical planner + lexical reflex + background semantic retrieval',interactiveWaitMs:350,tokenGeneration:false,graphs:{webgpu:30018257,wasm:22972370},patterns:entries.length,cacheRevision:'minilm-reflex-r13'},null,2));
