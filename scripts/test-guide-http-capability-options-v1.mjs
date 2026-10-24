import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8');
const assistant = read('app/assistant-runtime-v141.js');
const orchestrator = read('extensions/civweave-weaveling-plan-json-v190.js');
const config = { provider: 'ollama', route: 'ollama', model: 'gemma4:latest', endpoint: 'http://127.0.0.1:11434/api/chat' };

test('a separate chat Quest owns its wish and preserves the existing campus intention', async () => {
  const oldWish = 'Learn and memorize the tarot', request = 'Create a Quest titled QA Local READY Note. Goal: write READY in a fictional local QA note.';
  const saved = new Map([
    ['civweave.working-campus.v1', JSON.stringify({ wish: oldWish, profile: {}, plan: null })],
    ['civweave.intentions.v127', '[]'], ['civweave.realm-inbox.v1', '[]'],
  ]);
  const input = { value: oldWish }, seen = [], raw = {
    title: 'QA Local READY Note', wish: oldWish, outcome: 'A fictional QA note contains READY.', assumptions: ['This is local digital QA.'],
    paths: [{ type: 'civic-governance', realm: 'anarchadia', title: 'Record READY', purpose: 'Keep the fictional QA note.', steps: ['Write READY.'], completionCriteria: 'The note contains READY.', evidence: ['Local QA note'] }],
    governance: { included: false },
  };
  const scope = {
    console, Date, Math, structuredClone, DOMException, URL,
    localStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, String(value)), removeItem: key => saved.delete(key) },
    document: { readyState: 'loading', addEventListener() {}, documentElement: { dataset: {} }, getElementById: id => id === 'wish-input' ? input : null },
    location: { pathname: '/app/working-campus-v440.html' },
    addEventListener() {}, dispatchEvent() {}, queueMicrotask: callback => callback(),
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    CivweaveModelRuntime: { readSharedConfig: () => config, generate: async request => { seen.push(request); return { status: 'success', structured: { valid: true }, outputJson: structuredClone(raw), actual: config }; } },
  };
  scope.globalThis = scope; vm.createContext(scope);
  vm.runInContext(read('app/intention-planner-v141.js'), scope);
  vm.runInContext(read('app/weaveling-plan-materialization-v265.js'), scope);
  vm.runInContext(orchestrator, scope);
  const api = { selectedConfig: () => config };
  const first = await scope.CivweaveWeavelingPlanJsonV190.createModelPlan({ text: request, history: [] }, api);
  assert.equal(first.plan.wish, request, 'The user request owns this Quest goal even when the model echoes an unrelated prior wish.');
  assert.equal(seen[0].context.workingMemory.currentWish, request);
  assert.equal(first.plan.paths.length, 1); assert.equal(first.plan.governance, null, 'A model-requested governance:false must remain absent.');
  assert.equal(JSON.parse(saved.get('civweave.working-campus.v1')).wish, oldWish, 'Creating a separate chat Quest must not replace the campus intention.');
  assert.equal(input.value, oldWish);
  const revision = 'Revise that Quest to write lowercase ready instead.';
  const second = await scope.CivweaveWeavelingPlanJsonV190.createModelPlan({ text: revision, history: [{ role: 'user', text: request }] }, api);
  assert.equal(second.plan.wish, request, 'Revisions retain their Quest goal rather than borrowing the campus intention.');
  assert.equal(seen[1].context.workingMemory.currentWish, request);
  assert.equal(JSON.parse(saved.get('civweave.working-campus.v1')).wish, oldWish);
  scope.CivweaveWeavelingPlanMaterializationV265.materialize(second.plan);
  assert.equal(JSON.parse(saved.get('civweave.working-campus.v1')).wish, request, 'The default main-form materialization still selects its own intention.');
});

