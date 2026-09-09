import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const authoritySource=await readFile(new URL('public/app/local-ai/gemma4-structured-task-authority-v1.js',root),'utf8');
const bypassSource=await readFile(new URL('public/app/local-guide-control-bypass-v1.js',root),'utf8');

assert.match(authoritySource,/INTAKE_MODEL='gemma4-e2b-it-litert-web'/);
assert.match(authoritySource,/DEEP_MODEL='gemma4-e4b-it-litert-web'/);
assert.match(authoritySource,/intakeFirst:true/);
assert.match(authoritySource,/classificationByObject:true/);
assert.match(authoritySource,/Help me build a learning plan for X/);
assert.match(authoritySource,/Help me build my first rock album/);
assert.match(authoritySource,/LEARNING_MAX_TOKENS=900/);
assert.match(bypassSource,/e2bIntakeDefer:true/);
assert.match(bypassSource,/CivweaveGemma4StructuredTaskAuthorityV1\?\.intakeFirst===true/);

const storage=new Map();
const localStorage={
  getItem:key=>storage.has(key)?storage.get(key):null,
  setItem:(key,value)=>storage.set(key,String(value)),
  removeItem:key=>storage.delete(key)
};
let e4Available=true;
let intakeCalls=0;
let learningCalls=0;
let questCalls=0;
let ordinaryBaseCalls=0;
let lastLearning=null;
let lastQuest=null;
let finalRuntimeRequest=null;

function intakeResult(context){
  const text=String(context.currentMessage||'');
  if(/build a learning plan for x/i.test(text))return{route:'learning',ready:true,continuation:false,objective:'understand and demonstrate x',facts:['The Hero explicitly asked for a learning plan for x.'],missingContext:[],reply:'I have enough to hand this to Moss.'};
  if(/build my first rock album/i.test(text))return{route:'quest',ready:false,continuation:false,objective:'build and finish my first rock album',facts:['This will be the Hero’s first rock album.'],missingContext:['Whether the Hero is recording solo or with a band.'],reply:'Are you recording this solo or with a band?'};
  if(/recording it solo/i.test(text))return{route:'quest',ready:true,continuation:true,objective:'build and finish my first rock album',facts:['This will be the Hero’s first rock album.','The Hero is recording it solo.'],missingContext:[],reply:'That is enough context to build the Quest.'};
  if(/learn and memorize the tarot/i.test(text))return{route:'learning',ready:true,continuation:false,objective:'memorize and reliably recall tarot card meanings',facts:['The Hero wants a system for learning and memorizing tarot.'],missingContext:[],reply:'I have enough to hand this to Moss.'};
  return{route:'ordinary',ready:true,continuation:false,objective:'',facts:[],missingContext:[],reply:'Direct E2B answer.'};
}

const sandbox={
  console,Date,Promise,Error,Object,Boolean,Number,String,Math,JSON,Map,Set,RegExp,
  localStorage,
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent:()=>true,
  addEventListener:()=>{},
  setTimeout:()=>0,
  queueMicrotask:fn=>fn(),
  CivweaveLocalModelDownloadV266:{
    selection:()=>({active:true,id:'gemma4-e2b-it-litert-web'}),
    status:async id=>({available:id==='gemma4-e2b-it-litert-web'||(id==='gemma4-e4b-it-litert-web'&&e4Available)})
  },
  CivweaveLiteRTGemma4FastRuntimeV1:{
    runFast:async args=>{
      intakeCalls+=1;
      assert.equal(args.structuredTool?.name,'route_civweave_request');
      const content=String(args.messages?.at(-1)?.content||'');
      const json=content.slice(content.indexOf('{'));
      return{status:'success',outputText:JSON.stringify(intakeResult(JSON.parse(json))),executionId:'gemma4-e2b-it-litert-web'};
    }
  },
  CivweaveModelRuntime:{
    generate:async request=>{finalRuntimeRequest=request;return{status:'success',outputJson:{ok:true},actual:{provider:request.config?.provider,model:request.config?.model}}}
  },
  CivweaveAssistantV141:{
    respond:async()=>{ordinaryBaseCalls+=1;return{provider:'base'};}
  },
  CivweaveUnifiedChatSystemV1:{
    generateLivingSchoolPlan:async args=>{learningCalls+=1;lastLearning=args;return{provider:'learning-generated',model:'gemma4-e4b-it-litert-web',response:{answer:'learning'}}}
  },
  CivweaveWeavelingPlanJsonV190:{
    createModelPlan:async args=>{questCalls+=1;lastQuest=args;return{provider:'quest-generated',model:'gemma4-e4b-it-litert-web',response:{answer:'quest'}}},
    localStructuredTransport:kind=>async()=>({text:'{}',kind})
  }
};
sandbox.globalThis=sandbox;
vm.runInNewContext(authoritySource,sandbox,{filename:'gemma4-structured-task-authority-v1.js'});
const api=sandbox.CivweaveGemma4StructuredTaskAuthorityV1;
assert.ok(api?.intakeFirst);
assert.equal(api.intakeModel,'gemma4-e2b-it-litert-web');
assert.equal(api.deepModel,'gemma4-e4b-it-litert-web');

