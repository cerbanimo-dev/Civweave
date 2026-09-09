import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('public/extensions/civweave-weaveling-plan-json-v190.js','utf8');
const controlSource=fs.readFileSync('public/app/local-guide-control-bypass-v1.js','utf8');
const values=new Map();
const localStorage={getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
let capturedRequest=null,forcedFastModel='',mossRuns=0,mossOptions=null;
const questJson={title:'Time Traveler vs Time Looper',wish:'Make an action RPG where a time traveler and a time looper clash.',outcome:'A playable action RPG prototype built around asymmetric time rules.',assumptions:['The player controls the time traveler.'],paths:[{type:'skilled-labor',realm:'cerbanimo',title:'Prototype the temporal combat loop',purpose:'Build the core action RPG encounter around the traveler changing a timeline the looper experiences linearly.',steps:['Define the two time rule sets','Prototype one encounter','Add persistent timeline changes'],completionCriteria:'One encounter demonstrates both time systems in play.',evidence:['Playable encounter build']}],governance:{included:false,title:'',purpose:'',agreements:[],reviewQuestion:''},confidence:.9};
const baseGenerate=async request=>{capturedRequest=request;return{status:'success',outputJson:questJson,structured:{valid:true},actual:{provider:request?.config?.provider||'downloaded-local',model:request?.config?.model||'gemma4-e2b-it-litert-web'}}};
let baseChatCalls=0;
const baseRespond=async()=>{baseChatCalls++;return{response:{answer:'Tell me a little more about the game you have in mind.'},provider:'downloaded-local',model:'gemma4-e2b-it-litert-web'}};
const sandbox={
  console,JSON,Date,Math,Promise,Map,Set,Object,Array,String,Number,Boolean,RegExp,Error,DOMException,
  localStorage,addEventListener(){},queueMicrotask(fn){fn()},globalThis:null,
  CivweaveAssistantV141:{selectedConfig:()=>({provider:'downloaded-local',route:'downloaded-local',model:'gemma4-e2b-it-litert-web'}),context:async()=>({currentContext:{systemId:'civweave'},routingAnswer:{room:'civweave.quad'}}),respond:baseRespond},
  CivweaveModelRuntime:{readSharedConfig:()=>({provider:'downloaded-local',route:'downloaded-local',model:'gemma4-e2b-it-litert-web'}),generate:baseGenerate},
  CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:'gemma4-e2b-it-litert-web'}),status:async id=>({available:id==='gemma4-e4b-it-litert-web'})},
  CivweaveLocalChatRuntimeV295:{generate:async()=>({status:'success',outputText:'{}',executionId:'gemma4-e2b-it-litert-web'})},
  CivweaveLiteRTGemma4FastRuntimeV1:{runFast:async(args,modelId)=>{forcedFastModel=modelId;return{status:'success',outputText:'{"ok":true}',executionId:modelId}}},
  CivweaveUnifiedChatSystemV1:{runLivingSchoolCurriculum:async options=>{mossRuns++;mossOptions=options;return{response:{answer:'Moss generated a Learning Journey review plan.'},provider:'living-school-learning-engine',model:'gemma4-e4b-it-litert-web',context:{guide:{system:'living-school',name:'Moss'}}}},
  CivweaveIntentionPlanner:{shouldCreate:()=>false,activeIntentionTurns:(history,text)=>[...history.map(row=>row.text||row.content),text],persist:plan=>({id:'weave-test',state:'review',plan})},
  CivweaveWeavelingPlanMaterializationV265:{materialize(){}}
};
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'civweave-weaveling-plan-json-v190.js'});
const api=sandbox.CivweaveWeavelingPlanJsonV190;
assert(api,'Weaveling orchestrator did not install.');
assert.equal(api.taskDeepModel,'gemma4-e4b-it-litert-web','Actual Quest generation must prefer E4B.');
assert.equal(api.localLearningPlanBridge,true,'Local Learning Journey bridge contract is missing.');
assert.equal(api.learningIntentPassover,true,'Weaveling-to-Moss learning intent passover is missing.');
assert.equal(api.qualificationHandoff,true,'Qualification-to-Quest handoff contract is missing.');

