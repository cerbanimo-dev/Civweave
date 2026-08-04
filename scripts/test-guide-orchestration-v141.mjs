import fs from 'node:fs/promises';
import vm from 'node:vm';

class Storage{
  constructor(){this.map=new Map()}
  getItem(k){return this.map.has(k)?this.map.get(k):null}
  setItem(k,v){this.map.set(k,String(v))}
  removeItem(k){this.map.delete(k)}
  clear(){this.map.clear()}
}
const localStorage=new Storage();
localStorage.setItem('commonweave.universal-ai.v127',JSON.stringify({provider:'gemini',route:'gemini',model:'gemini-test',externalConsent:true}));
localStorage.setItem('fellowfare.mvp.state.v3',JSON.stringify({profile:{area:'Watertown, NY'},threads:[]}));
const location={pathname:'/loom/',search:'',href:'https://example.test/loom/',reload:()=>{}};
const context={
  console,
  localStorage,
  location,
  URLSearchParams,
  structuredClone,
  performance,
  setTimeout,
  clearTimeout,
  queueMicrotask,
  confirm:()=>false,
  CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail}},
  dispatchEvent:()=>{},
  addEventListener:()=>{},
  document:{readyState:'loading',querySelectorAll:()=>[],querySelector:()=>null,getElementById:()=>null,createElement:()=>({addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},className:'',id:'',open:false,showModal(){this.open=true}}),body:{append(){}},head:{append(){}},documentElement:{hasAttribute:()=>false,dataset:{}},addEventListener:()=>{}},
  MutationObserver:class MutationObserver{observe(){}},
  CommonweaveParity:{load:async()=>({systems:[
    {id:'commonweave',roomIds:['commonweave.quad']},
    {id:'living-school',roomIds:['living-school.home']},
    {id:'cerbanimo',roomIds:['cerbanimo.nexus']},
    {id:'fellowfare',roomIds:['fellowfare.mall']},
    {id:'anarchadia',roomIds:['anarchadia.hall']}
  ],rooms:[],index:{rooms:new Map()}})},
  CommonweaveReflexRuntime:{route:(text,current)=>({system:current,mode:current==='commonweave'?'Reflect':current==='living-school'?'Learn':current==='cerbanimo'?'Build':current==='fellowfare'?'Acquire':'Govern',confidence:.8,evidence:[]})},
  CommonweaveModelRuntime:{
    readSharedConfig:()=>({provider:'gemini',route:'gemini',model:'gemini-test',externalConsent:true}),
    generate:async request=>({status:'success',actual:{provider:'gemini',model:'gemini-test'},outputJson:{answer:request.context?.actionDraft?'I prepared the requested draft.':'I am the correct realm guide.',choice:{mode:request.context?.routingAnswer?.mode,system:request.context?.currentContext?.systemId,room:request.context?.currentContext?.roomId,nextAction:''},assumptions:[],requiresConsent:Boolean(request.context?.actionDraft?.approval?.required),confidence:.95}})
  }
};
context.globalThis=context;
vm.createContext(context);
for(const file of ['public/app/intention-planner-v141.js','public/app/guide-contracts-v141.js','public/app/assistant-runtime-v141.js','public/app/core-loop-v152.js','public/app/guide-chat-v153.js','public/app/capability-readiness-v154.js'])vm.runInContext(await fs.readFile(file,'utf8'),context,{filename:file});
const a=context.CommonweaveAssistantV141,core=context.CommonweaveCoreLoopV152,chat=context.CommonweaveGuideChatV153,readiness=context.CommonweaveCapabilityReadinessV154;
const assert=(x,m)=>{if(!x)throw new Error(m)};

let result=await a.respond({text:'I want to make a video game with my friends about a time traveler facing off with a time looper',systemId:'commonweave',history:[]});
assert(result.plan,'Weaveling should create a game weave.');
assert(result.plan.paths.some(p=>p.realm==='cerbanimo'),'Game weave needs a Cerbanimo path.');
assert(result.response.approvalGate.planId===result.planItemId,'Plan gate must point to stored item ID.');
assert(JSON.parse(localStorage.getItem('commonweave.intentions.v127')).some(i=>i.id===result.planItemId),'Plan must be persisted.');

const capabilityMap=readiness.ensure(result.plan);
assert(capabilityMap.capabilities.length===6,'The temporal game weave must expose six concrete capabilities.');
assert(!capabilityMap.metrics.complete,'A new capability map must require the user starting-point assessment.');
const choices={
  'game-design':['learn',1],
  'temporal-rules':['ready',3],
  'prototype-engineering':['practice',1],
  'playtest-revision':['ready',2],
  'production-assets':['recruit',0],
  collaboration:['simplify',0]
};
for(const cap of capabilityMap.capabilities){
  const [posture,level]=choices[cap.id];
  assert(readiness.update(result.plan.id,cap.id,{currentLevel:level}).ok,`Starting level must save for ${cap.id}.`);
  if(posture!=='ready')assert(readiness.update(result.plan.id,cap.id,{posture}).ok,`Gap posture must save for ${cap.id}.`);
}
const assessed=readiness.get(result.plan.id);
assert(assessed.metrics.complete,'Every mapped capability must have a starting level and gap route.');
assert(assessed.metrics.preparedScore>assessed.metrics.currentScore,'Preparation choices must improve the prepared readiness score.');
for(const system of ['living-school','cerbanimo','fellowfare','anarchadia'])assert(readiness.lane(result.plan.id,system).capabilities.length>0,`${system} must receive a visible capability lane.`);
const assessedPlan=JSON.parse(localStorage.getItem('commonweave.intentions.v127')).find(item=>item.id===result.plan.id).plan;
assert(assessedPlan.capabilityReadiness?.metrics?.complete,'The reviewed weave must preserve its capability map.');
assert(assessedPlan.paths.find(path=>path.realm==='living-school').steps.some(step=>step.includes('Learn and demonstrate')),'Learn-first gaps must alter the Living School path.');
assert(assessedPlan.paths.find(path=>path.realm==='cerbanimo').steps.some(step=>step.includes('supported checkpoint')),'Practice gaps must alter the Cerbanimo path.');
assert(assessedPlan.paths.find(path=>path.realm==='fellowfare').steps.some(step=>step.includes('collaborator or provider')),'Recruit gaps must alter the FellowFare path.');
assert(assessedPlan.assumptions.some(note=>note.includes('Reduce the requirement')),'Simplify choices must become explicit scope assumptions.');

