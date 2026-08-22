#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const root=resolve(new URL('..',import.meta.url).pathname);
const path='public/app/cerbanimo-chat-quest-capability-v3.js';
const source=fs.readFileSync(resolve(root,path),'utf8');
const syntax=spawnSync(process.execPath,['--check',resolve(root,path)],{encoding:'utf8'});
assert.equal(syntax.status,0,syntax.stderr||syntax.stdout);

let registered=null,added=null;const calls=[];
const parse=value=>{try{return JSON.parse(value)}catch{return null}};
const v2={
  resultObject(result){if(result?.outputJson&&typeof result.outputJson==='object')return result.outputJson;return parse(String(result?.outputText||'').trim())},
  normalizeQuestPlan(value){
    if(!value||typeof value!=='object')throw new Error('bad object');
    const workUnits=(value.workUnits||[]).map((unit,index)=>({id:`work-${index+1}`,title:unit.title,result:unit.result,proof:unit.proof,acceptanceCriteria:unit.acceptanceCriteria})).filter(unit=>unit.title&&unit.result&&unit.proof&&unit.acceptanceCriteria);
    if(workUnits.length<3||!value.title||!value.objective||!value.description)throw new Error('incomplete');
    return{title:value.title,objective:value.objective,description:value.description,workUnits,assumptions:Array.isArray(value.assumptions)?value.assumptions:[]};
  },
  malformedJsonResult(result){return result?.status==='invalid-response'&&Boolean(result?.outputText)&&!parse(result.outputText)},
  completionText(result){return String(result?.outputText||'')},
  providerErrorResult(error,config){return{status:'provider-error',actual:{provider:'gemini',model:config.model},error:{status:error.status,message:error.message}}},
  geminiTransientFailure(result,config){const status=Number(result?.error?.status||0);return(result?.actual?.provider||config.provider)==='gemini'&&(status===429||[500,502,503,504].includes(status))}
};
const valid=JSON.stringify({
  title:'Build a Community Garden',objective:'Launch a shared neighborhood garden.',description:'Organize the site, people, build, planting, and maintenance.',
  workUnits:[
    {title:'Site',result:'Confirm the site.',proof:'Site permission.',acceptanceCriteria:'Site is approved.'},
    {title:'Team',result:'Form the team.',proof:'Roster.',acceptanceCriteria:'Roles are assigned.'},
    {title:'Build',result:'Prepare beds.',proof:'Build photos.',acceptanceCriteria:'Beds and paths are usable.'}
  ],assumptions:['Neighborhood scale.']
});
let repair=0;
const base={generate:async request=>{
  calls.push({provider:request.config.provider,model:request.config.model,purpose:request.purpose,schema:Boolean(request.schema)});
  assert.equal(request.config.provider,'gemini');assert.equal(request.config.model,'gemini-3.1-flash-lite');repair+=1;
  if(repair===1)return{status:'invalid-response',actual:{provider:'gemini',model:'gemini-3.1-flash-lite'},outputText:'{"title":"Build a Community Garden","objective":"Launch',structured:{errors:['The structured Gemini response was not valid JSON: Unterminated string']}};
  if(repair===2)return{status:'success',actual:{provider:'gemini',model:'gemini-3.1-flash-lite'},outputText:valid};
  throw new Error('unexpected repair');
}};
const context={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,
  document:{scripts:[],head:{append(){}},createElement(){return{addEventListener(){}}}},location:{href:'https://civweave-staging.pages.dev/app/realm-console-v140.html'},
  addEventListener(){},dispatchEvent(){},CustomEvent:class{},queueMicrotask:fn=>fn(),setInterval:()=>1,clearInterval(){},setTimeout:fn=>{fn();return 1},
  CivweaveCerbanimoChatQuestCapabilityV2:v2,
  CivweaveUnifiedChatSystemV1:{registerCapability:(system,handler)=>{assert.equal(system,'cerbanimo');registered=handler}},
  CivweaveAssistantV141:{selectedConfig:()=>({provider:'gemini',route:'gemini',model:'gemini-3.1-flash-lite',maxTokens:2200,temperature:.15})},
  CivweaveFamilyAILoaderV105:{ensure:async()=>true},CivweaveFastInteractiveV192:{base:()=>base},
  CivweaveModelRuntime:{generate:async request=>{calls.push({provider:request.config.provider,model:'routed-gemini',purpose:request.purpose,schema:Boolean(request.schema)});return{status:'invalid-response',actual:{provider:'gemini',model:'gemini-3.1-flash-lite'},outputText:'{"title":"Build a Community Garden","objective":"Launch","description":"Plan","workUnits":[{"title":"Site"',structured:{errors:['The structured Gemini response was not valid JSON: Expected property name or } in JSON']}}}},
  CivweaveCerbanimoQuestV144:{createQuestFromInput:input=>({id:'q1',...input,tasks:input.steps.map((step,index)=>({title:step.split(':')[0],acceptanceCriteria:[input.proofRequirements[index]]}))}),addQuest:(quest,options)=>{added={quest,options};return{ok:true,quest}}}
};
context.globalThis=context;vm.createContext(context);vm.runInContext(source,context,{filename:path});
assert.equal(typeof registered,'function');
const response=await registered({text:'Help me build a community garden',systemId:'cerbanimo'},async()=>({response:{answer:'fallthrough'}}));
assert(added,'Endeavor was not created after the second Flash-Lite repair.');
assert.equal(added.options.activate,true);assert.equal(added.quest.authoring.provider,'gemini');assert.equal(added.quest.authoring.crossProviderFailover,false);assert.equal(added.quest.authoring.repairAttempts,2);
assert.equal(response.provider,'gemini');assert.equal(response.model,'gemini-3.1-flash-lite');assert.equal(calls.length,3);assert(calls.every(call=>call.provider==='gemini'));assert.equal(calls[1].schema,true);assert.equal(calls[2].schema,false);assert(!calls.some(call=>String(call.provider).includes('cloudflare')));
assert.match(response.response.answer,/Endeavor created:/);assert.doesNotMatch(response.response.answer,/Cloudflare|Workers AI|neurons/i);

