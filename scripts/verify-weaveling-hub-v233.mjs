import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const exists=file=>access(path.join(root,file)).then(()=>true,()=>false);
const [hub,runtime,workspace,materialization,scrollCss,sharedLoader,assistantRuntime,versionText,packageSource]=await Promise.all([
  read('public/app/weaveling-hub-v233.js'),
  read('public/app/working-campus-v156.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/weaveling-plan-materialization-v265.js'),
  read('public/app/weaveling-scroll-owner-v265.css'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/app/assistant-runtime-v141.js'),
  read('VERSION'),
  read('package.json')
]);

const version=versionText.trim(),pkg=JSON.parse(packageSource);
assert.equal(pkg.version,version,'package.json and VERSION must stay synchronized.');
assert.match(version,/^\d+\.\d+\.\d+$/,'Civweave release version must remain semantic.');
new Function(hub);new Function(workspace);

for(const heading of ['AGENT REPORTS','CHRONICLE','REPORT IN'])assert(hub.includes(heading),`Missing Weaveling hub section: ${heading}`);
for(const key of ['civweave.agent-reports.v1','civweave.chronicles.v1','civweave.user-updates.v1'])assert(hub.includes(key),`Missing hub local contract: ${key}`);
assert(!hub.includes('/app/persistent-guide-chat-v215.js'),'Hub must not load the deleted v215 chat runtime.');
assert(!hub.includes('/app/persistent-guide-viewport-v216.js'),'Hub must not load the deleted v216 viewport runtime.');
assert(!hub.includes('ensureScript('),'Hub must not maintain a second script-loading path for chat.');
assert(hub.includes('CivweaveGuideWorkspaceV242?.openWindow'),'Hub must recognize the canonical v242 guide workspace.');
assert(hub.includes("addEventListener('civweave:guide-workspace-ready'"),'Hub must wait for the canonical workspace readiness event when necessary.');
assert(hub.includes("'civweave:user-update-reported'"),'Reported updates must emit the shared user-update event.');
assert(hub.includes("'civweave:agent-report'"),'Hub must accept agent report events.');
assert(hub.includes("'civweave:chronicle-update'"),'Hub must accept Chronicle update events.');
assert(hub.includes('wh233-embedded-composer'),'Working Campus embedded composer may remain only as a hidden surface delegated into v242.');
assert(!hub.includes('wh233-legacy-bridge'),'Legacy chat bridge naming must be retired.');

for(const retired of ['public/app/persistent-guide-chat-v215.js','public/app/persistent-guide-viewport-v216.js'])assert.equal(await exists(retired),false,`${retired} must remain deleted.`);
assert(runtime.includes("const HUB_SCRIPT='/app/weaveling-hub-v233.js';"),'Working Campus must load the Weaveling hub.');
assert(runtime.includes('await ensureHub();'),'Working Campus must mount the hub before its split runtime starts.');
assert(workspace.includes("const LAUNCHER_ID='cwp215-launcher';"),'Canonical v242 workspace launcher contract changed unexpectedly.');
assert(workspace.includes('canonicalOwner:true'),'v242 must remain the canonical guide owner.');
assert(assistantRuntime.includes('globalThis.CivweaveIntentionPlanner?.maybeCreate'),'Assistant runtime must retain the canonical Weaveling intention-planner boundary.');

const plannerIndex=sharedLoader.indexOf('/app/intention-planner-v141.js');
const materializationIndex=sharedLoader.indexOf('/app/weaveling-plan-materialization-v265.js');
const sharedCoreIndex=sharedLoader.indexOf('/app/shared-guide-surface-v236-core-v244.js');
assert(plannerIndex>=0,'Shared guide loader must guarantee the intention planner.');
assert(materializationIndex>plannerIndex,'Weaveling materialization must load after the canonical planner.');
assert(sharedCoreIndex>materializationIndex,'Shared chat must not mount before Weaveling materialization is ready.');

for(const marker of ["stage:'review'","view:'weave'",'civweave:working-campus-plan-built','civweave:weave-review-ready','approvalGate','Nothing is active yet','WEAVE GENERATED · REVIEW REQUIRED'])assert(materialization.includes(marker),`Missing reviewable-weave materialization marker: ${marker}`);
assert.match(scrollCss,/#weaveling-hub-v233\{max-height:none!important;overflow:visible!important/,'Weaveling hub must relinquish nested vertical scroll ownership.');
assert(scrollCss.includes('touch-action:pan-y'),'Weaveling modules must explicitly preserve vertical touch panning.');

const store=new Map(),events=[];
const sandbox={console,location:{pathname:'/app/working-campus-v156.html',href:'https://example.test/app/working-campus-v156.html',reload:()=>{}},localStorage:{getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},document:{readyState:'loading',documentElement:{dataset:{civweaveSystemRoute:'civweave'}},scripts:[],styleSheets:[],getElementById:()=>null,querySelector:()=>null,createElement:tag=>({tagName:String(tag).toUpperCase(),dataset:{},setAttribute(){},addEventListener(){}}),head:{append(){}},body:{}},addEventListener:()=>{},dispatchEvent:event=>{events.push(event);return true},CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},setTimeout:()=>0,setInterval:()=>0,clearInterval:()=>{},URL,structuredClone:globalThis.structuredClone};
sandbox.globalThis=sandbox;
sandbox.CivweaveIntentionPlanner={maybeCreate:()=>({plan:{id:'intention-test',title:'Community Garden',wish:'Help me create and manage a community garden',profile:{},paths:[{id:'learning'}]},item:{id:'intention-test'},response:{answer:'Drafted route.',choice:{mode:'Plan'},requiresConsent:true}}),restore:()=>true};
vm.runInNewContext(materialization,sandbox,{filename:'weaveling-plan-materialization-v265.js'});
assert.equal(sandbox.CivweaveWeavelingPlanMaterializationV265.patchPlanner(),true,'Materialization bridge must wrap the canonical planner.');
const generated=sandbox.CivweaveIntentionPlanner.maybeCreate({text:'Help me create and manage a community garden'}),working=JSON.parse(store.get('civweave.working-campus.v1'));
assert.equal(working.stage,'review','A chat-generated intention must place Working Campus into review.');
assert.equal(working.plan.id,'intention-test','Visible review state must contain the canonical plan.');
assert.equal(generated.response.approvalGate.required,true,'Materialized plan must not activate without approval.');
assert(events.some(event=>event.type==='civweave:weave-review-ready'),'Materialization must emit the explicit review-ready event.');

console.log(JSON.stringify({ok:true,version,revision:'weaveling-hub-v233+v242-canonical-chat',sections:['agent-reports','chronicle','report-in'],chatOwner:'guide-workspace-v242',retiredRuntimeLoads:0,reviewMaterialization:'working-campus-review-v265',scrollOwner:'document-v265'},null,2));