import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const forwardPath='public/app/guide-forward-failure-policy-v1.js';
const hardeningPath='public/app/guide-forward-failure-hardening-v1.js';
const serverPath='public/app/server-ai-router-v301.js';
const loaderPath='public/app/shared-guide-surface-v236.js';
const decisionStripPath='public/app/minilm-decision-strip-v1.js';
const source=fs.readFileSync(forwardPath,'utf8');
const hardening=fs.readFileSync(hardeningPath,'utf8');
const server=fs.readFileSync(serverPath,'utf8');
const loader=fs.readFileSync(loaderPath,'utf8');
const decisionStrip=fs.readFileSync(decisionStripPath,'utf8');

const storage=()=>{const values=new Map();return{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
const localStorage=storage(),sessionStorage=storage();
const listeners=new Map();
const document={
  head:{append(){},appendChild(){}},
  getElementById(){return null},
  createElement(tag){return tag==='style'?{id:'',textContent:''}:{addEventListener(){},set type(v){},set className(v){},set textContent(v){},disabled:false}},
  querySelector(){return null},
  addEventListener(){}
};
const context={
  console,URL,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,WeakMap,structuredClone,
  localStorage,sessionStorage,document,
  location:{href:'https://staging.example.test/',pathname:'/',search:'',hostname:'staging.example.test'},
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  addEventListener:(name,fn)=>{const rows=listeners.get(name)||[];rows.push(fn);listeners.set(name,rows)},
  dispatchEvent:()=>true,
  queueMicrotask:fn=>fn(),
  setTimeout,clearTimeout,
};
context.globalThis=context;
vm.runInNewContext(source,context,{filename:forwardPath});
const api=context.CivweaveGuideForwardFailurePolicyV1;
assert.ok(api,'forward policy API should install');
assert.equal(api.deterministicAnswerFallback,false);
assert.equal(api.failureDirection,'forward');
assert.equal(api.terminalFallback,'explicit-guild-handoff');
assert.equal(api.localProviderPinned,true);

assert.equal(api.structuredArtifact('Can you help me make a learning plan to love myself?'),'curriculum');
assert.equal(api.structuredArtifact('Can you build a lesson plan to teach me a new skill?'),'curriculum');
assert.equal(api.structuredArtifact('Can you help me make a plan to build a community garden in my area?'),'quest');
assert.equal(api.structuredArtifact('test'),'');

const promoted=api.promoteRoute({lengthClass:'short',taskClass:'ordinary',artifactClass:null,networkRequired:false,confidence:.5,source:'deterministic-length-fallback',tier:{id:'short'}},'Can you make me a plan to learn a new skill?');
assert.equal(promoted.taskClass,'structured-artifact');
assert.equal(promoted.artifactClass,'curriculum');
assert.equal(promoted.networkRequired,true);
assert.equal(promoted.lengthClass,'fast');
assert.equal(promoted.source,'cross-realm-structure-safety-net');

localStorage.setItem('civweave.local-ai.selection.v266',JSON.stringify({active:true,id:'smollm2-135m-instruct-q8-wasm'}));
const sanitized=api.sanitizedLocalRequest({messages:[
  {role:'system',content:'You are Weaveling.'},
  {role:'user',content:'test'},
  {role:'assistant',content:'Weaveling kept this locally. For “test”, start with the outcome.'},
  {role:'user',content:'Can you help me make a learning plan to love myself?'}
]});
assert.equal(sanitized.__civweaveTinyHistorySanitized,true);
assert.equal(sanitized.messages.length,2);
assert.equal(sanitized.messages[1].role,'user');
assert.equal(sanitized.messages[1].content,'Can you help me make a learning plan to love myself?');
assert.ok(!sanitized.messages.some(row=>/kept this locally/i.test(row.content)));

localStorage.setItem('civweave-model-profiles-v1',JSON.stringify({interactive:{provider:'downloaded-local',route:'downloaded-local',model:'smollm2-135m-instruct-q8-wasm'}}));
let localAssistantCalls=0;
context.CivweaveResponseRouterV347={tiers:{fast:{id:'fast'}},classify:async()=>({lengthClass:'fast',taskClass:'structured-artifact',artifactClass:'quest',networkRequired:true,confidence:1,source:'test-network-required'})};
context.CivweaveAssistantV141={respond:async()=>{localAssistantCalls+=1;return{response:{answer:'local-ok'},requestedProvider:'downloaded-local',provider:'downloaded-local',model:'smollm2-135m-instruct-q8-wasm'}}};
api.install();
const pinnedLocalResult=await context.CivweaveAssistantV141.respond({text:'Build me a project plan',systemId:'civweave',history:[]});
assert.equal(api.localConfigured(),true);
assert.equal(localAssistantCalls,1,'networkRequired classification must not bypass the explicitly selected local assistant');
assert.equal(pinnedLocalResult.provider,'downloaded-local');
assert.equal(pinnedLocalResult.response.answer,'local-ok');

assert.match(source,/1\.0\.1-guide-forward-failure-policy-v1-local-provider-pin/);
assert.match(source,/function localConfigured\(\)/);
assert.match(source,/route\?\.networkRequired&&!serverAutoConfigured\(\)&&!localConfigured\(\)/);
assert.match(source,/did not contact a Guild or Cloudflare AI/);
assert.match(source,/localProviderPinned:true/);

assert.match(loader,/guide-forward-failure-policy-v1\.js\?v=1\.0\.1-local-provider-pin/);
assert.match(loader,/guide-forward-failure-hardening-v1\.js\?v=1\.2\.1-local-provider-pin/);
assert.match(loader,/minilm-decision-strip-v1\.js\?v=1\.1\.0-router-watch/);
assert.match(loader,/deterministicAnswerFallback:false/);
assert.match(loader,/deterministicTerminalVisible:false/);
assert.match(loader,/deterministicAssistantPatchRetired:true/);
assert.match(loader,/localProviderPinned:true/);

assert.match(hardening,/1\.2\.1-guide-forward-failure-hardening-v1-local-provider-pin/);
assert.match(hardening,/installDeterministicCompatibility\(\)/);
assert.match(hardening,/automaticAssistantPatch:false/);
assert.match(hardening,/__civweaveCloudFallbackV2/);
assert.match(hardening,/__deterministicModeV175/);
assert.match(hardening,/legacy-deterministic-wrapper-bypassed/);
assert.match(hardening,/provider\.startsWith\('deterministic'\)/);
assert.match(hardening,/server-auto-forwarding/);
assert.match(hardening,/event\.stopImmediatePropagation\(\)/);
assert.match(hardening,/deterministicAssistantPatchRetired:true/);
assert.match(hardening,/function localInteractiveConfigured\(\)/);
assert.match(hardening,/if\(localPinned\)return resultNeedsCloud\(result\)\?localUnavailableResult/);
assert.match(hardening,/if\(localInteractiveConfigured\(\)\)return false/);
assert.match(hardening,/localProviderPinned:true/);
assert.ok(!hardening.includes('Object.freeze({...assistant,respond'), 'assistant replacement must remain mutable');
assert.ok(!hardening.includes('classifyBackup('), 'assistant boundary must not run a second MiniLM classifier');

assert.match(decisionStrip,/1\.1\.0-minilm-decision-strip-router-watch/);
assert.match(decisionStrip,/classification still in progress/);
assert.match(decisionStrip,/response router has not emitted a decision/);
assert.match(decisionStrip,/slowRouteWarningMs:2200/);
assert.match(decisionStrip,/missingRouteErrorMs:12000/);
assert.ok(!decisionStrip.includes('chat submit did not reach the response router'), '2.2s timeout must not claim the router was bypassed');

assert.match(server,/guildOnly=request\.guildOnly===true/);
assert.match(server,/if\(guildOnly\)\{/);
assert.ok(server.indexOf('if(guildOnly){')<server.indexOf('try{const edge=await cloudflare'), 'Guild-only branch must stop before Cloudflare');
assert.match(server,/GUILD_AI_UNAVAILABLE/);

console.log('Guide routing contract verified: explicit local AI stays local even for networkRequired classifications; automatic Guild/cloud fallback remains available for server-auto.');
