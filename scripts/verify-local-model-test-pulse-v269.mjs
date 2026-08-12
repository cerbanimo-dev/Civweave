import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [pulse,runtime,worker,registry]=await Promise.all([
  read('public/app/local-ai/test-pulse-v269.js'),
  read('public/app/local-ai/runtime-v266.js'),
  read('public/app/local-ai/worker-v266.js'),
  read('public/app/local-ai/model-registry-v266.js')
]);
for(const [path,source] of [['pulse',pulse],['runtime',runtime],['worker',worker],['registry',registry]]){
  try{new Function(source)}catch(error){console.log(`::error file=${path},title=JavaScript syntax failure::${String(error?.message||error).replaceAll('\n',' ')}`);throw error}
}
const checks=[];
const check=(name,value)=>{if(!value)console.error(`FAILED: ${name}`);assert.ok(value,name);checks.push(name)};
check('health pulse directly calls downloaded runtime',pulse.includes('const output=await runtime.generate')&&pulse.includes("provider:'downloaded-local-direct'"));
check('health pulse uses 32-token non-thinking benchmark request',pulse.includes('maxNewTokens:32')&&pulse.includes('thinking:false')&&pulse.includes('benchmark:true')&&pulse.includes('cedar 37'));
check('health pulse reports staged pass/failure and measured TTFT',pulse.includes('Local inference health · PASS')&&pulse.includes('failed at')&&pulse.includes('TTFT')&&pulse.includes('tok/s'));
check('health pulse retains near-complete repair race handling',pulse.includes('settleNearComplete')&&pulse.includes("phase:'repair-waiting'")&&pulse.includes('Date.now()-started<4000'));
check('health pulse persists v286 device measurements',pulse.includes('civweave.local-ai.health.v286')&&pulse.includes('civweave:local-model-health'));
check('health pulse exposes WASM performance diagnostics',pulse.includes('Warm benchmark')&&pulse.includes('WASM threads')&&pulse.includes('CPU lanes')&&pulse.includes('Isolation')&&pulse.includes('SIMD')&&pulse.includes('KV cache')&&pulse.includes('Worker'));
check('runtime selects v302 worker and preserves compatibility plus tier fallback',runtime.includes("VERSION='1.0.115-local-ai-runtime-v302-session-handoff'")&&runtime.includes("worker-v266.js?v=1.0.115-v302-session-handoff")&&runtime.includes('compatibilitySpec')&&runtime.includes('freshFallbackWorker')&&runtime.includes('installedTierFallbacks'));
check('worker configures bounded threaded SIMD WASM',worker.includes('Math.min(4,Math.floor(hardwareConcurrency/2)')&&worker.includes('wasm.numThreads=wasmThreads')&&worker.includes('wasm.simd=true')&&worker.includes('crossOriginIsolated'));
check('worker keeps KV cache and opt-in warm decode benchmark',worker.includes('use_cache:true')&&worker.includes('benchmarkTokensPerSecond')&&worker.includes("'benchmarking-model'")&&worker.includes('benchmark?await warmBenchmark'));
check('worker supports text-only Gemma v4 without replacing v3',worker.includes('runtimeModules=new Map()')&&worker.includes('if(spec.textOnly)modelOptions.textOnly=true')&&worker.includes("TRANSFORMERS_V3='/app/vendor/transformers/transformers.min.js'"));
check('registry keeps hidden q8 CPU compatibility lane',registry.includes("id:'qwen3-0.6b-q8-wasm'")&&registry.includes("dtype:'q8'")&&registry.includes("device:'wasm'")&&registry.includes('hidden:true'));
check('registry includes Gemma E2B and E4B mobile tiers',registry.includes("id:'gemma4-e2b-it-q2f16-mobile'")&&registry.includes("id:'gemma4-e4b-it-q2f16-mobile'"));
check('registry exposes exact Gemma artifact lengths',registry.includes('sizeBytes')&&registry.includes('763_067_904'));
let capturedRequest=null,directCalls=0,clock=100;
const context={
  console,
  document:{readyState:'loading',addEventListener(){},getElementById(){return null}},
  addEventListener(){},dispatchEvent(){return true},
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  queueMicrotask(){},setTimeout,clearTimeout,
  localStorage:{getItem(){return null},setItem(){}},
  performance:{now(){clock+=12;return clock}},
  CivweaveLocalModelRegistryV266:{byId:id=>id==='mock-local'?{id,label:'Mock Local',estimatedBytes:600_000_000,healthTimeoutMs:360000,contextWindowTokens:40960,workingContextTokens:4096,generation:{nonThinkingTemperature:.7}}:null},
  CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:'mock-local'}),status:async()=>({available:true})},
  CivweaveLocalModelRuntimeV266:{generate:async request=>{directCalls+=1;capturedRequest=request;return{id:'mock-local',label:'Mock Local',text:'cedar 37',elapsedMs:321,backend:'wasm',streamed:true,metrics:{ttftMs:120,tokensPerSecond:9.5,promptTokens:12,generatedTokens:4,contextWindowTokens:40960,workingContextTokens:4096,benchmarkTokensPerSecond:10.5,wasmThreads:4,crossOriginIsolated:true,wasmSimd:true,kvCache:true,workerInference:true}}}}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(pulse,context,{filename:'test-pulse-v269.js'});
const generated=await context.CivweaveLocalModelTestPulseV269.test('mock-local');
check('mock health performs one direct generation',directCalls===1);
check('mock health disables thinking, caps output at 32 and opts into benchmark',capturedRequest.maxNewTokens===32&&capturedRequest.thinking===false&&capturedRequest.benchmark===true&&capturedRequest.stream===true);
check('mock health preserves generated text and WASM metrics',generated.text==='cedar 37'&&generated.metrics.ttftMs===120&&generated.metrics.tokensPerSecond===9.5&&generated.metrics.wasmThreads===4&&generated.metrics.kvCache===true);
console.log(JSON.stringify({ok:true,revision:'local-model-test-pulse-v287-gemma4-mobile',checks:checks.length,directRuntime:'CivweaveLocalModelRuntimeV266.generate',thinkingDisabled:true,stagedHealth:true,wasmPerformanceDiagnostics:true,gemma4Mobile:true,tierFallback:true},null,2));
