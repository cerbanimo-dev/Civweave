import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [orchestrator,parity,lifecycle,boundary,controller,runtime,chatRuntime,chatOwner]=await Promise.all([
  'public/app/experience-orchestrator-v232.js',
  'public/app/settings-parity-v295.js',
  'public/app/document-lifecycle-v221.js',
  'public/app/install-boundary-v146.js',
  'public/app/model-settings-controller-v173.js',
  'public/app/local-ai/runtime-v266.js',
  'public/app/local-chat-runtime-v295.js',
  'public/app/local-chat-owner-v295.js'
].map(read));
for(const source of [orchestrator,parity,lifecycle,boundary,controller,runtime,chatRuntime,chatOwner])new Function(source);

for(const path of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert.ok(boundary.includes(path),`five-system loader lost ${path}`);
assert.match(boundary,/const EXPERIENCE_ORCHESTRATOR='\/app\/experience-orchestrator-v232\.js'/);
assert.match(boundary,/SYSTEM_EXPERIENCE_SCRIPTS=\[/);

assert.match(orchestrator,/experience-orchestrator-v299-chat-boot-runtime-fallback/);
assert.match(orchestrator,/const SETTINGS_MODULE=/);
assert.match(orchestrator,/const CHAT_MODULES=/);
assert.match(orchestrator,/function ensureSettingsModule\(/);
assert.match(orchestrator,/function ensureChatModules\(/);
assert.match(orchestrator,/function releaseLegacySettingsClick\(/);
const settingsClick=orchestrator.match(/function earlySettings\(event\)\{([\s\S]*?)\}\n\nglobalThis\.addEventListener/)?.[1]||'';
assert.ok(settingsClick,'earlySettings must remain inspectable');
assert.match(settingsClick,/openSettingsIndependent/);
assert.doesNotMatch(settingsClick,/ensureChatModules|ensureLaunchModules/,'settings must not be gated by chat readiness');
const submit=orchestrator.match(/function earlyLocalSubmit\(event\)\{([\s\S]*?)\}\nfunction earlySettings/)?.[1]||'';
assert.match(submit,/ensureChatModules/,'downloaded-local chat still needs its chat-only launch lane');
assert.match(submit,/CivweaveLocalChatOwnerV295\?\.enqueue/,'downloaded-local chat must queue through the local owner');
assert.match(orchestrator,/globalThis\.addEventListener\('submit',earlyLocalSubmit,true\)/,'local preflight must run before canonical document submit capture');
assert.doesNotMatch(orchestrator,/document\.addEventListener\('submit'/,'settings/chat orchestrator must not compete at document submit capture');

for(const selector of ['[data-action="settings"]','[data-ls-action="open-ai-settings"]','#settings-button','#model-chip']){assert.ok(orchestrator.includes(selector),`orchestrator settings selector lost ${selector}`);assert.ok(parity.includes(selector),`settings parity selector lost ${selector}`);assert.ok(lifecycle.includes(selector),`document lifecycle selector lost ${selector}`)}

assert.match(parity,/1\.0\.99-settings-parity-v296/);
assert.match(parity,/settingsIndependentOfChat:true/);
assert.match(parity,/inferenceDormantOnOpen:true/);
assert.match(parity,/function releaseLegacy\(/);
const parityOpen=parity.match(/async function open\(launcher\)\{([\s\S]*?)\}\nfunction legacyBypass/)?.[1]||'';
assert.ok(parityOpen,'settings parity open must remain inspectable');
assert.ok(parityOpen.indexOf('owner?.open?.(launcher)')<parityOpen.indexOf('ensureManagement()'),'settings UI must open before local model management loads');
assert.doesNotMatch(parityOpen,/ensureChat|LocalChat|runtime-v266|bootstrap-v266/,'settings open must not activate chat or inference');

assert.match(lifecycle,/document-lifecycle-v296-management-only-settings/);
assert.match(lifecycle,/management-only-no-inference-bootstrap-v296/);
assert.doesNotMatch(lifecycle,/bootstrap-v266\.js/,'settings lifecycle must not contain an inference-bootstrap request');
const managementList=lifecycle.match(/const LOCAL_AI_MANAGEMENT_FILES=\[([\s\S]*?)\n\];/)?.[1]||'';
assert.ok(managementList,'management file list must remain inspectable');
for(const forbidden of ['runtime-v266','runtime-bridge-v266','bootstrap-v266','test-pulse-v269','fast-interactive-runtime'])assert.ok(!managementList.includes(forbidden),`settings management lane includes inference asset ${forbidden}`);

assert.match(controller,/function requestInferenceQuiescence\(\)/,'the canonical settings owner must request inference teardown synchronously');
assert.ok(controller.indexOf('requestInferenceQuiescence();')<controller.indexOf('const existing=document.getElementById(LAYER_ID)'),'settings must request teardown before mounting or filling the panel');
assert.match(controller,/civweave:local-inference-cancel-requested/);
assert.match(runtime,/generationEpoch/,'runtime cancellation must invalidate the full fallback generation');
assert.match(runtime,/function terminalFailure\(/);
assert.match(runtime,/if\(terminalFailure\(error\)\)return false/,'explicit cancellation must never enter the fallback ladder');
assert.match(runtime,/civweave:local-inference-cancel-requested/);
assert.match(runtime,/terminalCancellation:true/);
assert.match(runtime,/settingsTeardown:true/);
assert.match(chatRuntime,/shutdown\?\.\(\{reason:'chat-stage-stalled'\}\)/,'chat watchdog cancellation must be terminal and diagnosable');
assert.match(chatOwner,/function cancelQueued\(/,'settings teardown must clear turns that would otherwise restart inference');
assert.match(chatOwner,/civweave:local-inference-cancel-requested/);

// Exercise the failure that previously restarted a fallback worker after the
// UI claimed the local session had stopped.
{
  const bus=new EventTarget(),workers=[];
  class TestEvent extends Event{constructor(type,options={}){super(type);this.detail=options.detail}}
  class TestWorker extends EventTarget{
    constructor(){super();this.terminated=false;workers.push(this)}
    postMessage(message){this.lastMessage=message}
    terminate(){this.terminated=true}
  }
  const spec={id:'test-local',label:'Test local',installable:true,device:'wasm',runtime:'transformers-js-v3',repo:'test/model',revision:'main',artifacts:[],generation:{}};
  const storage=new Map(),context={
    console,URL,Promise,Map,Set,Date,Error,Object,Array,Math,Number,String,Boolean,JSON,
    performance:{now:()=>0},setTimeout,clearTimeout,Worker:TestWorker,CustomEvent:TestEvent,
    addEventListener:bus.addEventListener.bind(bus),dispatchEvent:bus.dispatchEvent.bind(bus),
    sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))},
    navigator:{},
    CivweaveLocalModelRegistryV266:{byId:id=>id===spec.id?spec:null,fallbacks:()=>[],cpuFallback:()=>null},
    CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:spec.id}),status:async()=>({available:true})}
  };
  context.globalThis=context;vm.createContext(context);vm.runInContext(runtime,context,{filename:'runtime-v266.js'});
  const pending=context.CivweaveLocalModelRuntimeV266.generate({messages:[{role:'user',content:'test'}],timeoutMs:30000});
  for(let index=0;index<5&&!workers.length;index++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(workers.length,1,'the test inference worker did not start');
  bus.dispatchEvent(new TestEvent('civweave:local-inference-cancel-requested',{detail:{reason:'settings-open'}}));
  await assert.rejects(pending,error=>error?.code==='LOCAL_MODEL_CANCELLED'&&error?.terminal===true,'settings cancellation must reject the entire generation terminally');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(workers.length,1,'settings cancellation incorrectly spawned a fallback worker');
  assert.equal(workers[0].terminated,true,'settings cancellation did not terminate the active worker');
}

console.log(JSON.stringify({ok:true,revision:'settings-freeze-recovery-v302-terminal-teardown',canonicalSystems:5,settingsIndependentOfChat:true,legacyClickFallback:true,settingsOpenBeforeManagement:true,inferenceDormantOnSettingsOpen:true,localSubmitWindowPreflight:true,terminalInferenceCancellation:true,noFallbackAfterSettingsOpen:true,queuedTurnsCancelled:true},null,2));
