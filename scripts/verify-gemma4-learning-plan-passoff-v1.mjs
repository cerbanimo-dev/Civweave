import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const pipelineSource=await readFile(new URL('../public/app/local-ai/gemma4-weave-draft-pipeline-v1.js',import.meta.url),'utf8');
const shell=await readFile(new URL('../public/app/persistent-system-shell-v1.html',import.meta.url),'utf8');

assert.doesNotMatch(pipelineSource,/gemma4-e2b-it-litert-web|E2B/,'Weave pipeline must not reference E2B');
assert.match(pipelineSource,/DEEP_MODEL='gemma4-e4b-it-litert-web'/);
assert.match(pipelineSource,/architecture:'E4B intake -> E4B free Weave Draft -> E4B JSON compile/);

const structured=shell.indexOf('gemma4-structured-task-authority-v1.js');
const pipeline=shell.indexOf('gemma4-weave-draft-pipeline-v1.js');
const intake=shell.indexOf('gemma4-first-request-intake-bridge-v1.js');
const entry=shell.indexOf('gemma4-learning-plan-entry-authority-v1.js');
assert(structured>=0&&pipeline>structured&&intake>pipeline&&entry>intake,'persistent shell load order changed');

const calls=[]; const events=[]; const storage=new Map();
const compiled={title:'Tarot Memory System',capability:'Recall and interpret tarot cards using a repeatable memory system.',level:'beginner',mode:'guided',proof:'Accurately explain and recall the cards from memory.',modules:[{title:'Structure',focus:'Learn deck structure',outcome:'Recall suits and major arcana'},{title:'Images',focus:'Build image anchors',outcome:'Associate each card with a cue'},{title:'Practice',focus:'Use spaced recall',outcome:'Recall cards without prompts'}],assumptions:['Learner is starting from beginner level'],resourceManifest:[],specialistWork:[],decisionGates:[]};
const sandbox={console,JSON,Object,Array,String,Number,Boolean,RegExp,Promise,Math,Date,structuredClone:globalThis.structuredClone,localStorage:{setItem:(key,value)=>storage.set(key,value),getItem:key=>storage.get(key)??null},queueMicrotask,addEventListener:()=>{},setTimeout:()=>0,CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},dispatchEvent:event=>{events.push(event.detail);return true},CivweaveGemma4StructuredTaskAuthorityV1:{taskTimeoutMs:600000,paintPending(){},requireDeepModel:async()=>true,controlledFastRun:async(args,model,label)=>{calls.push({args,model,label});assert.equal(model,'gemma4-e4b-it-litert-web');if(label==='E4B Weave Draft')return{outputText:'Title: Tarot Memory System. Build deck structure, imagery anchors, spaced recall, and practice. Proof: explain cards from memory.'};if(label==='E4B JSON Compile')return{outputText:JSON.stringify(compiled)};throw new Error(`Unexpected stage ${label}`);}}};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(pipelineSource,sandbox,{filename:'gemma4-weave-draft-pipeline-v1.js'});
const api=sandbox.CivweaveGemma4WeaveDraftPipelineV1;
const schema={type:'object',required:['title','capability','level','modules','proof'],properties:{title:{type:'string'},capability:{type:'string'},level:{type:'string',enum:['beginner','intermediate','advanced']},proof:{type:'string'},modules:{type:'array',minItems:3,items:{type:'object',required:['title','focus','outcome'],properties:{title:{type:'string'},focus:{type:'string'},outcome:{type:'string'}}}}}};
const result=await api.weaveTransport('living-school-learning-plan-review-v2',{config:{provider:'downloaded-local',model:'gemma4-e2b-it-litert-web'},messages:[{role:'user',content:'Could you help me learn a system for remembering the tarot?'}],schema});
assert.deepEqual(calls.map(call=>call.model),['gemma4-e4b-it-litert-web','gemma4-e4b-it-litert-web']);
assert.deepEqual(calls.map(call=>call.label),['E4B Weave Draft','E4B JSON Compile']);
assert.ok(calls.every(call=>call.args.structuredTool===null));
assert.equal(JSON.parse(result.text).title,'Tarot Memory System');
assert.equal(result.model,'gemma4-e4b-it-litert-web');
assert(events.some(row=>row.phase==='draft'&&row.state==='complete'));
assert(events.some(row=>row.phase==='compile'&&row.state==='complete'));
assert(events.some(row=>row.phase==='pipeline'&&row.state==='complete'));
console.log(JSON.stringify({ok:true,contract:'gemma4-learning-plan-e4b-only-v1',models:calls.map(call=>call.model),selectedModelBypassed:'gemma4-e2b-it-litert-web'},null,2));
