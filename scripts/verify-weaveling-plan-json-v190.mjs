import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const [plannerSource,orchestratorSource,campusPart,workerSource]=await Promise.all([
  readFile('public/app/intention-planner-v141.js','utf8'),
  readFile('public/extensions/commonweave-weaveling-plan-json-v190.js','utf8'),
  readFile('public/app/working-campus-v156.part5.txt','utf8'),
  readFile('public/service-worker-v156.js','utf8'),
]);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
class MemoryStorage{constructor(seed={}){this.values=new Map(Object.entries(seed))}getItem(key){return this.values.has(key)?this.values.get(key):null}setItem(key,value){this.values.set(key,String(value))}removeItem(key){this.values.delete(key)}}
const storage=new MemoryStorage({
  'commonweave.working-campus.v1':JSON.stringify({wish:'',profile:{skill:'learning',learning:'practice',collaboration:'solo',hours:'3-5',constraints:'Keep the premise ambiguous until the rules are chosen.'},plan:null,conversation:[]}),
  'commonweave.intentions.v127':'[]',
  'commonweave.realm-inbox.v1':'[]',
});
let captured=null,activateCalls=0,openCalls=0;
const sandbox={
  console,Date,Math,structuredClone,localStorage:storage,
  CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},dispatchEvent(){},
  globalThis:null,
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(plannerSource,sandbox,{filename:'intention-planner-v141.js'});
sandbox.CommonweaveIntentionUI={
  activate(id){activateCalls++;const items=JSON.parse(storage.getItem('commonweave.intentions.v127')||'[]'),item=items.find(entry=>entry.id===id);if(!item)return{ok:false,error:'missing'};item.state='active';item.plan.state='active';storage.setItem('commonweave.intentions.v127',JSON.stringify(items));return{ok:true,item}},
  review(id){const items=JSON.parse(storage.getItem('commonweave.intentions.v127')||'[]'),item=items.find(entry=>entry.id===id);if(!item)return{ok:false,error:'missing'};item.state='review';item.plan.state='review';storage.setItem('commonweave.intentions.v127',JSON.stringify(items));return{ok:true,item}},
  open(){openCalls++;},
};
sandbox.CommonweaveModelRuntime={
  async generate(request){captured=request;return{status:'success',outputJson:{
    title:'Write a book about a time looper meeting a time traveler in an infinite loop',
    wish:'Write a book about a time looper meeting a time traveler in an infinite loop',
    outcome:'Complete a coherent manuscript that explores what happens when two different relationships to time collide inside an apparently infinite loop.',
    assumptions:['The question mark around “infinite” signals that the loop rules are intentionally unresolved.','The time looper and time traveler meet; neither is automatically an antagonist.'],
    paths:[
      {type:'learning',realm:'living-school',title:'Define the loop and travel rules without flattening the mystery',purpose:'Make the temporal logic understandable enough to write while preserving uncertainty the story needs.',steps:['List what the looper remembers after each reset.','List what the traveler can change without resetting.','Choose three apparent contradictions readers should notice.'],completionCriteria:'The temporal rules can be explained in one page and still leave one deliberate mystery.',evidence:['Temporal rules sheet','Contradiction list']},
      {type:'skilled-labor',realm:'cerbanimo',title:'Outline and draft the first collision between the two characters',purpose:'Turn the premise into scenes that reveal the rules through consequences.',steps:['Write the meeting from the looper’s point of view.','Rewrite the same event from the traveler’s point of view.','Choose which version becomes the opening chapter.'],completionCriteria:'A complete opening sequence establishes both characters and one meaningful temporal consequence.',evidence:['Two scene drafts','Opening decision note']}
    ],
    governance:{included:true,title:'Creative intention passport',purpose:'Keep the premise, assumptions, and revision decisions visible.',agreements:['Do not turn either character into an antagonist without an explicit creative decision.','Review the loop rules after the opening sequence.'],reviewQuestion:'Which uncertainty is deliberate, and which uncertainty is merely unresolved?'},
    confidence:.93,
  },actual:{provider:'gemini',model:'gemini-3.5-flash-lite'}}},
};
sandbox.CommonweaveAssistantV141={
  selectedConfig:()=>({provider:'gemini',route:'gemini',model:'gemini-3.5-flash-lite',apiKey:'redacted',externalConsent:true}),
  context:async()=>({currentContext:{systemId:'commonweave'},routingAnswer:{room:'commonweave.quad'}}),
  respond:async()=>({response:{answer:'legacy route'},provider:'legacy',model:'legacy'}),
};
vm.runInContext(orchestratorSource,sandbox,{filename:'commonweave-weaveling-plan-json-v190.js'});
const wish='I want to write a book about a time looper meeting a time traveler in an infinite? loop';
const result=await sandbox.CommonweaveAssistantV141.respond({text:wish,systemId:'commonweave',history:[{role:'user',text:wish}]});
assert(captured,'Gemini structured planning request was not made.');
assert(captured.purpose==='commonweave-weaveling-intention-json-v190','Structured plan purpose was not selected.');
assert(captured.schema?.properties?.paths?.items?.properties?.realm,'Plan JSON schema was not supplied to the provider.');
assert(/Preserve the user's actual premise/.test(captured.messages?.[0]?.content||''),'System prompt does not protect the user premise.');
assert(/ambiguity visible/.test(captured.messages?.[0]?.content||''),'System prompt does not preserve ambiguity as an assumption.');
assert(captured.context?.workingMemory?.currentProfile?.constraints.includes('premise ambiguous'),'Working Campus profile was not supplied as working context.');
assert(result.provider==='gemini'&&result.model==='gemini-3.5-flash-lite','Provider attribution was lost.');
assert(result.plan?.authoring?.mode==='model-structured-json','Plan is not marked as model-authored structured JSON.');
assert(/meeting a time traveler/i.test(result.plan.title),'Model-authored premise was not preserved.');
assert(!/anomaly eraser|pursued by/i.test(JSON.stringify(result.plan)),'Old canned anomaly-erasure premise leaked into the model-authored plan.');
assert(result.plan.paths.every(path=>Array.isArray(path.progress)&&path.status==='ready'),'Generated paths are not normalized for Working Campus progress tracking.');
const saved=JSON.parse(storage.getItem('commonweave.intentions.v127')||'[]');
assert(saved.length===1&&saved[0].plan.id===result.plan.id,'Model-authored weave was not persisted canonically.');
const activation=await sandbox.CommonweaveAssistantV141.respond({text:'Activate',systemId:'commonweave',history:[]});
assert(activateCalls===1,'Plain-language Activate did not operate the latest saved weave.');
assert(activation.planControl?.action==='activate'&&activation.plan?.state==='active','Activation response did not expose the active plan state.');
assert(captured.purpose==='commonweave-weaveling-intention-json-v190','Activation incorrectly made another model call.');
assert(campusPart.includes('/extensions/commonweave-weaveling-plan-json-v190.js'),'Working Campus does not load the structured-plan orchestrator.');
assert(campusPart.includes('syncPlanResult(result)'),'Working Campus does not synchronize model-authored plans into the visible workspace.');
assert(workerSource.includes('/extensions/commonweave-weaveling-plan-json-v190.js'),'Installed package does not cache the structured-plan orchestrator.');
console.log(JSON.stringify({ok:true,revision:'v190-weaveling-plan-json',provider:'gemini',schema:true,premisePreserved:true,ambiguityPreserved:true,workingContext:true,plainLanguageActivation:true,deterministicPlanner:'fallback-only-for-external-provider-failure'},null,2));
