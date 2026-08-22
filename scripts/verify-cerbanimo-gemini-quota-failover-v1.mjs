#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const root=resolve(new URL('..',import.meta.url).pathname);
const path=resolve(root,'public/app/cerbanimo-chat-quest-capability-v1.js');
const source=fs.readFileSync(path,'utf8');
const syntax=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
assert.equal(syntax.status,0,syntax.stderr||syntax.stdout);
for(const token of ["'gemini-3.7-flash','gemini-3.5-flash','gemini-3.1-flash-lite'",'geminiQuotaFailure','nextGeminiQuotaModel','generateQuestModel','GEMINI_QUOTA_CHAIN_EXHAUSTED'])assert(source.includes(token),`Kamiya capability is missing ${token}`);

const plan={title:'Build a Community Garden',objective:'Open a functioning neighborhood community garden.',description:'Move from agreement to a planted and maintainable shared garden.',workUnits:[
  {title:'Define the garden brief',result:'A shared brief exists.',proof:'Attach the brief.',acceptanceCriteria:'Purpose and minimum site needs are explicit.'},
  {title:'Secure a site',result:'A viable site is selected.',proof:'Attach permission and a site note.',acceptanceCriteria:'Permission, sun, water, and access are documented.'},
  {title:'Organize the build',result:'People, materials, and build sequence are assigned.',proof:'Attach the roster and materials list.',acceptanceCriteria:'Owners and required resources are explicit.'},
  {title:'Build and plant',result:'The first beds are planted.',proof:'Attach launch photos.',acceptanceCriteria:'A visible planted result exists with a maintenance owner.'}
],assumptions:['Neighborhood-scale project.']};
const quota=model=>({status:'provider-error',requested:{provider:'gemini',model},actual:{provider:'gemini',model},error:{code:'PROVIDER_HTTP_ERROR',status:429,message:`Gemini returned HTTP 429: RESOURCE_EXHAUSTED quota exceeded for ${model}`}});
const success=model=>({status:'success',requested:{provider:'gemini',model},actual:{provider:'gemini',model},outputJson:plan,outputText:JSON.stringify(plan),usage:{}});
const calls=[];let handler=null,added=null;
const context={console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,
  document:{scripts:[],head:{append:()=>{}},createElement:()=>({addEventListener:()=>{}})},location:{href:'https://civweave-staging.pages.dev/app/realm-console-v140.html'},
  addEventListener:()=>{},dispatchEvent:()=>{},CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},queueMicrotask:fn=>fn(),setInterval:()=>1,clearInterval:()=>{},setTimeout:fn=>{fn();return 1},
  CivweaveUnifiedChatSystemV1:{registerCapability:(system,value)=>{assert.equal(system,'cerbanimo');handler=value}},
  CivweaveAssistantV141:{selectedConfig:()=>({provider:'gemini',route:'gemini',model:'gemini-3.1-flash-lite',maxTokens:1600,temperature:.2})},
  CivweaveFamilyAILoaderV105:{ensure:async()=>true},
  CivweaveModelRuntime:{generate:async request=>{calls.push(`spine:${request.config?.model||''}`);return quota('gemini-3.7-flash')}},
  CivweaveFastInteractiveV192:{base:()=>({generate:async request=>{const model=request.config?.model;calls.push(`base:${model}`);return model==='gemini-3.5-flash'?quota(model):model==='gemini-3.1-flash-lite'?success(model):quota(model)}})},
  CivweaveCerbanimoQuestV144:{createQuestFromInput:input=>({id:'quest-garden',title:input.title,objective:input.objective,description:input.description,source:input.source,sourceActionId:input.sourceActionId,tasks:input.steps.map((step,index)=>({id:`task-${index+1}`,title:step.split(':')[0],acceptanceCriteria:[],proofRequired:true}))}),addQuest:(quest,options)=>{added={quest,options};return{ok:true,quest}}}
};
context.globalThis=context;vm.createContext(context);vm.runInContext(source,context,{filename:path});
assert.equal(typeof handler,'function','Kamiya capability did not register.');
const response=await handler({systemId:'cerbanimo',text:'Help me build a community garden',history:[]},async()=>({response:{answer:'fallthrough'}}));
assert.deepEqual(calls,['spine:gemini-3.1-flash-lite','base:gemini-3.5-flash','base:gemini-3.1-flash-lite'],'Quota failover did not use 3.7 → 3.5 → Flash-Lite routing in order.');
assert(added&&added.options.activate===true,'Fallback success did not create and activate the Endeavor.');
assert.match(response.response.answer,/Gemini quota failover used: gemini-3\.7-flash → gemini-3\.5-flash → gemini-3\.1-flash-lite/,'Visible response did not disclose the fallback chain.');
assert.equal(response.model,'gemini-3.1-flash-lite','Successful fallback model was not surfaced.');
assert.equal(response.action.geminiQuotaFailover.success,true,'Fallback provenance was not attached to the created Endeavor.');
assert.equal(response.action.geminiQuotaFailover.toModel,'gemini-3.1-flash-lite','Fallback provenance has the wrong final model.');
console.log('PASS Kamiya fails over Gemini 3.7 Flash → 3.5 Flash → 3.1 Flash-Lite on quota errors and only then creates the Endeavor.');