const tarot='Could you help me learn a system for remembering the tarot?';
const tarotResult=await sandbox.CivweaveAssistantV141.respond({text:tarot,systemId:'civweave',history:[]});
assert.equal(mossRuns,1,'Tarot learning request did not pass directly from Weaveling to Moss.');
assert.equal(baseChatCalls,0,'Tarot learning request leaked into ordinary E2B tutoring chat before Moss.');
assert.equal(mossOptions?.systemId,'living-school','Tarot learning request was not re-routed into Living School.');
assert.equal(mossOptions?.sourceSystemId,'civweave','Moss handoff lost Weaveling as the source system.');
assert.match(tarotResult.response.answer,/Learning Journey/i,'Tarot learning request did not return the Moss Learning Journey path.');
assert.equal(api.readPendingProject(),null,'Learning intent incorrectly created a pending generic Quest qualification.');

const first='Could you help me make a game about time travel?';
const firstResult=await sandbox.CivweaveAssistantV141.respond({text:first,systemId:'civweave',history:[]});
assert.match(firstResult.response.answer,/more/i,'Short project request should remain conversational for one qualification turn.');
assert.equal(baseChatCalls,1,'Generic game qualification did not stay on the conversational E2B lane exactly once.');
assert.equal(api.readPendingProject()?.text,first,'Initial project request was not retained for the task-generation handoff.');
const second='Action RPG where a time traveler and a time looper clash. Time is linear for the looper but things keep changing because of the traveler.';
const history=[{role:'user',text:first},{role:'assistant',text:firstResult.response.answer}];
const secondResult=await sandbox.CivweaveAssistantV141.respond({text:second,systemId:'civweave',history});
assert.equal(secondResult.plan?.title,questJson.title,'Qualifying answer did not populate a Quest.');
assert.equal(capturedRequest?.purpose,'civweave-weaveling-intention-json-v190','Qualifying answer did not enter structured Quest generation.');
assert.equal(capturedRequest?.config?.model,'gemma4-e4b-it-litert-web','Structured Quest generation did not route to E4B.');
assert.equal(api.readPendingProject(),null,'Pending project state was not cleared after successful Quest generation.');

capturedRequest=null;
await sandbox.CivweaveModelRuntime.generate({purpose:'living-school-learning-plan-review-v2',config:{provider:'downloaded-local',route:'downloaded-local',model:'gemma4-e2b-it-litert-web',timeoutMs:90000,maxTokens:1200},messages:[]});
assert.equal(typeof capturedRequest?.transport,'function','Downloaded-local Learning Journey plan was not given a direct local structured transport.');
assert.equal(capturedRequest?.config?.model,'gemma4-e4b-it-litert-web','Moss structured Learning Journey planning still inherited conversational E2B.');
assert.equal(capturedRequest?.config?.timeoutMs,600000,'Moss structured Learning Journey planning did not receive the long task timeout.');
assert.ok(capturedRequest?.config?.maxTokens>=1800,'Moss structured Learning Journey planning did not receive the structured output token budget.');
assert.equal(capturedRequest?.__civweaveSkipResponseRouter,true,'Local Learning Journey plan was left exposed to the shared response router.');
assert.equal(capturedRequest?.__civweaveLocalStructuredLearningPlan,true,'Local Learning Journey bridge marker is missing.');
assert.equal(capturedRequest?.__civweaveDeepTaskModel,true,'Moss Learning Journey request is missing the deep-task model marker.');

const transport=api.localStructuredTransport('quest');
await transport({config:{model:'gemma4-e4b-it-litert-web',maxTokens:1800},messages:[{role:'system',content:'Return JSON.'},{role:'user',content:'Build the Quest.'}]});
assert.equal(forcedFastModel,'gemma4-e4b-it-litert-web','Local structured transport did not force the requested E4B LiteRT model.');

