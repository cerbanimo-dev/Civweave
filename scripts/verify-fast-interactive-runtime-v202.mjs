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
    CommonweaveModelRuntime:runtime,
    performance:{now:()=>{tick+=7;return tick}},
    setInterval:()=>1,
    clearInterval:()=>{},
    CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},
    dispatchEvent:event=>{events.push(event);return true},
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

assert.ok(context.CommonweaveFastInteractiveV192,'the script must publish its runtime API');
assert.equal(context.CommonweaveFastInteractiveV192.status().installed,true,'the fast runtime must install against a frozen model API');
assert.notEqual(context.CommonweaveModelRuntime,frozenRuntime,'installation must replace the global reference with a proxy');
assert.equal(Object.isFrozen(context.CommonweaveModelRuntime),true,'the proxy must remain immutable');
assert.equal(frozenRuntime.generate,originalGenerate,'the frozen source runtime must not be mutated');
assert.equal(context.CommonweaveModelRuntime.generate.__commonweaveFastInteractiveV192,true,'the proxy generate method must be marked');

const result=await context.CommonweaveModelRuntime.generate({
  purpose:'commonweave-guide-response-v141-merlin',
  config:{provider:'gemini',timeoutMs:60000,maxTokens:9000,stream:true},
  messages:[],
});
assert.equal(calls.length,1,'the original generator must be called exactly once');
assert.equal(calls[0].config.timeoutMs,10000,'Gemini guide calls must retain the interactive timeout cap');
assert.equal(calls[0].config.maxTokens,1800,'guide calls must retain the interactive token cap');
assert.equal(calls[0].config.stream,false,'guide calls must remain non-streaming JSON calls');
assert.equal(calls[0].responseFormat,'json','guide calls must request structured JSON');
assert.equal(calls[0].maxRepairAttempts,0,'guide calls must avoid a second repair call');
assert.match(result.latency.revision,/frozen-runtime-proxy/,'the result must record the proxy revision');
assert.ok(events.some(event=>event.type==='commonweave:fast-interactive-installed'),'the runtime must announce successful proxy installation');

const waiting=contextFor(undefined).context;
vm.runInContext(source,waiting,{filename:'fast-interactive-runtime-v192-waiting.js'});
assert.ok(waiting.CommonweaveFastInteractiveV192,'readiness must be published even before the model runtime arrives');
assert.equal(waiting.CommonweaveFastInteractiveV192.status().mode,'waiting','an absent model runtime must wait without throwing');

assert.doesNotMatch(source,/runtime\.generate\s*=/,'the fast runtime must never mutate the frozen generate property');
assert.match(critical,/(?:living-school-lesson-nav-v202|fellowfare-active-v203)-fast-runtime-proxy/,'critical boot revision must retain the frozen runtime proxy repair');
assert.ok(critical.includes("'/app/fast-interactive-runtime-v192.js'"),'critical boot must refresh the corrected runtime');
assert.match(worker,/service-worker-critical-v199\.js\?v=(?:fast-runtime-proxy-v202|fellowfare-active-v203)/,'the registered worker must force an imported-script refresh');

for(const forbidden of [
  'model-settings-controller-v173.js',
  'unified-ai-settings-v175.js',
  'commonweave-model-profiles-v1',
  'commonweave.universal-ai.v127',
])assert.ok(!source.includes(forbidden),`fast runtime repair must not touch settings through ${forbidden}`);

console.log(JSON.stringify({
  ok:true,
  revision:'fast-interactive-runtime-v202',
  frozenRuntimeProxy:true,
  readinessBeforeInstall:true,
  guideOptimizationPreserved:true,
  criticalRefresh:true,
  settingsBoundary:'untouched',
},null,2));
