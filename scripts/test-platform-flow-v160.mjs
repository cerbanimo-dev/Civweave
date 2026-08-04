import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

class Storage{
  constructor(){this.map=new Map()}
  getItem(key){return this.map.has(String(key))?this.map.get(String(key)):null}
  setItem(key,value){this.map.set(String(key),String(value))}
  removeItem(key){this.map.delete(String(key))}
}
class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}}
class StorageEvent{constructor(type,init={}){this.type=type;Object.assign(this,init)}}
const localStorage=new Storage(),events=[];
localStorage.setItem('commonweave.rewards.v156',JSON.stringify({events:[{currency:'button',amount:2}]}));
localStorage.setItem('fellowfare.mvp.state.v3',JSON.stringify({profile:{area:'Watertown, NY'},threads:[]}));
localStorage.setItem('commonweave.living-school.intake.v152',JSON.stringify([{id:'intake-one',sourcePlanId:'plan-one',title:'Dark interface accessibility',purpose:'Learn to evaluate contrast and appearance preferences.',completionCriteria:'A tested contrast matrix.',status:'ready'}]));
localStorage.setItem('commonweave.intentions.v127',JSON.stringify([{id:'plan-two',state:'active',plan:{id:'plan-two',title:'Build a small game',state:'active',paths:[{realm:'living-school',title:'Learn temporal game design',purpose:'Explain and prototype readable temporal rules.',completionCriteria:'A demonstrated design model.'}]}}]));
const head={append(){},querySelector(){return null}};
const document={
  readyState:'loading',hidden:false,
  documentElement:{dataset:{},style:{}},head,body:{append(){}},
  querySelector(){return null},querySelectorAll(){return[]},
  createElement(tag){return{tagName:tag.toUpperCase(),dataset:{},style:{},append(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return[]}}},
  addEventListener(){},
};
let reloaded=false;
const context={
  console,localStorage,sessionStorage:new Storage(),Storage,CustomEvent,StorageEvent,
  document,location:{href:'https://example.test/app/cabinets/living-school/',pathname:'/app/cabinets/living-school/',search:'',reload:()=>{reloaded=true}},
  URLSearchParams,Date,Math,JSON,structuredClone,setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>{},
  dispatchEvent:event=>events.push(event),addEventListener(){},
  matchMedia:()=>({matches:false,addEventListener(){}}),
  MutationObserver:class MutationObserver{observe(){} disconnect(){}},
};
context.globalThis=context;context.window=context;
vm.createContext(context);
const platform=await readFile(new URL('../public/app/platform-experience-v160.js',import.meta.url),'utf8');
const contracts=await readFile(new URL('../public/app/guide-contracts-v141.js',import.meta.url),'utf8');
const paths=await readFile(new URL('../public/app/cabinets/living-school/living-school-paths-v160.js',import.meta.url),'utf8');
vm.runInContext(platform,context,{filename:'platform-experience-v160.js'});
vm.runInContext(contracts,context,{filename:'guide-contracts-v141.js'});
const assert=(value,message)=>{if(!value)throw new Error(message)};
const platformApi=context.CommonweavePlatformExperienceV160,contractApi=context.CommonweaveGuideContractsV141;
assert(platformApi.explicitActionSystem('Make a dark mode')==='anarchadia','Dark-mode requests must route from Weaveling to Anarchadia.');
assert(platformApi.explicitActionSystem('I need windows and can pay 8 Buttons')==='fellowfare','Resource requests must route from Weaveling to FellowFare.');
platformApi.applyTheme('dark',true);
assert(localStorage.getItem('commonweave.appearance.v160')==='dark','Dark appearance must persist locally.');
assert(document.documentElement.dataset.commonweaveResolvedTheme==='dark','Dark appearance must apply to the document.');
let observedSystem='';
context.CommonweaveAssistantV141={respond:async request=>{observedSystem=request.systemId;return{response:{answer:'Draft ready.'},action:{id:'action-route'}}}};
await context.CommonweaveAssistantV141.respond({text:'Make a dark mode',systemId:'commonweave'});
assert(observedSystem==='anarchadia','Universal Weaveling actions must be composed by the owning realm contract.');
let action=contractApi.compose('I need reclaimed windows and can pay 8 Buttons','fellowfare',{currentContext:{roomId:'fellowfare.mall'}});
assert(action?.kind==='trade-request','Rook must create a real FellowFare request action.');
assert(action.fields.buttonBudget===8&&action.fields.availableButtons===2&&action.fields.fundingGap===6,'Rook must calculate the canonical Button funding gap.');
assert(!action.missingRequired.includes('maximum budget or exchange method'),'A Button budget must satisfy the exchange-term requirement.');
let result=contractApi.approve(action.id);
assert(result.ok&&result.held===true,'An underfunded approved request must become a held plan.');
action=contractApi.get(action.id);
assert(action.state==='funding'&&action.execution.status==='awaiting-buttons','Held plans must expose their funding state.');
const held=JSON.parse(localStorage.getItem('commonweave.fellowfare.funding-plans.v160'))[0];
assert(held.visibility==='private'&&held.gap===6,'Underfunded plans must remain private and record the gap.');
assert(JSON.parse(localStorage.getItem('fellowfare.mvp.state.v3')).threads.length===0,'An underfunded plan must not be shared to the market.');
localStorage.setItem('commonweave.rewards.v156',JSON.stringify({events:[{currency:'button',amount:2},{currency:'button',amount:6}]}));
result=contractApi.approve(action.id);
assert(result.ok&&!result.held&&result.action.state==='published','A funded plan must still require and honor a later publication approval.');
assert(JSON.parse(localStorage.getItem('fellowfare.mvp.state.v3')).threads.some(thread=>thread.commonweaveActionId===action.id),'The approved funded request must publish exactly once.');
vm.runInContext(paths,context,{filename:'living-school-paths-v160.js'});
const pathApi=context.LivingSchoolPathsV160,available=pathApi.paths();
assert(available.some(path=>path.id==='plan-one')&&available.some(path=>path.id==='plan-two'),'Living School must list routed intakes and active intentions.');
localStorage.setItem('commonweave.living-school.cabinet.v151',JSON.stringify({schema:'living-school-cabinet-v151',school:{id:'old-school',title:'Old path',capability:'Old capability',modules:[]},events:[]}));
pathApi.activatePath('plan-one');
const selected=JSON.parse(localStorage.getItem('commonweave.living-school.cabinet.v151'));
assert(selected.activePathId==='plan-one'&&selected.school===null,'Selecting a different learning path must create a clean curriculum workspace.');
const library=JSON.parse(localStorage.getItem('commonweave.living-school.path-library.v160'));
assert(library.snapshots['plan-one']&&reloaded,'Learning path selection must persist and reopen the selected path.');
console.log(JSON.stringify({ok:true,theme:'dark-persisted',universalRouting:'anarchadia-and-fellowfare',rook:{requiredButtons:8,initialButtons:2,heldGap:6,publishedAfterFunding:true},livingSchool:{paths:available.map(path=>path.id),selected:'plan-one'}},null,2));
