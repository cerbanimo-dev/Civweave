import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile('public/app/local-ai/gemma4-litert-request-authority-v1.js','utf8');
assert.match(source,/1\.1\.3-gemma4-litert-request-authority-v1-family-loader-weave-rebind/);
assert.match(source,/1\.0\.1-guide-generation-tracker-v1-live-pipeline-streams/);
assert.match(source,/litert-web-dual-tool-shape-json-fallback/);
assert.match(source,/You MUST respond by calling the \$\{tool\.name\} tool exactly once/);
assert.match(source,/LITERT_FORMATTED_OUTPUT_MISSING/);
assert.match(source,/structuredTool:null/);
assert.match(source,/sameModelJsonFallback:true/);
assert.match(source,/e4bLearningPlanMetadata:true/);
assert.match(source,/weaveDraftPipeline:true/);
assert.match(source,/liveGenerationTracker:true/);
assert.match(source,/globalFinalResponseStreaming:true/);
assert.match(source,/familyLoaderWeaveRebind:true/);
assert.match(source,/LOCAL_GEMMA4_WEAVE_POST_LOADER_REBIND_FAILED/);

const storage=new Map();
const sandbox={
  console,Date,Promise,Error,Object,Boolean,Number,String,Math,JSON,Map,Set,RegExp,
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent:()=>true,
  addEventListener:()=>{},
  setTimeout:()=>0,
  clearTimeout:()=>{},
  queueMicrotask:()=>{},
  document:{scripts:[]},
  location:{href:'https://civweave-staging.pages.dev/'},
};
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'gemma4-litert-request-authority-v1.js'});
const authority=sandbox.CivweaveGemma4LiteRTRequestAuthorityV1;
assert.ok(authority);
assert.equal(authority.weaveDraftPipeline,true);
assert.equal(authority.liveGenerationTracker,true);
assert.equal(authority.globalFinalResponseStreaming,true);
assert.equal(authority.familyLoaderWeaveRebind,true);
assert.equal(authority.trackerVersion,'1.0.1-guide-generation-tracker-v1-live-pipeline-streams');

// E2B intake still uses LiteRT's structured-tool adapter. E4B Learning/Quest generation
// is covered separately by the Weave Draft regression and must not use this adapter.
const rawTool={name:'route_civweave_request',description:'Route the intake',parameters:{type:'object',required:['route'],properties:{route:{type:'string'}}}};
const normalized=authority.normalizedStructuredTool(rawTool);
assert.equal(normalized.type,'function');
assert.equal(normalized.name,'route_civweave_request');
assert.equal(normalized.function.name,'route_civweave_request');
assert.equal(normalized.parameters,normalized.function.parameters);

let calls=[];
sandbox.CivweaveLiteRTGemma4FastRuntimeV1={
  version:'1.4.0-litert-gemma4-fast-runtime-v1-formatted-output',
  runFast:async(args,forcedModelId)=>{calls.push({args,forcedModelId});return{status:'success',outputText:'{"route":"learning"}',diagnostics:[]}}
};
assert.equal(authority.installFastStructuredToolAdapter(),true);
await sandbox.CivweaveLiteRTGemma4FastRuntimeV1.runFast({systemPrompt:'Classify the request.',messages:[{role:'user',content:'teach me tarot'}],structuredTool:rawTool},'gemma4-e2b-it-litert-web');
assert.equal(calls.length,1);
assert.equal(calls[0].forcedModelId,'gemma4-e2b-it-litert-web');
assert.equal(calls[0].args.structuredTool.name,'route_civweave_request');
assert.equal(calls[0].args.structuredTool.function.name,'route_civweave_request');
assert.match(calls[0].args.systemPrompt,/MUST respond by calling the route_civweave_request tool exactly once/);

