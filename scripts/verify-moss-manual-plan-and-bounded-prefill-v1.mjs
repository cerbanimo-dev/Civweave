import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {learningJourneySnapshot} from '../public/app/cabinets/living-school/living-school-journey-index-v1.mjs';

const read=path=>fs.readFileSync(path,'utf8');
const unified=read('public/app/unified-chat-system-v1.js');
const runtime=read('public/app/shared/civweave-model-runtime.js');
const render=read('public/app/cabinets/living-school/living-school-cleanroom-render-v218.mjs');
const workbench=read('public/app/cabinets/living-school/living-school-cleanroom-v218.mjs');
const loader=read('public/app/family-ai-loader-v105.js');
const boot=read('public/app/cabinets/living-school/index.html');
assert.match(unified,/function synchronize\(\)\{normalizeSurface\(\);patchLoader\(\);patchAssistant\(\);return true\}/,'Boot must never consume pending generation');
assert.match(unified,/return learningPlanResponse\(approved\)/,'Approval must save, not generate');
assert.match(workbench,/actionName==='select-approved-learning-journey'/);
assert.match(workbench,/state\(\)\.settings\?\.selectedJourneyPlanId!==record\.id/,'Only explicit selected-plan generation allowed');
assert.match(render,/data-ls-action="select-approved-learning-journey"/);
assert.match(render,/data-ls-action="retry-approved-learning-journey"/);
assert.match(boot,/durable-jobs-v13-cancel-busy/);
assert.match(loader,/1\.2\.20-moss-multi-plan-library/);

const planKey='civweave.chat.capability.pending.living-school.plan.v1';
const queueKey='civweave.chat.capability.pending.living-school.curriculum.v1';
const plan={id:'review-42',schema:'civweave.learning-journey-plan.v2',state:'review',request:{
  title:'Tarot memory and reading',capability:'read and memorize tarot',count:6,
  level:'beginner',mode:'guided',proof:'independent three-card reading'},modules:[
  {title:'Major Arcana',focus:'archetypes',outcome:'recognize 22 cards'}
]};
const queue={...plan.request,approvedAt:'2026-10-25T00:00:00Z',approvedPlanId:plan.id,autoRun:true};
const storage=new Map([[planKey,JSON.stringify(plan)],[queueKey,JSON.stringify(queue)]]);
let actualGeneration=0;
const browser={console,Date,Math,JSON,Object,Array,Promise,Set,Map,Number,String,RegExp,
  setTimeout,clearTimeout,queueMicrotask:callback=>callback(),addEventListener:()=>{},
  dispatchEvent:()=>true,CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
  document:{readyState:'loading',documentElement:{dataset:{}},getElementById:()=>null,scripts:[],head:{append:()=>{}},querySelectorAll:()=>[]},
  LivingSchoolCleanroomV218:{generateCurriculumFromChat:()=>{actualGeneration++;return Promise.resolve({})}}};
browser.globalThis=browser;
vm.runInNewContext(unified,browser,{filename:'unified-chat-system-v1.js'});
const api=browser.CivweaveUnifiedChatSystemV1;
api.synchronize();
assert.equal(actualGeneration,0,'Opening app must not generate legacy queued request');
assert.equal(storage.has(queueKey),true,'Do not silently delete queued plan');
const result=await api.approveLivingSchoolPlan(plan);
assert.equal(JSON.parse(storage.get(planKey)).state,'approved');
assert.equal(actualGeneration,0,'Approval must not automatically generate a curriculum');
assert.match(result.response.answer,/APPROVED/);
const snapshot=learningJourneySnapshot((k,d)=>storage.has(k)?JSON.parse(storage.get(k)):d,{});
assert.ok(snapshot.retry,'Approved legacy queued plan remains selectable');
assert.equal(snapshot.retry.request.capability,'read and memorize tarot');

const frames=[
  'data: '+JSON.stringify({choices:[{delta:{content:'## Module 1: Tarot'},finish_reason:null}]})+'\n\n',
  'data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}],usage:{completion_tokens:6}})+'\n\n',
  'data: [DONE]\n\n'
].join('');
const bytes=new TextEncoder().encode(frames);
const sent=[],events=[];
const store={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const ctx={console,Math,Date,URL,JSON,Object,Array,Promise,TextEncoder,TextDecoder,
  AbortController,DOMException,ReadableStream,setTimeout,clearTimeout,
  localStorage:store,sessionStorage:store,
  fetch:async(url,options)=>{sent.push(JSON.parse(options.body));
    return{ok:true,status:200,headers:{get:()=> 'text/event-stream'},
      body:new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=17)
        controller.enqueue(bytes.slice(i,i+17));controller.close();}})};
  }};
ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(runtime,ctx,{filename:'shared-runtime'});
const sources=Array.from({length:12},(_,i)=>({id:'tarot-'+(i+1),title:'Tarot reference '+i,
  provenance:'knowledge-school-downloaded',
  notes:'Facts about tarot, suits, combinations, and memorization with distinctions and examples. '.repeat(140)}));
const bloatedMessages=[{role:'system',content:'Repeated lengthy wrapper policy '.repeat(220)},
  {role:'user',content:'Research packet '.repeat(900)}];
const originalChars=bloatedMessages.reduce((sum,row)=>sum+row.content.length,0);
const completed=await ctx.CivweaveModelRuntime.generate({
  purpose:'living-school-research-grounded-curriculum-v218.1',executionProfile:'interactive',
  config:{provider:'openai-compatible',model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1',
    stream:true,maxTokens:8000,timeoutMs:1200000},
  context:{capability:'read and memorize tarot',level:'beginner',mode:'guided',moduleCount:6,
    proofContract:'independent reading',sources},
  messages:bloatedMessages,maxRepairAttempts:0,onEvent:event=>events.push(event)});
assert.equal(completed.status,'success');
assert.equal(sent.length,1);
const finalText=sent[0].messages.map(row=>row.content).join('\n');
assert.ok(finalText.length<5500,'Model-facing local prompt must be dramatically smaller than 17K characters');
assert.ok(finalText.length<originalChars/2);
assert.match(finalText,/Make EXACTLY 6 modules/);
assert.match(finalText,/SOURCE_ID tarot-1/);
assert.match(finalText,/PROVENANCE knowledge-school-downloaded/);
assert.doesNotMatch(finalText,/SOURCE_ID tarot-12/,'Avoid injecting full downloaded archive');
assert.doesNotMatch(finalText,/Repeated lengthy wrapper policy/,'Wrapper repetition must not reach native Qwen');
assert.equal(sent[0].stream,true);
const connection=events.find(event=>event.phase==='connecting');
assert.equal(connection.promptCharacters,sent[0].messages.reduce((sum,row)=>sum+row.content.length,0));
assert.equal(connection.originalPromptCharacters,originalChars);
assert.equal(connection.evidenceSourceCount,6);
assert.ok(events.some(event=>event.phase==='partial'));
assert.ok(events.some(event=>event.phase==='awaiting-first-token'));
console.log('PASS: Opening/approving a plan performs no generation; selected plan survives; native Qwen sends one bounded, cited, six-module prompt.');
