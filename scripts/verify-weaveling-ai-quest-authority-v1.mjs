#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';

const root=resolve(new URL('..',import.meta.url).pathname);
const file=relative=>readFileSync(resolve(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const includes=(text,needle,label)=>assert(text.includes(needle),`${label} is missing ${needle}`);
const syntax=relative=>{const result=spawnSync(process.execPath,['--check',resolve(root,relative)],{encoding:'utf8'});assert(result.status===0,`${relative} failed node --check:\n${result.stderr||result.stdout}`)};

for(const path of [
  'public/app/weaveling-plan-materialization-v265.js',
  'public/service-worker-local-ai-coherence-v307.js',
  'public/service-worker-v203.js',
  'public/service-worker.js',
  'public/service-worker-v156.js'
])syntax(path);

const campus=file('public/app/working-campus-v156.part5.txt');
includes(campus,"WEAVELING_ORCHESTRATOR_VERSION='1.2.0-weaveling-plan-json-v190-ai-quest-intent'",'Working Campus');
includes(campus,"WEAVELING_ORCHESTRATOR_SRC='/extensions/civweave-weaveling-plan-json-v190.js?v=1.2.0-ai-quest-intent'",'Working Campus');
includes(campus,'function aiQuestResult(result)', 'Working Campus');
includes(campus,"result?.questAuthoring?.aiGenerated===true",'Working Campus');
includes(campus,"result?.plan?.authoring?.aiGenerated===true",'Working Campus');
includes(campus,"result?.plan?.authoring?.mode==='model-structured-json'",'Working Campus');
assert(!campus.includes("civweave-weaveling-plan-json-v190.js?v=1.0.7-v190"),'Working Campus still loads the legacy Quest orchestrator revision.');
assert(!/function syncPlanResult\(result\)\{if\(!result\?\.plan\)return;/.test(campus),'Working Campus still blindly accepts any result.plan.');

const materialization=file('public/app/weaveling-plan-materialization-v265.js');
includes(materialization,'1.1.0-weaveling-plan-materialization-v265-ai-only','Quest materializer');
includes(materialization,'function aiAuthoredPlan(plan)','Quest materializer');
includes(materialization,"authoring?.aiGenerated===true",'Quest materializer');
includes(materialization,"authoring?.mode==='model-structured-json'",'Quest materializer');
includes(materialization,"QUEST_AI_AUTHORING_REQUIRED",'Quest materializer');
includes(materialization,"const maybeCreate=options=>",'Quest materializer');
includes(materialization,"return null",'Quest materializer');
includes(materialization,'sanitizeAssistantResult','Quest materializer');
includes(materialization,'deterministicQuestCreation:false','Quest materializer');
assert(!materialization.includes('materialize(result.plan,{source:\'weaveling-shared-chat-v265\'})'),'Deterministic maybeCreate materialization wrapper is still present.');
assert(!materialization.includes('I generated and saved the reviewable Quest “${clean(result.plan.title'),'Old deterministic Quest-generated claim is still present.');

const sandbox={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,
  localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  location:{pathname:'/app/working-campus-v156.html'},
  document:{readyState:'loading',documentElement:{dataset:{}},getElementById:()=>null,querySelector:()=>null,head:{append:()=>{}}},
  addEventListener:()=>{},dispatchEvent:()=>{},CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},
  setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},structuredClone:value=>JSON.parse(JSON.stringify(value))
};
sandbox.globalThis=sandbox;
vm.runInNewContext(materialization,sandbox,{filename:'weaveling-plan-materialization-v265.js'});
const guard=sandbox.CivweaveWeavelingPlanMaterializationV265;
assert(guard?.aiQuestOnly===true,'AI-only Quest materializer did not initialize.');
const deterministicPlan={id:'det-1',title:'Auto Quest',wish:'Make something',authoring:{mode:'deterministic-fallback',aiGenerated:false,provider:'deterministic'}};
const aiPlan={id:'ai-1',title:'AI Quest',wish:'Make something',authoring:{mode:'model-structured-json',aiGenerated:true,provider:'downloaded-local',model:'gemma4-e2b-it-q4f16'}};
assert(guard.aiAuthoredPlan(deterministicPlan)===false,'Deterministic Quest passed AI provenance check.');
assert(guard.aiAuthoredPlan(aiPlan)===true,'Valid AI-authored Quest failed provenance check.');
const leaked=guard.sanitizeAssistantResult({provider:'server-auto-unavailable',plan:deterministicPlan,planItemId:'det-1',response:{answer:'Weaveling could not reach an available Guild or Cloudflare AI service for this request. Civweave did not substitute a deterministic answer.'}});
assert(leaked.plan===null&&leaked.planItemId===null,'Cloud failure retained a leaked deterministic Quest.');
assert(leaked.questAuthoring?.questCreated===false,'Cloud failure did not expose no-Quest provenance.');
const accepted=guard.sanitizeAssistantResult({provider:'downloaded-local',model:'gemma4-e2b-it-q4f16',plan:aiPlan,questAuthoring:{aiGenerated:true},response:{answer:'AI Quest ready'}});
assert(accepted.plan===aiPlan,'AI-authored Quest was incorrectly stripped.');

let persisted=0,restored=0,legacyMaybeCalls=0;
sandbox.CivweaveIntentionPlanner={
  shouldCreate:()=>true,
  persist:plan=>{persisted++;return{id:plan.id,plan}},
  restore:plan=>{restored++;return{id:plan.id,plan}},
  maybeCreate:()=>{legacyMaybeCalls++;return{plan:deterministicPlan}}
};
assert(guard.patchPlanner(sandbox.CivweaveIntentionPlanner)===true,'Planner AI-authority patch did not install.');
assert(sandbox.CivweaveIntentionPlanner.maybeCreate({text:'I want to make a garden'})===null,'Deterministic maybeCreate still returned a Quest.');
assert(legacyMaybeCalls===0,'Retired deterministic maybeCreate implementation was still invoked.');
let blocked=false;try{sandbox.CivweaveIntentionPlanner.persist(deterministicPlan)}catch(error){blocked=error?.code==='QUEST_AI_AUTHORING_REQUIRED'}
assert(blocked===true&&persisted===0,'Deterministic Quest persistence was not blocked.');
sandbox.CivweaveIntentionPlanner.persist(aiPlan);
assert(persisted===1,'AI-authored Quest could not use canonical persistence.');
assert(sandbox.CivweaveIntentionPlanner.restore(deterministicPlan)===null&&restored===0,'Deterministic Quest restore created a ledger record.');
sandbox.CivweaveIntentionPlanner.restore(aiPlan);
assert(restored===1,'AI-authored Quest restore was incorrectly blocked.');

const coherence=file('public/service-worker-local-ai-coherence-v307.js');
includes(coherence,"local-ai-code-v321-ai-quest-authority",'Local AI coherence worker');
for(const path of [
  '/app/weaveling-plan-materialization-v265.js',
  '/extensions/civweave-weaveling-plan-json-v190.js',
  '/app/working-campus-v156.part5.txt',
  '/app/guide-forward-failure-hardening-v1.js'
])includes(coherence,`'${path}'`,'Local AI coherence worker');
includes(coherence,'if (CW_LOCAL_AI_EXTRA_PATHS.has(url.pathname)) return true;','Local AI coherence worker');
const sw203=file('public/service-worker-v203.js');
includes(sw203,'local-ai-code-v321-ai-quest-authority','v203 service worker');
const rootWorker=file('public/service-worker.js');
includes(rootWorker,'root-worker-bridge-v9-ai-quest-authority','root service worker');
includes(rootWorker,"'/app/weaveling-plan-materialization-v265.js'",'root service worker');
includes(rootWorker,"'/extensions/civweave-weaveling-plan-json-v190.js'",'root service worker');
const legacyWorker=file('public/service-worker-v156.js');
includes(legacyWorker,'legacy-v156-bridge-v210-ai-quest-authority','legacy service worker bridge');

console.log('PASS failed/non-AI routes cannot create, persist, materialize, restore, or synchronize a Quest; valid structured AI Quests remain allowed.');
