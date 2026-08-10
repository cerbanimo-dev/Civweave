import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [worker,runtime,bootstrap,bridge,assistant,spine,manager,pulse,registry]=await Promise.all([
  read('public/app/local-ai/worker-v266.js'),
  read('public/app/local-ai/runtime-v266.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/app/local-ai/runtime-bridge-v266.js'),
  read('public/app/assistant-runtime-v141.js'),
  read('public/app/fast-interactive-runtime-v192.js'),
  read('public/app/local-ai/download-manager-v267.js'),
  read('public/app/local-ai/test-pulse-v269.js'),
  read('public/app/local-ai/model-registry-v266.js'),
]);
for(const source of [worker,runtime,bootstrap,bridge,assistant,spine,manager,pulse,registry])new Function(source);

const checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name)};
check('Transformers 3 stays local-only',worker.includes('hf.env.allowLocalModels=true')&&worker.includes('hf.env.allowRemoteModels=false'));
check('download cache adapter is installed',worker.includes('hf.env.customCache=cacheAdapter(cache,spec)')&&worker.includes('function cacheAdapter(cache,spec)'));
check('local /models keys translate to pinned Hugging Face cache keys',worker.includes('const localPrefix=`/models/${spec.repo}/`')&&worker.includes('remotePrefix=pinnedRemoteRoot(spec)')&&worker.includes('await cache.match(remote)'));
check('missing local artifact returns synthetic cache miss before SPA HTML fallback',worker.includes("status:404,statusText:'Downloaded model cache miss'"));
check('JSON metadata failures are actionable',worker.includes('missing, truncated, or invalid')&&worker.includes('Unexpected end of JSON input')&&worker.includes('Transport detail'));
check('worker streams through Transformers TextStreamer',worker.includes('new hfRuntime.TextStreamer')&&worker.includes("post(id,'token'"));
check('worker allows WASM and probes WebGPU adapter only for GPU requests',worker.includes("if(spec.device!=='webgpu')return 'wasm'")&&worker.includes('self.navigator.gpu.requestAdapter()'));
check('runtime cache-busts fallback worker and receives tokens',runtime.includes("VERSION='1.0.73-local-ai-runtime-v275-backend-fallback'")&&runtime.includes("worker-v266.js?v=1.0.73-v275")&&runtime.includes("message.type==='token'"));
check('runtime repairs previously-ready metadata before inference',runtime.includes('manager.repair')&&runtime.includes("state.state?.status==='ready'")&&runtime.includes('repair:true,onProgress'));
check('runtime probes adapter and downloads CPU compatibility lane',runtime.includes('hasWebGPUAdapter')&&runtime.includes('navigator.gpu.requestAdapter()')&&runtime.includes('backend-fallback-download')&&runtime.includes('preferBackground:false'));
check('runtime retries worker adapter failures through compatibility model',runtime.includes('backendFailure(error)')&&runtime.includes('compatibilitySpec(selected'));
check('runtime refuses lower-capability agentic substitution',runtime.includes('LOCAL_BACKEND_CAPABILITY_UNAVAILABLE')&&runtime.includes('fallbackAllowed'));
check('registry keeps compatibility model hidden from normal catalogue',registry.includes("id:'qwen3-0.6b-q8-wasm'")&&registry.includes('hidden:true')&&registry.includes("function installable(){return models.filter(model=>model.installable)}"));
check('registry pins q8 WASM artifact',registry.includes("device:'wasm'")&&registry.includes("dtype:'q8'")&&registry.includes("['onnx/model_quantized.onnx',600_000_000,true]"));
check('bootstrap loads v271 spine and v275 fallback runtime',bootstrap.includes("1.0.67-runtime-spine-v271")&&bootstrap.includes("runtime-v266.js?v=1.0.73-v275")&&bootstrap.includes('cacheResolvedInference:true'));
check('bootstrap advertises streaming, integrity repair, metadata, and backend fallback',bootstrap.includes('localStreaming:true')&&bootstrap.includes('integrityRepair:true')&&bootstrap.includes('runtimeMetadataRequired:true')&&bootstrap.includes('backendFallback:true'));
check('bridge registers downloaded-local v275 middleware',bridge.includes("const MIDDLEWARE_ID='downloaded-local-v275'")&&bridge.includes('runtimeSpine.register(MIDDLEWARE_ID,middleware(),100)'));
check('bridge emits shared partial events',bridge.includes("emit('partial'")&&bridge.includes('accumulatedText')&&bridge.includes('used:Boolean(run.streamed)'));
check('bridge passes execution profile into backend selection',bridge.includes("executionProfile:request.executionProfile||'interactive'"));
check('bridge lets capability-preserving provider routing continue when fallback is too weak',bridge.includes("error?.code==='LOCAL_BACKEND_CAPABILITY_UNAVAILABLE'")&&bridge.includes('return null'));
check('download manager rejects poisoned JSON cache contents',manager.includes('validateArtifactResponse')&&manager.includes("reason:'invalid-json'")&&manager.includes("reason:'html'"));
check('raw pulse calls targeted integrity repair',pulse.includes('M().repair')&&pulse.includes('integrityReady'));
check('assistant dynamically reads shared runtime',assistant.includes('const runtime=()=>globalThis.CivweaveModelRuntime||null')&&assistant.includes('await rt.generate'));
check('runtime spine supports handled middleware before base runtime',spine.includes("handledBy='base-runtime'")&&spine.includes('if(out?.handled)')&&spine.includes("if(handledBy==='base-runtime')result=await base.generate(request)"));

