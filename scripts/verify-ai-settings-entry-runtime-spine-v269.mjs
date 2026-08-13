import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
await import('./verify-system-ownership-v317.mjs');
const read=path=>readFile(path,'utf8');
const [gateway,spine,broker,gemini,memory,localBridge,bootstrap]=await Promise.all([
  read('public/app/settings-gateway-v317.js'),
  read('public/app/fast-interactive-runtime-v192.js'),
  read('public/app/ai-capability-broker-v268.js'),
  read('public/app/gemini-task-tier-router-v213.js'),
  read('public/app/weaveling-memory-bridge-v191.js'),
  read('public/app/local-ai/runtime-bridge-v266.js'),
  read('public/app/local-ai/bootstrap-v266.js')
]);
for(const source of [gateway,spine,broker,gemini,memory,localBridge,bootstrap])new Function(source);
assert.match(gateway,/inputOwner:true/);
assert.match(gateway,/lazyController:true/);
assert.match(gateway,/lazyManagement:true/);
assert(spine.includes('__civweaveRuntimeSpineV269:true')&&spine.includes('middleware=new Map()'),'Single runtime spine is missing.');
assert(spine.includes("register('fast-interactive'")&&!spine.includes('setInterval('),'Fast interactive behavior is not stable middleware.');
assert(broker.includes('function diagnostics()')&&broker.includes('lastDecision'),'Capability broker diagnostics are missing.');
assert(gemini.includes('spine.register(MIDDLEWARE_ID,middleware(),40)'),'Gemini router still bypasses the runtime spine.');
assert(!gemini.includes('globalThis.CivweaveModelRuntime=wrapped'),'Gemini router still replaces the global model runtime.');
assert(memory.includes('globalThis.CivweaveFastInteractiveV192')&&!memory.includes('fastMemoryRevision:VERSION'),'Memory bridge still owns a model-runtime proxy.');
assert(localBridge.includes('runtimeSpine.register(MIDDLEWARE_ID,middleware(),100)'),'Downloaded local generation is not a spine handler.');
assert(bootstrap.indexOf('fast-interactive-runtime-v192.js')<bootstrap.indexOf('runtime-bridge-v266.js'),'Local bootstrap does not establish the spine before local generation routing.');
console.log(JSON.stringify({ok:true,revision:'ai-settings-entry-runtime-spine-v317',settingsClickOwner:'settings-gateway-v317',firstClickActivation:true,singleRuntimeSpine:true,geminiMiddleware:true,localHandler:true,memoryRuntimeWrapper:false},null,2));
