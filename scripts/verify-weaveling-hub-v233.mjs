import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [hub,runtime,sharedChat,materialization,modelFirst,scrollCss,sharedLoader,assistantRuntime,versionText,packageSource]=await Promise.all([
  readFile(path.join(root,'public/app/weaveling-hub-v233.js'),'utf8'),
  readFile(path.join(root,'public/app/working-campus-v156.js'),'utf8'),
  readFile(path.join(root,'public/app/persistent-guide-chat-v215.js'),'utf8'),
  readFile(path.join(root,'public/app/weaveling-plan-materialization-v265.js'),'utf8'),
  readFile(path.join(root,'public/app/weaveling-model-first-plan-v266.js'),'utf8'),
  readFile(path.join(root,'public/app/weaveling-scroll-owner-v265.css'),'utf8'),
  readFile(path.join(root,'public/app/shared-guide-surface-v236.js'),'utf8'),
  readFile(path.join(root,'public/app/assistant-runtime-v141.js'),'utf8'),
  readFile(path.join(root,'VERSION'),'utf8'),
  readFile(path.join(root,'package.json'),'utf8')
]);

const version=versionText.trim();
const pkg=JSON.parse(packageSource);
assert.equal(pkg.version,version,'package.json and VERSION must stay synchronized.');
assert.match(version,/^\d+\.\d+\.\d+$/,'Civweave release version must remain semantic.');

for(const heading of ['AGENT REPORTS','CHRONICLE','REPORT IN'])assert(hub.includes(heading),`Missing Weaveling hub section: ${heading}`);
for(const key of ['civweave.agent-reports.v1','civweave.chronicles.v1','civweave.user-updates.v1'])assert(hub.includes(key),`Missing hub local contract: ${key}`);
assert(hub.includes("'/app/persistent-guide-chat-v215.js'"),'Hub must reuse the shared persistent guide chat runtime.');
assert(hub.includes("'/app/persistent-guide-viewport-v216.js'"),'Hub must reuse the shared guide viewport runtime.');
assert(hub.includes("'civweave:user-update-reported'"),'Reported updates must emit the shared user-update event.');
assert(hub.includes("'civweave:agent-report'"),'Hub must accept agent report events.');
assert(hub.includes("'civweave:chronicle-update'"),'Hub must accept Chronicle update events.');
assert(hub.includes('wh233-legacy-bridge'),'Legacy Working Campus chat hooks must be retained only as a hidden compatibility bridge.');
assert(!hub.includes('cwp215-launcher'),'Hub must not clone or fork the shared chat launcher styling.');

assert(runtime.includes("const HUB_SCRIPT='/app/weaveling-hub-v233.js';"),'Working Campus must load the Weaveling hub.');
assert(runtime.includes('await ensureHub();'),'Working Campus must mount the hub before its split runtime starts.');
assert(sharedChat.includes("const LAUNCHER_ID='cwp215-launcher';"),'Shared guide chat launcher contract changed unexpectedly.');
assert(sharedChat.includes('#${LAUNCHER_ID}{'),'Shared guide chat launcher styling is unavailable.');
assert(assistantRuntime.includes('globalThis.CivweaveIntentionPlanner?.maybeCreate'),'Assistant runtime must retain the deterministic local planner as an offline fallback boundary.');

const plannerIndex=sharedLoader.indexOf('/app/intention-planner-v141.js?v=1.0.58-v266-model-first');
const materializationIndex=sharedLoader.indexOf('/app/weaveling-plan-materialization-v265.js?v=1.0.58-v266-materialization');
const modelFirstIndex=sharedLoader.indexOf('/app/weaveling-model-first-plan-v266.js?v=1.0.58-v266');
const sharedCoreIndex=sharedLoader.indexOf('/app/shared-guide-surface-v236-core-v244.js?v=1.0.58-v266');
assert(plannerIndex>=0,'Shared guide loader must guarantee the intention planner.');
assert(materializationIndex>plannerIndex,'Weaveling materialization must load after the canonical planner.');
assert(modelFirstIndex>materializationIndex,'Model-first planning must load after local materialization support.');
assert(sharedCoreIndex>modelFirstIndex,'Shared chat must not mount before model-first Weaveling planning is ready.');
assert(sharedLoader.includes('readyCheck?.()'),'Preloaded planner dependencies must be recognized as ready instead of waiting forever for an already-fired load event.');
assert(sharedLoader.includes('/app/weaveling-scroll-owner-v265.css?v=1.0.58-v265'),'Shared guide must install the Weaveling document-scroll ownership repair.');

