import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('public/extensions/civweave-weaveling-plan-json-v190.js','utf8');
const values=new Map();
const localStorage={
  getItem:key=>values.has(key)?values.get(key):null,
  setItem:(key,value)=>values.set(key,String(value)),
  removeItem:key=>values.delete(key)
};
let capturedRequest=null;
let forcedFastModel='';
const questJson={
  title:'Time Traveler vs Time Looper',
  wish:'Make an action RPG where a time traveler and a time looper clash.',
  outcome:'A playable action RPG prototype built around asymmetric time rules.',
  assumptions:['The player controls the time traveler.'],
  paths:[{
    type:'skilled-labor',realm:'cerbanimo',title:'Prototype the temporal combat loop',purpose:'Build the core action RPG encounter around the traveler changing a timeline the looper experiences linearly.',
    steps:['Define the two time rule sets','Prototype one encounter','Add persistent timeline changes'],
    completionCriteria:'One encounter demonstrates both time systems in play.',
    evidence:['Playable encounter build']
  }],
  governance:{included:false,title:'',purpose:'',agreements:[],reviewQuestion:''},
  confidence:.9
};
const baseGenerate=async request=>{capturedRequest=request;return{status:'success',outputJson:questJson,structured:{valid:true},actual:{provider:request?.config?.provider||'downloaded-local',model:request?.config?.model||'gemma4-e2b-it-litert-web'}}};
const baseRespond=async()=>({response:{answer:'Tell me a little more about the game you have in mind.'},provider:'downloaded-local',model:'gemma4-e2b-it-litert-web'});
const sandbox={
  console,JSON,Date,Math,Promise,Map,Set,Object,Array,String,Number,Boolean,RegExp,Error,DOMException,
  localStorage,
  addEventListener(){},
  queueMicrotask(fn){fn()},
  globalThis:null,
  CivweaveAssistantV141:{
    selectedConfig:()=>({provider:'downloaded-local',route:'downloaded-local',model:'gemma4-e2b-it-litert-web'}),
    context:async()=>({currentContext:{systemId:'civweave'},routingAnswer:{room:'civweave.quad'}}),
    respond:baseRespond
  },
  CivweaveModelRuntime:{
    readSharedConfig:()=>({provider:'downloaded-local',route:'downloaded-local',model:'gemma4-e2b-it-litert-web'}),
    generate:baseGenerate
  },
  CivweaveLocalModelDownloadV266:{
    selection:()=>({active:true,id:'gemma4-e2b-it-litert-web'}),
    status:async id=>({available:id==='gemma4-e4b-it-litert-web'})
  },
  CivweaveLocalChatRuntimeV295:{generate:async()=>({status:'success',outputText:'{}',executionId:'gemma4-e2b-it-litert-web'})},
  CivweaveLiteRTGemma4FastRuntimeV1:{
    runFast:async(args,modelId)=>{forcedFastModel=modelId;return{status:'success',outputText:'{"ok":true}',executionId:modelId}}
  },
  CivweaveIntentionPlanner:{
    shouldCreate:()=>false,
    activeIntentionTurns:(history,text)=>[...history.map(row=>row.text||row.content),text],
    persist:plan=>({id:'weave-test',state:'review',plan})
  },
  CivweaveWeavelingPlanMaterializationV265:{materialize(){}}
};
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'civweave-weaveling-plan-json-v190.js'});
const api=sandbox.CivweaveWeavelingPlanJsonV190;
assert(api,'Weaveling orchestrator did not install.');
assert.equal(api.taskDeepModel,'gemma4-e4b-it-litert-web','Actual Quest generation must prefer E4B.');
assert.equal(api.localLearningPlanBridge,true,'Local Learning Journey bridge contract is missing.');
assert.equal(api.qualificationHandoff,true,'Qualification-to-Quest handoff contract is missing.');

const first='Could you help me make a game about time travel?';
const firstResult=await sandbox.CivweaveAssistantV141.respond({text:first,systemId:'civweave',history:[]});
assert.match(firstResult.response.answer,/more/i,'Short project request should remain conversational for one qualification turn.');
assert.equal(api.readPendingProject()?.text,first,'Initial project request was not retained for the task-generation handoff.');

const second='Action RPG where a time traveler and a time looper clash. Time is linear for the looper but things keep changing because of the traveler.';
const history=[{role:'user',text:first},{role:'assistant',text:firstResult.response.answer}];
const secondResult=await sandbox.CivweaveAssistantV141.respond({text:second,systemId:'civweave',history});
assert.equal(secondResult.plan?.title,questJson.title,'Qualifying answer did not populate a Quest.');
assert.equal(capturedRequest?.purpose,'civweave-weaveling-intention-json-v190','Qualifying answer did not enter structured Quest generation.');
assert.equal(capturedRequest?.config?.model,'gemma4-e4b-it-litert-web','Structured Quest generation did not route to E4B.');
assert.equal(api.readPendingProject(),null,'Pending project state was not cleared after successful Quest generation.');

capturedRequest=null;
await sandbox.CivweaveModelRuntime.generate({purpose:'living-school-learning-plan-review-v2',config:{provider:'downloaded-local',route:'downloaded-local',model:'gemma4-e2b-it-litert-web'},messages:[]});
assert.equal(typeof capturedRequest?.transport,'function','Downloaded-local Learning Journey plan was not given a direct local structured transport.');
assert.equal(capturedRequest?.__civweaveSkipResponseRouter,true,'Local Learning Journey plan was left exposed to the shared response router.');
assert.equal(capturedRequest?.__civweaveLocalStructuredLearningPlan,true,'Local Learning Journey bridge marker is missing.');

const transport=api.localStructuredTransport('quest');
await transport({config:{model:'gemma4-e4b-it-litert-web',maxTokens:1800},messages:[{role:'system',content:'Return JSON.'},{role:'user',content:'Build the Quest.'}]});
assert.equal(forcedFastModel,'gemma4-e4b-it-litert-web','Local structured transport did not force the requested E4B LiteRT model.');

for(const required of ['civweave:assistant-runtime-ready','civweave:local-model-runtime-ready','civweave:gemma4-litert-fast-runtime-ready'])assert.ok(source.includes(required),`Lifecycle reassertion is missing ${required}.`);
console.log('Weaveling qualification handoff, E4B task generation, and local Moss planning bridge verified.');