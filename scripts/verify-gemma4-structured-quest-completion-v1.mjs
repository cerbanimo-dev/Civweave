import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/app/local-ai/gemma4-structured-quest-completion-v1.js',import.meta.url),'utf8');
const storage=new Map([['civweave.local-ai.selection.v266',JSON.stringify({active:true,id:'gemma4-e4b-it-litert-web'})]]);
let generatedArgs=null;
const sandbox={
  console,
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))},
  CivweaveLocalModelDownloadV266:{selection:()=>JSON.parse(storage.get('civweave.local-ai.selection.v266'))},
  CivweaveLocalChatRuntimeV295:{generate:async args=>{generatedArgs=args;return{status:'success',outputText:'{"title":"Manifestation App","wish":"Learn manifestation and build an app","outcome":"A working app","assumptions":["Start with evidence-aware manifestation practice"],"paths":[{"type":"learning","realm":"living-school","title":"Learn","purpose":"Study manifestation critically","steps":["Study"],"completionCriteria":"Explain it","evidence":["Notes"]}]',executionId:'gemma4-e4b-it-litert-web',model:{id:'gemma4-e4b-it-litert-web'}}}},
  CivweaveModelRuntime:Object.freeze({version:'test',generate:async request=>({status:'success',request})}),
  queueMicrotask:fn=>fn(),
  setTimeout:fn=>{fn();return 1},
  clearTimeout:()=>{},
  addEventListener:()=>{},
  dispatchEvent:()=>{},
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  DOMException:globalThis.DOMException,
  structuredClone:globalThis.structuredClone
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'gemma4-structured-quest-completion-v1.js'});

const api=sandbox.CivweaveGemma4StructuredQuestCompletionV1;
assert.equal(api.version,'1.0.0-gemma4-structured-quest-completion-v1');
assert.equal(api.budgetFor('gemma4-e4b-it-litert-web'),2800,'E4B must receive its full local output budget');
assert.equal(api.budgetFor('gemma4-e2b-it-litert-web'),2400,'E2B must stay within its actual local output budget');

const request={
  purpose:'civweave-weaveling-intention-json-v190',
  __civweaveLocalStructuredPlan:true,
  config:{provider:'downloaded-local',model:'gemma4-e4b-it-litert-web',maxTokens:2200,stream:false},
  messages:[{role:'system',content:'Return only Quest JSON.'},{role:'user',content:'Help me learn manifestation and turn it into an app'}],
  schema:{type:'object',required:['title','paths'],properties:{title:{type:'string'},paths:{type:'array'},governance:{type:'object',required:['title','purpose','agreements','reviewQuestion'],properties:{included:{type:'boolean'},title:{type:'string'},purpose:{type:'string'},agreements:{type:'array'},reviewQuestion:{type:'string'}}}}},
  maxRepairAttempts:1
};
const hardened=api.hardenRequest(request);
assert.notEqual(hardened,request);
assert.equal(hardened.config.maxTokens,2800,'E4B Quest request must no longer be capped at 2200/2400');
assert.equal(hardened.config.provider,'downloaded-local');
assert.equal(hardened.schema.properties.governance.required,undefined,'governance:false must not fail the generic schema validator');
assert.match(hardened.messages[0].content,/included\":false/,'local Quest prompt must explicitly permit governance:false');
assert.equal(typeof hardened.transport,'function');

const first=await hardened.transport({config:hardened.config,messages:hardened.messages,emit:()=>{}});
assert.equal(generatedArgs.maxNewTokens,2800,'transport must pass the full E4B budget to LiteRT');
assert.equal(first.payload.finishReason,'MAX_OUTPUT_TOKENS','unclosed Quest JSON must propagate a truncation signal so shared repair activates');
assert.equal(api.jsonCompletion(first.text).truncated,true);

sandbox.CivweaveLocalChatRuntimeV295.generate=async args=>{generatedArgs=args;return{status:'success',outputText:'{"title":"Manifestation App","wish":"Learn manifestation and build an app","outcome":"A working app","assumptions":["Start critically"],"paths":[{"type":"learning","realm":"living-school","title":"Learn","purpose":"Study","steps":["Study"],"completionCriteria":"Explain","evidence":["Notes"]}],"governance":{"included":false}}',executionId:'gemma4-e4b-it-litert-web'}};
const complete=await hardened.transport({config:hardened.config,messages:hardened.messages,emit:()=>{}});
assert.equal(generatedArgs.maxNewTokens,2800);
assert.equal(complete.payload.finishReason,undefined,'complete JSON must not be mislabeled as truncated');
assert.equal(api.jsonCompletion(complete.text).complete,true);

const truncatedFailure=api.clarifyResult({status:'invalid-response',outputText:'{"title":"x","paths":[',structured:{errors:['invalid json']},error:{code:'INVALID_STRUCTURED_OUTPUT',message:'generic'}},hardened);
assert.match(truncatedFailure.error.message,/ended before the Quest JSON was complete/,'user-facing failure must identify truncation');
const schemaFailure=api.clarifyResult({status:'invalid-response',outputText:'{"title":"x","paths":[]}',structured:{errors:['$.paths must contain at least 1 items.']},error:{code:'INVALID_STRUCTURED_OUTPUT',message:'generic'}},hardened);
assert.match(schemaFailure.error.message,/returned complete JSON, but it did not satisfy the Quest contract/,'user-facing failure must distinguish schema rejection from truncation');

storage.set('civweave.local-ai.selection.v266',JSON.stringify({active:true,id:'gemma4-e2b-it-litert-web'}));
const e2=api.hardenRequest({...request,config:{...request.config,model:'gemma4-e2b-it-litert-web'}});
assert.equal(e2.config.maxTokens,2400);

console.log(JSON.stringify({ok:true,contract:'gemma4-structured-quest-completion-v1',e4Budget:2800,e2Budget:2400,truncationRepair:true,governanceFalseAllowed:true,failureDiagnostics:true},null,2));
