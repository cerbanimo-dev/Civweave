#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const root=resolve(new URL('..',import.meta.url).pathname);
const read=path=>fs.readFileSync(resolve(root,path),'utf8');
const syntax=path=>{const result=spawnSync(process.execPath,['--check',resolve(root,path)],{encoding:'utf8'});assert.equal(result.status,0,`${path} failed node --check:\n${result.stderr||result.stdout}`)};
const loaderPath='public/app/cerbanimo-chat-quest-capability-v1.js';
const capabilityPath='public/app/cerbanimo-chat-quest-capability-v2.js';
const normalizerPath='public/app/server-ai-output-normalizer-v1.js';
const boundaryPath='public/app/install-boundary-v146.js';
const realmPath='public/app/realm-console-v140.html';
const workerPath='public/service-worker-chat-repair-v245.js';
const rootWorkerPath='public/service-worker.js';
const generatedWorkerPath='public/service-worker-v203.js';
for(const path of [loaderPath,capabilityPath,normalizerPath,boundaryPath,workerPath,rootWorkerPath,generatedWorkerPath])syntax(path);
const loader=read(loaderPath),source=read(capabilityPath),normalizer=read(normalizerPath),boundary=read(boundaryPath),realm=read(realmPath),worker=read(workerPath),rootWorker=read(rootWorkerPath),generatedWorker=read(generatedWorkerPath);
assert(loader.includes("const TARGET='/app/cerbanimo-chat-quest-capability-v2.js'"),'The v1 Cerbanimo compatibility asset does not load Endeavor authoring v2.');
assert(loader.includes('2.1.0-transient-provider-failover'),'The v1 compatibility loader can still pin the pre-503-failover Endeavor runtime.');
assert(loader.includes('compatibilityLoader:true'),'The v1 Cerbanimo asset can still register the retired strict handler.');
assert(realm.includes('/app/server-ai-output-normalizer-v1.js'),'Cerbanimo console does not load provider-envelope normalization.');
assert(realm.includes('/app/cerbanimo-chat-quest-capability-v1.js'),'Cerbanimo console does not load the v1→v2 compatibility entry.');
assert(realm.indexOf('server-ai-output-normalizer-v1.js')<realm.indexOf('family-ai-loader-v105.js'),'Provider-envelope normalizer must be installed before the model loader can answer.');
for(const token of ["const SERVER_AI_OUTPUT_NORMALIZER='/app/server-ai-output-normalizer-v1.js'","const CERBANIMO_CHAT_QUEST='/app/cerbanimo-chat-quest-capability-v1.js'",'GUIDE_WORKSPACE,SERVER_AI_OUTPUT_NORMALIZER,CERBANIMO_CHAT_QUEST'])assert(boundary.includes(token),`Global system experience loader is missing ${token}`);
for(const path of ['/app/server-ai-output-normalizer-v1.js','/app/cerbanimo-chat-quest-capability-v1.js','/app/cerbanimo-chat-quest-capability-v2.js'])assert(worker.includes(`'${path}'`),`Chat cache repair does not purge ${path}`);
assert(rootWorker.includes("'/app/cerbanimo-chat-quest-capability-v2.js'"),'Offline core does not package Endeavor authoring v2.');
assert(generatedWorker.includes('endeavor=kamiya-transient-provider-failover-v3'),'Generated service worker does not rotate the Endeavor transient-provider failover runtime.');
for(const token of ["chat.registerCapability('cerbanimo',handler)","const TRANSPORT_SCHEMA=Object.freeze({type:'object'})",'recoverablePayload','normalizeQuestPlan','cerbanimo-endeavor-authoring-repair-v2','geminiTransientFailure','CLOUDFLARE_FALLBACK','ENDEAVOR_PROVIDER_FAILOVER_EXHAUSTED','Provider failover: Gemini → Cloudflare Workers AI','createQuestFromInput','addQuest(quest,{activate:true})',"source:'kamiya-chat-ai-quest'",'task.acceptanceCriteria=[criterion]'])assert(source.includes(token),`Kamiya Endeavor v2 is missing ${token}`);
for(const token of ['choices?.[0]?.message','reasoningVisible:false','WORKERS_AI_ENVELOPE_NORMALIZED'])assert(normalizer.includes(token),`Server AI output normalizer is missing ${token}`);

