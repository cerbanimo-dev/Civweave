import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/app/cerbanimo-chat-quest-capability-v2.js',import.meta.url),'utf8');
const plan=()=>({title:'QA text artifact',objective:'Write alpha beta gamma.',description:'Three local digital work units with inspectable text evidence.',workUnits:['alpha','beta','gamma'].map((word,index)=>({title:`Write ${word}`,result:`The text includes ${word}.`,proof:`Attach the text through ${word}.`,acceptanceCriteria:`The text contains ${['alpha','beta','gamma'].slice(0,index+1).join(' ')}.`})),assumptions:['Fictional local QA only.']});
function harness({provider='ollama',generate,createHook}={}){
  const calls=[],saved=[];let ensured=0;
  const selected={provider,route:provider,model:'qa-selected-model',maxTokens:4096,timeoutMs:90000};
  const context=vm.createContext({console,URL,AbortController,structuredClone,queueMicrotask,setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},addEventListener(){},dispatchEvent(){},CustomEvent:class{},document:{scripts:[]},location:{href:'https://civweave.test/app/working-campus-v440.html'},
    CivweaveUnifiedChatSystemV1:{registerCapability(){}},CivweaveAssistantV141:{selectedConfig:()=>selected},CivweaveFamilyAILoaderV105:{ensure:async()=>{ensured++}},
    CivweaveModelRuntime:{generate:async request=>{calls.push(request);return generate?generate(request,calls.length):{status:'success',actual:{provider,model:selected.model},outputJson:plan()}}},
    CivweaveCerbanimoQuestV144:{createQuestFromInput:input=>{createHook?.();return{id:'qa-endeavor',...input,tasks:input.steps.map((title,index)=>({id:`task-${index}`,title}))}},addQuest:(quest,options)=>{saved.push({quest,options});return{ok:true,quest}}}});
  vm.runInContext(source,context);
  return{calls,saved,selected,ensured:()=>ensured,create:request=>context.CivweaveCerbanimoChatQuestCapabilityV2.createEndeavor({text:'Create a local QA Endeavor to write alpha beta gamma.',history:[],...request})};
}

test('Ollama Endeavor authoring requests the actual required work-unit schema and disables hidden thinking',async()=>{
  const app=harness();await app.create({});const request=app.calls[0];
  assert.deepEqual(Array.from(request.schema.required),['title','objective','description','workUnits','assumptions']);
  assert.equal(request.schema.properties.workUnits.minItems,3);assert.equal(request.schema.properties.workUnits.maxItems,6);
  assert.deepEqual(Array.from(request.schema.properties.workUnits.items.required),['title','result','proof','acceptanceCriteria']);
  assert.equal(request.think,false);assert.equal(request.config.timeoutMs,90000,'the owner must not silently expand the deadline');assert.equal(app.saved.length,1);
});

test('initial and bounded repair requests retain caller cancellation and event callbacks',async()=>{
  const controller=new AbortController(),events=[],onEvent=event=>events.push(event),onToken=()=>{};
  const app=harness({generate:async(request,attempt)=>{request.onEvent?.({phase:'generating',attempt});return{status:'success',actual:{provider:'ollama',model:'qa-selected-model'},outputJson:attempt===1?{title:'Incomplete'}:plan()}}});
  await app.create({signal:controller.signal,onEvent,onToken,config:{maxTokens:1234,timeoutMs:45000}});
  assert.equal(app.calls.length,2);for(const request of app.calls){assert.equal(request.signal,controller.signal);assert.equal(request.onEvent,onEvent);assert.equal(request.onToken,onToken);assert.equal(request.think,false);assert.equal(request.config.maxTokens,1234);assert.equal(request.config.timeoutMs,45000)}
  assert.equal(events.length,2);assert.equal(app.saved.length,1);assert.equal(app.saved[0].quest.authoring.repaired,true);
});

