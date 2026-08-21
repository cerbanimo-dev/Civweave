import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const paths={
  floor:'public/app/guide-generation-floor-v1.js',
  loader:'public/app/shared-guide-surface-v236.js',
  stream:'public/app/guide-stream-thinking-v249.js',
  control:'public/app/local-guide-control-bypass-v1.js',
  localRuntime:'public/app/local-chat-runtime-v295.js',
  gemmaRepair:'public/app/local-ai/gemma4-inference-repair-v1.js',
  worker:'public/app/local-ai/worker-v266.js'
};
for(const path of Object.values(paths))execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
const source=Object.fromEntries(Object.entries(paths).map(([key,path])=>[key,fs.readFileSync(path,'utf8')]));

const registrations=[],listeners=new Map();
const context={
  globalThis:null,
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent(){return true},
  addEventListener(type,handler){listeners.set(type,handler)},
  queueMicrotask(handler){handler()},
  CivweaveFastInteractiveV192:{register(id,hooks,priority){registrations.push({id,hooks,priority});return()=>{}}},
  console
};
context.globalThis=context;vm.createContext(context);vm.runInContext(source.floor,context,{filename:paths.floor});
const api=context.CivweaveGuideGenerationFloorV1;
assert.ok(api,'guide generation floor API missing');
assert.equal(api.floorTokens,900);
assert.equal(api.planningFloorTokens,1800);
assert.equal(api.weavelingPlanFloorTokens,2400);
assert.equal(api.localExecutionContractV1,true);
assert.equal(api.localGuideStreaming,true);
assert.equal(api.localStructuredPlan,true);
assert.equal(api.weavelingPlannerRecovery,true);
assert.equal(api.weavelingUnavailablePacketRecovery,true);
assert.equal(api.mossLearningGoalPlanner,true);
assert.equal(api.revision,'1.3.1-local-structured-fallback');

const registration=registrations.find(row=>row.id==='guide-generation-floor-v1');
assert.ok(registration,'generation floor middleware was not registered');
assert.equal(registration.priority,-1000);
const before=request=>{const out=registration.hooks.before(request);return out?.request||out};

let request=before({purpose:'civweave-guide-response-v141',config:{maxTokens:96,responseLengthClass:'short'}});
assert.equal(request.config.maxTokens,900);

request=before({
  purpose:'civweave-guide-response-v141',
  config:{provider:'downloaded-local',route:'downloaded-local',maxTokens:900,stream:false},
  capabilityRequirements:{planning:true,structuredOutput:true},
  task:{text:'Make me a plan to create a community garden',requirements:{planning:true,structuredOutput:true}},
  messages:[{role:'system',content:'You are Weaveling.'},{role:'user',content:'Make me a plan to create a community garden'}]
});
assert.equal(request.config.maxTokens,1800);
assert.equal(request.config.stream,true);
assert.equal(request.__civweaveGuidePlanningContract,true);
assert.equal(request.__civweaveGuideLocalExecutionContract,true);
assert.match(request.messages[0].content,/produce the plan now/i);

request=before({
  purpose:'civweave-weaveling-intention-json-v190',
  executionProfile:'interactive',
  config:{provider:'downloaded-local',route:'downloaded-local',model:'gemma4-e2b-it-q4f16',stream:false},
  context:{guide:{system:'civweave'},userMessage:'Make me a plan to create a community bunker'},
  messages:[{role:'system',content:'You are Weaveling.'},{role:'user',content:'Create the reviewable weave.'}],
  schema:{type:'object'}
});
assert.equal(api.weavelingStructuredPlanRequest(request),true);
assert.equal(request.config.maxTokens,2400);
assert.equal(request.config.stream,true);
assert.equal(request.capabilityRequirements.planning,true);
assert.equal(request.capabilityRequirements.structuredOutput,true);
assert.equal(request.__civweaveGuidePlatformPlanning,'civweave-reviewable-weave-v1');
assert.equal(request.__civweaveSkipResponseRouter,true,'downloaded-local structured Weaveling plans must not be rewritten to server-auto');
assert.equal(request.__civweaveLocalStructuredPlan,true);
assert.match(request.messages[0].content,/never replace the requested plan with commentary about model capability/i);

assert.equal(api.weavelingGenerationUnavailable({provider:'weaveling-ai-generation-unavailable',response:{answer:'I could not start AI Quest generation.'}}),true);
assert.equal(api.weavelingGenerationUnavailable({error:{code:'STRUCTURED_ARTIFACT_NETWORK_EXHAUSTED'}}),true);
assert.equal(api.weavelingGenerationUnavailable({provider:'downloaded-local',response:{answer:'Here is the completed plan.'}}),false);

