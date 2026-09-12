import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile('public/app/local-ai/gemma4-route-integrity-v1.js','utf8');
const listeners=new Map();
const calls=[];
let trackerResets=0;
let staleCalls=0;
const context={
  console,Date,Promise,Object,Boolean,Number,String,Math,JSON,Map,Set,RegExp,
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent:event=>{calls.push(['event',event.type,event.detail?.phase||'']);return true},
  addEventListener:(name,fn)=>{const rows=listeners.get(name)||[];rows.push(fn);listeners.set(name,rows)},
  queueMicrotask:fn=>fn(),
  setTimeout:()=>0,
  clearTimeout:()=>{},
  CivweaveGuideGenerationTrackerV1:{resetForRequest:()=>{trackerResets+=1},ensurePanel:()=>calls.push(['panel'])},
  CivweaveGemma4WeaveDraftPipelineV1:{install:()=>calls.push(['pipeline-install']),installRuntime:()=>{calls.push(['pipeline-runtime']);return true}},
  CivweaveGemma4StructuredTaskAuthorityV1:{install:()=>calls.push(['structured-install'])},
};
context.globalThis=context;
context.CivweaveGemma4FirstRequestIntakeBridgeV1={
  selectedGemma:()=>true,
  install:()=>{calls.push(['bridge-install']);return true},
  directIntake:async args=>{
    calls.push(['direct',args.systemId,args.text]);
    return{handled:true,result:{provider:'downloaded-local',model:'gemma4-e4b-it-litert-web',response:{answer:`routed:${args.systemId}:${args.text}`}}};
  }
};
context.CivweaveAssistantV141={respond:async args=>{staleCalls+=1;return{provider:'stale',model:'stale',response:{answer:`stale:${args.text}`}}}};
context.CivweaveFamilyAILoaderV105={ensure:async()=>{
  // Reproduce the real failure: loader completion replaces the assistant after earlier wrappers installed.
  context.CivweaveAssistantV141={respond:async args=>{staleCalls+=1;return{provider:'stale-after-loader',model:'stale',response:{answer:`stale-after-loader:${args.text}`}}}};
  calls.push(['loader-finished']);
  return true;
}};

vm.createContext(context);
vm.runInContext(source,context,{filename:'gemma4-route-integrity-v1.js'});
const api=context.CivweaveGemma4RouteIntegrityV1;
assert.ok(api);
assert.equal(api.postLoaderRepair,true);
assert.equal(api.originalUserTextRouting,true);
assert.equal(api.installLoaderGuard(),true);

await context.CivweaveFamilyAILoaderV105.ensure();
assert.equal(context.CivweaveAssistantV141.respond.__civweaveGemma4RouteIntegrityV1,api.version,'route guard did not become outermost after loader replacement');

const weaveling=await context.CivweaveAssistantV141.respond({systemId:'civweave',text:'Can you teach me how to read and memorize the tarot?'});
assert.equal(weaveling.response.answer,'routed:civweave:Can you teach me how to read and memorize the tarot?');
assert.equal(staleCalls,0,'Weaveling learning request reached the stale post-loader assistant');

const moss=await context.CivweaveAssistantV141.respond({systemId:'living-school',text:'Can you teach me how to learn and memorize the tarot?'});
assert.equal(moss.response.answer,'routed:living-school:Can you teach me how to learn and memorize the tarot?');
assert.equal(staleCalls,0,'Moss learning request reached the stale diagnostic/unified handler before intake');

const hello=await context.CivweaveAssistantV141.respond({systemId:'living-school',text:'hello'});
assert.equal(hello.response.answer,'stale-after-loader:hello','ordinary Moss chat should preserve the downstream assistant path');
assert.equal(staleCalls,1);

const pending={detail:{thread:{messages:[{id:'pending-a',role:'assistant',pending:true,text:'Moss is thinking…'}]}}};
for(const fn of listeners.get('civweave:realm-guide-thread-changed')||[])fn(pending);
for(const fn of listeners.get('civweave:realm-guide-thread-changed')||[])fn(pending);
assert.equal(trackerResets,1,'the same pending message must not repeatedly wipe live pipeline progress');
const nextPending={detail:{thread:{messages:[{id:'pending-b',role:'assistant',pending:true,text:'Weaveling is thinking…'}]}}};
for(const fn of listeners.get('civweave:realm-guide-thread-changed')||[])fn(nextPending);
assert.equal(trackerResets,2,'a new request must get a fresh tracker state');

console.log('PASS: original user text owns local Gemma routing after FamilyAILoader mutation; Weaveling and Moss learning requests reach intake, ordinary Moss chat falls through, and tracker state resets once per new pending request.');
