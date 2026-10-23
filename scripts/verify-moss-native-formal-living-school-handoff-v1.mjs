#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('public/app/unified-chat-system-v1.js','utf8');
const tracker=fs.readFileSync('public/app/guide-generation-tracker-v1.js','utf8');
const cabinet=fs.readFileSync('public/app/cabinets/living-school/index.html','utf8');
const workbench=fs.readFileSync('public/app/cabinets/living-school/living-school-pending-plan-review-v1.js','utf8');
new vm.Script(source);new vm.Script(tracker);new vm.Script(workbench);
const key='civweave.chat.capability.pending.living-school.plan.v1';
const memory=new Map(),events=[],calls=[],progress=[];
const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const config={provider:'openai-compatible',route:'openai-compatible',model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1'};
const valid={
 title:'Read And Memorize The Tarot',capability:'read and memorize tarot',
 level:'beginner',mode:'guided',proof:'Give a three-card tarot interpretation independently',
 modules:[
  {title:'Major Arcana',focus:'Learn tarot Major Arcana symbols',outcome:'Recognize 22 cards'},
  {title:'Minor Arcana',focus:'Learn the four tarot suits',outcome:'Recall card suit meanings'},
  {title:'Tarot reading',focus:'Practice three-card tarot spreads',outcome:'Interpret a spread independently'}
 ],assumptions:[]
};
let failingCompile=false,cappedDraft=false,cappedTwice=false,materializations=0;
const ctx={
 console,JSON,Date,Math,Object,Array,String,Number,Boolean,RegExp,Promise,Set,Map,URL,
 localStorage:storage,sessionStorage:storage,
 document:{readyState:'loading',documentElement:{dataset:{}}},
 addEventListener(){},queueMicrotask:fn=>fn(),setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,
 CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
 dispatchEvent:e=>events.push({type:e.type,...e.detail}),
 CivweaveSettingsV320:{readState:()=>config},
 CivweaveFamilyAILoaderV105:{ensure:async()=>{throw Error('Full bootstrap was not authorized')}},
 LivingSchoolCleanroomV218:{generateCurriculumFromChat:async()=>{materializations++}},
 CivweaveModelRuntime:{
   generate:async req=>{
     calls.push(req);assert.equal(req.config.provider,'openai-compatible');
     assert.equal(req.config.model,'qwen35-4b-native');
     assert.equal(req.config.stream,true);
     const stage=req.purpose.includes('-draft-')?'draft':req.purpose.includes('-compile-')?'compile':'repair';
     const text=stage==='draft'
       ?'Read and memorize the tarot: Major Arcana and Minor Arcana, practice a three-card spread.'
       :JSON.stringify(valid);
     req.onEvent?.({phase:'partial',characters:text.length,
       accumulatedText:text,
       complete:true});
     if(stage==='compile'&&failingCompile)return{status:'invalid-response',outputText:'{broken',error:{code:'INVALID_JSON',message:'bad json'}};
     if(cappedDraft&&req.purpose==='living-school-native-plan-draft-v1')
       return{status:'incomplete',finishReason:'length',outputText:text.slice(0,38),
         actual:{provider:'openai-compatible',model:'qwen35-4b-native'},error:{code:'NATIVE_OUTPUT_TOKEN_LIMIT'}};
     if(cappedTwice&&req.purpose==='living-school-native-plan-draft-continuation-v1')
       return{status:'incomplete',finishReason:'length',outputText:text.slice(-25),
         actual:{provider:'openai-compatible',model:'qwen35-4b-native'},error:{code:'NATIVE_OUTPUT_TOKEN_LIMIT'}};
     return{status:'success',actual:{provider:'openai-compatible',model:'qwen35-4b-native'},
       outputText:text,outputJson:stage==='draft'?undefined:valid};
   },
   readSharedConfig:()=>config
 }
};
ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(source,ctx);
const moss=ctx.CivweaveUnifiedChatSystemV1;
let r=await moss.handleNativeLivingSchoolRequest({
 text:'Can you teach me how to read and memorize the tarot?',
 history:[],nativeFastLane:true,onProgress:p=>progress.push(p)
});
assert.equal(r.action?.kind,'living-school-learning-plan');
assert.equal(r.action?.state,'review');
assert.equal(r.provider,'openai-compatible');
assert.equal(calls.length,2,'Draft and compiler must be separate real model calls');
assert.equal(calls[0].responseFormat,undefined);
assert.equal(calls[1].responseFormat,'json');
assert.ok(calls[1].schema);
assert.ok(calls[1].messages[1].content.includes('Convert THIS draft faithfully'));
assert.equal(materializations,0,'Review never generates lessons');
const plan=JSON.parse(memory.get(key));
assert.equal(plan.state,'review');
assert.deepEqual(plan.authoring.formalStages,['intake','draft','compile','validate','saved']);
assert.equal(plan.requiresExplicitApproval,true);
const pipeline=events.filter(e=>e.type==='civweave:weave-pipeline');
for(const stage of ['draft','compile','validate']){
 assert(pipeline.some(e=>e.phase===stage&&e.state==='running'),'Missing '+stage+' start');
 assert(pipeline.some(e=>e.phase===stage&&e.state==='complete'),'Missing '+stage+' completion');
}
assert(pipeline.some(e=>e.phase==='repair'&&e.state==='skipped'));
assert(pipeline.some(e=>e.phase==='pipeline'&&e.state==='complete'));
assert(events.some(e=>e.type==='civweave:weaveling-intake-progress'&&e.phase==='complete'&&e.intakeSource==='application-derived'));
assert(events.some(e=>e.type==='civweave:living-school-pending-plan-review'&&e.id===plan.id));
assert(pipeline.some(e=>e.phase==='compile'&&e.state==='streaming'&&e.text.includes('Major Arcana')));
assert(progress.some(p=>p.phase==='draft'&&p.characters>0));
assert(progress.some(p=>p.phase==='compile'&&p.characters>0));
assert.match(cabinet,/living-school-pending-plan-review-v1\.js/);
assert.match(workbench,/Learning Journey awaiting Moss review/);
assert.match(tracker,/origin==='native-local-api'/);
assert.match(tracker,/state\.nativeFormal/);
assert.equal(memory.get('civweave.chat.capability.pending.living-school.curriculum.v1'),undefined);

calls.length=0;events.length=0;progress.length=0;failingCompile=true;
r=await moss.handleNativeLivingSchoolRequest({text:'Can you teach me how to read and memorize the tarot?',history:[],nativeFastLane:true});
assert.equal(r.action?.state,'review');
assert.equal(calls.length,3,'Invalid JSON triggers exactly one targeted model repair');
assert(events.some(e=>e.type==='civweave:weave-pipeline'&&e.phase==='repair'&&e.state==='running'));
assert(events.some(e=>e.type==='civweave:weave-pipeline'&&e.phase==='repair'&&e.state==='complete'));
assert(JSON.parse(memory.get(key)).authoring.formalStages.includes('repair'));
assert.equal(materializations,0);

// A model that stops exactly at the token limit must never be treated as
// having completed the visible draft or quietly sent to the compiler.
failingCompile=false;cappedDraft=true;cappedTwice=false;
calls.length=0;events.length=0;
r=await moss.handleNativeLivingSchoolRequest({text:'Can you teach me how to read and memorize the tarot?',history:[],nativeFastLane:true});
assert.equal(r.action?.state,'review');
assert.equal(calls.length,3,'One capped draft needs exactly one continuation and then JSON compile');
assert.equal(calls[0].config.maxTokens,680,'The first draft budget must exceed the old 260-token ceiling');
assert.equal(calls[1].config.maxTokens,480,'Continuation must have a bounded budget');
assert.equal(calls[2].config.maxTokens,1050,'Compiler has a separate sufficient JSON budget');
assert.match(calls[1].messages[1].content,/Continue from its exact stopping point/);
assert.match(calls[2].messages[1].content,/Major Arcana/);
assert(events.some(e=>e.type==='civweave:weave-pipeline'&&e.phase==='draft'&&e.state==='needs-continuation'));
assert.equal(materializations,0);

cappedTwice=true;calls.length=0;events.length=0;
const priorId=moss.readLearningPlan()?.id;
r=await moss.handleNativeLivingSchoolRequest({text:'Can you teach me how to read and memorize the tarot?',history:[],nativeFastLane:true});
assert.match(r.response.answer,/both reached max_tokens/);
assert.equal(calls.length,2,'Two capped drafts must not launch the JSON compiler');
assert.equal(moss.readLearningPlan()?.id,priorId,'Incomplete draft cannot replace saved REVIEW plan');
assert(!events.some(e=>e.type==='civweave:weave-pipeline'&&e.phase==='pipeline'&&e.state==='complete'));
assert.equal(materializations,0);
console.log('PASS: formal plan, conditional repair, bounded truncated draft continuation, honest failure, and unchanged REVIEW artifacts');

