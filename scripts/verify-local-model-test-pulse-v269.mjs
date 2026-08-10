import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [pulse,bootstrap,runtime,assistant,registry,worker,lifecycle,metadataRepair]=await Promise.all([
  read('public/app/local-ai/test-pulse-v269.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/app/local-ai/runtime-v266.js'),
  read('public/app/assistant-runtime-v141.js'),
  read('public/app/local-ai/model-registry-v266.js'),
  read('public/app/local-ai/worker-v266.js'),
  read('public/app/document-lifecycle-v221.js'),
  read('public/app/local-ai/metadata-repair-v276.js')
]);

const compile=(path,source)=>{try{new Function(source)}catch(error){console.log(`::error file=${path},title=JavaScript syntax failure::${String(error?.message||error).replaceAll('\n',' ')}`);throw error}};
compile('public/app/local-ai/test-pulse-v269.js',pulse);
compile('public/app/local-ai/bootstrap-v266.js',bootstrap);
compile('public/app/local-ai/runtime-v266.js',runtime);
compile('public/app/assistant-runtime-v141.js',assistant);
compile('public/app/local-ai/model-registry-v266.js',registry);
compile('public/app/local-ai/worker-v266.js',worker);
compile('public/app/document-lifecycle-v221.js',lifecycle);
compile('public/app/local-ai/metadata-repair-v276.js',metadataRepair);

const checks=[];
const check=(name,value)=>{if(!value)console.log(`::error file=scripts/verify-local-model-test-pulse-v269.mjs,title=Local model verifier::${name}`);assert.ok(value,name);checks.push(name)};

check('test pulse exposes an explicit Test model control',pulse.includes("running?'Testing model…':'Test model'")&&pulse.includes('dataset.localTestPulse'));
check('test pulse renders raw model output',pulse.includes('Raw model output')&&pulse.includes('Direct path: CivweaveLocalModelRuntimeV266.generate()'));
check('test pulse labels the orchestration bypass',pulse.includes('bypasses Weaveling')&&pulse.includes('no Weaveling contract'));
check('test pulse invokes the downloaded local runtime directly',pulse.includes('CivweaveLocalModelRuntimeV266')&&pulse.includes('const output=await runtime.generate'));
check('test pulse uses a tiny human-readable inference request',pulse.includes('maxNewTokens:64')&&pulse.includes('one short sentence'));
check('test pulse reports direct provider identity',pulse.includes("provider:'downloaded-local-direct'"));
check('test pulse never calls the assistant orchestrator',!pulse.includes('CivweaveAssistantV141')&&!pulse.includes('.respond('));
check('test pulse never fabricates deterministic fallback output',!pulse.includes('local-contract')&&!pulse.includes('civweave-action-contract'));
check('pulse DOM repair avoids rewriting identical markup',pulse.includes('node.dataset.pulseMarkup===html')&&pulse.includes('button.textContent!==label'));
const runtimeUsesWorker=runtime.includes("request('generate'")&&runtime.includes('new Worker(WORKER');
check('runtime itself talks to the local generative worker',runtimeUsesWorker);
check('bootstrap loads pulse after settings panel',bootstrap.includes('test-pulse-v269.js')&&bootstrap.indexOf('settings-panel-v267.js')<bootstrap.indexOf('test-pulse-v269.js'));
check('bootstrap advertises direct model testing',bootstrap.includes('directModelTest:true'));
check('bootstrap advertises phone 1B tier',bootstrap.includes('phone1BTier:true'));

