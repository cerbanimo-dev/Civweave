import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=name=>readFileSync(new URL(`../public/app/local-ai/${name}.js`,import.meta.url),'utf8');
function scope({local=true}={}){
  const queued=[],listeners=new Map(),events=[];
  const context={AbortController,document:{querySelector:()=>null,addEventListener(){}},localStorage:{getItem:()=>null},
    setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},queueMicrotask:callback=>queued.push(callback),
    addEventListener:(name,callback)=>listeners.set(name,[...(listeners.get(name)||[]),callback]),
    dispatchEvent:event=>{events.push(event);for(const callback of listeners.get(event.type)||[])callback(event)},
    CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail}},
    CivweaveFamilyAILoaderV105:{localRequested:()=>local,ensure:async()=>true},
    CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:'qwen35-4b-litert-web'})},
    CivweaveLocalGenerationModelPolicyV1:{resolve:()=> 'qwen35-4b-litert-web',supportsSelected:()=>true},
    CivweaveModelRuntime:{generate:async()=>({status:'success'})},CivweaveAssistantV141:{respond:async()=>({response:{answer:'QA'}})}};
  vm.createContext(context);
  return {context,events,load:name=>vm.runInContext(source(name),context,{filename:name+'.js'}),flush(){
    let count=0;while(queued.length&&count<1000){queued.shift()();count++}return{count,pending:queued.length};
  }};
}

test('structured authority readiness and route repair settle with a real selected local model',()=>{
  const app=scope();app.context.CivweaveGemma4FirstRequestIntakeBridgeV1={selectedGemma:()=>true,install:()=>true};
  app.load('gemma4-structured-task-authority-v1');app.load('gemma4-route-integrity-v1');
  assert.equal(app.flush().pending,0,'ready events must not continuously schedule their own repair');
  const before=app.events.filter(event=>event.type==='civweave:structured-task-authority-ready').length;
  for(let index=0;index<10;index++)app.context.CivweaveGemma4StructuredTaskAuthorityV1.install();
  assert.equal(app.flush().pending,0);assert.equal(app.events.filter(event=>event.type==='civweave:structured-task-authority-ready').length,before);
});

test('an active downloaded runtime retains cancellation if the saved route changes mid-request',async()=>{
  const app=scope();let forwarded;
  const button={type:'button',textContent:'Send',dataset:{},setAttribute(){}};
  app.context.document.querySelector=()=>button;
  app.context.CivweaveModelRuntime.generate=request=>{forwarded=request;return new Promise(resolve=>request.signal.addEventListener('abort',()=>resolve({status:'cancelled'})))};
  app.load('gemma4-structured-task-authority-v1');app.flush();
  const pending=app.context.CivweaveModelRuntime.generate({config:{provider:'downloaded-local'},purpose:'ordinary-guide-response'});
  await Promise.resolve();assert.ok(forwarded.signal);
  app.context.CivweaveFamilyAILoaderV105.localRequested=()=>false;
  const authority=app.context.CivweaveGemma4StructuredTaskAuthorityV1;
  authority.syncStopButton();assert.equal(button.dataset.generationStop,'true');
  authority.cancelActiveGeneration('fixture');await pending;assert.equal(forwarded.signal.aborted,true);
});

function installProvider(app,provider){
  app.context.CivweaveModelRuntime.readSharedConfig=()=>({provider,route:provider,model:'qa-model'});
  vm.runInContext(readFileSync(new URL('../public/app/local-provider-authority-v1.js',import.meta.url),'utf8'),app.context,{filename:'local-provider-authority-v1.js'});
  app.flush();return app.context.CivweaveLocalProviderAuthorityV1;
}

test('the downloaded provider authority respects configured and explicit HTTP routes',async()=>{
  const app=scope({local:false});const forwarded=[];
  app.context.CivweaveAssistantV141.respond=async args=>{forwarded.push(args);return{response:{answer:'Canonical HTTP response'}}};
  const authority=installProvider(app,'ollama');
  assert.equal(authority.localPinned(),false,'an installed downloaded choice cannot override the saved route');
  const request={text:'Create a Manifest',systemId:'fellowfare',config:{provider:'ollama'}};
  assert.equal((await app.context.CivweaveAssistantV141.respond(request)).response.answer,'Canonical HTTP response');
  assert.equal(forwarded[0],request);
  app.context.CivweaveModelRuntime.readSharedConfig=()=>({provider:'downloaded-local'});
  assert.equal(authority.localPinned(),true,'an actual downloaded route keeps its authority');
  assert.equal(authority.localPinned(request),false,'an explicit HTTP request remains authoritative');
  assert.equal((await app.context.CivweaveAssistantV141.respond(request)).response.answer,'Canonical HTTP response');
});

test('downloaded provider network guards preserve explicit HTTP requests',async()=>{
  const app=scope();const forwarded=[];
  app.context.CivweaveServerAIRouterV301={handle:async request=>{forwarded.push(request);return{handled:true}}};
  const authority=installProvider(app,'downloaded-local');
  assert.equal(authority.localPinned(),true);
  const purpose='civweave-guide-response-v141';
  const blocked=await app.context.CivweaveServerAIRouterV301.handle({purpose});
  assert.equal(blocked.reason,'LOCAL_PROVIDER_PINNED');assert.equal(forwarded.length,0);
  const request={purpose,config:{provider:'ollama'}};
  assert.equal((await app.context.CivweaveServerAIRouterV301.handle(request)).handled,true);
  assert.equal(forwarded[0],request);
});

test('saved downloaded selection cannot claim an explicitly configured Ollama route',()=>{
  const app=scope({local:false});app.load('gemma4-litert-request-authority-v1');app.load('gemma4-structured-task-authority-v1');
  assert.equal(app.context.CivweaveGemma4LiteRTRequestAuthorityV1.selectedFast(),false);
  const authority=app.context.CivweaveGemma4StructuredTaskAuthorityV1;
  assert.equal(authority.intakeEligible({text:'Create a Quest',systemId:'civweave'}),false);
  assert.equal(authority.intakeEligible({text:'Create a Quest',systemId:'civweave',config:{provider:'ollama'}}),false);
});

test('an explicit HTTP request bypasses downloaded intake even while the saved primary is local',()=>{
  const app=scope();app.load('gemma4-structured-task-authority-v1');
  const authority=app.context.CivweaveGemma4StructuredTaskAuthorityV1;
  assert.equal(authority.intakeEligible({text:'Create a Quest',systemId:'civweave',config:{provider:'ollama'}}),false);
  assert.equal(authority.intakeEligible({text:'Create a Quest',systemId:'civweave',config:{provider:'downloaded-local'}}),true);
});

test('ordinary unsignaled Ollama runtime calls preserve the canonical surface Stop owner',async()=>{
  const app=scope({local:false});let forwarded;
  const button={type:'button',textContent:'Stop',dataset:{},setAttribute(){}};
  app.context.document.querySelector=()=>button;
  app.context.CivweaveModelRuntime.generate=async request=>{forwarded=request;return{status:'success'}};
  app.load('gemma4-structured-task-authority-v1');
  assert.equal(app.flush().pending,0);
  await app.context.CivweaveModelRuntime.generate({config:{provider:'ollama'},purpose:'ordinary-guide-response'});
  assert.equal(forwarded.signal,undefined,'downloaded authority must not create an HTTP cancellation controller');
  assert.equal(button.dataset.generationStop,undefined);assert.equal(button.textContent,'Stop');
});