test('shared assistant forwards cancellation and streamed tokens to the selected HTTP provider', async () => {
  let request;
  const tokens = [];
  const abort = new AbortController();
  const scope = {
    runtime: () => ({ generate: async input => {
      request = input;
      input.onEvent?.({ phase: 'partial', text: 'Hello', accumulatedText: 'Hello' });
      return { status: 'success', outputText: 'Hello', actual: config };
    } }),
    selectedConfig: () => config, taskMetadata: () => ({ requirements: {} }),
    prompt: () => [{ role: 'user', content: 'Say hello' }],
    normalize: result => ({ answer: result.outputText }),
  };
  const start = assistant.indexOf('async function model(');
  const end = assistant.indexOf('\nfunction persistModelQuest(', start);
  const model = vm.runInNewContext(`${assistant.slice(start, end)};model`, scope);
  const result = await model({}, { config, signal: abort.signal, onToken: (...args) => tokens.push(args) });
  assert.equal(result.provider, 'ollama');
  assert.equal(request.signal, abort.signal);
  assert.equal(request.config.model, config.model);
  assert.equal(request.stream, true);
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0][1], 'Hello');
});

test('Quest authoring respects saved Ollama over a stale browser-model selection', async () => {
  let generated, saved;
  const abort = new AbortController();
  const events = [];
  const runtime = { generate: async input => {
    generated = input;
    input.onEvent?.({ phase: 'partial', text: 'Quest', accumulatedText: 'Quest' });
    return { status: 'success', structured: { valid: true }, outputJson: { title: 'QA Quest' }, actual: config };
  } };
  const scope = {
    globalThis: {
      CivweaveModelRuntime: runtime,
      CivweaveIntentionPlanner: { persist: plan => { saved = plan; return { plan }; } },
    },
    selectedLocal: () => ({ active: true, id: 'gemma4-e2b-it-litert-web' }),
    LOCAL_AI_PROVIDERS: new Set(['downloaded-local', 'local-ai']),
    clean: (value, max = 12000) => String(value ?? '').trim().slice(0, max),
    isAIProvider: value => value === 'ollama',
    preferredTaskModel: () => { throw new Error('HTTP Quest must not inspect or load browser model packs'); },
    resolvedPlanningText: value => value, memory: () => ({}), prompt: () => [], PLAN_SCHEMA: {},
    normalizePlan: value => value, planResponse: item => item,
    localStructuredTransport: () => { throw new Error('HTTP Quest must not use downloaded-model transport'); },
  };
  const start = orchestrator.indexOf('async function createModelPlan(');
  const end = orchestrator.indexOf('\nfunction install(', start);
  const create = vm.runInNewContext(`${orchestrator.slice(start, end)};createModelPlan`, scope);
  await create({ text: 'Create a Quest', history: [], signal: abort.signal, onToken: (...args) => events.push(args) }, { selectedConfig: () => config });
  assert.equal(saved.title, 'QA Quest');
  assert.equal(generated.config.provider, 'ollama');
  assert.equal(generated.config.model, config.model);
  assert.equal(generated.signal, abort.signal);
  assert.equal(generated.transport, undefined);
  assert.equal(events.length, 1);
});

for (const systemId of ['civweave','cerbanimo']) {
  for (const aborted of [false,true]) {
    test(`selected HTTP failure is visible without deterministic replacement: ${systemId}, aborted=${aborted}`, async () => {
      const abort = new AbortController();
      if (aborted) abort.abort(new Error('Stopped by user'));
      const failure = new Error(aborted ? 'Stopped by user' : 'Ollama endpoint unavailable');
      let drafted=0;
      const scope={
        SYS:['civweave','cerbanimo'],pathSystem:()=>systemId,
        context:async()=>({guide:{system:systemId},currentContext:{roomId:''}}),kind:()=>'',
        selectedConfig:()=>config, model:async()=>{throw failure},
        contracts:()=>({compose:()=>{drafted++;return null}}),wantsQuest:()=>true,
        clean:value=>String(value??''),conversational:()=>({answer:'canned replacement'}),
        guide:()=>({name:'Kamiya'}),mode:()=>'',console:{warn(){}},
      };
      const start=assistant.indexOf('async function respond('),end=assistant.indexOf('\nfunction review(',start);
      const respond=vm.runInNewContext(`${assistant.slice(start,end)};respond`,scope);
      await assert.rejects(respond({text:'Create a QA item',systemId,config,signal:abort.signal}), /Stopped by user|Ollama endpoint unavailable/);
      if(systemId==='cerbanimo')assert.equal(drafted,0,'A failed or stopped model must not create a substitute draft');
    });
  }
}

