import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(path,'utf8');
const [campus,lifecycle,orchestrator,delegation,spine,broker,gemini,memory,localBridge,bootstrap]=await Promise.all([
  read('public/app/working-campus-v156.html'),
  read('public/app/document-lifecycle-v221.js'),
  read('public/app/experience-orchestrator-v232.js'),
  read('public/app/settings-delegation-v175.js'),
  read('public/app/fast-interactive-runtime-v192.js'),
  read('public/app/ai-capability-broker-v268.js'),
  read('public/app/gemini-task-tier-router-v213.js'),
  read('public/app/weaveling-memory-bridge-v191.js'),
  read('public/app/local-ai/runtime-bridge-v266.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
]);
for(const source of [lifecycle,orchestrator,delegation,spine,broker,gemini,memory,localBridge,bootstrap])new Function(source);

assert(campus.includes('id="settings-button"')&&campus.includes('data-open-unified-ai-settings'),'Civweave topbar lost its canonical AI settings trigger.');
assert(campus.includes('id="model-chip"')&&campus.includes('data-open-unified-ai-settings'),'Civweave model chip lost its canonical AI settings trigger.');
assert(campus.includes('/app/model-settings-controller-v173.js'),'Civweave campus no longer loads the clean-room controller.');
assert(lifecycle.includes("const AI_SETTINGS_DELEGATION='/app/settings-delegation-v175.js"),'Document lifecycle lost the compatibility delegation recovery path.');
assert(lifecycle.includes('function ensureAISettingsDelegation()'),'Compatibility AI settings delegation recovery is missing.');
assert(!lifecycle.includes('startEntryRepair();'),'Document lifecycle must not start a competing Settings input owner.');
assert(orchestrator.includes("globalThis.addEventListener('click',earlySettings,true)"),'The experience orchestrator no longer owns canonical Settings capture.');
assert(orchestrator.includes("settingsCaptureOwner:'window-only-v316'"),'Canonical Settings ownership is no longer explicit.');
assert(orchestrator.includes('afterSettingsPaint'),'Canonical Settings open no longer yields before management work.');
assert(delegation.includes("document.addEventListener('click',onClick);"),'Compatibility AI settings delegation does not retain its guarded bubble listener.');
assert(!delegation.includes('stopImmediatePropagation'),'Compatibility AI settings delegation returned to aggressive click ownership.');
assert(!delegation.includes('[data-action="settings"]'),'Generic settings controls are incorrectly claimed by the compatibility AI settings entry.');
assert(delegation.includes('cw-ai-routing-diagnostic-v269'),'AI settings no longer surfaces capability-routing diagnostics.');

let clickHandler=null,documentClickListeners=0,openCalls=0;
class FakeElement{
  constructor(match=true){this.match=match;this.id=match?'settings-button':'appearance-settings';}
  closest(){return this.match?this:null;}
}
const sandbox={
  console,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},Element:FakeElement,
  queueMicrotask:fn=>fn(),
  dispatchEvent(){return true},
  addEventListener(){},
  document:{
    documentElement:{dataset:{}},
    addEventListener(type,handler){if(type==='click'){documentClickListeners+=1;clickHandler=handler}},
    querySelector(){return null},
    createElement(){return{}},
  },
  CivweaveAISettingsCleanroomV188:{version:'test-cleanroom',open(){openCalls+=1;return{hidden:false}}},
  globalThis:null,
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(delegation,sandbox,{filename:'settings-delegation-v175.js'});
vm.runInContext(delegation,sandbox,{filename:'settings-delegation-v175.js'});
assert.equal(documentClickListeners,1,'Compatibility AI settings delegation double-bound after repeated initialization.');
let prevented=0,stopped=0;
clickHandler({target:new FakeElement(true),preventDefault(){prevented+=1},stopPropagation(){stopped+=1}});
assert.equal(openCalls,1,'One compatibility AI settings click did not produce exactly one clean-room open.');
assert.equal(prevented,1);assert.equal(stopped,1);
clickHandler({target:new FakeElement(false),preventDefault(){prevented+=1},stopPropagation(){stopped+=1}});
assert.equal(openCalls,1,'A non-AI settings click was captured by the compatibility AI settings delegation.');

assert(spine.includes('__civweaveRuntimeSpineV269:true')&&spine.includes('middleware=new Map()'),'Single runtime spine is missing.');
assert(spine.includes("register('fast-interactive'")&&!spine.includes('setInterval('),'Fast interactive behavior is not stable middleware.');
assert(broker.includes('function diagnostics()')&&broker.includes('lastDecision'),'Capability broker diagnostics are missing.');
assert(gemini.includes('spine.register(MIDDLEWARE_ID,middleware(),40)'),'Gemini router still bypasses the runtime spine.');
assert(!gemini.includes('globalThis.CivweaveModelRuntime=wrapped'),'Gemini router still replaces the global model runtime.');
assert(memory.includes('globalThis.CivweaveFastInteractiveV192')&&!memory.includes('fastMemoryRevision:VERSION'),'Memory bridge still owns a model-runtime proxy.');
assert(localBridge.includes('runtimeSpine.register(MIDDLEWARE_ID,middleware(),100)'),'Downloaded local generation is not a spine handler.');
assert(bootstrap.indexOf('fast-interactive-runtime-v192.js')<bootstrap.indexOf('runtime-bridge-v266.js'),'Local bootstrap does not establish the spine before local generation routing.');

console.log(JSON.stringify({ok:true,revision:'ai-settings-entry-runtime-spine-v316',settingsClickOwner:'experience-orchestrator-window-capture',compatibilityDelegationGuarded:true,doubleBindGuard:true,genericSettingsPreserved:true,routingDiagnosticsVisible:true,singleRuntimeSpine:true,geminiMiddleware:true,localHandler:true,memoryRuntimeWrapper:false},null,2));
