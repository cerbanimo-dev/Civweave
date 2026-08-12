import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [pulse,hardening,runtime,worker,registry]=await Promise.all([
  read('public/app/local-ai/test-pulse-v269.js'),
  read('public/app/mobile-ai-hardening-v302.js'),
  read('public/app/local-ai/runtime-v266.js'),
  read('public/app/local-ai/worker-v266.js'),
  read('public/app/local-ai/model-registry-v266.js')
]);
for(const [path,source] of [['pulse',pulse],['hardening',hardening],['runtime',runtime],['worker',worker],['registry',registry]]){
  try{new Function(source)}catch(error){console.log(`::error file=${path},title=JavaScript syntax failure::${String(error?.message||error).replaceAll('\n',' ')}`);throw error}
}
const checks=[];
const check=(name,value)=>{if(!value)console.error(`FAILED: ${name}`);assert.ok(value,name);checks.push(name)};
check('health pulse directly calls downloaded runtime',pulse.includes('const output=await runtime.generate')&&pulse.includes("provider:'downloaded-local-direct'"));
check('health pulse delegates mobile safety before inference',pulse.includes('hardening?.beginTest?.(spec)')&&pulse.includes('hardening?.finishTest?.(spec')&&pulse.includes('maxNewTokens:Number(safety.maxNewTokens||32)')&&pulse.includes('benchmark:safety.benchmark!==false'));
check('health pulse still disables thinking and preserves cedar smoke output',pulse.includes('thinking:false')&&pulse.includes('cedar 37'));
check('health pulse reports staged pass/failure and measured TTFT',pulse.includes('Local inference health · PASS')&&pulse.includes('failed at')&&pulse.includes('TTFT')&&pulse.includes('tok/s'));
check('health pulse retains near-complete repair race handling',pulse.includes('settleNearComplete')&&pulse.includes("phase:'repair-waiting'")&&pulse.includes('Date.now()-started<4000'));
check('health pulse persists v286 device measurements',pulse.includes('civweave.local-ai.health.v286')&&pulse.includes('civweave:local-model-health'));
check('health pulse exposes WASM performance diagnostics',pulse.includes('Warm benchmark')&&pulse.includes('WASM threads')&&pulse.includes('CPU lanes')&&pulse.includes('Isolation')&&pulse.includes('SIMD')&&pulse.includes('KV cache')&&pulse.includes('Worker'));
check('mobile hardening writes an interrupted-test marker before inference',hardening.includes('civweave.local-ai.test-inflight.v302')&&hardening.includes('localStorage.setItem(TEST_MARKER'));
check('mobile hardening recovers without deleting downloaded model files',hardening.includes('interrupted-model-test-recovery')&&hardening.includes("active:false,id:null")&&hardening.includes('downloadPreserved:true')&&!hardening.includes("caches.delete"));
check('mobile hardening keeps phone WebGPU health tests off the renderer lane',hardening.includes("spec?.device!=='webgpu'")&&hardening.includes("markQuarantined(spec.id,'mobile-health-check-safe-compatibility')")&&hardening.includes('benchmark:!mobile')&&hardening.includes('maxNewTokens:mobile?12:32'));
check('runtime selects v302 worker and preserves compatibility plus tier fallback',runtime.includes("VERSION='1.0.115-local-ai-runtime-v302-session-handoff'")&&runtime.includes("worker-v266.js?v=1.0.115-v302-session-handoff")&&runtime.includes('compatibilitySpec')&&runtime.includes('freshFallbackWorker')&&runtime.includes('installedTierFallbacks'));
check('worker configures bounded threaded SIMD WASM',worker.includes('Math.min(4,Math.floor(hardwareConcurrency/2)')&&worker.includes('wasm.numThreads=wasmThreads')&&worker.includes('wasm.simd=true')&&worker.includes('crossOriginIsolated'));
check('worker keeps KV cache and opt-in warm decode benchmark',worker.includes('use_cache:true')&&worker.includes('benchmarkTokensPerSecond')&&worker.includes("'benchmarking-model'")&&worker.includes('benchmark?await warmBenchmark'));
check('worker supports text-only Gemma v4 without replacing v3',worker.includes('runtimeModules=new Map()')&&worker.includes('if(spec.textOnly)modelOptions.textOnly=true')&&worker.includes("TRANSFORMERS_V3='/app/vendor/transformers/transformers.min.js'"));
check('registry keeps hidden q8 CPU compatibility lane',registry.includes("id:'qwen3-0.6b-q8-wasm'")&&registry.includes("dtype:'q8'")&&registry.includes("device:'wasm'")&&registry.includes('hidden:true'));
check('registry includes Gemma E2B and E4B mobile tiers',registry.includes("id:'gemma4-e2b-it-q2f16-mobile'")&&registry.includes("id:'gemma4-e4b-it-q2f16-mobile'"));
check('registry exposes exact Gemma artifact lengths',registry.includes('sizeBytes')&&registry.includes('763_067_904'));

