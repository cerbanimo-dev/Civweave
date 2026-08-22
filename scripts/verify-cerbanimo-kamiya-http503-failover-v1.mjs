#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';

const root=resolve(new URL('..',import.meta.url).pathname);
const source=fs.readFileSync(resolve(root,'public/app/cerbanimo-chat-quest-capability-v2.js'),'utf8');
let handler=null,added=null;
const calls=[];
const plan={
  title:'Build a Community Garden',
  objective:'Create a functioning neighborhood community garden.',
  description:'Secure the site, organize participants, build the garden, and establish ongoing care.',
  workUnits:[
    {title:'Define the garden brief',result:'A shared brief exists.',proof:'Attach the brief.',acceptanceCriteria:'Purpose, users, and site needs are explicit.'},
    {title:'Secure a site',result:'A viable site is approved.',proof:'Attach permission and site notes.',acceptanceCriteria:'Permission, sun, access, and water are documented.'},
    {title:'Organize the core team',result:'Operating roles have owners.',proof:'Attach the roster.',acceptanceCriteria:'Core responsibilities have named owners.'},
    {title:'Design and resource the build',result:'A buildable layout and resource list exist.',proof:'Attach the layout and materials list.',acceptanceCriteria:'Beds, paths, water, accessibility, tools, soil, and budget are covered.'},
    {title:'Build and launch',result:'Beds are planted and maintenance is assigned.',proof:'Attach launch photos and schedule.',acceptanceCriteria:'A visible planted result and ongoing caretakers exist.'}
  ],
  assumptions:['Neighborhood-scale garden.']
};
const quota=model=>({status:'provider-error',actual:{provider:'gemini',model},requested:{provider:'gemini',model},error:{status:429,message:`Gemini returned HTTP 429: quota exceeded for ${model}`}});
const highDemandError=()=>{const error=new Error('Gemini returned HTTP 503: This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later. UNAVAILABLE');error.status=503;return error};
const base={generate:async request=>{
  calls.push(request.config.model);
  if(request.config.model==='gemini-3.5-flash')return quota('gemini-3.5-flash');
  if(request.config.model==='gemini-3.1-flash-lite')throw highDemandError();
  throw new Error(`Unexpected Gemini model ${request.config.model}`);
}};
const context={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,
  document:{scripts:[],head:{append:()=>{}},createElement:()=>({addEventListener:()=>{}})},location:{href:'https://civweave-staging.pages.dev/app/realm-console-v140.html'},
  addEventListener:()=>{},dispatchEvent:()=>{},CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},queueMicrotask:fn=>fn(),setInterval:()=>1,clearInterval:()=>{},setTimeout:fn=>{fn();return 1},
  CivweaveUnifiedChatSystemV1:{registerCapability:(system,fn)=>{assert.equal(system,'cerbanimo');handler=fn}},
  CivweaveAssistantV141:{selectedConfig:()=>({provider:'gemini',route:'gemini',model:'gemini-3.7-flash',maxTokens:1600,temperature:.2})},
  CivweaveFamilyAILoaderV105:{ensure:async()=>true},
  CivweaveFastInteractiveV192:{base:()=>base},
  CivweaveModelRuntime:{generate:async request=>{
    if(request.config?.provider==='cloudflare-workers-ai'){
      calls.push('cloudflare-workers-ai');
      return{status:'success',actual:{provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'},requested:{provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'},outputJson:plan,structured:{requested:true,valid:true}};
    }
    calls.push('routed-3.7');return quota('gemini-3.7-flash');
  }},
  CivweaveCerbanimoQuestV144:{
    createQuestFromInput:input=>({id:'quest-community-garden',...input,tasks:input.steps.map((step,index)=>({id:`task-${index+1}`,title:step.split(':')[0],acceptanceCriteria:[input.proofRequirements[index]],proofRequired:true}))}),
    addQuest:(quest,options)=>{added={quest,options};return{ok:true,quest}}
  }
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'cerbanimo-chat-quest-capability-v2.js'});
assert.equal(typeof handler,'function','Kamiya capability did not register.');
const thrown=context.CivweaveCerbanimoChatQuestCapabilityV2.providerErrorResult(highDemandError(),{provider:'gemini',route:'gemini',model:'gemini-3.1-flash-lite'});
assert.equal(thrown.error.status,503,'Thrown HTTP 503 did not normalize to a provider result.');
assert.equal(context.CivweaveCerbanimoChatQuestCapabilityV2.geminiTransientFailure(thrown,{provider:'gemini'}),true,'Thrown Gemini 503 was not classified as transient.');
const response=await handler({systemId:'cerbanimo',text:'Help me build a community garden',history:[]},async()=>({response:{answer:'GENERIC'}}));
assert(added,'Endeavor was not created after thrown Gemini 503.');
assert.deepEqual(calls,['routed-3.7','gemini-3.5-flash','gemini-3.1-flash-lite','cloudflare-workers-ai'],'Thrown 503 bypassed the bounded provider failover route.');
assert.equal(response.provider,'cloudflare-workers-ai','Successful fallback provider is not visible.');
assert.equal(response.model,'@cf/zai-org/glm-4.7-flash','Successful fallback model is not visible.');
assert.match(response.response.answer,/Endeavor created:/,'Kamiya did not report the created Endeavor.');
assert.match(response.response.answer,/Provider failover: Gemini → Cloudflare Workers AI/,'Cross-provider failover was not disclosed.');
assert.doesNotMatch(response.response.answer,/HTTP 503|UNAVAILABLE|GENERIC/,'Transient outage leaked after successful fallback.');
console.log('PASS thrown Gemini HTTP 503/high-demand is normalized, the bounded Gemini chain exhausts, Cloudflare Workers AI takes over once, and Kamiya activates the Endeavor.');