api.clearIntake();
let result=await sandbox.CivweaveAssistantV141.respond({systemId:'civweave',text:'Can you help me build a learning plan for x?',history:[]});
assert.equal(result.provider,'learning-generated');
assert.equal(learningCalls,1);
assert.equal(questCalls,0);
assert.match(lastLearning.text,/^I want to learn to understand and demonstrate x\./);
assert.equal(intakeCalls,1);

api.clearIntake();
result=await sandbox.CivweaveAssistantV141.respond({systemId:'civweave',text:'Can you help me build my first rock album?',history:[]});
assert.equal(result.model,'gemma4-e2b-it-litert-web');
assert.match(result.response.answer,/solo or with a band/i);
assert.equal(questCalls,0);
assert.equal(intakeCalls,2);
assert.equal(api.pendingIntake()?.route,'quest');

result=await sandbox.CivweaveAssistantV141.respond({systemId:'civweave',text:'I am recording it solo.',history:[{role:'user',text:'Can you help me build my first rock album?'}]});
assert.equal(result.provider,'quest-generated');
assert.equal(questCalls,1);
assert.match(lastQuest.text,/build and finish my first rock album/i);
assert.match(lastQuest.text,/recording it solo/i);
assert.equal(intakeCalls,3);

api.clearIntake();
result=await sandbox.CivweaveAssistantV141.respond({systemId:'civweave',text:'Can you teach me how to learn and memorize the tarot?',history:[]});
assert.equal(result.provider,'learning-generated');
assert.equal(learningCalls,2);
assert.match(lastLearning.text,/memorize and reliably recall tarot card meanings/i);
assert.equal(intakeCalls,4);

api.clearIntake();
result=await sandbox.CivweaveAssistantV141.respond({systemId:'civweave',text:'What is a major arcana card?',history:[]});
assert.equal(result.model,'gemma4-e2b-it-litert-web');
assert.equal(result.response.answer,'Direct E2B answer.');
assert.equal(intakeCalls,5);
assert.equal(ordinaryBaseCalls,0,'substantive Gemma 4 Weaveling requests should be owned by E2B intake first');

await sandbox.CivweaveModelRuntime.generate({purpose:'living-school-learning-plan-review-v2',config:{provider:'downloaded-local',model:'gemma4-e2b-it-litert-web',maxTokens:1800}});
assert.equal(finalRuntimeRequest.config.model,'gemma4-e4b-it-litert-web');
assert.equal(finalRuntimeRequest.config.maxTokens,900);
assert.equal(finalRuntimeRequest.config.timeoutMs,600000);

await sandbox.CivweaveModelRuntime.generate({purpose:'civweave-weaveling-intention-json-v190',config:{provider:'downloaded-local',model:'gemma4-e2b-it-litert-web',maxTokens:1200}});
assert.equal(finalRuntimeRequest.config.model,'gemma4-e4b-it-litert-web');
assert.ok(finalRuntimeRequest.config.maxTokens>=1800);

e4Available=false;
await assert.rejects(
  sandbox.CivweaveModelRuntime.generate({purpose:'living-school-learning-plan-review-v2',config:{provider:'downloaded-local',model:'gemma4-e2b-it-litert-web'}}),
  error=>error?.code==='CIVWEAVE_E4B_STRUCTURED_TASK_REQUIRED'
);

console.log('E2B intake -> E4B generation regression passed.');