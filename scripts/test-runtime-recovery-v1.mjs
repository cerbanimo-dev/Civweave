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

function litertHarness(createConversation){
  const listeners=new Map();let selection={active:true,id:'gemma4-e2b-it-litert-web'},engineDeletes=0;
  const context={console,performance,queueMicrotask,
    addEventListener:(name,fn)=>listeners.set(name,[...(listeners.get(name)||[]),fn]),
    dispatchEvent:event=>{for(const listener of listeners.get(event.type)||[])listener(event)},
    CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
    WebAssembly:{Suspending:()=>{},promising:()=>{}},navigator:{gpu:{},platform:'Android'},
    caches:{open:async()=>({match:async()=>({ok:true,body:{}})})},
    CivweaveLocalModelDownloadV266:{selection:()=>selection,status:async()=>({available:true})},
    CivweaveLocalModelRegistryV266:{byId:()=>({artifacts:[{required:true,path:'model.litertlm'}]}),directUrl:()=>'/model.litertlm'},
    __mockLiteRT:{Backend:{GPU_ARTISAN:'gpu-artisan'},getOrLoadGlobalLiteRtLm:async()=>true,
      Engine:{create:async()=>({createConversation,delete:async()=>{engineDeletes++}})}}
  };
  const source=read('local-ai/litert-gemma4-fast-runtime-v1.js'),entry='import(MODULE_URL)';
  assert.equal(source.split(entry).length,2,'the real LiteRT module entrypoint must still be exercised');
  context.globalThis=context;vm.runInNewContext(source.replace(entry,'Promise.resolve(globalThis.__mockLiteRT)'),context);
  return{api:context.CivweaveLiteRTGemma4FastRuntimeV1,get engineDeletes(){return engineDeletes},
    select(value){selection=value;context.dispatchEvent({type:'civweave:local-model-selection'})}};
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
  const h=litertHarness(async()=>({async *sendMessageStreaming(){yield 'Hello.'},delete:async()=>{disposing();await deleted}}));
  const first=h.api.runFast({messages:[{role:'user',content:'Hello'}]});await started;
  try{assert.equal(h.api.state().generationActive,true);await assert.rejects(h.api.runFast({}),error=>error.code==='LOCAL_MODEL_BUSY')}finally{release();await first}
  assert.equal(h.api.state().generationActive,false);
});


test('persistent shell accepts Pages clean URLs but rejects stale or foreign frames',()=>{
  const matches=boundary('persistent-system-shell-v1.js','function frameMatchesExpected(', 'function suppressChildChrome(',{URL,location:{href:'http://localhost/app/persistent-system-shell-v1.html'}});
  const expected='http://localhost/app/realm-console-v140.html?system=cerbanimo&embed=1';
  const host=href=>({dataset:{},contentWindow:{location:{href}}});
  assert.equal(matches(host(expected.replace('.html','')),expected),true);
  assert.equal(matches(host(expected.replace('cerbanimo','anarchadia')),expected),false);
  assert.equal(matches(host(expected.replace('localhost','foreign.example')),expected),false);
  const school='http://localhost/app/cabinets/living-school/index.html?cabinet=1&installed=1&embed=1&persistentShell=1';
  assert.equal(matches(host(school.replace('index.html','')),school),true,'Pages index.html redirects must validate as the same embedded system');
  assert.equal(matches(host(school.replace('index.html','').replace('cabinet=1','cabinet=2')),school),false,'directory aliases must not accept stale query state');
});

test('every system exposes Settings through its existing shortcuts menu',()=>{
  const quick=boundary('themed-system-nav-v178.js','function quickFor(', 'function clearEmbedded(',{QUICK:{cerbanimo:[{id:'chat'}],civweave:[{id:'settings'}]}});
  assert.equal(quick('cerbanimo').filter(x=>x.id==='settings').length,1);
  assert.equal(quick('civweave').filter(x=>x.id==='settings').length,1);
  assert.match(read('themed-system-nav-v178.js'),/tools.textContent='Tools & shortcuts'/);
});


test('changing a Gemma selection defers engine disposal until generation ends',async()=>{
  let release,begin;
  const streaming=new Promise(resolve=>begin=resolve),finished=new Promise(resolve=>release=resolve);
  const h=litertHarness(async()=>({async *sendMessageStreaming(){begin();await finished;yield 'Hello.'},delete:async()=>{}}));
  const first=h.api.runFast({messages:[{role:'user',content:'Hello'}]});await streaming;
  h.select({active:false,id:''});
  assert.equal(h.engineDeletes,0);
  release();await first;
  assert.equal(h.engineDeletes,1);assert.equal(h.api.state().engineReady,false);
});

