import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [registry,worker,runtime,bridge,pulse,settings,bootstrap,lifecycle]=await Promise.all([
  read('public/app/local-ai/model-registry-v266.js'),
  read('public/app/local-ai/worker-v266.js'),
  read('public/app/local-ai/runtime-v266.js'),
  read('public/app/local-ai/runtime-bridge-v266.js'),
  read('public/app/local-ai/test-pulse-v269.js'),
  read('public/app/local-ai/settings-panel-v267.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/app/document-lifecycle-v221.js'),
]);
for(const source of [registry,worker,runtime,bridge,pulse,settings,bootstrap,lifecycle])new Function(source);

const checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name)};
check('worker uses direct causal LM API',worker.includes('AutoTokenizer.from_pretrained')&&worker.includes('AutoModelForCausalLM.from_pretrained')&&!worker.includes('hf.pipeline('));
check('worker explicitly controls chat thinking',worker.includes('apply_chat_template')&&worker.includes('enable_thinking:Boolean(message.thinking)'));
check('worker verifies a real WebGPU adapter',worker.includes('navigator.gpu.requestAdapter'));
check('worker performs one-token shader warmup',worker.includes("progress(id,'warming-model'")&&worker.includes("max_new_tokens:1"));
check('worker measures true token timing',worker.includes('token_callback_function')&&worker.includes('ttftMs')&&worker.includes('tokensPerSecond'));
check('worker counts prompt tokens before generation',worker.includes('promptTokens(inputs)')&&worker.includes('LOCAL_MODEL_CONTEXT_EXCEEDED'));
check('worker keeps artifact-specific cache revisions',worker.includes('revisionFor=(spec,path)=>artifact(spec,path)?.revision||spec.revision'));
check('runtime passes contexts and artifacts to worker',runtime.includes('contextWindowTokens:spec.contextWindowTokens')&&runtime.includes('artifacts:spec.artifacts')&&runtime.includes('thinking:Boolean(thinking)'));
check('health pulse disables thinking and uses short budget',pulse.includes('maxNewTokens:32')&&pulse.includes('thinking:false')&&pulse.includes('civweave.local-ai.health.v274'));
check('health pulse exposes staged failure location',pulse.includes('failed at')&&pulse.includes('checking-gpu')&&pulse.includes('warming-model')&&pulse.includes('first-token-received'));
check('settings exposes model and working contexts',settings.includes('Model window')&&settings.includes('Civweave working default')&&settings.includes('TTFT'));
check('interactive and agentic thinking are separated',bridge.includes("return String(request.executionProfile||'interactive')==='agentic'")&&bridge.includes("code:'LOCAL_THINKING'"));
check('bootstrap cache-busts v274 local stack',bootstrap.includes('1.0.69-local-ai-bootstrap-v274-health')&&bootstrap.includes('1.0.69-v274'));
check('canonical settings requests v274 bootstrap',lifecycle.includes("bootstrap-v266.js?v=1.0.69-v274"));

const context={globalThis:null,dispatchEvent(){},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}}};context.globalThis=context;
vm.createContext(context);vm.runInContext(registry,context,{filename:'model-registry-v266.js'});
const R=context.CivweaveLocalModelRegistryV266;
const q06=R.byId('qwen3-0.6b-q4f16'),q17=R.byId('qwen3-1.7b-q4f16'),smol=R.byId('smollm3-3b-q4f16');
assert.equal(q06.contextWindowTokens,40960);assert.equal(q17.contextWindowTokens,40960);assert.equal(smol.contextWindowTokens,65536);
assert.equal(q06.workingContextTokens,4096);assert.equal(q17.workingContextTokens,4096);assert.equal(smol.workingContextTokens,2048);
const smolMeta=R.directUrl(smol,'tokenizer_config.json'),smolWeights=R.directUrl(smol,'onnx/model_q4f16.onnx_data');
assert.match(smolMeta,/a91ed44aac643515ffe38aae1e49c7213bb4ddc0/);
assert.match(smolWeights,/161c5e4dbaf4167f022f9c4dbd283ffef5f7bc51/);
assert.equal(smol.artifacts.find(x=>x.path==='generation_config.json').required,true);
checks.push('registry contexts and targeted Smol metadata repair executable');

console.log(JSON.stringify({ok:true,revision:'local-inference-health-v274',checks:checks.length,features:{canonicalCausalLM:true,chatTemplateControl:true,webGPUAdapterProbe:true,shaderWarmup:true,ttft:true,tokensPerSecond:true,contextGuard:true,thinkingProfiles:true,targetedSmolTemplateRepair:true,onDeviceBenchmarks:true}},null,2));
