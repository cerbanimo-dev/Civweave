import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [worker,runtime,bootstrap,bridge,assistant,spine]=await Promise.all([
  read('public/app/local-ai/worker-v266.js'),
  read('public/app/local-ai/runtime-v266.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/app/local-ai/runtime-bridge-v266.js'),
  read('public/app/assistant-runtime-v141.js'),
  read('public/app/fast-interactive-runtime-v192.js'),
]);

new Function(worker);
new Function(runtime);
new Function(bootstrap);
new Function(bridge);
new Function(assistant);
new Function(spine);

const checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name)};

check('Transformers 3 stays local-only',worker.includes('hf.env.allowLocalModels=true')&&worker.includes('hf.env.allowRemoteModels=false'));
check('download cache adapter is installed',worker.includes('hf.env.customCache=cacheAdapter(cache,spec)')&&worker.includes('function cacheAdapter(cache,spec)'));
check('local /models keys translate to pinned Hugging Face cache keys',worker.includes('const localPrefix=`/models/${spec.repo}/`')&&worker.includes('remotePrefix=pinnedRemoteRoot(spec)')&&worker.includes('await cache.match(remote)'));
check('missing local artifact returns synthetic cache miss before SPA HTML fallback',worker.includes("status:404,statusText:'Downloaded model cache miss'"));
check('cache miss error is actionable',worker.includes('Re-download this model while online before using it offline.'));
check('runtime cache-busts repaired worker',runtime.includes("VERSION='1.0.66-local-ai-runtime-v270-cache-loader'")&&runtime.includes("worker-v266.js?v=1.0.66-v270"));
check('bootstrap preserves v269 runtime spine',bootstrap.includes("fast-interactive-runtime-v192.js?v=1.0.65-v269")&&bootstrap.includes("1.0.65-runtime-spine-v269")&&bootstrap.includes("runtime-bridge-v266.js?v=1.0.65-v269"));
check('bootstrap loads repaired runtime and advertises cache resolution',bootstrap.includes("runtime-v266.js?v=1.0.66-v270")&&bootstrap.includes('cacheResolvedInference:true')&&bootstrap.includes('runtimeSpine:true'));
check('bridge registers downloaded-local middleware on runtime spine',bridge.includes("const MIDDLEWARE_ID='downloaded-local-v269'")&&bridge.includes('runtimeSpine.register(MIDDLEWARE_ID,middleware(),100)'));
check('assistant dynamically reads shared runtime',assistant.includes('const runtime=()=>globalThis.CivweaveModelRuntime||null')&&assistant.includes('await rt.generate'));
check('runtime spine supports handled middleware before base runtime',spine.includes("handledBy='base-runtime'")&&spine.includes('if(out?.handled)')&&spine.includes("if(handledBy==='base-runtime')result=await base.generate(request)"));

let localCalls=0,baseCalls=0,captured=null;
const spec={id:'qwen3-1.7b-q4f16',label:'Qwen 3 1.7B',estimatedBytes:1_470_000_000,capabilities:{interactive:true,structuredOutput:true,agenticReasoning:true,code:true,tools:false,externalResearch:false,vision:false}};
const baseRuntime={version:'base-test-runtime',generate:async()=>{baseCalls+=1;return{status:'success',actual:{provider:'base'},outputText:'base'}}};
const sandbox={
  console,Date,Promise,Error,Object,Boolean,Number,String,Math,
  performance:{now:()=>10},
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent:()=>true,addEventListener:()=>{},
  CivweaveModelRuntime:baseRuntime,
  CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:spec.id})},
  CivweaveLocalModelRuntimeV266:{activeSpec:()=>spec,generate:async request=>{localCalls+=1;assert.match(request.messages[1].content,/causal simulation/i);return{text:'{"answer":"Local complex answer"}',json:{answer:'Local complex answer'},elapsedMs:12}}},
  CivweaveAICapabilityBrokerV268:{supportsLocalRequest:()=>({ok:true,reason:'qualified local interactive generation',requirements:{profile:'interactive'}})},
  CivweaveFastInteractiveV192:{
    register:(id,hooks,priority)=>{captured={id,hooks,priority};return()=>{}},
    proxy:()=>baseRuntime,
    base:()=>baseRuntime,
  },
};
sandbox.globalThis=sandbox;
vm.runInNewContext(bridge,sandbox,{filename:'runtime-bridge-v266.js'});
assert.equal(captured?.id,'downloaded-local-v269');
assert.equal(captured?.priority,100);
const request={purpose:'civweave-guide-response-v141',executionProfile:'interactive',responseFormat:'json',messages:[{role:'system',content:'You are Weaveling.'},{role:'user',content:'Design a causal simulation with three interacting systems and explain the tradeoffs.'}]};
const handled=await captured.hooks.handle(request);
assert.equal(handled?.handled,true);
assert.equal(localCalls,1,'complex guide request must call downloaded-local exactly once');
assert.equal(baseCalls,0,'downloaded-local middleware must not call base provider when qualified');
assert.equal(handled.result.actual.provider,'downloaded-local');
assert.equal(handled.result.outputJson.answer,'Local complex answer');
checks.push('complex guide request executes through downloaded-local runtime-spine middleware');

sandbox.CivweaveLocalModelRuntimeV266.generate=async()=>{localCalls+=1;throw new Error('simulated local inference failure')};
await assert.rejects(()=>captured.hooks.handle({...request,messages:[{role:'system',content:'You are Weaveling.'},{role:'user',content:'Analyze a complex dependency graph.'}]}),/simulated local inference failure/);
assert.equal(baseCalls,0,'local inference failure must stay visible instead of silently substituting base provider');
checks.push('local inference failure remains visible');

console.log(JSON.stringify({ok:true,revision:'local-model-cache-loader-v270-spine',checks:checks.length,features:{transformers3PinnedCacheAdapter:true,htmlShellParseRegressionBlocked:true,workerCacheBust:true,runtimeSpinePreserved:true,complexGuideDynamicRoute:true,noSilentBaseFallback:true}},null,2));