test('local chat attributes native fallback to the executing model while retaining the selected model',async()=>{
  const selected='qwen3-4b-q4f16',fallback='smollm3-3b-q4f16',reason='The selected model could not initialize its WebGPU session.';
  for(const [executed,reportedReason] of [[fallback,reason],[fallback,null],[selected,null]]){
    const events=[],writes=[],selection={active:true,id:selected};
    const localResult={text:'A response from the on-device execution boundary.',id:selected,executionId:executed,
      fallbackUsed:executed!==selected,fallbackChain:executed!==selected?[executed]:[],fallbackReason:reportedReason,
      usage:{outputTokens:9}};
    const context={URL,queueMicrotask,setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},addEventListener(){},
      dispatchEvent:event=>events.push(event),CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
      localStorage:{getItem:key=>key==='civweave.local-ai.selection.v266'?JSON.stringify(selection):null,setItem:(...args)=>writes.push(args)},
      document:{scripts:[],querySelector:()=>null},location:{href:'https://staging.example/app/persistent-system-shell-v1.html'},
      CivweaveLocalModelDownloadV266:{selection:()=>selection},
      CivweaveLocalChatRuntimeV295:{revision:'v312-runtime-first-bootstrap',inferenceCoreFirst:true,fullBootstrapBlocking:false,
        generate:async()=>localResult},
      CivweaveAssistantV141:{respond:async()=>{throw new Error('The pinned local request must not reach another provider')}}};
    vm.runInNewContext(read('local-provider-authority-v1.js'),context);
    const result=await context.CivweaveAssistantV141.respond({text:'Explain the result.',systemId:'cerbanimo'});
    assert.equal(result.model,executed,'the executed model must label the response');
    assert.equal(result.provider,'downloaded-local');assert.equal(result.response.answer,localResult.text);
    assert.equal(result.responseRouting.requestedModel,selected);assert.equal(result.responseRouting.model,executed);
    assert.equal(result.responseRouting.localTierFallback,executed!==selected);
    assert.deepEqual(Array.from(result.responseRouting.fallbackChain),localResult.fallbackChain);
    assert.equal(result.usage.outputTokens,9);assert.equal(selection.id,selected);assert.deepEqual(writes,[]);
    if(executed!==selected){
      assert.equal(result.fallbackFrom.model,selected);
      if(reportedReason)assert.equal(result.fallbackFrom.reason,reportedReason);
      else{assert.match(result.fallbackFrom.reason,/smollm3-3b-q4f16/);assert.match(result.fallbackFrom.reason,/qwen3-4b-q4f16/)}
      assert.equal(result.responseRouting.fallbackReason,result.fallbackFrom.reason);
    }
    else assert.equal(result.fallbackFrom,null);
    assert.equal(events.find(event=>event.type==='civweave:response-route').detail.model,executed);
  }
});