calls=[];
let first=true;
sandbox.CivweaveLiteRTGemma4FastRuntimeV1={
  version:'1.4.0-litert-gemma4-fast-runtime-v1-formatted-output',
  runFast:async(args,forcedModelId)=>{
    calls.push({args,forcedModelId});
    if(first){first=false;throw Object.assign(new Error('tool call not surfaced'),{code:'LITERT_FORMATTED_OUTPUT_MISSING'})}
    return{status:'success',outputText:'{"route":"learning"}',diagnostics:[]};
  }
};
assert.equal(authority.installFastStructuredToolAdapter(),true);
const fallback=await sandbox.CivweaveLiteRTGemma4FastRuntimeV1.runFast({systemPrompt:'Classify the request.',messages:[{role:'user',content:'teach me tarot'}],structuredTool:rawTool},'gemma4-e2b-it-litert-web');
assert.equal(calls.length,2);
assert.equal(calls[0].forcedModelId,'gemma4-e2b-it-litert-web');
assert.equal(calls[1].forcedModelId,'gemma4-e2b-it-litert-web');
assert.equal(calls[1].args.structuredTool,null);
assert.equal(fallback.structuredToolFallback,true);
assert.equal(fallback.formattedOutput.fallback,'same-model-json-text');

sandbox.CivweaveUnifiedChatSystemV1={
  generateLivingSchoolPlan:async()=>({provider:'downloaded-local',model:'gemma4-e2b-it-litert-web',response:{answer:'failed'}})
};
assert.equal(authority.installLearningPlanMetadataAdapter(),true);
const metadata=await sandbox.CivweaveUnifiedChatSystemV1.generateLivingSchoolPlan({__civweaveE2BIntakeCompleted:true});
assert.equal(metadata.provider,'downloaded-local');
assert.equal(metadata.model,'gemma4-e4b-it-litert-web');
assert.equal(metadata.e2bIntakeModel,'gemma4-e2b-it-litert-web');

// Regression: unified-chat awaits FamilyAILoader.ensure() immediately before it
// captures CivweaveModelRuntime. The loader may replace the runtime object, so the
// E4B Weave wrapper must be rebound before ensure() resolves back to Moss.
storage.set('civweave.local-ai.selection.v266',JSON.stringify({active:true,id:'gemma4-e2b-it-litert-web'}));
const WEAVE_VERSION='1.0.0-gemma4-weave-draft-pipeline-v1-plan-compile-repair';
let runtimeOwner='initial';
let trackerInstalls=0;
let weaveInstalls=0;
sandbox.CivweaveGuideGenerationTrackerV1={
  version:'1.0.1-guide-generation-tracker-v1-live-pipeline-streams',
  install:()=>{trackerInstalls+=1;return true}
};
sandbox.CivweaveModelRuntime={generate:async()=>({status:'initial-runtime'})};
sandbox.CivweaveGemma4WeaveDraftPipelineV1={
  version:WEAVE_VERSION,
  installRuntime(){
    weaveInstalls+=1;
    runtimeOwner='weave';
    const prior=sandbox.CivweaveModelRuntime.generate;
    if(prior?.__civweaveWeaveDraftPipelineV1===WEAVE_VERSION)return true;
    const generate=async request=>prior(request);
    generate.__civweaveWeaveDraftPipelineV1=WEAVE_VERSION;
    generate.__prior=prior;
    sandbox.CivweaveModelRuntime.generate=generate;
    return true;
  },
  install(){return this.installRuntime()}
};
sandbox.CivweaveFamilyAILoaderV105={
  ensure:async()=>{
    runtimeOwner='family-replaced';
    sandbox.CivweaveModelRuntime={generate:async()=>({status:'strict-json-runtime'})};
    return true;
  }
};
assert.equal(authority.installFamilyLoaderWeaveRebind(),true,'family loader rebind wrapper did not attach');
await sandbox.CivweaveFamilyAILoaderV105.ensure();
assert.equal(runtimeOwner,'weave','FamilyAILoader.ensure returned while the replacement strict-JSON runtime still owned generation');
assert.equal(sandbox.CivweaveModelRuntime.generate.__civweaveWeaveDraftPipelineV1,WEAVE_VERSION,'Weave runtime marker was not restored after family loader replacement');
assert.ok(weaveInstalls>=1,'Weave runtime was not reinstalled after the family loader completed');
assert.ok(trackerInstalls>=1,'generation tracker was not kept active during the family-loader rebind');

console.log('PASS: E2B intake keeps the LiteRT dual tool declaration and same-model fallback; E4B metadata is correct; FamilyAILoader cannot return a replacement strict-JSON runtime without the Weave Draft wrapper being rebound.');