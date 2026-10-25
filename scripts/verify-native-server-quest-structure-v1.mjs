#!/usr/bin/env node
// Real canonical Quest schema generation, not a fake model or generic chat.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile('public/extensions/civweave-weaveling-plan-json-v190.js','utf8');
const wish='Create a reviewable cross-realm Quest with two required paths: Living School for mastering and memorizing tarot, followed by Cerbanimo for designing, developing, and testing my own tarot application. Include dependencies and completion evidence for both. Do not activate the Quest.';
const storage=new Map(),localStorage={
  getItem:key=>storage.get(key)||null,
  setItem:(key,value)=>storage.set(key,String(value)),
  removeItem:key=>storage.delete(key)
};
let request=null,saves=0,saved=null,materialized=0;
let payload={title:'Master tarot and build a tarot app',wish,outcome:'Read tarot confidently and run the app',
  assumptions:['Access to a phone for development and testing.'],
  paths:[
    {type:'learning',realm:'living-school',title:'Learn tarot',purpose:'Understand and memorize the deck',
      steps:['Study major arcana','Practice minor arcana readings'],completionCriteria:'Perform a complete documented reading.',
      evidence:['Reading journal']},
    {type:'skilled-labor',realm:'cerbanimo',title:'Build the app',purpose:'Make a functional tarot learning and reading app',
      steps:['Design the cards and study interface','Implement flashcards and spreads','Test the mobile app'],completionCriteria:'The tarot app passes functional tests.',
      evidence:['App build','Test report']}
  ]};
const ctx={console,Date,Math,Promise,localStorage,structuredClone,queueMicrotask:fn=>fn(),
  CivweaveIntentionPlanner:{
    persist(plan){saves++;saved=plan;return{id:plan.id,plan}},
    activeIntentionTurns:()=>[],format:plan=>plan.title
  },
  CivweaveWeavelingPlanMaterializationV265:{materialize:plan=>{materialized++;return plan;}},
  CivweaveModelRuntime:{generate:async input=>{
    request=input;
    return{status:'success',actual:{provider:'openai-compatible',model:'qwen35-4b-native'},
      structured:{valid:true},outputJson:payload};
  }}
};
ctx.globalThis=ctx;
vm.runInNewContext(source,ctx,{filename:'civweave-weaveling-plan-json-v190.js'});
const api=ctx.CivweaveWeavelingPlanJsonV190;
const config=()=>({provider:'openai-compatible',route:'openai-compatible',model:'qwen35-4b-native',
  endpoint:'http://127.0.0.1:8080/v1'});
const opts={selectedConfig:config,context:async()=>({currentContext:{systemId:'civweave'},routingAnswer:{room:'civweave.quad'}})};
const result=await api.createModelPlan({text:wish,history:[]},opts);
assert.equal(result.plan?.state,'review','Review-only Quest was not preserved.');
assert.deepEqual(Array.from(result.plan.paths,p=>p.realm),['living-school','cerbanimo']);
assert.equal(saves,1,'A complete AI-authored Quest was not persisted once.');
assert.equal(materialized,1,'The canonical Quest review/materialization owner was skipped.');
assert.equal(request?.schema?.properties?.paths?.minItems,2);
assert.equal(request?.schema?.properties?.paths?.maxItems,2);
assert.deepEqual(Array.from(request.context.workingMemory.structuralConstraints.requiredRealms),['living-school','cerbanimo']);
assert.equal(request?.config?.stream,true,'Local Quest authoring did not enable progress streaming.');
assert.equal(request?.config?.timeoutMs,900000,'Quest was routed through the ordinary 150-second deadline.');
assert.ok(request?.config?.maxTokens<=1200,'Local Quest request is unbounded for an 8GB Moto.');
assert.ok(request.messages[0].content.length<1000,'Native model prompt regressed into a large multi-system prefill.');
assert.equal(request.purpose,'civweave-weaveling-intention-json-v190');

// Even a syntactically valid model response may never erase the build stage.
payload={...payload,paths:payload.paths.slice(0,1)};
await assert.rejects(api.createModelPlan({text:wish,history:[]},opts),/required cerbanimo|requires 2 paths|missing/i);
assert.equal(saves,1,'An incomplete two-path Quest was persisted.');

console.log('PASS native Quest schema requires tarot learning + Cerbanimo app construction, preserves REVIEW, bounds prompt and generation, rejects missing production.');