const routed=core.activate(assessedPlan);
assert(routed.ok,'Activating an assessed weave must materialize the operational route.');
assert(JSON.parse(localStorage.getItem(core.keys.living))[0].sourcePlanId===result.plan.id,'Living School must receive the reviewed learning path.');
assert(JSON.parse(localStorage.getItem(core.keys.living))[0].steps.some(step=>step.includes('Learn and demonstrate')),'Living School intake must include the selected learning gap.');
assert(JSON.parse(localStorage.getItem(core.keys.cerb))[0].checkpoints.some(step=>step.includes('supported checkpoint')),'Cerbanimo quest must include practice-while-doing support.');
assert(JSON.parse(localStorage.getItem(core.keys.fare))[0].needs.some(step=>step.includes('collaborator or provider')),'FellowFare intake must include the recruitment need.');
assert(JSON.parse(localStorage.getItem(core.keys.cerb))[0].system==='cerbanimo','Cerbanimo must receive an importable quest action.');
assert(JSON.parse(localStorage.getItem(core.keys.passport)).activeIntentionId===result.plan.id,'Anarchadia must retain the active intention in the passport.');
assert(JSON.parse(localStorage.getItem(core.keys.handoffs)).length>=3,'Activation must create durable child-system handoffs.');
assert(core.activate(assessedPlan).duplicate===true,'Repeated activation must not duplicate the route.');

const chatScenarios={
  commonweave:'testing',
  'living-school':'Teach me how to document a small prototype.',
  cerbanimo:'Build a playable prototype with visible completion proof.',
  fellowfare:'I need materials and tools for a small prototype.',
  anarchadia:'Add a feature request for a clearer cabinet chat button.'
};
for(const [system,text] of Object.entries(chatScenarios)){
  const reply=await chat.ask(system,text,[]);
  assert(reply?.role==='assistant'&&reply.text.length>0,`${system} chat must receive a visible assistant reply.`);
  assert(reply.provider,`${system} chat must identify the runtime that answered.`);
}
assert((await chat.ask('commonweave','I want to make a tiny game plan',[])).approvalGate?.kind==='intention-activation','Weaveling chat must return a reviewable plan gate.');
assert((await chat.ask('cerbanimo','Build a tiny game prototype',[])).approvalGate?.kind==='realm-action-approval','Kamiya chat must return a reviewable quest gate.');

result=await a.respond({text:'retry one more time',systemId:'commonweave',history:[{role:'user',text:'I want to make a video game with my friends about a time traveler facing off with a time looper'}]});
assert(result.plan,'Retry should rebuild the prior weave.');

result=await a.respond({text:"Let's make a game about a time traveler and a time looper",systemId:'cerbanimo',history:[]});
assert(result.action?.kind==='quest','Kamiya should create a quest.');
assert(result.requestedProvider==='gemini'&&result.provider==='gemini','Selected Gemini route must be used.');
assert(!result.response.answer.includes('from Nexus'),'Kamiya must not identify as being from Nexus.');

result=await a.respond({text:'can you add a feature that gives a dark mode?',systemId:'anarchadia',history:[]});
assert(result.action?.kind==='feature-request','Merlin should create an official feature request.');
let approval=context.CommonweaveActionUI.approve(result.action.id);
assert(approval.ok,'Dark-mode feature request should approve.');
assert(approval.action.linkedActionIds?.length===1,'Approval must create a linked Cerbanimo quest.');

result=await a.respond({text:"can you make a trade request for me to get some food tonight? i'm hungry",systemId:'fellowfare',history:[]});
assert(result.action?.kind==='trade-request','Rook should create a trade request.');
assert(result.action.fields.area==='Watertown, NY','Saved FellowFare area should fill automatically.');
assert(result.action.missingRequired.includes('maximum budget or exchange method'),'Unknown exchange terms should remain explicit.');
result=await a.respond({text:'I can pay $15 cash',systemId:'fellowfare',history:[]});
assert(result.action.missingRequired.length===0,'Follow-up details should complete the draft.');
approval=context.CommonweaveActionUI.approve(result.action.id);
assert(approval.ok&&approval.action.state==='published','Completed food request should publish after approval.');

const before=JSON.parse(localStorage.getItem('commonweave.intentions.v127')).length;
result=await a.respond({text:'Can you teach me how to duggy?',systemId:'living-school',history:[]});
assert(result.action?.kind==='learning-session','Moss should start a learning brief.');
assert(result.action.missingRequired.includes('exact skill name'),'Moss should clarify “duggy.”');
const after=JSON.parse(localStorage.getItem('commonweave.intentions.v127')).length;
assert(before===after,'Moss must not create a Commonweave intention automatically.');

console.log('Dynamic orchestration, capability readiness, routed handoffs, and five-system send/receive chat scenarios passed.');
