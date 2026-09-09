import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile('public/app/local-ai/gemma4-litert-request-authority-v1.js','utf8');
assert.match(source,/1\.0\.2-gemma4-litert-request-authority-v1-structured-tool-shape/);
assert.match(source,/litert-web-dual-tool-shape-json-fallback/);
assert.match(source,/You MUST respond by calling the \$\{tool\.name\} tool exactly once/);
assert.match(source,/LITERT_FORMATTED_OUTPUT_MISSING/);
assert.match(source,/structuredTool:null/);
assert.match(source,/sameModelJsonFallback:true/);
assert.match(source,/e4bLearningPlanMetadata:true/);

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

const rawTool={name:'emit_learning_journey_plan',description:'Emit the plan',parameters:{type:'object',required:['title'],properties:{title:{type:'string'}}}};
const normalized=authority.normalizedStructuredTool(rawTool);
assert.equal(normalized.type,'function');
assert.equal(normalized.name,'emit_learning_journey_plan');
assert.equal(normalized.function.name,'emit_learning_journey_plan');
assert.equal(normalized.parameters,normalized.function.parameters);

let calls=[];
sandbox.CivweaveLiteRTGemma4FastRuntimeV1={
  version:'1.4.0-litert-gemma4-fast-runtime-v1-formatted-output',
  runFast:async(args,forcedModelId)=>{calls.push({args,forcedModelId});return{status:'success',outputText:'{"title":"Tarot Memory"}',diagnostics:[]}}
};
assert.equal(authority.installFastStructuredToolAdapter(),true);
await sandbox.CivweaveLiteRTGemma4FastRuntimeV1.runFast({systemPrompt:'Return a plan.',messages:[{role:'user',content:'tarot'}],structuredTool:rawTool},'gemma4-e4b-it-litert-web');
assert.equal(calls.length,1);
assert.equal(calls[0].forcedModelId,'gemma4-e4b-it-litert-web');
assert.equal(calls[0].args.structuredTool.name,'emit_learning_journey_plan');
assert.equal(calls[0].args.structuredTool.function.name,'emit_learning_journey_plan');
assert.match(calls[0].args.systemPrompt,/MUST respond by calling the emit_learning_journey_plan tool exactly once/);

calls=[];
let first=true;
sandbox.CivweaveLiteRTGemma4FastRuntimeV1={
  version:'1.4.0-litert-gemma4-fast-runtime-v1-formatted-output',
  runFast:async(args,forcedModelId)=>{
    calls.push({args,forcedModelId});
    if(first){first=false;throw Object.assign(new Error('tool call not surfaced'),{code:'LITERT_FORMATTED_OUTPUT_MISSING'})}
    return{status:'success',outputText:'{"title":"Tarot Memory"}',diagnostics:[]};
  }
};
assert.equal(authority.installFastStructuredToolAdapter(),true);
const fallback=await sandbox.CivweaveLiteRTGemma4FastRuntimeV1.runFast({systemPrompt:'Return a plan.',messages:[{role:'user',content:'tarot'}],structuredTool:rawTool},'gemma4-e4b-it-litert-web');
assert.equal(calls.length,2);
assert.equal(calls[0].forcedModelId,'gemma4-e4b-it-litert-web');
assert.equal(calls[1].forcedModelId,'gemma4-e4b-it-litert-web');
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

console.log('PASS: LiteRT structured tools keep the Web dual declaration, force tool use, fall back on the same model, and report E4B for Learning Journey generation.');
