import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [pulse,bootstrap,runtime,assistant]=await Promise.all([
  read('public/app/local-ai/test-pulse-v269.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/app/local-ai/runtime-v266.js'),
  read('public/app/assistant-runtime-v141.js')
]);

new Function(pulse);
new Function(bootstrap);
new Function(runtime);
new Function(assistant);

const checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name)};

check('test pulse exposes an explicit Test model control',pulse.includes("running?'Testing model…':'Test model'")&&pulse.includes('dataset.localTestPulse'));
check('test pulse renders raw model output',pulse.includes('Raw model output')&&pulse.includes('downloaded-local direct inference'));
check('test pulse labels the orchestration bypass',pulse.includes('bypasses Weaveling')&&pulse.includes('no Weaveling contract'));
check('test pulse invokes the downloaded local runtime directly',pulse.includes('CivweaveLocalModelRuntimeV266')&&pulse.includes('const output=await runtime.generate'));
check('test pulse uses a tiny human-readable inference request',pulse.includes('maxNewTokens:64')&&pulse.includes('one short sentence'));
check('test pulse reports direct provider identity',pulse.includes("provider:'downloaded-local-direct'"));
check('test pulse never calls the assistant orchestrator',!pulse.includes('CivweaveAssistantV141')&&!pulse.includes('.respond('));
check('test pulse never fabricates deterministic fallback output',!pulse.includes('local-contract')&&!pulse.includes('civweave-action-contract'));
check('pulse DOM repair avoids rewriting identical markup',pulse.includes('node.dataset.pulseMarkup===html')&&pulse.includes('button.textContent!==label'));
check('runtime itself talks to the local generative worker',runtime.includes("request('generate'")&&runtime.includes("new Worker(WORKER"));
check('bootstrap loads pulse after settings panel',bootstrap.includes('test-pulse-v269.js')&&bootstrap.indexOf('settings-panel-v267.js')<bootstrap.indexOf('test-pulse-v269.js'));
check('bootstrap advertises direct model testing',bootstrap.includes('directModelTest:true'));

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

console.log(JSON.stringify({ok:true,revision:'local-model-test-pulse-v269',checks:checks.length,directRuntime:'CivweaveLocalModelRuntimeV266.generate',assistantBypass:true,stableDomRepair:true,mockInference:true},null,2));
