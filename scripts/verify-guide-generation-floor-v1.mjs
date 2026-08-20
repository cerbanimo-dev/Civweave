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

request=before({purpose:'civweave-guide-response-v141',config:{provider:'downloaded-local',maxTokens:900,stream:false},messages:[{role:'user',content:'Hello'}]});
assert.equal(request.config.stream,true,'ordinary downloaded-local guide messages should stream too');
assert.equal(request.config.maxTokens,900,'ordinary local guide messages should retain the ordinary guide budget');

request=before({purpose:'civweave-guide-response-v141',config:{provider:'gemini',maxTokens:900,stream:false},messages:[{role:'user',content:'Hello'}]});
assert.equal(request.config.stream,false,'the local streaming repair must not alter remote-provider streaming policy');

const ordinary={purpose:'background-indexing',config:{maxTokens:96}};
assert.equal(before(ordinary),ordinary,'non-guide generation should not be rewritten');

assert.ok(loaderSource.includes('/app/guide-generation-floor-v1.js?v=1.0.0-floor-900'),'shared guide loader is not delivering the generation floor');
assert.ok(loaderSource.includes("generationFloor:'guide-generation-floor-v1-900-tokens'"),'shared guide loader diagnostics do not expose the 900-token ordinary floor');

console.log('PASS guide response budgets, concrete planning contract, and downloaded-local token streaming are active.');
