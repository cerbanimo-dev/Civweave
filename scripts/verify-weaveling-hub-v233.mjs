import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [hub,runtime,sharedChat,materialization,modelFirst,scrollCss,sharedLoader,assistantRuntime,versionText,packageSource]=await Promise.all([
  read('public/app/weaveling-hub-v233.js'),read('public/app/working-campus-v156.js'),read('public/app/persistent-guide-chat-v215.js'),
  read('public/app/weaveling-plan-materialization-v265.js'),read('public/app/weaveling-model-first-plan-v266.js'),read('public/app/weaveling-scroll-owner-v265.css'),
  read('public/app/shared-guide-surface-v236.js'),read('public/app/assistant-runtime-v141.js'),read('VERSION'),read('package.json')
]);
const version=versionText.trim(),pkg=JSON.parse(packageSource);
assert.equal(pkg.version,version,'package.json and VERSION must stay synchronized.');
assert.match(version,/^\d+\.\d+\.\d+$/,'Civweave release version must remain semantic.');
for(const heading of ['AGENT REPORTS','CHRONICLE','REPORT IN'])assert(hub.includes(heading),`Missing Weaveling hub section: ${heading}`);
for(const key of ['civweave.agent-reports.v1','civweave.chronicles.v1','civweave.user-updates.v1'])assert(hub.includes(key),`Missing hub local contract: ${key}`);
assert(hub.includes("'/app/persistent-guide-chat-v215.js'"),'Hub must reuse the shared persistent guide chat runtime.');
assert(hub.includes("'/app/persistent-guide-viewport-v216.js'"),'Hub must reuse the shared guide viewport runtime.');
assert(hub.includes('wh233-legacy-bridge'),'Legacy Working Campus chat hooks must remain only as a hidden compatibility bridge.');
assert(!hub.includes('cwp215-launcher'),'Hub must not clone or fork the shared chat launcher styling.');
assert(runtime.includes("const HUB_SCRIPT='/app/weaveling-hub-v233.js';")&&runtime.includes('await ensureHub();'),'Working Campus must mount the Weaveling hub before its split runtime starts.');
assert(sharedChat.includes("const LAUNCHER_ID='cwp215-launcher';")&&sharedChat.includes('#${LAUNCHER_ID}{'),'Shared guide chat launcher contract is unavailable.');
assert(assistantRuntime.includes('globalThis.CivweaveIntentionPlanner?.maybeCreate'),'Assistant runtime must retain the deterministic local planner as an offline fallback boundary.');