let pending=null,outerLocalCalls=0,outerQuestCalls=0,outerQuestText='',outerMossCalls=0;
const outerLocal=async()=>{outerLocalCalls++;return{response:{answer:'What kind of game do you want to make?'},provider:'downloaded-local',model:'gemma4-e2b-it-litert-web'}};
outerLocal.__civweaveLocalProviderAuthorityV1=true;outerLocal.__civweaveLocalProviderAuthorityVersion='test';outerLocal.__prior=async()=>({response:{answer:'deterministic control'}});
const controlSandbox={
  console,JSON,Date,Math,Promise,Map,Set,Object,Array,String,Number,Boolean,RegExp,Error,globalThis:null,
  setInterval:()=>0,clearInterval(){},setTimeout:()=>0,queueMicrotask:fn=>fn(),addEventListener(){},dispatchEvent(){},CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  document:{scripts:[],head:{isConnected:true,append(){}}},location:{href:'https://civweave-staging.pages.dev/'},URL,CivweaveAssistantV141:{respond:outerLocal},
  CivweaveWeavelingPlanJsonV190:{version:'1.2.0-weaveling-plan-json-v190-ai-quest-intent',planIntent:text=>/game|plan|quest/i.test(text),learningJourneyIntent:text=>/help me learn/i.test(text),runLearningJourney:async options=>{outerMossCalls++;return{response:{answer:'Moss Learning Journey'},provider:'living-school-learning-engine',model:'gemma4-e4b-it-litert-web',options}},shouldQualifyProject:text=>/^Could you help me make a game about time travel\?$/i.test(text),savePendingProject:text=>(pending={text}),readPendingProject:()=>pending,clearPendingProject:()=>{pending=null},substantiveQualifierReply:text=>text.split(/\s+/).length>=6,createModelPlan:async args=>{outerQuestCalls++;outerQuestText=args.text;return{plan:{title:'Time Traveler vs Time Looper'},questAuthoring:{aiGenerated:true}}}}
};
controlSandbox.globalThis=controlSandbox;
vm.runInNewContext(controlSource,controlSandbox,{filename:'local-guide-control-bypass-v1.js'});
const outerTarot=await controlSandbox.CivweaveAssistantV141.respond({text:tarot,systemId:'civweave',history:[]});
assert.equal(outerMossCalls,1,'Outermost local control wrapper intercepted Tarot learning instead of passing to Moss.');
assert.equal(outerLocalCalls,0,'Outermost local control wrapper leaked Tarot learning into E2B chat.');
assert.match(outerTarot.response.answer,/Moss Learning Journey/,'Outermost learning passover did not return Moss.');
const outerFirst=await controlSandbox.CivweaveAssistantV141.respond({text:first,systemId:'civweave',history:[]});
assert.match(outerFirst.response.answer,/kind of game/i,'Outer local control route swallowed the qualification turn.');
assert.equal(outerLocalCalls,1,'Outer local control route did not delegate the game qualifier to E2B chat.');
assert.equal(outerQuestCalls,0,'Outer local control route generated a Quest before qualification.');
assert.equal(pending?.text,first,'Outer local control route did not retain the pending project.');
const outerSecond=await controlSandbox.CivweaveAssistantV141.respond({text:second,systemId:'civweave',history:[{role:'user',text:first},{role:'assistant',text:outerFirst.response.answer}]});
assert.equal(outerSecond.plan?.title,'Time Traveler vs Time Looper','Outer local control route did not populate the Quest after qualification.');
assert.equal(outerQuestCalls,1,'Outer local control route did not hand the qualifying answer to structured Quest generation exactly once.');
assert.match(outerQuestText,/Additional direction from the Hero:/,'Outer local control route did not combine the original request with the qualifying answer.');
assert.equal(pending,null,'Outer local control route did not clear pending state after generation.');

for(const required of ['civweave:assistant-runtime-ready','civweave:local-model-runtime-ready','civweave:gemma4-litert-fast-runtime-ready'])assert.ok(source.includes(required),`Lifecycle reassertion is missing ${required}.`);
assert.ok(controlSource.includes('__cwWeavelingQualificationHandoffV1'),'Outer local control qualification lock is missing.');
assert.ok(controlSource.includes('__cwMossLearningGoalPlannerV1'),'Outer local control Moss passover lock is missing.');
console.log('Tarot learning passes directly to Moss, Moss structured planning uses E4B with long timeout, game qualification stays on E2B, and outer control integration is locked.');