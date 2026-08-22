#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const root=resolve(new URL('..',import.meta.url).pathname);
const read=path=>fs.readFileSync(resolve(root,path),'utf8');
const syntax=path=>{const result=spawnSync(process.execPath,['--check',resolve(root,path)],{encoding:'utf8'});assert.equal(result.status,0,`${path} failed node --check:\n${result.stderr||result.stdout}`)};
const capabilityPath='public/app/cerbanimo-chat-quest-capability-v1.js';
const normalizerPath='public/app/server-ai-output-normalizer-v1.js';
const boundaryPath='public/app/install-boundary-v146.js';
const realmPath='public/app/realm-console-v140.html';
const workerPath='public/service-worker-chat-repair-v245.js';
for(const path of [capabilityPath,normalizerPath,boundaryPath,workerPath])syntax(path);
const source=read(capabilityPath),normalizer=read(normalizerPath),boundary=read(boundaryPath),realm=read(realmPath),worker=read(workerPath);
assert(realm.includes('/app/server-ai-output-normalizer-v1.js?v=1.0.0'),'Cerbanimo console does not load provider-envelope normalization.');
assert(realm.includes('/app/cerbanimo-chat-quest-capability-v1.js?v=1.0.1'),'Cerbanimo console does not load the current Kamiya Quest capability.');
assert(realm.indexOf('server-ai-output-normalizer-v1.js')<realm.indexOf('family-ai-loader-v105.js'),'Provider-envelope normalizer must be installed before the model loader can answer.');
for(const token of ["const SERVER_AI_OUTPUT_NORMALIZER='/app/server-ai-output-normalizer-v1.js'","const CERBANIMO_CHAT_QUEST='/app/cerbanimo-chat-quest-capability-v1.js'",'GUIDE_WORKSPACE,SERVER_AI_OUTPUT_NORMALIZER,CERBANIMO_CHAT_QUEST'])assert(boundary.includes(token),`Global system experience loader is missing ${token}`);
for(const path of ['/app/server-ai-output-normalizer-v1.js','/app/cerbanimo-chat-quest-capability-v1.js'])assert(worker.includes(`'${path}'`),`Chat cache repair does not purge ${path}`);
for(const token of ["chat.registerCapability('cerbanimo',handler)","responseFormat:'json'",'schema:QUEST_SCHEMA','createQuestFromInput','addQuest(quest,{activate:true})',"source:'kamiya-chat-ai-quest'",'proofRequirements','acceptanceCriteria','task.acceptanceCriteria=[criterion]'])assert(source.includes(token),`Kamiya Quest capability is missing ${token}`);
for(const token of ['choices?.[0]?.message','reasoningVisible:false','WORKERS_AI_ENVELOPE_NORMALIZED'])assert(normalizer.includes(token),`Server AI output normalizer is missing ${token}`);