async function runPulse(safety){
  let capturedRequest=null,directCalls=0,clock=100,finished=null;
  const context={
    console,
    document:{readyState:'loading',addEventListener(){},getElementById(){return null}},
    addEventListener(){},dispatchEvent(){return true},
    CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
    queueMicrotask(){},setTimeout,clearTimeout,
    localStorage:{getItem(){return null},setItem(){}},
    performance:{now(){clock+=12;return clock}},
    CivweaveMobileAIHardeningV302:{beginTest:()=>safety,finishTest:(spec,detail)=>{finished={spec,detail}}},
    CivweaveLocalModelRegistryV266:{byId:id=>id==='mock-local'?{id,label:'Mock Local',device:'webgpu',estimatedBytes:600_000_000,healthTimeoutMs:360000,contextWindowTokens:40960,workingContextTokens:4096,generation:{nonThinkingTemperature:.7}}:null},
    CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:'mock-local'}),status:async()=>({available:true})},
    CivweaveLocalModelRuntimeV266:{generate:async request=>{directCalls+=1;capturedRequest=request;return{id:'mock-local',label:'Mock Local',text:'cedar 37',elapsedMs:321,backend:safety.safeCompatibility?'wasm':'webgpu',fallbackUsed:Boolean(safety.safeCompatibility),streamed:true,metrics:{ttftMs:120,tokensPerSecond:9.5,promptTokens:12,generatedTokens:4,contextWindowTokens:40960,workingContextTokens:4096,benchmarkTokensPerSecond:safety.benchmark===false?0:10.5,wasmThreads:safety.safeCompatibility?1:4,crossOriginIsolated:true,wasmSimd:true,kvCache:true,workerInference:true}}}}
  };
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(pulse,context,{filename:'test-pulse-v269.js'});
  const generated=await context.CivweaveLocalModelTestPulseV269.test('mock-local');
  return{capturedRequest,directCalls,generated,finished};
}

const desktop=await runPulse({mobile:false,safeCompatibility:false,benchmark:true,maxNewTokens:32,mode:'full-health'});
check('desktop health performs one direct generation',desktop.directCalls===1);
check('desktop health keeps 32-token benchmark semantics',desktop.capturedRequest.maxNewTokens===32&&desktop.capturedRequest.thinking===false&&desktop.capturedRequest.benchmark===true&&desktop.capturedRequest.stream===true);
check('desktop health preserves generated text and metrics',desktop.generated.text==='cedar 37'&&desktop.generated.metrics.ttftMs===120&&desktop.generated.metrics.tokensPerSecond===9.5&&desktop.finished?.detail?.ok===true);

const mobile=await runPulse({mobile:true,safeCompatibility:true,benchmark:false,maxNewTokens:12,mode:'mobile-safe-compatibility'});
check('mobile health performs one bounded compatibility generation',mobile.directCalls===1&&mobile.capturedRequest.maxNewTokens===12&&mobile.capturedRequest.benchmark===false&&mobile.capturedRequest.thinking===false);
check('mobile health reports compatibility fallback and completion',mobile.generated.fallbackUsed===true&&mobile.generated.testMode==='mobile-safe-compatibility'&&mobile.finished?.detail?.mode==='mobile-safe-compatibility');

console.log(JSON.stringify({ok:true,revision:'local-model-test-pulse-v303-mobile-safe',checks:checks.length,directRuntime:'CivweaveLocalModelRuntimeV266.generate',thinkingDisabled:true,stagedHealth:true,wasmPerformanceDiagnostics:true,mobileSafeHealth:true,interruptedTestRecovery:true,benchmarkDisabledOnMobile:true,tierFallback:true},null,2));