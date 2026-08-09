import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [lifecycle,campus,settings,bootstrap,controller]=await Promise.all([
  read('public/app/document-lifecycle-v221.js'),
  read('public/app/working-campus-v156.part5.txt'),
  read('public/app/local-ai/settings-panel-v267.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/app/model-settings-controller-v173.js'),
]);

for(const source of [lifecycle,settings,bootstrap,controller])new Function(source);
new Function(campus.replace(/\}\)\(\);\s*$/,''));

assert.match(lifecycle,/document-lifecycle-v273-local-ai-management/);
assert.match(lifecycle,/ensureLocalAISettingsManagement/);
assert.match(lifecycle,/civweave:model-settings-opened/);
assert.match(lifecycle,/CivweaveLocalAISettingsV266\?\.enhance/);
assert.match(lifecycle,/CivweaveLocalModelDownloadV266\?\.status/);
assert.match(lifecycle,/CivweaveLocalModelRegistryV266\?\.installable/);
assert.match(lifecycle,/CivweaveLocalModelBridgeV266\?\.patch/);
assert.doesNotMatch(lifecycle,/new Worker\s*\(/);
assert.doesNotMatch(lifecycle,/\.generate\s*\(/);

for(const text of ['Downloaded local AI','Download','Resume','Use locally','Remove','Raw model pulse'])assert.ok(settings.toLowerCase().includes(text.toLowerCase()),`Local settings panel lost ${text}.`);
assert.match(bootstrap,/settings-panel-v267\.js/);
assert.match(controller,/civweave:model-settings-opened/);

assert.match(campus,/bootstrap-v266\.js\?v=1\.0\.67-v271/);
assert.match(campus,/CivweaveLocalModelDownloadV266\?\.status/);
assert.match(campus,/CivweaveLocalModelRegistryV266\?\.installable/);
assert.match(campus,/CivweaveLocalModelBridgeV266\?\.patch/);
assert.match(campus,/CivweaveLocalAISettingsV266\?\.enhance/);
assert.doesNotMatch(campus,/1\.0\.60-local-ai-bootstrap-v267/);
assert.doesNotMatch(campus,/CivweaveLocalModelDownloadV266\?\.version!==/);
assert.doesNotMatch(campus,/CivweaveLocalModelBridgeV266\?\.version!==/);

const listeners=new Map();
let bootstrapLoads=0,enhanceCalls=0,workerCalls=0,generateCalls=0;
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
        sandbox.CivweaveLocalModelDownloadV266={status(){},selection(){}};
        sandbox.CivweaveLocalModelRegistryV266={installable(){return[]}};
        sandbox.CivweaveLocalModelBridgeV266={patch(){return true}};
        sandbox.CivweaveLocalAISettingsV266={version:'future-settings-version',enhance(){enhanceCalls+=1}};
        sandbox.CivweaveLocalAIBootstrapV266={version:'future-bootstrap-version',ready:Promise.resolve(true)};
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
assert.equal(workerCalls,0,'Opening AI settings must not start a local inference Worker.');
assert.equal(generateCalls,0,'Opening AI settings must not invoke model generation.');
assert.equal(sandbox.CivweaveDocumentLifecycleV221.localAIManagementReady(),true,'Future-version local stack should qualify by capability.');

console.log(JSON.stringify({
  ok:true,
  revision:'local-model-settings-mount-v273',
  canonicalSettingsMount:true,
  capabilityBasedReadiness:true,
  staleV267GateRemoved:true,
  managementControlsPreserved:true,
  inferenceDormantOnOpen:true,
  bootstrapLoads,
  enhanceCalls,
},null,2));
