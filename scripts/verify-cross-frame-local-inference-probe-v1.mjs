import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const tracker=await readFile(new URL('../public/app/guide-generation-tracker-v1.js',import.meta.url),'utf8');
const legacy=await readFile(new URL('../public/app/generation-lifecycle-v1.js',import.meta.url),'utf8');
const origin='https://civweave-staging.pages.dev';
const createDoc=()=>({getElementById:()=>null,createElement:()=>({}),head:{append:()=>{}},addEventListener:()=>{},querySelectorAll:()=>[]});
let chosenModel='',parentCalls=0;
const runtime={
  state:()=>({engineReady:true,generationActive:false}),
  runFast:async(args,model)=>{
    chosenModel=model;
    args.onProgress({phase:'awaiting-first-token'});
    args.onToken({text:'READY'});
    return{outputText:'READY',model:{id:model}};
  }
};
const parentBus={
  version:'1.3.1',probeLocalModel:async()=>{parentCalls++;return{ok:true,code:'OK'}},
  history:()=>[],install:()=>true,artifactName:()=> 'Learning Plan',inferArtifacts:()=>({learningPlan:true})
};
const parent={location:{origin},document:createDoc(),CivweaveGenerationLifecycleV2:parentBus,
  CivweaveLocalGenerationModelPolicyV1:{resolve:()=> 'gemma4-e4b-it-litert-web'}};
const child={
  console,Date,Math,JSON,String,Number,RegExp,Object,Array,Map,Set,Boolean,Promise,
  location:{origin},parent,document:createDoc(),setTimeout,clearTimeout,
  addEventListener:()=>{},queueMicrotask:()=>{},
  CivweaveGenerationLifecycleV1:{version:'legacy'},
  CivweaveLocalGenerationModelPolicyV1:{resolve:()=> 'gemma4-e4b-it-litert-web'},
  CivweaveLiteRTGemma4FastRuntimeV1:runtime
};
child.globalThis=child;
const hooked=tracker.replace('globalThis.CivweaveGuideGenerationTrackerV1=Object.freeze(', 'globalThis.__probeUnit={bus,directLocalProbe};globalThis.CivweaveGuideGenerationTrackerV1=Object.freeze(');
assert.notEqual(hooked,tracker);
vm.runInNewContext(hooked,child,{filename:'guide-generation-tracker-v1.js'});
const hooks=child.__probeUnit;
assert.strictEqual(hooks.bus(),parentBus,'The campus iframe must use its parent shell GPU probe');
delete parent.CivweaveGenerationLifecycleV2;
assert.equal(typeof hooks.bus()?.probeLocalModel,'undefined','Fallback scenario must actually lack v2');
const result=await hooks.directLocalProbe({timeoutMs:1000});
assert.equal(result.ok,true,'The one-word fallback must work without lifecycle v2');
assert.equal(result.output,'READY');
assert.equal(chosenModel,'gemma4-e4b-it-litert-web','Never probe the selected fast chat model in place of the deep model');
child.CivweaveLiteRTGemma4FastRuntimeV1={state:()=>({generationActive:true}),runFast:runtime.runFast};
const busy=await hooks.directLocalProbe({timeoutMs:1000});
assert.equal(busy.code,'LOCAL_PROBE_ENGINE_BUSY','A stuck GPU must not be given overlapping generation requests');

let v2Installs=0;
const sameWindow={CivweaveGenerationLifecycleV2:{probeLocalModel:()=>{},install:()=>{v2Installs++}}};
sameWindow.CivweaveGenerationLifecycleV1=sameWindow.CivweaveGenerationLifecycleV2;
sameWindow.globalThis=sameWindow;
vm.runInNewContext(legacy,sameWindow,{filename:'generation-lifecycle-v1.js'});
assert.equal(v2Installs,1,'Legacy lifecycle must retain the newer v2 and its probe');
assert.strictEqual(sameWindow.CivweaveGenerationLifecycleV1,sameWindow.CivweaveGenerationLifecycleV2);
console.log(JSON.stringify({ok:true,crossFrameParentV2:true,standaloneProbe:true,selectedModel:chosenModel,busyProtection:true,legacyOverridePrevented:true},null,2));
