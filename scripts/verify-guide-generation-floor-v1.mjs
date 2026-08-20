import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const floorPath='public/app/guide-generation-floor-v1.js';
const loaderPath='public/app/shared-guide-surface-v236.js';
for(const path of [floorPath,loaderPath])execFileSync(process.execPath,['--check',path],{stdio:'inherit'});

const floorSource=fs.readFileSync(floorPath,'utf8');
const loaderSource=fs.readFileSync(loaderPath,'utf8');
const registrations=[];
const listeners=new Map();
const context={
  globalThis:null,
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent(){return true},
  addEventListener(type,handler){listeners.set(type,handler)},
  queueMicrotask(handler){handler()},
  CivweaveFastInteractiveV192:{register(id,hooks,priority){registrations.push({id,hooks,priority});return()=>{}}},
  console,
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(floorSource,context,{filename:floorPath});

const api=context.CivweaveGuideGenerationFloorV1;
assert.ok(api,'guide generation floor API missing');
assert.equal(api.floorTokens,900);
assert.equal(api.planningFloorTokens,1800);
assert.equal(api.styleOnlyLengthClassification,true);
assert.equal(api.planningContractV1,true,'guide planning contract must be exposed');
assert.equal(api.localGuideStreaming,true,'downloaded-local guide streaming must be exposed');
assert.equal(api.platformPlanning,true,'platform planning context must be exposed');
assert.equal(api.mossLearningGoalPlanner,true,'ordinary Moss learning goals must use the platform planner');
assert.equal(api.learningGoalText('I want to learn Tarot.'),true,'ordinary learning goal was not recognized');
assert.equal(api.learningGoalText('What does the Fool card mean?'),false,'ordinary factual Moss question should not auto-build a Learning Journey');
const registration=registrations.find(row=>row.id==='guide-generation-floor-v1');
assert.ok(registration,'guide generation floor middleware was not registered');
assert.equal(registration.priority,-1000,'floor must run after the MiniLM length classifier and fast request shaping so local streaming can be restored');

function before(request){
  const out=registration.hooks.before(request);
  return out?.request||out;
}

let request=before({purpose:'civweave-guide-response-v141',config:{maxTokens:96,responseLengthClass:'short'}});
assert.equal(request.config.maxTokens,900,'short guide response was still allowed to truncate below 900 tokens');
assert.equal(request.config.responseLengthClass,'short','length class should remain a style/routing signal');
assert.equal(request.config.generationBudgetFloorTokens,900);

request=before({purpose:'living-school-guide-chat-v350',config:{maxTokens:320,responseLengthClass:'medium'}});
assert.equal(request.config.maxTokens,900,'medium guide response was still capped below the generation floor');

request=before({purpose:'civweave-guide-response-v141',config:{maxTokens:1400,responseLengthClass:'fast'}});
assert.equal(request.config.maxTokens,1400,'generation floor must not reduce a larger route budget');

request=before({purpose:'civweave-guide-response-v141',config:{maxTokens:3072,responseLengthClass:'smart'}});
assert.equal(request.config.maxTokens,3072,'generation floor must preserve smart-tier budgets');

request=before({
  purpose:'civweave-guide-response-v141',
  config:{provider:'downloaded-local',route:'downloaded-local',maxTokens:900,stream:false},
  capabilityRequirements:{planning:true,structuredOutput:true},
  task:{text:'Can you make me a plan to create a community garden?',requirements:{planning:true,structuredOutput:true}},
  messages:[
    {role:'system',content:'You are Weaveling. Answer the user.'},
    {role:'user',content:'Can you make me a plan to create a community garden?'}
  ]
});
assert.equal(request.config.maxTokens,1800,'planning requests need enough bounded budget for a full response plus corrective continuation');
assert.equal(request.config.generationBudgetFloorTokens,1800);
assert.equal(request.config.stream,true,'downloaded-local guide streaming was disabled by earlier request shaping');
assert.equal(request.__civweaveGuideLocalStreaming,true);
assert.equal(request.__civweaveGuidePlanningContract,'v1','planning request did not receive the guide planning contract');
assert.match(request.messages[0].content,/produce the plan now/i,'planning prompt still allows an announcement instead of a plan');
assert.match(request.messages[0].content,/at least six ordered steps/i,'planning prompt does not require a sufficiently complete practical plan');
assert.match(request.messages[0].content,/materials or resources/i,'planning prompt does not require resource planning');
assert.match(request.messages[0].content,/how success will be checked/i,'planning prompt does not require success checks');
assert.match(request.messages[0].content,/immediate next action/i,'planning prompt does not require a concrete next action');
assert.match(request.messages[0].content,/Complete every sentence/i,'planning prompt does not explicitly reject unfinished thoughts');
assert.equal(request.messages[1].content,'Can you make me a plan to create a community garden?','planning middleware rewrote the user request');

request=before({
  purpose:'civweave-guide-response-v141',
  config:{provider:'downloaded-local',maxTokens:900,stream:false},
  context:{guide:{system:'living-school'}},
  task:{text:'I want to learn Tarot.'},
  messages:[{role:'system',content:'You are Moss.'},{role:'user',content:'I want to learn Tarot.'}]
});
assert.equal(request.artifactKind,'learning-path','Moss learning intent was not routed into the Learning Journey planner context');
assert.equal(request.__civweaveGuidePlatformPlanning,'living-school-learning-journey-v1');
assert.equal(request.capabilityRequirements.planning,true);
assert.equal(request.task.requirements.planning,true);
assert.equal(request.context.canonicalArtifactLanguage.artifact,'Learning Journey');
assert.equal(request.config.maxTokens,1800,'Moss Learning Journey planning did not receive the planning budget');
assert.equal(request.config.stream,true,'Moss downloaded-local Learning Journey did not stream');
assert.match(request.messages[0].content,/learning goal is a request to build a Learning Journey/i,'Moss was not instructed to make a platform Learning Journey first pass');

let delegated=0,platformRuns=0;
context.CivweaveAssistantV141={respond:async()=>{delegated+=1;return{provider:'delegate'}}};
context.CivweaveUnifiedChatSystemV1={
  activeTheme:()=> 'living-school',
  curriculumIntent:()=>false,
  runLivingSchoolCurriculum:async options=>{platformRuns+=1;return{provider:'living-school-learning-engine',request:options}}
};
assert.equal(api.installLivingSchoolPlatformPlanner(),true,'Moss platform planner wrapper did not install');
let platformResult=await context.CivweaveAssistantV141.respond({text:'I want to learn Tarot.',systemId:'living-school',history:[]});
assert.equal(platformRuns,1,'ordinary Moss learning goal did not call Living School learning engine');
assert.equal(platformResult.provider,'living-school-learning-engine');
assert.equal(delegated,0,'ordinary Moss learning goal leaked into generic model chat before platform planning');
await context.CivweaveAssistantV141.respond({text:'What does the Fool card mean?',systemId:'living-school',history:[]});
assert.equal(delegated,1,'ordinary Moss factual question should remain ordinary guide chat');

request=before({purpose:'civweave-guide-response-v141',config:{provider:'downloaded-local',maxTokens:900,stream:false},messages:[{role:'user',content:'Hello'}]});
assert.equal(request.config.stream,true,'ordinary downloaded-local guide messages should stream too');
assert.equal(request.config.maxTokens,900,'ordinary local guide messages should retain the ordinary guide budget');

request=before({purpose:'civweave-guide-response-v141',config:{provider:'gemini',maxTokens:900,stream:false},messages:[{role:'user',content:'Hello'}]});
assert.equal(request.config.stream,false,'the local streaming repair must not alter remote-provider streaming policy');

const ordinary={purpose:'background-indexing',config:{maxTokens:96}};
assert.equal(before(ordinary),ordinary,'non-guide generation should not be rewritten');

assert.ok(loaderSource.includes('/app/guide-generation-floor-v1.js?v=1.0.0-floor-900'),'shared guide loader is not delivering the generation floor');
assert.ok(loaderSource.includes("generationFloor:'guide-generation-floor-v1-900-tokens'"),'shared guide loader diagnostics do not expose the 900-token ordinary floor');

console.log('PASS guide response budgets, Moss Learning Journey engine routing, concrete planning contract, and downloaded-local token streaming are active.');
