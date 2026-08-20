import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const [plannerSource,orchestratorSource,campusPart,legacyWorker,workerWrapper,workerCore,offlineManifestText]=await Promise.all([
  readFile('public/app/intention-planner-v141.js','utf8'),
  readFile('public/extensions/civweave-weaveling-plan-json-v190.js','utf8'),
  readFile('public/app/working-campus-v156.part5.txt','utf8'),
  readFile('public/service-worker-v156.js','utf8'),
  readFile('public/service-worker-v203.js','utf8'),
  readFile('public/service-worker-core-v208.js','utf8'),
  readFile('public/app/offline-package-v208.json','utf8'),
]);
const offlineManifest=JSON.parse(offlineManifestText);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
class MemoryStorage{constructor(seed={}){this.values=new Map(Object.entries(seed))}getItem(key){return this.values.has(key)?this.values.get(key):null}setItem(key,value){this.values.set(key,String(value))}removeItem(key){this.values.delete(key)}}
const storage=new MemoryStorage({
  'civweave.working-campus.v1':JSON.stringify({wish:'',profile:{collaboration:'friends',hours:'3-5',constraints:'Keep the first version small enough for the group to maintain.'},plan:null,conversation:[]}),
  'civweave.intentions.v127':'[]',
  'civweave.realm-inbox.v1':'[]',
  'civweave.local-ai.selection.v266':JSON.stringify({active:true,id:'gemma4-e2b-it-q4f16'})
});
let captured=null,generateCalls=0,activateCalls=0,openCalls=0,selection={active:true,id:'gemma4-e2b-it-q4f16'};
const sandbox={
  console,Date,Math,structuredClone,localStorage:storage,
  CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},dispatchEvent(){},
  DOMException:globalThis.DOMException,
  globalThis:null,
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(plannerSource,sandbox,{filename:'intention-planner-v141.js'});
sandbox.CivweaveIntentionUI={
  activate(id){activateCalls++;const items=JSON.parse(storage.getItem('civweave.intentions.v127')||'[]'),item=items.find(entry=>entry.id===id);if(!item)return{ok:false,error:'missing'};item.state='active';item.plan.state='active';storage.setItem('civweave.intentions.v127',JSON.stringify(items));return{ok:true,item}},
  review(id){const items=JSON.parse(storage.getItem('civweave.intentions.v127')||'[]'),item=items.find(entry=>entry.id===id);if(!item)return{ok:false,error:'missing'};item.state='review';item.plan.state='review';storage.setItem('civweave.intentions.v127',JSON.stringify(items));return{ok:true,item}},
  open(){openCalls++;},
};
sandbox.CivweaveLocalModelDownloadV266={selection:()=>selection};
sandbox.CivweaveModelRuntime={
  async generate(request){
    generateCalls++;captured=request;
    return{status:'success',structured:{requested:true,valid:true,repairAttempts:0},outputJson:{
      title:'Build a community garden with my friends',
      wish:'I want to make a community garden with my friends',
      outcome:'Create a first shared growing space that the group can actually maintain together and improve after one planting cycle.',
      assumptions:['The friends want to share recurring care rather than assign the garden to one person.','The site, climate, budget, and crop preferences still need to be chosen by the group.'],
      paths:[
        {type:'learning',realm:'living-school',title:'Choose a workable site and first-season crops',purpose:'Learn only what the group needs to make a site and planting decision.',steps:['Compare the candidate sites for sun, water, permission, and accessibility.','Identify the local planting window and choose a short first-season crop list.','Check whether soil testing, raised beds, or containers are needed for the chosen site.'],completionCriteria:'The friends can explain why the chosen site and crop list fit their actual conditions.',evidence:['Site comparison','First-season crop list','Soil or bed decision']},
        {type:'skilled-labor',realm:'cerbanimo',title:'Build and run the first shared garden cycle',purpose:'Turn the group’s choices into a garden and a maintenance rhythm that survives missed days.',steps:['Agree on the first build day and divide only the work people consent to take on.','Prepare the chosen beds or containers and plant the agreed crops.','Create a watering and maintenance rotation with an easy swap process.','Review the workload together after four weeks and revise it before expanding.'],completionCriteria:'The first garden is planted and recurring care can continue without depending on one friend.',evidence:['Build-day record','Planting map','Maintenance rotation','Four-week group review']},
        {type:'material-acquirement',realm:'fellowfare',title:'Source only the materials this first garden needs',purpose:'Keep the first cycle affordable by separating what can be borrowed or reused from what must be bought.',steps:['List the soil, compost, seeds or seedlings, watering gear, tools, and bed materials required by the chosen design.','Mark what each friend can contribute, borrow, reclaim, or source locally.','Agree on any shared spending before purchases are made.'],completionCriteria:'Everything needed for the first build and planting day is available without unapproved spending.',evidence:['Materials list','Contribution/source map','Agreed shared-spending record']}
      ],
      governance:{included:true,title:'Share care, spending, and harvest decisions',purpose:'Keep friendship from carrying unclear obligations.',agreements:['Let people swap or decline maintenance shifts without losing access to the group.','Get explicit agreement before shared spending or major site changes.','Decide together how the first harvest will be shared before harvesting begins.'],reviewQuestion:'Does everyone responsible for recurring care consider the current workload and sharing rules workable?'},
      confidence:.94,
    },actual:{provider:'downloaded-local',model:'gemma4-e2b-it-q4f16'}};
  },
};
sandbox.CivweaveAssistantV141={
  selectedConfig:()=>({provider:'downloaded-local',route:'downloaded-local',model:'gemma4-e2b-it-q4f16',externalConsent:false}),
  context:async()=>({currentContext:{systemId:'civweave'},routingAnswer:{room:'civweave.quad'}}),
  respond:async()=>({response:{answer:'legacy route'},provider:'legacy',model:'legacy'}),
};
vm.runInContext(orchestratorSource,sandbox,{filename:'civweave-weaveling-plan-json-v190.js'});
const wish='I want to make a community garden with my friends';
const result=await sandbox.CivweaveAssistantV141.respond({text:wish,systemId:'civweave',history:[{role:'user',text:wish}]});
assert(captured,'AI structured planning request was not made.');
assert(captured.purpose==='civweave-weaveling-intention-json-v190','Structured Quest purpose was not selected.');
assert(captured.schema?.properties?.paths?.items?.properties?.realm,'Quest JSON schema was not supplied to the AI runtime.');
assert(typeof captured.transport==='function','Downloaded-local Quest generation did not receive the local-AI transport adapter.');
assert(!('fallback'in captured),'Deterministic Quest fallback is still attached to the AI request.');
assert(/user-specific Quest content/.test(captured.messages?.[0]?.content||''),'Quest prompt does not make the AI responsible for customization.');
assert(/specific to this user's request/.test(captured.messages?.[0]?.content||''),'Quest prompt does not require request-specific steps.');
assert(captured.context?.workingMemory?.currentProfile?.collaboration==='friends','Working Campus profile was not supplied as AI context.');
assert(result.provider==='downloaded-local'&&result.model==='gemma4-e2b-it-q4f16','Downloaded local AI provider attribution was lost.');
assert(result.plan?.authoring?.mode==='model-structured-json'&&result.plan?.authoring?.aiGenerated===true,'Quest is not marked as AI-authored structured JSON.');
assert(result.questAuthoring?.aiGenerated===true,'Quest response does not expose AI authoring provenance.');
assert(/community garden/i.test(result.plan.title),'AI-authored community-garden premise was not preserved.');
assert(/sun|water|permission/i.test(JSON.stringify(result.plan)),'AI-authored Quest customization was lost during normalization.');
assert(result.plan.paths.every(path=>Array.isArray(path.progress)&&path.status==='ready'),'Generated paths are not normalized for Working Campus progress tracking.');
let saved=JSON.parse(storage.getItem('civweave.intentions.v127')||'[]');
assert(saved.length===1&&saved[0].plan.id===result.plan.id,'AI-authored Quest was not persisted canonically.');
const activation=await sandbox.CivweaveAssistantV141.respond({text:'Activate',systemId:'civweave',history:[]});
assert(activateCalls===1,'Plain-language Activate did not operate the latest saved Quest.');
assert(activation.planControl?.action==='activate'&&activation.plan?.state==='active','Activation response did not expose the active Quest state.');
assert(generateCalls===1,'Activation incorrectly made another AI generation call.');

storage.setItem('civweave.intentions.v127','[]');
sandbox.CivweaveModelRuntime.generate=async request=>{generateCalls++;captured=request;return{status:'provider-error',structured:{requested:true,valid:false},outputText:'',error:{code:'LOCAL_MODEL_FAILED',message:'Selected AI failed to generate the Quest.'},actual:{provider:'downloaded-local',model:'gemma4-e2b-it-q4f16'}}};
const failed=await sandbox.CivweaveAssistantV141.respond({text:'I want to organize a neighborhood tool library',systemId:'civweave',history:[]});
saved=JSON.parse(storage.getItem('civweave.intentions.v127')||'[]');
assert(saved.length===0,'A Quest was persisted after AI generation failed.');
assert(failed.plan==null&&failed.questAuthoring?.aiGenerated===false&&failed.questAuthoring?.questCreated===false,'AI failure did not return a no-Quest state.');
assert(/Nothing was created or saved/.test(failed.response?.answer||''),'AI failure response does not clearly state that no Quest was created.');

selection={active:false,id:null};
storage.setItem('civweave.local-ai.selection.v266',JSON.stringify(selection));
sandbox.CivweaveAssistantV141.selectedConfig=()=>({provider:'deterministic',route:'deterministic',model:'deterministic-compiler'});
const deterministic=await sandbox.CivweaveAssistantV141.respond({text:'I want to start a neighborhood repair club',systemId:'civweave',history:[]});
saved=JSON.parse(storage.getItem('civweave.intentions.v127')||'[]');
assert(saved.length===0,'A deterministic route created a Quest without AI generation.');
assert(deterministic.questAuthoring?.aiGenerated===false&&deterministic.plan==null,'Deterministic Quest attempt did not fail closed.');

assert(campusPart.includes('/extensions/civweave-weaveling-plan-json-v190.js'),'Working Campus does not load the structured Quest orchestrator.');
assert(campusPart.includes('syncPlanResult(result)'),'Working Campus does not synchronize AI-authored Quests into the visible workspace.');
assert(legacyWorker.includes("importScripts('/service-worker-v203.js"),'Legacy registrations do not reach the active worker wrapper.');
assert(workerWrapper.includes("importScripts('/service-worker-core-v208.js"),'Active worker wrapper does not load the retained offline core.');
assert(workerCore.includes('discoverReferences')&&workerCore.includes('DOWNLOAD_OFFLINE_PACKAGE'),'Offline campus no longer discovers and stores seed dependencies.');
assert(offlineManifest.seeds.includes('/app/working-campus-v156.html'),'Offline campus no longer seeds the Working Campus.');
assert(offlineManifest.includePrefixes.includes('/extensions/'),'Offline campus excludes extension runtimes discovered from Working Campus.');
console.log(JSON.stringify({ok:true,revision:'v190-weaveling-ai-required-quest',provider:'downloaded-local',schema:true,localStructuredTransport:true,requestSpecificAIContent:true,deterministicQuestFallback:false,aiFailurePersistsNothing:true,plainLanguageActivation:true,offlinePackaged:'discovered-from-working-campus'},null,2));
