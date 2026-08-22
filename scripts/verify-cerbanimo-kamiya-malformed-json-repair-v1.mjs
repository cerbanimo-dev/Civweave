#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const root=resolve(new URL('..',import.meta.url).pathname);
const capabilityPath='public/app/cerbanimo-chat-quest-capability-v2.js';
const source=fs.readFileSync(resolve(root,capabilityPath),'utf8');
const syntax=spawnSync(process.execPath,['--check',resolve(root,capabilityPath)],{encoding:'utf8'});
assert.equal(syntax.status,0,syntax.stderr||syntax.stdout);

const plan={
  title:'Build a Community Garden',
  objective:'Create a functioning neighborhood community garden.',
  description:'Secure a site, organize neighbors, prepare the garden, and launch a maintenance routine.',
  workUnits:[
    {title:'Define the brief',result:'A concise garden brief exists.',proof:'Attach the brief.',acceptanceCriteria:'Purpose, users, and site needs are explicit.'},
    {title:'Secure the site',result:'A viable site is approved.',proof:'Attach permission and site notes.',acceptanceCriteria:'Permission, sunlight, access, and water are documented.'},
    {title:'Form the team',result:'Core operating roles have owners.',proof:'Attach the roster.',acceptanceCriteria:'Core responsibilities have named owners.'},
    {title:'Design the build',result:'A buildable layout and resource list exist.',proof:'Attach the layout and materials list.',acceptanceCriteria:'Beds, paths, water, soil, tools, and accessibility are covered.'},
    {title:'Launch the garden',result:'Beds are planted and maintenance is assigned.',proof:'Attach launch photos and the maintenance schedule.',acceptanceCriteria:'The garden has a visible planted result and ongoing caretakers.'}
  ],
  assumptions:['Neighborhood-scale garden.']
};
const malformed='{"title":"Build a Community Garden","objective":"Create a neighborhood garden","description":"Secure land and organize neighbors","workUnits":[{"title":"Define the brief","result":"A shared brief exists","proof":"Attach the brief","acceptanceCriteria":"Purpose is explicit"},{"title":"Secure the site","result":"Permission is';
let registeredHandler=null,added=null;const calls=[];
const context={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,
  document:{scripts:[],head:{append:()=>{}},createElement:()=>({addEventListener:()=>{}})},location:{href:'https://civweave-staging.pages.dev/app/realm-console-v140.html'},
  addEventListener:()=>{},dispatchEvent:()=>{},CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},queueMicrotask:fn=>fn(),setInterval:()=>1,clearInterval:()=>{},setTimeout:fn=>{fn();return 1},
  CivweaveUnifiedChatSystemV1:{registerCapability:(system,handler)=>{assert.equal(system,'cerbanimo');registeredHandler=handler}},
  CivweaveAssistantV141:{selectedConfig:()=>({provider:'gemini',route:'gemini',model:'gemini-3.1-flash-lite',maxTokens:1200,temperature:.2})},
  CivweaveFamilyAILoaderV105:{ensure:async()=>true},
  CivweaveFastInteractiveV192:{base:()=>({generate:async request=>{
    calls.push({kind:'repair',request});
    assert.equal(request.purpose,'cerbanimo-endeavor-authoring-repair-v2');
    assert.equal(request.config.model,'gemini-3.1-flash-lite');
    assert(request.config.maxTokens>=2400,'Malformed-JSON repair did not raise the output budget.');
    const joined=request.messages.map(message=>message.content).join('\n');
    assert.match(joined,/Regenerate .* from scratch/i,'Malformed JSON was not routed through clean regeneration.');
    assert.match(joined,/previous output was discarded/i,'Repair prompt did not explicitly discard the broken fragment.');
    assert.doesNotMatch(joined,/"result":"Permission is$/,'Repair prompt copied the dangling JSON fragment.');
    return{status:'success',actual:{provider:'gemini',model:'gemini-3.1-flash-lite'},requested:{provider:'gemini',model:'gemini-3.1-flash-lite'},outputJson:plan,outputText:JSON.stringify(plan),structured:{requested:true,valid:true,errors:[]}};
  }})},
  CivweaveModelRuntime:{generate:async request=>{
    calls.push({kind:'initial',request});
    assert.equal(request.purpose,'cerbanimo-endeavor-authoring-v2');
    assert(request.config.maxTokens>=2200,'Initial Endeavor request did not reserve enough structured-output budget.');
    return{status:'invalid-response',actual:{provider:'gemini',model:'gemini-3.1-flash-lite'},requested:{provider:'gemini',model:'gemini-3.1-flash-lite'},outputText:malformed,structured:{requested:true,valid:false,errors:['The structured Gemini response was not valid JSON: Unterminated string in JSON at position 292 (line 11 column 12)']},error:{code:'INVALID_STRUCTURED_OUTPUT',message:'The structured Gemini response was not valid JSON: Unterminated string in JSON at position 292 (line 11 column 12)'}};
  }},
  CivweaveCerbanimoQuestV144:{
    createQuestFromInput:input=>({id:'quest-community-garden',...input,tasks:input.steps.map((step,index)=>({id:`task-${index+1}`,title:step.split(':')[0],description:step,acceptanceCriteria:[input.proofRequirements[index]],proofRequired:true}))}),
    addQuest:(quest,options)=>{added={quest,options};return{ok:true,quest}}
  }
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:capabilityPath});
assert.equal(typeof registeredHandler,'function','Kamiya Endeavor capability did not register.');
assert.equal(context.CivweaveCerbanimoChatQuestCapabilityV2.malformedJsonResult({status:'invalid-response',outputText:malformed,structured:{errors:['The structured Gemini response was not valid JSON: Unterminated string in JSON at position 292']} }),true,'Unterminated Gemini JSON was not classified as recoverable malformed JSON.');
const response=await registeredHandler({systemId:'cerbanimo',text:'Help me build a community garden',history:[]},async()=>({response:{answer:'GENERIC CHAT FALLTHROUGH'}}));
assert.equal(calls.length,2,'Malformed JSON recovery should use one initial call and one bounded repair call.');
assert.equal(calls[0].kind,'initial');
assert.equal(calls[1].kind,'repair');
assert(added,'Malformed Gemini JSON did not recover into an Endeavor.');
assert.equal(added.options.activate,true,'Recovered Endeavor was not activated.');
assert.equal(added.quest.tasks.length,5,'Recovered Endeavor lost work units.');
assert.equal(added.quest.authoring.repaired,true,'Recovered Endeavor did not record the bounded repair.');
assert.equal(added.quest.authoring.repairReason,'malformed-json','Recovered Endeavor did not record malformed-JSON repair provenance.');
assert.match(response.response.answer,/Endeavor created:/,'Kamiya did not report the recovered Endeavor.');
assert.match(response.response.answer,/truncated JSON regenerated once before validation/,'Visible response did not report bounded malformed-JSON recovery.');
assert.doesNotMatch(response.response.answer,/Unterminated string|not valid JSON|GENERIC CHAT FALLTHROUGH/,'Malformed provider JSON leaked to the Hero after successful repair.');
console.log('PASS Kamiya treats retained invalid-response text as recoverable, discards a truncated Gemini fragment, regenerates one compact JSON object with a larger token budget, validates it, and activates the Endeavor.');