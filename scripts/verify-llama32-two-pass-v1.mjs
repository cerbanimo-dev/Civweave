import assert from 'node:assert/strict';
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
assert.match(authority,/runtime\.generate\(\{messages:/,'Llama must generate through the canonical local runtime');
assert.match(authority,/structuredOutputSchema:args\.structuredOutputSchema/,'intake and compiler must preserve a constrained schema when supplied');
assert.match(authority,/await modelRuntimeFor\(model\)/,'controlled generation must not assume every local model is LiteRT');
assert.match(pipeline,/structuredOutputSchema:phase==='compile'\|\|phase==='repair'\?onnxCompiler\?schema:null:null/,'Llama compile needs token-level grammar');
assert.match(pipeline,/onnxCompiler&&\(phase==='compile'\|\|phase==='repair'\)&&\(!result\?\.strictJson\|\|!result\?\.jsonValidated\)/,'strict JSON may never silently become prompt-only JSON');
assert.match(spine,/function assertLlama32AndroidReady\(/,'prior Android renderer crashes must block ordinary app retries');
assert.match(spine,/LOCAL_LLAMA32_ANDROID_PREFLIGHT_REQUIRED/,'explicit safe refusal must identify the real memory risk');
assert.match(spine,/expectedModelId/,'selected model must be bound to its runtime request');
assert.match(spine,/structuredOutputSchema:requestOptions\.structuredOutputSchema/,'worker must receive the JSON grammar schema');
assert.match(spine,/if\(strictModel\)/,'strict ONNX generation must not silently fall back to another model');

console.log('PASS: Llama 3.2 3B installable trial, hard-token constrained compile wiring, and independent strict JSON validation.');
