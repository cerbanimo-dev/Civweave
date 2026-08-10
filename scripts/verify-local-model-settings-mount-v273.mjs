import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [lifecycle,campus,settings,bootstrap,controller,pulse,registry,downloadPolicy]=await Promise.all([
  read('public/app/document-lifecycle-v221.js'),
  read('public/app/working-campus-v156.part5.txt'),
  read('public/app/local-ai/settings-panel-v267.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/app/model-settings-controller-v173.js'),
  read('public/app/local-ai/test-pulse-v269.js'),
  read('public/app/local-ai/model-registry-v266.js'),
  read('public/app/local-ai/download-policy-v278.js'),
]);

for(const source of [lifecycle,settings,bootstrap,controller,pulse,registry,downloadPolicy])new Function(source);
new Function(campus.replace(/\}\)\(\);\s*$/,''));

assert.match(lifecycle,/document-lifecycle-v278-hardware-ladder-download-policy/);
assert.match(lifecycle,/ensureLocalAISettingsManagement/);
assert.match(lifecycle,/enhanceLocalAISettings/);
assert.match(lifecycle,/civweave:model-settings-opened/);
assert.match(lifecycle,/CivweaveLocalAISettingsV266\?\.enhance/);
assert.match(lifecycle,/CivweaveLocalModelTestPulseV269\?\.enhance/);
assert.match(lifecycle,/CivweaveLocalModelDownloadV266\?\.status/);
assert.match(lifecycle,/largeExternalDataForeground===true/);
assert.match(lifecycle,/metadataOnlyRepair===true/);
assert.match(lifecycle,/metadataRepairRaceSafe===true/);
assert.match(lifecycle,/truthfulCompletion===true/);
assert.match(lifecycle,/hardwareLadder:true/);
assert.match(lifecycle,/CivweaveLocalModelRegistryV266\?\.installable/);
assert.match(lifecycle,/CivweaveLocalModelBridgeV266\?\.patch/);
assert.match(lifecycle,/1\.0\.81-local-ai-bootstrap-v278-hardware-ladder/);
assert.doesNotMatch(lifecycle,/new Worker\s*\(/);
assert.doesNotMatch(lifecycle,/\.generate\s*\(/);

for(const text of ['Downloaded local AI','Download','Resume','Use locally','Remove'])assert.ok(settings.toLowerCase().includes(text.toLowerCase()),`Local settings panel lost ${text}.`);
assert.match(settings,/1\.0\.81-local-ai-settings-v277-progress-truth/);
assert.match(settings,/truthfulCompletion:true/);
assert.match(pulse,/Raw model pulse/i);
assert.match(pulse,/Test model/);
assert.match(pulse,/raceSafeRepair:true/);
assert.match(bootstrap,/settings-panel-v267\.js/);
assert.match(bootstrap,/test-pulse-v269\.js/);
assert.match(bootstrap,/download-policy-v278\.js/);
assert.match(bootstrap,/metadata-repair-v276\.js/);
assert.ok(bootstrap.indexOf('download-manager-v267.js')<bootstrap.indexOf('download-policy-v278.js')&&bootstrap.indexOf('download-policy-v278.js')<bootstrap.indexOf('metadata-repair-v276.js'));
assert.match(bootstrap,/backendFallback:true/);
assert.match(bootstrap,/metadataOnlyRepair:true/);
assert.match(bootstrap,/metadataRepairRaceSafe:true/);
assert.match(bootstrap,/truthfulCompletion:true/);
assert.match(bootstrap,/hardwareLadder:true/);
assert.match(controller,/civweave:model-settings-opened/);

assert.match(registry,/id:'gemma3-1b-it-q4f16'/);
assert.match(registry,/repo:'onnx-community\/gemma-3-1b-it-ONNX'/);
assert.match(registry,/revision:'a7fa005d133fd9fc99e78b812f450742ad37426d'/);
assert.match(registry,/\['onnx\/model_q4f16\.onnx_data',700_000_000,true\]/);
assert.match(registry,/tier:'Standard'/);
assert.match(registry,/recommended:'default'/);
assert.match(registry,/preferBackground:false/);
assert.match(registry,/id:'smollm3-3b-q4f16',label:'SmolLM3 3B',tier:'Mini PC'/);
assert.match(registry,/id:'qwen3-4b-q4f16',label:'Qwen 3 4B',tier:'PC 12'/);
assert.match(registry,/onnx\/model_q4f16\.onnx_data_1/);
assert.match(registry,/id:'qwen3-8b-ortgenai-int4',label:'Qwen 3 8B',tier:'PC 16'/);
assert.match(registry,/id:'qwen3-14b-hardware-target',label:'Qwen 3 14B class',tier:'PC 32'/);
assert.match(registry,/id:'gemma4-26b-a4b-workstation',label:'Gemma 4 26B A4B MoE',tier:'Workstation MoE'/);
assert.match(registry,/function directUrl/);
assert.match(registry,/function sourceUrl/);
assert.match(downloadPolicy,/preferBackground===false/);
assert.match(downloadPolicy,/largeExternalDataForeground:true/);

assert.match(campus,/bootstrap-v266\.js\?v=1\.0\.67-v271/);
assert.match(campus,/CivweaveLocalModelDownloadV266\?\.status/);
assert.match(campus,/CivweaveLocalModelRegistryV266\?\.installable/);
assert.match(campus,/CivweaveLocalModelBridgeV266\?\.patch/);
assert.match(campus,/CivweaveLocalAISettingsV266\?\.enhance/);
assert.doesNotMatch(campus,/1\.0\.60-local-ai-bootstrap-v267/);
assert.doesNotMatch(campus,/CivweaveLocalModelDownloadV266\?\.version!==/);
assert.doesNotMatch(campus,/CivweaveLocalModelBridgeV266\?\.version!==/);

const listeners=new Map();
let bootstrapLoads=0,enhanceCalls=0,pulseEnhanceCalls=0,workerCalls=0,generateCalls=0;
const scripts=[];
const document={
  readyState:'loading',
  documentElement:{isConnected:true,dataset:{}},
  head:{
    isConnected:true,
    append(script){
      scripts.push(script);
      if(String(script.src||'').includes('/app/local-ai/bootstrap-v266.js')){
        bootstrapLoads+=1;
        sandbox.CivweaveLocalModelDownloadV266={status(){},selection(){},largeExternalDataForeground:true,metadataOnlyRepair:true,metadataRepairRaceSafe:true};
        sandbox.CivweaveLocalModelRegistryV266={installable(){return[]}};
        sandbox.CivweaveLocalModelBridgeV266={patch(){return true}};
        sandbox.CivweaveLocalAISettingsV266={version:'1.0.81-local-ai-settings-v277-progress-truth',truthfulCompletion:true,enhance(){enhanceCalls+=1;return{dataset:{localPanel:true}}}};
        sandbox.CivweaveLocalModelTestPulseV269={version:'1.0.81-local-model-test-pulse-v277-race-safe',raceSafeRepair:true,enhance(panel){assert.equal(panel?.dataset?.localPanel,true);pulseEnhanceCalls+=1}};
        sandbox.CivweaveLocalAIBootstrapV266={version:'1.0.81-local-ai-bootstrap-v278-hardware-ladder',ready:Promise.resolve(true)};
      }
      queueMicrotask(()=>script.onload?.());
      return script;
    }
  },
  body:{isConnected:true},
  scripts,
  querySelector(){return null},
  createElement(tag){return{tagName:String(tag).toUpperCase(),src:'',async:true,dataset:{},addEventListener(){}}},
  addEventListener(name,handler){listeners.set(`document:${name}`,handler)},
};
class FakeCustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}}
const sandbox={
  console,Promise,Map,Set,Object,Boolean,String,Error,URL,queueMicrotask,
  document,location:{href:'https://civweave.test/app/working-campus-v156.html'},
  CustomEvent:FakeCustomEvent,
  MutationObserver:undefined,
  Worker:class Worker{constructor(){workerCalls+=1}},
  dispatchEvent(){return true},
  addEventListener(name,handler){listeners.set(name,handler)},
  CivweaveModelRuntime:{generate(){generateCalls+=1}},
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(lifecycle,sandbox,{filename:'document-lifecycle-v221.js'});
assert.equal(typeof sandbox.CivweaveDocumentLifecycleV221.ensureLocalAISettingsManagement,'function');
const opened=listeners.get('civweave:model-settings-opened');
assert.equal(typeof opened,'function','Lifecycle did not subscribe to canonical settings open.');
opened({detail:{presentation:'cleanroom-v188'}});
await new Promise(resolve=>setTimeout(resolve,0));
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(bootstrapLoads,1,'Opening canonical AI settings should lazily load local management exactly once.');
assert.ok(enhanceCalls>=1,'Opening canonical AI settings should mount the downloaded local AI panel.');
assert.ok(pulseEnhanceCalls>=1,'Late-loaded Raw Model Pulse should mount after the local manager panel.');
assert.equal(workerCalls,0,'Opening AI settings must not start a local inference Worker.');
assert.equal(generateCalls,0,'Opening AI settings must not invoke model generation.');
assert.equal(sandbox.CivweaveDocumentLifecycleV221.localAIManagementReady(),true,'Hardware-ladder local stack should qualify when its capabilities are mounted.');

console.log(JSON.stringify({
  ok:true,
  revision:'local-model-settings-mount-v278-hardware-ladder',
  canonicalSettingsMount:true,
  pinnedBootstrapReadiness:true,
  managementControlsPreserved:true,
  rawPulseLateMount:true,
  inferenceDormantOnOpen:true,
  metadataOnlyRepair:true,
  metadataRepairRaceSafe:true,
  truthfulCompletion:true,
  hardwareLadder:true,
  largeExternalDataForeground:true,
  defaultPhoneModel:'gemma3-1b-it-q4f16',
  miniPcModel:'smollm3-3b-q4f16',
  pc12Model:'qwen3-4b-q4f16',
  bootstrapLoads,
  enhanceCalls,
  pulseEnhanceCalls,
},null,2));
