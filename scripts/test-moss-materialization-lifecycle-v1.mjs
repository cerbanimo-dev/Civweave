import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL(`../public/app/${path}`,import.meta.url),'utf8');
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
globalThis.document={getElementById:()=>null};globalThis.localStorage={getItem:()=>null,setItem(){}};
const {assertGenerationActive,generationCancelled,curriculumWeaveIdentity,weavePathIdentity}=await import('../public/app/cabinets/living-school/living-school-cleanroom-core-v218-base.mjs');
const base=()=>({console,URL,URLSearchParams,AbortController,structuredClone,queueMicrotask,setTimeout,clearTimeout,Date,Math,JSON,Object,Array,String,Number,Boolean,RegExp,Promise,Set,Map,clean,copy:structuredClone,now:()=>new Date().toISOString(),uid:prefix=>`${prefix}-qa`,clip:(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0)),assertGenerationActive,generationCancelled,curriculumWeaveIdentity,weavePathIdentity,addEventListener(){},dispatchEvent(){},CustomEvent:class{},document:{readyState:'loading',documentElement:{dataset:{}},scripts:[],addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){},removeItem(){}}});
const stripModules=source=>source.replace(/^export \* from[^\n]+\r?\n/gm,'').replace(/^import[\s\S]*?from\s*['"][^'"]+['"];\r?\n/gm,'').replace(/export (async )?function /g,'$1function ').replace(/export const /g,'const ');
const oldSchool=()=>({id:'old-school',title:'Previous QA Journey',capability:'Previous topic',generation:{provider:'ollama'},modules:[{id:'old-module',quiz:{bank:[]}}]});
async function waitFor(predicate){for(let turn=0;!predicate()&&turn<40;turn++)await Promise.resolve();assert.ok(predicate(),'the expected provider request must start within the fixture budget')}

test('typed Moss approval forwards its Stop signal and events to the existing learning engine',async()=>{
  const values=new Map(),controller=new AbortController(),reason=new Error('QA stopped typed approval');let received,resolveEngine;
  const context=vm.createContext({...base(),localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},location:{pathname:'/app/working-campus-v440.html',search:''},LivingSchoolCleanroomV218:{generateCurriculumFromChat:async(_request,options)=>{received=options;return new Promise(resolve=>{resolveEngine=resolve})}}});
  vm.runInContext(read('unified-chat-system-v1.js'),context);
  const plan={id:'qa-review',state:'review',request:{title:'QA conversion',capability:'Convert Celsius to Fahrenheit',intent:'new'},modules:[]};values.set('civweave.chat.capability.pending.living-school.plan.v1',JSON.stringify(plan));
  const onEvent=()=>{},pending=context.CivweaveUnifiedChatSystemV1.handleNativeLivingSchoolRequest({text:'approve',signal:controller.signal,onEvent,history:[]});
  await waitFor(()=>resolveEngine);assert.equal(received?.signal,controller.signal);assert.equal(received?.onEvent,onEvent);controller.abort(reason);resolveEngine({school:{id:'late-course',modules:[]}});
  await assert.rejects(pending,error=>error===reason);assert.equal(context.CivweaveUnifiedChatSystemV1.readLearningPlan()?.state,'approved','cancelled materialization retains the approved retryable plan');
});

test('Moss materialization passes lifecycle to research and refuses a late course commit',async()=>{
  const current={school:oldSchool(),progress:{},settings:{},sources:[]},controller=new AbortController(),reason=new Error('QA stopped curriculum design');let researchOptions,modelOptions,resolveSchool;
  const context=vm.createContext({...base(),state:()=>current,persist(){},toast(){},progressFor:()=>({}),fields:()=>({}),legacyActions:{},moduleFor:()=>({}),researchCapability:async(_capability,options)=>{researchOptions=options;return{mode:'manual-sources',sources:[]}},generateSchool:async(_data,options)=>{modelOptions=options;return new Promise(resolve=>{resolveSchool=resolve})},CivweaveModelRuntime:{readSharedConfig:()=>({provider:'ollama'})}});
  vm.runInContext(stripModules(read('living-school-cleanroom-actions-v243.mjs'))+'\nglobalThis.__generate=generateCurriculumFromData;',context);
  const pending=context.__generate({title:'New QA Journey',capability:'Convert Celsius temperatures',count:1},{signal:controller.signal});await waitFor(()=>resolveSchool);
  assert.equal(researchOptions?.signal,controller.signal);assert.equal(modelOptions?.signal,controller.signal);controller.abort(reason);resolveSchool({id:'late-course',generation:{provider:'ollama'},modules:[{id:'late-module',quiz:{questionsPerAttempt:3,bank:[]}}]});
  await assert.rejects(pending,error=>error===reason);assert.equal(current.school.id,'old-school');
});

