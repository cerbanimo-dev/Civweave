import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const [plannerSource,researchSource,indexHtml,worker,installBoundary]=await Promise.all([
  readFile('public/app/intention-planner-v141.js','utf8'),
  readFile('public/app/cabinets/living-school/living-school-research-v162.js','utf8'),
  readFile('public/app/cabinets/living-school/index.html','utf8'),
  readFile('public/service-worker-v156.js','utf8'),
  readFile('public/app/install-boundary-v146.js','utf8')
]);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
class MemoryStorage{constructor(seed={}){this.values=new Map(Object.entries(seed))}getItem(key){return this.values.has(key)?this.values.get(key):null}setItem(key,value){this.values.set(key,String(value))}removeItem(key){this.values.delete(key)}}

const plannerStorage=new MemoryStorage();
const plannerSandbox={console,Date,Math,structuredClone,localStorage:plannerStorage,CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},dispatchEvent(){},globalThis:null};
plannerSandbox.globalThis=plannerSandbox;vm.createContext(plannerSandbox);vm.runInContext(plannerSource,plannerSandbox,{filename:'intention-planner-v141.js'});
const planner=plannerSandbox.CommonweaveIntentionPlanner,context={currentContext:{systemId:'commonweave'},routingAnswer:{room:'commonweave.quad'}};
const history=[];
const add=(text)=>history.push({role:'user',text});
add('Learn how to make video games with AI so I can make a game about a time traveler and a time looper interacting');
let plan=planner.buildPlan({text:history.at(-1).text,history,context});
assert(plan.signals.game&&plan.title.toLowerCase().includes('game'),'Initial game intention was not recognized.');
add('I want to make a community garden to table restaurant by making my own garden and also partnering with local gardens');
plan=planner.buildPlan({text:history.at(-1).text,history,context});
assert(plan.signals.restaurant&&plan.signals.garden&&!plan.signals.game,'Fresh garden-to-table wish inherited stale game signals.');
assert(plan.title.toLowerCase().includes('garden-to-table restaurant'),'Garden-to-table title did not follow the latest wish.');
assert(plan.sourceConversation.length===1&&plan.sourceConversation[0]===history.at(-1).text,'Planner retained unrelated prior wishes in the active source conversation.');
add('I want to make a book about a time looper who gets chased by a time traveling anomaly eraser');
plan=planner.buildPlan({text:history.at(-1).text,history,context});
assert(plan.signals.book&&!plan.signals.game,'Book wish was incorrectly classified as a game.');
assert(plan.title.toLowerCase().includes('book')&&!plan.outcome.toLowerCase().includes('playable'),'Book plan still contains game output.');
assert(plan.paths.some(path=>/manuscript|draft/i.test(`${path.title} ${path.purpose}`)),'Book plan does not contain manuscript work.');
add('I want to make a book not a game');
plan=planner.buildPlan({text:history.at(-1).text,history,context});
assert(plan.signals.book&&!plan.signals.game,'Explicit “not a game” correction failed.');
add('I want to learn how to love myself');
plan=planner.buildPlan({text:history.at(-1).text,history,context});
assert(plan.signals.selfLove&&!plan.signals.game&&!plan.signals.book,'Self-love wish inherited a stale creative-project signal.');
assert(/self-love|self-compassion/i.test(`${plan.title} ${plan.outcome}`),'Self-love plan did not reflect the latest request.');
assert(plan.assumptions.some(value=>/not a diagnosis|professional care/i.test(value)),'Self-love plan lacks its support boundary.');
const savedGame=planner.maybeCreate({text:history[0].text,history:[history[0]],context});
const savedBook=planner.maybeCreate({text:history[2].text,history:history.slice(0,3),context});
assert(savedGame.item.id!==savedBook.item.id,'Distinct wishes collapsed into one persisted plan.');

function researchContext(generate){
  const storage=new MemoryStorage({'commonweave.living-school.cabinet.v151':JSON.stringify({schema:'living-school-cabinet-v151',sources:[],events:[]})});
  const document={readyState:'complete',body:{},querySelector(){return null},querySelectorAll(){return[]},addEventListener(){}};
  const runtime={readSharedConfig(profile){return profile==='agentic'?{provider:'gemini',model:'antigravity',externalConsent:true}:{provider:'gemini',model:'gemini-3.5-flash-lite',externalConsent:true}},generate};
  const sandbox={console,Date,Math,URL,Event,FormData,localStorage:storage,document,location:{href:'https://example.test/app'},MutationObserver:class{observe(){}},StorageEvent:class{},CustomEvent:class{},dispatchEvent(){},addEventListener(){},setTimeout,clearTimeout,globalThis:null,CommonweaveFamilyAILoaderV105:{ensure:async()=>true},CommonweaveModelRuntime:runtime};
  sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(researchSource,sandbox,{filename:'living-school-research-v162.js'});return sandbox;
}
let calls=[];
let researchSandbox=researchContext(async request=>{calls.push(request);return{status:'success',outputJson:{summary:'Live packet',sources:[{title:'Official guide',url:'https://example.org/guide',quality:'authoritative',use:'core',notes:'Opened and inspected.',sourceType:'web',liveFetched:true}]},actual:{provider:'gemini',model:'antigravity'}}});
let packet=await researchSandbox.LivingSchoolResearchV162.gather('safe community gardening');
assert(packet.mode==='live-agentic'&&packet.sources[0].verified===true,'Antigravity live research did not produce verified provenance.');
assert(calls.length===1&&calls[0].executionProfile==='agentic'&&calls[0].config.model==='antigravity','Live research did not stay on the Antigravity agentic profile.');

calls=[];
researchSandbox=researchContext(async request=>{calls.push(request);if(request.executionProfile==='agentic')return{status:'error',error:{message:'No internet or YouTube tools reachable'}};return{status:'success',outputJson:{summary:'Training knowledge only',notes:[{title:'Core concepts',use:'core',content:'Background concepts from model training knowledge.',uncertainty:'Verify current local rules.'}]},actual:{provider:'gemini',model:'gemini-3.5-flash-lite'}}});
packet=await researchSandbox.LivingSchoolResearchV162.gather('garden-to-table restaurant licensing');
assert(packet.mode==='model-derived-unverified','Gemini training-data fallback was not selected after live research failed.');
assert(packet.sources.every(source=>source.verified===false&&!source.url&&/MODEL-DERIVED|NO LIVE SOURCE/i.test(`${source.title} ${source.provenanceFlag}`)),'Training-data fallback is not conspicuously flagged.');
assert(calls.length===2&&calls[0].executionProfile==='agentic'&&calls[1].executionProfile==='interactive','Research routing did not try Antigravity before Gemini fallback.');
assert(calls[1].config.model==='gemini-3.5-flash-lite','Fallback did not use the primary Gemini profile only after Antigravity failure.');

for(const token of ['/app/cabinets/living-school/living-school-research-v162.js','agentic-research-v162'])assert(indexHtml.includes(token),`Living School index is missing ${token}.`);
for(const token of ['/app/intention-planner-v141.js','/app/cabinets/living-school/living-school-research-v162.js',"INTENTION_RESEARCH_REVISION='latest-intention-agentic-research-v162'"])assert(worker.includes(token),`Installed package is missing ${token}.`);
assert(installBoundary.includes("additionsVersion:'v162-latest-intention-agentic-research'"),'Install boundary did not rotate to v162.');
console.log(JSON.stringify({ok:true,planner:'latest-intention-only',corrections:['not-a-game','fresh-wish'],researchPrimary:'antigravity-agentic',researchFallback:'gemini-training-data-flagged',liveSourcesRequired:true},null,2));
