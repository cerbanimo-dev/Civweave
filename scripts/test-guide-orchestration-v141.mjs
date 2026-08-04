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
  confirm:()=>false,
  CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail}},
  dispatchEvent:()=>{},
  addEventListener:()=>{},
  document:{readyState:'complete',querySelectorAll:()=>[],querySelector:()=>null,getElementById:()=>null,createElement:()=>({addEventListener(){},querySelector(){return null},className:'',id:'',open:false,showModal(){this.open=true}}),body:{append(){}},head:{append(){}},documentElement:{hasAttribute:()=>false},addEventListener:()=>{}},
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
for(const file of ['public/app/intention-planner-v141.js','public/app/guide-contracts-v141.js','public/app/assistant-runtime-v141.js','public/app/core-loop-v152.js'])vm.runInContext(await fs.readFile(file,'utf8'),context,{filename:file});
const a=context.CommonweaveAssistantV141,core=context.CommonweaveCoreLoopV152;
const assert=(x,m)=>{if(!x)throw new Error(m)};

let result=await a.respond({text:'I want to make a video game with my friends about a time traveler facing off with a time looper',systemId:'commonweave',history:[]});
assert(result.plan,'Weaveling should create a game weave.');
assert(result.plan.paths.some(p=>p.realm==='cerbanimo'),'Game weave needs a Cerbanimo path.');
assert(result.response.approvalGate.planId===result.planItemId,'Plan gate must point to stored item ID.');
assert(JSON.parse(localStorage.getItem('commonweave.intentions.v127')).some(i=>i.id===result.planItemId),'Plan must be persisted.');

const routed=core.activate(result.plan);
assert(routed.ok,'Activating a weave must materialize the operational route.');
assert(JSON.parse(localStorage.getItem(core.keys.living))[0].sourcePlanId===result.plan.id,'Living School must receive the reviewed learning path.');
assert(JSON.parse(localStorage.getItem(core.keys.cerb))[0].system==='cerbanimo','Cerbanimo must receive an importable quest action.');
assert(JSON.parse(localStorage.getItem(core.keys.passport)).activeIntentionId===result.plan.id,'Anarchadia must retain the active intention in the passport.');
assert(JSON.parse(localStorage.getItem(core.keys.handoffs)).length>=3,'Activation must create durable child-system handoffs.');
assert(core.activate(result.plan).duplicate===true,'Repeated activation must not duplicate the route.');

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

console.log('Dynamic orchestration and activated core-loop scenarios passed.');
