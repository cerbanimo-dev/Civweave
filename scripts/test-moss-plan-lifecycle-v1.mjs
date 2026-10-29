import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/app/unified-chat-system-v1.js',import.meta.url),'utf8');
const learningKey='civweave.chat.capability.pending.living-school.plan.v1';
const modelPlan=()=>({title:'Celsius and Fahrenheit',capability:'Convert Celsius and Fahrenheit temperatures.',level:'beginner',mode:'guided',proof:'Calculate and check fictional temperature conversions.',modules:[{title:'Celsius scale',focus:'Celsius reference points and intervals.',outcome:'Identify zero Celsius.'},{title:'Fahrenheit scale',focus:'Fahrenheit reference points and intervals.',outcome:'Identify thirty two Fahrenheit.'},{title:'Temperature conversion',focus:'Celsius Fahrenheit conversion order.',outcome:'Convert twenty Celsius to sixty eight Fahrenheit.'}],assumptions:['Fictional temperatures only.']});
function harness({provider='ollama',generate,ensure}={}){
  const values=new Map(),calls=[];let ensured=0;
  const config={provider,model:'qa-selected',endpoint:'http://127.0.0.1:11434/api/chat',timeoutMs:90000,maxTokens:4096};
  const node={dataset:{},addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
  const context=vm.createContext({console,URL,URLSearchParams,AbortController,structuredClone,setTimeout,clearTimeout,queueMicrotask,document:{readyState:'loading',documentElement:node,body:node,scripts:[],querySelector:()=>null,querySelectorAll:()=>[]},location:{href:'https://civweave.test/app/working-campus-v440.html',search:'',pathname:'/app/working-campus-v440.html'},addEventListener(){},dispatchEvent(){},CustomEvent:class{},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},
    CivweaveModelRuntime:{readSharedConfig:()=>config,generate:async request=>{calls.push(request);return generate?generate(request):{status:'success',actual:{provider,model:config.model},outputJson:modelPlan()}}},
    CivweaveFamilyAILoaderV105:{ensure:async()=>{ensured++;await ensure?.()}},CivweaveWeavelingPlanJsonV190:{install:()=>true}});
  vm.runInContext(source,context);
  const api=context.CivweaveUnifiedChatSystemV1;
  return{values,calls,ensured:()=>ensured,api,create:options=>api.generateLivingSchoolPlan({text:'I want to learn to convert Celsius and Fahrenheit temperatures.',history:[],...options})};
}

test('Moss high-level Ollama planning retains the full schema and explicitly disables thinking',async()=>{
  const app=harness();await app.create({});const request=app.calls[0];
  assert.equal(request.think,false);assert.ok(request.schema.required.includes('modules'));assert.equal(request.schema.properties.modules.minItems,3);assert.equal(request.config.timeoutMs,90000);assert.equal(app.api.readLearningPlan()?.state,'review');
});

for(const text of [
  'Create a new standalone Learning Journey titled QA Temperature Conversions. For this fictional QA learner, teach Celsius to Fahrenheit and back with a calculator, using exactly three short beginner modules: formulas and units; worked forward and reverse examples; checking results and explaining mistakes. Save the plan for review before generating the curriculum.',
  'Observable capability: given a Celsius or Fahrenheit temperature, use a calculator to choose the right conversion formula, calculate the other unit, reverse-check the result, and explain an order-of-operations mistake. Title: QA Temperature Conversions. Exactly three beginner modules covering formulas and units, worked conversions, and error checking. Create the standalone Learning Journey plan for review.'
])test('Moss accepts an explicit teaching request or capability label without asking for the same goal again: '+text.slice(0,35),async()=>{
  const app=harness(),request=app.api.curriculumRequest({text,history:[]});
  assert.match(request.capability,/Celsius/);
  assert.equal(request.title,'QA Temperature Conversions');
  assert.equal(request.count,3);
  assert.equal('weaveId'in request,false);
  await app.create({text});
  assert.equal(app.calls.length,1,'an already supplied capability must reach the selected model once');
  assert.equal(app.api.readLearningPlan()?.request.title,'QA Temperature Conversions');
  assert.equal(app.api.readLearningPlan()?.state,'review');
});

test('Moss preserves caller model events without requiring the native phone route',async()=>{
  const events=[],controller=new AbortController();
  const app=harness({generate:async request=>{request.onEvent?.({phase:'connecting'});request.onEvent?.({phase:'partial',characters:42});return{status:'success',actual:{provider:'ollama',model:'qa-selected'},outputJson:modelPlan()}}});
  await app.create({signal:controller.signal,onEvent:event=>events.push(event)});assert.equal(app.calls[0].signal,controller.signal);assert.deepEqual(events.map(event=>event.phase),['connecting','partial']);assert.equal(app.api.readLearningPlan()?.state,'review');
});

test('an already stopped Moss request changes no saved plan and starts no runtime',async()=>{
  const controller=new AbortController(),reason=new Error('QA stopped before Moss');controller.abort(reason);const app=harness();
  app.values.set(learningKey,JSON.stringify({id:'previous-qa-plan',state:'review',request:{capability:'Previous topic'}}));
  await assert.rejects(app.create({signal:controller.signal}),error=>error===reason);assert.equal(app.ensured(),0);assert.equal(app.calls.length,0);assert.equal(JSON.parse(app.values.get(learningKey)).state,'review');
});

test('Stop while the Moss loader is preparing prevents the provider request',async()=>{
  const controller=new AbortController(),reason=new Error('QA stopped preparing Moss');const app=harness({ensure:()=>controller.abort(reason)});
  await assert.rejects(app.create({signal:controller.signal}),error=>error===reason);assert.equal(app.calls.length,0);assert.equal(app.api.readLearningPlan(),null);
});

test('Stop rejects a late successful Moss plan instead of saving a new REVIEW artifact',async()=>{
  const controller=new AbortController(),reason=new Error('QA stopped Moss generation');let resolveModel;
  const app=harness({generate:()=>new Promise(resolve=>{resolveModel=resolve})}),pending=app.create({signal:controller.signal});
  for(let turn=0;!resolveModel&&turn<16;turn++)await Promise.resolve();assert.equal(typeof resolveModel,'function');controller.abort(reason);resolveModel({status:'success',actual:{provider:'ollama',model:'qa-selected'},outputJson:modelPlan()});
  await assert.rejects(pending,error=>error===reason);assert.equal(app.api.readLearningPlan(),null);
});

test('a provider cancellation is not converted into an ordinary Moss failure packet',async()=>{
  const app=harness({generate:async()=>({status:'cancelled',error:{message:'QA provider cancelled'}})});
  await assert.rejects(app.create({}),/cancel/i);assert.equal(app.api.readLearningPlan(),null);
});

test('Gemini Moss planning does not inherit the Ollama-only thinking policy',async()=>{
  const app=harness({provider:'gemini'});await app.create({});assert.equal('think'in app.calls[0],false);assert.equal(app.api.readLearningPlan()?.state,'review');
});