const outageCalls=[];
const unavailable=model=>({status:'provider-error',actual:{provider:'gemini',model},requested:{provider:'gemini',model},error:{status:503,message:'Gemini returned HTTP 503: UNAVAILABLE high demand'}});
context.CivweaveFastInteractiveV192.base=()=>({generate:async request=>{outageCalls.push({provider:request.config.provider,model:request.config.model});return unavailable(request.config.model)}});
const outage=await context.CivweaveCerbanimoChatQuestCapabilityV3.generateGeminiOnly({generate:async request=>{outageCalls.push({provider:request.config.provider,model:'gemini-3.7-flash'});return unavailable('gemini-3.7-flash')}},{purpose:'test',executionProfile:'interactive',config:{provider:'gemini',route:'gemini',model:'gemini-3.7-flash'}},{provider:'gemini',route:'gemini',model:'gemini-3.7-flash'});
assert.equal(outage.error.code,'GEMINI_ONLY_CHAIN_EXHAUSTED');
assert.deepEqual(outageCalls.map(call=>call.model),['gemini-3.7-flash','gemini-3.5-flash','gemini-3.1-flash-lite']);
assert(outageCalls.every(call=>call.provider==='gemini'),'Gemini outage path crossed providers.');
assert.match(outage.error.message,/No neuron-backed provider was used/);assert.doesNotMatch(outage.error.message,/Cloudflare|Workers AI/i);

console.log('PASS Gemini-selected Endeavor stays on Gemini, retries Flash-Lite twice with progressively tighter repair instructions, and neither malformed JSON nor provider outages can consume Workers AI neurons.');