check('all runtime generation JSON metadata is required',((registry.match(/\['generation_config\.json',[0-9_]+,true\]/g)||[]).length>=5));
check('SmolLM special-token JSON metadata is required',registry.includes("['special_tokens_map.json',50,true]"));
check('Gemma 3 1B direct package includes external q4f16 data',registry.includes("id:'gemma3-1b-it-q4f16'")&&registry.includes("repo:'onnx-community/gemma-3-1b-it-ONNX'")&&registry.includes("['onnx/model_q4f16.onnx_data',700_000_000,true]"));
check('Gemma 3 1B is the standard default tier',registry.includes("id:'gemma3-1b-it-q4f16',label:'Gemma 3 1B IT',tier:'Standard'")&&registry.includes("recommended:'default'"));
check('runtime repairs a previously-ready install before inference',runtime.includes("state.state?.status==='ready'")&&runtime.includes('manager.repair')&&runtime.includes('repair:true,onProgress'));
check('worker recognizes the empty JSON cache-miss signature',worker.includes('Unexpected end of JSON input')&&worker.includes('missing, truncated, or invalid'));
check('test pulse recognizes the empty JSON cache-miss signature',pulse.includes('Unexpected end of JSON input')&&pulse.includes('missing, truncated, or invalid'));
check('registry includes hidden CPU compatibility runtime',registry.includes("id:'qwen3-0.6b-q8-wasm'")&&registry.includes("dtype:'q8'")&&registry.includes("device:'wasm'")&&registry.includes("['onnx/model_quantized.onnx',600_000_000,true]"));
check('runtime probes actual WebGPU adapter instead of navigator.gpu presence only',runtime.includes('navigator.gpu.requestAdapter()')&&runtime.includes('hasWebGPUAdapter'));
check('runtime downloads compatibility artifacts and retries on adapter failure',runtime.includes('backend-fallback-download')&&runtime.includes('compatibilitySpec')&&runtime.includes('backendFailure(error)'));
check('worker permits CPU/WASM and probes WebGPU only when requested',worker.includes("if(spec.device!=='webgpu')return 'wasm'")&&worker.includes('requestAdapter()')&&!worker.includes("if(!self.navigator?.gpu)throw new Error('WebGPU is unavailable in this worker.');"));
check('metadata repair wrapper only fast-repairs non-ONNX metadata',metadataRepair.includes("!/^onnx\\//i.test")&&metadataRepair.includes('missing.every(artifact=>metadataPath(artifact.path))')&&metadataRepair.includes('return base.repair(id,{onProgress})'));
check('metadata repair preserves cached model weights',metadataRepair.includes('preservesWeights:true')&&metadataRepair.includes('metadataOnlyRepair:true'));
check('metadata repair cancels stale foreground repair before writing metadata',metadataRepair.includes('await base.cancel?.(id)'));
check('bootstrap loads metadata repair immediately after download manager',bootstrap.includes('metadata-repair-v276.js')&&bootstrap.indexOf('download-manager-v267.js')<bootstrap.indexOf('metadata-repair-v276.js')&&bootstrap.indexOf('metadata-repair-v276.js')<bootstrap.indexOf('runtime-v266.js'));
check('bootstrap advertises metadata-only repair',bootstrap.includes('metadataOnlyRepair:true'));
check('settings lifecycle refuses stale pre-v277 bootstrap',lifecycle.includes("LOCAL_AI_BOOTSTRAP_VERSION='1.0.80-local-ai-bootstrap-v277-phone-1b-tier'")&&lifecycle.includes('metadataOnlyRepair===true')&&lifecycle.includes('bootstrap?.version!==LOCAL_AI_BOOTSTRAP_VERSION'));

let capturedRequest=null,directCalls=0,clock=100;
const context={
  console,
  document:{readyState:'loading',addEventListener(){}},
  addEventListener(){},
  queueMicrotask(){},
  performance:{now(){clock+=12;return clock}},
  CivweaveLocalModelRegistryV266:{byId:id=>id==='mock-local'?{id,label:'Mock Local',estimatedBytes:600_000_000}:null},
  CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:'mock-local'}),status:async()=>({available:true})},
  CivweaveLocalModelRuntimeV266:{generate:async request=>{directCalls+=1;capturedRequest=request;return{id:'mock-local',label:'Mock Local',text:'A lantern beside 42 books.',elapsedMs:321}}}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(pulse,context,{filename:'test-pulse-v269.js'});
const generated=await context.CivweaveLocalModelTestPulseV269.test('mock-local');
check('mock pulse performs exactly one direct runtime generation',directCalls===1);
check('mock pulse returns generated runtime text unchanged',generated.text==='A lantern beside 42 books.');
check('mock pulse sends a short conversational user message',capturedRequest?.messages?.length===1&&capturedRequest.messages[0].role==='user'&&capturedRequest.maxNewTokens===64);
check('mock pulse identifies direct downloaded-local provenance',generated.provider==='downloaded-local-direct'&&generated.model==='mock-local');

console.log(JSON.stringify({ok:true,revision:'local-model-test-pulse-v277-phone-1b-tier',checks:checks.length,directRuntime:'CivweaveLocalModelRuntimeV266.generate',assistantBypass:true,stableDomRepair:true,mockInference:true,jsonMetadataRepair:true,metadataOnlyRepair:true,backendFallback:true,phone1BTier:true},null,2));
