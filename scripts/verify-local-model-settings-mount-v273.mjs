import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [lifecycle,campus,settings,bootstrap,controller,pulse,registry]=await Promise.all([
  read('public/app/document-lifecycle-v221.js'),
  read('public/app/working-campus-v156.part5.txt'),
  read('public/app/local-ai/settings-panel-v267.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/app/model-settings-controller-v173.js'),
  read('public/app/local-ai/test-pulse-v269.js'),
  read('public/app/local-ai/model-registry-v266.js'),
]);

for(const source of [lifecycle,settings,bootstrap,controller,pulse,registry])new Function(source);
new Function(campus.replace(/\}\)\(\);\s*$/,''));

assert.match(lifecycle,/document-lifecycle-v277-phone-1b-tier/);
assert.match(lifecycle,/ensureLocalAISettingsManagement/);
assert.match(lifecycle,/enhanceLocalAISettings/);
assert.match(lifecycle,/civweave:model-settings-opened/);
assert.match(lifecycle,/CivweaveLocalAISettingsV266\?\.enhance/);
assert.match(lifecycle,/CivweaveLocalModelTestPulseV269\?\.enhance/);
assert.match(lifecycle,/CivweaveLocalModelDownloadV266\?\.status/);
assert.match(lifecycle,/metadataOnlyRepair===true/);
assert.match(lifecycle,/CivweaveLocalModelRegistryV266\?\.installable/);
assert.match(lifecycle,/CivweaveLocalModelBridgeV266\?\.patch/);
assert.match(lifecycle,/1\.0\.80-local-ai-bootstrap-v277-phone-1b-tier/);
assert.doesNotMatch(lifecycle,/new Worker\s*\(/);
assert.doesNotMatch(lifecycle,/\.generate\s*\(/);

for(const text of ['Downloaded local AI','Download','Resume','Use locally','Remove'])assert.ok(settings.toLowerCase().includes(text.toLowerCase()),`Local settings panel lost ${text}.`);
assert.match(pulse,/Raw model pulse/i);
assert.match(pulse,/Test model/);
assert.match(bootstrap,/settings-panel-v267\.js/);
assert.match(bootstrap,/test-pulse-v269\.js/);
assert.match(bootstrap,/metadata-repair-v276\.js/);
assert.match(bootstrap,/backendFallback:true/);
assert.match(bootstrap,/metadataOnlyRepair:true/);
assert.match(bootstrap,/phone1BTier:true/);
assert.match(controller,/civweave:model-settings-opened/);

assert.match(registry,/id:'gemma3-1b-it-q4f16'/);
assert.match(registry,/repo:'onnx-community\/gemma-3-1b-it-ONNX'/);
assert.match(registry,/revision:'a7fa005d133fd9fc99e78b812f450742ad37426d'/);
assert.match(registry,/\['onnx\/model_q4f16\.onnx_data',700_000_000,true\]/);
assert.match(registry,/tier:'Standard'/);
assert.match(registry,/recommended:'default'/);
assert.match(registry,/id:'qwen3-1\.7b-q4f16',label:'Qwen 3 1\.7B',tier:'Large'/);

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
        sandbox.CivweaveLocalModelDownloadV266={status(){},selection(){},metadataOnlyRepair:true};
        sandbox.CivweaveLocalModelRegistryV266={installable(){return[]}};
        sandbox.CivweaveLocalModelBridgeV266={patch(){return true}};
        sandbox.CivweaveLocalAISettingsV266={version:'future-settings-version',enhance(){enhanceCalls+=1;return{dataset:{localPanel:true}}}};
        sandbox.CivweaveLocalModelTestPulseV269={version:'future-pulse-version',enhance(panel){assert.equal(panel?.dataset?.localPanel,true);pulseEnhanceCalls+=1}};
        sandbox.CivweaveLocalAIBootstrapV266={version:'1.0.80-local-ai-bootstrap-v277-phone-1b-tier',ready:Promise.resolve(true)};
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
assert.equal(sandbox.CivweaveDocumentLifecycleV221.localAIManagementReady(),true,'Pinned phone-1B local stack should qualify when its capabilities are mounted.');

console.log(JSON.stringify({
  ok:true,
  revision:'local-model-settings-mount-v277-phone-1b-tier',
  canonicalSettingsMount:true,
  pinnedBootstrapReadiness:true,
  managementControlsPreserved:true,
  rawPulseLateMount:true,
  inferenceDormantOnOpen:true,
  backendFallbackBootstrap:true,
  metadataOnlyRepair:true,
  phone1BTier:true,
  defaultPhoneModel:'gemma3-1b-it-q4f16',
  bootstrapLoads,
  enhanceCalls,
  pulseEnhanceCalls,
},null,2));
