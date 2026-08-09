import assert from 'node:assert/strict';
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

check('test pulse exposes an explicit Test model control',pulse.includes("button.textContent=running?'Testing model…':'Test model'"));
check('test pulse renders raw model output',pulse.includes('Raw model output')&&pulse.includes('downloaded-local direct inference'));
check('test pulse labels the orchestration bypass',pulse.includes('bypasses Weaveling')&&pulse.includes('no Weaveling contract'));
check('test pulse invokes the downloaded local runtime directly',pulse.includes('CivweaveLocalModelRuntimeV266')&&pulse.includes('const output=await runtime.generate'));
check('test pulse uses a tiny human-readable inference request',pulse.includes('maxNewTokens:64')&&pulse.includes('one short sentence'));
check('test pulse reports direct provider identity',pulse.includes("provider:'downloaded-local-direct'"));
check('test pulse never calls the assistant orchestrator',!pulse.includes('CivweaveAssistantV141')&&!pulse.includes('.respond('));
check('test pulse never fabricates deterministic fallback output',!pulse.includes('local-contract')&&!pulse.includes('civweave-action-contract'));
check('runtime itself talks to the local generative worker',runtime.includes("request('generate'")&&runtime.includes("new Worker(WORKER"));
check('bootstrap loads pulse after settings panel',bootstrap.includes('test-pulse-v269.js')&&bootstrap.indexOf('settings-panel-v267.js')<bootstrap.indexOf('test-pulse-v269.js'));
check('bootstrap advertises direct model testing',bootstrap.includes('directModelTest:true'));

console.log(JSON.stringify({ok:true,revision:'local-model-test-pulse-v269',checks:checks.length,directRuntime:'CivweaveLocalModelRuntimeV266.generate',assistantBypass:true},null,2));