test('Ollama diagnostics load the shared provider runtime only after an explicit click', async () => {
  const source=read('settings-gateway-v317.js');
  const start=source.indexOf('function ensureModelRuntime(');
  const end=source.indexOf('function ensureSettingsUI(',start);
  assert.ok(start>=0&&end>start,'Shared Settings must own an on-demand model runtime dependency.');
  const block=source.slice(start,end);
  const checks=source.slice(source.indexOf('async function checkOllama('),source.indexOf("form.querySelector('[data-ollama-discover]')"));
  assert.match(checks,/await ensureModelRuntime\(\)/,'Both Ollama buttons must await the same runtime.');
  const open=source.slice(source.indexOf('function open(launcher)'),source.indexOf('function ensure()'));
  assert.doesNotMatch(open,/ensureModelRuntime\(/,'Opening Settings must not load the model provider.');
  const provider={discoverOllamaModels:async()=>[]};
  let loads=0;
  const scope={
    MODEL_PROVIDER_RUNTIME:'/app/shared/civweave-model-runtime.js?v=ollama-loopback-v1',
    append:async (url,ready)=>{
      loads++;
      assert.match(url,/\/app\/shared\/civweave-model-runtime\.js/);
      assert.equal(ready(),false);
      await Promise.resolve();
      scope.CivweaveModelRuntime=provider;
      assert.equal(ready(),true);
      return true;
    }
  };
  scope.globalThis=scope;
  const ensure=vm.runInNewContext('let modelRuntimePromise=null;'+block+'\nensureModelRuntime',scope);
  const first=ensure(),second=ensure();
  assert.equal(first,second,'Concurrent discovery clicks must share one runtime load.');
  assert.equal(await first,provider);
  assert.equal(await second,provider);
  assert.equal(await ensure(),provider,'A loaded runtime must be reused.');
  assert.equal(loads,1,'The runtime must load exactly once.');
});

test('Ollama model discovery distinguishes loopback from LAN address space',async()=>{
  const calls=[];
  const scope={URL,Response,AbortController,DOMException,TextEncoder,TextDecoder,setTimeout,clearTimeout,
    location:{href:'https://civweave-staging.pages.dev/app/working-campus-v440.html',origin:'https://civweave-staging.pages.dev'},
    fetch:async(url,options)=>{
      calls.push({url,options});
      return new Response(JSON.stringify({models:[{name:'gemma4:latest',size:123}]}),{status:200,headers:{'content-type':'application/json'}});
    }
  };
  scope.globalThis=scope;
  vm.runInNewContext(read('shared/civweave-model-runtime.js'),scope);
  const runtime=scope.CivweaveModelRuntime;
  assert.ok(runtime?.discoverOllamaModels,'Canonical provider runtime did not install.');
  const models=await runtime.discoverOllamaModels('http://127.0.0.1:11434/api/chat');
  assert.equal(models[0].name,'gemma4:latest');
  assert.equal(calls[0].options.targetAddressSpace,'loopback','127.0.0.1 must advertise loopback to the browser.');
  assert.match(calls[0].url,/127\.0\.0\.1:11434\/api\/tags/);
  await runtime.discoverOllamaModels('http://192.168.1.20:11434/api/chat');
  assert.equal(calls[1].options.targetAddressSpace,'local','LAN endpoints must advertise local address space.');
});


test('selected Ollama guide messages reach shared capabilities without downloaded-local inference',async()=>{
  const loader=read('family-ai-loader-v105.js'),chat=read('guide-chat-surface-v350.js'),campus=read('working-campus-v156.part5.txt'),parent=read('persistent-system-shell-v1.html');
  const start=loader.indexOf('function configuredOllama('),end=loader.indexOf('function emitLocalDegraded(',start);
  assert.ok(start>0&&end>start,'Shared AI loader must provide the selected Ollama guide entry.');
  const segment=loader.slice(start,end);
  assert.match(loader,/\['\/app\/cerbanimo-chat-quest-capability-v2\.js\?[^']*',\(\)=>globalThis\.CivweaveCerbanimoChatQuestCapabilityV2\]/,'The parent guide needs Kamiya’s canonical capability registration.');
  assert.match(loader,/\['\/app\/action-followthrough-v165\.js\?[^']*',\(\)=>globalThis\.CivweaveActionFollowthroughV165\]/,'Rook’s canonical approval owner must be available in the parent chat.');
  const scope={
    globalThis:null,
    MODEL_PROFILES_KEY:'civweave-model-profiles-v1',UNIVERSAL_AI_KEY:'civweave.universal-ai.v127',
    LABEL:{civweave:'Civweave','living-school':'Living School',cerbanimo:'Cerbanimo',fellowfare:'FellowFare',anarchadia:'Anarchadia'},
    PREREQUISITES:[['parity'],['shared-model-runtime']],
    GUIDE_CAPABILITIES:[['unified-chat'],['capability-passover']],OPTIONAL:[['intention-ui']],
    clean:(v,max=12000)=>String(v||'').slice(0,max),
    obj:key=>key==='civweave-model-profiles-v1'?{interactive:{provider:'ollama',model:'gemma4:latest',endpoint:'http://127.0.0.1:11434/api/chat'}}:{},
    loadScript:async(src)=>{assert.equal(src,'intention-ui');},
    loadSequence:async rows=>{assert.equal(rows,scope.GUIDE_CAPABILITIES);scope.loadedCapabilities++;},
    ensure:async()=>{scope.assistantLoaded++;},assistantLoaded:0,loadedCapabilities:0,
    CivweaveUnifiedChatSystemV1:{ensureWeavelingOrchestrator:async()=>{scope.orchestratorReady=true;},synchronize:()=>{scope.unifiedSynced=true;}},
    CivweaveGuideCapabilityPassoverV1:{synchronize:()=>{scope.passoverSynced=true;}},
    CivweaveModelRuntime:{generate:async()=>{throw new Error('The loader must not own a second model-generation path.');}},
    CivweaveAssistantV141:{respond:async request=>{
      assert.equal(scope.orchestratorReady,true);assert.equal(scope.unifiedSynced,true);assert.equal(scope.passoverSynced,true);
      scope.call=request;request.onToken('Hello','Hello from Ollama');return scope.result;
    }}
  };
  scope.globalThis=scope;
  const respond=vm.runInNewContext(segment+'\nrespondOllama',scope);
  let partial='';
  const controller=new AbortController();
  scope.result={response:{answer:'Hello from Ollama'},provider:'ollama',model:'gemma4:latest',plan:{id:'qa-quest',state:'review'},action:{id:'qa-action'},handoff:{targetSystem:'living-school'}};
  const response=await respond({text:'Hello Weaveling',system:'civweave',history:[{role:'user',text:'Earlier question'},{role:'assistant',text:'Earlier answer'},{role:'user',text:'Hello Weaveling'}],signal:controller.signal,onToken:(_delta,full)=>partial=full});
  assert.equal(scope.assistantLoaded,1);assert.equal(scope.loadedCapabilities,1);
  assert.equal(scope.call.config.provider,'ollama');
  assert.equal(scope.call.config.model,'gemma4:latest');
  assert.equal(scope.call.config.endpoint,'http://127.0.0.1:11434/api/chat');
  assert.equal(scope.call.systemId,'civweave');assert.equal(scope.call.handoffSystem,'civweave');
  assert.equal(scope.call.signal,controller.signal,'Stop must reach the canonical capability/model request.');
  assert.equal(scope.call.history.length,2,'Current turn must not be repeated in model history.');
  assert.equal(scope.call.history[0].text,'Earlier question');
  assert.equal(response,scope.result,'Real plan, action, handoff, approval and provenance metadata must be preserved.');
  assert.equal(response.response.answer,'Hello from Ollama');
  assert.equal(partial,'Hello from Ollama');
  for(const system of Object.keys(scope.LABEL)){
    await respond({text:`QA ${system}`,system,history:[],onToken(){}});
    assert.equal(scope.call.systemId,system);assert.equal(scope.call.handoffSystem,system);
  }
  controller.abort(new Error('QA stop'));
  const before=scope.assistantLoaded;
  await assert.rejects(respond({text:'Do not submit',signal:controller.signal}),/QA stop/);
  assert.equal(scope.assistantLoaded,before,'A cancelled request must not initialize or start a model.');
  assert.match(chat,/await globalThis\.CivweaveFamilyAILoaderV105\.respondOllama\(/,'Canonical floating guide must use the shared Ollama guide entry.');
  assert.match(parent,/family-ai-loader-v105\.js\?v=1\.0\.144-local-settings-pulse/,'Persistent desktop chat must load its provider dependency in the parent context.');
  assert.match(campus,/await loader\.respondOllama\(/,'Working Campus must use the same Ollama request path.');
  assert.match(campus,/const localSelection=ollamaRequested\?\{active:false\}:selectedLocalModel\(\)/,'A saved browser model must not override the selected Ollama route.');
  const chatSubmit=chat.slice(chat.indexOf('async function submitActive('),chat.indexOf('function switchGuide('));
  assert.ok(chatSubmit.indexOf('if(ollamaRequested)')<chatSubmit.indexOf('await globalThis.CivweaveFamilyAILoaderV105?.ensure?.()'),'Ollama must retain its selected-provider entry and cancellation owner.');
  assert.doesNotMatch(segment,/ensureLocalAI\(|tryEnsureLocalAI\(|runtime\.generate\(/,'The guide entry delegates to canonical capabilities without browser inference bootstrap or a second generation implementation.');
});

test('stale browser selection cannot override the primary Ollama model in the shared assistant',()=>{
  const assistant=read('assistant-runtime-v141.js');
  const selected=assistant.slice(assistant.indexOf('function selectedConfig('),assistant.indexOf('async function ledger('));
  assert.match(selected,/if\(\['ollama','openai-compatible','gemini'[^\n]+\.includes\(p\)\)/,'Network provider must precede downloaded model selection.');
});
