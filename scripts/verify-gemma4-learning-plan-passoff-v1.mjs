import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const pipelineSource=await readFile(new URL('../public/app/local-ai/gemma4-weave-draft-pipeline-v1.js',import.meta.url),'utf8');
const shell=await readFile(new URL('../public/app/persistent-system-shell-v1.html',import.meta.url),'utf8');

assert.match(pipelineSource,/DRAFT_MODEL='gemma4-e2b-it-litert-web'/,'Learning Journey working draft must belong to E2B');
assert.match(pipelineSource,/DEEP_MODEL='gemma4-e4b-it-litert-web'/,'Learning Journey JSON compile must belong to E4B');
assert.match(pipelineSource,/structuredTool:null/,'draft and compiler passes must not push the final schema contract down into E2B provider generation');
assert.match(pipelineSource,/architecture:'E2B free working draft -> E4B JSON compile/);

const structured=shell.indexOf('gemma4-structured-task-authority-v1.js');
const pipeline=shell.indexOf('gemma4-weave-draft-pipeline-v1.js');
const intake=shell.indexOf('gemma4-first-request-intake-bridge-v1.js');
const entry=shell.indexOf('gemma4-learning-plan-entry-authority-v1.js');
assert(structured>=0&&pipeline>structured&&intake>pipeline&&entry>intake,'persistent shell must load structured authority -> pass-off pipeline -> intake bridge -> Learning Journey entry authority');

const calls=[];
const events=[];
const storage=new Map();
const compiled={
  title:'Tarot Memory System',
  capability:'Recall and interpret tarot cards using a repeatable memory system.',
  level:'beginner',
  mode:'guided',
  proof:'Accurately explain and recall the cards from memory.',
  modules:[
    {title:'Structure',focus:'Learn deck structure',outcome:'Recall suits and major arcana'},
    {title:'Images',focus:'Build image anchors',outcome:'Associate each card with a cue'},
    {title:'Practice',focus:'Use spaced recall',outcome:'Recall cards without prompts'}
  ],
  assumptions:['Learner is starting from beginner level'],
  resourceManifest:[],specialistWork:[],decisionGates:[]
};

const sandbox={
  console,JSON,Object,Array,String,Number,Boolean,RegExp,Promise,Math,Date,
  structuredClone:globalThis.structuredClone,
  localStorage:{setItem:(key,value)=>storage.set(key,value),getItem:key=>storage.get(key)??null},
  queueMicrotask,
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent:event=>{events.push(event.detail);return true},
  CivweaveGemma4StructuredTaskAuthorityV1:{
    taskTimeoutMs:600000,
    paintPending(){},
    requireIntakeModel:async()=>true,
    requireDeepModel:async()=>true,
    controlledFastRun:async(args,model,label)=>{
      calls.push({args,model,label});
      if(model==='gemma4-e2b-it-litert-web')return{outputText:'Title: Tarot Memory System\nCapability: Recall and interpret tarot cards.\nModules: structure, imagery, practice.\nProof: explain cards from memory.'};
      if(model==='gemma4-e4b-it-litert-web')return{outputText:JSON.stringify(compiled)};
      throw new Error(`Unexpected model ${model}`);
    }
  }
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(pipelineSource,sandbox,{filename:'gemma4-weave-draft-pipeline-v1.js'});

const api=sandbox.CivweaveGemma4WeaveDraftPipelineV1;
assert.equal(api.draftModel,'gemma4-e2b-it-litert-web');
assert.equal(api.deepModel,'gemma4-e4b-it-litert-web');

const schema={type:'object',required:['title','capability','level','modules','proof'],properties:{
  title:{type:'string'},capability:{type:'string'},level:{type:'string',enum:['beginner','intermediate','advanced']},proof:{type:'string'},
  modules:{type:'array',minItems:3,items:{type:'object',required:['title','focus','outcome'],properties:{title:{type:'string'},focus:{type:'string'},outcome:{type:'string'}}}}
}};

const result=await api.weaveTransport('living-school-learning-plan-review-v2',{messages:[{role:'user',content:'Could you help me learn a system for remembering the tarot?'}],schema});
assert.deepEqual(calls.map(call=>call.model),['gemma4-e2b-it-litert-web','gemma4-e4b-it-litert-web'],'working draft must execute on E2B and only then hand off to E4B');
assert.equal(calls[0].args.structuredTool,null,'E2B working draft must not receive a structured-output contract');
assert.equal(calls[1].args.structuredTool,null,'E4B compiler returns text JSON for deterministic local validation rather than provider-side schema rejection');
assert.match(calls[0].args.systemPrompt,/not JSON/i);
assert.match(calls[1].args.systemPrompt,/JSON compiler/i);
assert.equal(JSON.parse(result.text).title,'Tarot Memory System');
assert(events.some(row=>row.phase==='draft'&&row.state==='complete'&&row.model==='gemma4-e2b-it-litert-web'),'visible draft phase must complete on E2B');
assert(events.some(row=>row.phase==='compile'&&row.state==='complete'&&row.model==='gemma4-e4b-it-litert-web'),'visible compile phase must complete on E4B');
assert(events.some(row=>row.phase==='validate'&&row.state==='complete'),'deterministic validation must run after compile');
assert(events.some(row=>row.phase==='pipeline'&&row.state==='complete'),'pipeline must reach Saved/complete');

console.log(JSON.stringify({ok:true,contract:'gemma4-learning-plan-passoff-v1',models:calls.map(call=>call.model),draftUnstructured:true,compilerAfterDraft:true,validated:true,shellOrder:true},null,2));
