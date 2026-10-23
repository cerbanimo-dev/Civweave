import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const boundary=fs.readFileSync('public/app/install-boundary-v146.js','utf8');
const approval=fs.readFileSync('public/app/moss-learning-plan-approval-button-v1.js','utf8');

assert.match(boundary,/const MOSS_PLAN_APPROVAL_BUTTON='\/app\/moss-learning-plan-approval-button-v1\.js';/,'Install boundary must name the Moss approval-button runtime.');
assert.ok(boundary.includes('GUIDE_WORKSPACE,UNIFIED_CHAT_SYSTEM,MOSS_PLAN_APPROVAL_BUTTON,SERVER_AI_OUTPUT_NORMALIZER'),'Moss approval button must load immediately after unified chat on first-class system surfaces.');
assert.ok(boundary.includes('GUIDE_WORKSPACE,UNIFIED_CHAT_SYSTEM,MOSS_PLAN_APPROVAL_BUTTON,SERVER_AI_OUTPUT_NORMALIZER'),'Compatibility chat surfaces must retain the same direct approval-button load order.');
assert.match(approval,/Approve Learning Journey/,'The review surface must expose an explicit Approve Learning Journey button.');
assert.match(approval,/moss-face-v255\.webp/,'The review surface must use the real Moss mascot artwork inline.');
assert.match(approval,/actionButton\(actions,'Revise'/,'The review surface must expose Revise.');
assert.match(approval,/actionButton\(actions,'Deny'/,'The review surface must expose Deny.');
assert.match(approval,/Retry generation/,'A failed approved materialization must offer a retry.');
assert.match(approval,/Open Learning Journey/,'A successful materialization must have an actionable next step.');
assert.match(approval,/approveLivingSchoolPlan\(plan\)/,'The button must call the canonical Learning Journey approval/materialization API directly.');
assert.doesNotMatch(approval,/submitText\s*\(/,'Approval must not be implemented by synthesizing a chat message.');
assert.match(approval,/chatApprovalRequired:false/,'The runtime contract must declare that chat approval is not required.');

let plan={
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
    requestLivingSchoolPlanRevision:value=>{
      assert.equal(value.id,plan.id);
      plan={...plan,state:'revision-requested'};
      storage.set('civweave.chat.capability.pending.living-school.plan.v1',JSON.stringify(plan));
      return{response:{answer:'Moss is waiting for your revisions.',choice:{nextAction:'Describe what should change.'}},action:{kind:'living-school-learning-plan-revision-requested',state:'revision-requested'}};
    },
    denyLivingSchoolPlan:value=>{
      assert.equal(value.id,plan.id);
      plan={...plan,state:'denied'};
      storage.set('civweave.chat.capability.pending.living-school.plan.v1',JSON.stringify(plan));
      return{response:{answer:'Moss discarded the plan. Nothing was generated.',choice:{nextAction:'Enter a new learning goal.'}},action:{kind:'living-school-learning-plan-denied',state:'denied'}};
    },
    retryLivingSchoolPlanMaterialization:async planId=>{
      assert.equal(planId,plan.id);
      assert.equal(plan.state,'approved');
      return{response:{answer:'I materialized the approved Learning Journey.',choice:{nextAction:'Open Living School.'}},action:{kind:'living-school-curriculum-generated',state:'completed'}};
    },
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
assert.equal(api.approvalSurface,'approve-revise-deny');
assert.equal(api.chatApprovalRequired,false);
const ok=await api.approvePlanById(plan.id);
assert.equal(ok,true,'Button approval must complete the direct approval call.');
assert.equal(approvedPlan,plan,'Button approval must pass the pending REVIEW plan directly to approveLivingSchoolPlan.');
assert.equal(thread.messages.length,1,'Direct button approval should append exactly one assistant materialization result and no synthetic user approval message.');
assert.equal(thread.messages[0].role,'assistant');
assert.match(thread.messages[0].text,/materialized the approved Learning Journey/);
assert.doesNotMatch(thread.messages[0].text,/^Approved$/i);

// Independent decision buttons must not forge chat messages or start curriculum generation.
const approvalCount=thread.messages.length;
plan={...plan,id:'learning-plan-test-2',state:'review'};
storage.set('civweave.chat.capability.pending.living-school.plan.v1',JSON.stringify(plan));
assert.equal(await api.decidePlanById(plan.id,'revise'),true);
assert.equal(plan.state,'revision-requested');
assert.equal(thread.messages.length,approvalCount+1);
assert.equal(approvedPlan.id,'learning-plan-test-1','Revision must not approve or generate.');
assert.match(thread.messages.at(-1).text,/Describe what should change/);
assert.equal(await api.approvePlanById(plan.id),false,'A plan awaiting revisions must not be approved.');

plan={...plan,id:'learning-plan-test-3',state:'review'};
storage.set('civweave.chat.capability.pending.living-school.plan.v1',JSON.stringify(plan));
assert.equal(await api.decidePlanById(plan.id,'deny'),true);
assert.equal(plan.state,'denied');
assert.equal(approvedPlan.id,'learning-plan-test-1','Deny must not approve or generate.');
assert.equal(await api.approvePlanById(plan.id),false,'A denied plan must be blocked from approval.');
assert.match(thread.messages.at(-1).text,/Nothing was generated/);

plan={...plan,id:'learning-plan-test-4',state:'approved',approvedAt:new Date().toISOString()};
storage.set('civweave.chat.capability.pending.living-school.plan.v1',JSON.stringify(plan));
assert.equal(await api.retryPlanById(plan.id),true,'An approved plan must allow retry after generation failure.');
assert.match(thread.messages.at(-1).text,/materialized the approved Learning Journey/);
assert.match(approval,/previous\?\.dataset\.mode==='open'/,'Completion CTA must remain stable across MutationObserver renders.');

// Prove the real REVIEW text (including its space) produces three visible
// controls in a rendered chat article. Static string checks alone missed the
// double-escaped regex that previously made a successful generation stall.
plan={...plan,id:'learning-plan-visible-actions',state:'review',approvedAt:null};
storage.set('civweave.chat.capability.pending.living-school.plan.v1',JSON.stringify(plan));
const fakeBody={children:[],append(...nodes){this.children.push(...nodes)}};
const fakeArticle={querySelector(selector){
  if(selector==='.cw350-bubble')return{textContent:'Learning Journey plan: “Tarot Foundations”\n\nGoal: read Tarot\n\nStatus: REVIEW. This is only the high-level plan.'};
  if(selector===':scope > div')return fakeBody;
  return null;
},lastElementChild:fakeBody};
const fakeRoot={dataset:{guide:'living-school'},querySelector(selector){
  if(selector==='[data-moss-learning-plan-approval-v1]')
    return fakeBody.children.find(child=>child.dataset?.mossLearningPlanApprovalV1)||null;
  return null;
},querySelectorAll(selector){
  return selector==='article[data-role="assistant"]'?[fakeArticle]:[];
}};
sandbox.document.getElementById=id=>id==='cw-persistent-guide-chat-v215'?fakeRoot:null;
sandbox.document.querySelectorAll=selector=>selector==='[data-moss-learning-plan-approval-v1]'
  ?fakeBody.children.filter(child=>child.dataset?.mossLearningPlanApprovalV1):[];
sandbox.document.createElement=tag=>({
  tagName:tag.toUpperCase(),dataset:{},style:{},children:[],textContent:'',
  setAttribute(){},addEventListener(){},append(...nodes){this.children.push(...nodes)},
  remove(){const index=fakeBody.children.indexOf(this);if(index>=0)fakeBody.children.splice(index,1)}
});
assert.equal(api.render(),true,'Moss must recognize a saved REVIEW plan in a real chat bubble.');
assert.equal(fakeBody.children.length,1,'The review actions must attach within the chat message.');
const reviewCard=fakeBody.children[0];
assert.equal(reviewCard.dataset.planId,plan.id);
assert.equal(reviewCard.dataset.mode,'review');
const mascot=reviewCard.children.find(child=>child.className==='cw350-learning-mascot');
assert.ok(mascot,'The Moss image and next-step guidance must appear inline.');
assert.match(mascot.children[0].src,/moss-face-v255\.webp/);
const actionRow=reviewCard.children.find(child=>child.className==='cw350-learning-plan-actions');
assert.deepEqual(Array.from(actionRow.children,child=>child.textContent),['Approve','Revise','Deny']);
assert.equal(api.render(),true,'Repeat rendering should preserve existing review controls.');
assert.equal(fakeBody.children.length,1,'Mutation observer renders must not duplicate action bars.');
console.log('Moss REVIEW chat rendering and decision-button regression checks passed.');

console.log('Moss Learning Journey decision and recovery regression checks passed.');