for(const marker of ["stage:'review'","view:'weave'",'civweave:working-campus-plan-built','civweave:weave-review-ready','approvalGate','Nothing is active yet','WEAVE GENERATED · REVIEW REQUIRED'])assert(materialization.includes(marker),`Missing reviewable-weave materialization marker: ${marker}`);
assert(materialization.includes("WORKING_KEY='civweave.working-campus.v1'"),'Chat-generated weave must materialize into the visible Working Campus state.');
assert(materialization.includes("INTENTIONS_KEY='civweave.intentions.v127'"),'Review UI must stay linked to the canonical persisted intention record.');

for(const marker of [
  "const PLAN_PURPOSE='weaveling-intention-model-plan-v266'",
  "ELIGIBLE_PROVIDERS=new Set(['gemini','ollama','openai-compatible','hosted'])",
  'Infer the governing intention from the whole conversation',
  'do not use that command as the wish or title',
  "source:'weaveling-model-first-v266'",
  'model-authored-local-materialization',
  'local deterministic planner as the offline-safe fallback'
])assert(modelFirst.includes(marker),`Weaveling model-first boundary is missing ${marker}.`);
assert(modelFirst.includes('if(system!==\'civweave\'||!shouldPlan(options))return original(options)'),'Non-planning chat must still use the normal guide response path.');
assert(modelFirst.includes('if(!config||!modelCapable(config))return original(options)'),'The deterministic planner must remain available when no capable configured model exists.');