const plannerIndex=sharedLoader.indexOf('/app/intention-planner-v141.js?v=1.0.58-v266-model-first');
const materializationIndex=sharedLoader.indexOf('/app/weaveling-plan-materialization-v265.js?v=1.0.58-v266-materialization');
const modelFirstIndex=sharedLoader.indexOf('/app/weaveling-model-first-plan-v266.js?v=1.0.58-v266');
const sharedCoreIndex=sharedLoader.indexOf('/app/shared-guide-surface-v236-core-v244.js?v=1.0.58-v266');
assert(plannerIndex>=0&&materializationIndex>plannerIndex&&modelFirstIndex>materializationIndex&&sharedCoreIndex>modelFirstIndex,'Shared guide load order must be planner -> materializer -> model-first planner -> shared chat.');
assert(sharedLoader.includes('readyCheck?.()'),'Preloaded dependencies must be recognized as ready.');
assert(sharedLoader.includes('/app/weaveling-scroll-owner-v265.css?v=1.0.58-v265'),'Shared guide must install the document-scroll ownership repair.');
for(const marker of ["stage:'review'","view:'weave'",'civweave:working-campus-plan-built','civweave:weave-review-ready','approvalGate','WEAVE GENERATED · REVIEW REQUIRED'])assert(materialization.includes(marker),`Missing review materialization marker: ${marker}`);
for(const marker of ["const PLAN_PURPOSE='weaveling-intention-model-plan-v266'","ELIGIBLE_PROVIDERS=new Set(['gemini','ollama','openai-compatible','hosted'])",'Infer the governing intention from the whole conversation','do not use that command as the wish or title',"source:'weaveling-model-first-v266'",'model-authored-local-materialization','local deterministic planner as the offline-safe fallback'])assert(modelFirst.includes(marker),`Model-first boundary is missing ${marker}.`);
assert(modelFirst.includes("if(system!=='civweave'||!shouldPlan(options))return original(options)"),'Non-planning chat must remain on the normal guide path.');
assert(modelFirst.includes('if(!config||!modelCapable(config))return original(options)'),'Local planning must remain available when no capable configured model exists.');
assert.match(scrollCss,/#weaveling-hub-v233\{max-height:none!important;overflow:visible!important/,'Weaveling hub must relinquish nested vertical scrolling.');
assert.match(scrollCss,/#cw-shared-guide-surface-v236 \.cwsg236-log\{max-height:none!important;overflow:visible!important/,'Shared Weaveling log must relinquish nested vertical scrolling.');

const store=new Map(),events=[];
const sandbox={console,location:{pathname:'/app/working-campus-v156.html',href:'https://example.test/app/working-campus-v156.html',reload(){}},localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},document:{readyState:'loading',documentElement:{dataset:{civweaveSystemRoute:'civweave'}},scripts:[],styleSheets:[],getElementById:()=>null,querySelector:()=>null,createElement:tag=>({tagName:String(tag).toUpperCase(),dataset:{},setAttribute(){},addEventListener(){}}),head:{append(){}},body:{}},addEventListener(){},dispatchEvent:event=>{events.push(event);return true},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},setTimeout:()=>0,setInterval:()=>0,clearInterval(){},queueMicrotask:fn=>fn(),URL,structuredClone:globalThis.structuredClone};
sandbox.globalThis=sandbox;
sandbox.CivweaveIntentionPlanner={maybeCreate:()=>({plan:{id:'intention-test',title:'Community Garden',wish:'Help me create and manage a community garden',profile:{},paths:[{id:'learning'}]},item:{id:'intention-test'},response:{answer:'Drafted route.',choice:{mode:'Plan'},requiresConsent:true}}),restore:()=>true};
vm.runInNewContext(materialization,sandbox,{filename:'weaveling-plan-materialization-v265.js'});
assert.equal(sandbox.CivweaveWeavelingPlanMaterializationV265.patchPlanner(),true);
const generated=sandbox.CivweaveIntentionPlanner.maybeCreate({text:'Help me create and manage a community garden'}),working=JSON.parse(store.get('civweave.working-campus.v1'));
assert.equal(working.stage,'review');assert.equal(working.view,'weave');assert.equal(working.plan.id,'intention-test');assert.equal(working.reviewReady.planId,'intention-test');
assert.match(generated.response.answer,/generated and saved the reviewable weave/i);assert.equal(generated.response.approvalGate.required,true);
assert(events.some(event=>event.type==='civweave:working-campus-plan-built'));assert(events.some(event=>event.type==='civweave:weave-review-ready'));