test('core instructional design receives the existing lifecycle and cannot persist recovery after Stop',async()=>{
  const current={school:oldSchool(),sources:[],research:{mode:'manual-sources'}},controller=new AbortController(),reason=new Error('QA stopped the model design');let request,resolveModel,persisted=0;
  const context=vm.createContext({...base(),state:()=>current,persist:()=>{persisted++},moduleFor:index=>({id:`module-${index}`}),normalizeModule:x=>x,progressFor:()=>({}),ensureModuleVideo:async()=>{},CivweaveFamilyAILoaderV105:{ensure:async()=>true},CivweaveModelRuntime:{readSharedConfig:()=>({provider:'ollama',model:'qa-local'}),generate:async value=>{request=value;return new Promise(resolve=>{resolveModel=resolve})}}});
  vm.runInContext(stripModules(read('cabinets/living-school/living-school-cleanroom-core-v218.mjs'))+'\nglobalThis.__generate=generateSchool;',context);
  const pending=context.__generate({title:'QA Journey',capability:'Convert Celsius',count:1,modelRoute:'shared'},{signal:controller.signal});await waitFor(()=>resolveModel);assert.equal(request.signal,controller.signal);controller.abort(reason);resolveModel({status:'success',outputText:'Late design text'});
  await assert.rejects(pending,error=>error===reason);assert.equal(current.school.id,'old-school');assert.equal(persisted,0,'a stopped design must not replace recovery or course state');
});

test('Stop during model-derived research cannot persist references or begin another fallback',async()=>{
  const current={research:null,sources:[]},controller=new AbortController(),reason=new Error('QA stopped research');let request,resolveModel,calls=0;
  const core={...base(),state:()=>current,persist(){}};
  const context=vm.createContext({...base(),core,searchDownloadedKnowledge:async()=>[],CivweaveFamilyAILoaderV105:{ensure:async()=>true},CivweaveModelRuntime:{readSharedConfig:()=>({provider:'ollama',model:'qa-local'}),generate:async value=>{request=value;calls++;return new Promise(resolve=>{resolveModel=resolve})}}});
  vm.runInContext(stripModules(read('living-school-local-research-v243.mjs'))+'\nglobalThis.__research=researchCapability;',context);
  const pending=context.__research('Convert Celsius temperatures',{signal:controller.signal});await waitFor(()=>resolveModel);assert.equal(request.signal,controller.signal);controller.abort(reason);resolveModel({status:'success',outputJson:{summary:'Late notes',notes:[{title:'Celsius',content:'Late unverified notes.'}]}});
  await assert.rejects(pending,error=>error===reason);assert.equal(calls,1);assert.equal(current.research,null);assert.deepEqual(current.sources,[]);
});

test('Stop during one bounded assessment call cannot add questions to the pending course',async()=>{
  const controller=new AbortController(),reason=new Error('QA stopped assessment');let request,resolveModel;
  const current={school:oldSchool(),progress:{},settings:{}},pendingSchool={id:'pending-course',generation:{provider:'ollama'},modules:[{id:'pending-module',title:'Celsius',quiz:{questionsPerAttempt:3,bank:[]}}]};
  const context=vm.createContext({...base(),state:()=>current,persist(){},toast(){},progressFor:()=>({}),fields:()=>({}),legacyActions:{},moduleFor:()=>({}),CivweaveFamilyAILoaderV105:{ensure:async()=>true},CivweaveModelRuntime:{readSharedConfig:()=>({provider:'ollama',model:'qa-local'}),generate:async value=>{request=value;return new Promise(resolve=>{resolveModel=resolve})}}});
  vm.runInContext(stripModules(read('living-school-cleanroom-actions-v243.mjs'))+'\nglobalThis.__quiz=completeSharedQuizBank;',context);
  const pending=context.__quiz({capability:'Convert Celsius'},pendingSchool,{signal:controller.signal});await waitFor(()=>resolveModel);assert.equal(request.signal,controller.signal);controller.abort(reason);resolveModel({status:'success',outputJson:{modules:[]}});
  await assert.rejects(pending,error=>error===reason);assert.equal(pendingSchool.modules[0].quiz.bank.length,0);assert.equal(current.school.id,'old-school');
});