test('Gemini retains its permissive transport and compatible application aliases',async()=>{
  const value=plan(),aliases={title:value.title,goal:value.objective,summary:value.description,tasks:value.workUnits.map(unit=>({name:unit.title,outcome:unit.result,evidence:unit.proof,doneWhen:unit.acceptanceCriteria})),assumptions:value.assumptions};
  const app=harness({provider:'gemini',generate:async()=>({status:'success',actual:{provider:'gemini',model:'qa-selected-model'},outputJson:aliases})});
  await app.create({});assert.deepEqual(JSON.parse(JSON.stringify(app.calls[0].schema)),{type:'object'});assert.equal('think'in app.calls[0],false);assert.equal(app.saved[0].quest.tasks.length,3);
});

test('an already cancelled Kamiya request starts no loader or model work',async()=>{
  const controller=new AbortController(),reason=new Error('QA stopped before startup');controller.abort(reason);const app=harness();
  await assert.rejects(app.create({signal:controller.signal}),error=>error===reason);assert.equal(app.ensured(),0);assert.equal(app.calls.length,0);assert.equal(app.saved.length,0);
});

test('Stop during a model request rejects a late successful response without repair or saving',async()=>{
  const controller=new AbortController(),reason=new Error('QA stopped while generating');let resolveModel;
  const app=harness({generate:()=>new Promise(resolve=>{resolveModel=resolve})});const pending=app.create({signal:controller.signal});
  for(let turn=0;!resolveModel&&turn<16;turn++)await Promise.resolve();assert.equal(typeof resolveModel,'function');controller.abort(reason);resolveModel({status:'success',actual:{provider:'ollama',model:'qa-selected-model'},outputJson:plan()});
  await assert.rejects(pending,error=>error===reason);assert.equal(app.calls.length,1);assert.equal(app.saved.length,0);
});

test('a cancelled provider result never triggers application repair',async()=>{
  const app=harness({generate:async()=>({status:'cancelled',error:{message:'QA provider cancelled'}})});
  await assert.rejects(app.create({}),/cancel/i);assert.equal(app.calls.length,1);assert.equal(app.saved.length,0);
});

test('cancellation while inspecting an invalid model document cannot start a repair request',async()=>{
  const controller=new AbortController(),reason=new Error('QA stopped before application repair');
  const app=harness({generate:async()=>({status:'success',actual:{provider:'ollama',model:'qa-selected-model'},get outputJson(){controller.abort(reason);return{title:'Incomplete'}}})});
  await assert.rejects(app.create({signal:controller.signal}),error=>error===reason);assert.equal(app.calls.length,1);assert.equal(app.saved.length,0);
});

test('Stop during the one repair attempt rejects a late repair result without saving',async()=>{
  const controller=new AbortController(),reason=new Error('QA stopped during repair');
  const app=harness({generate:async(_request,attempt)=>{if(attempt===1)return{status:'success',actual:{provider:'ollama',model:'qa-selected-model'},outputJson:{title:'Incomplete'}};controller.abort(reason);return{status:'success',actual:{provider:'ollama',model:'qa-selected-model'},outputJson:plan()}}});
  await assert.rejects(app.create({signal:controller.signal}),error=>error===reason);assert.equal(app.calls.length,2);assert.equal(app.saved.length,0);
});

test('cancellation after plan validation but before save cannot activate an Endeavor',async()=>{
  const controller=new AbortController(),reason=new Error('QA stopped before save');const app=harness({createHook:()=>controller.abort(reason)});
  await assert.rejects(app.create({signal:controller.signal}),error=>error===reason);assert.equal(app.calls.length,1);assert.equal(app.saved.length,0);
});

test('two invalid model attempts never fabricate replacement work units',async()=>{
  const app=harness({generate:async()=>({status:'success',actual:{provider:'ollama',model:'qa-selected-model'},outputJson:{title:'Incomplete',workUnits:[]}})});
  const result=await app.create({});assert.equal(app.calls.length,2);assert.equal(app.saved.length,0);assert.match(result.response.answer,/0 complete work units/);
});
