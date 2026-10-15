import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Run the browser-owned telemetry UI against the real staged JS sources.
// No model weights or browser GPU needed: test both partial text and zero output.
const source=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const [trackerSource,inspectorSource,intakeSource,chatSource]=await Promise.all([
  source('public/app/guide-generation-tracker-v1.js'),
  source('public/app/generation-failure-inspector-v1.js'),
  source('public/app/local-ai/gemma4-structured-task-authority-v1.js'),
  source('public/app/guide-chat-surface-v350.js')
]);
const listeners=new Map(),events=[],values=new Map();
const addEventListener=(name,fn)=>listeners.set(name,[...(listeners.get(name)||[]),fn]);
const dispatchEvent=e=>{events.push(e);for(const fn of listeners.get(e.type)||[])fn(e);return true};
const CustomEvent=class{constructor(type,{detail}={}){this.type=type;this.detail=detail||{}}};
const localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
const document={getElementById:()=>null,createElement:()=>({id:'',textContent:'',append(){},dataset:{}}),head:{append(){}},addEventListener:()=>{}};
const context={console,Math,Date,Promise,Object,Array,Map,Set,JSON,String,RegExp,Boolean,Error,
  CustomEvent,addEventListener,dispatchEvent,localStorage,document,
  queueMicrotask:()=>{},setTimeout:()=>0,clearTimeout:()=>{},
  CivweaveModelRuntime:{generate:async()=>({status:'success'})}
};
context.globalThis=context;
const load=script=>vm.runInNewContext(script,context);
load(trackerSource);load(inspectorSource);
const tracker=context.CivweaveGuideGenerationTrackerV1;
const inspector=context.CivweaveGenerationFailureInspectorV1;
assert(tracker&&inspector);
const send=(type,detail)=>dispatchEvent(new CustomEvent(type,{detail}));
const E4B='gemma4-e4b-it-litert-web';
send('civweave:weaveling-intake-progress',{phase:'classifying',model:E4B});
send('civweave:weaveling-intake-progress',{phase:'streaming',model:E4B,token:'{"route":"learning"}'});
assert.equal(tracker.state().streams.intake,'{"route":"learning"}');
assert.equal(tracker.state().expanded,true,'The process should be open during generation');
assert.equal(tracker.state().executionModel,E4B,'The tracker must not fall back to the E2B selection label');
send('civweave:weaveling-intake-progress',{
  phase:'failed',model:E4B,code:'CIVWEAVE_E4B_INTAKE_INVALID',
  error:'Invalid generated JSON',outputText:'{"route":"learn'
});
assert.equal(tracker.state().terminal,'failed');
assert.equal(tracker.state().stages.intake.state,'failed');
assert.equal(inspector.latest().outputText,'{"route":"learn');
assert.equal(inspector.latest().model,E4B);
send('civweave:weaveling-intake-progress',{
  phase:'failed',model:E4B,code:'LOCAL_MODEL_EMPTY_OUTPUT',
  error:'No visible output',outputText:'',
  rawDiagnostics:{chunksObserved:2,textDeltas:0,nontextChunks:2}
});
assert.equal(inspector.latest().empty,true);
assert.equal(inspector.latest().rawDiagnostics.chunksObserved,2);
assert.ok(localStorage.getItem('civweave.local-generation-failure.v1'));

const textParts=[
  'actualPlanningModel(result)',
  "return'gemma4-e4b-it-litert-web'",
  'model:actualPlanningModel(result)'
];
for(const part of textParts)assert.ok(chatSource.includes(part),'The chat metadata mapping lost: '+part);
assert.ok(intakeSource.includes('structuredTool:null'),'The E4B intake must stream visible JSON instead of using the blocking constrained tool route.');
assert.ok(inspectorSource.includes("button.textContent='Show failing message'"));
console.log(JSON.stringify({ok:true,contract:'e4b-streaming-intake-visibility-and-rejection',actualModel:E4B,streamed:true,zeroOutputVisible:true,rejectedOutputVisible:true,uiExpandedByDefault:true},null,2));
