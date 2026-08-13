import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [orchestrator,parity,lifecycle,boundary,controller,runtime,chatRuntime,chatOwner]=await Promise.all([
  'public/app/experience-orchestrator-v232.js','public/app/settings-parity-v295.js','public/app/document-lifecycle-v221.js','public/app/install-boundary-v146.js','public/app/model-settings-controller-v173.js','public/app/local-ai/runtime-v266.js','public/app/local-chat-runtime-v295.js','public/app/local-chat-owner-v295.js'
].map(read));
for(const source of [orchestrator,parity,lifecycle,boundary,controller,runtime,chatRuntime,chatOwner])new Function(source);

for(const path of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert.ok(boundary.includes(path));
assert.match(orchestrator,/experience-orchestrator-v316-settings-nonblocking-single-owner/);
assert.match(orchestrator,/globalThis\.addEventListener\('click',earlySettings,true\)/);
assert.doesNotMatch(orchestrator,/document\.addEventListener\('click',earlySettings,true\)/);
const settingsClick=orchestrator.match(/function earlySettings\(event\)\{([\s\S]*?)\}\n\nglobalThis\.addEventListener/)?.[1]||'';
assert.match(settingsClick,/openSettingsIndependent/);
assert.doesNotMatch(settingsClick,/ensureChatModules|ensureLaunchModules/);
const finishOpen=orchestrator.match(/function finishSettingsOpen\(layer\)\{([\s\S]*?)\}\nasync function openSettingsIndependent/)?.[1]||'';
assert.match(finishOpen,/afterSettingsPaint/,'post-open management must yield a paint');
assert.match(finishOpen,/scheduleManagement/);

assert.match(parity,/canonicalCaptureDelegated:true/);
assert.match(parity,/capturePhase:'fallback-only'/);
assert.match(parity,/managementAfterPaint:true/);
assert.match(parity,/function scheduleManagement\(/);
assert.match(parity,/requestAnimationFrame/);

assert.match(lifecycle,/document-lifecycle-v296-management-only-settings/);
assert.match(lifecycle,/document-lifecycle-v316-nonblocking-no-global-observer-patch/);
assert.match(lifecycle,/management-only-no-inference-bootstrap-v296/);
assert.doesNotMatch(lifecycle,/bootstrap-v266\.js/);
assert.doesNotMatch(lifecycle,/globalThis\.MutationObserver\s*=/,'lifecycle may not patch MutationObserver globally');
assert.doesNotMatch(lifecycle,/captureSettingsOpen/,'lifecycle may not own settings input');
assert.match(lifecycle,/function scheduleSettingsManagement\(/);
assert.match(lifecycle,/managementAfterPaint:true/);
assert.match(lifecycle,/globalObserverPatch:false/);
const managementList=lifecycle.match(/const LOCAL_AI_MANAGEMENT_FILES=\[([\s\S]*?)\n\];/)?.[1]||'';
for(const forbidden of ['runtime-v266','runtime-bridge-v266','bootstrap-v266','test-pulse-v269','fast-interactive-runtime'])assert.ok(!managementList.includes(forbidden),`settings management lane includes inference asset ${forbidden}`);

assert.match(controller,/function requestInferenceQuiescence\(\)/);
assert.ok(controller.indexOf('requestInferenceQuiescence();')<controller.indexOf('const existing=document.getElementById(LAYER_ID)'));
assert.match(controller,/civweave:local-inference-cancel-requested/);
assert.match(runtime,/generationEpoch/);
assert.match(runtime,/if\(terminalFailure\(error\)\)return false/);
assert.match(chatRuntime,/shutdown\?\.\(\{reason:'chat-stage-stalled'\}\)/);
assert.match(chatOwner,/function cancelQueued\(/);

// Cancellation still terminates one in-flight worker and must never spawn a fallback.
{
  const bus=new EventTarget(),workers=[];
  class TestEvent extends Event{constructor(type,options={}){super(type);this.detail=options.detail}}
  class TestWorker extends EventTarget{constructor(){super();this.terminated=false;workers.push(this)}postMessage(message){this.lastMessage=message}terminate(){this.terminated=true}}
  const spec={id:'test-local',label:'Test local',installable:true,device:'wasm',runtime:'transformers-js-v3',repo:'test/model',revision:'main',artifacts:[],generation:{}};
  const storage=new Map(),context={console,URL,Promise,Map,Set,Date,Error,Object,Array,Math,Number,String,Boolean,JSON,performance:{now:()=>0},setTimeout,clearTimeout,Worker:TestWorker,CustomEvent:TestEvent,addEventListener:bus.addEventListener.bind(bus),dispatchEvent:bus.dispatchEvent.bind(bus),sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))},navigator:{},CivweaveLocalModelRegistryV266:{byId:id=>id===spec.id?spec:null,fallbacks:()=>[],cpuFallback:()=>null},CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:spec.id}),status:async()=>({available:true})}};
  context.globalThis=context;vm.createContext(context);vm.runInContext(runtime,context,{filename:'runtime-v266.js'});
  const pending=context.CivweaveLocalModelRuntimeV266.generate({messages:[{role:'user',content:'test'}],timeoutMs:30000});
  for(let index=0;index<5&&!workers.length;index++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(workers.length,1);
  bus.dispatchEvent(new TestEvent('civweave:local-inference-cancel-requested',{detail:{reason:'settings-open'}}));
  await assert.rejects(pending,error=>error?.code==='LOCAL_MODEL_CANCELLED'&&error?.terminal===true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(workers.length,1);
  assert.equal(workers[0].terminated,true);
}

console.log(JSON.stringify({ok:true,revision:'settings-freeze-recovery-v316-nonblocking',canonicalSystems:5,singleSettingsInputOwner:true,settingsOpenBeforeManagement:true,managementAfterPaint:true,noGlobalObserverPatch:true,inferenceDormantOnSettingsOpen:true,terminalInferenceCancellation:true},null,2));
