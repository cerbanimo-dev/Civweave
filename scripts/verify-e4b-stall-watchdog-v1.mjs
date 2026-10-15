import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const src=await readFile(new URL('../public/app/local-ai/gemma4-structured-task-authority-v1.js',import.meta.url),'utf8');
assert.doesNotMatch(src,/litert-constrained-tool|TASK_TIMEOUT_MS=600000/,'The silent ten-minute legacy route returned.');
assert.match(src,/TASK_TIMEOUT_MS=240000/);

const E4B='gemma4-e4b-it-litert-web';
const timers=new Map(),progress=[],storage=new Map();
let nextId=1,cancelCalls=0,inferenceCalls=0;
const setTimeout=(fn,ms)=>{const id=nextId++;timers.set(id,{fn,ms});return id};
const clearTimeout=id=>timers.delete(id);
const LocalFast={
  runFast:async(args,model)=>{
    assert.equal(model,E4B,'Selected E2B was mistakenly used for generation');
    inferenceCalls++;
    args.onProgress?.({phase:'loading-engine',model});
    args.onProgress?.({phase:'creating-conversation',model});
    args.onProgress?.({phase:'awaiting-first-token',model});
    return new Promise(()=>{}); // Simulated wedged GPU/WASM decoder.
  },
  cancel:()=>{cancelCalls++}
};
const context={console,Date,Math,JSON,Promise,Map,Set,Error,Boolean,Array,Number,String,RegExp,Object,
  setTimeout,clearTimeout,queueMicrotask:()=>{},
  dispatchEvent:e=>{progress.push(e);return true},addEventListener:()=>{},
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
  CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:'gemma4-e2b-it-litert-web'}),status:async id=>({available:id===E4B})},
  CivweaveLiteRTGemma4FastRuntimeV1:LocalFast
};
context.globalThis=context;
vm.runInNewContext(src,context);
const api=context.CivweaveGemma4StructuredTaskAuthorityV1;
assert.equal(api.taskTimeoutMs,240000);
const promise=api.controlledFastRun({messages:[{role:'user',content:'Tarot'}]},E4B,'E4B Weave Draft',api.taskTimeoutMs);
// Allow the mocked asynchronous intakeRuntime() to return.
for(let i=0;i<5;i++)await Promise.resolve();
assert.equal(inferenceCalls,1);
assert.ok([...timers.values()].some(t=>t.ms===240000),'Hard stage timeout missing');
const first=[...timers.values()].find(t=>t.ms===90000);
assert.ok(first,'90-second no-first-token watchdog missing');
first.fn();
await assert.rejects(promise,error=>{
  assert.equal(error.code,'CIVWEAVE_LOCAL_FIRST_TOKEN_STALL');
  assert.equal(error.executionModel,E4B);
  assert.equal(error.runtimePhase,'awaiting-first-token');
  assert.equal(error.rawDiagnostics.visibleTextDeltas,0);
  return true;
});
assert.equal(cancelCalls,1,'The GPU stream was not cancelled after a dead decoder');
assert.ok(progress.some(e=>e.type==='civweave:local-model-stage-progress'&&e.detail.phase==='creating-conversation'));
assert.ok(progress.some(e=>e.type==='civweave:local-model-stage-progress'&&e.detail.phase==='generating'));
assert.equal([...timers.values()].filter(t=>t.ms===240000).length,0,'Watchdog failed to clear its timers');
console.log(JSON.stringify({ok:true,executedModel:E4B,firstTokenDeadlineSeconds:90,hardStageDeadlineSeconds:240,cancelCalled:cancelCalls,silentToolFallbackBlocked:true},null,2));
