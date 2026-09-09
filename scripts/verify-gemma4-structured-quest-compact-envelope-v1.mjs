import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/app/local-ai/gemma4-structured-quest-compact-envelope-v1.js',import.meta.url),'utf8');
const registrySource=await readFile(new URL('../public/app/local-ai/gemma4-current-registry-authority-v1.js',import.meta.url),'utf8');
const requestAuthoritySource=await readFile(new URL('../public/app/local-ai/gemma4-litert-request-authority-v1.js',import.meta.url),'utf8');
const fastRuntimeSource=await readFile(new URL('../public/app/local-ai/litert-gemma4-fast-runtime-v1.js',import.meta.url),'utf8');

assert.match(registrySource,/gemma4-structured-quest-compact-envelope-v1\.js\?v=1\.1\.0-formatted-output/);
assert.match(registrySource,/gemma4-litert-request-authority-v1\.js\?v=1\.0\.0-first-request-formatted-output/);
assert.match(requestAuthoritySource,/firstRequestOwnership:true/);
assert.match(requestAuthoritySource,/genericTransformersBypass:true/);
assert.match(fastRuntimeSource,/conversationConfig\.enableConstrainedDecoding=true/);
assert.match(fastRuntimeSource,/prefaceConfig\.tools=\[formattedTool\]/);
assert.match(fastRuntimeSource,/chunkToolCalls\(response\)/);

const storage=new Map([['civweave.local-ai.selection.v266',JSON.stringify({active:true,id:'gemma4-e4b-it-litert-web'})]]);
const localSelection={active:true,id:'gemma4-e4b-it-litert-web'};
let generatedArgs=null,ensureCalls=0,formattedFailures=0;
const compactValue={t:'Manifestation Practice App',w:'Learn manifestation and turn it into an app',o:'A working evidence-aware practice app',a:['Treat manifestation as a goal-setting practice'],p:[{y:'learning',r:'living-school',t:'Learn manifestation',u:'Separate useful practices from unsupported claims',s:['Study visualization','Track outcomes'],c:'Explain the practice and evidence limits',e:['Learning notes']},{y:'skilled-labor',r:'cerbanimo',t:'Build the app',u:'Turn the practice into a daily tool',s:['Design daily prompt','Implement tracker'],c:'Run a usable prototype',e:['Working prototype']}],x:.84};
function canonicalizeQuestJson(text=''){try{const value=JSON.parse(String(text));return{valid:true,repaired:false,balanced:true,text:JSON.stringify(value),value,reasons:[]}}catch(error){return{valid:false,repaired:false,balanced:false,text:String(text),value:null,reasons:['invalid-json'],error:String(error?.message||error)}}}
function jsonCompletion(text=''){try{JSON.parse(String(text));return{hasJson:true,complete:true,truncated:false}}catch{return{hasJson:Boolean(text),complete:false,truncated:true}}}
const base={version:'1.0.2-gemma4-structured-quest-completion-v1-json-canonicalization',selectedLocal:()=>localSelection,budgetFor:id=>id==='gemma4-e4b-it-litert-web'?2800:2400,canonicalizeQuestJson,jsonCompletion,hardenRequest:request=>({...request,config:{...(request.config||{}),provider:'downloaded-local',model:localSelection.id,maxTokens:2800},maxRepairAttempts:1}),clarifyResult:result=>result};
const sandbox={
  console,JSON,Object,Array,String,Number,Boolean,RegExp,Promise,Math,Date,
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))},
  CivweaveGemma4StructuredQuestCompletionV1:base,
  CivweaveGemma4LiteRTRequestAuthorityV1:{version:'1.0.0-gemma4-litert-request-authority-v1',ensure:async()=>{ensureCalls++;return true}},
  CivweaveLocalChatRuntimeV295:{generate:async args=>{generatedArgs=args;if(args.structuredTool){if(formattedFailures>0){formattedFailures--;throw Object.assign(new Error('formatted lane unavailable'),{code:'TEST_FORMATTED_UNAVAILABLE'})}const argumentsObject=structuredClone(compactValue);return{status:'success',outputText:JSON.stringify(argumentsObject),executionId:localSelection.id,formattedOutput:{used:true,constrainedDecoding:true,toolName:'submit_quest',toolCall:{type:'function',function:{name:'submit_quest',arguments:argumentsObject}}}}}return{status:'success',outputText:JSON.stringify(compactValue),executionId:localSelection.id}}},
  CivweaveModelRuntime:{version:'test',generate:async request=>({status:'success',request})},CivweaveLocalModelRuntimeV266:{shutdown:()=>{}},
  queueMicrotask:fn=>fn(),setTimeout:()=>1,clearTimeout:()=>{},addEventListener:()=>{},dispatchEvent:()=>{},CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},DOMException:globalThis.DOMException,structuredClone:globalThis.structuredClone
};
sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:'gemma4-structured-quest-compact-envelope-v1.js'});
const api=sandbox.CivweaveGemma4StructuredQuestCompactEnvelopeV1;
assert.equal(api.version,'1.1.0-gemma4-structured-quest-compact-envelope-v1-formatted-output');assert.equal(api.formattedOutput,true);assert.equal(api.constrainedDecoding,true);assert.equal(api.compactTool.function.name,'submit_quest');assert.deepEqual([...api.compactTool.function.parameters.required],['t','w','o','a','p','x']);
const messages=[{role:'system',content:'Return full Quest JSON.'},{role:'user',content:`Generate the reviewable Quest from this working context:\n${JSON.stringify({currentRequest:'Help me learn manifestation and turn it into an app',resolvedPlanningRequest:'Help me learn manifestation and turn it into an app',recentConversation:[{role:'user',text:'Help me learn manifestation and turn it into an app'}]})}`}];
const transport=api.compactTransport();const result=await transport({config:{maxTokens:2800},messages,emit:()=>{}});const full=JSON.parse(result.text);
assert.equal(ensureCalls,1);assert.equal(generatedArgs.structuredTool.function.name,'submit_quest');assert.equal(generatedArgs.maxNewTokens,2800);assert.equal(full.title,'Manifestation Practice App');assert.equal(full.paths.length,2);assert.equal(full.paths[0].realm,'living-school');assert.equal(full.paths[1].realm,'cerbanimo');assert.equal(result.compactQuestEnvelope.formattedOutput,true);assert.equal(result.compactQuestEnvelope.constrainedDecoding,true);
formattedFailures=1;const fallback=await transport({config:{maxTokens:2800},messages,emit:()=>{}});assert.equal(JSON.parse(fallback.text).title,'Manifestation Practice App');assert.equal(fallback.compactQuestEnvelope.formattedOutput,false);assert.match(fallback.compactQuestEnvelope.formattedFallback,/formatted lane unavailable/);
const request={purpose:'civweave-weaveling-intention-json-v190',__civweaveLocalStructuredPlan:true,__civweaveSkipResponseRouter:true,config:{provider:'downloaded-local',model:localSelection.id,maxTokens:2200},messages,schema:{type:'object'}};const hardened=api.hardenRequest(request);assert.equal(hardened.maxRepairAttempts,2);assert.equal(typeof hardened.transport,'function');
console.log(JSON.stringify({ok:true,contract:'gemma4-structured-quest-compact-envelope-v1',formattedOutput:true,constrainedDecoding:true,firstRequestOwnership:true,compactFallback:true,e4Budget:2800,manifestationAppExpanded:true},null,2));