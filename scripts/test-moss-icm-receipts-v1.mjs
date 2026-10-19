import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script=readFileSync(new URL('../public/app/unified-chat-system-v1.js',import.meta.url),'utf8');
const KEY='civweave.chat.capability.pending.living-school.plan.v1';
const QUEUE='civweave.chat.capability.pending.living-school.curriculum.v1';
const output={
  title:'Tarot Foundations',capability:'read tarot',level:'beginner',mode:'guided',
  proof:'Explain a three-card reading',
  modules:[
    {title:'Structure',focus:'Understand the deck',outcome:'Identify suits'},
    {title:'Symbols',focus:'Build mnemonic anchors',outcome:'Recall major cards'},
    {title:'Practice',focus:'Review spaced examples',outcome:'Demonstrate a reading'}
  ],assumptions:[]
};
function harness(){
  const storage=new Map(),state={school:null,sources:[],research:null};
  const sandbox={
    console,URL,URLSearchParams,Date,Math,JSON,Object,Array,String,Number,Boolean,
    RegExp,Promise,Set,Map,queueMicrotask,addEventListener:()=>{},removeEventListener:()=>{},
    dispatchEvent:()=>true,CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
    localStorage:{
      getItem:key=>storage.has(key)?storage.get(key):null,
      setItem:(key,value)=>storage.set(key,String(value)),
      removeItem:key=>storage.delete(key)
    },
    document:{
      readyState:'loading',documentElement:{dataset:{}},getElementById:()=>null,
      scripts:[],head:{append:()=>{}},querySelectorAll:()=>[]
    },
    CivweaveAssistantV141:{selectedConfig:()=>({provider:'downloaded-local',model:'gemma4-e4b-it-litert-web',maxTokens:1200})},
    CivweaveFamilyAILoaderV105:{ensure:async()=>true},
    CivweaveModelRuntime:{generate:async()=>({status:'success',outputJson:output,actual:{provider:'downloaded-local',model:'gemma4-e4b-it-litert-web'}})}
  };
  sandbox.globalThis=sandbox;
  vm.runInNewContext(script,sandbox,{filename:'unified-chat-system-v1.js'});
  const api=sandbox.CivweaveUnifiedChatSystemV1;
  const read=()=>JSON.parse(storage.get(KEY)||'null');
  const installEngine=(behavior='success')=>{
    let calls=0;
    sandbox.LivingSchoolCleanroomV218={
      getState:()=>state,
      generateCurriculumFromChat:async request=>{
        calls++;
        request.onWorkflowStage?.('researching',{});
        state.sources=[{id:'source-1'}];
        state.research={mode:'local-downloaded',sourceCount:1};
        request.onWorkflowStage?.('generating',{researchMode:'local-downloaded'});
        if(behavior==='throw')throw new Error('Simulated model contract failure');
        const school={id:'school-tarot-1',title:request.title,capability:request.capability,modules:[{id:'module-1',title:'Foundations'},{id:'module-2',title:'Practice'}],generation:{provider:'downloaded-local',model:'gemma4-e4b-it-litert-web',fallback:false}};
        if(behavior!=='unsaved')state.school=school;
        request.onWorkflowStage?.('complete',{schoolId:school.id});
        return{school,sourceCount:state.sources.length,generationRecovery:{status:'complete'}};
      }
    };
    return()=>calls;
  };
  return{api,sandbox,read,storage,state,installEngine};
}
async function makePlan(h){
  const result=await h.api.generateLivingSchoolPlan({text:'I want to learn to read tarot',history:[]});
  assert.ok(result.response.answer.includes('Tarot Foundations'));
  const plan=h.read();
  assert.equal(plan.state,'review');
  assert.equal(plan.workflow.schema,'civweave.learning-journey-workflow.v1');
  assert.equal(plan.workflow.stages.intake.status,'complete');
  assert.equal(plan.workflow.stages.design.status,'review');
  return plan;
}
test('new Moss review plan records inert stage receipts without starting curriculum',async()=>{
  const h=harness(),plan=await makePlan(h);
  assert.equal(h.state.school,null);
  assert.equal(plan.workflow.stages.research.status,'not-started');
  assert.equal(plan.approvedAt,null);
});
test('approval records stage progress, validates canonical persistence, and is idempotent',async()=>{
  const h=harness(),plan=await makePlan(h),calls=h.installEngine();
  const response=await h.api.approveLivingSchoolPlan(plan);
  assert.equal(response.action.state,'completed');
  assert.equal(calls(),1);
  const current=h.read();
  assert.equal(current.state,'completed');
  assert.equal(current.materialized.schoolId,'school-tarot-1');
  for(const stage of ['intake','research','design','compile','validate','materialize']){
    assert.equal(current.workflow.stages[stage].status,'complete',stage);
  }
  assert.equal(current.workflow.stages.research.sourceCount,1);
  assert.equal(current.workflow.stages.compile.model,'gemma4-e4b-it-litert-web');
  assert.equal(h.storage.has(QUEUE),false);
  const repeat=await h.api.approveLivingSchoolPlan(current);
  assert.equal(calls(),1,'completed approval must not regenerate a second time');
  assert.match(repeat.response.answer,/COMPLETED/);
});
test('failed generation retains approved review and an actionable failed stage',async()=>{
  const h=harness(),plan=await makePlan(h);
  h.installEngine('throw');
  const result=await h.api.approveLivingSchoolPlan(plan);
  assert.equal(result.action.state,'failed');
  const current=h.read();
  assert.equal(current.state,'failed');
  assert.ok(current.approvedAt);
  assert.equal(current.workflow.stages.compile.status,'failed');
  assert.match(current.lastFailure.message,/Simulated model contract failure/);
  assert.equal(h.state.school,null);
});
test('false success is rejected if canonical saved state is missing',async()=>{
  const h=harness(),plan=await makePlan(h);
  h.installEngine('unsaved');
  const result=await h.api.approveLivingSchoolPlan(plan);
  assert.equal(result.action.state,'failed');
  assert.match(result.response.answer,/could not be verified/i);
  assert.equal(h.read().workflow.stages.materialize.status,'not-started');
});
test('approved queue retains plan and resumes without a second user approval',async()=>{
  const h=harness(),plan=await makePlan(h);
  const result=await h.api.approveLivingSchoolPlan(plan);
  assert.equal(result.action.state,'queued');
  assert.equal(h.read().state,'queued');
  assert.equal(JSON.parse(h.storage.get(QUEUE)).approvedPlanId,plan.id);
  const calls=h.installEngine();
  h.api.synchronize();
  for(let i=0;i<15&&h.read()?.state!=='completed';i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls(),1);
  assert.equal(h.read().state,'completed');
  assert.equal(h.storage.has(QUEUE),false);
});
