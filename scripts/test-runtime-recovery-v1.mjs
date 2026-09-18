import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read = file => readFileSync(new URL(`../public/app/${file}`, import.meta.url), 'utf8');
// Execute the real pure boundary functions without downloading multi-GB models.
function boundary(file, start, end, globals = {}) {
  const source = read(file);
  return vm.runInNewContext(`${source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))}\n${start.match(/function (\w+)/)[1]}`, globals);
}

test('Gemma thought channels never become a final answer, including truncated thought',()=>{
  const answer=boundary('local-ai/worker-v266.js','function visibleAnswer(', 'function makeStreamer(');
  assert.equal(answer('<|channel>thought\nprivate reasoning<channel|>Useful answer<turn|>'),'Useful answer');
  assert.equal(answer('<|channel>thought\nunfinished reasoning'),'');
  assert.equal(answer('<think>reasoning</think>The answer.'),'The answer.');
  assert.equal(answer('  const x = 1;\n  return x;'),'const x = 1;\n  return x;');
});

test('chat recovery shows failure rather than fabricating a canned reply',async()=>{
  const context={selectedLocal:()=>null,guide:()=>({name:'Weaveling',role:'guide'}),historyFor:()=>[],clean:v=>String(v||''),
    deterministicReply:()=>{throw new Error('Fabricated fallback must not run')},
    CivweaveModelRuntime:{generate:async request=>{assert.equal(request.deterministic,undefined);assert.equal(request.fallback,undefined);throw new Error('Provider offline')}},
  };
  const reply=boundary('guide-chat-surface-v350.js','async function fallbackReply(', 'function explicitHandoffTarget(',context);
  const result=await reply('civweave','Build a garden plan');
  assert.equal(result.provider,'model-error');assert.match(result.text,/Provider offline/);
});

test('local route helper never rewrites settings on load or Settings open', () => {
  const values = new Map([['civweave.local-ai.selection.v266',JSON.stringify({active:true,id:'gemma4-e2b-it-q4f16'})]]);
  const writes=[], listeners=new Map();
  const context={localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>writes.push([k,v])},
    document:{readyState:'loading',addEventListener(){},querySelector:()=>null},
    addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent(){},queueMicrotask:fn=>fn(),
    CustomEvent:class {constructor(type,init){this.type=type;this.detail=init?.detail}}};
  vm.runInNewContext(read('local-ai/primary-route-v283.js'),context);
  listeners.get('civweave:model-settings-opened')?.();listeners.get('pageshow')?.();
  assert.deepEqual(writes,[]);
});

test('guide generation preserves caller token and timeout budgets', () => {
  const optimize=boundary('fast-interactive-runtime-v192.js','function optimizedRequest(', 'function register(');
  const request={purpose:'civweave-guide-response-v141',config:{provider:'gemini',maxTokens:8192,timeoutMs:90000}};
  const next=optimize(request);
  assert.equal(next.config.maxTokens,8192);
  assert.equal(next.config.timeoutMs,90000);
});

test('Gemma external tensors map every decoder and embedding shard', () => {
  const setting=boundary('local-ai/worker-v266.js','function externalDataSetting(', 'const promptTokenCount=');
  const result=setting({artifacts:[
    {path:'onnx/decoder_model_merged_q4f16.onnx_data'},
    {path:'onnx/decoder_model_merged_q4f16.onnx_data_1'},
    {path:'onnx/embed_tokens_q4f16.onnx_data'},
  ]});
  assert.equal(result['decoder_model_merged_q4f16.onnx'],2);
  assert.equal(result['embed_tokens_q4f16.onnx'],1);
  assert.equal(setting({artifacts:[]}),false);
});

test('hosted structured output rejects malformed JSON and schema failures', () => {
  const resultFor=boundary('server-ai-router-v301.js','function resultFor(', 'async function discoverCandidates()', {
    clean:v=>String(v||''),now:()=>new Date().toISOString(),ROUTE:'server-auto',isDirectWorkersAI:()=>false,workersAiModel:()=>'',
    runtime:()=>({validateSchema:value=>typeof value?.answer==='string'?[]:['$.answer is required']})
  });
  assert.equal(resultFor({responseFormat:'json'},{text:'{"answer":'}).status,'invalid-response');
  assert.equal(resultFor({schema:{type:'object'}},{text:'{"wrong":1}'}).structured.valid,false);
  const result=resultFor({schema:{type:'object'}},{text:'{"answer":"Useful content"}'});
  assert.equal(result.outputJson.answer,'Useful content');assert.equal(result.structured.valid,true);
});

function settingsHarness(initial={}) {
  const values=new Map(Object.entries(initial)),session=new Map(),listeners=new Map();
  const storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
  const context={localStorage:storage(values),sessionStorage:storage(session),
    document:{addEventListener(){},removeEventListener(){},documentElement:{dataset:{}}},
    addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent(){},
    CustomEvent:class {constructor(type,init){this.type=type;this.detail=init?.detail}}};
  vm.runInNewContext(read('settings-gateway-v317.js').replace('const api=Object.freeze(', 'globalThis.testSettings={stateFrom,persist};const api=Object.freeze('),context);
  const form=(route,extra={})=>({elements:{namedItem:name=>({value:{route,model:'',endpoint:'',apiKey:'',credentialMode:'session',...extra}[name]||'',checked:false})}});
  return{context,values,session,form,api:context.testSettings};
}

