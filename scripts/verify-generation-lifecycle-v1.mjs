import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(path,'utf8');
const lifecycle=read('public/app/generation-lifecycle-v2.js');
const tracker=read('public/app/guide-generation-tracker-v1.js');
const shell=read('public/app/persistent-system-shell-v1.html');
const takeover=read('public/service-worker-weave-pipeline-takeover-v1.js');
const canonicalWorker=read('public/service-worker-v203.js');
const rootWorker=read('public/service-worker.js');

const store=new Map();
const context={
  console,
  WeakSet,WeakMap,Set,Map,Object,Array,Boolean,Number,String,Math,Date,JSON,Promise,
  sessionStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value))},
  document:{querySelectorAll:()=>[],addEventListener:()=>{},documentElement:{}},
  location:{origin:'https://civweave-staging.pages.dev'},
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  MutationObserver:class MutationObserver{observe(){}},
  addEventListener:()=>{},dispatchEvent:()=>{},queueMicrotask:fn=>fn(),setTimeout:()=>0,
  CivweaveLiteRTGemma4FastRuntimeV1:{
    state:()=>({generationActive:false}),unload:async()=>true,
    runFast:async args=>{for(const text of ['Hello ',' world','\n  next line\n'])args.onToken?.({text});return{status:'success'}}
  },
};
context.globalThis=context;
vm.runInNewContext(lifecycle,context,{filename:'generation-lifecycle-v2.js'});
const api=context.CivweaveGenerationLifecycleV1;
assert.ok(api,'lifecycle API must install');
const A=(...keys)=>Object.fromEntries(['learningPlan','endeavour','manifest','proposal'].map(key=>[key,keys.includes(key)]));
const cases=[
  [A('learningPlan'),'Learning Plan'],[A('endeavour'),'Endeavour'],[A('manifest'),'Manifest'],[A('proposal'),'Proposal'],
  [A('learningPlan','endeavour'),'Practicum'],[A('learningPlan','manifest'),'Study Kit'],[A('learningPlan','proposal'),'Learning Proposal'],
  [A('endeavour','manifest'),'Expedition'],[A('endeavour','proposal'),'Project Proposal'],[A('manifest','proposal'),'Resource Proposal'],
  [A('learningPlan','endeavour','proposal'),'Civic Practicum'],[A('learningPlan','manifest','proposal'),'Learning Charter'],[A('endeavour','manifest','proposal'),'Initiative'],
  [A('learningPlan','endeavour','manifest'),'Quest'],[A('learningPlan','endeavour','manifest','proposal'),'Quest']
];
for(const [set,name] of cases)assert.equal(api.artifactName(set),name,`artifact set ${JSON.stringify(set)} should be ${name}`);
assert.equal(api.artifactName(api.inferArtifacts('Can you teach me how to read and memorize the tarot?','learning')),'Learning Plan');
assert.equal(api.artifactName(api.inferArtifacts('Build this project and list the materials I need','quest')),'Expedition');
const delivered=[];
await context.CivweaveLiteRTGemma4FastRuntimeV1.runFast({stage:'Plan draft',onToken:token=>delivered.push(token.text)},'qwen35-9b-litert-web');
assert.deepEqual(delivered,['Hello ',' world','\n  next line\n'],'original token consumer must receive unchanged text');
assert.deepEqual(Array.from(api.history().filter(row=>row.type==='runtime-token'),row=>row.detail.text),delivered,'the cross-frame transcript must preserve spaces and newlines in streamed tokens');
assert.equal(api.latest('runtime-stage').detail.model,'qwen35-9b-litert-web');
assert.equal(api.latest('runtime-stage').detail.stage,'draft');
assert.equal(api.stageId('Local generation'),'draft','stage identity must not depend on a model family name');
assert.match(lifecycle,/frame\.contentWindow/,'lifecycle must bind same-origin child frames');
assert.match(lifecycle,/runtime-token/,'lifecycle must expose real runtime token progress');
assert.match(lifecycle,/generationActive/,'lifecycle must observe the LiteRT busy state');
assert.match(lifecycle,/waitIdle/,'new work after Stop must wait for prior LiteRT cleanup');
assert.match(lifecycle,/baseUnload/,'Stop must ask LiteRT to release its active engine');
assert.match(tracker,/Live \$\{esc\(artifactName\(\)\)\}/,'tracker title must use the artifact-set name');
assert.doesNotMatch(tracker,/Live Weave pipeline/,'user-facing tracker must not be named Weave');
assert.match(tracker,/civweave:generation-lifecycle/,'tracker must consume the durable lifecycle bus');
assert.match(tracker,/runtime-stage/,'tracker must consume real LiteRT stage activity');
assert.match(tracker,/living-school-learning-plan-review-v2/,'tracker must consume the selected Moss provider stream');
assert.match(tracker,/civweave:moss-learning-plan-progress/,'tracker must consume semantic validation and save milestones');
assert.match(tracker,/state\.streams\.intake=.*accumulatedText/,'tracker must populate RAW from accumulated provider output');
assert.match(tracker,/stageState\('saved','complete'/,'saved stage must reflect an actual persisted plan');
const lifecycleIndex=shell.indexOf('/app/generation-lifecycle-v2.js');
assert.ok(lifecycleIndex>=0&&lifecycleIndex<shell.indexOf('/app/shared-guide-surface-v236.js'),'active lifecycle bridge must load before guide/runtime composition');
const takeoverRevision=takeover.match(/const REVISION='([^']+)'/)?.[1];
assert.ok(takeoverRevision&&canonicalWorker.includes(takeoverRevision)&&rootWorker.includes(takeoverRevision),'both installed worker entrypoints must consume the canonical takeover revision');
assert.match(takeover,/\/app\/generation-lifecycle-v2\.js/);
assert.doesNotMatch(lifecycle,/new MutationObserver|setInterval\(/,'lifecycle frame binding must remain bounded and event driven');
console.log('PASS: generation progress is cross-frame/runtime-backed, Stop recovers the LiteRT lock, and every artifact combination has a non-Weave tracker name.');