let registeredHandler=null,added=null;const calls=[];
const recoverable={
  title:'Build a Community Garden',
  goal:'Create a functioning neighborhood garden.',
  summary:'Secure a site, organize neighbors, build beds, and launch operations.',
  tasks:[
    {name:'Define the brief',outcome:'A shared garden brief exists.',evidence:'Attach the brief.',doneWhen:'Purpose, users, and site needs are explicit.'},
    {name:'Secure the site',outcome:'A viable site is approved.',evidence:'Attach permission and site notes.',doneWhen:'Permission, sun, access, and water are documented.'},
    {name:'Form the team',outcome:'Operating roles have owners.',evidence:'Attach the roster.',doneWhen:'Core responsibilities have named owners.'},
    {name:'Design the build',outcome:'A buildable layout and resource list exist.',evidence:'Attach layout and materials list.',doneWhen:'Beds, paths, water, accessibility, tools, and soil are covered.'},
    {name:'Launch the garden',outcome:'Beds are planted and maintenance is assigned.',evidence:'Attach launch photos and schedule.',doneWhen:'A visible planted result and ongoing caretakers exist.'}
  ],
  assumptions:['Neighborhood-scale garden.']
};
const quota=model=>({status:'provider-error',actual:{provider:'gemini',model},requested:{provider:'gemini',model},error:{status:429,message:`Gemini returned HTTP 429: quota exceeded for ${model}`}});
const unavailable=model=>({status:'provider-error',actual:{provider:'gemini',model},requested:{provider:'gemini',model},error:{status:503,message:'Gemini returned HTTP 503: This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later. UNAVAILABLE'}});
const base={generate:async request=>{
  calls.push(request.config.model);
  if(request.config.model==='gemini-3.5-flash')return quota('gemini-3.5-flash');
  if(request.config.model==='gemini-3.1-flash-lite')return unavailable('gemini-3.1-flash-lite');
  throw new Error(`Unexpected Gemini fallback model ${request.config.model}`);
}};
const context={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,
  document:{scripts:[],head:{append:()=>{}},createElement:()=>({addEventListener:()=>{}})},location:{href:'https://civweave-staging.pages.dev/app/realm-console-v140.html'},
  addEventListener:()=>{},dispatchEvent:()=>{},CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},queueMicrotask:fn=>fn(),setInterval:()=>1,clearInterval:()=>{},setTimeout:fn=>{fn();return 1},
  CivweaveUnifiedChatSystemV1:{registerCapability:(system,handler)=>{assert.equal(system,'cerbanimo');registeredHandler=handler}},
  CivweaveAssistantV141:{selectedConfig:()=>({provider:'gemini',route:'gemini',model:'gemini-3.7-flash',maxTokens:1600,temperature:.2})},
  CivweaveFamilyAILoaderV105:{ensure:async()=>true},
  CivweaveFastInteractiveV192:{base:()=>base},
  CivweaveModelRuntime:{generate:async request=>{
    assert.equal(request.purpose,'cerbanimo-endeavor-authoring-v2');assert.equal(request.responseFormat,'json');assert.equal(request.schema?.type,'object');assert.equal(request.task.systemId,'cerbanimo');
    if(request.config?.provider==='cloudflare-workers-ai'){
      calls.push('cloudflare-workers-ai');
      assert.equal(request.config.model,'@cf/zai-org/glm-4.7-flash');
      return{status:'invalid-response',actual:{provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'},requested:{provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'},recoverablePayload:recoverable,structured:{requested:true,valid:false,errors:['$.workUnits is required.']},error:{code:'INVALID_STRUCTURED_OUTPUT',message:'The strict transport schema rejected compatible aliases.'}};
    }
    calls.push('routed-3.7');return quota('gemini-3.7-flash');
  }},
  CivweaveCerbanimoQuestV144:{
    createQuestFromInput:input=>({id:'quest-community-garden',...input,tasks:input.steps.map((step,index)=>({id:`task-${index+1}`,title:step.split(':')[0],description:step,acceptanceCriteria:[input.proofRequirements[index]],proofRequired:true}))}),
    addQuest:(quest,options)=>{added={quest,options};return{ok:true,quest}}
  }
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:capabilityPath});
assert.equal(typeof registeredHandler,'function','Kamiya Endeavor v2 did not register with unified chat.');
assert.equal(context.CivweaveCerbanimoChatQuestCapabilityV2.questIntent('Help me build a community garden'),true,'Community garden build request was not recognized as Endeavor intent.');
assert.equal(context.CivweaveCerbanimoChatQuestCapabilityV2.geminiTransientFailure(unavailable('gemini-3.1-flash-lite'),{provider:'gemini'}),true,'Gemini HTTP 503/UNAVAILABLE is not classified as transient.');
const response=await registeredHandler({systemId:'cerbanimo',text:'Help me build a community garden',history:[]},async()=>({response:{answer:'GENERIC CHAT FALLTHROUGH'}}));
assert(added,'Cloudflare recoverable JSON did not create an Endeavor after Gemini capacity exhaustion.');
assert.equal(added.options.activate,true,'Generated Endeavor was not activated.');
assert.equal(added.quest.source,'kamiya-chat-ai-quest','Generated Endeavor has the wrong source authority.');
assert.equal(added.quest.tasks.length,5,'Generated Endeavor did not preserve its work units.');
assert.equal(added.quest.authoring.provider,'cloudflare-workers-ai','Endeavor did not preserve the actual cross-provider fallback provider.');
assert.equal(added.quest.authoring.model,'@cf/zai-org/glm-4.7-flash','Endeavor did not preserve the successful Cloudflare fallback model.');
assert.equal(added.quest.authoring.providerFailover?.success,true,'Endeavor did not record the successful Gemini → Cloudflare failover.');
assert.equal(added.quest.authoring.repaired,false,'Compatible recoverable aliases should not require an extra model call.');
assert.deepEqual(calls,['routed-3.7','gemini-3.5-flash','gemini-3.1-flash-lite','cloudflare-workers-ai'],'Transient failover did not run 3.7 → 3.5 → Flash-Lite → Cloudflare.');
for(let index=0;index<added.quest.tasks.length;index+=1){
  const task=added.quest.tasks[index],unit=recoverable.tasks[index];
  assert.equal(task.acceptanceCriteria[0],unit.doneWhen,`Work unit ${index+1} lost its completion criterion.`);
  assert(added.quest.proofRequirements[index].includes(unit.evidence),`Work unit ${index+1} lost its proof requirement.`);
}
assert.match(response.response.answer,/Endeavor created:/,'Kamiya did not report the created Endeavor.');
assert.match(response.response.answer,/3\.7-flash.*3\.5-flash.*3\.1-flash-lite/,'Kamiya did not expose the Gemini model failover route.');
assert.match(response.response.answer,/Provider failover: Gemini → Cloudflare Workers AI/,'Kamiya did not expose the cross-provider failover.');
assert.doesNotMatch(response.response.answer,/HTTP 503|UNAVAILABLE|GENERIC CHAT FALLTHROUGH/,'The transient Gemini outage leaked to the Hero after successful fallback.');
assert.equal(response.provider,'cloudflare-workers-ai','Visible response does not identify the provider that actually created the Endeavor.');
assert.equal(response.model,'@cf/zai-org/glm-4.7-flash','Visible response does not identify the model that actually created the Endeavor.');
assert.equal(response.response.choice.system,'cerbanimo','Kamiya response left the Cerbanimo system.');
assert.equal(response.action.kind,'cerbanimo-quest-created','Kamiya response did not expose the canonical Endeavor action.');
console.log('PASS Kamiya treats Gemini 503/high-demand as transient, exhausts the bounded Gemini chain, falls through once to Cloudflare Workers AI, accepts recoverable JSON aliases, and activates the Endeavor without leaking the outage.');
