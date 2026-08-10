import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [policySource,workerSource,runtimeSource,bridgeSource,bootstrapSource]=await Promise.all([
  read('public/app/local-ai/small-model-policy-v281.js'),
  read('public/app/local-ai/worker-v266.js'),
  read('public/app/local-ai/runtime-v266.js'),
  read('public/app/local-ai/runtime-bridge-v266.js'),
  read('public/app/local-ai/bootstrap-v266.js')
]);
for(const source of [policySource,workerSource,runtimeSource,bridgeSource,bootstrapSource])new Function(source);
const policyContext={globalThis:null,dispatchEvent(){},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}}};policyContext.globalThis=policyContext;vm.createContext(policyContext);vm.runInContext(policySource,policyContext);
const policy=policyContext.CivweaveLocalSmallModelPolicyV281;
assert.ok(policy);
assert.equal(policy.profile({estimatedBytes:610_000_000},{purpose:'interactive'}).promptTokenBudget,2048);
assert.equal(policy.profile({estimatedBytes:790_000_000},{purpose:'interactive'}).promptTokenBudget,3072);
assert.equal(policy.profile({estimatedBytes:1_470_000_000},{purpose:'interactive'}).promptTokenBudget,4096);
assert.equal(policy.profile({estimatedBytes:790_000_000},{purpose:'interactive'}).initialSlice,256);
assert.equal(policy.profile({estimatedBytes:790_000_000},{purpose:'code-generation'}).initialSlice,384);
assert.equal(policy.validateCompletion({completion:{nearTokenLimit:true}},'A complete-looking sentence.',{}).clipped,true);
assert.equal(policy.validateCompletion({completion:{nearTokenLimit:false}},'{"answer":', {structured:true,jsonValid:false}).reason,'open-structure');
assert.equal(policy.validateCompletion({completion:{nearTokenLimit:false}},'Finished.',{}).clipped,false);
assert.equal(policy.mergeContinuation('abcdefghijklmno','klmnopqrstuvwxyz'),'abcdefghijklmnopqrstuvwxyz');
const workerContext={self:{postMessage(){},addEventListener(){}},Response:class{},globalThis:{},console};vm.createContext(workerContext);vm.runInContext(workerSource,workerContext);
const fakeTokenizer={encode:value=>Array(Math.max(1,Math.ceil(String(value).length/4))).fill(1)};
const largeMessages=[{role:'system',content:'s'.repeat(7000)},...Array.from({length:14},(_,index)=>({role:index%2?'assistant':'user',content:`turn ${index} `+'x'.repeat(900)}))];
const compacted=workerContext.compactContext(fakeTokenizer,largeMessages,2048);
assert.equal(compacted.compacted,true);
assert.ok(compacted.inputTokens<=2048);
assert.ok(compacted.droppedMessages>0);
assert.ok(workerSource.includes('promptTokenBudget')&&workerSource.includes('nearTokenLimit')&&workerSource.includes("completionReason=nearTokenLimit?'length':'stop'"));
assert.ok(runtimeSource.includes('maxNewTokens=384')&&runtimeSource.includes('promptTokenBudget=4096')&&runtimeSource.includes('completionMetadata:true'));
assert.ok(bridgeSource.includes('continuation-requested')&&bridgeSource.includes('completion-validation')&&bridgeSource.includes('continuationMessages')&&bridgeSource.includes('LOCAL_CONTINUATION_VALIDATOR'));
assert.ok(bridgeSource.includes("MIDDLEWARE_ID='downloaded-local-v275'"),'runtime spine middleware ID remains stable');
assert.ok(bootstrapSource.includes('/app/local-ai/small-model-policy-v281.js')&&bootstrapSource.includes('continuationValidation:true')&&bootstrapSource.includes('tokenizerAwareContext:true'));
console.log(JSON.stringify({ok:true,revision:'small-model-fast-path-v281',features:{tokenizerAwareContext:true,extractiveContextCompaction:true,adaptiveOutputSlices:true,clippingValidation:true,automaticContinuation:true,structuredContinuation:true,continuationLimit:true,residentPipeline:true}},null,2));