for(const newPath of [true,false])test(`the existing native learning engine restores the previous course and credential on Stop (${newPath?'new path':'revision'})`,async()=>{
  const previous={school:oldSchool(),progress:{old:{assessmentPassed:true}},activeModuleId:'old-module',activePathId:'old-path',pathContext:{title:'Previous topic'},research:null,sources:[],visualInspection:null,generationRecovery:null,practicum:{id:'previous-artifact'},projectGate:{status:'accepted'},receipts:[{receiptId:'previous-receipt'}],final:{passed:true},credential:{credentialId:'previous-credential'},settings:{},learningHistory:[]};
  let current=structuredClone(previous),received,resolveSchool;const controller=new AbortController(),reason=new Error('QA stopped the learning engine');
  const context=vm.createContext({...base(),queueMicrotask(){},state:()=>current,persist(){},freshState:()=>({projectGate:{status:'not-started'}}),chatCurriculumData:input=>input,ensureAIGuards:async()=>true,markDispatch(){},reconcileProgressById(){},ensureLivingSchool:async()=>{},renderEnhanced(){},renderLivingSchoolEmbed(){},FALLBACK_VIDEO_URL:'qa-video',generateCurriculumFromData:async(_data,options)=>{received=options;return new Promise(resolve=>{resolveSchool=resolve})}});
  const source=read('cabinets/living-school/living-school-cleanroom-v218.mjs');
  vm.runInContext('let busy=false;'+source.slice(source.indexOf('function snapshotLearningState(){'),source.indexOf('\nsanitizeSavedHybridQuiz();'))+'\nglobalThis.__generate=generateCurriculumFromChat;',context);
  const pending=context.__generate({title:'Next QA Journey',capability:'Convert Celsius',count:1,newPath,intent:newPath?'new':'revise'},{signal:controller.signal});await waitFor(()=>resolveSchool);assert.equal(received.signal,controller.signal);
  controller.abort(reason);current.school={id:'late-course',modules:[]};resolveSchool(current.school);
  await assert.rejects(pending,error=>error===reason);assert.deepEqual(current,previous);
});

test('the existing design budget does not start or consume a stopped parent request',async()=>{
  let calls=0;const controller=new AbortController(),reason=new Error('QA stopped before design budget');controller.abort(reason);
  const context=vm.createContext({...base(),queueMicrotask(){},setTimeout:()=>0,clearTimeout(){},CivweaveLivingSchoolGenerationGuardV262:{installed:true},CivweaveLivingSchoolQuizContractGuardV263:{installed:true},CivweaveLivingSchoolVideoGenerationGuardV1:{installed:true},CivweaveLivingSchoolRuntimeRouteV2:{providerNeutral:true},CivweaveModelRuntime:{readSharedConfig:()=>({provider:'ollama',model:'qa-local'}),generate:async()=>{calls++;return{status:'success',outputText:'Incomplete but late design'}}}});
  vm.runInContext(read('living-school-generation-budget-v3.js'),context);context.CivweaveLivingSchoolGenerationBudgetV3.install();
  await assert.rejects(context.CivweaveModelRuntime.generate({purpose:'living-school-research-grounded-curriculum-v218.1',signal:controller.signal,config:{provider:'ollama'},context:{moduleCount:1}}),error=>error===reason);assert.equal(calls,0);assert.equal(context.CivweaveLivingSchoolGenerationBudgetV3.stats().designCalls,0);
});