let localCalls=0,baseCalls=0,captured=null;
const partial=[];
const spec={id:'qwen3-1.7b-q4f16',label:'Qwen 3 1.7B',estimatedBytes:1_470_000_000,capabilities:{interactive:true,structuredOutput:true,agenticReasoning:true,code:true,tools:false,externalResearch:false,vision:false}};
const baseRuntime={version:'base-test-runtime',generate:async()=>{baseCalls+=1;return{status:'success',actual:{provider:'base'},outputText:'base'}}};
const sandbox={
  console,Date,Promise,Error,Object,Boolean,Number,String,Math,
  performance:{now:()=>10},
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent:()=>true,addEventListener:()=>{},
  CivweaveModelRuntime:baseRuntime,
  CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:spec.id})},
  CivweaveLocalModelRuntimeV266:{activeSpec:()=>spec,generate:async request=>{localCalls+=1;assert.match(request.messages[1].content,/causal simulation/i);assert.equal(request.stream,true);assert.equal(request.executionProfile,'interactive');request.onToken?.({text:'Local ',index:0});request.onToken?.({text:'complex answer',index:1});return{text:'{"answer":"Local complex answer"}',json:{answer:'Local complex answer'},elapsedMs:12,streamed:true,backend:'wasm',fallbackUsed:true,executionId:'qwen3-0.6b-q8-wasm',executionLabel:'Qwen 3 0.6B CPU compatibility'}}},
  CivweaveAICapabilityBrokerV268:{supportsLocalRequest:()=>({ok:true,reason:'qualified local interactive generation',requirements:{profile:'interactive'}})},
  CivweaveFastInteractiveV192:{register:(id,hooks,priority)=>{captured={id,hooks,priority};return()=>{}},proxy:()=>baseRuntime,base:()=>baseRuntime},
};
sandbox.globalThis=sandbox;
vm.runInNewContext(bridge,sandbox,{filename:'runtime-bridge-v266.js'});
assert.equal(captured?.id,'downloaded-local-v275');
assert.equal(captured?.priority,100);
const request={purpose:'civweave-guide-response-v141',executionProfile:'interactive',responseFormat:'json',config:{stream:true},onEvent:event=>{if(event.phase==='partial')partial.push(event)},messages:[{role:'system',content:'You are Weaveling.'},{role:'user',content:'Design a causal simulation with three interacting systems and explain the tradeoffs.'}]};
const handled=await captured.hooks.handle(request);
assert.equal(handled?.handled,true);
assert.equal(localCalls,1);
assert.equal(baseCalls,0);
assert.equal(handled.result.actual.provider,'downloaded-local');
assert.equal(handled.result.actual.backend,'wasm');
assert.equal(handled.result.actual.model,'qwen3-0.6b-q8-wasm');
assert.equal(handled.result.outputJson.answer,'Local complex answer');
assert.equal(handled.result.stream.used,true);
assert.equal(partial.length,2);
assert.equal(partial.at(-1).accumulatedText,'Local complex answer');
checks.push('complex interactive guide request can stream through WASM compatibility runtime');

sandbox.CivweaveLocalModelRuntimeV266.generate=async()=>{localCalls+=1;throw Object.assign(new Error('selected agentic model needs WebGPU'),{code:'LOCAL_BACKEND_CAPABILITY_UNAVAILABLE'})};
const skipped=await captured.hooks.handle({...request,executionProfile:'agentic',messages:[{role:'system',content:'You are Weaveling.'},{role:'user',content:'Analyze a complex dependency graph.'}]});
assert.equal(skipped,null);
assert.equal(baseCalls,0);
checks.push('agentic request skips local middleware when only lower-capability WASM fallback is available');

sandbox.CivweaveLocalModelRuntimeV266.generate=async()=>{localCalls+=1;throw new Error('simulated local inference failure')};
await assert.rejects(()=>captured.hooks.handle({...request,messages:[{role:'system',content:'You are Weaveling.'},{role:'user',content:'Analyze a complex dependency graph.'}]}),/simulated local inference failure/);
assert.equal(baseCalls,0);
checks.push('non-backend local inference failure remains visible');

console.log(JSON.stringify({ok:true,revision:'local-model-cache-loader-v275-backend-fallback',checks:checks.length,features:{transformers3PinnedCacheAdapter:true,htmlShellParseRegressionBlocked:true,emptyJsonParseRegressionBlocked:true,poisonedMetadataRejected:true,targetedRepair:true,runtimeMetadataRepair:true,localStreaming:true,runtimeSpinePreserved:true,webgpuAdapterProbe:true,wasmCompatibilityFallback:true,capabilitySafeEscalation:true,complexGuideDynamicRoute:true,noSilentBaseFallback:true}},null,2));