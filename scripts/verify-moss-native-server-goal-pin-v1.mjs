#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const authority=readFileSync('public/app/selected-provider-authority-v1.js','utf8');
const unified=readFileSync('public/app/unified-chat-system-v1.js','utf8');
const storageData=new Map();
const storage={getItem:key=>storageData.get(key)||null,setItem:(key,value)=>storageData.set(key,value),removeItem:key=>storageData.delete(key)};
const selected={provider:'openai-compatible',route:'openai-compatible',model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1'};
let cloudCalls=0,actualProvider='openai-compatible',lastRequest=null;
const progress=[];
const goodPlan={title:'Tarot Foundations',capability:'read and memorize the tarot',level:'beginner',mode:'guided',proof:'Interpret a three-card reading independently',modules:[{title:'Tarot Structure',focus:'Tarot decks and major arcana',outcome:'Recognize key cards'},{title:'Tarot Memory',focus:'Memorize tarot card meanings',outcome:'Recall card meanings'},{title:'Tarot Reading',focus:'Practice three-card tarot readings',outcome:'Interpret spreads'}],assumptions:[]};
const badPlan={title:'Manifestation Web App',capability:'manifestation and build a web app',level:'beginner',mode:'guided',proof:'Publish app',modules:[{title:'Manifestation',focus:'Visualize web app',outcome:'Describe goal'},{title:'Architect',focus:'Build app',outcome:'Write spec'},{title:'Publish',focus:'Deploy app',outcome:'Publish app'}],assumptions:[]};
let planContent=goodPlan;
const context={
  console,JSON,Date,Math,Object,Array,String,Number,Boolean,RegExp,Promise,Set,Map,URL,
  localStorage:storage,sessionStorage:storage,
  document:{readyState:'loading',documentElement:{dataset:{}}},
  addEventListener(){},dispatchEvent(event){if(event.type==='civweave:moss-learning-plan-progress')progress.push(event.detail);return true},queueMicrotask:fn=>fn(),setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  CivweaveSettingsV320:{readState:()=>selected},
  CivweaveFamilyAILoaderV105:{ensure:async()=>true},
  LivingSchoolCleanroomV218:{getState:()=>({})},
  CivweaveAssistantV141:{respond:async()=>({}),selectedConfig:()=>({provider:'server-auto',model:'old'})},
  CivweaveModelRuntime:{
    readSharedConfig:()=>({provider:'server-auto',model:'old'}),
    generate:async req=>{lastRequest=req;return{status:'success',actual:{provider:actualProvider,model:actualProvider==='openai-compatible'?selected.model:'@cf/zai-org/glm-4.7-flash'},outputJson:planContent}}
  },
  CivweaveServerAIRouterV301:{handle:async()=>{cloudCalls++;return{status:'success'}}}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(authority,context,{filename:'selected-provider-authority-v1.js'});
assert.equal(context.CivweaveSelectedProviderAuthorityV1.authority().kind,'local-api');
const requested=context.CivweaveSelectedProviderAuthorityV1.enforceConfig({purpose:'living-school-learning-plan-review-v2',config:{provider:'server-auto',model:'old'}});
assert.equal(requested.config.provider,'openai-compatible');
assert.equal(requested.config.model,selected.model);
const blocked=await context.CivweaveServerAIRouterV301.handle({purpose:'living-school-learning-plan-review-v2'});
assert.equal(blocked.error.code,'SELECTED_PROVIDER_AUTHORITY_BLOCKED_NETWORK');
assert.equal(cloudCalls,0);
vm.runInContext(unified,context,{filename:'unified-chat-system-v1.js'});
const moss=context.CivweaveUnifiedChatSystemV1;
const prompt='Can you teach me how to read and memorize the tarot?';
storage.setItem('civweave.chat.capability.pending.living-school.plan.v1',JSON.stringify({state:'review',id:'old',request:{title:'Manifestation Web App',capability:'manifestation and build a web app'},modules:[]}));
actualProvider='cloudflare-workers-ai';
let answer=await moss.generateLivingSchoolPlan({text:prompt,history:[]});
assert.match(answer.response.answer,/bypassed/i);
assert.equal(moss.readLearningPlan().state,'superseded');
assert.match((await moss.approveLivingSchoolPlan(moss.readLearningPlan())).response.answer,/cannot be approved/i);
actualProvider='openai-compatible';planContent=badPlan;
answer=await moss.generateLivingSchoolPlan({text:prompt,history:[]});
assert.match(answer.response.answer,/different subject/i);
assert.ok(progress.some(e=>e.phase==='received'&&/Manifestation Web App/.test(e.text)),'raw invalid JSON must remain inspectable');
assert.ok(progress.some(e=>e.phase==='failed'&&e.stage==='validate'),'wrong-topic result must mark Check failed, never Saved');
assert.equal(moss.readLearningPlan().state,'superseded');
planContent=goodPlan;
answer=await moss.generateLivingSchoolPlan({text:prompt,history:[]});
assert.equal(answer.action?.kind,'living-school-learning-plan');
assert.equal(answer.action?.title,'Read And Memorize The Tarot');
assert.equal(answer.model,selected.model);
assert.equal(lastRequest.config.maxTokens,640);
assert.equal(lastRequest.config.provider,'openai-compatible');
assert.equal(lastRequest.messages.length,2);
assert.ok(lastRequest.messages[1].content.includes('tarot'));
assert.equal(moss.readLearningPlan().state,'review');
assert.ok(progress.some(e=>e.phase==='validated'),'semantic validation must be represented');
assert.ok(progress.some(e=>e.phase==='saved'),'only accepted plan may reach Saved');
assert.notEqual(moss.readLearningPlan().id,'old');
console.log('PASS: native model pin, blocked Cloudflare fallback, 640-token local plan, rejected stale topic and approval, current goal saved');
