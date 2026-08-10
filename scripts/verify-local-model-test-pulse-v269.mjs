import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [pulse,bootstrap,runtime,registry,worker,lifecycle,repair,settings]=await Promise.all([
  read('public/app/local-ai/test-pulse-v269.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/app/local-ai/runtime-v266.js'),
  read('public/app/local-ai/model-registry-v266.js'),
  read('public/app/local-ai/worker-v266.js'),
  read('public/app/document-lifecycle-v221.js'),
  read('public/app/local-ai/metadata-repair-v276.js'),
  read('public/app/local-ai/settings-panel-v267.js'),
]);

const compile=(path,source)=>{try{new Function(source)}catch(error){console.log(`::error file=${path},title=JavaScript syntax failure::${String(error?.message||error).replaceAll('\n',' ')}`);throw error}};
for(const [path,source] of [
  ['public/app/local-ai/test-pulse-v269.js',pulse],['public/app/local-ai/bootstrap-v266.js',bootstrap],['public/app/local-ai/runtime-v266.js',runtime],
  ['public/app/local-ai/model-registry-v266.js',registry],['public/app/local-ai/worker-v266.js',worker],['public/app/document-lifecycle-v221.js',lifecycle],
  ['public/app/local-ai/metadata-repair-v276.js',repair],['public/app/local-ai/settings-panel-v267.js',settings],
])compile(path,source);

const checks=[];
const check=(name,value)=>{if(!value)console.log(`::error file=scripts/verify-local-model-test-pulse-v269.mjs,title=Local model verifier::${name}`);assert.ok(value,name);checks.push(name)};

check('raw pulse still bypasses orchestration and calls the downloaded runtime',pulse.includes('CivweaveLocalModelRuntimeV266.generate()')&&pulse.includes('bypasses Weaveling')&&pulse.includes('const output=await runtime.generate'));
check('raw pulse keeps a tiny direct inference request',pulse.includes('maxNewTokens:64')&&pulse.includes('one short sentence'));
check('raw pulse waits for an already-finalizing package before repairing',pulse.includes('settleNearComplete')&&pulse.includes("phase:'repair-waiting'")&&pulse.includes('Date.now()-started<4000'));
check('raw pulse distinguishes finalization, metadata repair, and real downloads',pulse.includes("phase==='repair waiting'")&&pulse.includes('progress?.metadataOnly')&&pulse.includes("phase==='downloading'")&&pulse.includes('Downloading a missing local model file'));
check('raw pulse surfaces metadata transport timeout without implying weights were lost',pulse.includes('metadata repair timed out')&&pulse.includes('large cached model weights were not removed'));

check('metadata repair is v277 race-safe',repair.includes("VERSION='1.0.81-local-ai-metadata-repair-v277-race-safe'")&&repair.includes('metadataRepairRaceSafe:true'));
check('metadata repair no longer aborts an active background download',!repair.includes('base.cancel?.(id)')&&!repair.includes('await base.cancel'));
check('metadata repair gives concurrent 99-100 percent finalization a grace window',repair.includes('waitForConcurrentCompletion')&&repair.includes('FINALIZING_GRACE_MS=4000')&&repair.includes("['downloading','finalizing']"));
check('metadata repair rechecks status before each artifact fetch',repair.includes('const stillMissing=requiredMissing(current).find')&&repair.includes('if(current.available)return current'));
check('metadata repair transport has a hard abort timeout',repair.includes('FETCH_TIMEOUT_MS=20000')&&repair.includes('new AbortController()')&&repair.includes("error?.name==='AbortError'"));
check('metadata repair preserves weights and only handles non-ONNX metadata directly',repair.includes("!/^onnx\\//i")&&repair.includes('preservesWeights:true'));

check('settings never displays 100 percent before package availability',settings.includes('p=available?100:transferring?Math.min(99,raw):raw'));
check('settings suppresses contradictory ETA at finalization',settings.includes('transferring&&p<99?eta(state.etaSeconds)'));
check('settings dock also caps transferring jobs below 100 percent',settings.includes('p=transferring?Math.min(99,raw):raw'));

check('bootstrap pins race-safe repair, truthful UI, and phone tier',bootstrap.includes("VERSION='1.0.81-local-ai-bootstrap-v277-race-safe-phone-1b-tier'")&&bootstrap.includes('1.0.81-local-ai-metadata-repair-v277-race-safe')&&bootstrap.includes('1.0.81-local-model-test-pulse-v277-race-safe')&&bootstrap.includes('1.0.81-local-ai-settings-v277-progress-truth')&&bootstrap.includes('phone1BTier:true'));
check('bootstrap uses the Gemma phone-tier registry',bootstrap.includes("model-registry-v266.js?v=1.0.80-v277")&&bootstrap.includes('1.0.80-local-ai-registry-v277-phone-1b-tier'));
check('bootstrap requires race-safe repair capability markers',bootstrap.includes('metadataRepairRaceSafe===true')&&bootstrap.includes('truthfulCompletion:true'));
check('installed PWA lifecycle requires combined race-safe phone bootstrap',lifecycle.includes("LOCAL_AI_BOOTSTRAP_VERSION='1.0.81-local-ai-bootstrap-v277-race-safe-phone-1b-tier'")&&lifecycle.includes('metadataRepairRaceSafe===true')&&lifecycle.includes('truthfulCompletion===true')&&lifecycle.includes('phone1BTier:true'));

check('all runtime generation JSON metadata remains required for five installable/runtime packages',((registry.match(/\['generation_config\.json',[0-9_]+,true\]/g)||[]).length>=5));
check('Gemma 3 1B direct package includes external q4f16 data',registry.includes("id:'gemma3-1b-it-q4f16'")&&registry.includes("repo:'onnx-community/gemma-3-1b-it-ONNX'")&&registry.includes("['onnx/model_q4f16.onnx_data',700_000_000,true]"));
check('Gemma 3 1B is the standard default tier',registry.includes("id:'gemma3-1b-it-q4f16',label:'Gemma 3 1B IT',tier:'Standard'")&&registry.includes("recommended:'default'"));
check('Qwen 3 1.7B remains the large tier',registry.includes("id:'qwen3-1.7b-q4f16',label:'Qwen 3 1.7B',tier:'Large'"));
check('worker still recognizes empty JSON metadata failures',worker.includes('Unexpected end of JSON input')&&worker.includes('missing, truncated, or invalid'));
check('runtime still preserves WebGPU to WASM fallback',runtime.includes('hasWebGPUAdapter')&&runtime.includes('backend-fallback-download')&&runtime.includes('compatibilitySpec'));

let capturedRequest=null,directCalls=0,clock=100;
const context={
  console,document:{readyState:'loading',addEventListener(){}},addEventListener(){},queueMicrotask(){},setTimeout,clearTimeout,
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
check('mock pulse sends the intended short conversational request',capturedRequest?.messages?.length===1&&capturedRequest.messages[0].role==='user'&&capturedRequest.maxNewTokens===64);
check('mock pulse identifies direct downloaded-local provenance',generated.provider==='downloaded-local-direct'&&generated.model==='mock-local');

console.log(JSON.stringify({ok:true,revision:'local-model-test-pulse-v277-race-safe-phone-1b-tier',checks:checks.length,directRuntime:'CivweaveLocalModelRuntimeV266.generate',assistantBypass:true,jsonMetadataRepair:true,backendFallback:true,metadataRepairRaceSafe:true,truthfulCompletion:true,phone1BTier:true,defaultPhoneModel:'gemma3-1b-it-q4f16'},null,2));