assert.match(scrollCss,/#weaveling-hub-v233\{max-height:none!important;overflow:visible!important/,'Weaveling hub must relinquish nested vertical scroll ownership.');
assert.match(scrollCss,/#cw-shared-guide-surface-v236 \.cwsg236-log\{max-height:none!important;overflow:visible!important/,'Shared Weaveling chat log must relinquish nested vertical scroll ownership.');
assert.match(scrollCss,/\.conversation\{height:auto!important;max-height:none!important;overflow:visible!important/,'Mobile Working Campus conversation must expand into document flow.');
assert(scrollCss.includes('touch-action:pan-y'),'Weaveling modules must explicitly preserve vertical touch panning.');

const store=new Map();
const events=[];
const sandbox={
  console,
  location:{pathname:'/app/working-campus-v156.html',href:'https://example.test/app/working-campus-v156.html',reload:()=>{}},
  localStorage:{getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},
  document:{readyState:'loading',documentElement:{dataset:{civweaveSystemRoute:'civweave'}},scripts:[],styleSheets:[],getElementById:()=>null,querySelector:()=>null,createElement:tag=>({tagName:String(tag).toUpperCase(),dataset:{},setAttribute(){},addEventListener(){}}),head:{append(){}},body:{}},
  addEventListener:()=>{},dispatchEvent:event=>{events.push(event);return true},CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  setTimeout:()=>0,setInterval:()=>0,clearInterval:()=>{},queueMicrotask:fn=>fn(),URL,structuredClone:globalThis.structuredClone
};
sandbox.globalThis=sandbox;
sandbox.CivweaveIntentionPlanner={
  maybeCreate:()=>({plan:{id:'intention-test',title:'Community Garden',wish:'Help me create and manage a community garden',profile:{},paths:[{id:'learning'}]},item:{id:'intention-test'},response:{answer:'Drafted route.',choice:{mode:'Plan'},requiresConsent:true}}),
  restore:()=>true
};
vm.runInNewContext(materialization,sandbox,{filename:'weaveling-plan-materialization-v265.js'});
assert.equal(sandbox.CivweaveWeavelingPlanMaterializationV265.patchPlanner(),true,'Materialization bridge must wrap the canonical planner.');
const generated=sandbox.CivweaveIntentionPlanner.maybeCreate({text:'Help me create and manage a community garden'});
const working=JSON.parse(store.get('civweave.working-campus.v1'));
assert.equal(working.stage,'review','A real chat-generated intention must place Working Campus into review.');
assert.equal(working.view,'weave','A real chat-generated intention must expose the weave view.');
assert.equal(working.plan.id,'intention-test','The visible review state must contain the same canonical plan.');
assert.equal(working.reviewReady.planId,'intention-test','Visible state must carry an explicit review-ready signal.');
assert.match(generated.response.answer,/generated and saved the reviewable weave/i,'Weaveling must clearly distinguish materialization from conversational planning.');
assert.equal(generated.response.approvalGate.state,'review','Materialized plan must remain behind review approval.');
assert.equal(generated.response.approvalGate.required,true,'Materialized plan must not activate without approval.');
assert(events.some(event=>event.type==='civweave:working-campus-plan-built'),'Materialization must emit the existing Working Campus plan-built event.');
assert(events.some(event=>event.type==='civweave:weave-review-ready'),'Materialization must emit the explicit review-ready event.');

const modelEvents=[];
let materialized=null,persisted=null,modelCalls=0,localCalls=0;
const modelSandbox={
  console,
  document:{readyState:'loading'},
  addEventListener:()=>{},removeEventListener:()=>{},dispatchEvent:event=>{modelEvents.push(event);return true},
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  setInterval:()=>0,clearInterval:()=>{},queueMicrotask:fn=>fn(),structuredClone:globalThis.structuredClone
};
modelSandbox.globalThis=modelSandbox;
modelSandbox.CivweaveIntentionPlanner={
  shouldCreate:()=>true,
  buildPlan:({text})=>({schema:'civweave.intention-weave.v1',id:'model-plan-1',wish:text,title:text,outcome:'fallback outcome',profile:{},assumptions:[],paths:[{id:'learning-base',type:'learning',realm:'living-school',title:'Learn',purpose:'Learn',steps:[],completionCriteria:'Learned',evidence:[]},{id:'skilled-base',type:'skilled-labor',realm:'cerbanimo',title:'Build',purpose:'Build',steps:[],completionCriteria:'Built',evidence:[]},{id:'material-base',type:'material-acquirement',realm:'fellowfare',title:'Acquire',purpose:'Acquire',steps:[],completionCriteria:'Acquired',evidence:[]}],governance:{realm:'anarchadia',title:'Consent',purpose:'Review',agreements:[],reviewQuestion:'Who agrees?'},routing:{room:'civweave.quad'},createdAt:'2026-08-09T00:00:00Z'}),
  persist:plan=>{persisted=globalThis.structuredClone(plan);return{id:plan.id,state:'review',plan}},
  format:plan=>`MODEL WEAVE: ${plan.title}`
};
modelSandbox.CivweaveWeavelingPlanMaterializationV265={materialize:(plan,options)=>{materialized={plan:globalThis.structuredClone(plan),options};return true}};
modelSandbox.CivweaveModelRuntime={
  readSharedConfig:()=>({provider:'gemini',model:'gemini-3.1-flash-lite',timeoutMs:90000,maxTokens:4096,temperature:.2}),
  generate:async request=>{modelCalls+=1;assert.equal(request.purpose,'weaveling-intention-model-plan-v266');assert.equal(request.config.timeoutMs,25000);return{status:'success',actual:{provider:'gemini',model:'gemini-3.1-flash-lite'},outputJson:{wish:'Help me create and manage a community garden',title:'Create and Sustain a Community Garden',outcome:'Launch and sustain a community-run garden with land, people, resources, and operating agreements in place.',assumptions:['The user is starting from the beginning.'],paths:[{realm:'living-school',title:'Learn garden and community fundamentals',purpose:'Learn site, crop, safety, and organizing basics.',steps:['Assess sunlight, soil, water, and local requirements.','Learn seasonal planting and shared-garden operating patterns.'],completionCriteria:'A source-backed site and operating brief exists.',evidence:['Site criteria sheet','Source pack']},{realm:'cerbanimo',title:'Build the first garden pilot',purpose:'Turn the concept into a bounded launch.',steps:['Define the smallest viable garden.','Recruit initial collaborators.','Prepare and launch the first beds.'],completionCriteria:'The pilot garden is operating with named responsibilities.',evidence:['Pilot plan','Build photos','Role list']},{realm:'fellowfare',title:'Secure land, tools, seeds, and services',purpose:'Make resource needs explicit and source them fairly.',steps:['Create a needs list.','Compare borrow, trade, donation, and purchase options.'],completionCriteria:'Critical launch resources are confirmed.',evidence:['Needs map','Confirmed resource list']}],governance:{title:'Community garden agreements',purpose:'Keep roles, spending, access, harvest, and conflict rules explicit.',agreements:['Name decision rights.','Require explicit approval for spending and commitments.','Set a review date.'],reviewQuestion:'Who must consent before the garden moves from pilot to active community operation?'}}};}
};
modelSandbox.CivweaveAssistantV141={respond:async()=>{localCalls+=1;return{provider:'civweave-planner',response:{answer:'LOCAL PLAN'}}}};
vm.runInNewContext(modelFirst,modelSandbox,{filename:'weaveling-model-first-plan-v266.js'});
assert.equal(modelSandbox.CivweaveWeavelingModelFirstPlanV266.patchAssistant(),true,'Model-first bridge must patch the guide assistant.');
const modelResult=await modelSandbox.CivweaveAssistantV141.respond({systemId:'civweave',text:'Make a plan from the above',history:[{role:'user',text:'Help me create and manage a community garden'},{role:'assistant',text:'We should consider site, team, funding, design, and operations.'}]});
assert.equal(modelCalls,1,'A configured Gemini route must author the intention before deterministic planning is considered.');
assert.equal(localCalls,0,'The local planner must not preempt a successful configured Gemini plan.');
assert.equal(modelResult.provider,'gemini','The reviewable weave must retain the actual model provider.');
assert.equal(modelResult.model,'gemini-3.1-flash-lite','The reviewable weave must retain the actual model identity.');
assert.equal(modelResult.plan.title,'Create and Sustain a Community Garden','Model-authored title must survive local materialization.');
assert.equal(modelResult.plan.wish,'Help me create and manage a community garden','Meta-command must not become the saved governing wish.');
assert.notEqual(modelResult.plan.title,'Make a plan from the above','Meta-command must never become the plan title when the thread contains the real wish.');
assert.equal(persisted.authorship.kind,'model-authored-local-materialization','Persisted plan must declare model authorship and local materialization.');
assert.equal(materialized.options.source,'weaveling-model-first-v266','Model-authored plan must enter the canonical review materializer.');
assert.equal(modelResult.response.approvalGate.state,'review','Model-authored weave must remain behind the review gate.');

modelSandbox.CivweaveModelRuntime.generate=async()=>{throw new Error('Gemini unavailable')};
modelSandbox.CivweaveAssistantV141={respond:async()=>{localCalls+=1;return{provider:'civweave-planner',response:{answer:'LOCAL PLAN',choice:{}}}};
assert.equal(modelSandbox.CivweaveWeavelingModelFirstPlanV266.patchAssistant(),true,'Model-first bridge must repatch a replaced assistant runtime.');
const fallback=await modelSandbox.CivweaveAssistantV141.respond({systemId:'civweave',text:'Make a plan from the above',history:[{role:'user',text:'Help me create and manage a community garden'}]});
assert.equal(fallback.provider,'civweave-planner','Provider failure must fall back to the local planner rather than losing planning entirely.');
assert.equal(fallback.fallbackFrom.provider,'gemini','Fallback must say which configured provider failed.');
assert.match(fallback.response.answer,/local deterministic planner as the offline-safe fallback/i,'Local fallback must be explicit rather than silently masquerading as model authorship.');

console.log(JSON.stringify({ok:true,version,revision:'weaveling-hub-v233+materialization-v265+model-first-v266',sections:['agent-reports','chronicle','report-in'],chatLauncher:'persistent-guide-chat-v215',reviewMaterialization:'working-campus-review-v265',planAuthor:'configured-model-first-v266',offlineFallback:'explicit-local-planner',scrollOwner:'document-v265'},null,2));
