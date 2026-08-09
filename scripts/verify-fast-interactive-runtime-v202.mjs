import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(path,'utf8');
const source=read('public/app/fast-interactive-runtime-v192.js');
const worker=read('public/service-worker-v156.js');
const critical=read('public/service-worker-critical-v199.js');

function contextFor(runtime){
  let tick=100;
  const events=[];
  const context=vm.createContext({
    console,
    CivweaveModelRuntime:runtime,
    performance:{now:()=>{tick+=7;return tick}},
    CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},
    dispatchEvent:event=>{events.push(event);return true},
    addEventListener:()=>{},
  });
  return{context,events};
}

const calls=[];
const originalGenerate=async request=>{
  calls.push(request);
  return Object.freeze({status:'success',actual:{provider:request.config?.provider||'deterministic'},latency:{baseMs:3}});
};
const frozenRuntime=Object.freeze({
  version:'test-frozen-runtime',
  generate:originalGenerate,
  readSharedConfig:()=>null,
});
const {context,events}=contextFor(frozenRuntime);
vm.runInContext(source,context,{filename:'fast-interactive-runtime-v192.js'});

assert.ok(context.CivweaveFastInteractiveV192,'the script must publish its runtime spine API');
assert.equal(context.CivweaveFastInteractiveV192.status().installed,true,'the runtime spine must install against a frozen model API');
assert.notEqual(context.CivweaveModelRuntime,frozenRuntime,'installation must replace the global reference with a single immutable proxy');
assert.equal(Object.isFrozen(context.CivweaveModelRuntime),true,'the runtime spine proxy must remain immutable');
assert.equal(frozenRuntime.generate,originalGenerate,'the frozen source runtime must not be mutated');
assert.equal(context.CivweaveModelRuntime.__civweaveRuntimeSpineV269,true,'the proxy must retain the v269 compatibility marker');
assert.equal(context.CivweaveModelRuntime.__civweaveRuntimeSpineV271,true,'the proxy must advertise the current v271 runtime spine');
assert.equal(context.CivweaveFastInteractiveV192.status().middleware.join(','),'fast-interactive','fast optimization must be registered as middleware.');

const result=await context.CivweaveModelRuntime.generate({
  purpose:'civweave-guide-response-v141-merlin',
  config:{provider:'gemini',timeoutMs:60000,maxTokens:9000,stream:true},
  messages:[],
});
assert.equal(calls.length,1,'the base generator must be called exactly once');
assert.equal(calls[0].config.timeoutMs,10000,'Gemini guide calls must retain the interactive timeout cap');
assert.equal(calls[0].config.maxTokens,1800,'guide calls must retain the interactive token cap');
assert.equal(calls[0].config.stream,false,'guide calls must remain non-streaming JSON calls');
assert.equal(calls[0].responseFormat,'json','guide calls must request structured JSON');
assert.equal(calls[0].maxRepairAttempts,0,'guide calls must avoid a second repair call');
assert.equal(result.latency.revision,context.CivweaveFastInteractiveV192.version,'the result must record the active spine revision rather than a frozen historical revision');
assert.match(result.latency.revision,/runtime-spine-v271/,'the current result must record the v271 spine revision');
assert.equal(result.runtimeSpine.handledBy,'base-runtime');
assert.ok(events.some(event=>event.type==='civweave:runtime-spine-ready'),'the runtime must announce successful spine installation');

const waiting=contextFor(undefined).context;
vm.runInContext(source,waiting,{filename:'fast-interactive-runtime-v192-waiting.js'});
assert.ok(waiting.CivweaveFastInteractiveV192,'readiness must be published even before the model runtime arrives');
assert.equal(waiting.CivweaveFastInteractiveV192.status().mode,'waiting','an absent model runtime must wait without throwing');

assert.doesNotMatch(source,/runtime\.generate\s*=/,'the runtime spine must never mutate the frozen generate property');
assert.doesNotMatch(source,/setInterval\(/,'runtime installation must stay event-driven rather than polling.');
assert.match(critical,/(?:living-school-lesson-nav-v202|fellowfare-active-v203)-fast-runtime-proxy|fellowfare-active-v203-(?:cerbanimo-boundary-v204|parent-mobile-v205-cerbanimo-boundary-v204)(?:-memory-bridge-v205)?/,'critical boot revision must retain the compatibility path');
assert.ok(critical.includes("'/app/fast-interactive-runtime-v192.js'"),'critical boot must refresh the runtime spine compatibility path');
assert.match(worker,/service-worker-critical-v199\.js\?v=(?:fast-runtime-proxy-v202|fellowfare-active-v203|fellowfare-parent-mobile-v205|memory-bridge-frozen-proxy-v205)/,'the registered worker must force an imported-script refresh');

for(const forbidden of [
  'model-settings-controller-v173.js',
  'unified-ai-settings-v175.js',
  'civweave-model-profiles-v1',
  'civweave.universal-ai.v127',
])assert.ok(!source.includes(forbidden),`runtime spine must not reach into settings through ${forbidden}`);

console.log(JSON.stringify({
  ok:true,
  revision:'runtime-spine-v271',
  frozenRuntimeProxy:true,
  singleRuntimeSpine:true,
  readinessBeforeInstall:true,
  guideOptimizationPreserved:true,
  eventDrivenInstall:true,
  criticalRefresh:true,
  settingsBoundary:'untouched',
},null,2));
