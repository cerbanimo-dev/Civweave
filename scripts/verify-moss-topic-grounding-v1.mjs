#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('public/app/unified-chat-system-v1.js','utf8');
new vm.Script(source);
const data=new Map();
const key='civweave.chat.capability.pending.living-school.plan.v1';
const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
const config={provider:'openai-compatible',route:'openai-compatible',model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1'};
let output,request;
const make=(title,capability,modules)=>({
  title,capability,level:'beginner',mode:'guided',
  proof:'Demonstrate an independent three-card reading',
  modules,assumptions:[]
});
const unrelated=make('Manifestation Web App','create a manifestation web app',[
  {title:'Visualization',focus:'Clarify manifestation objectives',outcome:'Write an app specification'},
  {title:'Architecture',focus:'Design a web application',outcome:'Draw a site map'},
  {title:'Deployment',focus:'Publish the app',outcome:'Deploy a working prototype'}
]);
const generic=make('Using and Memorizing Tarot','use and memorize the tarot',[
  {title:'Foundation',focus:'Understand basic principles',outcome:'Explain the main ideas'},
  {title:'Practice',focus:'Develop habits and routines',outcome:'Practice every day'},
  {title:'Demonstration',focus:'Apply what you learned',outcome:'Show a new skill'}
]);
const related=make('Using and Memorizing Tarot','use and memorize the tarot',[
  {title:'Deck Introduction',focus:'Understand Major and Minor Arcana',outcome:'Recognize Fool and Magician symbolism'},
  {title:'Practice',focus:'Connect card meanings and suits',outcome:'Recall suits and court card themes'},
  {title:'Reading',focus:'Practice interpreting three-card spreads',outcome:'Interpret an independent reading'}
]);
output=unrelated;
const g={console,JSON,Date,Math,Object,Array,String,Number,Boolean,RegExp,Promise,Set,Map,URL,
  localStorage:storage,sessionStorage:storage,
  document:{readyState:'loading',documentElement:{dataset:{}}},
  addEventListener(){},dispatchEvent(){},queueMicrotask:fn=>fn(),setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  CivweaveSettingsV320:{readState:()=>config},
  CivweaveFamilyAILoaderV105:{ensure:async()=>{throw new Error('Unexpected heavy bootstrap')}},
  LivingSchoolCleanroomV218:{getState:()=>({})},
  CivweaveModelRuntime:{
    readSharedConfig:()=>config,
    generate:async incoming=>{
      request=incoming;
      return{status:'success',actual:{provider:'openai-compatible',model:'qwen35-4b-native'},outputJson:output}
    }
  }
};
g.globalThis=g;
vm.createContext(g);
vm.runInContext(source,g,{filename:'unified-chat-system-v1.js'});
const moss=g.CivweaveUnifiedChatSystemV1;
const prompt='Can you teach me to use and memorize the tarot?';
let answer=await moss.handleNativeLivingSchoolRequest({text:prompt,nativeFastLane:true,history:[]});
assert.match(answer.response.answer,/different subject/i);
assert.match(answer.response.answer,/Model title: "Manifestation Web App"/);
assert.equal(moss.readLearningPlan(),null,'A wrong-topic plan must never be saved');
assert.equal(request.context.existingPlan,null);
assert.equal(request.config.model,'qwen35-4b-native');
assert.equal(request.config.stream,true);
assert.match(request.messages[1].content,/CURRENT LEARNING GOAL: use and memorize the tarot/);
assert.match(request.messages[1].content,/SUBJECT KEYWORD TO INCLUDE IN AT LEAST ONE MODULE FOCUS: tarot/);
assert.doesNotMatch(request.messages[1].content,/"title":"Foundation","focus":"\.\.\."/);

output=generic;
answer=await moss.handleNativeLivingSchoolRequest({text:prompt,nativeFastLane:true,history:[]});
assert.match(answer.response.answer,/module descriptions did not establish that subject/);
assert.match(answer.response.answer,/Model title: "Using and Memorizing Tarot"/);
assert.equal(moss.readLearningPlan(),null,'Generic topic-free modules must not be saved');

output=related;
answer=await moss.handleNativeLivingSchoolRequest({text:prompt,nativeFastLane:true,history:[]});
assert.equal(answer.action?.kind,'living-school-learning-plan');
assert.equal(answer.action?.state,'review');
assert.equal(answer.provider,'openai-compatible');
assert.equal(moss.readLearningPlan().state,'review');
assert.equal(moss.readLearningPlan().request.capability,'use and memorize the tarot');
assert.equal(moss.readLearningPlan().authoring.model,'qwen35-4b-native');
assert.match(answer.response.answer,/Major and Minor Arcana/);

// An older plan left in revision-requested must not poison a new explicit goal.
data.set(key,JSON.stringify({state:'revision-requested',id:'older-manifestation',
  request:{title:'Manifestation Web App',capability:'create a manifestation web app'},
  modules:unrelated.modules}));
output=related;
answer=await moss.handleNativeLivingSchoolRequest({text:prompt,nativeFastLane:true,history:[]});
assert.equal(answer.action?.state,'review');
assert.equal(answer.action?.capability,'use and memorize the tarot');
assert.equal(request.context.existingPlan,null);
assert.equal(request.context.request.intent,'new');
assert.equal(moss.readLearningPlan().request.capability,'use and memorize the tarot');
assert.notEqual(moss.readLearningPlan().id,'older-manifestation');
console.log('PASS: unrelated drafts reject with evidence, generic module false matches explained, Tarot Arcana vocabulary accepted, repeated retry gets REVIEW, old revision-requested plan ignored');