let registeredHandler=null,added=null;
const generatedPlan={
  title:'Build a Community Garden',
  objective:'Create a functioning community garden with a secured site, participating neighbors, beds, water, and an operating plan.',
  description:'Move from site definition through launch with visible, reviewable results.',
  workUnits:[
    {title:'Define the garden brief',result:'A one-page brief names the intended users, garden purpose, scale, and site requirements.',proof:'Attach the garden brief.',acceptanceCriteria:'Purpose, users, minimum site needs, and decision owner are explicit.'},
    {title:'Secure a viable site',result:'A candidate site has documented permission, sun, access, and water feasibility.',proof:'Attach permission or owner correspondence plus a site note.',acceptanceCriteria:'Land permission and basic site constraints are documented.'},
    {title:'Form the core group',result:'Named participants have operating roles and a communication channel.',proof:'Attach the roster and role assignments.',acceptanceCriteria:'At least three operating responsibilities have owners.'},
    {title:'Design and resource the garden',result:'A buildable layout, materials list, budget, and water plan are ready.',proof:'Attach the layout and resource list.',acceptanceCriteria:'Beds, paths, water, accessibility, tools, soil, and budget are addressed.'},
    {title:'Build and launch',result:'The first beds are installed, planted, and assigned a maintenance cadence.',proof:'Attach launch photos and the maintenance schedule.',acceptanceCriteria:'The garden has a visible planted result and named ongoing caretakers.'}
  ],
  assumptions:['The Hero wants a neighborhood-scale garden rather than a commercial farm.']
};
const rawEnvelope=JSON.stringify({id:'chatcmpl-community-garden',object:'chat.completion',choices:[{index:0,message:{role:'assistant',content:JSON.stringify(generatedPlan),reasoning:'PRIVATE REASONING MUST NEVER RENDER',reasoning_content:'PRIVATE REASONING MUST NEVER RENDER'}}],usage:{prompt_tokens:300,completion_tokens:700,total_tokens:1000,neurons:40}});
const storage=new Map();
const context={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
  document:{scripts:[],head:{append:()=>{}},createElement:()=>({addEventListener:()=>{}})},location:{href:'https://civweave-staging.pages.dev/app/realm-console-v140.html'},
  addEventListener:()=>{},dispatchEvent:()=>{},CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},queueMicrotask:fn=>fn(),setInterval:()=>1,clearInterval:()=>{},setTimeout:fn=>{fn();return 1},
  CivweaveUnifiedChatSystemV1:{registerCapability:(system,handler)=>{assert.equal(system,'cerbanimo');registeredHandler=handler}},
  CivweaveAssistantV141:{selectedConfig:()=>({provider:'cloudflare-workers-ai',route:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash',maxTokens:1600,temperature:.2})},
  CivweaveFamilyAILoaderV105:{ensure:async()=>true},
  CivweaveModelRuntime:{generate:async request=>{assert.equal(request.purpose,'cerbanimo-quest-authoring-v1');assert.equal(request.responseFormat,'json');assert.equal(request.task.systemId,'cerbanimo');return{status:'success',actual:{provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'},outputText:rawEnvelope,usage:{chargedNeurons:40}}}},
  CivweaveCerbanimoQuestV144:{
    createQuestFromInput:input=>({id:'quest-community-garden',title:input.title,objective:input.objective,description:input.description,source:input.source,sourceActionId:input.sourceActionId,acceptanceCriteria:input.acceptanceCriteria,proofRequirements:input.proofRequirements,tasks:input.steps.map((step,index)=>({id:`task-${index+1}`,title:step.split(':')[0],description:step,acceptanceCriteria:[input.proofRequirements[index]],proofRequired:true}))}),
    addQuest:(quest,options)=>{added={quest,options};return{ok:true,quest}}
  }
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:capabilityPath});
assert.equal(typeof registeredHandler,'function','Kamiya capability did not register with unified chat.');
assert.equal(context.CivweaveCerbanimoChatQuestCapabilityV1.questIntent('Help me build a community garden'),true,'Community garden build request was not recognized as Quest intent.');
const response=await registeredHandler({systemId:'cerbanimo',text:'Help me build a community garden',history:[]},async()=>({response:{answer:'GENERIC CHAT FALLTHROUGH'}}));
assert(added,'Community garden request did not create a Quest.');
assert.equal(added.options.activate,true,'Generated Quest was not activated.');
assert.equal(added.quest.source,'kamiya-chat-ai-quest','Generated Quest has the wrong source authority.');
assert.equal(added.quest.tasks.length,5,'Generated Quest did not preserve its work units.');
assert.equal(added.quest.proofRequirements.length,5,'Generated Quest did not preserve its proof gates.');
for(let index=0;index<added.quest.tasks.length;index+=1){
  const task=added.quest.tasks[index],unit=generatedPlan.workUnits[index];
  assert.equal(task.acceptanceCriteria[0],unit.acceptanceCriteria,`Work unit ${index+1} lost its completion criterion.`);
  assert(added.quest.proofRequirements[index].includes(unit.proof),`Work unit ${index+1} lost its proof requirement.`);
}
assert.match(response.response.answer,/Quest created:/,'Kamiya did not report the created Quest.');
assert.doesNotMatch(response.response.answer,/GENERIC CHAT FALLTHROUGH/,'Quest request fell through to generic chat.');
assert.doesNotMatch(response.response.answer,/chatcmpl-community-garden/,'Provider envelope leaked into the visible answer.');
assert.doesNotMatch(response.response.answer,/PRIVATE REASONING/,'Private reasoning leaked into the visible answer.');
assert.equal(response.response.choice.system,'cerbanimo','Kamiya response left the Cerbanimo system.');
assert.equal(response.action.kind,'cerbanimo-quest-created','Kamiya response did not expose the canonical Quest action.');
console.log('PASS Kamiya turns “Help me build a community garden” into an active structured Cerbanimo Quest with separate proof/completion gates, provider reasoning cannot render, and the capability is loaded across the shared five-guide surface.');
