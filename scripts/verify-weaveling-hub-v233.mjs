import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [hub,runtime,sharedChat,materialization,scrollCss,sharedLoader,assistantRuntime,versionText,packageSource]=await Promise.all([
  readFile(path.join(root,'public/app/weaveling-hub-v233.js'),'utf8'),
  readFile(path.join(root,'public/app/working-campus-v156.js'),'utf8'),
  readFile(path.join(root,'public/app/persistent-guide-chat-v215.js'),'utf8'),
  readFile(path.join(root,'public/app/weaveling-plan-materialization-v265.js'),'utf8'),
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

for(const heading of ['AGENT REPORTS','CHRONICLE','REPORT IN']){
  assert(hub.includes(heading),`Missing Weaveling hub section: ${heading}`);
}
for(const key of ['civweave.agent-reports.v1','civweave.chronicles.v1','civweave.user-updates.v1']){
  assert(hub.includes(key),`Missing hub local contract: ${key}`);
}
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
assert(assistantRuntime.includes('globalThis.CivweaveIntentionPlanner?.maybeCreate'),'Assistant runtime must retain the canonical Weaveling intention-planner boundary.');

const plannerIndex=sharedLoader.indexOf('/app/intention-planner-v141.js?v=1.0.57-v265-review-materialization');
const materializationIndex=sharedLoader.indexOf('/app/weaveling-plan-materialization-v265.js?v=1.0.57-v265');
const sharedCoreIndex=sharedLoader.indexOf('/app/shared-guide-surface-v236-core-v244.js?v=1.0.57-v265');
assert(plannerIndex>=0,'Shared guide loader must guarantee the intention planner.');
assert(materializationIndex>plannerIndex,'Weaveling materialization must load after the canonical planner.');
assert(sharedCoreIndex>materializationIndex,'Shared chat must not mount before Weaveling materialization is ready.');
assert(sharedLoader.includes('readyCheck?.()'),'Preloaded planner dependencies must be recognized as ready instead of waiting forever for an already-fired load event.');
assert(sharedLoader.includes('/app/weaveling-scroll-owner-v265.css?v=1.0.57-v265'),'Shared guide must install the Weaveling document-scroll ownership repair.');

for(const marker of ["stage:'review'","view:'weave'",'civweave:working-campus-plan-built','civweave:weave-review-ready','approvalGate','Nothing is active yet','WEAVE GENERATED · REVIEW REQUIRED']){
  assert(materialization.includes(marker),`Missing reviewable-weave materialization marker: ${marker}`);
}
assert(materialization.includes("WORKING_KEY='civweave.working-campus.v1'"),'Chat-generated weave must materialize into the visible Working Campus state.');
assert(materialization.includes("INTENTIONS_KEY='civweave.intentions.v127'"),'Review UI must stay linked to the canonical persisted intention record.');

assert.match(scrollCss,/#weaveling-hub-v233\{max-height:none!important;overflow:visible!important/,'Weaveling hub must relinquish nested vertical scroll ownership.');
assert.match(scrollCss,/#cw-shared-guide-surface-v236 \.cwsg236-log\{max-height:none!important;overflow:visible!important/,'Shared Weaveling chat log must relinquish nested vertical scroll ownership.');
assert.match(scrollCss,/\.conversation\{height:auto!important;max-height:none!important;overflow:visible!important/,'Mobile Working Campus conversation must expand into document flow.');
assert(scrollCss.includes('touch-action:pan-y'),'Weaveling modules must explicitly preserve vertical touch panning.');

const store=new Map();
const events=[];
const sandbox={
  console,
  location:{pathname:'/app/working-campus-v156.html',href:'https://example.test/app/working-campus-v156.html',reload:()=>{}},
  localStorage:{
    getItem:key=>store.has(key)?store.get(key):null,
    setItem:(key,value)=>store.set(key,String(value)),
    removeItem:key=>store.delete(key)
  },
  document:{
    readyState:'loading',
    documentElement:{dataset:{civweaveSystemRoute:'civweave'}},
    scripts:[],styleSheets:[],
    getElementById:()=>null,
    querySelector:()=>null,
    createElement:tag=>({tagName:String(tag).toUpperCase(),dataset:{},setAttribute(){},addEventListener(){}}),
    head:{append(){}},
    body:{}
  },
  addEventListener:()=>{},
  dispatchEvent:event=>{events.push(event);return true},
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  setTimeout:()=>0,
  setInterval:()=>0,
  clearInterval:()=>{},
  URL,
  structuredClone:globalThis.structuredClone
};
sandbox.globalThis=sandbox;
sandbox.CivweaveIntentionPlanner={
  maybeCreate:()=>({
    plan:{id:'intention-test',title:'Community Garden',wish:'Help me create and manage a community garden',profile:{},paths:[{id:'learning'}]},
    item:{id:'intention-test'},
    response:{answer:'Drafted route.',choice:{mode:'Plan'},requiresConsent:true}
  }),
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

console.log(JSON.stringify({
  ok:true,
  version,
  revision:'weaveling-hub-v233+materialization-v265',
  sections:['agent-reports','chronicle','report-in'],
  chatLauncher:'persistent-guide-chat-v215',
  reviewMaterialization:'working-campus-review-v265',
  scrollOwner:'document-v265'
},null,2));