test('Ollama surface failure stops after one request and keeps the error visible',async()=>{
  const source=read('app/guide-chat-surface-v350.js');
  let fallbacks=0;
  const rows=[],button={},scope={
    activeSystem:'civweave',busy:false,SYSTEMS:['civweave'],AbortController,
    clean:(value,max=12000)=>String(value??'').trim().slice(0,max),ensureRoot(){},
    root:{querySelector:selector=>selector==='textarea'?{value:''}:button},
    activeNativePhoneServer:()=>false,configuredRoute:()=> 'ollama',nativeApiRoute:()=>false,
    append:(system,row)=>rows.push(row),uid:()=> 'pending-1',render(){},emitAvatar(){},emitState(){},
    historyFor:()=>[],globalThis:{CivweaveFamilyAILoaderV105:{respondOllama:async()=>{throw new Error('Ollama endpoint unavailable')}}},
    guide:()=>({name:'Weaveling'}),fallbackReply:async()=>{fallbacks++;return{text:'second request',provider:'ollama'}},
    readThread:()=>({messages:rows}),writeThread(){},now:()=> 'today',nativeAbortController:null,
    dispatchEvent(){},CustomEvent:class{},
  };
  const start=source.indexOf('async function submitActive('),end=source.indexOf('\nfunction switchGuide(',start);
  const submit=vm.runInNewContext(`${source.slice(start,end)};submitActive`,scope);
  await submit('Say hello');
  assert.equal(fallbacks,0,'Retry requires a new explicit user request');
  assert.equal(rows.at(-1).provider,'model-error');
  assert.match(rows.at(-1).text,/Ollama endpoint unavailable/);
});

test('optional parity context cannot hold a selected provider request indefinitely',async()=>{
  const scope={ledgerPromise:null,globalThis:{CivweaveParity:{load:()=>new Promise(()=>{})}},setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,5)),clearTimeout};
  const start=assistant.indexOf('async function ledger('),end=assistant.indexOf('\nasync function environment(',start);
  const load=vm.runInNewContext(`${assistant.slice(start,end)};ledger`,scope);
  const result=await Promise.race([load(),new Promise(resolve=>setTimeout(()=>resolve('HUNG'),30))]);
  assert.equal(result,null,'Optional parity enrichment must degrade to the existing empty context');
});

test('a stale semantic script and stalled optional route cannot block model execution',async()=>{
  const source=assistant.slice(assistant.indexOf('function semanticRouter('),assistant.indexOf('\nasync function context('));
  const fallback={system:'fellowfare',source:'rules'};
  const scope={globalThis:{},semanticPromise:null,MINILM_ROUTER:'/router.js',setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,5)),clearTimeout,
    document:{scripts:[{src:'/app/minilm-context-router-v344.js',addEventListener(){},removeEventListener(){}}]},route:()=>fallback};
  const resolveRoute=vm.runInNewContext(`${source};semanticRoute`,scope);
  const first=await Promise.race([resolveRoute('Create a Manifest','fellowfare',[],{}),new Promise(resolve=>setTimeout(()=>resolve('HUNG'),30))]);
  assert.equal(first,fallback,'A loaded tag missing its API must reach the provider with rule context');
  scope.globalThis.CivweaveContextRouterV344={status:()=>({ready:true}),route:()=>new Promise(()=>{})};
  const second=await Promise.race([resolveRoute('Create a Manifest','fellowfare',[],{}),new Promise(resolve=>setTimeout(()=>resolve('HUNG'),30))]);
  assert.equal(second,fallback,'The optional semantic decision also has a deadline');
});
