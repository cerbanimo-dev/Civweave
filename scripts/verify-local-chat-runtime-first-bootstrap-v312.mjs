import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [localRuntime,orchestrator,bootstrap,registry,downloadManager,downloadPolicy,settings,hardware]=await Promise.all([
  read('public/app/local-chat-runtime-v295.js'),
  read('public/app/experience-orchestrator-v232.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/app/local-ai/model-registry-v266.js'),
  read('public/app/local-ai/download-manager-v267.js'),
  read('public/app/local-ai/download-policy-v278.js'),
  read('public/app/local-ai/settings-panel-v267.js'),
  read('public/app/local-ai/hardware-tier-ui-v278.js')
]);

for(const source of [localRuntime,orchestrator,bootstrap,registry,downloadManager,downloadPolicy,settings,hardware])new Function(source);

assert.match(localRuntime,/REVISION='v312-runtime-first-bootstrap'/,'public ABI revision remains compatible with existing orchestrator checks');
assert.match(localRuntime,/inferenceCoreFirst:true/,'local chat must advertise inference-core-first startup');
assert.match(localRuntime,/fullBootstrapBlocking:false/,'full local-AI bootstrap must be non-blocking for chat inference');
assert.match(localRuntime,/model-registry-v266\.js\?v=1\.0\.121-v307-gemma3-q4&chatcore=v325/);
assert.match(localRuntime,/download-manager-v267\.js\?v=1\.0\.68-v322-explicit-sync&chatcore=v325/);
assert.match(localRuntime,/runtime-v266\.js\?v=1\.0\.121-v307-coherence-reload&chatcore=v325/);
assert.match(localRuntime,/async function ensureInferenceCore\(/);
assert.match(localRuntime,/await ensureInferenceCore\(onProgress\)/);
assert.match(localRuntime,/void startAuxiliaryBootstrap\(onProgress\)/);
assert.doesNotMatch(localRuntime,/Promise\.race\(\[Promise\.resolve\(boot\?\.ready\).*waitForRuntime/s,'chat may not depend on the full bootstrap race anymore');
assert.match(localRuntime,/LOCAL_INFERENCE_CORE_CONTRACT_FAILED/);
assert.match(localRuntime,/runtime-ready-bootstrap-auxiliary-degraded/);

assert.match(orchestrator,/CivweaveLocalChatRuntimeV295\?\.revision==='v312-runtime-first-bootstrap'/,'existing orchestrator ABI remains accepted');
assert.match(orchestrator,/runtimeFirstBootstrap:true/);

const runtimeIndex=bootstrap.indexOf("'/app/local-ai/runtime-v266.js");
const bridgeIndex=bootstrap.indexOf("'/app/local-ai/runtime-bridge-v266.js");
const settingsIndex=bootstrap.indexOf("'/app/local-ai/settings-panel-v267.js");
assert.ok(runtimeIndex>=0&&bridgeIndex>runtimeIndex&&settingsIndex>runtimeIndex,'full bootstrap still owns auxiliary bridge/settings after runtime');

assert.match(downloadManager,/explicitSyncOnly:true/);
assert.match(downloadManager,/autoSyncOnLoad:false/);
assert.match(downloadPolicy,/largeExternalDataForeground:true/);
assert.match(downloadPolicy,/explicitSyncOnly:true/);
assert.match(settings,/snapshotOnlyView:true/);
assert.match(settings,/settingsClickOwnership:false/);
assert.match(hardware,/deviceFitRecommendations:true/);
assert.match(hardware,/settingsOpenGpuProbe:false/);
assert.match(registry,/id:'smollm2-135m-instruct-q8-wasm'.*?installable:true.*?device:'wasm'/s);
assert.match(registry,/id:'gemma3-1b-it-q4f16'.*?installable:true/s);

class MemoryStorage{
  constructor(seed={}){this.values=new Map(Object.entries(seed))}
  getItem(key){return this.values.has(key)?this.values.get(key):null}
  setItem(key,value){this.values.set(key,String(value))}
  removeItem(key){this.values.delete(key)}
}
const storage=new MemoryStorage({
  'civweave.local-ai.selection.v266':JSON.stringify({active:true,id:'smollm2-135m-instruct-q8-wasm'})
});
const scripts=[];
const sandbox={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,
  localStorage:storage,
  performance:{now:()=>0},
  location:{href:'https://staging.example.test/app/working-campus-v156.html'},
  CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  dispatchEvent(){return true},
  addEventListener(){},
  setTimeout(fn){return {fn}},
  clearTimeout(){},
  document:{
    scripts,
    head:{isConnected:true,append(node){
      scripts.push(node);
      const path=new URL(node.src,'https://staging.example.test').pathname;
      if(path.endsWith('/model-registry-v266.js')){
        sandbox.CivweaveLocalModelRegistryV266={
          byId:id=>({id,workingContextTokens:768,generation:{nonThinkingTemperature:.6}}),
          installable:()=>[],
          directUrl(){return''}
        };
      }else if(path.endsWith('/download-manager-v267.js')){
        let selection={active:true,id:'smollm2-135m-instruct-q8-wasm'};
        sandbox.CivweaveLocalModelDownloadV266={
          status:async()=>({available:true}),
          selection:()=>selection,
          select:id=>(selection=id?{active:true,id}:{active:false,id:null})
        };
      }else if(path.endsWith('/runtime-v266.js')){
        sandbox.CivweaveLocalModelRuntimeV266={
          version:'1.0.115-local-ai-runtime-v302-session-handoff',
          generate:async()=>({outputText:'ok'}),
          freshWorkerFallback:true,
          phaseAwareErrors:true,
          promptBudgetEnforced:true,
          terminalCancellation:true,
          settingsTeardown:true,
          adaptiveResidency:true,
          adaptiveWasmThreads:true,
          intentPrewarm:true,
          compatibilityPromptCap:true
        };
      }else if(path.endsWith('/bootstrap-v266.js')){
        sandbox.CivweaveLocalAIBootstrapV266={
          revision:'1.0.115-local-ai-bootstrap-v302-session-handoff',
          ready:Promise.resolve(false),
          readyState:'failed',
          lastComponent:'CivweaveLocalAISettingsV266',
          lastError:'auxiliary settings failed'
        };
      }
      queueMicrotask(()=>node.onload?.());
    }},
    createElement(){return{dataset:{},remove(){}}},
  },
  queueMicrotask,
  globalThis:null
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(localRuntime,sandbox,{filename:'local-chat-runtime-v295.js'});
const api=sandbox.CivweaveLocalChatRuntimeV295;
assert.equal(api.inferenceCoreFirst,true);
assert.equal(api.fullBootstrapBlocking,false);
assert.equal(await api.ready(),true,'direct inference core must become ready without waiting for full bootstrap');
assert.equal(api.runtimeReady(),true);
assert.deepEqual(Array.from(api.inferenceCoreComponents),[
  'CivweaveLocalModelRegistryV266',
  'CivweaveLocalModelDownloadV266',
  'CivweaveLocalModelRuntimeV266'
]);
await Promise.resolve();
await Promise.resolve();
assert.ok(scripts.some(node=>new URL(node.src,'https://staging.example.test').pathname.endsWith('/bootstrap-v266.js')),'full bootstrap still starts as auxiliary work after inference core is ready');

console.log(JSON.stringify({
  ok:true,
  revision:'local-chat-inference-core-first-v325',
  fixes:{
    directRegistryLoad:true,
    directDownloadManagerLoad:true,
    directInferenceRuntimeLoad:true,
    fullBootstrapNonBlocking:true,
    auxiliaryFailureNonFatal:true,
    staleRuntimeABICompatible:true
  }
},null,2));