test('saving local route persists the selected model; server-auto retains its device rung',()=>{
  const h=settingsHarness({'civweave.local-ai.selection.v266':JSON.stringify({active:true,id:'gemma4-e2b-it-q4f16'})});
  h.api.persist(h.api.stateFrom(h.form('downloaded-local')));
  assert.equal(JSON.parse(h.values.get('civweave-model-profiles-v1')).interactive.model,'gemma4-e2b-it-q4f16');
  h.api.persist(h.api.stateFrom(h.form('server-auto')));
  assert.equal(JSON.parse(h.values.get('civweave-model-profiles-v1')).interactive.provider,'server-auto');
  assert.equal(JSON.parse(h.values.get('civweave.local-ai.selection.v266')).active,true);
  h.api.persist(h.api.stateFrom(h.form('gemini')));
  assert.equal(JSON.parse(h.values.get('civweave.local-ai.selection.v266')).active,false);
});

test('switching provider cannot reuse another provider credential',()=>{
  const h=settingsHarness();
  h.session.set('civweave-model-session',JSON.stringify({provider:'gemini',apiKey:'test-gemini-only'}));
  assert.equal(h.api.stateFrom(h.form('openai-compatible')).apiKey,'');
  assert.equal(h.api.stateFrom(h.form('gemini')).apiKey,'test-gemini-only');
});

test('local selection is required before saving a local route',()=>{
  const h=settingsHarness();
  assert.throws(()=>h.api.stateFrom(h.form('downloaded-local')),/select|choose|download/i);
});

test('Cerbanimo parity deadline covers a stalled response body',async()=>{
  let aborted=false;
  const fetchWithTimeout=boundary('shared/civweave-parity-runtime.js','function fetchWithTimeout(', 'async function fetchText(',{
    FETCH_TIMEOUT_MS:10,fetch:async()=>({json:()=>new Promise(()=>{})}),setTimeout,clearTimeout,
    AbortController:class{signal={};abort(){aborted=true}},
  });
  await assert.rejects(fetchWithTimeout('/ledger',{timeout:10,consume:response=>response.json()}),/Timed out/);
  assert.equal(aborted,true);
});

test('Gemma LiteRT stays busy until its previous conversation is disposed',async()=>{
  let release,disposing;
  const started=new Promise(resolve=>disposing=resolve),deleted=new Promise(resolve=>release=resolve);
  const context={generationActive:false,pendingUnloadReason:'',selected:()=>({id:'e2b'}),profileFor:id=>({id,maxOutputTokens:2400}),
    fastStatus:async()=>({available:true}),now:()=>Date.now(),engineUsesMtp:false,lastMetrics:null,
    normalizedMessages:()=>[{role:'user',content:'Hello'}],normalizeStructuredTool:()=>null,
    emit(){},chunkText:x=>x,benchmarkMetrics:()=>({}),
    ensureEngine:async()=>({createConversation:async()=>({async *sendMessageStreaming(){yield 'Hello.'},delete:async()=>{disposing();await deleted}})}),
  };
  const run=boundary('local-ai/litert-gemma4-fast-runtime-v1.js','async function runFast(', 'async function accelerationTarget(',context);
  const first=run({});await started;
  try{assert.equal(context.generationActive,true);await assert.rejects(run({}),error=>error.code==='LOCAL_MODEL_BUSY')}finally{release();await first}
});


test('persistent shell accepts Pages clean URLs but rejects stale or foreign frames',()=>{
  const matches=boundary('persistent-system-shell-v1.js','function frameMatchesExpected(', 'function suppressChildChrome(',{URL,location:{href:'http://localhost/app/persistent-system-shell-v1.html'}});
  const expected='http://localhost/app/realm-console-v140.html?system=cerbanimo&embed=1';
  const host=href=>({dataset:{},contentWindow:{location:{href}}});
  assert.equal(matches(host(expected.replace('.html','')),expected),true);
  assert.equal(matches(host(expected.replace('cerbanimo','anarchadia')),expected),false);
  assert.equal(matches(host(expected.replace('localhost','foreign.example')),expected),false);
});

test('every system exposes Settings through its existing shortcuts menu',()=>{
  const quick=boundary('themed-system-nav-v178.js','function quickFor(', 'function clearEmbedded(',{QUICK:{cerbanimo:[{id:'chat'}],civweave:[{id:'settings'}]}});
  assert.equal(quick('cerbanimo').filter(x=>x.id==='settings').length,1);
  assert.equal(quick('civweave').filter(x=>x.id==='settings').length,1);
  assert.match(read('themed-system-nav-v178.js'),/tools.textContent='Tools & shortcuts'/);
});


test('changing a Gemma selection defers engine disposal until generation ends',async()=>{
  let deletes=0;
  const context={generationActive:true,pendingUnloadReason:'',engineReleasePromise:null,enginePromise:null,
    engine:{delete:async()=>{deletes++}},engineModelId:'e2b',engineUsesMtp:false,emit(){}};
  const unload=boundary('local-ai/litert-gemma4-fast-runtime-v1.js','async function unloadEngine(', 'async function instantiateEngine(',context);
  assert.equal(await unload('selection-change'),false);
  assert.equal(deletes,0);assert.equal(context.pendingUnloadReason,'selection-change');
  await unload('selection-change',{afterGeneration:true});
  assert.equal(deletes,1);assert.equal(context.engine,null);
});
