import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('public/app/local-ai/gemma4-structured-task-authority-v1.js','utf8');
const shell=fs.readFileSync('public/app/persistent-system-shell-v1.html','utf8');
const campus=fs.readFileSync('public/app/working-campus-v440.html','utf8');

let e4bAvailable=true;
let captured=null;
let chatCalls=0;
let questCalls=0;
const baseGenerate=async request=>{captured=request;return{status:'success',actual:{provider:request.config?.provider,model:request.config?.model},outputJson:{ok:true}}};
const baseRespond=async()=>{chatCalls++;return{response:{answer:'ordinary E2B conversation'},provider:'downloaded-local',model:'gemma4-e2b-it-litert-web'}};
const sandbox={
  console,Date,Math,JSON,Promise,Map,Set,Object,Array,String,Number,Boolean,RegExp,Error,
  globalThis:null,
  setTimeout:()=>0,
  clearTimeout(){},
  queueMicrotask:fn=>fn(),
  addEventListener(){},
  dispatchEvent(){},
  CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  CivweaveLocalModelDownloadV266:{status:async id=>({id,available:e4bAvailable})},
  CivweaveModelRuntime:{generate:baseGenerate},
  CivweaveAssistantV141:{respond:baseRespond,selectedConfig:()=>({provider:'downloaded-local',route:'downloaded-local',model:'gemma4-e2b-it-litert-web'})},
  CivweaveWeavelingPlanJsonV190:{
    localStructuredTransport:kind=>async()=>({text:'{}',provider:'downloaded-local',model:'gemma4-e4b-it-litert-web',kind}),
    createModelPlan:async(args)=>{
      questCalls++;
      const result=await sandbox.CivweaveModelRuntime.generate({purpose:'civweave-weaveling-intention-json-v190',config:{provider:'downloaded-local',route:'downloaded-local',model:'gemma4-e2b-it-litert-web',timeoutMs:90000,maxTokens:1200},messages:[]});
      return{plan:{title:'My First Rock Album',wish:args.text},provider:result.actual.provider,model:result.actual.model};
    }
  }
};
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'gemma4-structured-task-authority-v1.js'});
const authority=sandbox.CivweaveGemma4StructuredTaskAuthorityV1;
assert(authority,'Structured task authority did not install.');
assert.equal(authority.deepModel,'gemma4-e4b-it-litert-web');
assert.equal(authority.taskTimeoutMs,600000);
assert.equal(authority.fallbackToE2B,false);

captured=null;
await sandbox.CivweaveModelRuntime.generate({purpose:'living-school-learning-plan-review-v2',config:{provider:'downloaded-local',route:'downloaded-local',model:'gemma4-e2b-it-litert-web',timeoutMs:90000,maxTokens:1200},messages:[]});
assert.equal(captured?.config?.model,'gemma4-e4b-it-litert-web','Moss high-level Learning Journey did not force E4B.');
assert.equal(captured?.config?.timeoutMs,600000,'Moss high-level Learning Journey retained the ordinary timeout.');
assert.equal(typeof captured?.transport,'function','Moss high-level Learning Journey did not receive direct local structured transport.');
assert.equal(captured?.__civweaveLocalStructuredLearningPlan,true,'Moss Learning Journey authority marker is missing.');

captured=null;
const rock=await sandbox.CivweaveAssistantV141.respond({systemId:'civweave',text:'How about a plan to create my first rock album',history:[]});
assert.equal(questCalls,1,'Explicit rock-album plan did not enter structured Quest generation.');
assert.equal(chatCalls,0,'Explicit rock-album plan leaked into ordinary E2B chat.');
assert.equal(rock.model,'gemma4-e4b-it-litert-web','Explicit rock-album Quest did not use E4B.');
assert.equal(captured?.config?.model,'gemma4-e4b-it-litert-web','Quest runtime boundary did not force E4B.');
assert.equal(captured?.config?.timeoutMs,600000,'Quest runtime boundary retained the ordinary timeout.');

const generic=await sandbox.CivweaveAssistantV141.respond({systemId:'civweave',text:'Could you help me make a game about time travel?',history:[]});
assert.equal(chatCalls,1,'A generic task request should remain available to E2B for qualification.');
assert.match(generic.response.answer,/ordinary E2B/i);

let blocked=null;e4bAvailable=false;
try{await sandbox.CivweaveModelRuntime.generate({purpose:'living-school-learning-plan-review-v2',config:{provider:'downloaded-local',route:'downloaded-local',model:'gemma4-e2b-it-litert-web'},messages:[]})}catch(error){blocked=error}
assert.equal(blocked?.code,'CIVWEAVE_E4B_STRUCTURED_TASK_REQUIRED','Missing E4B silently fell back instead of failing closed.');

for(const html of [shell,campus])assert.ok(html.includes('/app/local-ai/gemma4-structured-task-authority-v1.js?v=1.0.0-e4b-only'),'A canonical campus entry does not load the E4B structured task authority.');
assert.ok(source.includes("QUEST_PURPOSE='civweave-weaveling-intention-json-v190'"));
assert.ok(source.includes("LEARNING_PURPOSE='living-school-learning-plan-review-v2'"));
assert.ok(source.includes("policy:'E2B may converse or qualify; local structured Quest and Learning Journey generation requires E4B.'"));
console.log('PASS: E2B qualifies; rock-album Quest and Moss Learning Journey force E4B with 10-minute structured-task timeout and no E2B fallback.');