let delegated=0,platformRuns=0;
context.CivweaveAssistantV141={respond:async options=>{
  delegated+=1;
  if(options.systemId==='civweave')return{provider:'weaveling-ai-generation-unavailable',response:{answer:'I could not start AI Quest generation. Nothing was created or saved. Generation detail: Structured artifact generation could not obtain a server-side model. Local generation was intentionally skipped.'}};
  return{provider:'delegate'};
}};
context.CivweaveUnifiedChatSystemV1={activeTheme:()=> 'living-school',curriculumIntent:()=>false,runLivingSchoolCurriculum:async options=>{platformRuns+=1;return{provider:'living-school-learning-engine',request:options}}};
context.CivweaveIntentionPlanner={buildPlan:({text})=>({id:'plan-1',title:'Community bunker',wish:text,state:'review',assumptions:[],paths:[]}),persist:plan=>({id:'item-1',state:'review',plan}),format:()=> 'Recovered reviewable community-bunker weave.'};
assert.equal(api.installPlatformGuideGuards(),true);
let result=await context.CivweaveAssistantV141.respond({text:'I want to learn Tarot.',systemId:'living-school',history:[]});
assert.equal(result.provider,'living-school-learning-engine');assert.equal(platformRuns,1);assert.equal(delegated,0);
result=await context.CivweaveAssistantV141.respond({text:'Make me a plan for a community bunker',systemId:'civweave',history:[]});
assert.equal(result.provider,'civweave-planner-recovery');
assert.match(result.response.answer,/Recovered reviewable/);
assert.equal(result.response.requiresConsent,true);
assert.equal(delegated,1);

request=before({purpose:'civweave-guide-response-v141',config:{provider:'downloaded-local',maxTokens:900,stream:false},messages:[{role:'user',content:'Hello'}]});
assert.equal(request.config.stream,true);
assert.match(request.messages[0].content,/downloaded-local execution contract/i);
request=before({purpose:'civweave-guide-response-v141',config:{provider:'gemini',maxTokens:900,stream:false},messages:[{role:'user',content:'Hello'}]});
assert.equal(request.config.stream,false);
const ordinary={purpose:'background-indexing',config:{maxTokens:96}};assert.equal(before(ordinary),ordinary);

assert.ok(source.loader.includes('/app/guide-generation-floor-v1.js'),'shared guide loader is not delivering the generation floor');
assert.ok(source.loader.includes("version==='1.3.0-guide-generation-floor-v1-local-planner-authority'"),'shared guide loader no longer recognizes the compatible generation-floor API');
assert.ok(source.loader.includes('/app/local-guide-control-bypass-v1.js?v=1.4.1-ai-quest-lazy-route'),'shared guide loader is not delivering the current local quest-control route');
assert.ok(source.loader.includes('/app/guide-stream-thinking-v249.js?v=1.0.124-finalization-guard'),'shared guide loader is not delivering the current stream finalization guard');
assert.ok(source.loader.includes('/app/local-ai/gemma4-inference-repair-v1.js?v=1.0.3-onnx-only'),'shared guide loader is not delivering the current Gemma inference repair');

assert.ok(source.control.includes('aiQuestAuthoringRequired:true'),'local guide control bypass lost structured Quest routing');
assert.ok(source.control.includes("return'test'"),'Test/ping messages are not recognized as local control intents');
assert.ok(source.control.includes("return'greeting'"),'greetings are not recognized as local control intents');
assert.ok(source.control.includes('current.__prior.bind(api)'),'control intents do not bypass downloaded-local inference');
assert.ok(source.control.includes('__civweaveLocalProviderAuthorityV1'),'control bypass does not preserve provider ownership');
assert.ok(source.stream.includes('visibleWeavelingPlan'),'structured Weaveling planning has no visible stream projection');
assert.ok(source.stream.includes('localAuthorityTokenBridge:true'),'local-provider token bridge diagnostic is missing');
assert.ok(source.stream.includes('animationFrameStreaming:true'),'token rendering is not batched to browser paint frames');
assert.ok(source.localRuntime.includes('taskAwareOutputBudget:true'),'local chat runtime does not use task-aware output budgeting');
assert.ok(source.localRuntime.includes('planningOutputTokens:1800'),'local planning budget is below the planning floor');
assert.ok(source.localRuntime.includes('weavelingPlanningOutputTokens:2400'),'Weaveling local planning budget is below its planning floor');
assert.ok(source.localRuntime.includes('maxOutputTokens:4096'),'local chat runtime does not expose its long-output ceiling');
assert.ok(source.worker.includes('function repairGemma4ChatTemplate(spec)'),'Gemma worker does not repair the stale ONNX chat template');
assert.ok(source.worker.includes('num_logits_to_keep'),'Gemma decoder is not guarding num_logits_to_keep');
assert.ok(source.gemmaRepair.includes("WORKER_PATH='/app/local-ai/worker-v266.js'"),'runtime cache guard is not scoped to the worker path');
assert.ok(source.gemmaRepair.includes('entriesEvicted'),'runtime cache guard does not evict stale worker variants');

console.log('PASS guide planning floor: downloaded-local structured Weaveling plans stay local-capable, unavailable server packets recover to reviewable weaves, and current streaming/Gemma contracts remain wired.');