let materialized=null,persisted=null,modelCalls=0,localCalls=0;
const modelSandbox={console,document:{readyState:'loading'},addEventListener(){},removeEventListener(){},dispatchEvent:()=>true,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},setInterval:()=>0,clearInterval(){},queueMicrotask:fn=>fn(),structuredClone:globalThis.structuredClone};
modelSandbox.globalThis=modelSandbox;
modelSandbox.CivweaveIntentionPlanner={shouldCreate:()=>true,buildPlan:({text})=>({schema:'civweave.intention-weave.v1',id:'model-plan-1',wish:text,title:text,outcome:'fallback outcome',profile:{},assumptions:[],paths:[{id:'learning-base',type:'learning',realm:'living-school'},{id:'skilled-base',type:'skilled-labor',realm:'cerbanimo'},{id:'material-base',type:'material-acquirement',realm:'fellowfare'}],governance:{realm:'anarchadia',title:'Consent',purpose:'Review',agreements:[],reviewQuestion:'Who agrees?'},routing:{room:'civweave.quad'},createdAt:'2026-08-09T00:00:00Z'}),persist:plan=>{persisted=globalThis.structuredClone(plan);return{id:plan.id,state:'review',plan}},format:plan=>`MODEL WEAVE: ${plan.title}`};
modelSandbox.CivweaveWeavelingPlanMaterializationV265={materialize:(plan,options)=>{materialized={plan:globalThis.structuredClone(plan),options};return true}};
modelSandbox.CivweaveModelRuntime={readSharedConfig:()=>({provider:'gemini',model:'gemini-3.1-flash-lite',timeoutMs:90000,maxTokens:4096,temperature:.2}),generate:async request=>{modelCalls+=1;assert.equal(request.purpose,'weaveling-intention-model-plan-v266');assert.equal(request.config.timeoutMs,25000);return{status:'success',actual:{provider:'gemini',model:'gemini-3.1-flash-lite'},outputJson:{wish:'Help me create and manage a community garden',title:'Create and Sustain a Community Garden',outcome:'Launch and sustain a community-run garden.',assumptions:['Starting from the beginning.'],paths:[{realm:'living-school',title:'Learn garden fundamentals',purpose:'Learn site and organizing basics.',steps:['Assess site constraints.'],completionCriteria:'A source-backed site brief exists.',evidence:['Site criteria']},{realm:'cerbanimo',title:'Build the first garden pilot',purpose:'Launch a bounded pilot.',steps:['Define the smallest viable garden.'],completionCriteria:'The pilot is operating.',evidence:['Pilot plan']},{realm:'fellowfare',title:'Secure land, tools, seeds, and services',purpose:'Source critical resources.',steps:['Create a needs list.'],completionCriteria:'Critical resources are confirmed.',evidence:['Needs map']}],governance:{title:'Community garden agreements',purpose:'Keep commitments explicit.',agreements:['Name decision rights.'],reviewQuestion:'Who must consent before activation?'}}}}};
modelSandbox.CivweaveAssistantV141={respond:async()=>{localCalls+=1;return{provider:'civweave-planner',response:{answer:'LOCAL PLAN',choice:{}}}}};
vm.runInNewContext(modelFirst,modelSandbox,{filename:'weaveling-model-first-plan-v266.js'});
assert.equal(modelSandbox.CivweaveWeavelingModelFirstPlanV266.patchAssistant(),true);
const modelResult=await modelSandbox.CivweaveAssistantV141.respond({systemId:'civweave',text:'Make a plan from the above',history:[{role:'user',text:'Help me create and manage a community garden'},{role:'assistant',text:'We should consider site, team, funding, design, and operations.'}]});
assert.equal(modelCalls,1,'Configured Gemini must author the intention.');assert.equal(localCalls,0,'Local planner must not preempt successful Gemini planning.');
assert.equal(modelResult.provider,'gemini');assert.equal(modelResult.model,'gemini-3.1-flash-lite');assert.equal(modelResult.plan.title,'Create and Sustain a Community Garden');assert.equal(modelResult.plan.wish,'Help me create and manage a community garden');assert.notEqual(modelResult.plan.title,'Make a plan from the above');
assert.equal(persisted.authorship.kind,'model-authored-local-materialization');assert.equal(materialized.options.source,'weaveling-model-first-v266');assert.equal(modelResult.response.approvalGate.state,'review');

modelSandbox.CivweaveModelRuntime.generate=async()=>{throw new Error('Gemini unavailable')};
modelSandbox.CivweaveAssistantV141={respond:async()=>{localCalls+=1;return{provider:'civweave-planner',response:{answer:'LOCAL PLAN',choice:{}}}}};
assert.equal(modelSandbox.CivweaveWeavelingModelFirstPlanV266.patchAssistant(),true);
const fallback=await modelSandbox.CivweaveAssistantV141.respond({systemId:'civweave',text:'Make a plan from the above',history:[{role:'user',text:'Help me create and manage a community garden'}]});
assert.equal(fallback.provider,'civweave-planner');assert.equal(fallback.fallbackFrom.provider,'gemini');assert.match(fallback.response.answer,/local deterministic planner as the offline-safe fallback/i);

console.log(JSON.stringify({ok:true,version,revision:'weaveling-hub-v233+materialization-v265+model-first-v266',planAuthor:'configured-model-first-v266',offlineFallback:'explicit-local-planner',scrollOwner:'document-v265'},null,2));
