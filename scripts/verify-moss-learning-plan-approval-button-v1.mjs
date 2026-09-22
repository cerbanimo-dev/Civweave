import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const boundary=fs.readFileSync('public/app/install-boundary-v146.js','utf8');
const approval=fs.readFileSync('public/app/moss-learning-plan-approval-button-v1.js','utf8');

assert.match(boundary,/const MOSS_PLAN_APPROVAL_BUTTON='\/app\/moss-learning-plan-approval-button-v1\.js';/,'Install boundary must name the Moss approval-button runtime.');
assert.ok(boundary.includes('GUIDE_WORKSPACE,UNIFIED_CHAT_SYSTEM,MOSS_PLAN_APPROVAL_BUTTON,SERVER_AI_OUTPUT_NORMALIZER'),'Moss approval button must load immediately after unified chat on first-class system surfaces.');
assert.ok(boundary.includes('GUIDE_WORKSPACE,UNIFIED_CHAT_SYSTEM,MOSS_PLAN_APPROVAL_BUTTON,SERVER_AI_OUTPUT_NORMALIZER'),'Compatibility chat surfaces must retain the same direct approval-button load order.');
assert.match(approval,/Approve Learning Journey/,'The review surface must expose an explicit Approve Learning Journey button.');
assert.match(approval,/approveLivingSchoolPlan\(plan\)/,'The button must call the canonical Learning Journey approval/materialization API directly.');
assert.doesNotMatch(approval,/submitText\s*\(/,'Approval must not be implemented by synthesizing a chat message.');
assert.match(approval,/chatApprovalRequired:false/,'The runtime contract must declare that chat approval is not required.');

const plan={
  id:'learning-plan-test-1',
  state:'review',
  request:{title:'Tarot Foundations',capability:'read Tarot',level:'beginner',mode:'guided',proof:'Complete a reading.',count:4},
  modules:[{title:'One',focus:'A',outcome:'B'},{title:'Two',focus:'C',outcome:'D'},{title:'Three',focus:'E',outcome:'F'},{title:'Four',focus:'G',outcome:'H'}]
};
let approvedPlan=null;
let thread={schema:'civweave.realm-guide-thread.v237',system:'living-school',messages:[]};
const storage=new Map([['civweave.chat.capability.pending.living-school.plan.v1',JSON.stringify(plan)]]);

const sandbox={
  console,
  Date,
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  RegExp,
  Promise,
  Map,
  Set,
  structuredClone:value=>JSON.parse(JSON.stringify(value)),
  queueMicrotask:callback=>callback(),
  addEventListener:()=>{},
  dispatchEvent:()=>true,
  CustomEvent:function CustomEvent(type,init={}){this.type=type;this.detail=init.detail},
  MutationObserver:undefined,
  localStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
  document:{
    readyState:'loading',
    documentElement:{dataset:{}},
    body:null,
    head:{append:()=>{}},
    getElementById:()=>null,
    querySelectorAll:()=>[],
    createElement:tag=>({tagName:String(tag).toUpperCase(),id:'',textContent:'',dataset:{},style:{},setAttribute:()=>{},append:()=>{},remove:()=>{}})
  },
  CivweaveUnifiedChatSystemV1:{
    readLearningPlan:()=>plan,
    approveLivingSchoolPlan:async value=>{
      approvedPlan=value;
      return{response:{answer:'I materialized the approved Learning Journey “Tarot Foundations”.',choice:{mode:'Learn',system:'living-school',nextAction:'Open Module 1: One.'},approvalGate:null},provider:'living-school-learning-engine',model:'canonical-learning-engine',action:{kind:'living-school-curriculum-generated',state:'completed'}};
    }
  },
  CivweaveRealmSessionIntegrityV237:{
    readThread:()=>thread,
    writeThread:(system,value)=>{assert.equal(system,'living-school');thread=value;return thread}
  },
  CivweaveGuideChatSurfaceV350:{render:()=>true}
};
sandbox.globalThis=sandbox;
vm.runInNewContext(approval,sandbox,{filename:'moss-learning-plan-approval-button-v1.js'});
const api=sandbox.CivweaveMossLearningPlanApprovalButtonV1;
assert.ok(api,'Moss Learning Journey approval-button runtime did not initialize.');
assert.equal(api.approvalSurface,'button');
assert.equal(api.chatApprovalRequired,false);
const ok=await api.approvePlanById(plan.id);
assert.equal(ok,true,'Button approval must complete the direct approval call.');
assert.equal(approvedPlan,plan,'Button approval must pass the pending REVIEW plan directly to approveLivingSchoolPlan.');
assert.equal(thread.messages.length,1,'Direct button approval should append exactly one assistant materialization result and no synthetic user approval message.');
assert.equal(thread.messages[0].role,'assistant');
assert.match(thread.messages[0].text,/materialized the approved Learning Journey/);
assert.doesNotMatch(thread.messages[0].text,/^Approved$/i);

console.log('Moss Learning Journey approval button regression check passed.');
